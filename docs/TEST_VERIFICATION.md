# Neolution — Test Verification

How the game was verified, what passed, and what is still only
logic-verified (not end-to-end) because of headless-environment limits.

## Harness

`tools/verify-build.py` — serves `dist/itch/` on localhost and drives it in
headless Chromium (Playwright, `~/.venvs/neolution-test`). 26 checks:

1. Page loads, debug hook present, chart builds (>50 notes), title screen
   visible, Play enabled.
2. Seed determinism: same code twice → identical chart (note count + first
   20 notes); different code → different chart; seed label shows the code.
3. Gameplay: Play, hit notes on time via keyboard, score/combo/accuracy
   move, judgement tiers register.
4. Custom song upload: a real 10 s MP3 uploads, chart rebuilds (16 notes),
   plays.
5. Results: seek near the end → results screen with rank/accuracy/counts.
6. Ad break: with the run counter preset to 2, the run's end shows the ad
   modal (support fallback — no publisher ID configured); Continue closes it.
7. Release shell: menu visible, song grid renders (2 cards), Play launches
   the game in the iframe, HUD buttons appear, Menu returns to the menu.
8. Hygiene: no console errors, no failed requests (ignoring the benign
   `<audio>` stream abort on song switch — see below), no HTTP error
   responses.
9. Badges: FULL COMBO hidden on a missed run; NEW BEST shown on a first run.

**Latest full run: 26/26 checks passed** (2026-11-06, port 8947).
Run it again with: `python3 tools/verify-build.py [--port 8931]`

## What the runs actually measured

- Theme chart: 93 notes (default seed, Easy); NEON-RUSH: 90 notes.
- Gameplay hits register with real tiers (e.g. 3 perfect / 2 great / 1 good /
  3 miss in one run; 12 perfect in an auto-played run).
- Seed determinism is exact (same code + same song + same difficulty =
  identical chart, verified by note times + lanes).
- Custom song: the 10 s test tone charts to 16 notes and plays to a results
  screen; the 5 s tone charts to 6 notes.
- Ad modal appears after the 3rd completed run, between runs only, and the
  game works identically with no publisher ID configured.
- Screenshots at each stage in `/tmp/neo-verify/` (01-title … 07-shell-playing)
  — title, playing, results, ad modal, shell menu and shell playing all
  visually checked and polished.

## AdSense with a publisher ID (separate test, /tmp/neo-ads-test)

A copy of `dist/itch/` with a dummy publisher ID
(`ca-pub-0000000000000000`, slot `0000000000`) was served and played:

- The ad modal appears after the 3rd run with the ID configured.
- The AdSense script IS requested
  (`pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=…`).
- The support fallback shows (the dummy ID cannot fill an ad — expected:
  "Ads will appear here once AdSense is connected.").
- Continue closes the modal; the game stays fully functional.
- One console error in the sandbox only:
  `net::ERR_TUNNEL_CONNECTION_FAILED` for the AdSense script — the VM has
  no route to googlesyndication.com. The game's fallback handles a failed
  ad load gracefully, which is exactly the ads-blocked/unavailable path.

To go live, Gary pastes his real publisher ID + slot ID into the `CONFIG`
block at the top of `index.html` (and the matching constants in
`src/ui/release_shell.js`). No other change is needed.

## Bugs found by verification (all fixed)

1. **FULL COMBO / NEW BEST badges always visible.** The stylesheet only
   defined `.overlay.hidden { display: none }` — there was no global
   `.hidden` rule, so `classList.toggle('hidden')` on the badge spans did
   nothing. A 16-miss, 0.0 % run showed "★ FULL COMBO ★". Fixed with a
   global `.hidden { display: none !important }` rule in `index.html`.
   Verified: badge hidden on a missed run, NEW BEST shown on a first run.
2. **Song switch aborted the previous media stream.** Every seed/difficulty
   change re-set the audio element's `src`, aborting the in-flight media
   request (`net::ERR_ABORTED`). Fixed: the media element is only reloaded
   when the song actually changes; seed/difficulty changes rebuild the
   chart only. The verify script now also ignores benign audio-stream
   aborts on song switch, and separately fails on any HTTP 4xx response
   (a genuinely missing file would be a 404, not an abort).
3. **Theme seek didn't work on the test server.** Python's `http.server`
   returns 200 + the whole file for Range requests, so Chromium restarted
   playback from 0 on a seek. Not a game bug — real hosts (GitHub Pages,
   itch) answer 206. The verify server now has a Range-aware handler
   (`RangeHandler` in `tools/verify-build.py`), and theme seeks work.
4. **Fixed test sleeps were too tight under load.** The 2.5 s / 1.5 s waits
   for chart builds (120 s MP3 decode is CPU-heavy) failed when the VM was
   busy. The harness now polls for `chartReady` + signature change with
   generous timeouts, and the custom-song check waits for the chart to
   actually rebuild (the song name flips before the rebuild starts, so a
   naive check read the stale theme chart).

## Headless-environment limits (not game bugs)

- **rAF runs at ~10–11 fps in this headless VM** (measured; the
  `--disable-frame-rate-limit` flag does not raise it). A note's hit window
  is 240 ms wide, so at 11 fps it spans ~2 frames and key-press edges get
  lost. An in-page auto-player hit 13/15 notes in its best run
  (12 perfect) but could not reliably hit 100 %.
- **Positive FULL COMBO end-to-end proof is therefore still open.**
  The logic is verified by reading (`counts.miss === 0 && notes.length > 0`
  in `finishRun`) and the CSS/toggle mechanism is verified by the negative
  test (badge hides when it should). A human playtest on a real 60 fps
  machine will confirm the badge appears on a true full combo instantly.
- **Headless audio clock runs at ~0.6× real time** (no audio device), so
  wall-clock waits in tests must be generous; the game itself uses the
  audio element's own clock, so real play is unaffected.

## Not verified here (needs a real machine / Gary)

- Gamepad input (no gamepad in the VM; keyboard + touch paths verified by
  code + the keyboard path live).
- Touch input (no touchscreen in the VM).
- A real AdSense ad filling (needs Gary's live publisher ID + site approval).
- The game on GitHub Pages / itch (served locally only; the itch build in
  `dist/itch/` is the upload-ready folder).
- Mac / Ableton-side anything (out of scope for this repo).
