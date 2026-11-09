/* THE ULTIMATE BATTLE – Halloween 2026 Edition  (v0.2)
   A birthday gift for Checco ("Black Mask"). Vanilla JS + Canvas, no dependencies. */
(() => {
'use strict';

// ================================================================ setup
const W = 960, H = 540, FLOOR = 462;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let scale = 1, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.style.width = Math.round(W * scale) + 'px'; cv.style.height = Math.round(H * scale) + 'px';
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize); resize();
const FONT = '"Press Start 2P", monospace';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sgn = v => (v < 0 ? -1 : 1);

// ================================================================ assets
const IMG = {};
const baseImgs = ['fe_fwalk_0.png', 'fe_fwalk_1.png', 'fe_fsick_0.png', 'fe_erun_0.png', 'fe_erun_1.png', 'fe_carry_0.png', 'carpet_fly.png', 'scene.jpg', 'blackmask.png', 'mastro.png', 'hench.png', 'plane.png', 'spritz.png',
  'vs_blackmask.jpg', 'vs_mastro.jpg', 'vs_hench.jpg', 'vs_ginevra.jpg', 'vs_christian.jpg',
  'card_fede.jpg', 'card_ginevra.jpg', 'card_elisabetta.jpg', 'card_enrico.jpg', 'card_arianna.jpg', 'card_ferdy.jpg',
  'card_emma.jpg', 'card_matteo.jpg', 'card_daniele.jpg', 'card_christian.jpg', 'card_tommaso.jpg', 'card_mari.jpg',
  'card_miriana.jpg', 'card_banana.jpg', 'card_spritz.jpg', 'card_mastro.jpg', 'card_blackmask.jpg', 'card_sofia.jpg',
  'card_ilaria.jpg', 'card_carpet.jpg', 'plane_christian.png', 'tommaso_pu.png', 'win_daniele.jpg', 'win_matteo.jpg',
  'port_arianna.jpg', 'port_banana.jpg', 'port_blackmask.jpg', 'port_christian.jpg', 'port_daniele.jpg', 'port_elisabetta.jpg', 'port_emma.jpg', 'port_enrico.jpg', 'port_fede.jpg', 'port_ferdy.jpg', 'port_ginevra.jpg', 'port_ilaria.jpg', 'port_mari.jpg', 'port_matteo.jpg', 'port_miriana.jpg', 'port_sofia.jpg', 'port_spritz.jpg', 'port_tommaso.jpg', 'port_mastro.jpg'];
let pending = 0, loadedAll = false;
function loadImg(file, key) {
  pending++;
  const im = new Image();
  im.onload = im.onerror = () => { pending--; };
  im.src = 'assets/' + file;
  IMG[key || file.replace(/\.(png|jpg)$/, '')] = im;
  return im;
}
baseImgs.forEach(f => loadImg(f));
// optional arena + sprite sheets (made with Gemini), described by assets/sprites.json
const SPR = { bm: {}, ml: {}, hench: {} };
const OPTIONAL = {};
pending++;
fetch('assets/sprites.json').then(r => r.ok ? r.json() : {}).catch(() => ({})).then(m => {
  const map = { bm: 'bm', bm2: 'bm', ml: 'ml', hench: 'hench' };
  for (const k in m) {
    if (k === 'arena' || k === 'arena_boss') { OPTIONAL[k] = loadImg(m[k], k); continue; }
    const tgt = SPR[map[k]]; if (!tgt) continue;
    for (const anim in m[k]) {
      const list = Array.isArray(m[k][anim]) ? m[k][anim] : [m[k][anim]];
      tgt[anim] = list.map((e, i) => ({ img: loadImg(e.file, k + '_' + anim + '_' + i), ax: e.ax, h: e.h }));
    }
  }
  pending--;
});

// ================================================================ audio
const AU = { ctx: null, master: null, music: null, sfx: null, seq: null, voice: {} };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  AU.ctx = new AC();
  AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.85; AU.master.connect(AU.ctx.destination);
  AU.music = AU.ctx.createGain(); AU.music.gain.value = 0.26; AU.music.connect(AU.master);
  AU.sfx = AU.ctx.createGain(); AU.sfx.gain.value = 0.75; AU.sfx.connect(AU.master);
  // play a silent buffer (iOS unlock)
  const b = AU.ctx.createBuffer(1, 1, 22050); const s = AU.ctx.createBufferSource(); s.buffer = b; s.connect(AU.ctx.destination); s.start(0);
  fetch('assets/audio.json').then(r => r.ok ? r.json() : {}).catch(() => ({})).then(m => {
    for (const k in m) fetch('assets/' + m[k]).then(r => r.arrayBuffer()).then(buf => new Promise((res, rej) => AU.ctx.decodeAudioData(buf, res, rej)))
      .then(d => { AU.voice[k] = d; }).catch(() => {});
  });
}
function playVoice(k, gain = 1.1) {
  if (!AU.ctx || !AU.voice[k]) return false;
  const s = AU.ctx.createBufferSource(); s.buffer = AU.voice[k];
  const g = AU.ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(AU.sfx); s.start(); return true;
}
function tone(freq, dur, type = 'square', vol = 0.2, when = 0, dest = null, slide = 0) {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime + when, o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol = 0.3, filt = 1200, when = 0, dest = null, q = 1, type = 'bandpass') {
  if (!AU.ctx) return;
  if (!noiseBuf) { noiseBuf = AU.ctx.createBuffer(1, AU.ctx.sampleRate, AU.ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = AU.ctx.currentTime + when, s = AU.ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = AU.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filt; f.Q.value = q;
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const SFX = {
  swing() { noise(0.1, 0.22, 2600, 0, null, 1.5); },
  punch() { noise(0.09, 0.6, 700, 0, null, 0.8); tone(160, 0.08, 'square', 0.25, 0, null, 0.4); noise(0.2, 0.3, 200, 0.02, null, 0.6, 'lowpass'); },
  kick() { noise(0.14, 0.7, 450, 0, null, 0.7); tone(110, 0.14, 'sawtooth', 0.3, 0, null, 0.4); noise(0.25, 0.4, 150, 0.02, null, 0.6, 'lowpass'); },
  block() { tone(1100, 0.06, 'square', 0.16); tone(1650, 0.1, 'triangle', 0.14, 0.02); },
  parry() { [1200, 1600, 2400].forEach((f, i) => tone(f, 0.14, 'square', 0.16, i * 0.05)); },
  ko() { noise(0.5, 0.6, 120, 0, null, 0.5, 'lowpass'); tone(80, 0.5, 'sine', 0.5, 0, null, 0.5); },
  pickup() { [660, 880, 1320].forEach((f, i) => tone(f, 0.1, 'square', 0.14, i * 0.06)); },
  drink() { for (let i = 0; i < 4; i++) tone(300 + i * 40, 0.08, 'sine', 0.2, i * 0.07); },
  bad() { tone(200, 0.3, 'sawtooth', 0.2, 0, null, 0.5); },
  card() { [523, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.14, i * 0.05)); },
  scream() { if (playVoice('ginevra', 1.3)) return; for (let i = 0; i < 6; i++) tone(900 + Math.random() * 300, 0.5, 'sawtooth', 0.08, i * 0.02, null, 1.3); },
  spit() { noise(0.15, 0.4, 3000, 0, null, 4); },
  siren() { for (let i = 0; i < 4; i++) { tone(700, 0.3, 'square', 0.08, i * 0.6); tone(950, 0.3, 'square', 0.08, i * 0.6 + 0.3); } },
  plane() { noise(2.2, 0.35, 300, 0, null, 0.5); tone(120, 2.2, 'sawtooth', 0.06, 0, null, 0.6); },
  slip() { tone(600, 0.4, 'sine', 0.2, 0, null, 0.3); },
  boom() { noise(0.6, 0.9, 90, 0, null, 0.5, 'lowpass'); tone(55, 0.6, 'sine', 0.6, 0, null, 0.5); },
  gong() { [110, 165, 220].forEach((f, i) => tone(f, 1.6, 'sine', 0.25 / (i + 1))); noise(0.3, 0.3, 400, 0, null, 1); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.15, i * 0.14)); },
  announce(k, fallback) { if (playVoice(k, 1.25)) return; if (fallback) SFX.gong(); },
};
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  title: { bpm: 92, bass: [45, 45, 48, 48, 43, 43, 40, 40], lead: [69, 72, 76, 72, 67, 71, 74, 71, 64, 67, 72, 67, 64, 68, 71, 68], drums: 'k...s...k.k.s...' },
  fight: { bpm: 140, bass: [40, 40, 52, 40, 43, 43, 55, 43, 38, 38, 50, 38, 45, 45, 57, 47], lead: [76, 0, 79, 76, 0, 74, 72, 0, 74, 0, 76, 79, 0, 81, 79, 76], drums: 'k.h.s.h.k.k.s.h.' },
  boss: { bpm: 156, bass: [38, 38, 50, 38, 41, 41, 53, 41, 36, 36, 48, 36, 37, 37, 49, 37], lead: [74, 77, 81, 77, 74, 0, 72, 74, 77, 0, 79, 77, 76, 73, 74, 0], drums: 'k.hsk.hsk.hsk.ss' },
  samba: { bpm: 168, bass: [43, 0, 43, 43, 0, 43, 0, 43, 41, 0, 41, 41, 0, 41, 0, 41], lead: [79, 79, 0, 76, 0, 79, 81, 0, 79, 0, 76, 74, 0, 76, 0, 0], drums: 'kshskshskshskshs', samba: true },
  accordion: { bpm: 100, bass: [41, 0, 0, 48, 0, 0, 43, 0, 0, 48, 0, 0], lead: [77, 81, 84, 81, 77, 81, 79, 83, 86, 83, 79, 83], drums: '............', acc: true },
  win: { bpm: 120, bass: [48, 48, 55, 55, 53, 53, 55, 55], lead: [72, 76, 79, 84, 81, 84, 79, 76, 77, 81, 84, 81, 79, 76, 74, 72], drums: 'k...s...k...s...' },
  silent: { bpm: 100, bass: [0], lead: [0], drums: '.' },
};
let curTrack = null, overrideTrack = null, overrideUntil = 0;
function music(name) { if (curTrack === name) return; curTrack = name; startSeq(); }
function musicOverride(name, secs) { overrideTrack = name; overrideUntil = performance.now() + secs * 1000; startSeq(); }
function startSeq() {
  if (!AU.ctx) return;
  if (AU.seq) clearInterval(AU.seq);
  let step = 0, next = AU.ctx.currentTime + 0.05;
  AU.seq = setInterval(() => {
    const nm = (overrideTrack && performance.now() < overrideUntil) ? overrideTrack : (overrideTrack = null, curTrack);
    const tr = TRACKS[nm]; if (!tr) return;
    const sp = 60 / tr.bpm / 2;
    while (next < AU.ctx.currentTime + 0.2) {
      const t = next - AU.ctx.currentTime;
      const b = tr.bass[step % tr.bass.length];
      if (b) tone(NOTE(b), sp * 0.9, tr.acc ? 'sawtooth' : 'triangle', 0.35, t, AU.music);
      const l = tr.lead[step % tr.lead.length];
      if (l) { if (tr.acc) { [0, 4, 7].forEach(iv => tone(NOTE(l + iv - 12), sp * 0.95, 'sawtooth', 0.06, t, AU.music)); } else tone(NOTE(l), sp * 0.8, 'square', 0.1, t, AU.music); }
      const d = tr.drums[step % tr.drums.length];
      if (d === 'k') tone(110, 0.15, 'sine', 0.6, t, AU.music, 0.4);
      if (d === 's') noise(0.1, tr.samba ? 0.25 : 0.32, tr.samba ? 4000 : 1800, t, AU.music, 0.8);
      if (d === 'h') noise(0.04, 0.13, 7000, t, AU.music, 1);
      if (tr.samba && step % 4 === 3) { tone(880, 0.06, 'square', 0.1, t, AU.music); tone(660, 0.06, 'square', 0.1, t + sp / 2, AU.music); }
      next += sp; step++;
    }
  }, 50);
}

// ================================================================ difficulty
const DIFFS = {
  EASY: { edmg: 0.6, ewind: 1.3, bhp: 70, bwind: 1.25, ehp: 0.75, label: 'EASY', col: '#7CFC00' },
  NORMAL: { edmg: 1.0, ewind: 1.0, bhp: 100, bwind: 1.0, ehp: 1.0, label: 'NORMAL', col: '#ffe36b' },
  HARD: { edmg: 1.35, ewind: 0.82, bhp: 130, bwind: 0.85, ehp: 1.25, label: 'HARD', col: '#ff4040' },
};
let D = DIFFS.NORMAL;

// ================================================================ state
const G = { state: 'loading', t: 0, st: 0, shake: 0, flash: 0, flashCol: '255,255,255', hitstop: 0, slowmo: 0, zoom: 0, zx: 480, zy: 300,
  fx: [], texts: [], bubbles: [], particles: [], enemies: [], items: [], hazards: [], banners: [], big: [],
  score: 0, kos: 0, maxCombo: 0, friendsCalled: 0, continues: 0, bacPeak: 0, startTime: 0, roundDamage: 0 };
const P = { pushBonus: 0 };
const B = {};
function resetPlayer() {
  Object.assign(P, { x: 400, face: 1, hp: 100, maxhp: 100, state: 'idle', st: 0, atkHit: false, hurtT: 0, stun: 0, slip: 0,
    bac: 0, buff: 0, ferdy: 0, combo: 0, comboT: 0, special: 0, nunchaku: 0, nunT: 0, held: 0, heldTaps: 0, block: false,
    blockStart: undefined, dead: false, walkT: 0, pushBonus: P.pushBonus || 0 });
}
const CARDS = [
  { id: 'fede', name: 'FEDE', move: 'PEACEMAKER', cd: 24, t: 10 },
  { id: 'ginevra', name: 'GINEVRA', move: "RICCHIO'!!!", cd: 20, t: 6, uses: 0 },
  { id: 'elisabetta', name: 'ELISABETTA', move: 'SPIDER WEB', cd: 18, t: 4 },
  { id: 'christian', name: 'CHRISTIAN', move: 'SARDEGNA AIR STRIKE', cd: 999, t: 0, once: true, used: false },
];
const BTN = {
  left: { x: 14, y: 428, w: 104, h: 100, label: '◀' }, right: { x: 126, y: 428, w: 104, h: 100, label: '▶' },
  punch: { x: 736, y: 440, w: 104, h: 90, label: 'PUNCH', col: '#ff4b4b' }, kick: { x: 848, y: 440, w: 104, h: 90, label: 'KICK', col: '#ffb547' },
  block: { x: 736, y: 344, w: 104, h: 86, label: 'BLOCK', col: '#1ec8ff' }, special: { x: 848, y: 344, w: 104, h: 86, label: 'NUNCHAKU', col: '#ffe36b' },
  cards: [0, 1, 2, 3].map(i => ({ x: 14 + i * 60, y: 78, w: 52, h: 52 })),
};
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function setState(s) { G.state = s; G.st = 0; }

// ================================================================ input (multi-touch)
const ptr = new Map(); // id -> {x,y,btn}
const keys = {};
function btnAt(x, y) {
  for (const k of ['left', 'right', 'punch', 'kick', 'block', 'special']) if (inRect(x, y, BTN[k])) return k;
  for (let i = 0; i < 4; i++) if (inRect(x, y, BTN.cards[i])) return 'card' + i;
  return null;
}
function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit();
  const p = toLogical(e); const b = G.state === 'fight' ? btnAt(p.x, p.y) : null;
  ptr.set(e.pointerId, { x: p.x, y: p.y, btn: b });
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  onPress(b, p.x, p.y);
});
cv.addEventListener('pointermove', e => {
  const q = ptr.get(e.pointerId); if (!q) return;
  const p = toLogical(e); q.x = p.x; q.y = p.y;
  if (q.btn === 'left' || q.btn === 'right') { const b = btnAt(p.x, p.y); if (b === 'left' || b === 'right') q.btn = b; }
});
const endPtr = e => { ptr.delete(e.pointerId); };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
const held = name => { if (keys[name]) return true; for (const q of ptr.values()) if (q.btn === name) return true; return false; };
window.addEventListener('keydown', e => {
  if (e.repeat) return; audioInit();
  const k = e.key.toLowerCase();
  const map = { arrowleft: 'left', arrowright: 'right', a: 'punch', s: 'kick', d: 'block', w: 'special', '1': 'card0', '2': 'card1', '3': 'card2', '4': 'card3' };
  if (map[k]) { keys[map[k]] = true; onPress(G.state === 'fight' ? map[k] : null, 480, 270); }
  else if (k === 'enter' || k === ' ') onPress(null, 480, 270);
});
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); const map = { arrowleft: 'left', arrowright: 'right', d: 'block' }; if (map[k]) keys[map[k]] = false; });
document.addEventListener('gesturestart', e => e.preventDefault());

function onPress(b, x, y) {
  const s = G.state;
  if (s === 'loading') return;
  if (s === 'title') { if (G.st > 0.4) { setState('difficulty'); music('title'); } return; }
  if (s === 'difficulty') {
    ['EASY', 'NORMAL', 'HARD'].forEach((k, i) => { if (x > 180 + i * 210 && x < 180 + i * 210 + 190 && y > 230 && y < 330) { D = DIFFS[k]; SFX.card(); startIntro(); } });
    return;
  }
  if (s === 'intro') { introNext(); return; }
  if (s === 'vs' || s === 'roundcard') return;
  if (s === 'pushup') { pushTap(); return; }
  if (s === 'finish') { finishTap(); return; }
  if (s === 'gameover') { if (G.st > 1.5) continueGame(); return; }
  if (s === 'ending') { endingTap(); return; }
  if (s === 'apology') { if (G.st > 7.5) startEnding(); return; }
  if (s !== 'fight') return;
  if (P.held > 0 && b && b !== 'left' && b !== 'right') { P.heldTaps++; floatText('TAP!', P.x + rnd(-40, 40), 260, '#ffe36b', 12, 0.4); if (P.heldTaps >= 12) { P.held = 0; floatText('FREE!', P.x, 230, '#7CFC00', 22); SFX.parry(); } return; }
  // Ferdy rescue: tap on him
  const fe = G.hazards.find(h => h.type === 'ferdy' && !h.done);
  if (!b && fe && Math.abs(x - fe.x) < 70 && y > 300 && y < 470) { ferdyTap(fe); return; }
  if (b === 'punch') attack('punch');
  else if (b === 'kick') attack('kick');
  else if (b === 'special') useSpecial();
  else if (b && b.startsWith('card')) useCard(+b[4]);
}

// ================================================================ fx helpers
function text(str, x, y, size = 16, color = '#fff', align = 'center', outline = '#000', ow = 4) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineWidth = ow; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function bigText(str, x, y, size, c1 = '#fff6b0', c2 = '#e08a00', outline = '#2a0000') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size / 4; ctx.strokeStyle = outline; ctx.strokeText(str, x, y);
  ctx.lineWidth = size / 9; ctx.strokeStyle = '#000'; ctx.strokeText(str, x, y);
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillText(str, x, y);
}
function wrap(str, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = str.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function floatText(str, x, y, color = '#fff', size = 14, life = 0.9, vy = -60) { G.texts.push({ str, x, y, color, size, life, max: life, vy }); }
function bubble(str, x, y, who = 'enemy', life = 2.2) { G.bubbles.push({ str, x, y, who, life, max: life }); }
function banner(card, name, move, color = '#1ec8ff', life = 1.45) { G.banners.push({ card, name, move, color, life, max: life }); SFX.card(); }
function announce(str, life = 1.4, size = 52, c1, c2) { G.big.push({ str, life, max: life, size, c1, c2 }); }
function burst(x, y, color, n = 12, sp = 220, size = 4, life = 0.6, grav = 300, add = false) {
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(sp * 0.3, sp); G.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rnd(life * 0.5, life), max: life, color, size, grav, add }); }
}
function hitFx(x, y, heavy = false, blood = true) {
  G.fx.push({ type: 'spark', x, y, t: 0, life: heavy ? 0.28 : 0.18, heavy, rot: rnd(0, 6) });
  burst(x, y, '#fff7c0', heavy ? 18 : 10, heavy ? 420 : 280, 3, 0.35, 200, true);
  if (blood) burst(x, y, '#c4121a', heavy ? 10 : 5, heavy ? 260 : 180, 4, 0.7, 700);
  G.hitstop = heavy ? 0.09 : 0.05; G.shake = Math.max(G.shake, heavy ? 10 : 5);
  if (heavy) { G.zoom = 0.06; G.zx = x; G.zy = y; }
}

// ================================================================ characters
const NATIVE = { bm: 1, ml: -1, hench: -1 };  // which way the cutout art faces
const SHEETFACE = { bm: 1, ml: 1, hench: 1 };  // which way the Gemini sheets face
const BASE = { bm: 'blackmask', ml: 'mastro', hench: 'hench' };
const HEIGHT = { bm: 270, ml: 258, hench: 232 };
const POSEMAP = {
  bm: { idle: 'idle', walk: 'idle', punch: 'punch', kick: 'kick', hit: 'hit', block: 'block', ko: 'ko', victory: 'victory', nunchaku: 'nunchaku', drink: 'drink', dizzy: 'dizzy', stun: 'dizzy' },
  ml: { idle: 'idle', walk: 'idle', guard: 'idle', punch: 'punch', windup: 'windup', hug: 'hug', hit: 'hit', ko: 'ko', block: 'idle' },
  hench: { idle: 'walk', walk: 'walk', windup: 'walk', punch: 'punch', hit: 'hit', block: 'block', flee: 'flee', ko: 'ko' },
};
// draw a character: kind, pose, x (feet), face (+1 right/-1 left), opts {h, rot, alpha, white, lunge, lean, sy, glow, tint}
function getAnim(kind, name) { const a = SPR[kind][name]; return (a && a.length && a[0].img.width) ? a : null; }
function drawChar(kind, pose, x, face, o = {}) {
  const anim = o.anim ? getAnim(kind, o.anim) : null;
  const targetH = (o.h || HEIGHT[kind]);
  let im, s, ax = 0.5, usingSheet = false;
  if (anim) {
    const fr = anim[clamp(Math.floor(o.fi || 0), 0, anim.length - 1)];
    const ref = (getAnim(kind, 'idle') || anim)[0];
    s = targetH / ref.h; im = fr.img; ax = fr.ax; usingSheet = true;
  } else { im = IMG[BASE[kind]]; if (!im || !im.width) return; s = targetH / im.height; }
  const w = im.width * s, h = im.height * s;
  const flip = face !== (usingSheet ? SHEETFACE[kind] : NATIVE[kind]);
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, FLOOR + 2, (pose === 'ko' ? 110 : 60) * targetH / 270, 9, 0, 0, 7); ctx.fill(); }
  let lunge = o.lunge || 0, rot = o.rot || 0, sy = o.sy || 1;
  if (!usingSheet) {
    if (pose === 'punch') { lunge += 26; rot += 0.07; }
    if (pose === 'kick') { lunge += 18; rot -= 0.16; }
    if (pose === 'windup') { lunge -= 14; rot -= 0.08; }
    if (pose === 'hug') { lunge += 30; rot += 0.1; }
    if (pose === 'hit') { lunge -= 18; rot -= 0.14; }
    if (pose === 'block') { sy *= 0.95; lunge -= 4; }
    if (pose === 'ko') { rot -= 1.48; }
    if (pose === 'flee') { rot -= 0.1; }
    if (pose === 'walk') sy *= 1 + 0.02 * Math.sin(G.t * 14);
    if (pose === 'idle') sy *= 1 + 0.012 * Math.sin(G.t * 3);
  } else {
    lunge *= 0.35;
    if (anim.length === 1 && ['idle', 'walk', 'guard', 'windup'].includes(pose)) sy *= 1 + 0.014 * Math.sin(G.t * (pose === 'walk' ? 12 : 3.5) + x * 0.01);
    if (anim.length === 1 && pose === 'walk') lunge += 3 * Math.sin(G.t * 12 + x);
    if (pose === 'windup' && kind !== 'bm') rot -= 0.06;
  }
  ctx.translate(x + face * lunge, FLOOR + (pose === 'ko' && !usingSheet ? -10 : 0));
  ctx.rotate(face * rot);
  ctx.scale(flip ? -1 : 1, sy);
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  if (usingSheet) ctx.imageSmoothingEnabled = false;
  if (o.glow && (!usingSheet || kind !== 'bm')) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowSize || 22; }
  if (o.filter) ctx.filter = o.filter;
  const dx = -w * ax;
  ctx.drawImage(im, dx, -h, w, h);
  ctx.shadowBlur = 0;
  if (o.white) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.white; ctx.drawImage(im, dx, -h, w, h); }
  ctx.restore();
  return { w, h };
}
// choose animation + frame for each character state
function animFor(kind, pose, t, prog) {
  const loop = (name, fps, only) => { const a = getAnim(kind, name); if (!a) return null; const idx = only || a.map((_, i) => i); return { anim: name, fi: idx[Math.floor(t * fps) % idx.length] }; };
  const prg = (name, only) => { const a = getAnim(kind, name); if (!a) return null; const idx = only || a.map((_, i) => i); return { anim: name, fi: idx[Math.min(idx.length - 1, Math.floor(clamp(prog, 0, 0.999) * idx.length))] }; };
  if (kind === 'bm') {
    switch (pose) {
      case 'idle': return loop('idle', 8);
      case 'walk': return loop('walk', 10);
      case 'walkb': return loop('walkb', 10) || loop('walk', 10);
      case 'punch': return prg('punch');
      case 'punchb': return prg('punchb') || prg('punch');
      case 'kick': return prg('kick');
      case 'hit': case 'stun': return loop('hit', 6, [1, 2]);
      case 'block': return { anim: 'hit', fi: 3 };
      case 'ko': return prg('ko');
      case 'nunchaku': return loop('nunchaku', 14, [0, 2, 3, 4, 5]);
      case 'victory': return getAnim('bm', 'victory') ? loop('victory', 2.5) : { anim: 'hit', fi: 0 };
      case 'drink': return getAnim('bm', 'drink') ? { anim: 'drink', fi: 0 } : loop('idle', 8);
    }
  }
  if (kind === 'ml') {
    switch (pose) {
      case 'idle': case 'guard': return loop('idle', 7);
      case 'walk': return loop('walk', 10) || loop('idle', 7);
      case 'punch': return prg('punch');
      case 'kick': return prg('kick') || prg('punch');
      case 'windup': return prg('windup') || prg('punch', [0]);
      case 'hug': return loop('hug', 8);
      case 'hit': return loop('hit', 6);
      case 'ko': return prg('ko');
      case 'apology': return prg('apology') || prg('ko');
      case 'sorry': return prg('sorry') || prg('ko');
    }
  }
  if (kind === 'hench') {
    switch (pose) {
      case 'walk': case 'idle': case 'windup': return loop('walk', 9) || loop('idle', 8);
      case 'punch': return prg('punch');
      case 'hit': return loop('hit', 6);
      case 'block': return loop('block', 4);
      case 'flee': return loop('flee', 10);
      case 'ko': return prg('ko');
    }
  }
  return null;
}
function drawActor(kind, pose, x, face, o = {}, t = G.t, prog = 0) {
  const a = animFor(kind, pose, t, prog);
  if (a) { o.anim = a.anim; o.fi = a.fi; }
  return drawChar(kind, pose, x, face, o);
}

// ================================================================ player
const ATK = { punch: { start: 0.06, active: 0.12, end: 0.24, range: 120, dmg: 1, heavy: false }, kick: { start: 0.13, active: 0.22, end: 0.42, range: 150, dmg: 1.7, heavy: true } };
function attack(kind) {
  if (P.dead || P.stun > 0 || P.slip > 0 || P.held > 0) return;
  if (P.state === 'punch' || P.state === 'kick') { if (P.st < ATK[P.state].end * 0.7) { P.queued = kind; return; } }
  P.state = kind; P.st = 0; P.atkHit = false; if (kind === 'punch') P.punchAlt = !P.punchAlt; SFX.swing();
}
function nearestTarget() {
  let best = null, bd = 1e9;
  for (const e of G.enemies) if (!e.ko) { const d = Math.abs(e.x - P.x); if (d < bd) { bd = d; best = e; } }
  if (G.round === 2 && B.alive && B.phase > 0) { const d = Math.abs(B.x - P.x); if (d < bd) { bd = d; best = B; } }
  return best;
}
function resolveAttack(kind) {
  const a = ATK[kind], dir = P.face;
  const mult = (P.buff > 0 ? 1.6 : 1);
  // puddles/massi etc: massi can be hit
  const mx = G.hazards.find(h => h.type === 'massi' && !h.done && (h.x - P.x) * dir > 0 && Math.abs(h.x - P.x) < a.range + 30);
  if (mx) { mx.done = true; mx.fall = 1; hitFx(mx.x - dir * 30, 330, true); floatText('MASSI DOWN!', mx.x, 280, '#7CFC00', 14); SFX.kick(); G.score += 150; return; }
  // boss
  if (G.round === 2 && B.alive && B.phase > 0 && (B.x - P.x) * dir > 0 && Math.abs(B.x - P.x) < a.range + 35) {
    if (bossHittable()) {
      const maxHits = B.state === 'stunned' || B.state === 'exposed' ? 4 : 3;
      if ((B.openHits || 0) >= maxHits) { floatText('BLOCKED', B.x, 250, '#9b9bff', 12); SFX.block(); P.combo = 0; return; }
      B.openHits = (B.openHits || 0) + 1;
      const d = a.dmg * 1.1 * (P.buff > 0 ? 1.4 : 1) * (1 + P.pushBonus) * (['stunned', 'sleep', 'dance'].includes(B.state) ? 1.15 : 1) * (100 / D.bhp);
      bossDamage(d); B.hitT = 0.25; B.x += dir * (a.heavy ? 26 : 12);
      hitFx(B.x - dir * 40, a.heavy ? 300 : 260, a.heavy); a.heavy ? SFX.kick() : SFX.punch(); addCombo(); return;
    } else if (['guard', 'idle'].includes(B.state)) {
      floatText('BLOCKED', B.x, 250, '#9b9bff', 12); SFX.block(); B.blockT = 0.3;
      if (Math.random() < 0.4 && B.phase >= 2) bossStartAttack('punch', 0.3);
      P.combo = 0; return;
    }
  }
  // enemies in front
  const list = G.enemies.filter(e => !e.ko && (e.x - P.x) * dir > -10 && Math.abs(e.x - P.x) < a.range).sort((p, q) => Math.abs(p.x - P.x) - Math.abs(q.x - P.x));
  const targets = kind === 'kick' ? list.slice(0, 2) : list.slice(0, 1);
  if (!targets.length) return;
  targets.forEach(e => hitEnemy(e, a.dmg * mult, dir, a.heavy));
  a.heavy ? SFX.kick() : SFX.punch(); addCombo();
}
function addCombo() {
  P.combo++; P.comboT = 1.3; G.maxCombo = Math.max(G.maxCombo, P.combo);
  if (P.combo === 6 || P.combo === 12) SFX.announce('combo', false);
  if (P.nunchaku <= 0) P.special = Math.min(100, P.special + 6);
}
function useSpecial() {
  if (G.state !== 'fight' || P.special < 100 || P.nunchaku > 0 || P.dead) return;
  P.special = 0; P.nunchaku = 4.5; P.nunT = 0;
  banner('blackmask', 'BLACK MASK', 'NUNCHAKU!', '#1ec8ff', 1.2);
  bubble('VI FACCIO VEDERE IO...', P.x, 150, 'player', 1.6);
}
function playerHurt(dmg, fromX) {
  if (P.dead) return false;
  const d0 = Math.max(1, Math.round(dmg * D.edmg));
  const blocking = P.block && P.stun <= 0 && P.held <= 0;
  let d = d0;
  if (blocking) { d = Math.max(0, Math.ceil(d0 * 0.12)); SFX.block(); floatText('BLOCK', P.x, 240, '#9bd8ff', 12); G.fx.push({ type: 'blockfx', x: P.x + sgn((fromX || P.x + P.face) - P.x) * 40, y: 300, t: 0, life: 0.2 }); }
  else {
    SFX.punch(); G.flash = 0.08; G.flashCol = '255,40,40'; G.shake = Math.max(G.shake, 9); P.hurtT = 0.28; P.combo = 0;
    if (P.state !== 'ko') { P.state = 'hit'; P.st = 0; }
    hitFx(P.x + sgn((fromX || P.x) - P.x) * 30, 270, dmg >= 15);
    if (fromX !== undefined) P.x = clamp(P.x - sgn(fromX - P.x) * (dmg >= 15 ? 40 : 18), 220, W - 220);
  }
  P.hp -= d; G.roundDamage += d;
  if (d > 0) floatText('-' + d, P.x + rnd(-30, 30), 210, '#ff5050', 14);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.state = 'ko'; P.koAt = G.t; G.slowmo = 1.2; SFX.ko(); setTimeout(() => gameOver(), 1300); }
  return blocking;
}
function updatePlayer(dt) {
  P.st += dt;
  if (P.hurtT > 0) P.hurtT -= dt;
  if (P.stun > 0) P.stun -= dt;
  if (P.slip > 0) P.slip -= dt;
  if (P.buff > 0) P.buff -= dt;
  if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
  if (P.held > 0) { P.held -= dt; if (P.held <= 0) floatText('LET GO', P.x, 230, '#fff', 12); }
  if (P.dead) return;
  // BAC
  P.bac = Math.max(0, P.bac - dt * 1.6); G.bacPeak = Math.max(G.bacPeak, P.bac);
  if (P.ferdy > 0) { P.ferdy -= dt; if (P.ferdy <= 0) { P.bac = 55; floatText('BACK TO NORMAL', P.x, 200, '#fff', 14); } }
  else if (P.bac >= 99.5) { P.ferdy = 5; announce('FERDY MODE!', 1.4, 34, '#eaffc0', '#6bbf2a'); SFX.bad(); }
  // attacks
  if (P.state === 'punch' || P.state === 'kick') {
    const a = ATK[P.state];
    if (!P.atkHit && P.st >= a.start) { P.atkHit = true; resolveAttack(P.state); }
    if (P.st >= a.end) { const q = P.queued; P.queued = null; P.state = 'idle'; P.st = 0; if (q) attack(q); }
    return;
  }
  if (P.state === 'hit') { if (P.st > 0.28) P.state = 'idle'; return; }
  if (P.stun > 0 || P.slip > 0 || P.held > 0) { P.state = 'stun'; return; }
  // block / move
  P.block = held('block');
  if (P.block) { if (P.blockStart === undefined) P.blockStart = G.t; P.state = 'block'; }
  else { P.blockStart = undefined;
    let mv = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (P.ferdy > 0) mv = -mv;
    P.mv = mv;
    if (mv) {
      P.x = clamp(P.x + mv * 230 * dt * (P.bac > 60 ? 0.8 : 1), 220, W - 220);
      P.state = 'walk';
      // puddle / banana under feet
      const pd = G.hazards.find(h => (h.type === 'puddle' && h.t > 0.6 && Math.abs(P.x - h.x) < 70) || (h.type === 'banana' && !h.done && Math.abs(P.x - h.x) < 26));
      if (pd) { P.slip = 1.1; P.bac = Math.min(100, P.bac + 5); floatText('SLIP!', P.x, 300, '#ff9a2e', 18); SFX.slip(); G.shake = 6; if (pd.type === 'banana') pd.done = true; else pd.life = 0; }
    } else P.state = 'idle';
  }
  // auto-face nearest target
  const tg = nearestTarget();
  if (tg && Math.abs(tg.x - P.x) > 8) P.face = sgn(tg.x - P.x);
  // collect items under feet
  for (const it of G.items) if (!it.got && it.y >= FLOOR - 30 && Math.abs(it.x - P.x) < 55) collect(it);
  // nunchaku
  if (P.nunchaku > 0) {
    P.nunchaku -= dt; P.nunT -= dt;
    if (P.nunT <= 0) {
      P.nunT = 0.22;
      for (const e of G.enemies) if (!e.ko && Math.abs(e.x - P.x) < 210) { e.hp -= 1; hitFx(e.x, 290, false, false); if (e.hp <= 0 || Math.random() < 0.3) { koEnemy(e, sgn(e.x - P.x), 'flee'); bubble(pick(['AIUTO!', 'E ARMATO!', 'SCAPPA!']), e.x, 200, 'enemy', 1); } }
      if (G.round === 2 && B.alive && B.phase >= 2 && Math.abs(B.x - P.x) < 210) { bossDamage(0.6 * 100 / D.bhp, true); hitFx(B.x, 290, false, false); }
      SFX.swing();
    }
  }
}

// ================================================================ enemies
const TAUNTS = ['SEI 1 CONTRO 15!', 'MA TU CHI SEI?', 'DI CHI SEI AMICO?', 'GUARDA CHE SIAMO 15!', 'CHE VUOI FARE?', 'VATTENE A CASA!', 'TI SEI IMBUCATO!'];
const PLAYER_LINES = ['SIETE TUTTE DELLE PUSSY!', "IO CE L'HO CON LUI!", 'STATTI ZITTA, CAPAROCAZZO!', "MI SONO IMBUCATO. E ALLORA?", 'NEMMENO UN CAZZOTTO MI DATE?', 'VENITE, VENITE!'];
function spawnEnemy(side, opts = {}) {
  const e = { x: side < 0 ? -70 : W + 70, side, hp: Math.max(1, Math.round((opts.hp || 3) * D.ehp)), state: 'walk', t: 0, hurt: 0, cool: rnd(0.4, 1.2),
    speed: rnd(80, 115) * (opts.fast || 1), ko: false, kt: 0, frozen: 0, webbed: 0, dance: 0, sleep: 0, stunE: 0, guard: 0,
    scale: rnd(0.95, 1.05), wall: !!opts.wall, dmg: opts.dmg || 8 };
  G.enemies.push(e);
  if (Math.random() < 0.45) bubble(pick(TAUNTS), clamp(e.x, 120, 840), 170, 'enemy', 1.8);
  return e;
}
function hitEnemy(e, dmg, dir, heavy) {
  if (e.guard > 0) { floatText('GUARD', e.x, 230, '#9b9bff', 11); SFX.block(); P.combo = 0; if (Math.random() < 0.5) { e.state = 'windup'; e.t = 0.25; } return; }
  e.hp -= dmg; e.hurt = 0.3; e.x += dir * (heavy ? 40 : 20); e.state = 'walk'; e.t = 0;
  if (G.round === 1 && G.r1spawned > 3 && Math.random() < 0.2 && e.hp > 0) e.guardNext = true;
  hitFx(e.x - dir * 30, heavy ? 300 : 260, heavy); G.score += 25;
  if (e.hp <= 0) koEnemy(e, dir);
}
function koEnemy(e, dir, type) {
  e.ko = true; e.kt = 0; e.koType = type || pick(['faint', 'flee', 'sorry', 'faint', 'flee']);
  e.koDir = dir || sgn(e.x - P.x); SFX.ko(); G.kos++; G.score += 100;
  if (e.koType === 'sorry') bubble(pick(['SORRY BRO!', 'SCUSA FRA!', 'NON VOLEVO!']), e.x, 200, 'enemy', 1.4);
  if (e.koType === 'flee') bubble(pick(['MAMMA!', 'ME NE VADO!', 'AIUTO!']), e.x, 200, 'enemy', 1.2);
  if (G.round === 1) G.r1left = Math.max(0, G.r1left - 1);
  if (G.round === 1 && G.r1left === 0) { G.slowmo = 1.0; }
}
function updateEnemies(dt) {
  const L = [], R = [];
  for (const e of G.enemies) if (!e.ko) (e.x < P.x ? L : R).push(e);
  L.sort((a, b) => b.x - a.x); R.sort((a, b) => a.x - b.x);
  for (const e of G.enemies) {
    e.t += dt; if (e.hurt > 0) e.hurt -= dt;
    if (e.ko) { e.kt += dt; if (e.koType === 'flee') e.x += e.koDir * 280 * dt; if (e.koType === 'faint' && e.kt < 0.3) e.x += e.koDir * 120 * dt; if (e.kt > 2.6) e.dead = true; continue; }
    const side = e.x < P.x ? -1 : 1; e.side = side;
    const bn = G.hazards.find(h => h.type === 'banana' && !h.done && Math.abs(e.x - h.x) < 28);
    if (bn) { bn.done = true; koEnemy(e, side, 'faint'); floatText('SPLAT!', e.x, 280, '#ffe36b', 18); SFX.slip(); continue; }
    if (e.guardNext && e.hurt <= 0) { e.guardNext = false; e.guard = 0.9; }
    if (e.guard > 0) e.guard -= dt;
    if (e.frozen > 0) { e.frozen -= dt; continue; }
    if (e.webbed > 0) { e.webbed -= dt; continue; }
    if (e.sleep > 0) { e.sleep -= dt; continue; }
    if (e.stunE > 0) { e.stunE -= dt; continue; }
    if (e.dance > 0) { e.dance -= dt; e.danceHit = (e.danceHit || 0) - dt; if (e.danceHit <= 0) { e.danceHit = 1.1; e.hp -= 1; hitFx(e.x, 280, false, false); SFX.punch(); if (e.hp <= 0) koEnemy(e, side, 'faint'); } continue; }
    if (e.hurt > 0) continue;
    const arr = side < 0 ? L : R, idx = arr.indexOf(e);
    const stop = P.x + side * (100 + idx * 70);
    const dist = (e.x - stop) * side;
    if (e.state === 'walk') {
      if (dist > 2) e.x -= side * e.speed * dt;
      else if (dist < -20) e.x += side * 60 * dt;
      else if (idx === 0) { e.cool -= dt; if (e.cool <= 0) { e.state = 'windup'; e.t = 0; } }
    } else if (e.state === 'windup') {
      if (e.t > (G.round === 2 ? 0.55 : 0.62) * D.ewind) { e.state = 'punch'; e.t = 0; if (Math.abs(e.x - P.x) < 150) playerHurt(e.dmg, e.x); }
    } else if (e.state === 'punch') { if (e.t > 0.25) { e.state = 'walk'; e.cool = rnd(0.8, 1.6) * D.ewind; } }
    const fe = G.hazards.find(h => h.type === 'ferdy' && !h.done);
    if (fe && fe.t > fe.enter && Math.abs(e.x - fe.x) < 36) ferdyFail(fe);
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

// ================================================================ boss
function bossReset() {
  Object.assign(B, { alive: true, hp: 100, x: W + 120, face: -1, state: 'enter', t: 0, phase: 0, frozen: 0, webbed: 0, hitT: 0, blockT: 0,
    atk: null, windup: 0, combo: 0, stunDur: 0, lying: 0, nextCall: 12, hitCd: 0, openHits: 0, prevState: '' });
}
function bossHittable() { return ['recover', 'stunned', 'exposed', 'sleep', 'dance'].includes(B.state) || (B.state === 'windup' && B.atk === 'hug'); }
function bossDamage(d, raw = false) {
  if (!B.alive) return;
  if (B.phase === 1 && !raw && B.state !== 'exposed') return;
  B.hp -= d; G.score += Math.round(d * 20);
  if (B.state === 'windup' && B.atk === 'hug') { B.state = 'recover'; B.t = 0; floatText('INTERRUPTED!', B.x, 220, '#7CFC00', 14); }
  if (B.phase === 1 && B.hp <= 70) { B.phase = 2; B.state = 'idle'; B.t = 0; bubble('ADESSO TI SISTEMO IO!', B.x, 140, 'boss', 2); announce('PHASE 2', 1.2, 34, '#ffd0f6', '#c02ab0'); G.enemies.forEach(e => { if (!e.ko) koEnemy(e, e.side, 'flee'); }); }
  if (B.phase === 2 && B.hp <= 35) { B.phase = 3; B.state = 'idle'; B.t = 0; bubble('MA TU CHE CAZZO SCHERZI?!', B.x, 140, 'boss', 2); announce('RAGE MODE', 1.2, 34, '#ffb0b0', '#d01010'); G.shake = 16; SFX.boom(); SFX.announce('berserk', false); }
  if (B.hp <= 0) { B.hp = 0; startFinish(); }
}
function bossStartAttack(kind, wind) {
  B.state = 'windup'; B.atk = kind; B.t = 0;
  const rage = B.phase === 3 ? 0.75 : 1;
  B.windup = (wind || { punch: 0.5, hay: 1.0, hug: 0.9 }[kind]) * rage * D.bwind;
  if (kind === 'hug') bubble(pick(['VIENI QUA, ABBRACCIO!', 'IO APPROCCIO CON TUTTE!']), B.x, 140, 'boss', 1.2);
}
const BOSS_TAUNTS = ['LA TUA RAGAZZA E UNA DELLE TANTE', 'IO IN SERATA APPROCCIO CON TUTTE', 'MA TU CHE CAZZO SCHERZI?', 'SEI SOLO, FRA!', 'TI FACCIO VEDERE IO'];
function spawnWall() { for (let i = 0; i < 3; i++) { const e = spawnEnemy(1, { hp: 2, wall: true, dmg: 6 }); e.x = W + 60 + i * 70; } if (Math.random() < 0.3) spawnEnemy(-1, { hp: 2, dmg: 6 }); }
function updateBoss(dt) {
  if (!B.alive) return;
  B.t += dt; if (B.hitT > 0) B.hitT -= dt; if (B.blockT > 0) B.blockT -= dt;
  if (B.state !== B.prevState) { B.openHits = 0; B.prevState = B.state; }
  if (B.frozen > 0) { B.frozen -= dt; return; }
  if (B.lying) return;
  let side = B.x < P.x ? -1 : 1;
  B.face = -side;
  let stand = P.x + side * 125;
  if (stand > W - 60 || stand < 60) { stand = P.x - side * 125; if (B.state === 'idle' || B.state === 'guard') { B.state = 'dash'; B.t = 0; B.dashTo = stand; } }
  switch (B.state) {
    case 'enter': B.x = lerp(B.x, W - 120, dt * 2); if (B.t > 1.6) { B.phase = 1; B.state = 'hide'; B.t = 0; spawnWall(); } break;
    case 'hide':
      B.x = lerp(B.x, P.x > W / 2 ? 90 : W - 90, dt * 2);
      if (Math.random() < dt / 7) throwGlass();
      if (G.enemies.filter(e => !e.ko && e.wall).length === 0 && B.t > 1) { B.state = 'exposed'; B.t = 0; bubble(pick(['OH... ASPETTA FRA', 'NO NO NO!']), B.x, 140, 'boss', 1.4); }
      break;
    case 'exposed': B.x = lerp(B.x, stand, dt * 3); if (B.t > 3.6) { B.state = 'hide'; B.t = 0; spawnWall(); bubble('RAGAZZI! AIUTO!', B.x, 140, 'boss', 1.4); } break;
    case 'idle': case 'guard': {
      const d = (B.x - stand) * side;
      if (Math.abs(d) > 6) B.x -= sgn(d) * side * 170 * dt; // walk towards stand point
      const gap = B.phase === 3 ? rnd(0.45, 0.85) : rnd(0.7, 1.3);
      if (B.t > gap && Math.abs(B.x - P.x) < 190) {
        const r = Math.random();
        if (r < 0.12) { B.state = 'dash'; B.t = 0; B.dashTo = P.x - side * 125; floatText('DASH', B.x, 260, '#ff4bd8', 12); }
        else if (r < 0.45) bossStartAttack('punch');
        else if (r < 0.78) bossStartAttack('hay');
        else bossStartAttack('hug');
        B.combo = B.phase === 3 ? Math.floor(rnd(1, 3)) : 0;
      } else B.state = 'guard';
      if (Math.random() < dt / 7) bubble(pick(BOSS_TAUNTS), B.x, 140, 'boss', 1.6);
      if (B.phase === 3) { B.nextCall -= dt; if (B.nextCall <= 0) { B.nextCall = 16; spawnEnemy(side < 0 ? 1 : -1, { hp: 2 }); bubble('RAGAZZI, TENETELO!', B.x, 140, 'boss', 1.4); } }
      break;
    }
    case 'dash': B.x = lerp(B.x, clamp(B.dashTo, 60, W - 60), dt * 8); if (B.t > 0.45) { B.state = 'idle'; B.t = 0; } break;
    case 'windup':
      if (B.t >= B.windup) {
        const dmg = { punch: 8, hay: 20, hug: 12 }[B.atk];
        const inRange = Math.abs(B.x - P.x) < (B.atk === 'hug' ? 180 : 165);
        const parry = B.atk === 'hay' && P.block && P.blockStart !== undefined && (G.t - P.blockStart) < 0.35;
        B.state = 'strike'; B.t = 0;
        if (!inRange) { SFX.swing(); }
        else if (parry) { SFX.parry(); announce('PARRY!', 0.8, 30, '#d8ffd0', '#2ec22e'); B.state = 'stunned'; B.t = 0; B.stunDur = 1.3; }
        else {
          const blocked = playerHurt(B.atk === 'hug' && P.block ? Math.round(dmg * 1.5) : dmg, B.x);
          if (B.atk === 'hug' && !blocked) bubble('LA TUA RAGAZZA E UNA DELLE TANTE!', B.x, 140, 'boss', 1.8);
          if (B.atk === 'hay' && !blocked) { G.zoom = 0.07; G.zx = P.x; G.zy = 280; if (Math.random() < 0.4) setTimeout(() => SFX.announce('pathetic', false), 300); }
        }
      }
      break;
    case 'strike':
      if (B.t > 0.22) { if (B.combo > 0) { B.combo--; bossStartAttack(pick(['punch', 'punch', 'hay'])); } else { B.state = 'recover'; B.t = 0; } }
      break;
    case 'recover': if (B.t > (B.phase === 3 ? 0.6 : 0.85)) { B.state = 'idle'; B.t = 0; } break;
    case 'stunned': if (B.webbed > 0) B.webbed -= dt; if (B.t > (B.stunDur || 2)) { B.state = 'idle'; B.t = 0; } break;
    case 'sleep': if (B.t > 2.5) { B.state = 'idle'; B.t = 0; } break;
    case 'dance': if (B.t > 3) { B.state = 'idle'; B.t = 0; } break;
  }
  // don't overlap the player
  if (Math.abs(B.x - P.x) < 70 && !B.lying && B.state !== 'dash') B.x = P.x + side * 70;
  B.x = clamp(B.x, -40, W + 40);
  B.mv = lerp(B.mv || 0, Math.abs(B.x - (B.px ?? B.x)) / Math.max(dt, 1e-3), 0.3); B.px = B.x;
}

// ================================================================ hazards / events
function throwGlass() { const tx = clamp(P.x + rnd(-30, 30), 60, W - 60); const from = Math.random() < 0.5 ? -1 : 1; G.hazards.push({ type: 'glass', tx, from, t: 0, dur: 1.5, done: false }); }
const EVENTS = {
  spritz() { spawnItem('spritz'); }, shot() { spawnItem('shot'); }, pear() { spawnItem('pear'); }, glass() { throwGlass(); },
  puddle() { const x = clamp(P.x + pick([-1, 1]) * rnd(150, 230), 80, W - 80); G.hazards.push({ type: 'puddle', x, t: 0, life: 8 }); floatText('SPILLED SPRITZ!', x, 420, '#ff9a2e', 11, 1.4, -10); },
  massi() { const side = pick([-1, 1]); G.hazards.push({ type: 'massi', side, x: side < 0 ? -60 : W + 60, t: 0, done: false, fall: 0 }); bubble('MASSIMILIANO IS COMING! BLOCK!', 480, 120, 'warn', 1.6); },
  grab() { if (P.held > 0) return; P.held = 6; P.heldTaps = 0; bubble('IN-DOMUS RESIDENT: "FERMO! NON QUI!" MASH THE BUTTONS!', 480, 120, 'warn', 2.2); SFX.bad(); },
  spit() { banner('daniele', 'DANIELE', 'SPIT ATTACK! PTUH!', '#c8ff6b'); const x = clamp(P.x + pick([-1, 1]) * 160, 80, W - 80); G.hazards.push({ type: 'spit', x, t: 0, life: 1.6 }); setTimeout(() => SFX.spit(), 500); },
  lullaby() { banner('matteo', 'MATTEO', 'ACCORDION LULLABY', '#b07cff'); musicOverride('accordion', 5.5); G.fx.push({ type: 'matteo', t: 0, life: 5.5 }); G.enemies.forEach(e => { if (!e.ko) { e.sleep = 5; e.state = 'walk'; } }); if (B.alive && B.phase >= 2 && ['idle', 'guard', 'recover'].includes(B.state)) { B.state = 'sleep'; B.t = 0; } },
  samba() { banner('enrico', 'ENRICO + ARIANNA', 'SAMBA HEX', '#21c45a'); musicOverride('samba', 6.5); G.fx.push({ type: 'brazil', t: 0, life: 6.5 }); G.enemies.forEach(e => { if (!e.ko) { e.dance = 6; e.state = 'walk'; e.danceHit = rnd(0.3, 1); } }); if (B.alive && B.phase >= 2 && ['idle', 'guard', 'recover'].includes(B.state)) { B.state = 'dance'; B.t = 0; } },
  carpet() { banner('mari', 'MARI · SOFIA · ILARIA · MIRIANA', 'MAGIC CARPET', '#2fd3c8'); G.hazards.push({ type: 'carpet', t: 0, life: 4.5, threw: false }); },
  banana() { banner('banana', 'BANANA GUY', 'BANANA PEEL (WATCH YOUR STEP)', '#ffe36b', 1.4); const x = clamp(P.x + pick([-1, 1]) * rnd(140, 220), 70, W - 70); G.hazards.push({ type: 'banana', x, t: 0, done: false, life: 16 }); },
  ferdy() { if (G.hazards.find(h => h.type === 'ferdy')) return; const x = clamp(P.x + pick([-1, 1]) * 200, 270, W - 270); G.hazards.push({ type: 'ferdy', x, from: x < W / 2 ? -1 : 1, enter: 1.6, t: 0, taps: 0, done: false, life: 10.1 }); bubble('FERDY NEEDS HELP! TAP HIM 10 TIMES!', 480, 110, 'warn', 2.6); SFX.bad(); },
};
function spawnItem(kind) { const x = clamp(P.x + pick([-1, 1]) * rnd(120, 260), 70, W - 70); G.items.push({ kind, x, y: -30, t: 0, got: false }); if (kind === 'spritz' || kind === 'shot') floatText(kind === 'shot' ? 'DRINK?' : 'SPRITZ! WALK OVER IT', x, 200, '#ff9a2e', 10, 1.4, -10); if (kind === 'pear') floatText('PEAR JUICE!', x, 200, '#b8f55a', 10, 1.4, -10); }
function collect(it) {
  it.got = true; G.score += 30;
  if (it.kind === 'spritz' || it.kind === 'shot') P.drinkAt = G.t;
  if (it.kind === 'spritz') { P.bac = Math.min(100, P.bac + 24); P.buff = 10; floatText('SPRITZ! POWER UP', P.x, 190, '#ff9a2e', 16); SFX.drink(); }
  else if (it.kind === 'shot') { P.bac = Math.min(100, P.bac + 48); floatText('TRIPLE SHOT?! BAC UP!', P.x, 190, '#ff4b4b', 14); SFX.bad(); }
  else if (it.kind === 'pear') { P.hp = Math.min(P.maxhp, P.hp + 25); P.bac = Math.max(0, P.bac - 35); floatText('BEST SUCCO EVER! +25', P.x, 190, '#b8f55a', 12); SFX.pickup(); }
  else if (it.kind === 'heart') { P.hp = Math.min(P.maxhp, P.hp + 8); floatText('+8', P.x, 190, '#ff6b9a', 16); SFX.pickup(); }
  burst(it.x, FLOOR - 30, '#ffe36b', 10, 200, 4, 0.5, 300, true);
}
function spr(im, x, y, h, o = {}) { // draw sprite with feet at (x,y)
  if (!im.width) return; const w = h * im.width / im.height; ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowSize || 14; } ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore(); }
function shadow(x, w) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, FLOOR + 2, w, 9, 0, 0, 7); ctx.fill(); }
function drawFerdy(h) {
  const S = 250 / (IMG.fe_fwalk_0.height || 300), side = h.from, fh = im => im.height * S;
  const fw = () => IMG[Math.floor(G.t * 5) % 2 ? 'fe_fwalk_1' : 'fe_fwalk_0'], er = () => IMG[Math.floor(G.t * 10) % 2 ? 'fe_erun_1' : 'fe_erun_0'];
  if (!h.done) {
    const k = clamp(h.t / h.enter, 0, 1), x = lerp(side < 0 ? -90 : W + 90, h.x, k);
    if (k < 1) {
      const im = fw(); shadow(x, 40);
      spr(im, x, FLOOR + 4 - Math.abs(Math.sin(G.t * 10)) * 4, fh(im), { rot: Math.sin(G.t * 4) * 0.12, flip: side > 0 });
      if (Math.floor(G.t * 3) % 2) text('HIC!', x + 30, FLOOR - 270, 10, '#d8ffb0', 'center', '#000', 4);
    } else {
      const im = IMG.fe_fsick_0; shadow(h.x, 70);
      const gl = ctx.createRadialGradient(h.x, FLOOR - 80, 10, h.x, FLOOR - 80, 110); gl.addColorStop(0, `rgba(150,255,110,${0.16 + 0.1 * Math.sin(G.t * 5)})`); gl.addColorStop(1, 'rgba(150,255,110,0)'); ctx.fillStyle = gl; ctx.fillRect(h.x - 110, FLOOR - 190, 220, 200);
      spr(im, h.x, FLOOR + 4, fh(im) * (1 + 0.02 * Math.sin(G.t * 6)), { flip: side > 0 });
      if (Math.random() < 0.05) G.particles.push({ x: h.x + (side > 0 ? -1 : 1) * rnd(0, 20), y: FLOOR - fh(im) * 0.55, vx: (side > 0 ? -1 : 1) * rnd(10, 50), vy: rnd(10, 60), life: 0.8, max: 0.8, color: '#a8e04a', size: rnd(3, 6), grav: 500 });
      text('FERDY', h.x, FLOOR - fh(im) - 14, 10, '#b8f55a', 'center', '#000', 4);
    }
    return;
  }
  if (h.failed) { const im = IMG.fe_fsick_0, k = clamp((h.t - h.endAt) / 0.4, 0, 1); shadow(h.x, 80); spr(im, h.x, FLOOR + 4, fh(im), { rot: -1.2 * k * (side > 0 ? -1 : 1), flip: side > 0, alpha: clamp(h.life - h.t, 0, 1) }); return; }
  const s = h.t - h.endAt, ex = h.x < W / 2 ? -1 : 1;  // Emma runs in from the closest edge and takes him away that way
  if (s < 0.9) {
    const im = IMG.fe_fsick_0; shadow(h.x, 70); spr(im, h.x, FLOOR + 4, fh(im), { flip: side > 0 });
    const ek = s / 0.9, x = lerp(ex < 0 ? -80 : W + 80, h.x + ex * 75, ek), ei = er();
    shadow(x, 40); spr(ei, x, FLOOR + 4 - Math.abs(Math.sin(G.t * 10)) * 6, fh(ei), { flip: ex > 0 });
    text('EMMA!', x, FLOOR - 285, 10, '#ffffff', 'center', '#000', 4);
  } else {
    const im = IMG.fe_carry_0, k = (s - 0.9) / 1.9, x = lerp(h.x, ex < 0 ? -200 : W + 200, k * k);
    shadow(x, 70); spr(im, x, FLOOR + 4 - Math.abs(Math.sin(G.t * 7)) * 4, fh(im), { flip: ex < 0, rot: Math.sin(G.t * 7) * 0.03 });
    if (k < 0.5) text('TO MY ROOM!', x, FLOOR - fh(im) - 12, 10, '#fff', 'center', '#000', 4);
  }
}
function ferdyTap(f) {
  if (f.t < f.enter) return;
  f.taps++; burst(f.x, 380, '#b8f55a', 6); tone(400 + f.taps * 60, 0.08, 'square', 0.15);
  if (f.taps >= 10) { f.done = true; f.endAt = f.t; f.life = f.t + 2.9; f.saved = true; banner('emma', 'EMMA', 'TAKES FERDY TO HER ROOM', '#ffffff');
    P.bac = 0; P.hp = Math.min(P.maxhp, P.hp + 10); CARDS.forEach(c => { if (!c.once) c.t = 0; }); floatText('FERDY SAVED! BAC 0 · CARDS READY', 480, 180, '#7CFC00', 14, 1.6, -15); SFX.fanfare(); G.score += 500; }
}
function ferdyFail(f) { if (f.done) return; f.done = true; f.endAt = f.t; f.life = f.t + 1.4; f.failed = true; floatText('FERDY DOWN!', f.x, 300, '#ff5050', 18); playerHurt(15); SFX.siren(); }
function useCard(i) {
  if (G.state !== 'fight' || P.dead) return;
  const c = CARDS[i];
  if (c.t > 0 || (c.once && c.used)) { SFX.bad(); return; }
  G.friendsCalled++;
  if (c.id === 'fede') {
    banner('fede', 'FEDE', 'PEACEMAKER', '#ff4b4b'); bubble('RAGAZZI, CALMA! BASTA COSI!', 160, 160, 'ally', 1.8);
    G.enemies.forEach(e => { if (!e.ko) { e.frozen = 3.2; e.state = 'walk'; } });
    if (B.alive) { B.frozen = 3.2; if (B.state === 'windup') { B.state = 'recover'; B.t = 0; } }
    G.hazards.forEach(h => { if (h.type === 'massi') h.done = true; });
  } else if (c.id === 'ginevra') {
    c.uses++; const combo = c.uses % 2 === 0;
    banner(combo ? 'miriana' : 'ginevra', combo ? 'GINEVRA + MIRIANA' : 'GINEVRA', combo ? "RICCHIO'!!! x2" : "RICCHIO'!!!", '#ffd166');
    SFX.scream(); G.shake = 16; G.fx.push({ type: 'wave', x: P.x, y: 300, t: 0, life: 0.8 });
    bubble("RICCHIO'!!!", 170, 150, 'ally', 1.8);
    const d = combo ? 2 : 1;
    G.enemies.forEach(e => { if (!e.ko) { e.x += sgn(e.x - P.x) * 130; e.hurt = 0.3; e.hp -= d; e.state = 'walk'; if (e.hp <= 0) koEnemy(e, sgn(e.x - P.x), 'flee'); } });
    if (B.alive && B.phase > 0) { bossDamage((combo ? 4 : 2) * 100 / D.bhp, true); B.x += sgn(B.x - P.x) * 160; B.state = 'recover'; B.t = 0; }
  } else if (c.id === 'elisabetta') {
    banner('elisabetta', 'ELISABETTA', 'SPIDER WEB', '#ff3b5c');
    G.enemies.filter(e => !e.ko).sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x)).slice(0, 2).forEach(e => { e.webbed = 6; e.state = 'walk'; G.fx.push({ type: 'web', x: e.x, y: 330, t: 0, life: 6, follow: e }); });
    if (B.alive && B.phase > 0) { B.webbed = 2.5; B.state = 'stunned'; B.t = 0; B.stunDur = 2.5; G.fx.push({ type: 'web', x: B.x, y: 320, t: 0, life: 2.5, follow: B }); }
  } else if (c.id === 'christian') {
    c.used = true; banner('christian', 'CHRISTIAN', 'SARDEGNA AIR STRIKE', '#5ad1ff', 1.8);
    if (!playVoice('christian', 1.3)) bubble('ARRIVO DALLA SARDEGNA!', 780, 110, 'ally', 2);
    G.hazards.push({ type: 'plane', t: 0, life: 3 }); SFX.plane();
  }
  c.t = c.cd;
}
function updateHazards(dt) {
  for (const h of G.hazards) {
    h.t += dt;
    if (h.type === 'glass' && !h.done && h.t >= h.dur) {
      h.done = true; burst(h.tx, FLOOR - 10, '#ff9a2e', 14); burst(h.tx, FLOOR - 10, '#dff', 8, 250, 3, 0.4, 500, true); SFX.block();
      if (Math.abs(P.x - h.tx) < 70) { if (!P.block) { playerHurt(6); P.bac = Math.min(100, P.bac + 5); floatText('SPLASH!', P.x, 260, '#ff9a2e', 14); } }
    }
    if (h.type === 'massi' && !h.done) {
      if (h.t > 1.2) h.x -= h.side * 430 * dt;
      if (Math.abs(h.x - P.x) < 55) { h.done = true;
        if (P.block) { floatText('BLOCKED MASSI!', P.x, 230, '#7CFC00', 14); h.fall = 1; SFX.block(); }
        else { playerHurt(10, h.x); P.stun = 1.3; floatText('KNOCKED DOWN!', P.x, 230, '#ff5050', 16); } }
      if ((h.side < 0 && h.x > W + 80) || (h.side > 0 && h.x < -80)) h.done = true;
    }
    if (h.type === 'massi' && h.done) { h.x -= h.side * 300 * dt; if (h.x < -200 || h.x > W + 200) h.life = 0; }
    if (h.type === 'spit' && h.t > 0.6 && !h.hit) {
      h.hit = true;
      G.enemies.forEach(e => { if (!e.ko && Math.abs(e.x - h.x) < 150) { e.stunE = 3; floatText('EW!', e.x, 250, '#c8ff6b', 14); } });
      if (B.alive && B.phase >= 2 && Math.abs(B.x - h.x) < 150 && B.state !== 'windup') { B.state = 'stunned'; B.t = 0; B.stunDur = 1.6; floatText('EWWW!', B.x, 220, '#c8ff6b', 16); }
    }
    if (h.type === 'carpet' && h.t > 1.6 && !h.threw) {
      h.threw = true;
      const tgt = G.enemies.filter(e => !e.ko)[0];
      if (tgt) { tgt.hp -= 2; hitFx(tgt.x, 230, true); floatText('HEEL SHOT!', tgt.x, 210, '#2fd3c8', 14); if (tgt.hp <= 0) koEnemy(tgt, tgt.side, 'faint'); }
      else if (B.alive && B.phase > 0) { bossDamage(2 * 100 / D.bhp, true); hitFx(B.x, 230, true); floatText('HEEL SHOT!', B.x, 210, '#2fd3c8', 14); }
      for (let i = 0; i < 2; i++) G.items.push({ kind: 'heart', x: clamp(P.x + (i ? 1 : -1) * rnd(110, 190), 60, W - 60), y: 60, t: 0, got: false });
    }
    if (h.type === 'plane' && h.t > 1.1 && !h.hit) {
      h.hit = true; G.shake = 22; G.flash = 0.25; G.flashCol = '255,240,200'; SFX.boom();
      G.enemies.forEach(e => { if (!e.ko) { hitFx(e.x, 300, true); koEnemy(e, e.side, 'faint'); } });
      if (B.alive && B.phase > 0) bossDamage(8 * 100 / D.bhp, true);
      announce('PECORINO STRIKE!', 1.0, 30, '#fff6b0', '#d08a00');
    }
    if (h.type === 'ferdy' && !h.done && h.t > h.life - 0.01) ferdyFail(h);
    if (h.type === 'banana' && h.done) h.life = Math.min(h.life, h.t + 0.3);
  }
  G.hazards = G.hazards.filter(h => !(h.life !== undefined && h.t > h.life) && !(h.type === 'glass' && h.done && h.t > h.dur + 0.3));
  for (const it of G.items) { it.t += dt; it.y = Math.min(FLOOR - 26, it.y + 260 * dt); if (it.t > 10) it.got = true; }
  G.items = G.items.filter(i => !i.got);
}
const R1_SCHEDULE = [[7, 'spritz'], [12, 'glass'], [17, 'carpet'], [28, 'spit'], [33, 'puddle'], [38, 'pear'], [43, 'ferdy'], [52, 'lullaby'], [58, 'grab'],
  [64, 'shot'], [69, 'samba'], [77, 'banana'], [82, 'glass'], [92, 'spritz'], [98, 'puddle'], [104, 'glass']];
const R2_POOL = ['spritz', 'glass', 'spit', 'puddle', 'lullaby', 'grab', 'samba', 'carpet', 'banana', 'shot', 'pear', 'ferdy', 'glass', 'spritz'];

// ================================================================ flow
const INTRO = [
  { t: 'OCTOBER 30, 2026', s: 'IN-DOMUS, MILANO. A HALLOWEEN PARTY.' },
  { t: 'A BALD GUY DRESSED AS MASTRO LINDO HUGS GINEVRA.', s: '"LA TUA RAGAZZA E UNA DELLE TANTE. IO IN SERATA APPROCCIO CON TUTTE."' },
  { t: 'BLACK MASK THROWS HIS WIG ON THE FLOOR.', s: '"ADESSO IO E TE, 1 CONTRO 1. SE HAI LE PALLE."' },
  { t: '...THEN 15 OF HIS FRIENDS SHOW UP.', s: '"FRA, MA CHE VUOI FARE? SEI 1 CONTRO 15!"' },
  { how: true },
];
function startIntro() {
  setState('intro'); G.introIdx = 0; G.introT = 0;
  try { if (document.documentElement.requestFullscreen && matchMedia('(pointer:coarse)').matches) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
}
function introNext() { if (G.introT < 0.35) return; G.introIdx++; G.introT = 0; if (G.introIdx >= INTRO.length) startVs(1); }
function startVs(n) { G.round = n; setState('vs'); SFX.boom(); music('silent'); setTimeout(() => SFX.announce('prepare', false), 500); }
function startRound(n) {
  G.round = n; G.enemies = []; G.items = []; G.hazards = []; G.bubbles = []; G.banners = []; G.big = []; G.rt = 0; G.evIdx = 0; G.roundDamage = 0;
  if (n === 1) { resetPlayer(); G.r1left = 15; G.r1spawned = 0; G.spawnT = 1.5; G.startTime = performance.now(); B.alive = false; G.r1done = false;
    CARDS.forEach(c => { c.t = c.id === 'christian' ? 0 : Math.min(c.t, 8); c.used = false; }); }
  if (n === 2) { bossReset(); P.x = 300; P.hp = Math.min(P.maxhp, P.hp + 40); P.bac = Math.max(0, P.bac - 30); P.state = 'idle'; P.dead = false;
    CARDS.forEach(c => { if (c.once) c.used = false; c.t = c.once ? 0 : Math.min(c.t, 5); }); G.nextEv = 7; }
  setState('roundcard');
  music(n === 1 ? 'fight' : 'boss');
  SFX.announce(n === 1 ? 'round1' : 'finalround', true);
  setTimeout(() => { if (G.state === 'roundcard') SFX.announce('fight', false); }, 1400);
}
function gameOver() { setState('gameover'); SFX.siren(); music('title'); SFX.announce('youlose', false); }
function continueGame() { G.continues++; const keep = P.pushBonus; resetPlayer(); P.pushBonus = keep; startRound(G.round); }
function startPushup() { setState('pushup'); G.pu = { reps: 0, taps: [], slipped: false, done: false, msg: '' }; music('title'); }
function pushTap() {
  const pu = G.pu; if (pu.done) { if (G.st > 1) startVs(2); return; }
  const now = G.st; pu.taps.push(now); pu.taps = pu.taps.filter(t => now - t < 0.6);
  if (pu.taps.length >= 4 && !pu.slipped) { pu.slipped = true; pu.done = true; pu.msg = 'TOO FAST! TOMMASO HITS HIS CHIN!'; SFX.siren(); P.hp = Math.max(10, P.hp - 10); G.shake = 14; return; }
  const ph = (now % 0.75) / 0.75;
  if (ph > 0.7 || ph < 0.15) { pu.reps++; tone(500 + pu.reps * 20, 0.08, 'square', 0.15); floatText('REP ' + pu.reps, 480, 300, '#b8f55a', 16, 0.5); }
  else floatText('OFF BEAT', 480, 300, '#ff9a2e', 12, 0.4);
}
function startFinish() { setState('finish'); G.hazards = []; G.items = []; P.held = 0; P.nunchaku = 0; G.finTaps = 0; B.state = 'dizzy'; G.enemies.forEach(e => { if (!e.ko) koEnemy(e, e.side, 'flee'); }); SFX.announce('finishhim', true); announce('FINISH HIM!', 3, 50, '#ffd0d0', '#c00000'); }
function finishTap() {
  G.finTaps++; hitFx(B.x + rnd(-30, 30), rnd(220, 340), G.finTaps % 3 === 0); SFX.punch();
  if (G.finTaps >= 8 && G.state === 'finish') {
    setState('fatality'); G.big = []; G.flash = 0.6; G.flashCol = '255,255,255'; G.shake = 26; G.slowmo = 1.5; SFX.boom(); B.lying = 1; B.x = clamp(P.x + sgn(B.x - P.x) * 150, 70, W - 70); if (Math.abs(B.x - P.x) < 120) { P.x = clamp(B.x - sgn(B.x - P.x || 1) * 150, 70, W - 70); }
    setTimeout(() => { SFX.announce('fatality', true); announce('FATALITY', 2.2, 64, '#ffb0b0', '#b00000'); }, 500);
    setTimeout(() => { if (G.state === 'fatality') { setState('apology'); music('win'); } }, 3000);
  }
}
function startEnding() { setState('ending'); G.endStage = 0; G.endT = 0; SFX.fanfare(); G.confetti = []; music('win'); SFX.announce(G.roundDamage === 0 ? 'flawless' : 'winner', false); }
function endingTap() {
  if (G.endT < 1) return;
  if (G.endStage < 2) { G.endStage++; G.endT = 0; return; }
  if (G.endStage === 2 && G.endT > 4) { G.endStage = 3; G.endT = 0; return; }
  if (G.endStage === 3) { setState('title'); music('title'); Object.assign(G, { score: 0, kos: 0, maxCombo: 0, friendsCalled: 0, continues: 0, bacPeak: 0 }); P.pushBonus = 0; }
}

// ================================================================ update
function update(dtReal) {
  let dt = dtReal;
  if (G.slowmo > 0) { G.slowmo -= dtReal; dt *= 0.35; }
  G.t += dtReal; G.st += dtReal;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dtReal * 40);
  if (G.flash > 0) G.flash -= dtReal;
  if (G.zoom > 0) G.zoom = Math.max(0, G.zoom - dtReal * 0.25);
  for (const p of G.particles) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const t of G.texts) { t.life -= dtReal; t.y += t.vy * dtReal; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const b of G.bubbles) b.life -= dtReal; G.bubbles = G.bubbles.filter(b => b.life > 0);
  for (const b of G.banners) b.life -= dtReal; G.banners = G.banners.filter(b => b.life > 0);
  for (const b of G.big) b.life -= dtReal; G.big = G.big.filter(b => b.life > 0);
  for (const f of G.fx) { f.t += dt; if (f.follow) f.x = f.follow.x; } G.fx = G.fx.filter(f => f.t < f.life);

  const s = G.state;
  if (s === 'loading') { if (pending <= 0 && G.st > 0.6) { loadedAll = true; buildArena(); setState('title'); } return; }
  if (s === 'intro') { G.introT += dtReal; return; }
  if (s === 'vs') { if (G.st > 3.2) startRound(G.round); return; }
  if (s === 'roundcard') { if (G.st > 2.6) { setState('fight'); bubble(G.round === 1 ? pick(PLAYER_LINES) : 'SEI UN PELATO DI MERDA!', P.x, 150, 'player', 2); } return; }
  if (s === 'pushup') { if (!G.pu.done && G.st > 10) { G.pu.done = true; P.pushBonus = Math.min(0.3, G.pu.reps * 0.02); G.pu.msg = `${G.pu.reps} PUSH-UPS! +${Math.round(P.pushBonus * 100)}% POWER`; SFX.fanfare(); } return; }
  if (s === 'apology') {
    if (G.st > 1.0 && !G.ap1) { G.ap1 = true; bubble('SENTI FRA... NON SAPEVO CHE ERA LA TUA RAGAZZA. SCUSA.', B.x, 330, 'boss', 3.5); }
    if (G.st > 3.8 && !G.ap2) { G.ap2 = true; bubble('VA BENE FRA. BASTA CHE NON FAI LO SPLENDIDO CON ME.', P.x, 150, 'player', 3.5); }
    if (G.st > 6.8 && !G.ap3) { G.ap3 = true; SFX.boom(); G.shake = 12; }
    if (G.st > 11) { G.ap1 = G.ap2 = G.ap3 = false; startEnding(); }
    P.state = 'idle'; return;
  }
  if (s === 'ending') { G.endT += dtReal; if (Math.random() < 0.6) G.confetti.push({ x: rnd(0, W), y: -10, vy: rnd(60, 140), vx: rnd(-30, 30), c: pick(['#1ec8ff', '#ff4bd8', '#ffe36b', '#7CFC00', '#ff9a2e']), r: rnd(0, 6) }); for (const c of G.confetti) { c.y += c.vy * dtReal; c.x += c.vx * dtReal; c.r += dtReal * 4; } G.confetti = G.confetti.filter(c => c.y < H + 20); return; }
  if (s === 'gameover') return;
  if (s === 'finish' || s === 'fatality') { updatePlayer(dt * 0.0); return; }
  if (s !== 'fight') return;
  if (G.hitstop > 0) { G.hitstop -= dtReal; return; }

  G.rt += dt;
  updatePlayer(dt);
  CARDS.forEach(c => { if (!c.once && c.t > 0) c.t -= dt; });
  if (G.round === 1) {
    G.spawnT -= dt;
    const active = G.enemies.filter(e => !e.ko).length;
    const maxA = G.rt < 20 ? 2 : G.rt < 50 ? 3 : 4;
    if (G.spawnT <= 0 && G.r1spawned < 15 && active < maxA) {
      spawnEnemy(G.r1spawned % 2 === 0 ? 1 : (Math.random() < 0.5 ? -1 : 1), { hp: G.r1spawned < 3 ? 2 : G.r1spawned < 9 ? 3 : 4, fast: G.rt > 50 ? 1.2 : 1 });
      G.r1spawned++; G.spawnT = G.rt < 30 ? rnd(4, 5.5) : rnd(2.8, 4.2);
    }
    while (G.evIdx < R1_SCHEDULE.length && G.rt >= R1_SCHEDULE[G.evIdx][0]) { EVENTS[R1_SCHEDULE[G.evIdx][1]](); G.evIdx++; }
    if (G.r1left <= 0 && G.enemies.filter(e => !e.ko).length === 0 && !G.r1done) {
      G.r1done = true; announce(G.roundDamage === 0 ? 'FLAWLESS!' : 'ALL 15 DOWN!', 2, 40); SFX.announce(G.roundDamage === 0 ? 'flawless' : 'youwin', false); SFX.fanfare();
      setTimeout(() => { if (G.state === 'fight') startPushup(); }, 2400);
    }
    if (Math.random() < dt / 9) bubble(pick(TAUNTS), Math.random() < 0.5 ? 140 : 820, 170, 'enemy', 1.6);
    if (Math.random() < dt / 14) bubble(pick(PLAYER_LINES), P.x, 150, 'player', 1.8);
  } else {
    G.nextEv -= dt;
    if (G.nextEv <= 0) { G.nextEv = rnd(8, 12); EVENTS[R2_POOL[G.evIdx % R2_POOL.length]](); G.evIdx++; }
    updateBoss(dt);
  }
  updateEnemies(dt);
  updateHazards(dt);
}

// ================================================================ arena (procedural fallback)
let ARENA = null;
function buildArena() {
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  const g = c.getContext('2d'); g.scale(2, 2);
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  // sky
  let gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#04040c'); gr.addColorStop(1, '#1b0f30');
  g.fillStyle = gr; g.fillRect(0, 0, W, 320);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${rng() * 0.7})`; g.fillRect(rng() * W, rng() * 170, 1.5, 1.5); }
  // moon
  const mg = g.createRadialGradient(780, 60, 5, 780, 60, 90); mg.addColorStop(0, 'rgba(220,230,255,.35)'); mg.addColorStop(1, 'rgba(220,230,255,0)');
  g.fillStyle = mg; g.fillRect(680, -40, 200, 200);
  g.fillStyle = '#eef2ff'; g.beginPath(); g.arc(780, 60, 22, 0, 7); g.fill(); g.fillStyle = '#1b1430'; g.beginPath(); g.arc(790, 54, 20, 0, 7); g.fill();
  // far skyline
  for (let x = -20; x < W; x += 40 + rng() * 50) {
    const bw = 40 + rng() * 70, bh = 80 + rng() * 140; g.fillStyle = '#0b0b1a'; g.fillRect(x, 260 - bh, bw, bh + 40);
    for (let wy = 270 - bh; wy < 285; wy += 12) for (let wx = x + 5; wx < x + bw - 6; wx += 10) if (rng() < 0.28) { g.fillStyle = rng() < 0.7 ? 'rgba(255,200,120,.55)' : 'rgba(120,200,255,.5)'; g.fillRect(wx, wy, 5, 6); }
  }
  // main building (In-Domus)
  gr = g.createLinearGradient(0, 120, 0, 400); gr.addColorStop(0, '#191a2c'); gr.addColorStop(1, '#0d0d18');
  g.fillStyle = gr; g.fillRect(0, 150, W, 260);
  // upper floors windows
  for (let fl = 0; fl < 3; fl++) for (let i = 0; i < 16; i++) {
    const x = 18 + i * 60, y = 165 + fl * 42; const lit = rng();
    g.fillStyle = '#05050b'; g.fillRect(x - 2, y - 2, 40, 30);
    g.fillStyle = lit < 0.35 ? '#ffb257' : lit < 0.5 ? '#7fc8ff' : '#151628'; g.fillRect(x, y, 36, 26);
    if (lit < 0.5) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, 36, 6); }
  }
  // ground floor party windows with Halloween light
  for (let i = 0; i < 8; i++) {
    const x = 10 + i * 120, y = 300;
    const pg = g.createLinearGradient(0, y, 0, y + 90); pg.addColorStop(0, i % 2 ? '#ff8a2a' : '#c040ff'); pg.addColorStop(1, '#3a1040');
    g.fillStyle = '#05050a'; g.fillRect(x - 4, y - 4, 108, 98); g.fillStyle = pg; g.fillRect(x, y, 100, 90);
    // bunting
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#111' : '#ff7a1a'; g.beginPath(); g.moveTo(x + 4 + k * 16, y + 4); g.lineTo(x + 18 + k * 16, y + 4); g.lineTo(x + 11 + k * 16, y + 18); g.fill(); }
    // silhouettes dancing inside
    for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(20,0,30,.65)'; const sx = x + 15 + k * 30 + rng() * 8; g.beginPath(); g.arc(sx, y + 52, 7, 0, 7); g.fill(); g.fillRect(sx - 8, y + 58, 16, 32); }
    // pumpkin
    if (i % 3 === 1) { g.fillStyle = '#ff8a1a'; g.beginPath(); g.ellipse(x + 80, y + 78, 11, 9, 0, 0, 7); g.fill(); g.fillStyle = '#2a1000'; g.fillRect(x + 75, y + 75, 3, 3); g.fillRect(x + 83, y + 75, 3, 3); }
  }
  // canopy
  g.fillStyle = '#07070f'; g.fillRect(0, 286, W, 14); g.fillStyle = 'rgba(255,120,255,.25)'; g.fillRect(0, 298, W, 2);
  // neon sign
  g.save(); g.shadowColor = '#ff3df2'; g.shadowBlur = 18; g.font = `22px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#ffd0fb'; g.fillText('IN-DOMUS', 300, 278); g.restore();
  g.save(); g.shadowColor = '#31e6ff'; g.shadowBlur = 14; g.font = `10px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#c8f8ff'; g.fillText('HALLOWEEN PARTY', 300, 256); g.restore();
  // plane stuck in the facade
  if (IMG.plane.width) { g.save(); g.globalAlpha = 0.9; const pw = 360, ph = pw * IMG.plane.height / IMG.plane.width; g.drawImage(IMG.plane, 470, 95, pw, ph); g.restore(); }
  // street
  gr = g.createLinearGradient(0, 400, 0, H); gr.addColorStop(0, '#1a1726'); gr.addColorStop(1, '#07060c');
  g.fillStyle = gr; g.fillRect(0, 395, W, H - 395);
  g.fillStyle = '#2a2638'; g.fillRect(0, 395, W, 6);
  // cobblestones in perspective
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1;
  for (let r = 0; r < 9; r++) { const y = 405 + r * r * 1.7 + r * 6; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    const step = 26 + r * 9; for (let x = (r % 2) * step / 2; x < W; x += step) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x - W / 2) * 0.06, y + 8 + r * 3); g.stroke(); } }
  // neon reflections on wet ground
  for (let i = 0; i < 8; i++) { const x = 60 + i * 120; const rg = g.createLinearGradient(0, 400, 0, 540); rg.addColorStop(0, i % 2 ? 'rgba(255,140,40,.22)' : 'rgba(200,70,255,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - 30, 400, 60, 140); }
  ARENA = c;
}
function drawArena(dark = 0) {
  const ex = OPTIONAL[G.round === 2 && OPTIONAL.arena_boss && OPTIONAL.arena_boss.width ? 'arena_boss' : 'arena'];
  if (ex && ex.width) {
    const s = Math.max(W / ex.width, H / ex.height); const w = ex.width * s, h = ex.height * s;
    ctx.drawImage(ex, (W - w) / 2, H - h, w, h);
    if (G.round === 2 && !(OPTIONAL.arena_boss && OPTIONAL.arena_boss.width)) { ctx.fillStyle = 'rgba(40,0,25,.32)'; ctx.fillRect(0, 0, W, H); }
  } else if (ARENA) ctx.drawImage(ARENA, 0, 0, W, H);
  // animated layers: fog, smoke, ambulance lights
  const on = Math.floor(G.t * 4) % 2;
  (ex && ex.width ? [[765, 232, on ? '#3d7bff' : '#ff3b3b'], [932, 236, on ? '#ff3b3b' : '#3d7bff'], [728, 318, on ? '#ff2020' : '#550000'], [842, 318, on ? '#550000' : '#ff2020']] : [[880, 380, on ? '#3d7bff' : '#ff3b3b'], [925, 384, on ? '#ff3b3b' : '#3d7bff']]).forEach(([x, y, c]) => { const g = ctx.createRadialGradient(x, y, 1, x, y, 60); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.35; ctx.fillStyle = g; ctx.fillRect(x - 60, y - 60, 120, 120); ctx.globalAlpha = 1; });
  for (let i = 0; i < 3; i++) { const fx = ((G.t * (12 + i * 6) + i * 400) % (W + 600)) - 300; const fg = ctx.createRadialGradient(fx, 440 - i * 20, 10, fx, 440 - i * 20, 260); fg.addColorStop(0, 'rgba(170,150,220,.10)'); fg.addColorStop(1, 'rgba(170,150,220,0)'); ctx.fillStyle = fg; ctx.fillRect(fx - 260, 180, 520, 360); }
  if (dark) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, W, H); }
}

// ================================================================ drawing
function drawBubble(b) {
  const alpha = Math.min(1, b.life / 0.25, (b.max - b.life) / 0.12 + 0.2);
  const size = 10, lines = wrap(b.str, 300, size);
  ctx.font = `${size}px ${FONT}`;
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22, h = lines.length * 16 + 16;
  const x = clamp(b.x - w / 2, 6, W - w - 6), y = b.y - h;
  const col = { enemy: '#ffffff', player: '#9ff3ff', boss: '#ffb3f0', ally: '#fff3a8', warn: '#ff5050' }[b.who] || '#fff';
  ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#0b0b16'; ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  const tx = clamp(b.x, x + 12, x + w - 12); ctx.beginPath(); ctx.moveTo(tx - 8, y + h); ctx.lineTo(tx, y + h + 12); ctx.lineTo(tx + 8, y + h); ctx.fill();
  lines.forEach((l, i) => text(l, x + w / 2, y + 16 + i * 16, size, b.who === 'warn' ? '#ff8080' : col, 'center', null));
  ctx.restore();
}
function drawCard(id, x, y, size, border = '#fff', key) {
  const im = IMG[key || ('card_' + id)];
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, size + 6, size + 6);
  if (im && im.width) { const s = Math.max(size / im.width, size / im.height), w = im.width * s, h = im.height * s; ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip(); ctx.drawImage(im, x + (size - w) / 2, y + (size - h) / 2, w, h); }
  ctx.restore(); ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
}
function mkBar(x, y, w, h, v, col, right = false, ghost = v) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const gb = ctx.createLinearGradient(0, y, 0, y + h); gb.addColorStop(0, '#5a0000'); gb.addColorStop(1, '#2a0000');
  ctx.fillStyle = gb; ctx.fillRect(x, y, w, h);
  const fw = w * clamp(v, 0, 1);
  const gf = ctx.createLinearGradient(0, y, 0, y + h); gf.addColorStop(0, '#ffffff'); gf.addColorStop(0.25, col); gf.addColorStop(1, col);
  ctx.fillStyle = gf; ctx.fillRect(right ? x + w - fw : x, y, fw, h);
  ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
}
function drawGlass(x, y, red = false) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = red ? '#ff3b3b' : '#ff9a2e';
  ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(12, -18); ctx.lineTo(9, 16); ctx.lineTo(-9, 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-8, -13, 3, 22);
  if (red) text('x3', 0, 0, 8, '#fff', 'center', '#000', 3);
  ctx.restore();
}
// ---------- pixel-art pickups (drawn once on tiny canvases, scaled with nearest neighbour)
const PIX = {};
function pixCanvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const p = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); }; fn(p, g); return c; }
PIX.spritz = pixCanvas(22, 30, (p, g) => {
  const cx = 11, K = '#1a1020';
  for (let y = 5; y <= 15; y++) {
    const hw = Math.round(9 - Math.pow(y - 5, 2) / 14);
    for (let x = cx - hw; x < cx + hw; x++) {
      let c = y < 8 ? '#ffb347' : y < 12 ? '#ff7a1a' : '#e0520c';
      if (x === cx - hw + 1) c = '#ffe2b8'; if (x === cx - hw + 2 && y > 6) c = '#ffc98a';
      if (x >= cx + hw - 2) c = y < 10 ? '#e86812' : '#b8400a';
      if (y === 5) c = (x % 3 === 0) ? '#fff4d6' : '#ffd9a0';
      p(x, y, c);
    }
    p(cx - hw - 1, y, K); p(cx + hw, y, K);
  }
  for (let x = cx - 9; x <= cx + 9; x++) p(x, 4, (x === cx - 9 || x === cx + 9) ? K : '#d8f0ff');
  for (let x = cx - 3; x <= cx + 3; x++) p(x, 16, K);
  [[5, 8], [10, 10], [7, 12]].forEach(([x, y]) => { g.fillStyle = '#eaf8ff'; g.fillRect(x, y, 3, 3); p(x, y, '#ffffff'); p(x + 2, y + 2, '#a8d8f0'); });
  [[13, 7], [15, 9], [12, 13], [9, 6], [14, 12]].forEach(([x, y]) => p(x, y, '#fff0c8'));
  for (let i = 0; i < 13; i++) p(17 - Math.round(i * 0.45), i, i % 2 ? '#ff2d55' : '#ffffff');
  g.fillStyle = '#ff8c00'; g.beginPath(); g.arc(3.5, 5.5, 3.5, 0, 7); g.fill(); g.fillStyle = '#ffc94a'; g.beginPath(); g.arc(3.5, 5.5, 2.3, 0, 7); g.fill(); p(3, 5, '#fff3c0'); p(4, 6, '#fff3c0'); p(2, 4, '#fff3c0');
  for (let y = 17; y <= 24; y++) { p(cx - 1, y, '#d8f0ff'); p(cx, y, '#a8cce6'); p(cx - 2, y, K); p(cx + 1, y, K); }
  for (let x = cx - 6; x <= cx + 5; x++) { p(x, 25, '#d8f0ff'); p(x, 26, K); } p(cx - 7, 25, K); p(cx + 6, 25, K); for (let x = cx - 4; x <= cx + 3; x++) p(x, 24, K);
});
PIX.shot = pixCanvas(12, 15, (p, g) => {
  const K = '#1a1020';
  for (let y = 1; y <= 12; y++) { const l = 1 + Math.floor(y / 6), r = 10 - Math.floor(y / 6); p(l, y, K); p(r, y, K); for (let x = l + 1; x < r; x++) p(x, y, y < 4 ? '#e8f6ff' : (x === l + 1 ? '#fff6dc' : x >= r - 1 ? '#c98a1a' : '#f2b440')); }
  for (let x = 1; x <= 10; x++) p(x, 0, '#d8f0ff'); for (let x = 2; x <= 9; x++) { p(x, 13, '#d8f0ff'); p(x, 14, K); }
  p(4, 5, '#ffffff'); p(6, 8, '#ffe9a8');
});
PIX.pear = pixCanvas(16, 20, (p, g) => {
  const K = '#24330f';
  const inside = (x, y) => Math.hypot((x - 8) / 6.2, (y - 13) / 6) < 1 || Math.hypot((x - 8) / 3.6, (y - 6.5) / 4) < 1;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 16; x++) {
    if (inside(x, y)) { let c = '#a6e04a'; if (x < 7 && y < 13) c = '#d4ff8a'; if (x > 10 || y > 16) c = '#6fae22'; if (x === 5 && y >= 8 && y <= 12) c = '#f2ffd0'; p(x, y, c); }
    else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) p(x, y, K);
  }
  p(8, 1, '#6b3d1e'); p(8, 0, '#6b3d1e'); p(9, 0, '#6b3d1e'); p(10, 1, '#2f9e3a'); p(11, 1, '#2f9e3a'); p(11, 2, '#2f9e3a'); p(12, 1, '#1f7a2a');
});
PIX.spit = pixCanvas(7, 10, (p) => { const m = ['..aa...', '.abba..', '.abbba.', 'abbbbba', 'abbcbba', 'abbbbba', 'abbbbba', '.abbba.', '..aaa..', '.......']; m.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') p(x, y, { a: '#4f7a2a', b: '#cfff9a', c: '#ffffff' }[c]); })); });
PIX.peel = pixCanvas(18, 8, (p) => { const m = ['........kk........', '.......kyyk.......', '..kk..kyyyyk..kk..', '.kyyk.kyyyyk.kyyk.', 'kyyyykyywyyykyyyyk', 'kyyyyyyyyyyyyyyyyk', '.kkbyyyyyyyyyybkk.', '...kkkkkkkkkkkk...']; m.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') p(x, y, { k: '#4a3510', y: '#ffe14a', w: '#fff6c0', b: '#8a6a1a' }[c]); })); });
PIX.pecorino = pixCanvas(16, 10, (p) => { const m = ['...kkkkkkkkkk...', '.kkwwwwwwwwwwkk.', 'kwwwwwwwwwwwwwwk', 'kbwwwwwwwwwwwwbk', 'kbbbwwwwwwwwbbbk', 'kybbbbbbbbbbbbyk', 'kyyyyyyyyyyyyyyk', 'kyyyyyyyyyyyyyyk', '.kkyyyyyyyyyykk.', '...kkkkkkkkkk...']; m.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') p(x, y, { k: '#5a3a10', w: '#fff3cc', b: '#e8d49a', y: '#d9a441' }[c]); })); });
PIX.heart = pixCanvas(11, 10, (p) => { const m = ['.kk...kk...', 'krrk.krrk..', 'krwrkrrrrk.', 'krrrrrrrrk.', 'krrrrrrrrk.', '.krrrrrrk..', '..krrrrk...', '...krrk....', '....kk.....', '...........']; m.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') p(x, y, { k: '#3a0a18', r: '#ff3d7f', w: '#ffd0e0' }[c]); })); });
function drawPix(c, x, y, scale) { ctx.imageSmoothingEnabled = false; ctx.drawImage(c, Math.round(x - c.width * scale / 2), Math.round(y - c.height * scale), c.width * scale, c.height * scale); ctx.imageSmoothingEnabled = true; }
function drawItem(it) {
  const bob = it.y >= FLOOR - 26 ? Math.sin(G.t * 5 + it.x) * 3 : 0, y = it.y + bob;
  ctx.save();
  if (it.kind !== 'heart') { const gc = it.kind === 'pear' ? '184,245,90' : '255,170,60', gl = ctx.createRadialGradient(it.x, y + 4, 2, it.x, y + 4, 46); gl.addColorStop(0, `rgba(${gc},${0.35 + 0.15 * Math.sin(G.t * 6)})`); gl.addColorStop(1, `rgba(${gc},0)`); ctx.fillStyle = gl; ctx.fillRect(it.x - 46, y - 42, 92, 92);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(it.x, FLOOR - 1, 18, 4, 0, 0, 7); ctx.fill(); }
  if (it.kind === 'spritz') drawPix(PIX.spritz, it.x, y + 26, 3);
  else if (it.kind === 'shot') { drawPix(PIX.shot, it.x, y + 26, 3); text('x3', it.x + 22, y - 10, 8, '#ffe36b', 'center', '#000', 3); }
  else if (it.kind === 'pear') drawPix(PIX.pear, it.x, y + 26, 3);
  else if (it.kind === 'heart') { ctx.shadowColor = '#ff3d7f'; ctx.shadowBlur = 14; drawPix(PIX.heart, it.x, y + 14, 3); }
  ctx.restore();
}
function drawEnemy(e) {
  let pose = e.state === 'punch' ? 'punch' : e.state === 'windup' ? 'windup' : 'walk', o = { h: HEIGHT.hench * e.scale };
  const face = e.x < P.x ? 1 : -1;
  if (e.hurt > 0 && !e.ko) { pose = 'hit'; o.white = e.hurt > 0.15 ? 0.6 : 0; }
  if (e.guard > 0 && !e.ko) pose = 'block';
  if (e.ko) {
    o.alpha = clamp(2.6 - e.kt, 0, 1);
    if (e.koType === 'flee') { pose = 'flee'; drawActor('hench', pose, e.x, e.koDir, o, e.kt, 0); return; }
    pose = 'ko'; if (e.koType === 'sorry' && e.kt < 1.5) { pose = 'block'; o.sy = 0.75; }
  }
  if (e.dance > 0) { o.rot = Math.sin(G.t * 10 + e.x) * 0.15; o.lunge = Math.sin(G.t * 8) * 8; }
  if (e.sleep > 0) o.rot = -0.12;
  if (e.state === 'windup' && !e.ko) { o.glow = '#ff2020'; o.glowSize = 16 + 10 * Math.sin(G.t * 30); o.lunge = -8; }
  if (e.state === 'punch') o.lunge = 18;
  drawActor('hench', pose, e.x, face, o, e.t, pose === 'punch' ? e.t / 0.25 : pose === 'ko' ? e.kt / 0.6 : 0);
  if (!e.ko) {
    const top = FLOOR - HEIGHT.hench * e.scale - 12;
    if (e.state === 'windup') text('!', e.x, top - 6, 22, '#ff3030', 'center', '#000', 5);
    if (e.frozen > 0) text('PEACE ✌', e.x, top, 10, '#ff8080', 'center', '#000', 4);
    if (e.sleep > 0) text('Zzz', e.x + 20, top - (G.t % 1) * 15, 14, '#d0b3ff', 'center', '#000', 4);
    if (e.stunE > 0) text('EW!', e.x, top, 12, '#c8ff6b', 'center', '#000', 4);
    if (e.dance > 0) text('♪', e.x + Math.sin(G.t * 5) * 20, top, 18, '#21c45a', 'center', '#000', 4);
    for (let i = 0; i < e.hp; i++) { ctx.fillStyle = '#ff4b4b'; ctx.fillRect(e.x - 18 + i * 10, top + 14, 7, 4); }
  } else if (e.koType === 'faint' && e.kt > 0.4) text('Z', e.x, FLOOR - 50 - (e.kt % 1) * 20, 12, '#fff', 'center', '#000', 3);
}
function drawBoss() {
  if (!B.alive && !['apology', 'fatality', 'finish'].includes(G.state)) return;
  let pose = 'idle', o = {};
  if (B.state === 'windup') { pose = B.atk === 'hug' ? 'hug' : B.atk === 'hay' ? 'windup' : 'idle'; const k = Math.min(1, B.t / B.windup); o.lunge = B.atk === 'hug' ? -6 * k : -14 * k; if (B.atk === 'hay') o.white = (Math.sin(G.t * 40) > 0 ? 0.3 : 0) * k; }
  if (B.state === 'strike') { pose = B.atk === 'hug' ? 'hug' : B.atk === 'hay' ? 'kick' : 'punch'; o.lunge = 26; }
  if (pose === 'idle' && (B.mv || 0) > 40 && !B.lying && !['stunned', 'dizzy', 'sleep', 'dance'].includes(B.state)) pose = 'walk';
  if (B.hitT > 0) { pose = 'hit'; o.white = B.hitT > 0.15 ? 0.6 : 0; }
  if (['stunned', 'dizzy'].includes(B.state)) { pose = 'hit'; o.rot = Math.sin(G.t * 8) * 0.06; }
  if (B.state === 'dance') { o.rot = Math.sin(G.t * 10) * 0.15; }
  if (B.state === 'sleep') o.rot = -0.1;
  if (B.lying) pose = 'ko';
  if (G.state === 'apology') { pose = G.st < 1.6 ? 'sorry' : 'apology'; o.glow = null; }
  o.glow = B.phase === 3 ? '#ff2030' : '#ff4bd8'; o.glowSize = B.state === 'windup' ? 34 : 18;
  if (B.state === 'hide') o.alpha = 0.85;
  const bprog = pose === 'windup' ? B.t / (B.windup || 1) : pose === 'punch' ? B.t / 0.22 : pose === 'ko' ? (G.state === 'fatality' ? G.st / 0.8 : 1) : 0;
  drawActor('ml', pose, B.x, B.face, o, G.t, bprog);
  const top = FLOOR - HEIGHT.ml - 14;
  if (B.state === 'windup' && !B.lying) {
    const lbl = { punch: 'JAB', hay: 'HAYMAKER! BLOCK!', hug: 'HUG! HIT HIM!' }[B.atk];
    text(lbl, B.x, top - 16, B.atk === 'punch' ? 10 : 12, B.atk === 'hay' ? '#ff3030' : B.atk === 'hug' ? '#ff9ad8' : '#fff', 'center', '#000', 4);
    const k = Math.min(1, B.t / B.windup); ctx.fillStyle = '#000'; ctx.fillRect(B.x - 40, top - 4, 80, 6); ctx.fillStyle = B.atk === 'hay' ? '#ff3030' : '#ffb3f0'; ctx.fillRect(B.x - 40, top - 4, 80 * k, 6);
  }
  if (B.state === 'guard') text('GUARD', B.x, top, 9, '#9b9bff', 'center', '#000', 3);
  if (['recover', 'stunned', 'exposed'].includes(B.state)) text(B.state === 'exposed' ? 'EXPOSED!' : 'OPEN!', B.x, top, 11, '#7CFC00', 'center', '#000', 4);
  if (B.state === 'sleep') text('Zzz', B.x + 20, top - (G.t % 1) * 15, 16, '#d0b3ff', 'center', '#000', 4);
  if (['dizzy', 'stunned'].includes(B.state) && !B.lying) for (let i = 0; i < 3; i++) { const a = G.t * 5 + i * 2.1; text('★', B.x + Math.cos(a) * 30, top + 10 + Math.sin(a) * 8, 12, '#ffe36b', 'center', null); }
}
function drawPlayer() {
  let pose = P.state, o = {}, prog = 0;
  if (P.state === 'punch' || P.state === 'kick') { prog = P.st / ATK[P.state].end; if (P.state === 'punch' && P.punchAlt) pose = 'punchb'; }
  if (P.state === 'walk') pose = (P.mv === P.face) ? 'walk' : 'walkb';
  if (P.nunchaku > 0 && !['punch', 'kick', 'hit', 'stun'].includes(P.state) && getAnim('bm', 'nunchaku')) pose = 'nunchaku';
  if (P.hurtT > 0) o.white = P.hurtT > 0.18 ? 0.55 : 0;
  if (P.state === 'punch' || P.state === 'kick') { const a = ATK[P.state]; const k = P.st < a.active ? 1 : clamp(1 - (P.st - a.active) / (a.end - a.active), 0, 1); o.lunge = (P.state === 'kick' ? 10 : 14) * k; }
  if (P.slip > 0) { o.rot = -0.5 * Math.min(1, (1.1 - P.slip) * 4); }
  o.rot = (o.rot || 0) + Math.sin(G.t * 2.2) * 0.05 * (P.bac / 100);
  o.glow = P.nunchaku > 0 ? '#3fe6ff' : '#1ec8ff'; o.glowSize = P.nunchaku > 0 ? 34 : 14;
  if (P.drinkAt && G.t - P.drinkAt < 0.8 && ['idle', 'walk', 'walkb'].includes(pose)) pose = 'drink';
  if (P.dead) { pose = 'ko'; prog = Math.min(1, (G.t - (P.koAt || G.t)) / 0.7); }
  if (G.state === 'apology' || G.state === 'ending') pose = 'victory';
  drawActor('bm', pose, P.x, P.face, o, G.t, prog);
  if (P.ferdy > 0) drawActor('bm', pose, P.x + 14 * Math.sin(G.t * 3), P.face, { alpha: 0.3, noShadow: true }, G.t, prog);
  if (P.nunchaku > 0 && !getAnim('bm', 'nunchaku')) { ctx.save(); ctx.translate(P.x, 280); ctx.rotate(G.t * 22); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(110, 0); ctx.stroke(); ctx.fillStyle = '#7a4b2a'; ctx.fillRect(-125, -7, 36, 14); ctx.fillRect(89, -7, 36, 14); ctx.restore(); }
  // attack swoosh
  if ((P.state === 'punch' || P.state === 'kick') && P.st > ATK[P.state].start * 0.6 && P.st < ATK[P.state].active + 0.05) {
    const y = P.state === 'kick' ? 300 : 250, x = P.x + P.face * (P.state === 'kick' ? 95 : 85);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(140,230,255,.8)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x - P.face * 40, y, 48, P.face > 0 ? -0.9 : Math.PI - 0.9 + 1.8 - 1.8, P.face > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); ctx.restore();
  }
  if (P.block) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(80,200,255,.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(P.x + P.face * 40, 300, 34, 120, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  if (P.held > 0) { text('HELD! MASH THE BUTTONS!', P.x, 150, 12, '#ff5050', 'center', '#000', 5); drawChar('hench', 'walk', P.x - P.face * 40, P.face, { alpha: 0.75, filter: 'brightness(1.6) sepia(0.6)', noShadow: true }); ctx.fillStyle = '#000'; ctx.fillRect(P.x - 80, 165, 160, 10); ctx.fillStyle = '#7CFC00'; ctx.fillRect(P.x - 80, 165, 160 * P.heldTaps / 12, 10); }
  if (P.stun > 0) text('★ ★ ★', P.x, FLOOR - HEIGHT.bm - 10, 12, '#ffe36b', 'center', '#000', 3);
}
function drawHazards() {
  for (const h of G.hazards) {
    if (h.type === 'puddle') { const a = Math.min(1, h.t / 0.6) * (h.t > h.life - 0.5 ? (h.life - h.t) / 0.5 : 1); ctx.save(); ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#ff8a1e'; ctx.beginPath(); ctx.ellipse(h.x, FLOOR + 4, 75, 11, 0, 0, 7); ctx.fill(); ctx.globalAlpha = a; text('SPRITZ PUDDLE', h.x, FLOOR + 26, 8, '#ffcf8a', 'center', '#000', 3); ctx.restore(); }
    if (h.type === 'glass' && !h.done) {
      const k = h.t / h.dur, sx = h.from < 0 ? -40 : W + 40; const x = lerp(sx, h.tx, k), y = lerp(200, FLOOR - 20, k) - Math.sin(k * Math.PI) * 160;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k * 12); drawPix(PIX.spritz, 0, 40, 2.4); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.4 + 0.5 * Math.sin(G.t * 20); ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.tx, FLOOR + 4, 50, 9, 0, 0, 7); ctx.stroke(); ctx.restore();
    }
    if (h.type === 'massi') { drawChar('hench', h.fall ? 'ko' : 'walk', h.x, -h.side, { h: 230, rot: h.fall ? 0 : Math.sin(G.t * 8) * 0.18, filter: 'sepia(1) saturate(3) hue-rotate(40deg) brightness(1.2)' }); text('MASSIMILIANO', h.x, FLOOR - 250, 9, '#ffe36b', 'center', '#000', 4); if (!h.done && h.t < 1.2) text(h.side < 0 ? '◀ BLOCK!' : 'BLOCK! ▶', h.side < 0 ? 110 : 850, 250, 14, '#ff5050', 'center', '#000', 5); }
    if (h.type === 'spit') { const wi = IMG.win_daniele, wx = clamp(h.x, 110, W - 110), pop = easeOut(clamp(h.t / 0.22, 0, 1)) * clamp((h.life - h.t) / 0.25, 0, 1), wy = lerp(-250, 0, pop);
      if (wi.width) { const ww = wi.width, wh = wi.height; ctx.fillStyle = '#2a2530'; ctx.fillRect(wx - ww / 2 - 9, wy - 4, ww + 18, wh + 14); ctx.fillStyle = '#6d6676'; ctx.fillRect(wx - ww / 2 - 14, wy + wh + 2, ww + 28, 9); ctx.drawImage(wi, wx - ww / 2, wy, ww, wh); }
      for (let i = 0; i < 6; i++) { const k = clamp((h.t - 0.15) / 0.45 - i * 0.05, 0, 1); if (k <= 0 || k >= 1) continue; drawPix(PIX.spit, lerp(wx, h.x + (i - 3) * 24, k), lerp(wy + 200, 330, k), 3); } if (h.t > 0.6) text('PTUH!', h.x, 180, 22, '#c8ff6b', 'center', '#000', 6); text("DANIELE'S SPIT · 5TH FLOOR", h.x, 40, 8, '#fff', 'center', '#000', 3); }
    if (h.type === 'carpet') { const k = h.t / h.life, im = IMG.carpet_fly; if (im.width) {
      const w = 300, hh = w * im.height / im.width, x0 = lerp(W + 30, -w - 30, k), y0 = 40 + Math.sin(G.t * 2.6) * 10, sw = im.width / w;
      for (let i = 0; i < 3; i++) G.particles.push({ x: x0 + w * rnd(0.55, 1.0), y: y0 + hh * rnd(0.75, 0.98), vx: rnd(20, 70), vy: rnd(-10, 25), life: 0.7, max: 0.7, color: pick(['#2fd3c8', '#ffe36b', '#ffffff', '#ff7ad9']), size: rnd(2, 4), grav: 0, add: true });
      ctx.save(); ctx.shadowColor = '#2fd3c8'; ctx.shadowBlur = 16;
      const split = 0.62, sh = hh * split; ctx.drawImage(im, 0, 0, im.width, im.height * split, x0, y0, w, sh);
      for (let sx = 0; sx < w; sx += 6) { const wv = Math.sin(sx * 0.045 - G.t * 9) * 5 * (0.3 + sx / w); ctx.drawImage(im, sx * sw, im.height * split, 6 * sw, im.height * (1 - split), x0 + sx, y0 + sh + wv - 1, 6.5, hh - sh + 1); }
      ctx.restore(); if (h.t < 1.6) text('MAGIC CARPET!', x0 + w / 2, y0 - 8, 10, '#2fd3c8', 'center', '#000', 4); } }
    if (h.type === 'banana' && !h.done) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(h.x, FLOOR + 6, 26, 5, 0, 0, 7); ctx.fill(); drawPix(PIX.peel, h.x, FLOOR + 8, 3); }
    if (h.type === 'plane') { const k = h.t / h.life, im = IMG.plane_christian; if (im.width) {
        const w = 560, hh = w * im.height / im.width, x = lerp(W + 60, -w - 80, k), y = 20 + Math.sin(k * 6) * 12, rot = Math.sin(G.t * 3) * 0.03;
        for (let i = 0; i < 3; i++) G.particles.push({ x: x + w * rnd(0.85, 1.0), y: y + hh * rnd(0.25, 0.55), vx: rnd(80, 200), vy: rnd(-20, 20), life: 0.9, max: 0.9, color: pick(['#cfd8e6', '#9aa6b8', '#ffffff']), size: rnd(5, 10), grav: -20 });
        ctx.save(); ctx.translate(x + w / 2, y + hh / 2); ctx.rotate(rot); ctx.shadowColor = '#5ad1ff'; ctx.shadowBlur = 18; ctx.drawImage(im, -w / 2, -hh / 2, w, hh); ctx.restore();
        const gx = x + w * 0.9, gy = y + hh * 0.56;
        if (Math.floor(h.t * 6) % 2 === 0 && h.t > 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const fl = ctx.createRadialGradient(gx + 18, gy, 2, gx + 18, gy, 34); fl.addColorStop(0, 'rgba(255,240,160,1)'); fl.addColorStop(1, 'rgba(255,120,0,0)'); ctx.fillStyle = fl; ctx.fillRect(gx - 20, gy - 36, 76, 72); ctx.restore(); text('BANG!', gx + 30, gy - 30, 12, '#ffe36b', 'center', '#000', 4); }
        if (h.t < 1.2) text('CHRISTIAN', x + w * 0.72, y - 6, 11, '#5ad1ff', 'center', '#000', 4); } if (h.t > 0.6 && h.t < 1.3) for (let i = 0; i < 6; i++) { const yy = lerp(120, FLOOR - 20, (h.t - 0.6) / 0.7); ctx.save(); ctx.translate(120 + i * 145, yy); ctx.rotate(Math.sin(G.t * 9 + i) * 0.4); drawPix(PIX.pecorino, 0, 15, 3); ctx.restore(); } }
    if (h.type === 'ferdy') drawFerdy(h);
    if (h.type === 'ferdy') {
      if (!h.done && h.t > h.enter) { text(`TAP ME ${h.taps}/10`, h.x, FLOOR + 18, 9, '#fff', 'center', '#000', 4); ctx.fillStyle = '#000'; ctx.fillRect(h.x - 45, FLOOR + 26, 90, 6); ctx.fillStyle = '#b8f55a'; ctx.fillRect(h.x - 45, FLOOR + 26, 90 * clamp((h.life - h.t) / (h.life - h.enter), 0, 1), 6); }
    }
  }
  for (const it of G.items) drawItem(it);
}
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.type === 'spark') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
      const r = (f.heavy ? 70 : 44) * (0.4 + k);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, f.heavy ? '#ffd24a' : '#bff3ff'); g.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.restore();
    }
    if (f.type === 'blockfx') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#8fe3ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(f.x, f.y, 20 + k * 40, 0, 7); ctx.stroke(); ctx.restore(); }
    if (f.type === 'wave') { ctx.save(); ctx.strokeStyle = `rgba(255,209,102,${1 - k})`; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(f.x, f.y, 40 + k * 650, 0, 7); ctx.stroke(); ctx.restore(); }
    if (f.type === 'web') { const al = Math.min(1, f.life - f.t), grow = easeOut(clamp(f.t / 0.25, 0, 1)), R = 95 * grow, cx = f.x, cy = f.y;
      ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 6; ctx.lineWidth = 1.6;
      if (f.t < 0.35) { ctx.beginPath(); ctx.moveTo(P.x + P.face * 30, 250); ctx.lineTo(cx, cy); ctx.stroke(); }
      const N = 12, ang = i => i / N * Math.PI * 2 + 0.2, pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r * 1.35];
      for (let i = 0; i < N; i++) { const [x, y] = pt(i, R); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); }
      for (let r = 0.2; r <= 1.001; r += 0.2) { ctx.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = pt(i % N, R * r); if (i === 0) ctx.moveTo(x, y); else { const [px, py] = pt((i - 1) % N, R * r), mx = (px + x) / 2, my = (py + y) / 2; ctx.quadraticCurveTo(mx + (cx - mx) * 0.12, my + (cy - my) * 0.12, x, y); } } ctx.stroke(); }
      ctx.restore(); }
    if (f.type === 'matteo') { const wi = IMG.win_matteo, pop = easeOut(clamp(f.t / 0.3, 0, 1)) * clamp((f.life - f.t) / 0.4, 0, 1), wx = W / 2 - 40, wy = lerp(-230, 0, pop);
      if (wi.width) { ctx.save(); ctx.translate(wx, wy); ctx.rotate(Math.sin(G.t * 2) * 0.02); ctx.fillStyle = '#2a2530'; ctx.fillRect(-wi.width / 2 - 9, -4, wi.width + 18, wi.height + 14); ctx.fillStyle = '#6d6676'; ctx.fillRect(-wi.width / 2 - 14, wi.height + 2, wi.width + 28, 9); ctx.drawImage(wi, -wi.width / 2, 0, wi.width, wi.height); ctx.restore(); }
      for (let i = 0; i < 7; i++) { const q = ((G.t * 0.35 + i / 7) % 1); ctx.globalAlpha = Math.sin(q * Math.PI) * pop; text(i % 2 ? '♪' : '♫', wx + (i % 2 ? 1 : -1) * (60 + q * 380), wy + 120 + q * 220 + Math.sin(G.t * 4 + i) * 18, 18 + (i % 3) * 4, ['#d0b3ff', '#ffe36b', '#9bd8ff'][i % 3], 'center', '#000', 4); }
      ctx.globalAlpha = 1; }
    if (f.type === 'brazil') { ctx.save(); ctx.globalAlpha = 0.16 * (1 - k * 0.5); ctx.fillStyle = Math.floor(G.t * 4) % 2 ? '#21c45a' : '#ffd400'; ctx.fillRect(0, 0, W, H); ctx.restore(); text('♪ SAMBA! ♪', W / 2 + Math.sin(G.t * 6) * 60, 175, 18, '#ffd400', 'center', '#0a5a2a', 6); }
  }
}
function drawParticles() {
  for (const p of G.particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1); if (p.add) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    if (p.smoke) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - p.life / p.max), 0, 7); ctx.fill(); } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}
function drawHUD() {
  // MK style top bars with portraits
  drawCard('blackmask', 12, 10, 52, '#d8b25a');
  mkBar(74, 18, 330, 22, P.hp / P.maxhp, P.hp < 30 ? '#ff3030' : '#22c8ff');
  text('BLACK MASK', 80, 54, 11, '#fff', 'left', '#000', 4);
  // BAC
  text('BAC', 250, 54, 8, '#ff9a2e', 'left', '#000', 3);
  ctx.fillStyle = '#000'; ctx.fillRect(282, 49, 122, 10); ctx.fillStyle = P.bac > 75 ? '#ff4040' : '#ff9a2e'; ctx.fillRect(283, 50, 120 * P.bac / 100, 8);
  if (P.buff > 0) text('POWER UP', 250, 68, 7, '#ffe36b', 'left', '#000', 3);
  if (P.ferdy > 0) text('FERDY MODE: CONTROLS INVERTED', 80, 140, 8, '#b8f55a', 'left', '#000', 3);
  if (G.round === 1) {
    drawCard('', W - 64, 10, 52, '#d8b25a', 'vs_hench');
    mkBar(W - 404, 18, 330, 22, G.r1left / 15, '#c040ff', true);
    text("MASTRO LINDO'S 15", W - 80, 54, 11, '#fff', 'right', '#000', 4);
    text(`${G.r1left} LEFT`, W - 80, 70, 9, '#ff9ad8', 'right', '#000', 3);
  } else {
    drawCard('mastro', W - 64, 10, 52, '#d8b25a');
    mkBar(W - 404, 18, 330, 22, B.hp / 100, B.phase === 3 ? '#ff2030' : '#c040ff', true);
    text('MASTRO LINDO', W - 80, 54, 11, '#fff', 'right', '#000', 4);
    text(['', 'HIDING BEHIND HIS FRIENDS', 'DUEL', 'RAGE'][B.phase] || '', W - 80, 70, 8, '#ff9ad8', 'right', '#000', 3);
  }
  // center medallion
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(W / 2, 30, 26, 0, 7); ctx.fill(); ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 3; ctx.stroke();
  text(G.round === 1 ? 'R1' : 'FINAL', W / 2, 30, G.round === 1 ? 12 : 8, '#ffe36b', 'center', null);
  text(String(G.score).padStart(6, '0'), W / 2, 70, 10, '#ffe36b', 'center', '#000', 3);
  // friend cards
  CARDS.forEach((c, i) => {
    const r = BTN.cards[i], ready = c.t <= 0 && !(c.once && c.used);
    drawCard(c.id, r.x, r.y, r.w, ready ? '#ffe36b' : '#555');
    if (!ready) { ctx.fillStyle = 'rgba(0,0,0,.65)'; const fr = c.once ? 1 : c.t / c.cd; ctx.fillRect(r.x, r.y, r.w, r.h * clamp(fr, 0, 1)); text(c.once ? 'USED' : Math.ceil(c.t) + '', r.x + r.w / 2, r.y + r.h / 2, c.once ? 8 : 12, '#fff', 'center', '#000', 4); }
    else if (Math.floor(G.t * 3) % 2) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); }
    text(c.name, r.x + r.w / 2, r.y + r.h + 9, 6, '#fff', 'center', '#000', 3);
  });
  // touch buttons
  const btn = (k, active) => {
    const r = BTN[k]; ctx.save(); ctx.globalAlpha = 0.6;
    ctx.fillStyle = active ? 'rgba(255,255,255,.35)' : 'rgba(8,8,20,.55)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, 14); else ctx.rect(r.x, r.y, r.w, r.h); ctx.fill();
    ctx.strokeStyle = r.col || '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    text(r.label, r.x + r.w / 2, r.y + r.h / 2, k === 'left' || k === 'right' ? 30 : (r.label.length > 6 ? 9 : 12), '#fff', 'center', '#000', 4);
  };
  btn('left', held('left')); btn('right', held('right')); btn('punch', P.state === 'punch'); btn('kick', P.state === 'kick'); btn('block', P.block);
  const sp = BTN.special, ready = P.special >= 100 && P.nunchaku <= 0;
  btn('special', ready && Math.floor(G.t * 4) % 2);
  ctx.fillStyle = ready ? '#ffe36b' : '#1ec8ff'; ctx.fillRect(sp.x + 8, sp.y + sp.h - 14, (sp.w - 16) * P.special / 100, 6);
  if (G.round === 1 && G.rt < 7) { text('◀ ▶ MOVE', 122, 410, 10, '#fff', 'center', '#000', 4); text('PUNCH · KICK · HOLD BLOCK', 790, 330, 9, '#fff', 'center', '#000', 4); }
  if (P.combo >= 2) bigText(P.combo + ' HITS', P.face > 0 ? 200 : 760, 190, 22, '#fff6b0', '#ff8a00');
}
const PORTMAP = { enrico: ['enrico', 'arianna'], miriana: ['ginevra', 'miriana'], mari: ['mari'] };
function hexA(h, a) { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
const easeOut = k => 1 - Math.pow(1 - k, 3);
function drawBanners() {
  for (const b of G.banners) {
    const age = b.max - b.life, k = Math.min(easeOut(clamp(age / 0.14, 0, 1)), clamp(b.life / 0.18, 0, 1));
    const cy = 205, bh = 150 * k, sl = 44, top = cy - bh / 2, bot = cy + bh / 2;
    if (bh < 2) continue;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(0, top + sl / 2); ctx.lineTo(W, top - sl / 2); ctx.lineTo(W, bot - sl / 2); ctx.lineTo(0, bot + sl / 2); ctx.closePath();
    ctx.save(); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(6,6,14,.97)'); g.addColorStop(0.42, hexA(b.color, 0.42)); g.addColorStop(0.75, 'rgba(6,6,14,.93)'); g.addColorStop(1, 'rgba(6,6,14,.97)');
    ctx.fillStyle = g; ctx.fillRect(0, top - sl, W, bh + 2 * sl);
    for (let i = 0; i < 30; i++) { const ly = top - sl + ((i * 37.7) % (bh + 2 * sl)), len = 120 + (i * 53) % 220, lx = W + 300 - ((G.t * 1500 + i * 211) % (W + 600)); ctx.fillStyle = i % 3 ? 'rgba(255,255,255,.14)' : hexA(b.color, 0.55); ctx.fillRect(lx, ly, len, i % 4 ? 2 : 3); }
    const ports = (PORTMAP[b.card] || [b.card]).map(n => IMG['port_' + n]).filter(im => im && im.width);
    const ph = 236, slide = lerp(-300, 26, easeOut(clamp(age / 0.24, 0, 1))) + age * 14;
    let px = slide;
    ports.forEach((im, i) => {
      const w = ph * im.width / im.height;
      ctx.save(); ctx.beginPath(); ctx.moveTo(px + 30, top - 40); ctx.lineTo(px + w + 10, top - 40); ctx.lineTo(px + w - 30, bot + 40); ctx.lineTo(px - 10, bot + 40); ctx.closePath(); ctx.clip();
      ctx.drawImage(im, px, cy - ph / 2 + 10, w, ph);
      const vg = ctx.createLinearGradient(px, 0, px + w, 0); vg.addColorStop(0, 'rgba(0,0,0,.35)'); vg.addColorStop(0.18, 'rgba(0,0,0,0)'); vg.addColorStop(0.82, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(px, top - 40, w, bh + 80);
      ctx.restore();
      ctx.strokeStyle = hexA(b.color, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + w + 10, top - 40); ctx.lineTo(px + w - 30, bot + 40); ctx.stroke();
      px += w - 24;
    });
    if (!ports.length) drawCard(b.card, 40, cy - 50, 100, b.color);
    if (age < 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - age / 0.12)})`; ctx.fillRect(0, top - sl, W, bh + 2 * sl); }
    ctx.restore();
    ctx.strokeStyle = b.color; ctx.lineWidth = 4; ctx.shadowColor = b.color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, top + sl / 2); ctx.lineTo(W, top - sl / 2); ctx.moveTo(0, bot + sl / 2); ctx.lineTo(W, bot - sl / 2); ctx.stroke(); ctx.shadowBlur = 0;
    const tk = easeOut(clamp((age - 0.06) / 0.24, 0, 1)), tx = lerp(W + 420, W - 34, tk) - age * 10;
    const nsz = b.name.length > 22 ? 10 : b.name.length > 14 ? 13 : 16, msz = b.move.length > 22 ? 13 : b.move.length > 14 ? 18 : 24;
    text(b.name, tx, cy - 22, nsz, '#ffffff', 'right', '#000', 5);
    text(b.move, tx, cy + 20, msz, b.color, 'right', '#000', 7);
    ctx.restore();
  }
}
function drawBig() {
  for (const b of G.big) {
    const k = clamp((b.max - b.life) / 0.18, 0, 1), sc = lerp(2.2, 1, k);
    ctx.save(); ctx.translate(W / 2, 220); ctx.scale(sc, sc); ctx.globalAlpha = clamp(b.life / 0.25, 0, 1) * k;
    bigText(b.str, 0, 0, b.size, b.c1, b.c2); ctx.restore();
  }
}
function drawTexts() { for (const t of G.texts) { ctx.globalAlpha = clamp(t.life / t.max * 2, 0, 1); text(t.str, t.x, t.y, t.size, t.color, 'center', '#000', Math.max(3, t.size / 3)); } ctx.globalAlpha = 1; }

// ---------------------------------------------------------------- screens
function drawTitle() {
  const im = IMG.scene, z = 1.0 + 0.025 * (0.5 + 0.5 * Math.sin(G.t * 0.15));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  if (im.width) {
    ctx.drawImage(im, 0, 0, W, 536);
    const sx = im.width / W, cb = Math.sin(G.t * 1.8) * 3, pb = Math.max(0, Math.sin(G.t * 3)) * 3;
    ctx.drawImage(im, 760 * sx, 0, 190 * sx, 118 * sx, 760, cb, 190, 118);
    ctx.drawImage(im, 790 * sx, 150 * sx, 130 * sx, 100 * sx, 790, 150 + pb, 130, 100);
  }
  const br = 1 + 0.012 * Math.sin(G.t * 3);
  const dr = (img, x, y, w, h, wh) => { if (!img.width) return; ctx.save(); ctx.translate(x + w / 2, y + h); ctx.scale(1, br); ctx.drawImage(img, -w / 2, -h, w, h); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = wh; ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore(); };
  dr(IMG.blackmask, 330, 224, 154, 292, 0.08 + 0.08 * Math.sin(G.t * 9));
  dr(IMG.mastro, 522, 230, 134, 286, 0.06 + 0.06 * Math.sin(G.t * 8 + 1));
  ctx.restore();
  if (Math.random() < 0.7) G.particles.push({ x: rnd(345, 470), y: rnd(330, 500), vx: rnd(-10, 10), vy: rnd(-90, -50), life: 0.9, max: 0.9, color: '#3fe6ff', size: rnd(2, 4), grav: 0, add: true });
  if (Math.random() < 0.7) G.particles.push({ x: rnd(535, 650), y: rnd(330, 500), vx: rnd(-10, 10), vy: rnd(-90, -50), life: 0.9, max: 0.9, color: '#ff4bd8', size: rnd(2, 4), grav: 0, add: true });
  if (Math.random() < 0.25) G.particles.push({ x: rnd(495, 540), y: 95, vx: rnd(-6, 6), vy: rnd(-30, -15), life: 3, max: 3, color: 'rgba(120,120,130,0.5)', size: rnd(6, 12), grav: 0, smoke: true });
  drawParticles();
  const mg = ctx.createRadialGradient(734, 30, 2, 734, 30, 60); mg.addColorStop(0, `rgba(220,230,255,${0.35 + 0.1 * Math.sin(G.t * 2)})`); mg.addColorStop(1, 'rgba(220,230,255,0)'); ctx.fillStyle = mg; ctx.fillRect(670, -30, 130, 120);
  const on = Math.floor(G.t * 4) % 2;
  [[852, 258, on ? '#3d7bff' : '#ff3b3b'], [920, 264, on ? '#ff3b3b' : '#3d7bff']].forEach(([x, y, c]) => { const g = ctx.createRadialGradient(x, y, 1, x, y, 40); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.6; ctx.fillStyle = g; ctx.fillRect(x - 40, y - 40, 80, 80); ctx.globalAlpha = 1; });
  const zz = (G.t * 0.8) % 1; text('z', 150 + zz * 20, 70 - zz * 30, 10 + zz * 6, `rgba(255,255,255,${1 - zz})`, 'center', null);
  const vg = ctx.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,.6)'); vg.addColorStop(0.25, 'rgba(0,0,0,0)'); vg.addColorStop(0.72, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.8)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  bigText('THE ULTIMATE BATTLE', W / 2, 46 + Math.sin(G.t * 2) * 2, 30);
  text('HALLOWEEN 2026 EDITION', W / 2, 86, 13, '#ffb547', 'center', '#000', 5);
  if (Math.floor(G.t * 2.2) % 2 === 0) bigText('PRESS START', W / 2, 478, 22, '#ffffff', '#9fd8ff', '#001a2a');
  text('BLACK MASK  VS  MASTRO LINDO', W / 2, 514, 9, '#9bd8ff', 'center', '#000', 4);
}
function drawDifficulty() {
  drawArena(0.7);
  bigText('CHOOSE YOUR DIFFICULTY', W / 2, 130, 24);
  ['EASY', 'NORMAL', 'HARD'].forEach((k, i) => {
    const x = 180 + i * 210, d = DIFFS[k];
    ctx.fillStyle = 'rgba(10,10,25,.9)'; ctx.fillRect(x, 230, 190, 100); ctx.strokeStyle = d.col; ctx.lineWidth = 4; ctx.strokeRect(x, 230, 190, 100);
    text(k, x + 95, 270, 18, d.col, 'center', '#000', 5);
    text(['FOR NEW FIGHTERS', 'THE REAL NIGHT', 'NO MERCY'][i], x + 95, 305, 8, '#fff', 'center', '#000', 3);
  });
  text('TIP: HOLD BLOCK RIGHT BEFORE A HAYMAKER TO PARRY', W / 2, 420, 9, '#9bd8ff', 'center', '#000', 3);
}
function drawIntro() {
  if (IMG.scene.width) ctx.drawImage(IMG.scene, 0, 0, W, 536);
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(0, 0, W, H);
  const it = INTRO[G.introIdx]; if (!it) return;
  if (it.how) {
    bigText('HOW TO PLAY', W / 2, 46, 22);
    const rows = [['◀ ▶', 'MOVE. YOU AUTO-FACE THE NEAREST ENEMY'], ['PUNCH / KICK', 'KICK IS SLOWER BUT HITS HARDER AND HITS 2'], ['HOLD BLOCK', 'BLOCK. BLOCK JUST BEFORE A HAYMAKER = PARRY'],
      ['FRIEND CARDS', 'TOP LEFT. CALL YOUR FRIENDS (LONG RECHARGE)'], ['NUNCHAKU', 'FILLS WITH HITS. ENEMIES PANIC'], ['WALK OVER DRINKS', 'SPRITZ = POWER + BAC. PEAR JUICE HEALS'],
      ['BAC 100%', 'FERDY MODE: CONTROLS INVERTED'], ['WATCH OUT', 'GLASSES, PUDDLES, BANANAS, MASSIMILIANO, GRABS']];
    rows.forEach(([a, b], i) => { text(a, 110, 100 + i * 46, 11, '#1ec8ff', 'left', '#000', 3); text(b, 110, 120 + i * 46, 9, '#fff', 'left', '#000', 3); });
  } else {
    const k = clamp(G.introT / 1.2, 0, 1);
    wrap(it.t, 820, 18).forEach((l, i) => text(l, W / 2, 210 + i * 30, 18, '#fff', 'center', '#000', 5));
    const s = it.s.slice(0, Math.floor(it.s.length * k));
    wrap(s, 760, 12).forEach((l, i) => text(l, W / 2, 300 + i * 24, 12, '#ffb3f0', 'center', '#000', 4));
    drawCard('', W / 2 - 50, 50, 100, '#d8b25a', G.introIdx === 1 ? 'vs_mastro' : G.introIdx === 3 ? 'vs_hench' : G.introIdx === 2 ? 'vs_blackmask' : 'card_carpet');
  }
  if (Math.floor(G.t * 2) % 2) text('TAP TO CONTINUE', W / 2, 500, 10, '#9bd8ff', 'center', '#000', 4);
}
function drawVs() {
  const k = clamp(G.st / 0.35, 0, 1);
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#04122a'); g.addColorStop(0.5, '#000'); g.addColorStop(1, '#2a0420'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) { ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.04 * Math.sin(G.t * 3 + i)})`; ctx.fillRect(0, i * 28, W, 2); }
  const L = IMG.vs_blackmask, R = G.round === 1 ? IMG.vs_hench : IMG.vs_mastro;
  const lw = 330, lh = 440;
  ctx.save(); ctx.translate(lerp(-400, 70, k), 60); if (L.width) ctx.drawImage(L, 0, 0, lw, lh); ctx.strokeStyle = '#1ec8ff'; ctx.lineWidth = 6; ctx.strokeRect(0, 0, lw, lh); ctx.restore();
  ctx.save(); ctx.translate(lerp(W + 70, W - 70 - lw, k), 60); if (R.width) ctx.drawImage(R, 0, 0, lw, lh); ctx.strokeStyle = '#ff4bd8'; ctx.lineWidth = 6; ctx.strokeRect(0, 0, lw, lh); ctx.restore();
  if (G.st > 0.4) { const s = 1 + 0.6 * Math.max(0, 1 - (G.st - 0.4) * 4); ctx.save(); ctx.translate(W / 2, 270); ctx.scale(s, s); bigText('VS', 0, 0, 70, '#fff6b0', '#ff3a00'); ctx.restore(); }
  text('BLACK MASK', 70 + lw / 2, 520, 14, '#9ff3ff', 'center', '#000', 5);
  text(G.round === 1 ? 'THE 15 FRIENDS' : 'MASTRO LINDO', W - 70 - lw / 2, 520, 14, '#ffb3f0', 'center', '#000', 5);
  text(G.round === 1 ? '"SEI 1 CONTRO 15!"' : '"LA TUA RAGAZZA E UNA DELLE TANTE"', W - 70 - lw / 2, 40, 8, '#fff', 'center', '#000', 3);
  text('"SE HAI LE PALLE, 1 VS 1"', 70 + lw / 2, 40, 8, '#fff', 'center', '#000', 3);
}
function drawRoundCard() {
  drawArena(0.15); drawPlayer(); if (G.round === 2) drawBoss();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
  const k = clamp(G.st / 0.3, 0, 1);
  if (G.st < 1.4) { ctx.save(); ctx.translate(W / 2, 220); ctx.scale(lerp(2, 1, k), lerp(2, 1, k)); bigText(G.round === 1 ? 'ROUND 1' : 'FINAL ROUND', 0, 0, 50); ctx.restore(); text(G.round === 1 ? 'BLACK MASK VS THE 15' : 'BLACK MASK VS MASTRO LINDO', W / 2, 290, 14, '#ffb3f0', 'center', '#000', 5); }
  else { const k2 = clamp((G.st - 1.4) / 0.2, 0, 1); ctx.save(); ctx.translate(W / 2, 240); ctx.scale(lerp(3, 1, k2), lerp(3, 1, k2)); bigText('FIGHT!', 0, 0, 80, '#fff6b0', '#ff2a00'); ctx.restore(); }
}
function drawPushup() {
  drawArena(0.6);
  bigText('BONUS: PUSH-UP CHALLENGE', W / 2, 50, 20, '#eaffc0', '#6bbf2a');
  { const im = IMG.tommaso_pu, pu = G.pu, ph = (G.st % 0.75) / 0.75, down = pu && !pu.done ? Math.max(0, Math.sin(ph * Math.PI * 2)) : 0;
    if (im.width) { const hh = 150, w = hh * im.width / im.height, cx = W / 2, by = 222; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(cx + 10, by, w * 0.5, 8, 0, 0, 7); ctx.fill();
      const sq = pu && pu.slipped ? 0.72 : 1 - down * 0.16; ctx.save(); ctx.translate(cx, by); ctx.scale(1, sq); ctx.rotate(pu && pu.slipped ? 0.12 : -down * 0.04); ctx.drawImage(im, -w / 2, -hh, w, hh); ctx.restore();
      if (pu && pu.slipped && Math.floor(G.t * 6) % 2) text('OUCH!', cx - w / 2 + 10, by - 40, 14, '#ff5050', 'center', '#000', 5); } }
  text('TOMMASO "BROCCOLI GUY" CHALLENGES YOU', W / 2, 240, 10, '#fff', 'center', '#000', 4);
  const pu = G.pu;
  if (!pu.done) {
    const ph = (G.st % 0.75) / 0.75, good = ph > 0.7 || ph < 0.15;
    text("TAP ON THE BEAT. DON'T RUSH!", W / 2, 260, 12, '#ffe36b', 'center', '#000', 4);
    ctx.fillStyle = '#222'; ctx.fillRect(280, 290, 400, 30); ctx.fillStyle = '#2a8a2a'; ctx.fillRect(280 + 400 * 0.7, 290, 120, 30); ctx.fillRect(280, 290, 60, 30);
    ctx.fillStyle = good ? '#b8f55a' : '#fff'; ctx.fillRect(280 + ph * 400 - 4, 284, 8, 42);
    text(`REPS: ${pu.reps}`, W / 2, 370, 22, '#fff', 'center', '#000', 6);
    text(`TIME ${Math.max(0, 10 - G.st).toFixed(1)}`, W / 2, 410, 12, '#9bd8ff', 'center', '#000', 4);
  } else {
    text(pu.msg, W / 2, 330, 14, pu.slipped ? '#ff5050' : '#b8f55a', 'center', '#000', 5);
    if (pu.slipped) text('(THE AMBULANCE IS COMING... AGAIN)', W / 2, 370, 10, '#fff', 'center', '#000', 4);
    if (Math.floor(G.t * 2) % 2) text('TAP TO FACE MASTRO LINDO', W / 2, 460, 14, '#fff', 'center', '#000', 5);
  }
}
function drawGameOver() {
  ctx.fillStyle = 'rgba(40,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  bigText('K.O.', W / 2, 190, 70, '#ffb0b0', '#c00000');
  text('THE AMBULANCE IS ON ITS WAY...', W / 2, 270, 12, '#fff', 'center', '#000', 4);
  if (G.st > 1.5 && Math.floor(G.t * 2) % 2) text('TAP TO CONTINUE', W / 2, 360, 18, '#ffe36b', 'center', '#000', 6);
  const on = Math.floor(G.t * 4) % 2; ctx.fillStyle = on ? 'rgba(255,0,0,.12)' : 'rgba(0,80,255,.12)'; ctx.fillRect(0, 0, W, H);
}
function drawFinishOverlay() {
  if (G.state === 'finish') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H); text(`TAP ANYWHERE! ${G.finTaps}/8`, W / 2, 300, 14, '#fff', 'center', '#000', 5); }
  if (G.state === 'fatality') { ctx.fillStyle = `rgba(110,0,0,${0.45 + 0.2 * Math.sin(G.t * 10)})`; ctx.fillRect(0, 0, W, H); }
  if (G.state === 'apology') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, W, H);
    if (G.st > 6.8) { const k = clamp((G.st - 6.8) / 0.25, 0, 1); ctx.save(); ctx.translate(W / 2, 210); ctx.rotate(-0.1); ctx.scale(2.4 - 1.4 * k, 2.4 - 1.4 * k); ctx.strokeStyle = '#2ee66b'; ctx.lineWidth = 8; ctx.strokeRect(-290, -50, 580, 100); bigText('APOLOGY ACCEPTED', 0, 0, 30, '#d8ffd0', '#1fa84a', '#002a10'); ctx.restore(); }
    if (G.st > 7.5) text('TAP TO CONTINUE', W / 2, 505, 10, '#9bd8ff', 'center', '#000', 4);
  }
}
function drawFireworks() {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let f = 0; f < 6; f++) {
    const per = 1.6 + f * 0.23, ph = ((G.t + f * 0.71) % per) / per, n = Math.floor((G.t + f * 0.71) / per);
    const cx = 120 + ((n * 977 + f * 331) % 720), cy = 70 + ((n * 541 + f * 173) % 170), col = ['#ff4b8b', '#ffe36b', '#1ec8ff', '#7CFC00', '#ff9a2e', '#d0b3ff'][(n + f) % 6];
    if (ph < 0.25) { ctx.fillStyle = col; ctx.fillRect(cx - 2, cy + (1 - ph / 0.25) * 260, 4, 10); continue; }
    const q = (ph - 0.25) / 0.75, r = 20 + easeOut(q) * 90; ctx.globalAlpha = 1 - q; ctx.fillStyle = col;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; ctx.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r + q * q * 40 - 2, 4, 4); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawEnding() {
  if (IMG.scene.width) ctx.drawImage(IMG.scene, 0, 0, W, 536);
  ctx.fillStyle = G.endStage === 2 ? 'rgba(0,0,0,.76)' : 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, W, H);
  for (const c of G.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
  if (G.endStage === 0) {
    bigText('BLACK MASK WINS', W / 2, 80, 34, '#d8f6ff', '#1e8cff', '#001428');
    if (G.roundDamage === 0) text('FLAWLESS VICTORY', W / 2, 120, 14, '#ffe36b', 'center', '#000', 4);
    const secs = Math.round((performance.now() - G.startTime) / 1000);
    const rows = [['DIFFICULTY', D.label], ['SCORE', String(G.score)], ['TIME', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`], ['ENEMIES DOWN', String(G.kos)], ['MAX COMBO', String(G.maxCombo)], ['FRIENDS CALLED', String(G.friendsCalled)], ['PEAK BAC', Math.round(G.bacPeak) + '%'], ['CONTINUES', String(G.continues)]];
    rows.forEach(([a, b], i) => { text(a, 280, 160 + i * 36, 13, '#fff', 'left', '#000', 4); text(b, 680, 160 + i * 36, 13, '#ffe36b', 'right', '#000', 4); });
    text('NO REAL PUNCH WAS THROWN THAT NIGHT. HE STILL WON.', W / 2, 470, 9, '#9bd8ff', 'center', '#000', 3);
  } else if (G.endStage === 1) {
    const p = 1 + 0.05 * Math.sin(G.t * 4);
    drawFireworks();
    drawActor('bm', 'victory', 150, 1, { glow: '#1ec8ff' }, G.t, 0);
    drawActor('ml', 'apology', 820, -1, {}, G.t, 0);
    text('SORRY...', 820, FLOOR - 200, 9, '#ffb0e8', 'center', '#000', 3);
    ctx.save(); ctx.translate(W / 2, 160); ctx.scale(p, p); bigText('HAPPY BIRTHDAY', 0, 0, 40); ctx.restore();
    ctx.save(); ctx.translate(W / 2, 250); ctx.scale(p, p); bigText('CHECCO', 0, 0, 66, '#ffffff', '#1ec8ff', '#001428'); ctx.restore();
    text('LEVEL 23 UNLOCKED', W / 2, 340, 22, '#7CFC00', 'center', '#000', 6);
    text('NOVEMBER 9, 2026', W / 2, 390, 11, '#fff', 'center', '#000', 4);
  } else if (G.endStage === 2) {
    const cast = [['blackmask', 'BLACK MASK', 'CHECCO'], ['ginevra', 'CLEOPATRA · RICCHIO\' SCREAM', 'GINEVRA'], ['fede', 'THE PEACEMAKER', 'FEDE'], ['enrico', 'NUNCHAKU DEALER · SAMBA', 'ENRICO'],
      ['arianna', 'GOTH QUEEN · SAMBA HEX', 'ARIANNA'], ['elisabetta', 'SPIDER-GIRL & DRIVER', 'ELISABETTA'], ['ferdy', 'FERDY MODE', 'FERDINANDO'], ['emma', 'NIGHT NURSE', 'EMMA'],
      ['daniele', 'SPITTER, 5TH FLOOR', 'DANIELE'], ['matteo', 'ACCORDION (FROM BED)', 'MATTEO'], ['christian', 'SARDEGNA AIR', 'CHRISTIAN'], ['tommaso', 'BROCCOLI GUY', 'TOMMASO'],
      ['mari', 'JASMINE (BROKEN HEEL)', 'MARI'], ['sofia', 'MAGIC CARPET', 'SOFIA'], ['ilaria', 'MAGIC CARPET', 'ILARIA'], ['miriana', 'MAGIC CARPET · SCREAM COMBO', 'MIRIANA'],
      ['banana', 'BANANA GUY', '???'], ['mastro', 'MASTRO LINDO', 'SAID SORRY']];
    const RH = 132, y0 = H + 20 - G.endT * 58;
    bigText('CAST', W / 2, y0 - 40, 22);
    cast.forEach(([id, role, name], i) => { const y = y0 + i * RH; if (y < -140 || y > H + 20) return; const im = IMG['port_' + id], left = i % 2 === 0, ph = 118;
      if (im && im.width) { const w = ph * im.width / im.height, x = left ? 170 : W - 170 - w; ctx.fillStyle = '#d8b25a'; ctx.fillRect(x - 3, y - 3, w + 6, ph + 6); ctx.drawImage(im, x, y, w, ph);
        const tx = left ? x + w + 26 : x - 26, al = left ? 'left' : 'right'; text(name, tx, y + 40, 20, '#fff', al, '#000', 6); text(role, tx, y + 74, 10, '#9bd8ff', al, '#000', 4); }
      else { drawCard(id, 260, y, 70, '#d8b25a'); text(name, 350, y + 22, 16, '#fff', 'left', '#000', 5); text(role, 350, y + 50, 9, '#9bd8ff', 'left', '#000', 4); } });
    if (y0 + cast.length * RH < 120) { G.endStage = 3; G.endT = 0; }
  } else {
    bigText('THANKS FOR PLAYING', W / 2, 200, 28);
    text('MADE WITH LOVE BY YOUR FRIENDS', W / 2, 260, 12, '#ff9ad8', 'center', '#000', 4);
    text('ANNOUNCER VOICES: KENNEY (CC0), VOICEBOSCH (CC-BY-SA 4.0)', W / 2, 300, 7, '#888', 'center', '#000', 3);
    if (Math.floor(G.t * 2) % 2) text('TAP TO PLAY AGAIN', W / 2, 370, 16, '#ffe36b', 'center', '#000', 5);
  }
  if (G.endStage < 2 && G.endT > 1 && Math.floor(G.t * 2) % 2) text('TAP', W / 2, 505, 10, '#9bd8ff', 'center', '#000', 3);
}

// ---------------------------------------------------------------- main draw
function draw() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const s = G.state;
  if (s === 'loading') { bigText('LOADING...', W / 2, H / 2, 20); return; }
  if (s === 'title') { drawTitle(); return; }
  if (s === 'difficulty') { drawDifficulty(); return; }
  if (s === 'intro') { drawIntro(); return; }
  if (s === 'vs') { drawVs(); return; }
  if (s === 'pushup') { drawPushup(); drawTexts(); return; }
  if (s === 'ending') { drawEnding(); return; }
  if (s === 'roundcard') { drawRoundCard(); return; }
  ctx.save();
  const sh = G.shake, sway = P.bac / 100;
  ctx.translate(rnd(-sh, sh) + Math.sin(G.t * 1.7) * 10 * sway, rnd(-sh, sh));
  if (G.zoom > 0) { const z = 1 + G.zoom; ctx.translate(G.zx, G.zy); ctx.scale(z, z); ctx.translate(-G.zx, -G.zy); }
  if (sway > 0.2) { ctx.translate(W / 2, H / 2); ctx.rotate(Math.sin(G.t * 1.3) * 0.025 * sway); ctx.translate(-W / 2, -H / 2); }
  drawArena(s === 'fatality' ? 0.4 : 0);
  if (P.ferdy > 0 && ARENA) { ctx.globalAlpha = 0.25; ctx.drawImage(ARENA, 12 * Math.sin(G.t * 3), 0, W, H); ctx.globalAlpha = 1; }
  // depth: draw farthest from camera first (all on one plane; draw boss, enemies, player)
  if (G.round === 2) drawBoss();
  G.enemies.slice().sort((a, b) => (a.ko ? -1 : 0) - (b.ko ? -1 : 0)).forEach(drawEnemy);
  drawPlayer();
  drawHazards();
  drawFx();
  drawParticles();
  ctx.restore();
  for (const b of G.bubbles) drawBubble(b);
  if (s === 'fight') drawHUD();
  drawBanners();
  drawBig();
  drawTexts();
  if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashCol},${G.flash * 2})`; ctx.fillRect(0, 0, W, H); }
  if (P.bac > 60 && s === 'fight') { const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(60,120,0,${(P.bac - 60) / 160})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
  if (s === 'gameover') drawGameOver();
  if (s === 'finish' || s === 'fatality' || s === 'apology') drawFinishOverlay();
}
let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (window.matchMedia('(orientation: portrait)').matches && G.state === 'fight') dt = 0;
  update(dt); draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__G = G; window.__P = P; window.__B = B;
window.__dbg = { CARDS, useCard, startRound, startFinish, finishTap, startPushup, startEnding, EVENTS, setState, resetPlayer, bossReset, startVs, SPR, setDiff: k => { D = DIFFS[k]; } };
})();
