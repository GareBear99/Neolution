# Neo-VECTR ∞ Neolution

**Neon Rhythm on a TRON grid — a CPU-light Canvas2D rhythm game moving toward a full desktop Steam release.**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Canvas2D](https://img.shields.io/badge/Rendering-Canvas2D-blue)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Live Game](https://img.shields.io/badge/Play%20Now-Live-brightgreen)](https://garebear99.github.io/Neolution/)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/garebear99)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=flat&logo=ko-fi)](https://ko-fi.com/luciferai)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤️-red?style=flat&logo=github-sponsors)](https://github.com/sponsors/GareBear99)

🎮 **Live build:** [garebear99.github.io/Neolution](https://garebear99.github.io/Neolution/)

---

## What Neolution is

Neolution is an 8-lane neon rhythm game set on a TRON-style perspective grid. It focuses on:

- deterministic chart generation from audio
- keyboard + controller support
- lightweight Canvas2D rendering
- sharp synthwave / arcade presentation
- a future path toward a full desktop release with progression, persistence, achievements, and Steam packaging

---

## Current feature set

### Rhythm gameplay
- **8-lane input matrix** using arrows + WASD
- **Difficulty range 0–4**
- **Deterministic chart generation** from audio analysis
- **Gamepad support** with PlayStation-style lane mapping
- **Looping and seed regeneration** for repeated runs

### Visual systems
- **TRON-style perspective grid**
- **CPU-light Canvas2D renderer**
- **Real-time spectrum analyzer**
- **Waveform display**
- **Layered neon glow compositing**

### Audio systems
- **Web Audio API analysis**
- **Custom song upload**
- **Playback timing offset slider**
- **Realtime energy-based onset extraction**

### Development surfaces
- **Debug side panel**
- **Immediate playable browser build**
- **No dependency runtime**

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
| Start / Stop | Space |
| Restart | Esc |
| Toggle HUD | H |

---

## Project structure

```text
Neolution/
├── index.html                    # Current main live build
├── Neolution.html                # Alternate main game entry
├── NeolutionGrid.html            # Grid explorer prototype
├── NeolutionLayout.html          # Layout prototype
├── SpeedDemon.wav                # Included local audio asset
├── desktop/                      # Desktop wrapper scaffold
│   ├── package.json
│   ├── main.js
│   ├── preload.js
│   └── README.md
├── docs/                         # Steam-readiness planning docs
│   ├── STEAM_READY_PLAN.md
│   └── RELEASE_CHECKLIST.md
└── src/
    ├── audio/
    │   └── latency_calibrator.js
    ├── engine/
    │   └── score_engine.js
    ├── leaderboards/
    │   └── local_leaderboard.js
    ├── progress/
    │   └── unlock_manager.js
    ├── save/
    │   └── save_manager.js
    └── ui/
        └── results_screen_schema.js
```

---

## Steam-readiness direction

This package now includes a **production roadmap scaffold** for converting the current prototype into a full desktop game.

Major required release pillars:

1. **Structured front-end flow**
   - title screen
   - song select
   - results screen
   - settings menu

2. **Rhythm judgement depth**
   - perfect / great / good / miss windows
   - clearer accuracy reporting
   - rank outputs

3. **Persistence**
   - settings save
   - offset save
   - highscores
   - progression unlocks

4. **Desktop packaging**
   - Electron wrapper
   - local save path
   - fullscreen support
   - launchable Steam build base

5. **Commercial content layer**
   - official songs
   - curated charts
   - launch progression
   - achievements

See `docs/STEAM_READY_PLAN.md` and `docs/RELEASE_CHECKLIST.md`.

---


## New release shell

This package now ships with a **Steam vertical slice shell** at:

```text
release/Neolution_SteamVerticalSlice.html
```

It adds:
- main menu
- song select
- persistent profile save
- settings surface
- achievements surface
- results screen
- desktop wrapper entry point

Use this as the current presentation layer for demos, repo screenshots, and desktop packaging.

## Quick start

### Browser build

Open `index.html` in a browser or host the folder on GitHub Pages.

### Desktop scaffold

The desktop folder contains a starter Electron wrapper for turning the current build into a desktop app shell.

---

## Performance notes

- Canvas2D only
- no external runtime dependencies for the web build
- suitable as a lightweight rhythm prototype base
- desktop wrapper is scaffolded separately so the browser version remains simple

---

## Roadmap snapshot

### Current
- Playable rhythm loop
- Neon presentation
- Audio-driven note generation
- Keyboard + controller input

### Next production milestones
- real save system integration
- rank / judgement pass
- results screen flow
- official song pack structure
- release UI pass
- Electron packaging + Steam prep

---

## Credits

Created by [GareBear99](https://github.com/GareBear99).

Part of the Neo-VECTR / Neolution ecosystem.
