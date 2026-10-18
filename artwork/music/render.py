"""Reproduce original Elkchemy loops using Python's standard library only."""
import array
import json
import math
from pathlib import Path
import sys
import wave

RATE = 24000
HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'public' / 'audio'
TAU = 2 * math.pi


def add_note(buf, beat, duration, midi, velocity, voice, seconds_per_beat):
    start = round(beat * seconds_per_beat * RATE)
    sustain = duration * seconds_per_beat
    release = {'lead': 0.20, 'pluck': 0.8, 'bass': 0.45}[voice]
    length = round((sustain + release) * RATE)
    frequency = 440 * 2 ** ((midi - 69) / 12)
    gain = velocity / 64 * {'lead': 0.16, 'pluck': 0.075, 'bass': 0.085}[voice]
    for i in range(length):
        t = i / RATE
        if voice == 'lead':
            attack = min(1, t / 0.065)
            tail = max(0, 1 - max(0, t - sustain) / release)
            envelope = math.sin(attack * math.pi / 2) ** 2 * tail ** 2
            # 2-cent vibrato comes in gently after the attack, integrated as phase.
            phase = TAU * frequency * t + frequency * 0.00023 * (1 - math.cos(TAU * 4.4 * t)) * min(1, t / 0.2)
            tone = (math.sin(phase) + 0.20 * math.sin(3 * phase)
                    + 0.055 * math.sin(5 * phase) + 0.012 * math.sin(7 * phase)) / 1.265
            envelope *= 0.97 + 0.03 * math.sin(TAU * 0.8 * t)
        elif voice == 'pluck':
            envelope = (1 - math.exp(-t / 0.008)) * math.exp(-t / 0.40)
            envelope *= max(0, 1 - max(0, t - sustain) / release) ** 2
            phase = TAU * frequency * t
            tone = math.sin(phase) + 0.16 * math.exp(-t / 0.14) * math.sin(2 * phase)
            tone += 0.035 * math.exp(-t / 0.08) * math.sin(3 * phase)
        else:
            envelope = min(1, t / 0.11) ** 2
            envelope *= max(0, 1 - max(0, t - sustain) / release) ** 2
            envelope *= 0.9 + 0.1 * math.exp(-t / 0.5)
            phase = TAU * frequency * t
            tone = math.sin(phase) + 0.12 * math.sin(2 * phase)
        buf[(start + i) % len(buf)] += gain * envelope * tone


def render(score):
    spb = 60 / score['bpm']
    n = round(score['beats'] * spb * RATE)
    dry = array.array('d', [0]) * n
    for event in score['lead']:
        add_note(dry, *event, 'lead', spb)
    for bar, bass, pitches in score['harmony']:
        add_note(dry, bar * 4, score['bassDuration'], bass, score['bassVelocity'], 'bass', spb)
        for beat, duration, index, velocity in score['arpPattern']:
            add_note(dry, bar * 4 + beat, duration, pitches[index], velocity, 'pluck', spb)
    # Circular one-pole lowpass: initialize by running the full periodic signal once.
    dark = array.array('d', [0]) * n
    alpha = 1 - math.exp(-TAU * 1500 / RATE)
    value = 0.0
    for sample in dry:
        value += alpha * (sample - value)
    for i, sample in enumerate(dry):
        value += alpha * (sample - value)
        dark[i] = value
    mix = array.array('d', dry)
    for seconds, gain in [(0.113, 0.10), (0.197, 0.075), (0.311, 0.06), (0.467, 0.04), (0.733, 0.025)]:
        delay = round(seconds * RATE)
        for i in range(n):
            mix[i] += gain * dark[(i - delay) % n]
    mean = sum(mix) / n
    peak = max(abs(x - mean) for x in mix)
    scale = min(1.8, 0.60 / peak)
    pcm = array.array('h', (round((x - mean) * scale * 32767) for x in mix))
    path = OUT / (score['name'] + '.wav')
    OUT.mkdir(parents=True, exist_ok=True)
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    if sys.byteorder != 'little':
        pcm.byteswap()
    normalized = [x / 32768 for x in pcm]
    edge = normalized[-240:] + normalized[:240]
    print(json.dumps({
        'file': str(path.relative_to(HERE.parents[1])), 'bytes': path.stat().st_size,
        'frames': n, 'seconds': n / RATE,
        'peak': max(abs(x) for x in normalized),
        'rms': math.sqrt(sum(x*x for x in normalized) / n),
        'dc': sum(normalized) / n,
        'seamDelta': abs(normalized[0] - normalized[-1]),
        'maxDerivativeWithin10msOfSeam': max(abs(b-a) for a,b in zip(edge, edge[1:])),
        'maxDerivative': max(abs(normalized[(i+1) % n] - normalized[i]) for i in range(n))
    }, sort_keys=True))
    with wave.open(str(path), 'rb') as wav:
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()) == (1, 2, RATE, n)
        assert len(wav.readframes(n)) == n * 2


if __name__ == '__main__':
    for score in json.loads((HERE / 'score.json').read_text())['loops']:
        render(score)
