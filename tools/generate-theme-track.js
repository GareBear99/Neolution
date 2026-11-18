// Neolution Theme — original track generator.
// ---------------------------------------------------------------
// This script synthesizes the game's built-in song entirely from
// code: every sound (kick, bass, hats, snare, arps, pads) is a
// mathematically generated oscillator / filtered-noise voice.
// No samples, no third-party audio, no AI generation — the track
// is 100% original and reproducible from this file alone.
//
//   node tools/generate-theme-track.js [out.wav]
//
// Output: 44.1 kHz 16-bit stereo WAV, 128 BPM, 64 bars (2:00).
// Transcode to MP3 with: ffmpeg -i out.wav -codec:a libmp3lame -b:a 192k Neolution-Theme.mp3
// Ending: the last 5 s fade out smoothly to silence (no hard cut), and the
// outro arp uses a triangle wave (same notes/rhythm) instead of the square
// wave — the square arp's harsh harmonics read as static at the end.
'use strict';
const fs = require('fs');

const SR = 44100;
const BPM = 128;
const BEAT = 60 / BPM;          // seconds per beat
const BAR = BEAT * 4;           // seconds per bar
const BARS = 64;
const DUR = BARS * BAR;         // 120.0 s
const N = Math.ceil(DUR * SR);  // samples per channel

const L = new Float32Array(N);
const R = new Float32Array(N);

// --- chord progression: Am - F - C - G (1 bar each) ----------------
const CHORDS = [
  { root: 110.00, tones: [220.00, 261.63, 329.63] }, // Am
  { root: 87.31,  tones: [174.61, 220.00, 261.63] }, // F
  { root: 130.81, tones: [261.63, 329.63, 392.00] }, // C
  { root: 98.00,  tones: [196.00, 246.94, 293.66] }, // G
];
const chordAt = (bar) => CHORDS[bar % 4];

// --- helpers -------------------------------------------------------
function idx(t) { return Math.floor(t * SR); }
function panGain(pan) { // pan -1..1, equal-power-ish
  const a = (pan + 1) * Math.PI / 4;
  return [Math.cos(a), Math.sin(a)];
}
function softClip(x) { return Math.tanh(x); }

// one-pole lowpass state
function lpFilter() { let y = 0; return (x, k) => { y += k * (x - y); return y; }; }
function lpK(cutoff) { const dt = 1 / SR; const rc = 1 / (2 * Math.PI * cutoff); return dt / (rc + dt); }
// one-pole highpass state
function hpFilter() { let y = 0, px = 0; return (x, k) => { const v = k * (y + x - px); px = x; y = v; return v; }; }

// deterministic noise (mulberry32) so the render is reproducible
let noiseState = 0x9E3779B9;
function noise() {
  noiseState = (noiseState + 0x6D2B79F5) | 0;
  let x = Math.imul(noiseState ^ (noiseState >>> 15), 1 | noiseState);
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296 * 2 - 1;
}

// --- voices (each renders into L/R) --------------------------------
function addTone({ t0, dur, f0, f1 = null, type = 'sine', amp = 0.5, pan = 0, attack = 0.004, decay = null, lp = 0, hp = 0 }) {
  const start = idx(t0), end = Math.min(N, idx(t0 + dur));
  if (start >= N || end <= start) return;
  const [gl, gr] = panGain(pan);
  const dec = decay === null ? dur : decay;
  const lpf = lp ? lpFilter() : null, hpf = hp ? hpFilter() : null;
  const lpk = lp ? lpK(lp) : 0, hpk = hp ? lpK(hp) : 0;
  let phase = 0;
  for (let i = start; i < end; i++) {
    const t = (i - start) / SR;
    const k = i / SR - t0;
    const f = f1 === null ? f0 : f0 * Math.pow(f1 / f0, Math.min(1, t / Math.max(0.01, dur * 0.5)));
    phase += 2 * Math.PI * f / SR;
    let s;
    if (type === 'sine') s = Math.sin(phase);
    else if (type === 'square') s = Math.sign(Math.sin(phase)) * 0.8;
    else if (type === 'saw') s = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
    else if (type === 'tri') s = 2 * Math.abs(2 * ((phase / (2 * Math.PI)) % 1) - 1) - 1;
    else s = Math.sin(phase);
    if (lpf) s = lpf(s, lpk);
    if (hpf) s = hpf(s, hpk);
    // envelope: quick attack, exponential decay
    const env = Math.min(1, t / attack) * Math.exp(-t / (dec / 3));
    const v = s * amp * env;
    L[i] += v * gl; R[i] += v * gr;
  }
}

function addNoiseHit({ t0, dur, amp = 0.3, pan = 0, lp = 0, hp = 0, decay = null }) {
  const start = idx(t0), end = Math.min(N, idx(t0 + dur));
  if (start >= N || end <= start) return;
  const [gl, gr] = panGain(pan);
  const dec = decay === null ? dur : decay;
  const lpf = lp ? lpFilter() : null, hpf = hp ? hpFilter() : null;
  const lpk = lp ? lpK(lp) : 0, hpk = hp ? lpK(hp) : 0;
  for (let i = start; i < end; i++) {
    const t = (i - start) / SR;
    let s = noise();
    if (lpf) s = lpf(s, lpk);
    if (hpf) s = hpf(s, hpk);
    const env = Math.exp(-t / (dec / 3));
    const v = s * amp * env;
    L[i] += v * gl; R[i] += v * gr;
  }
}

// --- arrangement ---------------------------------------------------
// Sections (bar numbers, 0-based): intro 0-3, verse 4-11, build 12-15,
// drop1 16-31, break 32-39, drop2 40-55, outro 56-63.
function section(bar) {
  if (bar < 4) return 'intro';
  if (bar < 12) return 'verse';
  if (bar < 16) return 'build';
  if (bar < 32) return 'drop1';
  if (bar < 40) return 'break';
  if (bar < 56) return 'drop2';
  return 'outro';
}

const arpPattern = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 2]; // chord-tone indexes per 16th

for (let bar = 0; bar < BARS; bar++) {
  const sec = section(bar);
  const tBar = bar * BAR;
  const ch = chordAt(bar);

  // Pads: whole-bar chords (all sections, quieter in drops)
  const padAmp = sec === 'intro' || sec === 'break' || sec === 'outro' ? 0.055 : 0.035;
  for (const tone of ch.tones) {
    for (const det of [0.997, 1.003]) {
      addTone({ t0: tBar, dur: BAR * 1.05, f0: tone * det, type: 'saw', amp: padAmp, lp: 1100, attack: 0.5, decay: BAR });
    }
  }

  // Arp: 16ths (intro/verse/break/outro: softer; drops: full)
  // Outro uses a triangle wave (same notes/rhythm) — the square wave's
  // harsh harmonics read as static once the drums drop out at the end.
  const arpOn = sec !== 'build';
  if (arpOn) {
    const arpAmp = (sec === 'drop1' || sec === 'drop2') ? 0.16 : 0.10;
    const arpType = sec === 'outro' ? 'tri' : 'square';
    const arpOct = sec === 'drop2' ? 2 : 1;
    for (let s = 0; s < 16; s++) {
      const tone = ch.tones[arpPattern[s] % 3] * (s % 4 === 2 ? 2 : 1) * (arpOct === 2 && s % 8 === 6 ? 2 : 1);
      const t = tBar + s * (BEAT / 4);
      addTone({ t0: t, dur: 0.14, f0: tone, type: arpType, amp: arpAmp, lp: 3200, pan: (s % 2 ? 0.18 : -0.18), decay: 0.10 });
      // simple echo: one repeat a dotted-8th later, quieter
      addTone({ t0: t + BEAT * 0.75, dur: 0.12, f0: tone, type: arpType, amp: arpAmp * 0.22, lp: 2400, pan: (s % 2 ? -0.25 : 0.25), decay: 0.09 });
    }
  }

  // Kick: four-on-the-floor in verse/drops; half-time in break; none in intro/outro
  const kickBeats = sec === 'break' ? [0, 2] : (sec === 'intro' || sec === 'outro' ? [] : [0, 1, 2, 3]);
  for (const b of kickBeats) {
    const t = tBar + b * BEAT;
    addTone({ t0: t, dur: 0.30, f0: 160, f1: 46, type: 'sine', amp: 0.95, decay: 0.24 });
    addNoiseHit({ t0: t, dur: 0.02, amp: 0.25, hp: 3000, decay: 0.015 });
  }

  // Bass: 8ths following the root (drops/verse/build)
  if (sec === 'verse' || sec === 'build' || sec === 'drop1' || sec === 'drop2') {
    for (let e = 0; e < 8; e++) {
      const t = tBar + e * (BEAT / 2);
      const f = ch.root * (e % 4 === 2 ? 1.5 : (e % 2 === 1 ? 2 : 1));
      addTone({ t0: t, dur: 0.22, f0: f, type: 'saw', amp: sec === 'build' ? 0.20 : 0.26, lp: 750, decay: 0.16, pan: 0 });
    }
  }

  // Hats: 8ths in verse, 16ths in drops/build
  if (sec === 'verse' || sec === 'build' || sec === 'drop1' || sec === 'drop2') {
    const steps = (sec === 'verse') ? 8 : 16;
    for (let s = 0; s < steps; s++) {
      const t = tBar + s * (BEAT * 4 / steps);
      const open = s % 4 === 2;
      addNoiseHit({ t0: t, dur: open ? 0.16 : 0.05, amp: open ? 0.10 : 0.13, hp: 7800, decay: open ? 0.12 : 0.035, pan: (s % 2 ? 0.3 : -0.3) });
    }
  }

  // Snare on 2 & 4 (drops + build end)
  if (sec === 'drop1' || sec === 'drop2' || sec === 'build') {
    for (const b of [1, 3]) {
      const t = tBar + b * BEAT;
      addNoiseHit({ t0: t, dur: 0.16, amp: 0.30, lp: 5200, hp: 1200, decay: 0.12 });
      addTone({ t0: t, dur: 0.10, f0: 190, type: 'tri', amp: 0.22, decay: 0.08 });
      if (sec === 'drop2') { // clap layer
        for (let c = 0; c < 3; c++) addNoiseHit({ t0: t + c * 0.012, dur: 0.09, amp: 0.16, lp: 4000, hp: 1500, decay: 0.07 });
      }
    }
  }

  // Build riser (bars 12-15): rising noise sweep
  if (sec === 'build') {
    const t = tBar;
    const start = idx(t), end = Math.min(N, idx(t + BAR));
    const lpf = lpFilter();
    for (let i = start; i < end; i++) {
      const u = (i - start) / Math.max(1, end - start);
      const cutoff = 400 + u * 9000;
      const s = lpf(noise(), lpK(cutoff));
      const v = s * (0.05 + u * 0.22);
      L[i] += v; R[i] += v;
    }
    // snare roll on the last build bar
    if (bar === 15) {
      for (let s = 0; s < 16; s++) {
        addNoiseHit({ t0: tBar + s * (BEAT / 4), dur: 0.05, amp: 0.10 + s * 0.012, lp: 5200, hp: 1200, decay: 0.04 });
      }
    }
  }

  // Drop impacts (first bar of each drop)
  if (bar === 16 || bar === 40) {
    addNoiseHit({ t0: tBar, dur: 1.4, amp: 0.20, hp: 5000, decay: 1.1, pan: 0 });
    addTone({ t0: tBar, dur: 0.5, f0: 160, f1: 40, type: 'sine', amp: 1.0, decay: 0.4 });
  }
}

// --- master: soft clip + normalize to -1 dBFS -----------------------
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = softClip(L[i]); R[i] = softClip(R[i]);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const target = Math.pow(10, -1 / 20); // -1 dBFS
const g = peak > 0 ? target / peak : 1;

// Fade-out: the last 5 s ease to silence (raised-cosine). Without it the
// file ends mid-note at full outro volume — a hard cut that reads as a
// burst of static on the bare arp.
const FADE_START = DUR - 5;
function fadeAt(i) {
  const t = i / SR;
  if (t < FADE_START) return 1;
  const u = (t - FADE_START) / (DUR - FADE_START);
  return 0.5 * (1 + Math.cos(Math.PI * Math.min(1, u)));
}

// --- write 16-bit stereo WAV ---------------------------------------
const outPath = process.argv[2] || 'Neolution-Theme.wav';
const dataSize = N * 2 * 2;
const buf = Buffer.alloc(44 + dataSize);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
for (let i = 0; i < N; i++) {
  const f = fadeAt(i);
  const l = Math.max(-1, Math.min(1, L[i] * g * f));
  const r = Math.max(-1, Math.min(1, R[i] * g * f));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
}
fs.writeFileSync(outPath, buf);
console.log(`wrote ${outPath} (${(DUR).toFixed(1)}s, ${BPM} BPM, ${BARS} bars, peak ${peak.toFixed(3)} -> gain ${g.toFixed(3)})`);
