# Sound effect auditions, v1

Original procedural one-shots, created October 19, 2026. No external samples or melodies. Owner accepted these effects for now on October 19, 2026; integration is included in release build `20261019-210331`.

Open `audition.html` in a desktop browser, or play the individual WAVs. Local file links are not an iPad hosting route. The owner must have a reachable preview or separately authorized deployment to audition on iPad.

The reel plays merge-three, merge-five, discovery, completion, case-victory, then eight repeated ordinary merges and a five-piece merge. No autoplay. Effects have intentional relative levels; begin at a comfortable listening volume.

Timbres are synthetic: wooden/plucked tones, soft chimes, and a clarinet-like reed answer. The victory chord uses G/D-family notes compatible with the existing G- and D-major loops; actual mixing with music still needs listening.

Regenerate from the repository root: `python3 artwork/audio-effects/render.py`. Output: mono 24 kHz, 16-bit little-endian PCM WAV. The renderer prints measurements and SHA-256 hashes. Two consecutive renders produced identical files. Header/payload checks, finite samples, peak headroom, RMS, DC and endpoints were checked. See `measurements.jsonl`.

One-shot envelopes and causal reflections preserve decay tails without circular wrapping. All endpoints are zero. Numerical checks do not establish subjective sound quality, comfort, instrument realism or iPad playback. The owner accepted these effects for now; in-game mixing and physical-iPad playback remain unverified.

Included in release build `20261019-210331`: an independent Sound effects toggle defaults off on reload, confirmed by the owner. Use one cue per action, in priority order treasure victory > discovery > completion > merge; ordinary puzzle wins retain their merge cue. See `docs/release-notes.md` for the agreed design and completed automated/production Chromium verification. Owner in-game listening and physical-device checks remain pending deployment.
