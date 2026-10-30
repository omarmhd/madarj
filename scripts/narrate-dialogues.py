"""
Narrate the dialogues: one small MP3 per spoken line, in its speaker's
Piper voice.

The voices and the file names are decided on the server
(App\\Support\\DialogueVoices), so this script asks for them with
`php artisan dialogues:audio-list` instead of repeating the rule. A
file already there is skipped: its name is its voice and its words, so
a changed line gets a new name. Files no line uses any more are deleted.

Run it after `content:import`, so the list reflects the content.

Usage:
  python -m pip install piper-tts lameenc
  python scripts/narrate-dialogues.py --voices=<dir with the .onnx files>
"""

import argparse
import io
import json
import pathlib
import subprocess
import sys
import wave

import lameenc
from piper import PiperVoice

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'audio' / 'dialogues'
BITRATE = 48


def mp3(voice, text):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        voice.synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf) as w:
        enc = lameenc.Encoder()
        enc.set_bit_rate(BITRATE)
        enc.set_in_sample_rate(w.getframerate())
        enc.set_channels(w.getnchannels())
        enc.set_quality(2)
        return enc.encode(w.readframes(w.getnframes())) + enc.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voices', required=True, help='folder holding the .onnx voices')
    ap.add_argument('--force', action='store_true', help='speak every line again')
    args = ap.parse_args()

    listed = subprocess.run(
        ['php', 'artisan', 'dialogues:audio-list'],
        cwd=ROOT, check=True, capture_output=True,
    ).stdout.decode('utf-8')
    lines = json.loads(listed)

    for model in {l['model'] for l in lines}:
        if not (pathlib.Path(args.voices) / f'{model}.onnx').exists():
            sys.exit(f'Missing voice: {model}.onnx')

    OUT.mkdir(parents=True, exist_ok=True)
    loaded, made = {}, 0

    for l in lines:
        dest = OUT / l['file']
        if dest.exists() and not args.force:
            continue
        m = l['model']
        loaded[m] = loaded.get(m) or PiperVoice.load(str(pathlib.Path(args.voices) / f'{m}.onnx'))
        dest.write_bytes(mp3(loaded[m], l['text']))
        made += 1
        if made % 50 == 0:
            print(f'  {made} lines…')

    wanted = {l['file'] for l in lines}
    removed = 0
    for f in OUT.glob('*.mp3'):
        if f.name not in wanted:
            f.unlink()
            removed += 1

    total = sum(f.stat().st_size for f in OUT.glob('*.mp3'))
    print(f'{len(wanted)} lines ({made} new, {removed} removed), {total // 1024} KB in {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
