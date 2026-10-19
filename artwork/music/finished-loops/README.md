# Full procedural loops, v2

Created October 19, 2026 following owner feedback: woodland clarinet primary, ukulele supportive; palace harp/glass preview liked. Owner approved both full-length music loops on October 19, 2026. Integration is implemented and UNRELEASED; no commit or deployment. Existing published tracks and concurrent level work are preserved. Superseded audition folders and the sampled-library comparison were removed after approval.

- Woodland Journey: 24 bars, 82 BPM, G major, about 70 seconds. Three melodic phrases, clarinet-like lead, quiet ukulele-like four-string strums and occasional picked replies. Accompaniment is reduced relative to the preview; reed gain increased. Stem RMS measurements document the balance, but do not establish subjective prominence.
- Crystal Palace: 16 bars, 68 BPM, D major, about 56 seconds. Retains the accepted eight-bar opening, with a higher answering phrase and a return into the opening. Harp-like arpeggios, glass-like bell lead and spacious echoes. No clarinet.

All timbres are procedural approximations: filtered-noise delay strings, odd-harmonic reed, inharmonic bell partials, sine bass. No external samples or dependencies. Render.py is self-contained and retains the preview's voice construction while wrapping full note tails and echoes around the exact musical period. There is no whole-track fade or forced silence at the boundary.

Open audition.html locally. The eight-second boundary files concatenate the final four seconds directly with the opening four seconds, to audition the real sample join without relying on browser loop scheduling. Their outer edges are excerpts; judge the join at four seconds.

Regenerate: `python3 artwork/music/finished-loops/render.py`. Mono 24 kHz, 16-bit PCM. Per-track scores include exact note events and echoes. Measurements.json records headers/payload verification results through successful rendering, peak, RMS, DC, seam derivative, stem balance and output hashes. Peak/DC/seam assertions run during rendering. Technical checks cannot establish pleasantness or perceived seamlessness. Physical iPad/Safari and in-game mixing remain unverified.

These are approved source assets. Included in release build `20261019-210331`: level 9 begins with Woodland Journey; tapping a fixed item, selecting an item or successfully acting on an item in the playable palace selects Crystal Palace, and doing so in a woodland room returns to Woodland Journey. Opening the palace and panning do not select tracks. Existing levels retain their assignments. Integrated automated and production Chromium checks pass; deployment and owner in-game listening remain pending; see `docs/release-notes.md`.
