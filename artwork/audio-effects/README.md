# Sound effect auditions, v1

Original procedural one-shots, created October 19, 2026. No external samples or melodies. Owner accepted these effects for now on October 19, 2026; not integrated or deployed.

Open `audition.html` in a desktop browser, or play the individual WAVs. Local file links are not an iPad hosting route. The owner must have a reachable preview or separately authorized deployment to audition on iPad.

The reel plays merge-three, merge-five, discovery, completion, case-victory, then eight repeated ordinary merges and a five-piece merge. No autoplay. Effects have intentional relative levels; begin at a comfortable listening volume.

Timbres are synthetic: wooden/plucked tones, soft chimes, and a clarinet-like reed answer. The victory chord uses G/D-family notes compatible with the existing G- and D-major loops; actual mixing with music still needs listening.

Regenerate from the repository root: `python3 artwork/audio-effects/render.py`. Output: mono 24 kHz, 16-bit little-endian PCM WAV. The renderer prints measurements and SHA-256 hashes. Two consecutive renders produced identical files. Header/payload checks, finite samples, peak headroom, RMS, DC and endpoints were checked. See `measurements.jsonl`.

One-shot envelopes and causal reflections preserve decay tails without circular wrapping. All endpoints are zero. Numerical checks do not establish subjective sound quality, comfort, instrument realism or iPad playback. No listening approval is claimed.

Future integration: separate sound-effects toggle from music; avoid stacking completion and discovery/victory cues for the same event. Integration and more music remain separate work.
