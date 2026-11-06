# Neolution Release Checklist

## Now included

- [x] release shell — RESTORED (src/ui/release_shell.js written; menu, song select, settings, achievements, results all work; game↔shell postMessage bridge live)
- [x] persistent local profile save
- [x] song select surface
- [x] settings surface
- [x] achievements surface (8 local achievements)
- [x] results surface (rank, accuracy, tier counts, seed code, NEW BEST)
- [x] desktop wrapper pointed at release shell
- [x] official song metadata registry (Neolution Theme only — dead entries removed)
- [x] direct gameplay-to-shell event bridge (postMessage: results, achievements, launch, custom song, commands)
- [x] final judgement system in core runtime (Perfect/Great/Good/Miss + accuracy + ranks)
- [x] curated launch soundtrack (Neolution Theme — original, synthesized from code; SpeedDemon.wav removed)
- [x] seed catalog (shareable chart seed codes, curated list + input)
- [x] custom song upload (file picker + drag & drop + shell upload)
- [x] touch input (tap lanes)
- [x] AdSense break after every 3rd run (configurable publisher ID; graceful when unconfigured/blocked)
- [x] itch-ready build (tools/build-itch.sh → dist/itch/, ~3 MB, verified)

## Still required before Steam launch

- [ ] custom icon / capsule art / trailer
- [ ] installer + Steamworks build
- [ ] QA pass across Windows controllers and fullscreen states
- [ ] AdSense live publisher ID + site approval (Gary's action — AdSense still in admission)
- [ ] itch listing price change to FREE + new build upload (browser task, after Gary reviews the build)

## Still open (Gary's call)

- [ ] cover art direction (no art assets exist yet)
- [ ] more built-in tracks for the official song pack
- [ ] handcrafted charts vs generated-only
- [ ] Itch AI-disclosure wording (TheRustySpoon is Gary's laptop identity — the original commits are his own; the remaining question is only how the listing describes the audio/artwork provenance)
