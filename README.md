# Chiller

A synchronized 1980s suspense anthology channel built on the shared Infinity TV pattern.

## Channel identity

Chiller is **not** a generic public-domain horror channel. Its normal schedule is centered on:

- **Alfred Hitchcock Presents (1985–1989)** — the color-era revival and updated suspense stories.
- **The Twilight Zone (1985–1989)** — the 1980s revival, emphasizing suspense, mystery, supernatural and psychological stories.
- Other suspense programming may be added only when it fits that same atmosphere and does not displace the two core series.
- Older black-and-white programming must be rare. The current rare feature block is Saturday at 10:00 PM viewer-local time and plays the complete Hitchcock feature continuously across the required half-hour station slots.

## Channel rules

- Viewer-local schedule changes at 12:00 AM and remains stable for that day.
- Normal half-hour slots alternate the two core 1980s families instead of grouping one show for hours at a time.
- Shorter anthology stories leave a brief Chiller station break rather than drifting into the next slot.
- Current playback joins at the elapsed station time so viewers opening the channel at the same local time see the same point in the scheduled program.
- The seven-day guide is generated in advance from the same deterministic daily schedule.
- The live pool is English-language and avoids R-rated programming.
- Do not substitute a pile of unrelated 1950s public-domain shows for the requested 1980s Hitchcock/Twilight Zone identity.
- Do not use partial movie clips as though they are full features.
- `CHILLER_FEATURES` holds rare feature-length candidates separately from the half-hour anthology pool; the scheduler converts a feature into contiguous source offsets so the movie does not restart every 30 minutes.
- Share credits contribute 1/10 StarCoin per confirmed Web Share completion and use the shared StarQuest wallet keys when available.

## Main files

- `index.html` — channel UI and social metadata
- `styles.css` — Chiller visual identity
- `data/catalog.js` — corrected 1980s core catalog plus rare feature candidates
- `app.js` — deterministic alternating schedule, continuous feature blocks, player synchronization and seven-day guide
- `.github/workflows/pages.yml` — GitHub Pages deployment
