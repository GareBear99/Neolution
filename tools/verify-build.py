#!/usr/bin/env python3
"""Headless verification for the Neolution itch build (dist/itch/).

Serves dist/itch/ on localhost, drives it in headless Chromium, and checks:
  1. Page loads with no console errors / page errors / failed requests.
  2. Title screen visible; chart builds; Play enables.
  3. Gameplay: Play, hit notes on time (via the __neolution debug hook),
     score/combo/accuracy move; judgement tiers register.
  4. Seed determinism: same code twice -> identical chart (note count + first 20 notes).
  5. Custom song upload: upload a real audio file, chart rebuilds, plays.
  5b. Test song: upload test-assets/SpeedDemon.wav (test-only, never
     bundled) — chart rebuilds and plays.
  6. Results: seek near the end -> results screen with rank/accuracy/counts.
  7. Ad break: with adRuns preset to 2, the run's end shows the ad modal
     (support fallback, since no publisher ID is configured); Continue closes it.
  7b. Store (IAP seam): panel renders coming-soon on an empty catalog;
     purchase attempts are refused and grant nothing.
  8. Release shell: Play launches the game in the iframe; Menu returns;
     song select renders; results flow through postMessage.
  9. Screenshots at each stage for a visual check.

Usage: python3 tools/verify-build.py [--port 8931] [--out /tmp/neo-verify]
Exit code 0 = all checks passed.
"""
import argparse, functools, http.server, json, os, re, socketserver, subprocess, sys, threading, time

PLAYWRIGHT_PYTHON = os.path.expanduser("~/.venvs/neolution-test/bin/python")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(REPO, "dist", "itch")


class _RangeFileWrapper:
    """File-like wrapper that yields at most `length` bytes (for 206 responses)."""
    def __init__(self, f, length):
        self._f = f; self._remaining = length
    def read(self, n=-1):
        if self._remaining <= 0:
            return b''
        if n < 0 or n > self._remaining:
            n = self._remaining
        data = self._f.read(n)
        self._remaining -= len(data)
        return data
    def close(self):
        self._f.close()


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler + HTTP Range support.

    The stock handler returns 200 + the whole file for a Range request,
    which makes Chromium restart media playback from 0 on a seek instead
    of seeking. Real hosts (GitHub Pages, itch) answer 206, so the test
    server must too, or theme seeks (fast-forwarding a 120s track) fail.
    """
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        range_header = self.headers.get('Range')
        if not range_header:
            return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)\s*$', range_header.strip())
        if not m:
            return super().send_head()
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None
        size = os.fstat(f.fileno()).st_size
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start >= size or start > end:
            f.close()
            self.send_error(416, "Requested Range Not Satisfiable")
            return None
        self.send_response(206)
        self.send_header("Content-type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(os.fstat(f.fileno()).st_mtime))
        self.end_headers()
        f.seek(start)
        return _RangeFileWrapper(f, end - start + 1)


def serve(port):
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(RangeHandler, directory=BUILD)
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


CHECKS = []
def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + ((" — " + str(detail)) if detail else ""))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8931)
    ap.add_argument("--out", default="/tmp/neo-verify")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    # make a small custom-song test file (10s tone sweep, distinct from the theme)
    tone = os.path.join(args.out, "custom-test.mp3")
    if not os.path.exists(tone):
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
                        "-i", "sine=frequency=440:duration=10",
                        "-af", "volume=0.5", tone], check=True)
    # SpeedDemon.wav is the TEST SONG only (never bundled): upload it as a
    # custom song to prove the flow handles a real, long, large track.
    speed = os.path.join(REPO, "test-assets", "SpeedDemon.wav")
    httpd = serve(args.port)
    base = f"http://127.0.0.1:{args.port}"

    driver = r'''
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1]
OUT = sys.argv[2]
TONE = sys.argv[3]
SPEED = sys.argv[4] if len(sys.argv) > 4 else ""
results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)))
    print(("PASS " if ok else "FAIL ") + name + ((" — " + str(detail)) if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required", "--mute-audio"])
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors, failed_req = [], []
    bad_responses = []
    import time as _time
    _t0 = _time.time()
    def _stamp():
        return f"{_time.time() - _t0:5.1f}s"
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("requestfailed", lambda r: failed_req.append(f"{_stamp()} {r.url} :: {r.failure}"))
    page.on("response", lambda r: bad_responses.append(f"{_stamp()} {r.url} :: HTTP {r.status}") if r.status >= 400 else None)

    # ---- helpers: poll for state instead of fixed sleeps (decode of the
    # 120s theme is CPU-heavy and slow under load) ----
    def wait_state(pred, timeout=30):
        deadline = time.time() + timeout
        st = None
        while time.time() < deadline:
            st = page.evaluate("() => window.__neolution && window.__neolution.state")
            if st and pred(st):
                return st
            page.wait_for_timeout(250)
        return st

    def sig_of(s):
        return (len(s["notes"]), [(round(n["t"], 3), n["lane"]) for n in s["notes"][:20]]) if s else (0, [])

    def wait_sig(prev_sig, expect_seed, timeout=20):
        deadline = time.time() + timeout
        while time.time() < deadline:
            s = page.evaluate("() => window.__neolution.state")
            if s and s["chartReady"]:
                sig = sig_of(s)
                if sig != prev_sig and (not expect_seed or s["seedCode"] == expect_seed):
                    return sig
            page.wait_for_timeout(200)
        return sig_of(page.evaluate("() => window.__neolution.state"))

    # ---- 1. load the game ----
    page.goto(BASE + "/index.html", wait_until="networkidle")
    st = wait_state(lambda s: s["chartReady"] and len(s["notes"]) > 50, timeout=30)
    check("game loads, debug hook present", bool(st), (st or {}).get("song"))
    check("chart built", st and st["chartReady"] and len(st["notes"]) > 50, f"{len(st['notes']) if st else 0} notes")
    check("title screen visible", page.is_visible("#titleScreen"))
    check("play button enabled", page.is_enabled("#btnPlay"))
    page.screenshot(path=OUT + "/01-title.png")

    # ---- 1b. main menu + freeplay grid (Campaign / Freeplay) ----
    check("main menu: Campaign + Freeplay buttons", page.is_visible("#btnCampaign") and page.is_visible("#btnFreeplay"))
    check("default song is SpeedDemon", page.eval_on_selector("#songSel", "el => el.value") == "SpeedDemon.mp3",
          page.eval_on_selector("#songSel", "el => el.value"))
    check("track card shows SpeedDemon / BassBruh", "SpeedDemon" in (page.text_content("#trackCardTitle") or "") and "BassBruh" in (page.text_content("#trackCardMeta") or ""),
          page.text_content("#trackCardTitle"))
    page.click("#btnFreeplay")
    page.wait_for_timeout(300)
    check("freeplay grid visible", page.is_visible("#freeplayScreen") and page.is_visible("#freeplayGrid"))
    cards = page.eval_on_selector_all("#freeplayGrid .songCard", "els => els.map(e => e.getAttribute('data-file'))")
    check("freeplay: SpeedDemon first, Theme second", cards[:2] == ["SpeedDemon.mp3", "Neolution-Theme.mp3"], str(cards))
    check("freeplay: Theme card has CAMPAIGN badge", "CAMPAIGN" in (page.text_content("#freeplayGrid .songCard[data-file='Neolution-Theme.mp3']") or ""))
    anim = page.eval_on_selector("#freeplayGrid .songCard.selected", "el => getComputedStyle(el).animationName")
    check("selected card flashes yellow (Castle Crashers style)", anim == "flashYellow", anim)
    clicks_before = (page.evaluate("() => window.__neolution.state") or {}).get("uiClicks", 0)
    page.click("#freeplayGrid .songCard[data-file='Neolution-Theme.mp3']")
    page.wait_for_timeout(300)
    sel = page.eval_on_selector("#freeplayGrid .songCard.selected", "el => el.getAttribute('data-file')")
    check("clicking a card selects it", sel == "Neolution-Theme.mp3", sel)
    check("dropdown follows the grid selection", page.eval_on_selector("#songSel", "el => el.value") == "Neolution-Theme.mp3")
    clicks_after = (page.evaluate("() => window.__neolution.state") or {}).get("uiClicks", 0)
    check("click sound fires on selection change", clicks_after > clicks_before, f"{clicks_before}->{clicks_after}")
    page.screenshot(path=OUT + "/01b-freeplay.png")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    check("Esc returns to the main menu", page.is_visible("#titleScreen") and not page.is_visible("#freeplayScreen"))
    # Campaign button starts the campaign song (the fixed Theme, 120s)
    page.click("#btnCampaign")
    st = wait_state(lambda s: s["playing"] and "Neolution Theme" in (s["song"] or "") and abs((s["duration"] or 0) - 120) < 1, timeout=20)
    check("Campaign starts the Theme", st and st["playing"] and "Neolution Theme" in (st["song"] or ""), (st or {}).get("song"))
    # reset: reload so the seed/gameplay tests start clean on the default song
    page.goto(BASE + "/index.html", wait_until="networkidle")
    st = wait_state(lambda s: s["chartReady"] and len(s["notes"]) > 50, timeout=30)
    check("reload after menu test, chart ready", bool(st), (st or {}).get("song"))

    # ---- 2. seed determinism ----
    prev_sig = sig_of(page.evaluate("() => window.__neolution.state"))
    page.fill("#seedInputTitle", "NEON-RUSH")
    page.click("#btnApplySeedTitle")
    sig1 = wait_sig(prev_sig, "NEON-RUSH")
    page.fill("#seedInputTitle", "GRID-STORM")
    page.click("#btnApplySeedTitle")
    sig_other = wait_sig(sig1, "GRID-STORM")
    page.fill("#seedInputTitle", "NEON-RUSH")
    page.click("#btnApplySeedTitle")
    sig2 = wait_sig(sig_other, "NEON-RUSH")
    check("same seed -> identical chart", sig1 == sig2, f"{sig1[0]} notes")
    check("different seed -> different chart", sig1 != sig_other)
    seed_lbl = page.text_content("#seedLbl")
    check("seed label shows code", "NEON-RUSH" in (seed_lbl or ""), seed_lbl)

    # ---- 3. gameplay: hit notes on time ----
    page.click("#btnPlay")
    page.wait_for_timeout(1000)
    st = page.evaluate("() => window.__neolution.state")
    check("playing after Play", st and st["playing"], st and st["audioTime"])
    keymap = {0: "ArrowLeft", 1: "ArrowDown", 2: "ArrowUp", 3: "ArrowRight",
              4: "KeyA", 5: "KeyS", 6: "KeyD", 7: "KeyW"}
    for attempt in range(14):
        st = page.evaluate("() => window.__neolution.state")
        if not st or not st["playing"]:
            break
        now = st["audioTime"]
        upcoming = [n for n in st["notes"] if not n["hit"] and not n["miss"] and n["t"] > now]
        if not upcoming:
            break
        nxt = upcoming[0]
        wait = max(0.0, (nxt["t"] - now) - 0.02)
        if wait > 1.5:
            page.wait_for_timeout(int(wait * 1000))
            continue
        if wait > 0:
            page.wait_for_timeout(int(wait * 1000))
        page.keyboard.down(keymap[nxt["lane"]])
        page.wait_for_timeout(100)
        page.keyboard.up(keymap[nxt["lane"]])
        page.wait_for_timeout(120)
    st = page.evaluate("() => window.__neolution.state")
    total_hits = (st["counts"]["perfect"] + st["counts"]["great"] + st["counts"]["good"]) if st else 0
    check("notes hit register (score/combo move)", st and st["score"] > 0 and total_hits >= 3,
          f"score={st['score'] if st else 0} hits={total_hits} counts={st['counts'] if st else {}}")
    check("judgement tiers register", st and (st["counts"]["perfect"] + st["counts"]["great"]) >= 1, st and st["counts"])
    page.screenshot(path=OUT + "/02-playing.png")

    # ---- 4. custom song upload ----
    page.keyboard.press("Escape")  # pause
    page.wait_for_timeout(400)
    page.click("#btnQuitTitle")
    page.wait_for_timeout(600)
    prev_sig = sig_of(page.evaluate("() => window.__neolution.state"))
    page.set_input_files("#fileTitle", TONE)
    # wait for the chart to actually rebuild (song name flips before the
    # rebuild starts, so chartReady alone can read the stale theme chart)
    deadline = time.time() + 20
    st = None
    while time.time() < deadline:
        st = page.evaluate("() => window.__neolution.state")
        if st and st["chartReady"] and st["song"].endswith(".mp3") and sig_of(st) != prev_sig:
            break
        page.wait_for_timeout(200)
    check("custom song loads + charts", st and st["chartReady"] and st["song"].endswith(".mp3"),
          f"{st['song'] if st else ''} — {len(st['notes']) if st else 0} notes")
    page.screenshot(path=OUT + "/03-custom-song.png")

    # ---- 4b. test song (SpeedDemon.wav — test-only, never bundled) ----
    if SPEED and os.path.exists(SPEED):
        prev_sig = sig_of(page.evaluate("() => window.__neolution.state"))
        page.set_input_files("#fileTitle", SPEED)
        deadline = time.time() + 90
        st = None
        while time.time() < deadline:
            st = page.evaluate("() => window.__neolution.state")
            if st and st["chartReady"] and st["song"].endswith(".wav") and sig_of(st) != prev_sig:
                break
            page.wait_for_timeout(500)
        check("test song (SpeedDemon.wav) uploads + charts", st and st["chartReady"] and st["song"].endswith(".wav"),
              f"{st['song'] if st else ''} — {len(st['notes']) if st else 0} notes")
        page.screenshot(path=OUT + "/03b-speeddemon.png")
    else:
        check("test song (SpeedDemon.wav) present", False, "test-assets/SpeedDemon.wav missing")

    # ---- 5. results screen (seek near end, AFTER playback starts) ----
    page.click("#btnPlay")
    page.wait_for_timeout(800)
    page.evaluate("() => { const s = window.__neolution; s.seek(s.state.duration - 3); }")
    try:
        page.wait_for_selector("#resultsScreen:not(.hidden)", timeout=10000)
        check("results screen appears at song end", True)
    except Exception as e:
        check("results screen appears at song end", False, "timed out waiting for results")
    rank = page.text_content("#resultRank")
    acc = page.text_content("#resultAcc")
    check("results has rank + accuracy", rank and rank.strip() in list("SABCD") and "%" in (acc or ""), f"rank={rank} acc={acc}")
    # Badge visibility: this run missed every note, so FULL COMBO must be
    # hidden (it used to show unconditionally — the .hidden class had no
    # rule for non-overlay elements). NEW BEST is genuine here (first run
    # on this song/difficulty), so it must show.
    check("full-combo badge hidden on a missed run", not page.is_visible("#fcBadge"))
    check("new-best badge shown on a first run", page.is_visible("#newBestBadge"))
    page.screenshot(path=OUT + "/04-results.png")

    # ---- 6. ad break after 3rd run ----
    page.evaluate("() => window.__neolution.setAdRuns(2)")
    page.click("#btnAgain")
    page.wait_for_timeout(800)
    # make sure playback actually started before seeking (restart is async)
    for _ in range(10):
        if page.evaluate("() => window.__neolution.state.playing"):
            break
        page.wait_for_timeout(300)
    page.evaluate("() => { const s = window.__neolution; s.seek(s.state.duration - 2); }")
    page.wait_for_timeout(3500)
    try:
        page.wait_for_selector("#adModal:not(.hidden)", timeout=8000)
        check("ad modal appears after 3rd run", True)
    except Exception:
        check("ad modal appears after 3rd run", False, "timed out waiting for ad modal")
    ad_text = page.text_content("#adBox")
    check("ad fallback shows (no publisher ID configured)", ad_text and ("free" in ad_text.lower() or "support" in ad_text.lower()), (ad_text or "")[:80])
    page.screenshot(path=OUT + "/05-ad.png")
    page.click("#btnAdContinue")
    page.wait_for_timeout(300)
    check("ad Continue closes the modal", not page.is_visible("#adModal"))

    # ---- 6b. store (IAP seam, empty catalog) ----
    page.goto(BASE + "/index.html", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.click("#btnStore")
    page.wait_for_timeout(500)
    check("store panel opens", page.is_visible("#storeScreen"))
    store_text = page.text_content("#storeSub")
    check("store shows coming-soon (empty catalog)", store_text and "coming soon" in store_text.lower(), store_text)
    check("store lists no items (empty catalog)", page.locator("#storeItems > *").count() == 0)
    iap = page.evaluate("() => window.__neolution.state.iap")
    check("IAP seam inert (not configured, 0 items)", iap and not iap["configured"] and iap["items"] == 0, iap)
    res = page.evaluate("() => window.__neolution.purchase('no-such-item')")
    check("purchase of unknown item is refused", res and not res["ok"], res)
    iap2 = page.evaluate("() => window.__neolution.state.iap")
    check("refused purchase grants nothing", iap2 and iap2["owned"] == [], iap2)
    page.click("#btnStoreClose")
    page.wait_for_timeout(300)
    check("store closes back to title", page.is_visible("#titleScreen"))
    page.screenshot(path=OUT + "/05b-store.png")

    # ---- 7. release shell ----
    page.goto(BASE + "/release/Neolution_SteamVerticalSlice.html", wait_until="networkidle")
    page.wait_for_timeout(2000)
    check("shell loads, menu visible", page.is_visible("#menuOverlay"))
    check("shell song grid renders", page.locator("#songGrid .songCard").count() >= 2,
          f"{page.locator('#songGrid .songCard').count()} cards")
    page.screenshot(path=OUT + "/06-shell-menu.png")
    page.click("#playBtn")
    fst = None
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            game_frame = next(f for f in page.frames if "index.html" in f.url)
            fst = game_frame.evaluate("() => window.__neolution && window.__neolution.state")
            if fst and fst["playing"]:
                break
        except Exception:
            pass
        page.wait_for_timeout(500)
    check("shell Play launches game in iframe", fst and fst["playing"], fst and fst["song"])
    check("shell HUD buttons appear", page.is_visible("#hudMenuBtn") and page.is_visible("#hudRetryBtn"))
    page.screenshot(path=OUT + "/07-shell-playing.png")
    page.click("#hudMenuBtn")
    page.wait_for_timeout(800)
    check("shell Menu returns to menu", page.is_visible("#menuOverlay"))

    # ---- console / network hygiene ----
    check("no console errors", len(errors) == 0, errors[:3])
    # net::ERR_ABORTED on an audio file is the <audio> element cancelling
    # the previous song's pending stream when the player switches songs —
    # normal media-element behaviour, not a failed load. A genuinely
    # missing file would surface as an HTTP 4xx response instead.
    # The same applies to blob: URLs: a custom song's object URL is
    # revoked when the next song loads (or the page navigates), which
    # aborts the in-flight blob stream.
    audio_aborts = [f for f in failed_req if "net::ERR_ABORTED" in f and
                    ("blob:" in f.split(" :: ")[0] or
                     any(f.split(" :: ")[0].endswith(ext) for ext in (".mp3", ".wav", ".ogg", ".m4a", ".flac")))]
    real_failures = [f for f in failed_req if f not in audio_aborts]
    check("no failed requests (ignoring benign audio/blob-stream aborts on song switch)", len(real_failures) == 0, real_failures[:3])
    check("no HTTP error responses", len(bad_responses) == 0, bad_responses[:3])
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} checks passed")
sys.exit(1 if fails else 0)
'''
    driver_path = os.path.join(args.out, "driver.py")
    open(driver_path, "w").write(driver)
    env = dict(os.environ, PLAYWRIGHT_BROWSERS_PATH=os.path.expanduser("~/.cache/ms-playwright"))
    r = subprocess.run([PLAYWRIGHT_PYTHON, driver_path, base, args.out, tone, speed],
                       env=env, capture_output=False)
    httpd.shutdown()
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
