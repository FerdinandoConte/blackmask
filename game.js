/* THE ULTIMATE BATTLE – Halloween 2026 Edition
   A birthday gift for Checco ("Black Mask"). Vanilla JS + Canvas, no dependencies. */
(() => {
'use strict';

// ---------------------------------------------------------------- setup
const W = 960, H = 540, FLOOR = 506, CX = 480;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let scale = 1, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
  cv.style.width = Math.round(W * scale) + 'px';
  cv.style.height = Math.round(H * scale) + 'px';
  cv.width = Math.round(W * scale * dpr);
  cv.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize);
resize();

const FONT = '"Press Start 2P", monospace';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- assets
const IMG = {};
const imgList = ['scene.jpg', 'stage.jpg', 'blackmask.png', 'mastro.png', 'hench.png', 'plane.png', 'spritz.png',
  'card_fede.jpg', 'card_ginevra.jpg', 'card_elisabetta.jpg', 'card_enrico.jpg', 'card_arianna.jpg', 'card_ferdy.jpg',
  'card_emma.jpg', 'card_matteo.jpg', 'card_daniele.jpg', 'card_christian.jpg', 'card_tommaso.jpg', 'card_mari.jpg',
  'card_miriana.jpg', 'card_banana.jpg', 'card_spritz.jpg', 'card_mastro.jpg', 'card_blackmask.jpg', 'card_sofia.jpg',
  'card_ilaria.jpg', 'card_carpet.jpg'];
let loaded = 0;
imgList.forEach(n => {
  const im = new Image();
  im.onload = () => { loaded++; };
  im.onerror = () => { loaded++; };
  im.src = 'assets/' + n;
  IMG[n.replace(/\.(png|jpg)$/, '')] = im;
});

// ---------------------------------------------------------------- audio (WebAudio synth)
const AU = { ctx: null, master: null, music: null, sfx: null, seq: null, ginevra: null, voice: {} };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  AU.ctx = new AC();
  AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.8; AU.master.connect(AU.ctx.destination);
  AU.music = AU.ctx.createGain(); AU.music.gain.value = 0.32; AU.music.connect(AU.master);
  AU.sfx = AU.ctx.createGain(); AU.sfx.gain.value = 0.7; AU.sfx.connect(AU.master);
  // optional real voice files (drop them in assets/ with these names)
  const loadVoice = (key, file) => fetch('assets/' + file).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
    .then(b => AU.ctx.decodeAudioData(b)).then(buf => { AU.voice[key] = buf; }).catch(() => {});
  loadVoice('ginevra', 'ginevra.mp3');
  ['round1', 'fight', 'fatality', 'finishhim', 'wins'].forEach(k => loadVoice(k, 'voice_' + k + '.mp3'));
}
function playBuf(buf, gain = 1) {
  if (!AU.ctx || !buf) return false;
  const s = AU.ctx.createBufferSource(); s.buffer = buf;
  const g = AU.ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(AU.sfx); s.start(); return true;
}
function tone(freq, dur, type = 'square', vol = 0.2, when = 0, dest = null, slide = 0) {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime + when;
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol = 0.3, filt = 1200, when = 0, dest = null, q = 1) {
  if (!AU.ctx) return;
  if (!noiseBuf) {
    noiseBuf = AU.ctx.createBuffer(1, AU.ctx.sampleRate, AU.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = AU.ctx.currentTime + when;
  const s = AU.ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = AU.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filt; f.Q.value = q;
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const SFX = {
  punch() { noise(0.12, 0.5, 900); tone(140, 0.1, 'square', 0.25, 0, null, 0.5); },
  hit() { noise(0.18, 0.6, 500, 0, null, 0.7); tone(90, 0.18, 'sawtooth', 0.25, 0, null, 0.5); },
  whiff() { noise(0.12, 0.18, 2500, 0, null, 2); },
  block() { tone(900, 0.08, 'square', 0.2); tone(1350, 0.12, 'square', 0.15, 0.03); },
  parry() { [1200, 1600, 2400].forEach((f, i) => tone(f, 0.15, 'square', 0.18, i * 0.05)); },
  ko() { tone(400, 0.5, 'square', 0.2, 0, null, 0.2); },
  pickup() { [660, 880, 1320].forEach((f, i) => tone(f, 0.1, 'square', 0.15, i * 0.06)); },
  drink() { for (let i = 0; i < 4; i++) tone(300 + i * 40, 0.08, 'sine', 0.2, i * 0.07); },
  bad() { tone(200, 0.3, 'sawtooth', 0.2, 0, null, 0.5); },
  card() { [523, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.15, i * 0.05)); },
  scream() {
    if (playBuf(AU.voice.ginevra, 1.2)) return;
    for (let i = 0; i < 6; i++) tone(900 + Math.random() * 300, 0.5, 'sawtooth', 0.08, i * 0.02, null, 1.3);
    noise(0.7, 0.35, 2200, 0, null, 3);
  },
  spit() { noise(0.15, 0.4, 3000, 0, null, 4); tone(220, 0.1, 'square', 0.15, 0.02, null, 0.6); },
  siren() { for (let i = 0; i < 4; i++) { tone(700, 0.3, 'square', 0.1, i * 0.6); tone(950, 0.3, 'square', 0.1, i * 0.6 + 0.3); } },
  plane() { noise(2.2, 0.35, 300, 0, null, 0.5); tone(120, 2.2, 'sawtooth', 0.06, 0, null, 0.6); },
  slip() { tone(600, 0.4, 'sine', 0.2, 0, null, 0.3); },
  stamp() { noise(0.25, 0.7, 200, 0, null, 0.5); tone(70, 0.3, 'square', 0.3); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.16, i * 0.14)); },
  voice(k) { return playBuf(AU.voice[k], 1.1); },
};
// --- music sequencer
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  title: { bpm: 96, bass: [45, 45, 48, 48, 43, 43, 40, 40], lead: [69, 72, 76, 72, 67, 71, 74, 71, 64, 67, 72, 67, 64, 68, 71, 68], drums: 'k...s...k.k.s...' },
  fight: { bpm: 142, bass: [40, 40, 52, 40, 43, 43, 55, 43, 38, 38, 50, 38, 45, 45, 57, 47], lead: [76, 0, 79, 76, 0, 74, 72, 0, 74, 0, 76, 79, 0, 81, 79, 76], drums: 'k.h.s.h.k.k.s.h.' },
  boss: { bpm: 158, bass: [38, 38, 50, 38, 41, 41, 53, 41, 36, 36, 48, 36, 37, 37, 49, 37], lead: [74, 77, 81, 77, 74, 0, 72, 74, 77, 0, 79, 77, 76, 73, 74, 0], drums: 'k.hsk.hsk.hsk.ss' },
  samba: { bpm: 168, bass: [43, 0, 43, 43, 0, 43, 0, 43, 41, 0, 41, 41, 0, 41, 0, 41], lead: [79, 79, 0, 76, 0, 79, 81, 0, 79, 0, 76, 74, 0, 76, 0, 0], drums: 'kshskshskshskshs', samba: true },
  accordion: { bpm: 100, bass: [41, 0, 0, 48, 0, 0, 43, 0, 0, 48, 0, 0], lead: [77, 81, 84, 81, 77, 81, 79, 83, 86, 83, 79, 83], drums: '............', acc: true },
  win: { bpm: 120, bass: [48, 48, 55, 55, 53, 53, 55, 55], lead: [72, 76, 79, 84, 81, 84, 79, 76, 77, 81, 84, 81, 79, 76, 74, 72], drums: 'k...s...k...s...' },
};
let curTrack = null, overrideTrack = null, overrideUntil = 0;
function music(name) { if (curTrack === name) return; curTrack = name; startSeq(); }
function musicOverride(name, secs) { overrideTrack = name; overrideUntil = performance.now() + secs * 1000; startSeq(); }
function startSeq() {
  if (!AU.ctx) return;
  if (AU.seq) clearInterval(AU.seq);
  let step = 0, next = AU.ctx.currentTime + 0.05;
  AU.seq = setInterval(() => {
    if (!AU.ctx) return;
    const nm = (overrideTrack && performance.now() < overrideUntil) ? overrideTrack : (overrideTrack = null, curTrack);
    const tr = TRACKS[nm]; if (!tr) return;
    const sp = 60 / tr.bpm / 2;
    while (next < AU.ctx.currentTime + 0.2) {
      const t = next - AU.ctx.currentTime;
      const b = tr.bass[step % tr.bass.length];
      if (b) tone(NOTE(b), sp * 0.9, tr.acc ? 'sawtooth' : 'triangle', 0.35, t, AU.music);
      const l = tr.lead[step % tr.lead.length];
      if (l) {
        if (tr.acc) { [0, 4, 7].forEach(iv => tone(NOTE(l + iv - 12), sp * 0.95, 'sawtooth', 0.06, t, AU.music)); tone(NOTE(l) * 1.004, sp * 0.95, 'square', 0.05, t, AU.music); }
        else tone(NOTE(l), sp * 0.8, 'square', 0.12, t, AU.music);
      }
      const d = tr.drums[step % tr.drums.length];
      if (d === 'k') tone(110, 0.15, 'sine', 0.6, t, AU.music, 0.4);
      if (d === 's') noise(0.1, tr.samba ? 0.25 : 0.35, tr.samba ? 4000 : 1800, t, AU.music, 0.8);
      if (d === 'h') noise(0.04, 0.15, 7000, t, AU.music, 1);
      if (tr.samba && step % 4 === 3) { tone(880, 0.06, 'square', 0.1, t, AU.music); tone(660, 0.06, 'square', 0.1, t + sp / 2, AU.music); }
      next += sp; step++;
    }
  }, 50);
}

// ---------------------------------------------------------------- input
const input = { down: false, blockHeld: false, keys: {} };
const pointers = new Map();
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audioInit();
  const p = toLogical(e); pointers.set(e.pointerId, p);
  onTap(p.x, p.y, e.pointerId);
});
const endPtr = e => { const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (p && p.block) G.blockPtrs--; };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr); cv.addEventListener('pointerleave', endPtr);
window.addEventListener('keydown', e => {
  if (e.repeat) return; audioInit();
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft') onTap(100, 250);
  else if (k === 'd' || k === 'arrowright') onTap(860, 250);
  else if (k === 's' || k === 'arrowdown' || k === ' ') { input.keys.block = true; }
  else if (k === 'w' || k === 'arrowup') useSpecial();
  else if ('1234'.includes(k)) useCard(+k - 1);
  else if (k === 'enter') onTap(480, 250);
});
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 's' || k === 'arrowdown' || k === ' ') input.keys.block = false; });
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------------------------------------------------------------- game state
const G = {
  state: 'loading', t: 0, st: 0, shake: 0, flash: 0, slow: 1, blockPtrs: 0,
  fx: [], texts: [], bubbles: [], particles: [], enemies: [], items: [], hazards: [], banners: [],
  score: 0, kos: 0, maxCombo: 0, friendsCalled: 0, continues: 0, bacPeak: 0, startTime: 0,
};
const P = {}; // player
const B = {}; // boss
function resetPlayer() {
  Object.assign(P, { x: CX, hp: 100, maxhp: 100, face: 1, punchT: 0, punchSide: 1, cool: 0, hurtT: 0, stun: 0, slip: 0,
    bac: 0, buff: 0, ferdy: 0, combo: 0, comboT: 0, special: 0, nunchaku: 0, nunT: 0, held: 0, heldTaps: 0, block: false,
    pushBonus: P.pushBonus || 0, dead: false });
}
const CARDS = [
  { id: 'fede', name: 'FEDE', move: 'PEACEMAKER', cd: 24, t: 10 },
  { id: 'ginevra', name: 'GINEVRA', move: "QUEEN'S SCREAM", cd: 20, t: 6, uses: 0 },
  { id: 'elisabetta', name: 'ELISABETTA', move: 'SPIDER WEB', cd: 18, t: 4 },
  { id: 'christian', name: 'CHRISTIAN', move: 'SARDEGNA AIR STRIKE', cd: 999, t: 0, once: true, used: false },
];
const BTN = {
  cards: [{ x: 8, y: 470, w: 64, h: 64 }, { x: 78, y: 470, w: 64, h: 64 }, { x: 818, y: 470, w: 64, h: 64 }, { x: 888, y: 470, w: 64, h: 64 }],
  block: { x: 372, y: 476, w: 104, h: 58 }, special: { x: 484, y: 476, w: 104, h: 58 },
};
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function setState(s) { G.state = s; G.st = 0; }

// ---------------------------------------------------------------- helpers: text / fx
function text(str, x, y, size = 16, color = '#fff', align = 'center', outline = '#000', ow = 4) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineWidth = ow; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function wrap(str, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = str.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function floatText(str, x, y, color = '#fff', size = 14, life = 0.9, vy = -60) { G.texts.push({ str, x, y, color, size, life, max: life, vy }); }
function bubble(str, x, y, who = 'enemy', life = 2.2, side = 0) { G.bubbles.push({ str, x, y, who, life, max: life, side }); }
function banner(card, name, move, color = '#1ec8ff', life = 1.6) { G.banners.push({ card, name, move, color, life, max: life }); SFX.card(); }
function burst(x, y, color, n = 12, sp = 220, size = 4, life = 0.6, grav = 300) {
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(sp * 0.3, sp); G.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rnd(life * 0.5, life), max: life, color, size, grav }); }
}
function impact(x, y, big = false) { G.fx.push({ type: 'star', x, y, t: 0, life: big ? 0.3 : 0.2, big }); burst(x, y, big ? '#ffe36b' : '#fff', big ? 18 : 8, big ? 320 : 200); }

// ---------------------------------------------------------------- tap handling
function onTap(x, y, pid) {
  const s = G.state;
  if (s === 'loading') return;
  if (s === 'title') { if (G.st > 0.4) startIntro(); return; }
  if (s === 'intro') { introNext(); return; }
  if (s === 'roundcard') return;
  if (s === 'pushup') { pushTap(); return; }
  if (s === 'finish') { finishTap(); return; }
  if (s === 'gameover') { if (G.st > 1.5) continueGame(); return; }
  if (s === 'ending') { endingTap(); return; }
  if (s === 'apology') { if (G.st > 6) startEnding(); return; }
  if (s !== 'fight') return;
  // fight controls
  if (P.held > 0) { P.heldTaps++; floatText('TAP!', CX + rnd(-40, 40), 300, '#ffe36b', 12, 0.4); if (P.heldTaps >= 12) { P.held = 0; floatText('FREE!', CX, 260, '#7CFC00', 22); SFX.parry(); } return; }
  for (let i = 0; i < 4; i++) if (inRect(x, y, BTN.cards[i])) { useCard(i); return; }
  if (inRect(x, y, BTN.block)) { if (pid !== undefined) { const p = pointers.get(pid); if (p) { p.block = true; G.blockPtrs++; } } return; }
  if (inRect(x, y, BTN.special)) { useSpecial(); return; }
  // tap on Ferdy?
  const fe = G.hazards.find(h => h.type === 'ferdy' && !h.done);
  if (fe && Math.abs(x - fe.x) < 70 && y > 300 && y < 500) { ferdyTap(fe); return; }
  let side = x < CX ? -1 : 1;
  if (P.ferdy > 0) side = -side;
  punch(side);
}

// ---------------------------------------------------------------- player actions
function punch(side) {
  if (P.stun > 0 || P.slip > 0 || P.cool > 0 || P.dead) return;
  P.face = side; P.punchT = 0.16; P.punchSide = side; P.cool = 0.2;
  // puddle on that side -> slip
  const pd = G.hazards.find(h => h.type === 'puddle' && h.side === side && h.t > 0.6);
  if (pd) { P.slip = 1.1; P.bac = Math.min(100, P.bac + 6); floatText('SLIP!', CX + side * 60, 380, '#ff9a2e', 18); SFX.slip(); pd.life = 0; G.shake = 6; return; }
  // pickups on that side
  for (const it of G.items) if (!it.got && Math.sign(it.x - CX) === side && Math.abs(it.x - CX) < 260) { collect(it); return; }
  // thrown glass smash
  const gl = G.hazards.find(h => h.type === 'glass' && h.side === side && h.t > h.dur - 0.5 && !h.done);
  if (gl) { gl.done = true; impact(CX + side * 90, 330); floatText('SMASH!', CX + side * 90, 300, '#7CFC00', 16); G.score += 50; SFX.parry(); return; }
  // massimiliano
  const mx = G.hazards.find(h => h.type === 'massi' && !h.done && Math.abs(h.x - CX) < 200 && Math.sign(h.x - CX) === side);
  if (mx) { mx.done = true; mx.fall = 1; impact(mx.x, 380, true); floatText('OUT!', mx.x, 330, '#7CFC00', 16); SFX.hit(); G.score += 150; return; }
  const dmgMult = (P.buff > 0 ? 2 : 1);
  // boss
  if (G.round === 2 && B.alive && Math.sign(B.x - CX) === side && Math.abs(B.x - CX) < 230) {
    if (bossHittable()) {
      if (B.hitCd > 0) { SFX.whiff(); return; }
      const maxHits = B.state === 'stunned' || B.state === 'exposed' ? 4 : 3;
      if ((B.openHits || 0) >= maxHits) { floatText('BLOCKED', B.x, 300, '#9b9bff', 12); SFX.block(); P.combo = 0; return; }
      B.openHits = (B.openHits || 0) + 1; B.hitCd = 0.26;
      const d = 1.0 * (P.buff > 0 ? 1.5 : 1) * (1 + P.pushBonus) * (B.state === 'stunned' || B.state === 'sleep' || B.state === 'dance' ? 1.15 : 1);
      bossDamage(d); impact(B.x - side * 40, 340, dmgMult > 1); SFX.hit(); addCombo(); return;
    } else if (B.state === 'guard' || B.state === 'idle') {
      floatText('BLOCKED', B.x, 300, '#9b9bff', 12); SFX.block();
      if (Math.random() < 0.35 && B.phase >= 2) bossStartAttack('jab', 0.35);
      P.combo = 0; return;
    }
  }
  // enemies
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.ko) continue;
    const dx = (e.x - CX) * side;
    if (dx > 0 && dx < 230 && dx < bd) { bd = dx; best = e; }
  }
  if (best) {
    hitEnemy(best, dmgMult, side); addCombo();
  } else { SFX.whiff(); }
}
function addCombo() {
  P.combo++; P.comboT = 1.4; G.maxCombo = Math.max(G.maxCombo, P.combo);
  if (P.nunchaku <= 0) P.special = Math.min(100, P.special + 7);
  if (P.combo >= 3) floatText(P.combo + ' HIT COMBO', CX, 150, '#ffe36b', 14, 0.6, -20);
}
function hitEnemy(e, dmg, side) {
  if (e.guard > 0) { floatText('GUARD', e.x, 280, '#9b9bff', 11); SFX.block(); P.combo = 0; if (Math.random() < 0.5) { e.state = 'windup'; e.t = 0.25; } return; }
  if (G.round === 1 && G.r1spawned > 4 && Math.random() < 0.22 && e.hp > dmg) { e.guardNext = true; }
  e.hp -= dmg; e.hurt = 0.25; e.x += side * 22; e.state = e.state === 'windup' ? 'walk' : e.state;
  impact(e.x - side * 30, 330, dmg > 1); SFX.hit(); G.shake = Math.max(G.shake, 3); G.score += 25;
  if (e.hp <= 0) koEnemy(e, side);
}
const KO_LINES = ['SORRY BRO!', 'MAMMA!', 'NON VOLEVO!', 'SCUSA FRA!', 'ME NE VADO...', 'TI PREGO NO!'];
function koEnemy(e, side, type) {
  e.ko = true; e.kt = 0; e.koType = type || pick(['faint', 'flee', 'sorry', 'faint', 'flee']);
  e.side = side || e.side; SFX.ko(); G.kos++; G.score += 100;
  if (e.koType === 'sorry') bubble(pick(['SORRY BRO!', 'SCUSA FRA!', 'NON VOLEVO!']), e.x, 230, 'enemy', 1.4);
  if (e.koType === 'flee') bubble(pick(['MAMMA!', 'ME NE VADO!', 'AIUTO!']), e.x, 230, 'enemy', 1.2);
  if (G.round === 1) G.r1left = Math.max(0, G.r1left - 1);
}
function useSpecial() {
  if (G.state !== 'fight' || P.special < 100 || P.nunchaku > 0 || P.dead) return;
  P.special = 0; P.nunchaku = 4.5; P.nunT = 0;
  banner('blackmask', 'BLACK MASK', 'NUNCHAKU!', '#1ec8ff', 1.2);
  bubble('VI FACCIO VEDERE IO...', CX, 170, 'player', 1.6);
}
function useCard(i) {
  if (G.state !== 'fight' || P.dead) return;
  const c = CARDS[i];
  if (c.t > 0 || (c.once && c.used)) { SFX.bad(); return; }
  G.friendsCalled++;
  if (c.id === 'fede') {
    banner('fede', 'FEDE', 'PEACEMAKER', '#ff4b4b');
    bubble('RAGAZZI, CALMA! BASTA COSI!', 120, 170, 'ally', 1.8);
    G.enemies.forEach(e => { if (!e.ko) { e.frozen = 3.2; e.state = 'walk'; } });
    if (B.alive) { B.frozen = 3.2; if (B.state === 'windup') B.state = 'recover', B.t = 0; }
    G.hazards.forEach(h => { if (h.type === 'massi') h.done = true; });
  } else if (c.id === 'ginevra') {
    c.uses++;
    const combo = c.uses % 2 === 0;
    banner(combo ? 'miriana' : 'ginevra', combo ? 'GINEVRA + MIRIANA' : 'GINEVRA', combo ? 'COMBO SCREAM!' : "QUEEN'S SCREAM", '#ffd166');
    SFX.scream(); G.shake = 14; G.fx.push({ type: 'wave', x: CX, y: 330, t: 0, life: 0.7 });
    bubble(combo ? 'ANDATEVENE! ANDATEVENE!' : 'LASCIALO STARE!!!', 140, 160, 'ally', 1.8);
    const d = combo ? 2 : 1;
    G.enemies.forEach(e => { if (!e.ko) { e.x += Math.sign(e.x - CX) * 120; e.hurt = 0.3; e.hp -= d; e.state = 'walk'; if (e.hp <= 0) koEnemy(e, Math.sign(e.x - CX), 'flee'); } });
    if (B.alive && B.phase > 0) { bossDamage(combo ? 4 : 2, true); B.x = CX + Math.sign(B.x - CX) * 300; B.state = 'recover'; B.t = 0; }
  } else if (c.id === 'elisabetta') {
    banner('elisabetta', 'ELISABETTA', 'SPIDER WEB', '#ff3b5c');
    const list = G.enemies.filter(e => !e.ko).sort((a, b) => Math.abs(a.x - CX) - Math.abs(b.x - CX)).slice(0, 2);
    list.forEach(e => { e.webbed = 6; e.state = 'walk'; G.fx.push({ type: 'web', x: e.x, y: 330, t: 0, life: 6 }); });
    if (B.alive && B.phase > 0) { B.webbed = 2.5; B.state = 'stunned'; B.t = 0; B.stunDur = 2.5; G.fx.push({ type: 'web', x: B.x, y: 330, t: 0, life: 2.5 }); }
  } else if (c.id === 'christian') {
    c.used = true;
    banner('christian', 'CHRISTIAN', 'SARDEGNA AIR STRIKE', '#5ad1ff', 1.8);
    G.hazards.push({ type: 'plane', t: 0, life: 3 });
    SFX.plane();
    bubble('ARRIVO DALLA SARDEGNA!', 820, 120, 'ally', 2);
  }
  c.t = c.cd;
}
function collect(it) {
  it.got = true; G.score += 30;
  if (it.kind === 'spritz') { P.bac = Math.min(100, P.bac + 24); P.buff = 10; floatText('SPRITZ! x2 POWER', CX, 220, '#ff9a2e', 16); SFX.drink(); }
  else if (it.kind === 'shot') { P.bac = Math.min(100, P.bac + 48); floatText('TRIPLE SHOT?! BAC UP!', CX, 220, '#ff4b4b', 14); SFX.bad(); }
  else if (it.kind === 'pear') { P.hp = Math.min(P.maxhp, P.hp + 25); P.bac = Math.max(0, P.bac - 35); floatText('PEAR JUICE! BEST SUCCO EVER', CX, 220, '#b8f55a', 12); SFX.pickup(); }
  else if (it.kind === 'heart') { P.hp = Math.min(P.maxhp, P.hp + 8); floatText('+8', CX, 220, '#ff6b9a', 16); SFX.pickup(); }
  burst(it.x, it.y, '#ffe36b', 10);
}
function playerHurt(dmg, src = '') {
  if (P.dead) return;
  let d = dmg;
  const blocking = P.block && P.stun <= 0 && P.held <= 0;
  if (blocking) { d = Math.ceil(dmg * 0.15); SFX.block(); floatText('BLOCK', CX, 280, '#9bd8ff', 12); }
  else { SFX.hit(); G.flash = 0.15; G.shake = Math.max(G.shake, 9); P.hurtT = 0.3; P.combo = 0; }
  P.hp -= d; floatText('-' + d, CX + rnd(-30, 30), 260, '#ff5050', 14);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; gameOver(); }
  return blocking;
}

// ---------------------------------------------------------------- enemies
const TAUNTS = ['SEI 1 CONTRO 15!', 'MA TU CHI SEI?', 'DI CHI SEI AMICO?', 'GUARDA CHE SIAMO 15!', 'CHE VUOI FARE?', 'TI FACCIAMO BRUTTO!', 'VATTENE A CASA!'];
const PLAYER_LINES = ['SIETE TUTTE DELLE PUSSY!', 'IO CE L\'HO CON LUI!', 'STATTI ZITTA, CAPAROCAZZO!', 'MI SONO IMBUCATO. E ALLORA?', 'NEMMENO UN CAZZOTTO MI DATE?', 'VENITE, VENITE!'];
function spawnEnemy(side, opts = {}) {
  const e = { x: side < 0 ? -80 : W + 80, side, hp: opts.hp || 3, state: 'walk', t: 0, hurt: 0, cool: rnd(0.4, 1.2),
    speed: rnd(70, 105) * (opts.fast || 1), ko: false, kt: 0, frozen: 0, webbed: 0, dance: 0, sleep: 0, stunE: 0,
    tint: Math.floor(rnd(0, 3)), scale: rnd(0.84, 0.92), wall: !!opts.wall, dmg: opts.dmg || 8, guard: 0 };
  G.enemies.push(e);
  if (Math.random() < 0.45) bubble(pick(TAUNTS), side < 0 ? 140 : 820, 200, 'enemy', 1.8);
  return e;
}
function updateEnemies(dt) {
  const bySide = { '-1': [], '1': [] };
  for (const e of G.enemies) if (!e.ko) bySide[e.side].push(e);
  for (const s of [-1, 1]) bySide[s].sort((a, b) => Math.abs(a.x - CX) - Math.abs(b.x - CX));
  for (const e of G.enemies) {
    e.t += dt;
    if (e.hurt > 0) e.hurt -= dt;
    if (e.ko) {
      e.kt += dt;
      if (e.koType === 'flee') e.x += Math.sign(e.x - CX || 1) * 260 * dt;
      if (e.kt > 2.4) e.dead = true;
      continue;
    }
    // banana peel
    const bn = G.hazards.find(h => h.type === 'banana' && h.side === e.side && !h.done && Math.abs(e.x - h.x) < 30);
    if (bn) { bn.done = true; koEnemy(e, e.side, 'faint'); floatText('SPLAT!', e.x, 300, '#ffe36b', 18); SFX.slip(); burst(e.x, 470, '#ffe36b', 14); continue; }
    if (e.guardNext && e.hurt <= 0) { e.guardNext = false; e.guard = 0.9; }
    if (e.guard > 0) e.guard -= dt;
    if (e.frozen > 0) { e.frozen -= dt; continue; }
    if (e.webbed > 0) { e.webbed -= dt; continue; }
    if (e.sleep > 0) { e.sleep -= dt; continue; }
    if (e.stunE > 0) { e.stunE -= dt; continue; }
    if (e.dance > 0) {
      e.dance -= dt; e.danceHit = (e.danceHit || 0) - dt;
      if (e.danceHit <= 0) { e.danceHit = 1.1; e.hp -= 1; impact(e.x, 320); SFX.punch(); if (e.hp <= 0) koEnemy(e, e.side, 'faint'); }
      continue;
    }
    const list = bySide[e.side]; const idx = list.indexOf(e);
    const stop = CX + e.side * (130 + idx * 75);
    const dist = (e.x - stop) * e.side;
    if (e.state === 'walk') {
      if (dist > 0) e.x -= e.side * e.speed * dt;
      else { e.x = stop; if (idx === 0) { e.cool -= dt; if (e.cool <= 0) { e.state = 'windup'; e.t = 0; } } }
    } else if (e.state === 'windup') {
      if (e.t > (G.round === 2 ? 0.55 : 0.62)) {
        e.state = 'attack'; e.t = 0;
        if (Math.abs(e.x - CX) < 200) playerHurt(e.dmg);
      }
    } else if (e.state === 'attack') {
      if (e.t > 0.25) { e.state = 'walk'; e.cool = rnd(0.7, 1.5); }
    }
    // trample ferdy
    const fe = G.hazards.find(h => h.type === 'ferdy' && !h.done);
    if (fe && Math.abs(e.x - fe.x) < 40) { ferdyFail(fe); }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

// ---------------------------------------------------------------- boss
function bossReset() {
  Object.assign(B, { alive: true, hp: 100, x: W + 120, side: 1, state: 'enter', t: 0, phase: 0, frozen: 0, webbed: 0,
    hurt: 0, atk: null, windup: 0, combo: 0, stunDur: 0, wallT: 0, exposed: 0, lying: 0, rageT: 0, nextCall: 12, dmgTaken: 0 });
}
function bossHittable() {
  return ['recover', 'stunned', 'exposed', 'sleep', 'dance'].includes(B.state) || (B.state === 'windup' && B.atk === 'hug');
}
function bossDamage(d, raw = false) {
  if (!B.alive) return;
  if (B.phase === 1 && !raw && B.state !== 'exposed') return;
  B.hp -= d; B.hurt = 0.25; G.score += Math.round(d * 20);
  if (B.state === 'windup' && B.atk === 'hug') { B.state = 'recover'; B.t = 0; floatText('INTERRUPTED!', B.x, 260, '#7CFC00', 14); }
  if (B.phase === 1 && B.hp <= 70) { B.phase = 2; B.state = 'idle'; B.t = 0; B.x = CX + 150; B.side = 1; bubble('ADESSO TI SISTEMO IO!', B.x, 160, 'boss', 2); floatText('PHASE 2', CX, 200, '#ff4bd8', 26, 1.4, -10); G.enemies.forEach(e => { if (!e.ko) koEnemy(e, e.side, 'flee'); }); }
  if (B.phase === 2 && B.hp <= 35) { B.phase = 3; B.state = 'idle'; B.t = 0; bubble('MA TU CHE CAZZO SCHERZI?!', B.x, 160, 'boss', 2); floatText('RAGE MODE', CX, 200, '#ff3030', 26, 1.4, -10); G.shake = 16; }
  if (B.hp <= 0) { B.hp = 0; startFinish(); }
}
function bossStartAttack(kind, wind) {
  B.state = 'windup'; B.atk = kind; B.t = 0;
  const rage = B.phase === 3 ? 0.72 : 1;
  B.windup = (wind || { jab: 0.55, hay: 1.05, hug: 0.95 }[kind]) * rage;
  if (kind === 'hug') bubble(pick(['VIENI QUA, ABBRACCIO!', 'IO APPROCCIO CON TUTTE!']), B.x, 170, 'boss', 1.2);
  if (kind === 'hay') floatText('!!', B.x, 200, '#ff3030', 28, 0.6, -10);
}
const BOSS_TAUNTS = ['LA TUA RAGAZZA E UNA DELLE TANTE', 'IO IN SERATA APPROCCIO CON TUTTE', 'MA TU CHE CAZZO SCHERZI?', 'SEI SOLO, FRA!', 'TI FACCIO VEDERE IO'];
function updateBoss(dt) {
  if (!B.alive) return;
  B.t += dt; if (B.hurt > 0) B.hurt -= dt; if (B.hitCd > 0) B.hitCd -= dt;
  if (B.state !== B.prevState) { B.openHits = 0; B.prevState = B.state; }
  if (B.frozen > 0) { B.frozen -= dt; return; }
  if (B.lying) return;
  const stand = CX + B.side * 150;
  switch (B.state) {
    case 'enter':
      B.x = lerp(B.x, W - 130, dt * 2);
      if (B.t > 1.6) { B.phase = 1; B.state = 'hide'; B.t = 0; spawnWall(); }
      break;
    case 'hide': // phase 1: behind his 15 friends
      B.x = lerp(B.x, W - 110, dt * 3);
      B.wallT += dt;
      if (Math.random() < dt / 4.5) throwGlass(1);
      if (G.enemies.filter(e => !e.ko && e.wall).length === 0 && B.t > 1) { B.state = 'exposed'; B.t = 0; bubble(pick(['OH... ASPETTA FRA', 'NO NO NO!']), W - 160, 170, 'boss', 1.4); }
      break;
    case 'exposed':
      B.x = lerp(B.x, CX + 160, dt * 4);
      if (B.t > 3.6) { B.state = 'hide'; B.t = 0; spawnWall(); bubble('RAGAZZI! AIUTO!', B.x, 170, 'boss', 1.4); }
      break;
    case 'idle': case 'guard': {
      B.x = lerp(B.x, stand, dt * 6);
      const gap = B.phase === 3 ? rnd(0.5, 0.9) : rnd(0.8, 1.4);
      if (B.t > gap) {
        const r = Math.random();
        if (r < 0.18) { B.side = -B.side; B.state = 'dash'; B.t = 0; floatText('DASH', B.x, 300, '#ff4bd8', 12); }
        else if (r < 0.48) bossStartAttack('jab');
        else if (r < 0.78) bossStartAttack('hay');
        else bossStartAttack('hug');
        B.combo = B.phase === 3 ? Math.floor(rnd(1, 3)) : 0;
      } else B.state = 'guard';
      if (Math.random() < dt / 7) bubble(pick(BOSS_TAUNTS), B.x, 170, 'boss', 1.6);
      if (B.phase === 3) { B.nextCall -= dt; if (B.nextCall <= 0) { B.nextCall = 16; spawnEnemy(-B.side, { hp: 2 }); bubble('RAGAZZI, TENETELO!', B.x, 170, 'boss', 1.4); } }
      break;
    }
    case 'dash':
      B.x = lerp(B.x, CX + B.side * 150, dt * 9);
      if (B.t > 0.45) { B.state = 'idle'; B.t = 0; }
      break;
    case 'windup':
      B.x = lerp(B.x, stand, dt * 6);
      if (B.t >= B.windup) {
        const dmg = { jab: 8, hay: 20, hug: 12 }[B.atk];
        const parryWin = B.atk === 'hay' && P.block && (P.blockStart !== undefined) && (G.t - P.blockStart) < 0.35;
        if (parryWin) {
          SFX.parry(); floatText('PARRY! COUNTER!', CX, 230, '#7CFC00', 18); G.flash = 0.1; B.state = 'stunned'; B.t = 0; B.stunDur = 1.3;
        } else {
          const blocked = playerHurt(B.atk === 'hug' && P.block ? Math.round(dmg * 1.5) : dmg);
          if (B.atk === 'hug' && !blocked) bubble('LA TUA RAGAZZA E UNA DELLE TANTE!', B.x, 170, 'boss', 1.8);
          if (B.combo > 0) { B.combo--; bossStartAttack(pick(['jab', 'jab', 'hay'])); break; }
          B.state = 'recover'; B.t = 0;
        }
      }
      break;
    case 'recover':
      if (B.t > (B.phase === 3 ? 0.6 : 0.85)) { B.state = 'idle'; B.t = 0; }
      break;
    case 'stunned':
      if (B.webbed > 0) B.webbed -= dt;
      if (B.t > (B.stunDur || 2)) { B.state = 'idle'; B.t = 0; }
      break;
    case 'sleep': if (B.t > 2.5) { B.state = 'idle'; B.t = 0; } break;
    case 'dance': if (B.t > 3) { B.state = 'idle'; B.t = 0; } break;
  }
}
function spawnWall() { for (let i = 0; i < 3; i++) { const e = spawnEnemy(1, { hp: 2, wall: true }); e.x = W + 60 + i * 70; } if (Math.random() < 0.5) spawnEnemy(-1, { hp: 2 }); }

// ---------------------------------------------------------------- hazards & events
function throwGlass(side) {
  side = side || pick([-1, 1]);
  G.hazards.push({ type: 'glass', side, t: 0, dur: 1.6, done: false });
}
const EVENTS = {
  spritz() { spawnItem('spritz'); },
  shot() { spawnItem('shot'); },
  pear() { spawnItem('pear'); },
  glass() { throwGlass(); },
  puddle() { const side = pick([-1, 1]); G.hazards.push({ type: 'puddle', side, t: 0, life: 7 }); floatText('SPILLED SPRITZ!', CX + side * 150, 420, '#ff9a2e', 11, 1.4, -10); },
  massi() {
    const side = pick([-1, 1]);
    G.hazards.push({ type: 'massi', side, x: side < 0 ? -60 : W + 60, t: 0, done: false, fall: 0 });
    bubble('MASSIMILIANO IS COMING!', CX, 140, 'warn', 1.6);
  },
  grab() { if (P.held > 0) return; P.held = 6; P.heldTaps = 0; bubble('IN-DOMUS RESIDENT: "FERMO! NON QUI!"', CX, 140, 'warn', 2); SFX.bad(); },
  spit() {
    banner('daniele', 'DANIELE', 'SPIT ATTACK!', '#ff4b4b');
    const side = pick([-1, 1]);
    G.hazards.push({ type: 'spit', side, t: 0, life: 1.4 });
    setTimeout(() => SFX.spit(), 500);
  },
  lullaby() {
    banner('matteo', 'MATTEO', 'ACCORDION LULLABY', '#b07cff');
    musicOverride('accordion', 5.5);
    G.enemies.forEach(e => { if (!e.ko) { e.sleep = 5; e.state = 'walk'; } });
    if (B.alive && B.phase >= 2 && ['idle', 'guard', 'recover'].includes(B.state)) { B.state = 'sleep'; B.t = 0; }
  },
  samba() {
    banner('enrico', 'ENRICO + ARIANNA', 'SAMBA HEX', '#21c45a');
    musicOverride('samba', 6.5);
    G.fx.push({ type: 'brazil', t: 0, life: 6.5 });
    G.enemies.forEach(e => { if (!e.ko) { e.dance = 6; e.state = 'walk'; e.danceHit = rnd(0.3, 1); } });
    if (B.alive && B.phase >= 2 && ['idle', 'guard', 'recover'].includes(B.state)) { B.state = 'dance'; B.t = 0; }
  },
  carpet() {
    banner('mari', 'MARI · SOFIA · ILARIA · MIRIANA', 'MAGIC CARPET', '#2fd3c8');
    G.hazards.push({ type: 'carpet', t: 0, life: 4.5, threw: false });
  },
  banana() {
    banner('banana', 'BANANA GUY', 'BANANA PEEL', '#ffe36b', 1.2);
    const side = pick([-1, 1]);
    G.hazards.push({ type: 'banana', side, x: CX + side * 230, t: 0, done: false, life: 14 });
  },
  ferdy() {
    if (G.hazards.find(h => h.type === 'ferdy')) return;
    const side = pick([-1, 1]);
    G.hazards.push({ type: 'ferdy', side, x: CX + side * 250, t: 0, taps: 0, done: false, life: 8.5 });
    bubble('FERDY NEEDS HELP! TAP HIM 10 TIMES!', CX, 120, 'warn', 2.6);
    SFX.bad();
  },
};
function spawnItem(kind) {
  const side = pick([-1, 1]);
  G.items.push({ kind, side, x: side < 0 ? -40 : W + 40, y: rnd(250, 330), t: 0, got: false });
  if (kind === 'spritz' || kind === 'shot') floatText(kind === 'shot' ? 'DRINK?' : 'SPRITZ!', side < 0 ? 120 : 840, 220, '#ff9a2e', 12, 1.2, -10);
}
function ferdyTap(f) {
  f.taps++; burst(f.x, 400, '#b8f55a', 6); tone(400 + f.taps * 60, 0.08, 'square', 0.15);
  floatText(f.taps + '/10', f.x, 330, '#b8f55a', 14, 0.5);
  if (f.taps >= 10) {
    f.done = true; f.life = f.t + 1.2; f.saved = true;
    banner('emma', 'EMMA', 'TAKES FERDY TO HER ROOM', '#ffffff');
    P.bac = 0; P.hp = Math.min(P.maxhp, P.hp + 10); CARDS.forEach(c => { if (!c.once) c.t = 0; });
    floatText('FERDY SAVED! BAC 0 · CARDS READY', CX, 200, '#7CFC00', 14, 1.6, -15); SFX.fanfare(); G.score += 500;
  }
}
function ferdyFail(f) {
  if (f.done) return; f.done = true; f.life = f.t + 1.2; f.failed = true;
  floatText('FERDY DOWN!', f.x, 330, '#ff5050', 18); playerHurt(15); SFX.siren();
}
function updateHazards(dt) {
  for (const h of G.hazards) {
    h.t += dt;
    if (h.type === 'glass' && !h.done && h.t >= h.dur) {
      h.done = true; burst(CX + h.side * 60, 330, '#ff9a2e', 14);
      if (!(P.block)) { playerHurt(6); P.bac = Math.min(100, P.bac + 5); floatText('SPLASH!', CX, 300, '#ff9a2e', 14); }
      else SFX.block();
    }
    if (h.type === 'massi' && !h.done) {
      if (h.t > 1.2) h.x -= h.side * 420 * dt;
      if (Math.abs(h.x - CX) < 60) {
        h.done = true;
        if (P.block) { floatText('BLOCKED MASSI!', CX, 260, '#7CFC00', 14); h.fall = 1; SFX.block(); }
        else { playerHurt(10); P.stun = 1.4; floatText('KNOCKED DOWN!', CX, 260, '#ff5050', 16); }
      }
    }
    if (h.type === 'massi' && h.done) { h.x -= h.side * 300 * dt; if (Math.abs(h.x - CX) > 600) h.life = 0; }
    if (h.type === 'spit' && h.t > 0.6 && !h.hit) {
      h.hit = true;
      G.enemies.forEach(e => { if (!e.ko && Math.sign(e.x - CX) === h.side) { e.stunE = 3; floatText('EW!', e.x, 280, '#c8ff6b', 14); } });
      if (B.alive && Math.sign(B.x - CX) === h.side && B.phase >= 2 && B.state !== 'windup') { B.state = 'stunned'; B.t = 0; B.stunDur = 1.6; floatText('EWWW!', B.x, 260, '#c8ff6b', 16); }
    }
    if (h.type === 'carpet' && h.t > 1.6 && !h.threw) {
      h.threw = true;
      const tgt = G.enemies.filter(e => !e.ko)[0];
      if (tgt) { tgt.hp -= 2; impact(tgt.x, 300, true); floatText('HEEL SHOT!', tgt.x, 260, '#2fd3c8', 14); if (tgt.hp <= 0) koEnemy(tgt, tgt.side, 'faint'); }
      else if (B.alive && B.phase > 0) { bossDamage(2, true); impact(B.x, 300, true); floatText('HEEL SHOT!', B.x, 260, '#2fd3c8', 14); }
      for (let i = 0; i < 2; i++) G.items.push({ kind: 'heart', side: i ? 1 : -1, x: CX + (i ? 1 : -1) * rnd(120, 200), y: 40, t: 0, got: false, fall: true });
    }
    if (h.type === 'plane' && h.t > 1.1 && !h.hit) {
      h.hit = true; G.shake = 20; G.flash = 0.2;
      G.enemies.forEach(e => { if (!e.ko) { impact(e.x, 330, true); koEnemy(e, e.side, 'faint'); } });
      if (B.alive && B.phase > 0) bossDamage(8, true);
      floatText('PECORINO STRIKE!', CX, 200, '#ffe36b', 22);
    }
    if (h.type === 'ferdy' && !h.done && h.t > h.life - 0.01) ferdyFail(h);
    if (h.type === 'banana' && h.done) h.life = Math.min(h.life, h.t + 0.3);
  }
  G.hazards = G.hazards.filter(h => !(h.life !== undefined && h.t > h.life) && !(h.type === 'glass' && h.done && h.t > h.dur + 0.3));
  // items move toward centre, then away
  for (const it of G.items) {
    it.t += dt;
    if (it.fall) { it.y = Math.min(330, it.y + 160 * dt); }
    else it.x += -it.side * 70 * dt;
    if (it.t > 9) it.got = true;
  }
  G.items = G.items.filter(i => !i.got);
}

// event schedule (seconds into the round)
const R1_SCHEDULE = [[7, 'spritz'], [12, 'glass'], [17, 'carpet'], [23, 'massi'], [28, 'spit'], [33, 'puddle'], [38, 'pear'],
  [43, 'ferdy'], [52, 'lullaby'], [58, 'grab'], [64, 'shot'], [69, 'samba'], [77, 'banana'], [82, 'glass'], [86, 'massi'], [92, 'spritz'], [98, 'puddle'], [104, 'glass']];
const R2_POOL = ['spritz', 'glass', 'massi', 'spit', 'puddle', 'lullaby', 'grab', 'samba', 'carpet', 'banana', 'shot', 'pear', 'ferdy', 'glass', 'spritz'];

// ---------------------------------------------------------------- flow
function startIntro() {
  audioInit(); music('title'); setState('intro'); G.introIdx = 0; G.introT = 0;
  try { if (document.documentElement.requestFullscreen && matchMedia('(pointer:coarse)').matches) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
}
const INTRO = [
  { t: 'OCTOBER 30, 2026', s: 'IN-DOMUS, MILANO. A HALLOWEEN PARTY.' },
  { t: 'A BALD GUY DRESSED AS MASTRO LINDO HUGS GINEVRA.', s: '"LA TUA RAGAZZA E UNA DELLE TANTE. IO IN SERATA APPROCCIO CON TUTTE."' },
  { t: 'BLACK MASK THROWS HIS WIG ON THE FLOOR.', s: '"ADESSO IO E TE, 1 CONTRO 1. SE HAI LE PALLE."' },
  { t: '...THEN 15 OF HIS FRIENDS SHOW UP.', s: '"FRA, MA CHE VUOI FARE? SEI 1 CONTRO 15!"' },
  { how: true },
];
function introNext() {
  if (G.introT < 0.35) return;
  G.introIdx++; G.introT = 0;
  if (G.introIdx >= INTRO.length) startRound(1);
}
function startRound(n) {
  G.round = n; G.enemies = []; G.items = []; G.hazards = []; G.bubbles = []; G.banners = []; G.rt = 0; G.evIdx = 0;
  if (n === 1) { resetPlayer(); G.r1left = 15; G.r1spawned = 0; G.spawnT = 1.5; G.startTime = performance.now(); B.alive = false; CARDS.forEach(c => { c.t = c.id === 'christian' ? 0 : Math.min(c.t, 8); c.used = false; }); }
  if (n === 2) { bossReset(); P.hp = Math.min(P.maxhp, P.hp + 40); P.bac = Math.max(0, P.bac - 30); CARDS.forEach(c => { if (c.once) c.used = false; c.t = c.once ? 0 : Math.min(c.t, 5); }); G.nextEv = 7; }
  setState('roundcard'); G.roundTitle = n === 1 ? ['ROUND 1', '1 VS 15'] : ['FINAL ROUND', 'MASTRO LINDO'];
  music(n === 1 ? 'fight' : 'boss');
  if (!SFX.voice(n === 1 ? 'round1' : 'fight')) SFX.stamp();
}
function gameOver() { setState('gameover'); SFX.siren(); music('title'); }
function continueGame() { G.continues++; P.pushBonus = P.pushBonus || 0; const r = G.round; if (r === 1) startRound(1); else { const keep = P.pushBonus; resetPlayer(); P.pushBonus = keep; startRound(2); } }
// push-up challenge
function startPushup() { setState('pushup'); G.pu = { reps: 0, taps: [], beat: 0, slipped: false, done: false, msg: '' }; music('title'); }
function pushTap() {
  const pu = G.pu; if (pu.done) { if (G.st > 1) startRound(2); return; }
  const now = G.st; pu.taps.push(now); pu.taps = pu.taps.filter(t => now - t < 0.6);
  if (pu.taps.length >= 4 && !pu.slipped) {
    pu.slipped = true; pu.done = true; pu.msg = 'TOO FAST! TOMMASO HITS HIS CHIN!'; SFX.siren(); P.hp = Math.max(10, P.hp - 10); G.shake = 14; return;
  }
  const ph = (now % 0.75) / 0.75;
  if (ph > 0.7 || ph < 0.15) { pu.reps++; tone(500 + pu.reps * 20, 0.08, 'square', 0.15); floatText('REP ' + pu.reps, 480, 300, '#b8f55a', 16, 0.5); }
  else { floatText('OFF BEAT', 480, 300, '#ff9a2e', 12, 0.4); }
}
// finish + fatality
function startFinish() { setState('finish'); G.hazards = []; G.items = []; P.held = 0; P.nunchaku = 0; G.finTaps = 0; B.state = 'dizzy'; if (!SFX.voice('finishhim')) SFX.stamp(); G.enemies.forEach(e => { if (!e.ko) koEnemy(e, e.side, 'flee'); }); music('boss'); }
function finishTap() {
  G.finTaps++; impact(B.x + rnd(-30, 30), rnd(260, 380)); SFX.hit(); G.shake = 6;
  if (G.finTaps >= 8 && G.state === 'finish') {
    setState('fatality'); G.flash = 0.6; G.shake = 26; B.lying = 1; B.x = CX + (B.x >= CX ? 1 : -1) * 120; SFX.stamp();
    if (!SFX.voice('fatality')) setTimeout(() => SFX.stamp(), 300);
    setTimeout(() => { if (G.state === 'fatality') { setState('apology'); music('win'); } }, 2600);
  }
}
// ending
function startEnding() { setState('ending'); G.endStage = 0; G.endT = 0; SFX.fanfare(); if (!SFX.voice('wins')) {} G.confetti = []; music('win'); }
function endingTap() {
  if (G.endT < 1) return;
  if (G.endStage < 2) { G.endStage++; G.endT = 0; return; }
  if (G.endStage === 2 && G.endT > 4) { G.endStage = 3; G.endT = 0; return; }
  if (G.endStage === 3) { setState('title'); music('title'); G.score = 0; G.kos = 0; G.maxCombo = 0; G.friendsCalled = 0; G.continues = 0; G.bacPeak = 0; P.pushBonus = 0; }
}

// ---------------------------------------------------------------- update
function update(dt) {
  G.t += dt; G.st += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
  if (G.flash > 0) G.flash -= dt;
  for (const p of G.particles) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const t of G.texts) { t.life -= dt; t.y += t.vy * dt; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const b of G.bubbles) b.life -= dt;
  G.bubbles = G.bubbles.filter(b => b.life > 0);
  for (const b of G.banners) b.life -= dt;
  G.banners = G.banners.filter(b => b.life > 0);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.life);

  if (G.state === 'loading') { if (loaded >= imgList.length && G.st > 0.5) setState('title'); return; }
  if (G.state === 'intro') { G.introT += dt; return; }
  if (G.state === 'roundcard') { if (G.st > 2.2) { setState('fight'); if (G.round === 1) bubble(pick(PLAYER_LINES), CX, 170, 'player', 2); else { bubble('SEI UN PELATO DI MERDA!', CX, 170, 'player', 2); } } return; }
  if (G.state === 'pushup') { if (!G.pu.done && G.st > 10) { G.pu.done = true; P.pushBonus = Math.min(0.3, G.pu.reps * 0.02); G.pu.msg = `${G.pu.reps} PUSH-UPS! +${Math.round(P.pushBonus * 100)}% POWER`; SFX.fanfare(); } return; }
  if (G.state === 'apology') {
    if (G.st > 1.0 && !G.ap1) { G.ap1 = true; bubble('SENTI FRA... NON SAPEVO CHE ERA LA TUA RAGAZZA. SCUSA.', B.x, 330, 'boss', 3.5); }
    if (G.st > 3.8 && !G.ap2) { G.ap2 = true; bubble('VA BENE FRA. BASTA CHE NON FAI LO SPLENDIDO CON ME.', CX - 40, 170, 'player', 3.5); }
    if (G.st > 6.8 && !G.ap3) { G.ap3 = true; SFX.stamp(); G.shake = 12; }
    if (G.st > 10.5) { G.ap1 = G.ap2 = G.ap3 = false; startEnding(); }
    return;
  }
  if (G.state === 'ending') { G.endT += dt; if (Math.random() < 0.6) G.confetti.push({ x: rnd(0, W), y: -10, vy: rnd(60, 140), vx: rnd(-30, 30), c: pick(['#1ec8ff', '#ff4bd8', '#ffe36b', '#7CFC00', '#ff9a2e']), r: rnd(0, 6) }); for (const c of G.confetti) { c.y += c.vy * dt; c.x += c.vx * dt; c.r += dt * 4; } G.confetti = G.confetti.filter(c => c.y < H + 20); return; }
  if (G.state !== 'fight' && G.state !== 'finish' && G.state !== 'fatality') return;
  if (G.state !== 'fight') { updateBoss(dt); return; }

  // ---- fight
  G.rt += dt;
  P.block = (G.blockPtrs > 0 || input.keys.block) && P.stun <= 0;
  if (P.block && P.blockStart === undefined) P.blockStart = G.t;
  if (!P.block) P.blockStart = undefined;
  if (P.punchT > 0) P.punchT -= dt;
  if (P.cool > 0) P.cool -= dt;
  if (P.hurtT > 0) P.hurtT -= dt;
  if (P.stun > 0) P.stun -= dt;
  if (P.slip > 0) P.slip -= dt;
  if (P.buff > 0) P.buff -= dt;
  if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
  if (P.held > 0) { P.held -= dt; if (P.held <= 0) { floatText('LET GO', CX, 260, '#fff', 12); } }
  // BAC
  P.bac = Math.max(0, P.bac - dt * 1.6); G.bacPeak = Math.max(G.bacPeak, P.bac);
  if (P.ferdy > 0) { P.ferdy -= dt; if (P.ferdy <= 0) { P.bac = 55; floatText('BACK TO NORMAL', CX, 200, '#fff', 14); } }
  else if (P.bac >= 99.5) { P.ferdy = 5; floatText('FERDY MODE!', CX, 200, '#b8f55a', 28, 1.5, -10); SFX.bad(); }
  // nunchaku
  if (P.nunchaku > 0) {
    P.nunchaku -= dt; P.nunT -= dt;
    if (P.nunT <= 0) {
      P.nunT = 0.22;
      for (const e of G.enemies) if (!e.ko && Math.abs(e.x - CX) < 260) { e.hp -= 1; impact(e.x, 320); if (e.hp <= 0 || Math.random() < 0.35) { koEnemy(e, Math.sign(e.x - CX), 'flee'); bubble(pick(['AIUTO!', 'E ARMATO!', 'SCAPPA!']), e.x, 230, 'enemy', 1); } }
      if (B.alive && B.phase >= 2 && Math.abs(B.x - CX) < 260) { bossDamage(0.6, true); impact(B.x, 320); }
      SFX.whiff();
    }
  }
  // cards cooldown
  CARDS.forEach(c => { if (!c.once && c.t > 0) c.t -= dt; });
  // round logic
  if (G.round === 1) {
    G.spawnT -= dt;
    const active = G.enemies.filter(e => !e.ko).length;
    const maxA = G.rt < 20 ? 2 : G.rt < 50 ? 3 : 4;
    if (G.spawnT <= 0 && G.r1spawned < 15 && active < maxA) {
      spawnEnemy(G.r1spawned % 2 === 0 ? 1 : (Math.random() < 0.5 ? -1 : 1), { hp: G.r1spawned < 3 ? 2 : G.r1spawned < 9 ? 3 : 4, fast: G.rt > 50 ? 1.25 : 1 });
      G.r1spawned++; G.spawnT = G.rt < 30 ? rnd(4.5, 6) : rnd(3, 4.5);
    }
    while (G.evIdx < R1_SCHEDULE.length && G.rt >= R1_SCHEDULE[G.evIdx][0]) { EVENTS[R1_SCHEDULE[G.evIdx][1]](); G.evIdx++; }
    if (G.r1left <= 0 && G.enemies.filter(e => !e.ko).length === 0 && !G.r1done) {
      G.r1done = true; floatText('ALL 15 DOWN!', CX, 200, '#7CFC00', 24, 2, -10); SFX.fanfare();
      setTimeout(() => { G.r1done = false; startPushup(); }, 2200);
    }
    if (Math.random() < dt / 9) bubble(pick(TAUNTS), Math.random() < 0.5 ? 140 : 820, 200, 'enemy', 1.6);
    if (Math.random() < dt / 14) bubble(pick(PLAYER_LINES), CX, 170, 'player', 1.8);
  } else {
    G.nextEv -= dt;
    if (G.nextEv <= 0) { G.nextEv = rnd(8, 12); EVENTS[R2_POOL[G.evIdx % R2_POOL.length]](); G.evIdx++; }
    updateBoss(dt);
  }
  updateEnemies(dt);
  updateHazards(dt);
  if (P.held > 0 && Math.random() < dt / 1.2) { const e = G.enemies.find(e => !e.ko); if (e) { /* free hits on held player */ } }
}

// ---------------------------------------------------------------- draw helpers
function drawSprite(im, x, yBottom, h, flip = false, opts = {}) {
  if (!im || !im.width) return;
  const s = h / im.height, w = im.width * s;
  ctx.save();
  ctx.translate(x, yBottom);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.scale(flip ? -1 : 1, 1);
  if (opts.sx || opts.sy) ctx.scale(opts.sx || 1, opts.sy || 1);
  ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
  if (opts.filter) ctx.filter = opts.filter;
  ctx.drawImage(im, -w / 2, -h, w, h);
  if (opts.white) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = opts.white; ctx.drawImage(im, -w / 2, -h, w, h); }
  ctx.restore();
}
function drawCard(id, x, y, size, border = '#fff') {
  const im = IMG['card_' + id];
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, size + 6, size + 6);
  if (im && im.width) {
    const s = Math.max(size / im.width, size / im.height);
    const w = im.width * s, h = im.height * s;
    ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.drawImage(im, x + (size - w) / 2, y + (size - h) / 2, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
}
function bar(x, y, w, h, v, color, back = '#111', right = false) {
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  const fw = w * clamp(v, 0, 1);
  ctx.fillRect(right ? x + w - fw : x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(right ? x + w - fw : x, y, fw, h * 0.35);
}
function drawBubble(b) {
  const alpha = Math.min(1, b.life / 0.25, (b.max - b.life) / 0.12 + 0.2);
  const size = 10, lines = wrap(b.str, 300, size);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22, h = lines.length * 16 + 16;
  let x = clamp(b.x - w / 2, 6, W - w - 6), y = b.y - h;
  const col = { enemy: '#ffffff', player: '#9ff3ff', boss: '#ffb3f0', ally: '#fff3a8', warn: '#ff5050' }[b.who] || '#fff';
  ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#0b0b16'; ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(clamp(b.x, x + 12, x + w - 12) - 8, y + h); ctx.lineTo(clamp(b.x, x + 12, x + w - 12), y + h + 12); ctx.lineTo(clamp(b.x, x + 12, x + w - 12) + 8, y + h); ctx.fill();
  lines.forEach((l, i) => text(l, x + w / 2, y + 16 + i * 16, size, b.who === 'warn' ? '#ff8080' : col, 'center', null));
  ctx.restore();
}
function drawGlassIcon(x, y, s = 1, red = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = red ? '#ff3b3b' : '#ff9a2e'; ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(14, -20); ctx.lineTo(10, 18); ctx.lineTo(-10, 18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-9, -14, 4, 24);
  if (red) { text('x3', 0, 0, 9, '#fff', 'center', '#000', 3); }
  else { ctx.strokeStyle = '#ff5a2e'; ctx.beginPath(); ctx.moveTo(4, -20); ctx.lineTo(12, -34); ctx.stroke(); }
  ctx.restore();
}
function drawItem(it) {
  const bob = Math.sin(G.t * 6 + it.x) * 4;
  ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
  if (it.kind === 'spritz') { const im = IMG.spritz; if (im.width) drawSprite(im, it.x, it.y + 30 + bob, 60); else drawGlassIcon(it.x, it.y + bob); }
  else if (it.kind === 'shot') drawGlassIcon(it.x, it.y + bob, 1.2, true);
  else if (it.kind === 'pear') {
    ctx.fillStyle = '#b8f55a'; ctx.beginPath(); ctx.ellipse(it.x, it.y + bob + 6, 16, 18, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(it.x, it.y + bob - 12, 10, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b3d1e'; ctx.fillRect(it.x - 2, it.y + bob - 30, 4, 10);
    text('SUCCO', it.x, it.y + bob + 34, 8, '#fff');
  } else if (it.kind === 'heart') {
    ctx.fillStyle = '#ff4b8b'; ctx.beginPath(); const x = it.x, y = it.y + bob;
    ctx.moveTo(x, y + 12); ctx.bezierCurveTo(x - 22, y - 4, x - 10, y - 20, x, y - 8); ctx.bezierCurveTo(x + 10, y - 20, x + 22, y - 4, x, y + 12); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- scenes
function drawTitle() {
  const im = IMG.scene;
  const z = 1.0 + 0.025 * (0.5 + 0.5 * Math.sin(G.t * 0.15));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  if (im.width) ctx.drawImage(im, 0, 0, W, 536);
  // carpet bob & broccoli push-ups (re-draw crops from the scene)
  if (im.width) {
    const sx = im.width / W;
    const cb = Math.sin(G.t * 1.8) * 3;
    ctx.drawImage(im, 760 * sx, 0, 190 * sx, 118 * sx, 760, cb, 190, 118);
    const pb = Math.max(0, Math.sin(G.t * 3)) * 3;
    ctx.drawImage(im, 790 * sx, 150 * sx, 130 * sx, 100 * sx, 790, 150 + pb, 130, 100);
  }
  // fighters breathing + aura flicker
  const br = 1 + 0.012 * Math.sin(G.t * 3);
  drawSprite(IMG.blackmask, 330 + 77, 516, 292 * br, false, { white: 0.08 + 0.08 * Math.sin(G.t * 9) });
  drawSprite(IMG.mastro, 522 + 67, 516, 286 * (2 - br), false, { white: 0.06 + 0.06 * Math.sin(G.t * 8 + 1) });
  ctx.restore();
  // particles: aura flames, smoke, sparks, zzz
  if (Math.random() < 0.7) G.particles.push({ x: rnd(345, 470), y: rnd(330, 500), vx: rnd(-10, 10), vy: rnd(-90, -50), life: 0.9, max: 0.9, color: '#3fe6ff', size: rnd(2, 4), grav: 0 });
  if (Math.random() < 0.7) G.particles.push({ x: rnd(535, 650), y: rnd(330, 500), vx: rnd(-10, 10), vy: rnd(-90, -50), life: 0.9, max: 0.9, color: '#ff4bd8', size: rnd(2, 4), grav: 0 });
  if (Math.random() < 0.25) G.particles.push({ x: rnd(495, 540), y: 95, vx: rnd(-6, 6), vy: rnd(-30, -15), life: 3, max: 3, color: 'rgba(120,120,130,0.5)', size: rnd(6, 12), grav: 0, smoke: true });
  if (Math.random() < 0.1) G.particles.push({ x: 492, y: 112, vx: rnd(-60, 60), vy: rnd(-80, -20), life: 0.5, max: 0.5, color: '#ffb02e', size: 2, grav: 200 });
  drawParticles();
  // moon glow
  const mg = ctx.createRadialGradient(734, 30, 2, 734, 30, 60);
  mg.addColorStop(0, `rgba(220,230,255,${0.35 + 0.1 * Math.sin(G.t * 2)})`); mg.addColorStop(1, 'rgba(220,230,255,0)');
  ctx.fillStyle = mg; ctx.fillRect(670, -30, 130, 120);
  // ambulance lights
  const on = Math.floor(G.t * 4) % 2;
  [[852, 258, on ? '#3d7bff' : '#ff3b3b'], [920, 264, on ? '#ff3b3b' : '#3d7bff']].forEach(([x, y, c]) => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, 40); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6; ctx.fillStyle = g; ctx.fillRect(x - 40, y - 40, 80, 80); ctx.globalAlpha = 1;
  });
  // zzz for Matteo
  const zz = (G.t * 0.8) % 1;
  text('z', 150 + zz * 20, 70 - zz * 30, 10 + zz * 6, `rgba(255,255,255,${1 - zz})`, 'center', null);
  // vignette + title
  const vg = ctx.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,.55)'); vg.addColorStop(0.25, 'rgba(0,0,0,0)'); vg.addColorStop(0.75, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const ty = 48 + Math.sin(G.t * 2) * 2;
  text('THE ULTIMATE BATTLE', W / 2 + 3, ty + 3, 30, '#9b1fff', 'center', null);
  text('THE ULTIMATE BATTLE', W / 2, ty, 30, '#fff', 'center', '#000', 6);
  text('HALLOWEEN 2026 EDITION', W / 2, ty + 40, 14, '#ffb547', 'center', '#000', 5);
  if (Math.floor(G.t * 2.2) % 2 === 0) text('TAP TO START', W / 2, 480, 20, '#fff', 'center', '#000', 6);
  text('BLACK MASK  VS  MASTRO LINDO', W / 2, 514, 9, '#9bd8ff', 'center', '#000', 4);
}
function drawStage() {
  const im = IMG.stage;
  if (im.width) ctx.drawImage(im, 0, 0, W, 536);
  ctx.fillStyle = '#05050a'; ctx.fillRect(0, 536, W, 4);
  // floor shadow band
  const g = ctx.createLinearGradient(0, 420, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 420, W, 120);
}
function drawParticles() {
  for (const p of G.particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    if (p.smoke) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - p.life / p.max), 0, 7); ctx.fill(); }
    else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawEnemy(e) {
  const flip = e.side < 0; // sprite faces left
  let x = e.x, y = FLOOR, h = 250 * e.scale, rot = 0, alpha = 1, sy = 1, sx = 1;
  const filters = ['none', 'brightness(1.2)', 'brightness(0.85)'];
  if (e.ko) {
    if (e.koType === 'faint') { rot = (flip ? -1 : 1) * Math.min(1, e.kt * 3) * 1.45; alpha = clamp(2.4 - e.kt, 0, 1); }
    if (e.koType === 'sorry') { sy = 0.72; alpha = clamp(2.4 - e.kt, 0, 1); }
    if (e.koType === 'flee') { alpha = clamp(2.4 - e.kt, 0, 1); y += Math.abs(Math.sin(e.kt * 14)) * -8; }
  }
  if (e.dance > 0) { rot = Math.sin(G.t * 10 + e.x) * 0.15; y -= Math.abs(Math.sin(G.t * 10 + e.x)) * 12; }
  if (e.sleep > 0) rot = (flip ? 1 : -1) * 0.12;
  if (e.state === 'windup') { x += e.side * -8 * Math.min(1, e.t * 3); }
  if (e.state === 'attack') { x -= e.side * 28; }
  ctx.save();
  if (e.state === 'windup' && !e.ko) { ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 18 + 10 * Math.sin(G.t * 30); }
  drawSprite(IMG.hench, x, y, h, e.koType === 'flee' ? !flip : flip, { rot, alpha, sy, sx, white: e.hurt > 0 ? 0.6 : 0, filter: filters[e.tint] });
  ctx.restore();
  if (e.ko && e.koType === 'flee') { burst(x + (flip ? 20 : -20), 300, '#7fd3ff', 1, 60, 3, 0.4, 400); }
  if (e.ko && e.koType === 'faint' && e.kt > 0.4) text('Z', x, 420 - (e.kt % 1) * 20, 12, '#fff', 'center', '#000', 3);
  if (!e.ko) {
    if (e.state === 'windup') text('!', x, 230, 22, '#ff3030', 'center', '#000', 5);
    if (e.frozen > 0) text('PEACE', x, 230, 10, '#ff8080', 'center', '#000', 4);
    if (e.guard > 0) text('GUARD', x, 230, 10, '#9b9bff', 'center', '#000', 4);
    if (e.sleep > 0) text('Zzz', x + 20, 240 - (G.t % 1) * 15, 14, '#d0b3ff', 'center', '#000', 4);
    if (e.stunE > 0) text('EW!', x, 240, 12, '#c8ff6b', 'center', '#000', 4);
    if (e.dance > 0) text('♪', x + Math.sin(G.t * 5) * 20, 230, 18, '#21c45a', 'center', '#000', 4);
    // hp pips
    for (let i = 0; i < e.hp; i++) { ctx.fillStyle = '#ff4b4b'; ctx.fillRect(x - 15 + i * 11, 262, 8, 5); }
  }
}
function drawBoss() {
  if (!B.alive && G.state !== 'apology' && G.state !== 'fatality' && G.state !== 'finish') return;
  const flip = B.x < CX;
  let x = B.x, rot = 0, sy = 1, sx = 1, h = 300, white = B.hurt > 0 ? 0.6 : 0, y = FLOOR;
  if (B.state === 'windup') {
    const k = Math.min(1, B.t / B.windup);
    x += (flip ? 1 : -1) * -14 * k;
    if (B.atk === 'hay') { sx = 1 + 0.06 * k; white = Math.max(white, (Math.sin(G.t * 40) > 0 ? 0.35 : 0) * k); }
    if (B.atk === 'hug') { white = Math.max(white, 0.15); }
  }
  if (B.state === 'recover' && B.t < 0.2) x += (flip ? 1 : -1) * -30;
  if (B.state === 'stunned' || B.state === 'dizzy') rot = Math.sin(G.t * 8) * 0.08;
  if (B.state === 'dance') { rot = Math.sin(G.t * 10) * 0.15; y -= Math.abs(Math.sin(G.t * 10)) * 12; }
  if (B.state === 'sleep') rot = (flip ? 1 : -1) * 0.1;
  if (B.lying) { rot = (flip ? -1 : 1) * 1.5; y = FLOOR - 20; }
  const auraCol = B.phase === 3 ? '#ff2030' : '#ff4bd8';
  ctx.save();
  ctx.shadowColor = auraCol; ctx.shadowBlur = B.state === 'windup' ? 30 : 14;
  if (B.state === 'hide') { ctx.globalAlpha = 0.85; h = 270; }
  drawSprite(IMG.mastro, x, y, h, flip, { rot, sx, sy, white });
  ctx.restore();
  if (B.state === 'windup' && !B.lying) {
    const lbl = { jab: 'JAB', hay: 'HAYMAKER! BLOCK!', hug: 'HUG! PUNCH HIM!' }[B.atk];
    text(lbl, x, 190, B.atk === 'jab' ? 10 : 12, B.atk === 'hay' ? '#ff3030' : B.atk === 'hug' ? '#ff9ad8' : '#fff', 'center', '#000', 4);
    const k = Math.min(1, B.t / B.windup);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 40, 202, 80, 6); ctx.fillStyle = B.atk === 'hay' ? '#ff3030' : '#ffb3f0'; ctx.fillRect(x - 40, 202, 80 * k, 6);
  }
  if (B.state === 'guard') text('GUARD', x, 200, 9, '#9b9bff', 'center', '#000', 3);
  if (B.state === 'recover' || B.state === 'stunned' || B.state === 'exposed') text(B.state === 'exposed' ? 'EXPOSED!' : 'OPEN!', x, 200, 11, '#7CFC00', 'center', '#000', 4);
  if (B.state === 'sleep') text('Zzz', x + 20, 200 - (G.t % 1) * 15, 16, '#d0b3ff', 'center', '#000', 4);
  if ((B.state === 'dizzy' || B.state === 'stunned') && !B.lying) { for (let i = 0; i < 3; i++) { const a = G.t * 5 + i * 2.1; text('★', x + Math.cos(a) * 30, 215 + Math.sin(a) * 8, 12, '#ffe36b', 'center', null); } }
}
function drawPlayer() {
  let x = CX, rot = 0, sx = 1, sy = 1, h = 290, white = P.hurtT > 0 ? 0.6 : 0;
  const flip = P.face < 0; // sprite faces right
  sy = 1 + 0.012 * Math.sin(G.t * 3);
  if (P.punchT > 0) { const k = Math.sin((1 - P.punchT / 0.16) * Math.PI); x += P.punchSide * 36 * k; rot = P.punchSide * 0.07 * k; }
  if (P.slip > 0) rot = P.face * -0.5 * Math.min(1, (1.1 - P.slip) * 4);
  if (P.stun > 0) rot = Math.sin(G.t * 9) * 0.1;
  // drunk sway
  const sway = P.bac / 100;
  rot += Math.sin(G.t * 2.2) * 0.06 * sway;
  ctx.save();
  if (P.nunchaku > 0) { ctx.shadowColor = '#3fe6ff'; ctx.shadowBlur = 30; }
  drawSprite(IMG.blackmask, x, FLOOR, h, flip, { rot, sx, sy, white });
  if (P.ferdy > 0) drawSprite(IMG.blackmask, x + 14 * Math.sin(G.t * 3), FLOOR, h, flip, { rot, alpha: 0.35 });
  ctx.restore();
  if (P.nunchaku > 0) {
    ctx.save(); ctx.translate(CX, 330); ctx.rotate(G.t * 22);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(120, 0); ctx.stroke();
    ctx.fillStyle = '#7a4b2a'; ctx.fillRect(-135, -8, 40, 16); ctx.fillRect(95, -8, 40, 16);
    ctx.restore();
  }
  if (P.block) {
    ctx.save(); ctx.strokeStyle = 'rgba(120,220,255,.85)'; ctx.lineWidth = 6; ctx.shadowColor = '#3fe6ff'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(CX, 360, 120, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(CX, 360, 120, Math.PI * 0.15 - 0.3, Math.PI * 0.15 + 0.3, false); ctx.restore();
  }
  if (P.held > 0) {
    text('HELD! TAP TAP TAP!', CX, 200, 14, '#ff5050', 'center', '#000', 5);
    drawSprite(IMG.hench, CX - 20, FLOOR, 260, true, { alpha: 0.7, filter: 'brightness(1.4) hue-rotate(160deg)' });
    bar(CX - 80, 215, 160, 8, P.heldTaps / 12, '#7CFC00');
  }
  if (P.stun > 0) text('★ ★ ★', CX, 205, 12, '#ffe36b', 'center', '#000', 3);
}
function drawHazards() {
  for (const h of G.hazards) {
    if (h.type === 'puddle') {
      const a = Math.min(1, h.t / 0.6) * (h.t > h.life - 0.5 ? (h.life - h.t) / 0.5 : 1);
      ctx.save(); ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#ff8a1e';
      ctx.beginPath(); ctx.ellipse(CX + h.side * 150, FLOOR - 4, 90, 14, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = a; text('SPRITZ PUDDLE', CX + h.side * 150, FLOOR + 20, 8, '#ffcf8a', 'center', '#000', 3); ctx.restore();
    }
    if (h.type === 'glass' && !h.done) {
      const k = h.t / h.dur; const sx = CX + h.side * 420, ex = CX + h.side * 70;
      const x = lerp(sx, ex, k), y = lerp(180, 330, k) - Math.sin(k * Math.PI) * 140;
      drawGlassIcon(x, y, 1, false);
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 20); ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(ex, FLOOR - 4, 30, 8, 0, 0, 7); ctx.stroke(); ctx.restore();
      if (k > 0.65) text('PUNCH IT!', ex, 250, 9, '#ff5050', 'center', '#000', 3);
    }
    if (h.type === 'massi') {
      const y = FLOOR;
      drawSprite(IMG.hench, h.x, y + (h.fall ? 20 : 0), 240, h.side < 0, { rot: h.fall ? h.side * 1.2 : Math.sin(G.t * 8) * 0.18, filter: 'sepia(1) saturate(3) hue-rotate(40deg) brightness(1.1)' });
      text('MASSIMILIANO', h.x, 245, 9, '#ffe36b', 'center', '#000', 4);
      if (!h.done && h.t < 1.2) text(h.side < 0 ? '◀ BLOCK!' : 'BLOCK! ▶', h.side < 0 ? 90 : 870, 300, 14, '#ff5050', 'center', '#000', 5);
    }
    if (h.type === 'spit') {
      const x = CX + h.side * 200;
      for (let i = 0; i < 6; i++) {
        const k = clamp(h.t / 0.6 - i * 0.05, 0, 1);
        ctx.fillStyle = 'rgba(210,255,170,.9)'; ctx.beginPath(); ctx.ellipse(x + (i - 3) * 22, lerp(-20, 300, k), 7, 11, 0, 0, 7); ctx.fill();
      }
      if (h.t > 0.6) text('PTUH!', x, 180, 22, '#c8ff6b', 'center', '#000', 6);
      text('5TH FLOOR', x, 40, 9, '#fff', 'center', '#000', 3);
    }
    if (h.type === 'carpet') {
      const k = h.t / h.life; const im = IMG.card_carpet;
      if (im.width) { const w = 240, hh = 240 * im.height / im.width; ctx.drawImage(im, lerp(W + 20, -260, k), 60 + Math.sin(G.t * 3) * 8, w, hh); }
    }
    if (h.type === 'banana' && !h.done) {
      ctx.save(); ctx.translate(h.x, FLOOR - 6); ctx.fillStyle = '#ffe36b';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0.1, 0, 7); ctx.fill(); ctx.fillStyle = '#6b4a10'; ctx.fillRect(16, -3, 8, 4); ctx.restore();
    }
    if (h.type === 'plane') {
      const k = h.t / h.life; const im = IMG.plane;
      if (im.width) { const w = 520, hh = w * im.height / im.width; ctx.drawImage(im, lerp(-560, W + 40, k), 30 + Math.sin(k * 6) * 10, w, hh); }
      if (h.t > 0.6 && h.t < 1.3) for (let i = 0; i < 6; i++) { const yy = lerp(120, 360, (h.t - 0.6) / 0.7); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(120 + i * 145, yy, 18, 9, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#a07a2a'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    if (h.type === 'ferdy') {
      const a = h.done ? clamp(h.life - h.t, 0, 1) : 1;
      ctx.save(); ctx.globalAlpha = a;
      const wob = Math.sin(G.t * 4) * 0.2;
      ctx.translate(h.x, 400); ctx.rotate(h.failed ? 1.4 : wob);
      ctx.fillStyle = 'rgba(140,255,120,.25)'; ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill();
      ctx.restore(); ctx.save(); ctx.globalAlpha = a;
      drawCard('ferdy', h.x - 45, 355 + Math.sin(G.t * 4) * 6, 90, h.saved ? '#7CFC00' : '#b8f55a');
      ctx.restore();
      if (!h.done) {
        text('FERDY', h.x, 345, 10, '#b8f55a', 'center', '#000', 4);
        text(`TAP ME ${h.taps}/10`, h.x, 465, 9, '#fff', 'center', '#000', 4);
        bar(h.x - 45, 478, 90, 6, 1 - h.t / h.life, '#b8f55a');
      }
    }
  }
  for (const it of G.items) drawItem(it);
}
function drawFx() {
  for (const f of G.fx) {
    const k = f.t / f.life;
    if (f.type === 'star') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(k * 2); ctx.fillStyle = f.big ? '#ffe36b' : '#fff'; ctx.globalAlpha = 1 - k;
      const r = (f.big ? 50 : 32) * (0.5 + k);
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.4 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill();
      ctx.restore();
      if (f.t < 0.05) text(pick(['POW!', 'BAM!', 'SOCK!', 'WHAM!']), f.x, f.y - 30, f.big ? 18 : 12, '#ff4b4b', 'center', '#fff', 4);
    }
    if (f.type === 'wave') { ctx.save(); ctx.strokeStyle = `rgba(255,209,102,${1 - k})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(f.x, f.y, 40 + k * 600, 0, 7); ctx.stroke(); ctx.restore(); }
    if (f.type === 'web') { ctx.save(); ctx.globalAlpha = Math.min(1, (f.life - f.t)); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * 80, f.y + Math.sin(a) * 120); ctx.stroke(); } for (let r = 20; r < 90; r += 20) { ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * 1.4, 0, 0, 7); ctx.stroke(); } ctx.restore(); }
    if (f.type === 'brazil') { ctx.save(); ctx.globalAlpha = 0.18 * (1 - k * 0.5); ctx.fillStyle = Math.floor(G.t * 4) % 2 ? '#21c45a' : '#ffd400'; ctx.fillRect(0, 0, W, H); ctx.restore(); text('♪ SAMBA! ♪', W / 2 + Math.sin(G.t * 6) * 60, 120, 18, '#ffd400', 'center', '#0a5a2a', 6); }
  }
}
function drawHUD() {
  // player
  text('BLACK MASK', 20, 22, 14, '#fff', 'left', '#000', 5);
  bar(20, 36, 300, 16, P.hp / P.maxhp, P.hp < 30 ? '#ff4040' : '#1ec8ff');
  // BAC meter
  text('BAC', 20, 66, 8, '#ff9a2e', 'left', '#000', 3);
  bar(52, 61, 140, 8, P.bac / 100, P.bac > 75 ? '#ff4040' : '#ff9a2e');
  if (P.buff > 0) text('x2 POWER', 200, 66, 8, '#ffe36b', 'left', '#000', 3);
  if (P.ferdy > 0) text('FERDY MODE! CONTROLS INVERTED', 20, 84, 8, '#b8f55a', 'left', '#000', 3);
  // right side
  if (G.round === 1) {
    text('MASTRO LINDO\'S FRIENDS', W - 20, 22, 10, '#ff9ad8', 'right', '#000', 4);
    text(`${G.r1left} / 15 LEFT`, W - 20, 46, 14, '#fff', 'right', '#000', 5);
  } else if (B.alive || G.state !== 'fight') {
    text('MASTRO LINDO', W - 20, 22, 14, '#fff', 'right', '#000', 5);
    bar(W - 320, 36, 300, 16, B.hp / 100, B.phase === 3 ? '#ff2030' : '#a020ff', '#111', true);
    text(['', 'PHASE 1: HIDING', 'PHASE 2: DUEL', 'PHASE 3: RAGE'][B.phase] || '', W - 20, 66, 8, '#ff9ad8', 'right', '#000', 3);
  }
  text(String(G.score).padStart(6, '0'), W / 2, 22, 12, '#ffe36b', 'center', '#000', 4);
  // buttons
  CARDS.forEach((c, i) => {
    const r = BTN.cards[i];
    drawCard(c.id, r.x, r.y, r.w, c.t <= 0 && !(c.once && c.used) ? '#ffe36b' : '#555');
    if (c.t > 0 || (c.once && c.used)) {
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      const frac = c.once ? 1 : c.t / c.cd; ctx.fillRect(r.x, r.y, r.w, r.h * clamp(frac, 0, 1));
      text(c.once ? 'USED' : Math.ceil(c.t) + '', r.x + r.w / 2, r.y + r.h / 2, 12, '#fff', 'center', '#000', 4);
    } else if (Math.floor(G.t * 3) % 2) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); }
    text(c.name, r.x + r.w / 2, r.y - 8, 7, '#fff', 'center', '#000', 3);
  });
  const bb = BTN.block, sp = BTN.special;
  ctx.fillStyle = P.block ? 'rgba(30,200,255,.6)' : 'rgba(10,10,30,.75)'; ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  ctx.strokeStyle = '#1ec8ff'; ctx.lineWidth = 3; ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
  text('BLOCK', bb.x + bb.w / 2, bb.y + 22, 11, '#fff', 'center', '#000', 3);
  text('(HOLD)', bb.x + bb.w / 2, bb.y + 42, 7, '#9bd8ff', 'center', null);
  const ready = P.special >= 100 && P.nunchaku <= 0;
  ctx.fillStyle = ready ? (Math.floor(G.t * 4) % 2 ? 'rgba(255,227,107,.8)' : 'rgba(255,154,46,.8)') : 'rgba(10,10,30,.75)'; ctx.fillRect(sp.x, sp.y, sp.w, sp.h);
  ctx.fillStyle = 'rgba(30,200,255,.5)'; ctx.fillRect(sp.x, sp.y + sp.h - 8, sp.w * (P.special / 100), 8);
  ctx.strokeStyle = '#ffe36b'; ctx.strokeRect(sp.x, sp.y, sp.w, sp.h);
  text('NUNCHAKU', sp.x + sp.w / 2, sp.y + 22, 9, ready ? '#000' : '#fff', 'center', ready ? null : '#000', 3);
  text(ready ? 'READY!' : Math.floor(P.special) + '%', sp.x + sp.w / 2, sp.y + 40, 8, ready ? '#000' : '#ffe36b', 'center', null);
  // side punch hints (first seconds)
  if (G.round === 1 && G.rt < 6) {
    text('◀ TAP LEFT', 150, 140, 12, '#fff', 'center', '#000', 5);
    text('TAP RIGHT ▶', 810, 140, 12, '#fff', 'center', '#000', 5);
  }
  if (P.combo >= 2) text(P.combo + ' COMBO', CX, 96, 14, '#ffe36b', 'center', '#000', 5);
}
function drawBanners() {
  for (const b of G.banners) {
    const k = b.life / b.max, inK = clamp((b.max - b.life) / 0.2, 0, 1), outK = clamp(b.life / 0.25, 0, 1);
    const x = lerp(-420, 0, inK) + lerp(-420, 0, outK) + 420 - 420;
    const y = 110;
    ctx.save(); ctx.globalAlpha = Math.min(inK, outK);
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x, y, 470, 92);
    ctx.fillStyle = b.color; ctx.fillRect(x, y, 470, 5); ctx.fillRect(x, y + 87, 470, 5);
    drawCard(b.card, x + 14, y + 10, 72, b.color);
    text(b.name, x + 100, y + 32, b.name.length > 20 ? 9 : 14, '#fff', 'left', '#000', 4);
    text(b.move, x + 100, y + 62, b.move.length > 18 ? 11 : 16, b.color, 'left', '#000', 5);
    ctx.restore();
  }
}
function drawTexts() {
  for (const t of G.texts) { ctx.globalAlpha = clamp(t.life / t.max * 2, 0, 1); text(t.str, t.x, t.y, t.size, t.color, 'center', '#000', Math.max(3, t.size / 3)); }
  ctx.globalAlpha = 1;
}
function drawIntro() {
  if (IMG.scene.width) { ctx.drawImage(IMG.scene, 0, 0, W, 536); }
  ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(0, 0, W, H);
  const it = INTRO[G.introIdx]; if (!it) return;
  if (it.how) {
    text('HOW TO PLAY', W / 2, 50, 22, '#ffe36b', 'center', '#000', 6);
    const rows = [['TAP LEFT / RIGHT HALF', 'PUNCH THAT SIDE'], ['HOLD BLOCK', 'BLOCK. BLOCK A HAYMAKER LATE = PARRY'], ['FRIEND CARDS', 'CALL YOUR FRIENDS (LONG RECHARGE)'],
      ['NUNCHAKU', 'FILLS WITH HITS. ENEMIES PANIC'], ['PUNCH TOWARD A DRINK', 'GRAB IT. SPRITZ = x2 POWER + BAC'], ['BAC 100%', 'FERDY MODE: CONTROLS INVERTED'],
      ['PEAR JUICE', 'HEALS + SOBERS YOU UP'], ['WATCH OUT', 'GLASSES, PUDDLES, MASSIMILIANO, GRABS']];
    rows.forEach(([a, b], i) => { text(a, 120, 105 + i * 46, 11, '#1ec8ff', 'left', '#000', 3); text(b, 120, 125 + i * 46, 9, '#fff', 'left', '#000', 3); });
  } else {
    const k = clamp(G.introT / 1.2, 0, 1);
    const l1 = wrap(it.t, 820, 18); l1.forEach((l, i) => text(l, W / 2, 190 + i * 30, 18, '#fff', 'center', '#000', 5));
    const s = it.s.slice(0, Math.floor(it.s.length * k));
    wrap(s, 760, 12).forEach((l, i) => text(l, W / 2, 290 + i * 24, 12, '#ffb3f0', 'center', '#000', 4));
    drawCard(G.introIdx === 1 ? 'mastro' : G.introIdx >= 2 ? 'blackmask' : 'carpet', W / 2 - 40, 70, 80, '#fff');
  }
  if (Math.floor(G.t * 2) % 2) text('TAP TO CONTINUE', W / 2, 500, 10, '#9bd8ff', 'center', '#000', 4);
}
function drawPushup() {
  if (IMG.stage.width) ctx.drawImage(IMG.stage, 0, 0, W, 536);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  text('BONUS: PUSH-UP CHALLENGE', W / 2, 50, 18, '#b8f55a', 'center', '#000', 6);
  drawCard('tommaso', W / 2 - 60, 80, 120, '#b8f55a');
  text('TOMMASO "BROCCOLI GUY" CHALLENGES YOU', W / 2, 225, 10, '#fff', 'center', '#000', 4);
  const pu = G.pu;
  if (!pu.done) {
    const ph = (G.st % 0.75) / 0.75; const good = ph > 0.7 || ph < 0.15;
    text('TAP ON THE BEAT. DON\'T RUSH!', W / 2, 260, 12, '#ffe36b', 'center', '#000', 4);
    ctx.fillStyle = '#222'; ctx.fillRect(280, 290, 400, 30); ctx.fillStyle = '#2a8a2a'; ctx.fillRect(280 + 400 * 0.7, 290, 120, 30); ctx.fillRect(280, 290, 60, 30);
    ctx.fillStyle = good ? '#b8f55a' : '#fff'; ctx.fillRect(280 + ph * 400 - 4, 284, 8, 42);
    text(`REPS: ${pu.reps}`, W / 2, 370, 22, '#fff', 'center', '#000', 6);
    text(`TIME ${Math.max(0, 10 - G.st).toFixed(1)}`, W / 2, 410, 12, '#9bd8ff', 'center', '#000', 4);
    const y = 470 + (good ? 0 : 8); ctx.fillStyle = '#3d8a2e'; ctx.fillRect(W / 2 - 60, y, 120, 20);
  } else {
    text(pu.msg, W / 2, 330, 14, pu.slipped ? '#ff5050' : '#b8f55a', 'center', '#000', 5);
    if (pu.slipped) text('(THE AMBULANCE IS COMING... AGAIN)', W / 2, 370, 10, '#fff', 'center', '#000', 4);
    if (Math.floor(G.t * 2) % 2) text('TAP TO FACE MASTRO LINDO', W / 2, 460, 14, '#fff', 'center', '#000', 5);
  }
}
function drawRoundCard() {
  drawStage(); drawPlayer();
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
  const k = clamp(G.st / 0.3, 0, 1);
  text(G.roundTitle[0], W / 2, 200, 40 * k + 1, '#fff', 'center', '#000', 8);
  text(G.roundTitle[1], W / 2, 260, 22, '#ff4bd8', 'center', '#000', 6);
  if (G.st > 1.4) text('FIGHT!', W / 2, 340, 54, '#ffe36b', 'center', '#b00', 10);
}
function drawGameOver() {
  ctx.fillStyle = 'rgba(40,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  text('K.O.', W / 2, 200, 64, '#ff3030', 'center', '#000', 10);
  text('THE AMBULANCE IS ON ITS WAY...', W / 2, 270, 12, '#fff', 'center', '#000', 4);
  if (G.st > 1.5 && Math.floor(G.t * 2) % 2) text('TAP TO CONTINUE', W / 2, 360, 18, '#ffe36b', 'center', '#000', 6);
  const on = Math.floor(G.t * 4) % 2; ctx.fillStyle = on ? 'rgba(255,0,0,.15)' : 'rgba(0,80,255,.15)'; ctx.fillRect(0, 0, W, H);
}
function drawFatality() {
  if (G.state === 'finish') {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
    if (Math.floor(G.t * 3) % 2) text('FINISH HIM!', W / 2, 150, 44, '#ff2020', 'center', '#000', 10);
    text(`TAP TAP TAP! ${G.finTaps}/8`, W / 2, 210, 14, '#fff', 'center', '#000', 5);
  }
  if (G.state === 'fatality') {
    ctx.fillStyle = `rgba(120,0,0,${0.5 + 0.2 * Math.sin(G.t * 10)})`; ctx.fillRect(0, 0, W, H);
    const k = clamp(G.st / 0.4, 0, 1);
    text('FATALITY', W / 2, 200, 20 + 50 * k, '#ff1a1a', 'center', '#000', 10);
  }
  if (G.state === 'apology') {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 0, W, H);
    if (G.st > 6.8) {
      const k = clamp((G.st - 6.8) / 0.25, 0, 1);
      ctx.save(); ctx.translate(W / 2, 200); ctx.rotate(-0.12); ctx.scale(2.4 - 1.4 * k, 2.4 - 1.4 * k);
      ctx.strokeStyle = '#2ee66b'; ctx.lineWidth = 8; ctx.strokeRect(-260, -45, 520, 90);
      text('APOLOGY ACCEPTED', 0, 0, 30, '#2ee66b', 'center', '#000', 6); ctx.restore();
    }
    if (G.st > 6) text('TAP TO CONTINUE', W / 2, 500, 10, '#9bd8ff', 'center', '#000', 4);
  }
}
function drawEnding() {
  if (IMG.scene.width) ctx.drawImage(IMG.scene, 0, 0, W, 536);
  ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, W, H);
  for (const c of G.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
  if (G.endStage === 0) {
    text('BLACK MASK WINS', W / 2, 90, 34, '#1ec8ff', 'center', '#000', 8);
    const secs = Math.round((performance.now() - G.startTime) / 1000);
    const rows = [['SCORE', String(G.score)], ['TIME', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`], ['ENEMIES DOWN', String(G.kos)], ['MAX COMBO', String(G.maxCombo)],
      ['FRIENDS CALLED', String(G.friendsCalled)], ['PEAK BAC', Math.round(G.bacPeak) + '%'], ['CONTINUES', String(G.continues)]];
    rows.forEach(([a, b], i) => { text(a, 280, 160 + i * 38, 13, '#fff', 'left', '#000', 4); text(b, 680, 160 + i * 38, 13, '#ffe36b', 'right', '#000', 4); });
    text('NO REAL PUNCH WAS THROWN THAT NIGHT. HE STILL WON.', W / 2, 455, 9, '#9bd8ff', 'center', '#000', 3);
  } else if (G.endStage === 1) {
    const p = 1 + 0.05 * Math.sin(G.t * 4);
    text('HAPPY BIRTHDAY', W / 2, 170, 40 * p, '#ffe36b', 'center', '#b00', 10);
    text('CHECCO', W / 2, 250, 64 * p, '#fff', 'center', '#1ec8ff', 12);
    text('LEVEL 23 UNLOCKED', W / 2, 340, 22, '#7CFC00', 'center', '#000', 6);
    text('NOVEMBER 9, 2026', W / 2, 390, 11, '#fff', 'center', '#000', 4);
  } else if (G.endStage === 2) {
    const cast = [['blackmask', 'BLACK MASK', 'CHECCO'], ['ginevra', 'CLEOPATRA', 'GINEVRA'], ['fede', 'THE PEACEMAKER', 'FEDE'], ['enrico', 'NUNCHAKU DEALER', 'ENRICO'],
      ['arianna', 'GOTH QUEEN', 'ARIANNA'], ['elisabetta', 'SPIDER-GIRL & DRIVER', 'ELISABETTA'], ['ferdy', 'FERDY MODE', 'FERDINANDO'], ['emma', 'NIGHT NURSE', 'EMMA'],
      ['daniele', 'SPITTER, 5TH FLOOR', 'DANIELE'], ['matteo', 'ACCORDION (FROM BED)', 'MATTEO'], ['christian', 'SARDEGNA AIR', 'CHRISTIAN'], ['tommaso', 'BROCCOLI GUY', 'TOMMASO'],
      ['mari', 'JASMINE (BROKEN HEEL)', 'MARI'], ['sofia', 'MAGIC CARPET', 'SOFIA'], ['ilaria', 'MAGIC CARPET', 'ILARIA'], ['miriana', 'MAGIC CARPET', 'MIRIANA'],
      ['banana', 'BANANA GUY', '???'], ['mastro', 'MASTRO LINDO', 'SAID SORRY']];
    const y0 = H + 20 - G.endT * 45;
    text('CAST', W / 2, y0 - 40, 22, '#ffe36b', 'center', '#000', 6);
    cast.forEach(([id, role, name], i) => {
      const y = y0 + i * 92; if (y < -100 || y > H + 100) return;
      drawCard(id, 260, y, 70, '#fff');
      text(name, 350, y + 22, 16, '#fff', 'left', '#000', 5); text(role, 350, y + 50, 10, '#9bd8ff', 'left', '#000', 4);
    });
    if (y0 + cast.length * 92 < 120) { G.endStage = 3; G.endT = 0; }
  } else {
    text('THANKS FOR PLAYING', W / 2, 200, 28, '#fff', 'center', '#000', 8);
    text('MADE WITH LOVE BY YOUR FRIENDS', W / 2, 260, 12, '#ff9ad8', 'center', '#000', 4);
    if (Math.floor(G.t * 2) % 2) text('TAP TO PLAY AGAIN', W / 2, 360, 16, '#ffe36b', 'center', '#000', 5);
  }
  if (G.endStage < 2 && G.endT > 1 && Math.floor(G.t * 2) % 2) text('TAP', W / 2, 505, 10, '#9bd8ff', 'center', '#000', 3);
}

// ---------------------------------------------------------------- main draw
function draw() {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const s = G.state;
  if (s === 'loading') {
    text('LOADING...', W / 2, H / 2, 16, '#fff');
    bar(W / 2 - 150, H / 2 + 30, 300, 10, loaded / imgList.length, '#1ec8ff');
    return;
  }
  if (s === 'title') { drawTitle(); drawTexts(); return; }
  if (s === 'intro') { drawIntro(); return; }
  if (s === 'pushup') { drawPushup(); drawTexts(); return; }
  if (s === 'ending') { drawEnding(); return; }
  if (s === 'roundcard') { drawRoundCard(); return; }
  // fight-like scenes
  ctx.save();
  const sh = G.shake;
  const sway = P.bac / 100;
  ctx.translate(rnd(-sh, sh) + Math.sin(G.t * 1.7) * 10 * sway, rnd(-sh, sh));
  if (sway > 0.2) { ctx.translate(W / 2, H / 2); ctx.rotate(Math.sin(G.t * 1.3) * 0.025 * sway); ctx.translate(-W / 2, -H / 2); }
  drawStage();
  if (P.ferdy > 0 && IMG.stage.width) { ctx.globalAlpha = 0.3; ctx.drawImage(IMG.stage, 12 * Math.sin(G.t * 3), 0, W, 536); ctx.globalAlpha = 1; }
  // depth order: boss (if behind), enemies, player
  if (G.round === 2) drawBoss();
  G.enemies.slice().sort((a, b) => Math.abs(b.x - CX) - Math.abs(a.x - CX)).forEach(drawEnemy);
  drawPlayer();
  drawHazards();
  drawFx();
  drawParticles();
  ctx.restore();
  for (const b of G.bubbles) drawBubble(b);
  if (s === 'fight') drawHUD();
  drawBanners();
  drawTexts();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 2})`; ctx.fillRect(0, 0, W, H); }
  if (P.bac > 60 && s === 'fight') { const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(60,120,0,${(P.bac - 60) / 160})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
  if (s === 'gameover') drawGameOver();
  if (s === 'finish' || s === 'fatality' || s === 'apology') drawFatality();
}

let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (window.matchMedia('(orientation: portrait)').matches && G.state === 'fight') dt = 0; // paused while rotated
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__G = G; window.__P = P; window.__B = B; // for testing
window.__dbg = { startRound, startFinish, finishTap, startPushup, startEnding, EVENTS, setState, resetPlayer, bossReset };
})();
