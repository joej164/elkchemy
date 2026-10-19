"""Original Elkchemy audition effects. Python standard library; no external samples."""
import array
import hashlib
import json
import math
from pathlib import Path
import random
import struct
import wave

RATE = 24000
ROOT = Path(__file__).resolve().parent
TAU = 2 * math.pi


def note(buf, start, midi, duration, gain, voice='wood'):
    freq = 440 * 2 ** ((midi - 69) / 12)
    for i in range(round(duration * RATE)):
        t = i / RATE
        u = t / duration
        attack = 0.012 if voice != 'reed' else 0.055
        env = (1 - math.exp(-t / attack)) * (1 - u) ** 2
        phase = TAU * freq * t
        if voice == 'wood':
            env *= math.exp(-t / 0.14)
            tone = math.sin(phase) + 0.13 * math.exp(-t / 0.05) * math.sin(2.76 * phase)
        elif voice == 'pluck':
            env *= math.exp(-t / 0.34)
            tone = math.sin(phase) + 0.19 * math.exp(-t / 0.15) * math.sin(2 * phase) + 0.06 * math.sin(3 * phase)
        elif voice == 'reed':
            phase += 0.006 * math.sin(TAU * 4.5 * t)
            tone = (math.sin(phase) + 0.17 * math.sin(3 * phase) + 0.035 * math.sin(5 * phase)) / 1.205
        else:
            env *= math.exp(-t / 0.5)
            tone = math.sin(phase) + 0.10 * math.sin(2 * phase) + 0.035 * math.sin(4 * phase)
        idx = round(start * RATE) + i
        if idx < len(buf):
            buf[idx] += gain * env * tone


def render(name, seconds, events, click=False):
    buf = [0.0] * round(seconds * RATE)
    for args in events:
        note(buf, *args)
    if click:
        rng = random.Random(902)
        low = 0.0
        for i in range(round(0.065 * RATE)):
            t = i / RATE
            low += 0.24 * (rng.uniform(-1, 1) - low)
            buf[i] += 0.08 * low * math.sin(math.pi * t / 0.065) ** 2 * math.exp(-t / 0.018)
    # Gentle causal room reflections: leave room for their full tails, never wrap.
    dry = buf[:]
    for delay, gain in [(0.047, 0.10), (0.083, 0.06), (0.139, 0.035)]:
        offset = round(delay * RATE)
        for i in range(offset, len(buf)):
            buf[i] += gain * dry[i-offset]
    # Quiet, smooth endpoints, including any residual room tail.
    fade = round(0.025 * RATE)
    for i in range(fade):
        buf[-1-i] *= math.sin(math.pi * i / (2 * fade)) ** 2
    write(name, buf)
    return buf


def write(name, buf):
    assert all(math.isfinite(x) for x in buf)
    assert max(map(abs, buf)) < 0.9, 'Insufficient headroom'
    pcm = [round(x * 32767) for x in buf]
    payload = struct.pack('<' + 'h' * len(pcm), *pcm)
    path = ROOT / (name + '.wav')
    with wave.open(str(path), 'wb') as wav:
        wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        wav.writeframes(payload)
    with wave.open(str(path), 'rb') as wav:
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()) == (1, 2, RATE, len(buf))
        assert wav.readframes(len(buf)) == payload
    values = [x / 32768 for x in pcm]
    report = dict(file=path.name, seconds=len(buf)/RATE,
                  peak=round(max(map(abs, values)), 6),
                  rms=round(math.sqrt(sum(x*x for x in values)/len(values)), 6),
                  dc=round(sum(values)/len(values), 8),
                  endpoints=[pcm[0], pcm[-1]],
                  sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    print(json.dumps(report))


def main():
    effects = []
    effects.append(render('merge-three-v1', .36, [(0, 74, .20, .33, 'wood')]))
    effects.append(render('merge-five-v1', .66, [(0, 74, .25, .29, 'wood'), (.09, 81, .40, .24, 'pluck')]))
    effects.append(render('discovery-v1', 1.18, [(0, 67, .65, .15, 'chime'), (.13, 74, .65, .14, 'chime'), (.27, 79, .70, .12, 'chime'), (.39, 81, .60, .08, 'chime')]))
    effects.append(render('completion-v1', .96, [(0, 62, .70, .19, 'chime'), (.08, 69, .65, .14, 'chime'), (.16, 74, .62, .13, 'chime')]))
    effects.append(render('case-victory-v1', 2.85, [(.14, 55, .85, .10, 'pluck'), (.17, 62, .85, .13, 'pluck'), (.20, 67, .85, .12, 'pluck'), (.23, 74, .85, .11, 'pluck'), (.65, 74, .46, .15, 'reed'), (1.02, 76, .38, .14, 'reed'), (1.32, 79, .95, .15, 'reed'), (1.36, 55, 1.0, .08, 'pluck'), (1.40, 62, 1.0, .09, 'pluck')], click=True))
    silence = lambda seconds: [0.0] * round(RATE * seconds)
    reel = silence(.5)
    for effect in effects:
        reel += effect + silence(1.2)
    reel += silence(1.0)
    for _ in range(8):
        reel += effects[0] + silence(.24)
    reel += silence(.8) + effects[1] + silence(1.0)
    write('audition-reel-v1', reel)


if __name__ == '__main__':
    main()
