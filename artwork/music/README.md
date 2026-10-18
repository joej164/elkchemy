# Elkchemy original music assets

Two original eight-bar background loops, composed specifically for Elkchemy:

The owner listened to both loops and approved them for prototype integration on October 18, 2026. App playback is not yet implemented; physical iPad looping and volume still require testing. Later improvements may include more natural clarinet/ukulele instruments, longer arrangements, and world-specific themes.

- `public/audio/woodland-stroll.wav`: D major, 76 BPM; warm, spacious woodland mood.
- `public/audio/curious-clearing.wav`: G major, 92 BPM; light, curious puzzle mood.

These are procedural synthetic instruments, not recordings: a softened odd-harmonic clarinet-like lead, quiet plucked harp/music-box accompaniment, and rounded bass. No external samples, services, libraries, or existing melodies were used. A real clarinet performance would have more expressive timbre.

Regenerate from the repository root with `python3 artwork/music/render.py`. The exact original score is in `score.json`; event positions and durations are beats from the start of the loop. Harmony entries contain zero-based bar, bass MIDI note, and arpeggio MIDI pitches. Output is 24 kHz mono 16-bit PCM WAV. The renderer prints duration, size, peak, RMS, DC, and boundary derivative measurements and checks the WAV headers and payloads.

Note releases and a quiet dark echo wrap around the precise loop length. There is no whole-track fade or forced silence at the boundary. Files are intended for sample-contiguous looping; arbitrary media players may insert their own playback gaps.

These are standalone assets only. No playback or app integration is included. Numerical validation cannot establish subjective quality; owner listening approval is recorded above, while in-game iPad playback and mixing remain unverified.
