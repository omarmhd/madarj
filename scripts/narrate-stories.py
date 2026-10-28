"""
Narrate the stories: one MP3 per story, in its narrator's voice, with
the start of every line in a VTT beside it.

  * The voice is the story's, not the learner's: `narrator: f` is
    Jenny, `narrator: m` is Alan, the same two British Piper voices as
    the level tests (scripts/narrate-tests.py).
  * Each line is spoken on its own and then joined, so its length is
    known exactly from its frames. The timing comes from the sum, not
    from aligning a finished file, which drifts without saying so.
  * The VTT's first note records the voice and the text. Change a
    story's lines or its narrator and only that story is spoken again;
    files of stories that are gone are deleted.

Then `php artisan stories:import` raises each story's has_audio flag.

Usage:
  python -m pip install piper-tts lameenc
  python scripts/narrate-stories.py --voices=<dir with the .onnx files>
  ... --slug=tortoise-and-hare      one story
  ... --force                       speak again even if unchanged
"""

import argparse
import hashlib
import io
import json
import pathlib
import sys
import wave

import lameenc
from piper import PiperVoice

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'audio' / 'stories'

VOICES = {'f': 'en_GB-jenny_dioco-medium', 'm': 'en_GB-alan-medium'}
GAP_SECONDS = 0.5
BITRATE = 48


def key(story):
    """What the file was made from — kept in the VTT to skip unchanged stories."""
    text = VOICES[story['narrator']] + '\n' + '\n'.join(story['lines'])
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:16]


def speak(voice, text):
    # The voice is loaded once: from the command line it was reloaded for every line
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        voice.synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf) as w:
        return w.getparams(), w.readframes(w.getnframes())


def stamp(seconds):
    """12.345 → 00:00:12.345"""
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02}.{ms:03}'


def recorded_key(vtt):
    if not vtt.exists():
        return None
    for line in vtt.read_text(encoding='utf-8').splitlines():
        if line.startswith('NOTE key='):
            return line[len('NOTE key='):].strip()
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voices', required=True, help='folder holding the two .onnx voices')
    ap.add_argument('--slug', help='narrate this story only')
    ap.add_argument('--force', action='store_true', help='speak again even if unchanged')
    args = ap.parse_args()

    voices = {g: pathlib.Path(args.voices) / f'{n}.onnx' for g, n in VOICES.items()}
    for v in voices.values():
        if not v.exists():
            sys.exit(f'Missing voice: {v}')
    loaded = {}

    stories = []
    for f in sorted((ROOT / 'content').glob('stories-*.json')):
        stories += json.loads(f.read_text(encoding='utf-8'))['stories']

    for s in stories:
        if s.get('narrator') not in VOICES:
            sys.exit(f"{s['slug']}: narrator must be one of {', '.join(VOICES)}")

    chosen = [s for s in stories if not args.slug or s['slug'] == args.slug]
    if not chosen:
        sys.exit('No matching story.')

    OUT.mkdir(parents=True, exist_ok=True)

    for story in chosen:
        slug, k = story['slug'], key(story)
        mp3, vtt = OUT / f'{slug}.mp3', OUT / f'{slug}.vtt'

        if mp3.exists() and recorded_key(vtt) == k and not args.force:
            print(f'  = {slug}')
            continue

        params, chunks, cues, at = None, [], [], 0.0
        for line in story['lines']:
            g = story['narrator']
            loaded[g] = loaded.get(g) or PiperVoice.load(str(voices[g]))
            p, frames = speak(loaded[g], line)
            if params and p.framerate != params.framerate:
                sys.exit('The two voices must share a sample rate')
            params = params or p
            length = len(frames) / (p.sampwidth * p.nchannels * p.framerate)
            cues.append((at, at + length, line))
            chunks.append(frames)
            at += length + GAP_SECONDS

        gap = b'\x00' * (params.sampwidth * params.nchannels * int(params.framerate * GAP_SECONDS))

        enc = lameenc.Encoder()
        enc.set_bit_rate(BITRATE)
        enc.set_in_sample_rate(params.framerate)
        enc.set_channels(params.nchannels)
        enc.set_quality(2)
        mp3.write_bytes(enc.encode(gap.join(chunks)) + enc.flush())

        out = ['WEBVTT', '', f'NOTE key={k}', '']
        for i, (a, b, text) in enumerate(cues, 1):
            out += [str(i), f'{stamp(a)} --> {stamp(b)}', text, '']
        vtt.write_text('\n'.join(out), encoding='utf-8')

        print(f"  + {slug} ({story['narrator']}): {cues[-1][1]:.1f}s, {mp3.stat().st_size // 1024} KB")

    # Files of stories no longer in the content
    if not args.slug:
        slugs = {s['slug'] for s in stories}
        for f in list(OUT.glob('*.mp3')) + list(OUT.glob('*.vtt')):
            if f.stem not in slugs:
                f.unlink()
                print(f'  - removed {f.name}')

    total = sum(f.stat().st_size for f in OUT.glob('*.mp3'))
    print(f'{len(list(OUT.glob("*.mp3")))} stories, {total // 1024} KB in {OUT.relative_to(ROOT)}')
    print('Then: php artisan stories:import')


if __name__ == '__main__':
    main()
