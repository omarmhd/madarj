"""
Narrate the level tests' listening — one MP3 per dialogue, two voices.

Level tests are the one place the browser's voice is not good enough:
it differs from device to device, so two learners sitting the same test
heard different things, and a test with a certificate on it must sound
the same for everyone. So the listening is generated here, once, with
Piper (free, offline), and served as files.

  * One file per listening part, each line in its speaker's voice
    (`g: f` → the female voice, `g: m` → the male one), a pause between.
  * The file is named after its text: change a dialogue and its name
    changes, so only that part is generated again. Files no test uses
    any more are deleted.
  * British voices, not American: the book's sound contrasts
    (cat/cart, hat/heart) rest on British, non-rhotic English.

The server finds a file by computing the same name (LevelTest::audioFor);
the key below must stay in step with it.

Usage (once Piper and the two voices are on the machine):
  python -m pip install piper-tts lameenc
  python scripts/narrate-tests.py --voices=<dir with the .onnx files>
"""

import argparse
import hashlib
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import wave

import lameenc

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'audio' / 'tests'

# Must match LevelTest::VOICE_SET — it is part of every file's name
VOICE_SET = 'gb-jenny-alan'
VOICES = {'f': 'en_GB-jenny_dioco-medium', 'm': 'en_GB-alan-medium'}
GAP_SECONDS = 0.6
BITRATE = 48


def key(audio):
    """The file's name: the voices and the lines. Kept identical in PHP."""
    text = VOICE_SET + '\n' + '\n'.join(f"{l['g']}:{l['text']}" for l in audio)
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:16]


def speak(model, text):
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / 'line.wav'
        subprocess.run(
            [sys.executable, '-m', 'piper', '-m', str(model), '-f', str(out)],
            input=text.encode('utf-8'), check=True, capture_output=True,
        )
        with wave.open(str(out)) as w:
            return w.getparams(), w.readframes(w.getnframes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voices', required=True, help='folder holding the two .onnx voices')
    ap.add_argument('--force', action='store_true', help='generate again even if the file exists')
    args = ap.parse_args()

    voices = {g: pathlib.Path(args.voices) / f'{n}.onnx' for g, n in VOICES.items()}
    for v in voices.values():
        if not v.exists():
            sys.exit(f'Missing voice: {v}')

    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set()

    for test_file in sorted((ROOT / 'content' / 'level-tests').glob('*.json')):
        test = json.loads(test_file.read_text(encoding='utf-8'))
        for sec in test['sections']:
            for n, part in enumerate(sec.get('parts', []), 1):
                audio = part.get('audio')
                if not audio:
                    continue
                name = key(audio) + '.mp3'
                wanted.add(name)
                dest = OUT / name
                if dest.exists() and not args.force:
                    print(f'  = {test_file.stem} {sec["key"]} {n}: {name}')
                    continue

                params, chunks = None, []
                for line in audio:
                    p, frames = speak(voices[line['g']], line['text'])
                    if params and p.framerate != params.framerate:
                        sys.exit('The two voices must share a sample rate')
                    params = params or p
                    chunks.append(frames)
                gap = b'\x00' * (params.sampwidth * params.nchannels * int(params.framerate * GAP_SECONDS))
                pcm = gap.join(chunks)

                enc = lameenc.Encoder()
                enc.set_bit_rate(BITRATE)
                enc.set_in_sample_rate(params.framerate)
                enc.set_channels(params.nchannels)
                enc.set_quality(2)
                dest.write_bytes(enc.encode(pcm) + enc.flush())
                print(f'  + {test_file.stem} {sec["key"]} {n}: {name} ({dest.stat().st_size // 1024} KB)')

    # Files no test uses any more
    for f in OUT.glob('*.mp3'):
        if f.name not in wanted:
            f.unlink()
            print(f'  - removed {f.name}')

    total = sum(f.stat().st_size for f in OUT.glob('*.mp3'))
    print(f'{len(wanted)} files, {total // 1024} KB in {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
