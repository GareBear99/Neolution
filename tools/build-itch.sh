#!/bin/bash
# Build the itch-ready Neolution package.
# Assembles dist/itch/ with exactly what the game needs to run standalone:
#   index.html, Neolution-Theme.mp3, assets/data/*.json, release shell + src/
# (the shell is the menu layer for the desktop/Steam path; index.html is the
# itch entry point — itch loads index.html by default.)
# Usage: ./tools/build-itch.sh  (run from the repo root)
set -euo pipefail
cd "$(dirname "$0")/.."

DIST="dist/itch"
rm -rf "$DIST"
mkdir -p "$DIST/assets/data" "$DIST/release" "$DIST/src/ui"

cp index.html "$DIST/"
cp Neolution-Theme.mp3 "$DIST/"
cp assets/data/official_songs.json assets/data/seed_catalog.json assets/data/iap_catalog.json "$DIST/assets/data/"
cp release/Neolution_SteamVerticalSlice.html "$DIST/release/"
cp src/ui/release_shell.js "$DIST/src/ui/"
cp README.md "$DIST/README-Neolution.md" 2>/dev/null || true

echo "--- verifying build ---"
# 1. every file the game references must exist in the build
python3 - "$DIST" <<'EOF'
import json, os, re, sys
d = sys.argv[1]
html = open(os.path.join(d, 'index.html')).read()
fail = []
# built-in song referenced by the dropdown
if 'Neolution-Theme.mp3' not in html:
    fail.append('index.html does not reference Neolution-Theme.mp3')
for f in ['Neolution-Theme.mp3', 'assets/data/official_songs.json', 'assets/data/seed_catalog.json', 'assets/data/iap_catalog.json',
          'release/Neolution_SteamVerticalSlice.html', 'src/ui/release_shell.js']:
    if not os.path.exists(os.path.join(d, f)):
        fail.append('missing in build: ' + f)
# no references to removed files
for dead in ['SpeedDemon.wav', 'LostSauce.mp3', 'Rize.mp3', 'NeolutionLayout.html', 'NeolutionGrid.html']:
    if dead in html:
        fail.append('index.html still references removed file: ' + dead)
# song registry must only list files present in the build
songs = json.load(open(os.path.join(d, 'assets/data/official_songs.json')))
for s in songs:
    if s.get('status') == 'playable' and not os.path.exists(os.path.join(d, s['file'])):
        fail.append('song registry lists missing file: ' + s['file'])
seeds = json.load(open(os.path.join(d, 'assets/data/seed_catalog.json')))
codes = [s['code'] for s in seeds]
if len(codes) != len(set(codes)):
    fail.append('duplicate seed codes in seed_catalog.json')
iap = json.load(open(os.path.join(d, 'assets/data/iap_catalog.json')))
if not isinstance(iap.get('items'), list):
    fail.append('iap_catalog.json: items must be an array')
# SpeedDemon is the TEST SONG only — it must never ship in a release build
for root, _, files in os.walk(d):
    if 'SpeedDemon.wav' in files:
        fail.append('SpeedDemon.wav must not ship in a release build: ' + os.path.join(root, 'SpeedDemon.wav'))
if fail:
    print('BUILD CHECK FAILED:')
    for f in fail: print('  -', f)
    sys.exit(1)
print(f'OK: {len(songs)} song(s), {len(seeds)} seed(s), {len(iap["items"])} IAP item(s), all referenced files present')
EOF

echo "--- sizes ---"
du -sh "$DIST"
find "$DIST" -type f | sort
echo
echo "Itch-ready build in $DIST/ — zip it and upload as an HTML5 project (index.html is the entry point; recommended embed 960x540)."
