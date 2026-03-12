# Neolution Steam Ready Plan

## Current package update

This package now includes a **release shell vertical slice**:

- `release/Neolution_SteamVerticalSlice.html`
- persistent local profile save
- song select surface with official-track metadata
- settings surface
- achievements surface
- results surface
- desktop wrapper pointing to the release shell

## What this solves now

- converts the prototype into a menu-driven product surface
- creates a real front-end flow for demoing and packaging
- gives the project a save/progression/results layer without rewriting the original game first
- provides a better handoff surface for the next integration pass

## Remaining work after this package

1. move core gameplay out of the monolithic `index.html` into modular runtime files
2. replace shell-estimated results with direct judgement event reporting from the game
3. add official track pack assets and handcrafted charts
4. add calibration mini-flow and persistent remapping
5. wire Steam achievements / cloud saves / leaderboards
6. package a final desktop build with icons, installers, and launch assets
