# Neo-VECTR ∞ Neolution

**Neon Rhythm on a TRON grid — a free, CPU-light Canvas2D rhythm game. Play the built-in track or drop in your own songs.**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Canvas2D](https://img.shields.io/badge/Rendering-Canvas2D-blue)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Live Game](https://img.shields.io/badge/Play%20Now-Live-brightgreen)](https://garebear99.github.io/Neolution/)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/garebear99)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=flat&logo=ko-fi)](https://ko-fi.com/luciferai)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤️-red?style=flat&logo=github-sponsors)](https://github.com/sponsors/GareBear99)

🎮 **Live build:** [garebear99.github.io/Neolution](https://garebear99.github.io/Neolution/) — free to play.

---

## What Neolution is

Neolution is an 8-lane neon rhythm game set on a TRON-style perspective grid. Hit the notes as they cross the red line — arrows with your arrow keys, symbols with WASD, taps on touch screens, or a gamepad. Every song gets a deterministic chart built from its own audio, and every chart has a **seed code** you can share: same code + same song + same difficulty = the exact same chart.

- **Free to play.** No purchase, no account. Ads appear only between songs (after every 3rd run) and never interrupt play.
- **Your own songs.** Drop any MP3 / WAV / OGG / M4A / FLAC onto the game — it plays instantly and gets its own chart.
- **Seed catalog.** A library of curated chart seeds (shareable codes) plus a seed input for your own codes — endless charts on any song.
- **Judgement tiers.** Perfect / Great / Good / Miss, live accuracy, ranks (S/A/B/C/D), results screen, best scores saved on your device.
- **Lightweight.** Pure HTML5 + Canvas2D, zero dependencies, ~3 MB total. Runs anywhere a browser runs.

---

## Controls

| Action | Input |
|--------|-------|
| Left Arrow | ← / D-Pad Left |
| Down Arrow | ↓ / D-Pad Down |
| Up Arrow | ↑ / D-Pad Up |
| Right Arrow | → / D-Pad Right |
| Square (□) | A / PS Square |
| Cross (×) | S / PS Cross |
| Circle (○) | D / PS Circle |
| Triangle (△) | W / PS Triangle |
| Tap a lane | Touch / mouse |
| Start / Stop | Space |
| Pause | Esc |
| Toggle HUD | H |

---

## The built-in track

**Neolution Theme** — 2:00, 128 BPM, an original high-energy synthwave track synthesized entirely from code (`tools/generate-theme-track.js`). No samples, no third-party audio, nothing of unknown provenance. Re-run the generator any time to reproduce it, then transcode with ffmpeg:

```bash
node tools/generate-theme-track.js /tmp/Neolution-Theme.wav
ffmpeg -i /tmp/Neolution-Theme.wav -codec:a libmp3lame -b:a 192k Neolution-Theme.mp3
```

---

## Seed catalog

Charts are deterministic: a seed code fully determines the chart for a given song + difficulty. The curated catalog lives in `assets/data/seed_catalog.json` (the game also embeds a fallback copy, so it works over `file://` too). Type any code in the seed box to play that chart; hit **Copy seed** to share the chart you just played.

---

## Ads (AdSense)

After every 3rd completed run, a break shows between songs — never mid-song. To enable real ads, paste your publisher ID and ad slot into the clearly-marked `CONFIG` block at the top of `index.html` (and the matching constants in `src/ui/release_shell.js`):

```js
ADSENSE_PUBLISHER_ID: 'ca-pub-XXXXXXXXXXXXXXXX',
ADSENSE_AD_SLOT: '1234567890',
```

With both left blank (the default while AdSense is in admission), no ad script is loaded at all and the break shows a small support panel instead. The game works identically with ads blocked or failing to load — the break always has a working Continue button.

---

## In-app purchases (IAP-ready)

Neolution is **free** — the whole game is playable with nothing purchased. The store is ready for the day Gary decides what is sold: the catalog lives in `assets/data/iap_catalog.json` (currently empty — no items, no provider wired), the game exposes it through the `IAP` module in `index.html` (`IAP.items()`, `IAP.owns(id)`, `IAP.purchase(id)`), and both the title screen and the release shell render a Store from that same catalog. With no provider configured, a purchase attempt is refused and grants nothing — the seam is inert by design, and nothing in the game is gated behind a purchase.

Items are `{ id, name, description, priceUsd, kind }` — `kind` is free-form (song, theme, pack, …) until Gary picks the items. Owned purchases persist in localStorage under `purchases.v1`.

**SpeedDemon is the test song only.** `SpeedDemon.wav` (the original default track) is used for development and testing — it lives in `test-assets/` (git-ignored, never committed) and is **never bundled in a release build**: `tools/build-itch.sh` fails the build if it appears in `dist/`. The release defaults to user-uploaded songs plus the synthesized Neolution Theme above.

---

## Project structure

```text
Neolution/
├── index.html                    # The game (itch entry point)
├── Neolution-Theme.mp3           # Built-in original track (2.9 MB)
├── assets/data/
│   ├── official_songs.json       # Song registry (built-in track)
│   ├── seed_catalog.json         # Curated chart seed catalog
│   └── iap_catalog.json          # In-app purchase catalog (empty until Gary decides the items)
├── release/
│   └── Neolution_SteamVerticalSlice.html   # Menu shell (desktop/Steam path)
├── src/ui/
│   └── release_shell.js          # The shell's JS (menu, songs, settings, achievements, results, ads)
├── tools/
│   ├── generate-theme-track.js   # Synthesizes the built-in track from code
│   ├── build-itch.sh             # Assembles the itch-ready build in dist/itch/
│   └── verify-build.py           # Headless Playwright verification of the build
├── test-assets/                  # Test-only assets (SpeedDemon.wav, the test song — never shipped)
├── desktop/                      # Electron wrapper scaffold (loads the release shell)
└── docs/                         # Steam-readiness planning docs
```

---

## Release shell

The **Steam vertical slice shell** at `release/Neolution_SteamVerticalSlice.html` is the menu-driven front end: main menu, song select, settings, achievements, results, and the ad break. It loads the game in an iframe (`index.html?shell=1`) and talks to it via `postMessage` — the shell never touches the game's DOM. The desktop Electron wrapper loads the shell.

---

## Quick start

### Browser build

Open `index.html` in a browser or host the folder on GitHub Pages. For true soundwave charting (instead of the deterministic fallback), serve it over HTTP rather than `file://`:

```bash
python3 -m http.server 8000
```

### Itch build

```bash
./tools/build-itch.sh   # verifies + assembles dist/itch/ (~3 MB)
```

Zip `dist/itch/` and upload it as an HTML5 project (`index.html` is the entry point; recommended embed 960×540). Free to play.

### Desktop scaffold

The desktop folder contains a starter Electron wrapper for turning the current build into a desktop app shell. Packaging (installer, Steamworks) is a later track.

---

## Performance notes

- Canvas2D only, no external runtime dependencies for the web build
- ~3 MB total download (was 70 MB+ with the old uncompressed WAV)
- suitable as a lightweight rhythm game, not just a prototype base

---

## Roadmap snapshot

### Done
- Playable rhythm loop with judgement tiers, accuracy, ranks, results
- Title screen, pause menu, song select
- Custom song upload (file picker + drag & drop) + touch input
- Seed catalog (shareable chart codes)
- Best scores, settings, achievements, profile — all saved locally
- Release shell restored (menu, songs, settings, achievements, results, ads)
- Original built-in track (synthesized, clean provenance)
- AdSense break after every 3rd run (configurable, graceful when unconfigured)
- In-app purchases: IAP-ready seam (empty catalog, inert until configured)
- Itch-ready build (~3 MB)

### Next
- In-app purchase items (Gary's decision: what is sold)
- Official song pack structure (more built-in tracks)
- Handcrafted charts (in addition to generated ones)
- Calibration mini-flow
- Electron packaging + Steam prep

---

## Credits

Created by [GareBear99](https://github.com/GareBear99).

Part of the Neo-VECTR / Neolution ecosystem.
