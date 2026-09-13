# Chiller

A synchronized classic suspense channel built on the shared Infinity TV pattern.

## Channel rules

- Viewer-local schedule changes at 12:00 AM and remains stable for that day.
- 30-minute station slots create a conventional television rhythm; shorter anthology episodes leave a brief Chiller station break rather than drifting into the next slot.
- Current playback joins at the elapsed station time so viewers opening the channel at the same local time see the same point in the scheduled program.
- The seven-day guide is generated in advance from the same deterministic daily schedule.
- The scheduled catalog is limited to classic non-R suspense, mystery and supernatural programming with embeddable/public-domain or authorized YouTube sources.
- Full Alfred Hitchcock Presents and Twilight Zone access is linked to their official services rather than replacing them with partial or unauthorized clips.
- Share credits contribute 1/10 StarCoin per confirmed Web Share completion and use the shared StarQuest local wallet keys when available.

## Main files

- `index.html` — channel UI and social metadata
- `styles.css` — Chiller visual identity
- `data/catalog.js` — playable catalog and rating policy
- `app.js` — live schedule, player synchronization, guide, remote, sharing and wallet display
- `.github/workflows/pages.yml` — GitHub Pages deployment
