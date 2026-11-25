// Generates assets/hoops.svg: an original pixel-art loop.
// 2-on-2: AJ (#1) bounce-passes to the AI teammate (#23), who drives through both defenders and dunks over them
// at the buzzer. Screen shake, flash, DUNK!, defenders knocked down, scoreboard 28 → 30 to beat 29.
// Native canvas 200×60, drawn at 4× with crisp rects. Frame animation uses SMIL (works in GitHub READMEs).
// Run: node tools/hoops.mjs
import { writeFileSync } from 'node:fs';

const W = 200, H = 60, SCALE = 4, FPS = 12, TICKS = 96;
const T = TICKS / FPS;

// ---------- palettes: each ramp goes outline, shadow, base, light, highlight ----------
const R = {
  skin:  ['#3a2219', '#9a5a3e', '#c98763', '#e8ae84', '#f8d4b0'],
  teal:  ['#0c3134', '#16747a', '#22a8a8', '#4fd9cf', '#a9f2ea'],
  opp:   ['#1a0e2e', '#43296a', '#6646a0', '#8c6ccc', '#c2aaf2'],
  oppD:  ['#1a0e2e', '#2e1c4c', '#43296a', '#6646a0', '#8c6ccc'],
  skinD: ['#1e100a', '#4e2c1c', '#74462c', '#965e3a', '#ba8256'],
  skinT: ['#3a2014', '#8a5634', '#b67c50', '#d6a070', '#f0c494'],
  tealD: ['#0c3134', '#0f4f55', '#16747a', '#22a8a8', '#4fd9cf'],
  red:   ['#3d0f16', '#8f2532', '#cc3d48', '#f46c6a', '#ffb3a6'],
  redD:  ['#3d0f16', '#661a26', '#8f2532', '#cc3d48', '#f46c6a'],
  metal: ['#171a26', '#4a5269', '#7a849e', '#b3bccf', '#e9eef8'],
  metalD:['#171a26', '#363c50', '#4a5269', '#7a849e', '#b3bccf'],
  ball:  ['#3b1506', '#9a4416', '#d4691f', '#f5953f', '#ffc98a'],
  shoe:  ['#1a1a22', '#8c95ab', '#d5dbe8', '#ffffff', '#ffffff'],
};
const C = {
  ink: '#14121c', hair: '#1f1a2c', hairL: '#3d3456', eye: '#141018', white: '#ffffff', mouth: '#7a2f34',
  visor: '#0e5560', visorL: '#3fe3e0', glint: '#e8ffff', yellow: '#ffd23f', yellowD: '#c99a12',
  led: '#ff5b4f', ledD: '#4a1512',
};

// ---------- tiny raster ----------
const layer = (w = W, h = H) => ({ w, h, px: new Array(w * h).fill(null) });
const put = (L, x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < L.w && y < L.h && c) L.px[y * L.w + x] = c; };
const get = (L, x, y) => (x >= 0 && y >= 0 && x < L.w && y < L.h ? L.px[y * L.w + x] : null);
const rect = (L, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(L, x + i, y + j, c); };
const grid = (L, x, y, rows, map) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(L, x + i, y + j, map[ch]); }));

const LIGHT = (() => { const v = [-0.55, -0.7, 0.45]; const n = Math.hypot(...v); return v.map(a => a / n); })();
// Shade a mask given a per-pixel "normal" function, then outline it. Sticker style: outline overwrites what is under.
function shaded(L, inside, normal, ramp, { bbox, hl = true, outline = true }) {
  const [x0, y0, x1, y1] = bbox.map(Math.floor);
  const m = new Map();
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (inside(x + 0.5, y + 0.5)) m.set(x + ',' + y, [x, y]);
  if (outline) for (const [x, y] of m.values())
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!m.has(x + dx + ',' + (y + dy))) put(L, x + dx, y + dy, ramp[0]);
  for (const [x, y] of m.values()) {
    const n = normal(x + 0.5, y + 0.5), l = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    put(L, x, y, l < 0.2 ? ramp[1] : l < 0.62 ? ramp[2] : l < 0.9 || !hl ? ramp[3] : ramp[4]);
  }
}
function capsule(L, a, b, r, ramp, opt = {}) {
  const [ax, ay] = a, [bx, by] = b, dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  const near = (x, y) => { const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)); return [ax + t * dx, ay + t * dy]; };
  shaded(L, (x, y) => { const [cx, cy] = near(x, y); return Math.hypot(x - cx, y - cy) <= r; },
    (x, y) => { const [cx, cy] = near(x, y); const ux = (x - cx) / r, uy = (y - cy) / r; return [ux, uy, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy))]; },
    ramp, { bbox: [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r], ...opt });
}
const disc = (L, c, r, ramp, opt) => capsule(L, c, c, r, ramp, opt);
const ellipse = (L, cx, cy, rx, ry, ramp, opt = {}) => shaded(L,
  (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
  (x, y) => { const ux = (x - cx) / rx, uy = (y - cy) / ry; return [ux, uy, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy))]; },
  ramp, { bbox: [cx - rx, cy - ry, cx + rx, cy + ry], ...opt });

// ---------- 3×5 pixel font ----------
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], C: ['.##', '#..', '#..', '#..', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'], '!': ['#', '#', '#', '.', '#'], '+': ['...', '.#.', '###', '.#.', '...'],
  '·': ['.', '.', '#', '.', '.'], ':': ['.', '#', '.', '#', '.'], ' ': ['.', '.', '.', '.', '.'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  9: ['###', '#.#', '###', '..#', '###'], 5: ['###', '#..', '###', '..#', '###'],
  3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 8: ['###', '#.#', '###', '#.#', '###'],
};
function text(L, x, y, str, c, s = 1, shadow = null) {
  for (const ch of str) {
    const g = FONT[ch];
    if (shadow) g.forEach((r, j) => [...r].forEach((p, i) => { if (p === '#') rect(L, x + i * s + 1, y + j * s + 1, s, s, shadow); }));
    g.forEach((r, j) => [...r].forEach((p, i) => { if (p === '#') rect(L, x + i * s, y + j * s, s, s, c); }));
    x += (g[0].length + 1) * s;
  }
  return x;
}
const textWidth = (str, s = 1) => [...str].reduce((w, ch) => w + (FONT[ch][0].length + 1) * s, -s);

// ---------- background (static) ----------
function background() {
  const L = layer();
  const wall = ['#121424', '#161a2e', '#1b2038', '#212744'];
  for (let y = 0; y < 40; y++) rect(L, 0, y, W, 1, wall[Math.min(3, y >> 3)]);
  // lamp halos: hard concentric bands, no dithering
  for (const lx of [40, 100, 160]) {
    for (const [r, c] of [[16, '#1e2440'], [10, '#262d50'], [5, '#313a64']])
      for (let y = 0; y < 18; y++) for (let x = lx - r; x <= lx + r; x++) if ((x - lx) ** 2 + (y * 1.6) ** 2 <= r * r && get(L, x, y) !== '#313a64' && !(r === 16 && get(L, x, y) === '#262d50')) put(L, x, y, c);
    rect(L, lx - 4, 0, 9, 2, '#5a6488'); rect(L, lx - 3, 2, 7, 1, '#fff6c8'); rect(L, lx - 2, 3, 5, 1, '#ffe27a');
  }
  // crowd: tidy rows of heads and shoulders; back rows darker
  const shirts = [['#2a2f4f', '#3a4170'], ['#3b2a4a', '#55406b'], ['#21404a', '#2f5a66'], ['#4a2f2f', '#6a4444'], ['#2f3b2a', '#45573d']];
  const skins = [['#5a3a2e', '#7a5240'], ['#6e4a36', '#94664c'], ['#3e2a22', '#5a3e30']];
  [[6, 0.55], [12, 0.75], [18, 1]].forEach(([y, k], row) => {
    for (let x = 2 + row * 3; x < W; x += 7) {
      const h = (x * 7 + row * 13) % 5, sk = skins[(x + row) % 3], sh = shirts[h];
      const dim = (c) => (k < 1 ? mix(c, '#161a2e', 1 - k) : c);
      rect(L, x, y + 4, 6, 5, dim(sh[0])); rect(L, x + 1, y + 4, 4, 1, dim(sh[1]));
      rect(L, x + 1, y, 4, 4, dim(sk[0])); rect(L, x + 2, y, 2, 1, dim(sk[1])); put(L, x + 1, y, null); put(L, x + 4, y, null);
      put(L, x + 1, y, dim(wall[1]));
    }
  });
  // LED ad board
  rect(L, 0, 26, W, 7, '#0b0c14'); rect(L, 0, 26, W, 1, '#2a2f4a'); rect(L, 0, 33, W, 7, '#1b2038'); rect(L, 0, 33, W, 1, '#262d50');
  let x = 8;
  while (x < W) { x = text(L, x, 27, 'PASS · DRIVE · DUNK', '#3fe3e0') + 4; x = text(L, x, 27, 'AJ + AI', C.yellow) + 8; }
  // hardwood floor: planks get taller toward the viewer (perspective), staggered seams
  const wood = ['#7a4423', '#9a5a2e', '#b8743c', '#cf8c4c', '#e0a462'];
  let y = 40, band = 0;
  for (const h of [2, 2, 3, 3, 4, 4, 5, 6]) {
    if (y >= H) break;
    const c = wood[[3, 2, 3, 2, 3, 2, 3, 2][band]];
    rect(L, 0, y, W, Math.min(h, H - y), c);
    rect(L, 0, y, W, 1, mix(c, '#ffffff', 0.08));
    for (let sx = (band * 17) % 23; sx < W; sx += 23 + band * 4) rect(L, sx, y, 1, Math.min(h, H - y), wood[1]);
    y += h; band++;
  }
  rect(L, 0, 40, W, 1, wood[0]);
  // light reflections on the floor under the lamps
  for (const lx of [40, 100, 160]) { rect(L, lx - 6, 43, 12, 1, '#efc184'); rect(L, lx - 3, 47, 6, 1, '#efc184'); }
  // painted key under the hoop + lines
  for (let yy = 41; yy < H; yy++) { const x0 = 150 - (yy - 41) * 0.8 | 0; for (let xx = x0; xx < W; xx++) put(L, xx, yy, mix(get(L, xx, yy), '#8f2532', 0.3)); put(L, x0, yy, '#f3e6cf'); }
  rect(L, 0, 41, W, 1, '#f3e6cf');
  // hoop: pole, arm, backboard, back of rim
  rect(L, 186, 9, 4, 48, R.metal[1]); rect(L, 186, 9, 1, 48, R.metal[3]); rect(L, 189, 9, 1, 48, R.metal[0]);
  rect(L, 183, 55, 10, 4, R.metal[0]); rect(L, 184, 55, 8, 1, R.metal[2]);
  rect(L, 179, 12, 8, 3, R.metal[1]); rect(L, 179, 12, 8, 1, R.metal[3]);
  rect(L, 176, 4, 4, 24, '#ffffff'); rect(L, 175, 3, 6, 1, C.ink); rect(L, 175, 28, 6, 1, C.ink); rect(L, 175, 4, 1, 24, C.ink); rect(L, 180, 4, 1, 24, C.ink);
  rect(L, 178, 4, 2, 24, '#d6dcea'); rect(L, 177, 13, 1, 9, '#e8584b');
  rect(L, 164, 20, 12, 1, '#9a3a12');                         // back half of the rim
  // scoreboard frame (digits are animated)
  rect(L, 4, 3, 76, 21, C.ink); rect(L, 5, 4, 74, 19, '#07070c'); rect(L, 5, 4, 74, 1, '#2a2f4a'); rect(L, 58, 6, 1, 15, '#2a2f4a');
  text(L, 8, 7, 'AJ+AI', C.yellow);
  text(L, 8, 15, '4Q', '#8c95ab');
  text(L, 62, 7, 'OPP', '#8c95ab'); text(L, 64, 15, '29', '#c8cdd8');
  return L;
}
function mix(a, b, k) {
  if (!a) return b;
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// ---------- characters ----------
const HEADS = {
  aj: ['..kkkkk..', '.khHHHhk.', 'khhHHhhhk', 'khhhhhLLk', 'khhsSSeLk', 'kkksSSSLk', '.kssSSSSk', '.ksSSSmk.', '..ksSSk..', '...kkk...'],
  ai: ['....ky....', '....k.....', '.kkkkkkkk.', 'k4443332k.', 'kvvvvVVvk.', 'kvVgvvVvk.', 'k3333221k.', '.k22211k..', '..kkkkk...'],
  d1: ['..kkkkk..', '.khhhhhk.', 'khhHhhhhk', 'khssSSSLk', 'kssSSSeLk', 'kssSSSSLk', '.kssSSSSk', '.ksSSSmk.', '..ksSSk..', '...kkk...'],
  d2: ['..kkkkk..', '.khHhHhk.', 'kbbbbbbbk', 'khhssSLLk', 'khsSSSeLk', 'kksSSSSLk', '.kssSSSSk', '.ksSSSmk.', '..ksSSk..', '...kkk...'],
};
const HEAD_MAPS = {
  aj: { k: R.skin[0], h: C.hair, H: C.hairL, s: R.skin[1], S: R.skin[2], L: R.skin[3], e: C.eye, m: C.mouth },
  ai: { k: R.metal[0], y: C.yellow, 1: R.metal[1], 2: R.metal[2], 3: R.metal[3], 4: R.metal[4], v: C.visor, V: C.visorL, g: C.glint },
  d1: { k: R.skinD[0], h: '#120c0a', H: '#2e2420', s: R.skinD[1], S: R.skinD[2], L: R.skinD[3], e: '#0a0606', m: '#4a1a20' },
  d2: { k: R.skinT[0], h: '#4a2a12', H: '#7a4e24', b: '#f2f2f6', s: R.skinT[1], S: R.skinT[2], L: R.skinT[3], e: C.eye, m: C.mouth },
};
const darker = (r) => r.map((c, i) => (i ? r[Math.max(1, i - 1)] : c));
const KINDS = {
  aj: { limb: R.skin, shirt: R.teal, shorts: R.tealD, num: '1', sock: true },
  ai: { limb: R.metal, limbD: R.metalD, shirt: R.teal, shorts: R.tealD, num: '23' },
  d1: { limb: R.skinD, shirt: R.opp, shorts: R.oppD, num: '4', sock: true },
  d2: { limb: R.skinT, shirt: R.opp, shorts: R.oppD, num: '8', sock: true },
};
function flipLayer(L) { const o = layer(L.w, L.h); for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) o.px[y * L.w + (L.w - 1 - x)] = L.px[y * L.w + x]; return o; }

// pose: points relative to the feet (x toward the way the player faces, y up = negative)
function figure(kind, pose, flip) {
  const K = KINDS[kind], L = layer(36, 46), ox = 16, oy = 44;
  const P = (p) => [ox + p[0], oy + p[1]];
  const limb = K.limb, limbD = K.limbD || darker(limb);
  const { n, p, eF, hF, eB, hB, kF, fF, kB, fB } = pose;
  const sh = (dx) => [n[0] + dx, n[1] + 1.5];
  capsule(L, P(sh(-1.5)), P(eB), 1.3, limbD); capsule(L, P(eB), P(hB), 1.2, limbD); disc(L, P(hB), 1.6, limbD);
  capsule(L, P([p[0] - 1.5, p[1]]), P(kB), 1.6, limbD); capsule(L, P(kB), P(fB), 1.4, limbD);
  shoe(L, P(fB), true);
  capsule(L, P([n[0], n[1] + 3]), P([p[0], p[1] - 2]), 4.6, K.shirt);
  capsule(L, P([p[0] - 0.5, p[1] - 1.5]), P([p[0] + 0.5, p[1] + 1.5]), 4.4, K.shorts);
  // jersey number; mirrored glyphs when the whole sprite will be flipped, so it reads right afterwards
  const tw = textWidth(K.num), T2 = layer(tw, 5); text(T2, 0, 0, K.num, '#ffffff');
  const NL = flip ? flipLayer(T2) : T2, tx = Math.round(P(n)[0] - tw / 2 + (K.num.length > 1 ? -1 : 0.5)) - (flip ? 1 : 0), ty = Math.round(P(n)[1] + 4);
  NL.px.forEach((c, i) => c && put(L, tx + (i % tw), ty + ((i / tw) | 0), c));
  capsule(L, P([p[0] + 1.5, p[1]]), P(kF), 1.6, limb); capsule(L, P(kF), P(fF), 1.4, limb);
  if (K.sock) { const [fx, fy] = P(fF); rect(L, Math.round(fx) - 1, Math.round(fy) - 4, 3, 2, '#f2f2f6'); }
  shoe(L, P(fF), false);
  const [hx, hy] = P(n);
  grid(L, Math.round(hx) - 4, Math.round(hy) - (kind === 'ai' ? 9 : 10), HEADS[kind], HEAD_MAPS[kind]);
  capsule(L, P(sh(1.5)), P(eF), 1.3, limb); capsule(L, P(eF), P(hF), 1.2, limb); disc(L, P(hF), 1.7, limb);
  return flip ? { L: flipLayer(L), ox: 35 - ox, oy } : { L, ox, oy };
}
function shoe(L, [x, y], back) {
  x = Math.round(x); y = Math.round(y);
  const r = back ? darker(R.shoe) : R.shoe;
  rect(L, x - 2, y - 1, 5, 2, r[2]); rect(L, x - 2, y - 1, 5, 1, r[3]); rect(L, x - 3, y, 7, 1, r[0]); rect(L, x - 3, y - 2, 6, 1, r[0]);
  put(L, x + 2, y - 1, back ? '#8f2532' : '#e8584b');
}
const v = (x, y) => [x, y];
const POSES = {
  low:    { n: v(1, -22), p: v(0, -12), eF: v(5, -16), hF: v(8, -12), eB: v(-3, -16), hB: v(-2, -12), kF: v(4, -6), fF: v(4, 0), kB: v(-2, -6), fB: v(-4, 0) },
  high:   { n: v(1, -23), p: v(0, -12), eF: v(5, -17), hF: v(8, -15), eB: v(-3, -17), hB: v(-2, -13), kF: v(4, -6), fF: v(4, 0), kB: v(-2, -6), fB: v(-4, 0) },
  pass:   { n: v(2, -22), p: v(0, -12), eF: v(6, -19), hF: v(11, -18), eB: v(5, -18), hB: v(10, -16), kF: v(5, -6), fF: v(7, 0), kB: v(-2, -5), fB: v(-5, 0) },
  cheer:  { n: v(0, -23), p: v(0, -12), eF: v(3, -27), hF: v(5, -32), eB: v(-3, -27), hB: v(-4, -32), kF: v(2, -6), fF: v(2, 0), kB: v(-2, -6), fB: v(-3, 0) },
  idle:   { n: v(0, -22), p: v(0, -12), eF: v(2, -16), hF: v(3, -11), eB: v(-2, -16), hB: v(-2, -11), kF: v(1, -6), fF: v(2, 0), kB: v(-1, -6), fB: v(-2, 0) },
  catch:  { n: v(0, -22), p: v(0, -12), eF: v(4, -18), hF: v(6, -17), eB: v(2, -18), hB: v(5, -16), kF: v(2, -6), fF: v(3, 0), kB: v(-1, -6), fB: v(-3, 0) },
  crouch: { n: v(1, -19), p: v(-1, -9), eF: v(4, -15), hF: v(5, -18), eB: v(2, -15), hB: v(4, -17), kF: v(3, -5), fF: v(2, 0), kB: v(1, -5), fB: v(-2, 0) },
  land:   { n: v(1, -19), p: v(-1, -9), eF: v(5, -17), hF: v(8, -15), eB: v(-3, -16), hB: v(-6, -14), kF: v(4, -5), fF: v(4, 0), kB: v(-1, -5), fB: v(-4, 0) },
  run1:   { n: v(3, -21), p: v(1, -12), eF: v(6, -15), hF: v(9, -12), eB: v(-2, -17), hB: v(-5, -14), kF: v(6, -7), fF: v(8, -2), kB: v(-3, -5), fB: v(-7, -2) },
  run2:   { n: v(3, -22), p: v(1, -12), eF: v(5, -16), hF: v(8, -13), eB: v(0, -16), hB: v(-2, -12), kF: v(3, -6), fF: v(2, 0), kB: v(-3, -8), fB: v(-8, -7) },
  gather: { n: v(2, -18), p: v(0, -9), eF: v(5, -14), hF: v(7, -17), eB: v(3, -13), hB: v(6, -15), kF: v(4, -5), fF: v(3, 0), kB: v(0, -4), fB: v(-3, 0) },
  leap:   { n: v(1, -22), p: v(0, -12), eF: v(-1, -28), hF: v(-4, -31), eB: v(5, -20), hB: v(8, -22), kF: v(5, -14), fF: v(5, -8), kB: v(-2, -8), fB: v(-5, -2) },
  slam:   { n: v(3, -22), p: v(0, -12), eF: v(7, -24), hF: v(10, -19), eB: v(-3, -19), hB: v(-6, -17), kF: v(4, -8), fF: v(4, -2), kB: v(-2, -6), fB: v(-4, -1) },
  hang:   { n: v(0, -22), p: v(0, -12), eF: v(2, -28), hF: v(3, -33), eB: v(1, -28), hB: v(1, -33), kF: v(1, -6), fF: v(1, 0), kB: v(-1, -6), fB: v(-2, 0) },
  hang2:  { n: v(0, -22), p: v(0, -12), eF: v(2, -28), hF: v(3, -33), eB: v(1, -28), hB: v(1, -33), kF: v(3, -6), fF: v(5, -2), kB: v(1, -6), fB: v(2, -1) },
  flex:   { n: v(0, -22), p: v(0, -12), eF: v(5, -21), hF: v(5, -27), eB: v(-5, -21), hB: v(-5, -27), kF: v(2, -6), fF: v(3, 0), kB: v(-2, -6), fB: v(-3, 0) },
  stance: { n: v(0, -20), p: v(0, -10), eF: v(4, -15), hF: v(8, -17), eB: v(-4, -15), hB: v(-8, -12), kF: v(4, -5), fF: v(5, 0), kB: v(-4, -5), fB: v(-5, 0) },
  jump:   { n: v(0, -22), p: v(0, -12), eF: v(2, -27), hF: v(3, -32), eB: v(0, -27), hB: v(-1, -32), kF: v(1, -6), fF: v(1, -1), kB: v(-1, -6), fB: v(-2, -1) },
  fall:   { n: v(-5, -19), p: v(-2, -10), eF: v(1, -22), hF: v(4, -25), eB: v(-8, -23), hB: v(-10, -27), kF: v(2, -5), fF: v(4, 0), kB: v(-2, -5), fB: v(0, 0) },
  sit:    { n: v(-2, -14), p: v(-2, -5), eF: v(-5, -9), hF: v(-7, -3), eB: v(1, -10), hB: v(4, -9), kF: v(3, -8), fF: v(7, -1), kB: v(1, -7), fB: v(5, 0) },
};

// ---------- ball, net, rim front, effects ----------
function ballFrame(angle) {
  const L = layer(9, 9);
  disc(L, [4.5, 4.5], 3.4, R.ball);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const dx = x + 0.5 - 4.5, dy = y + 0.5 - 4.5; if (dx * dx + dy * dy > 3.0 * 3.0) continue;
    const u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
    if (Math.abs(u) < 0.5 || Math.abs(w) < 0.5 || Math.abs(Math.hypot(u - 3.4, w) - 2.4) < 0.45) put(L, x, y, R.ball[0]);
  }
  return L;
}
const NETS = {
  rest: ['k.w.w.w.w.k', '.w.w.w.w.w.', '..w.w.w.w..', '..w.w.w.w..', '...w.w.w...', '...wwwww...'],
  up:   ['k.w.w.w.w.k', '.ww.www.ww.', '..wwwwwww..', '...w.w.w...', '...wwwww...', '...........'],
  down: ['k.w.w.w.w.k', '.w.w.w.w.w.', '..w.w.w.w..', '..w.w.w.w..', '..w.w.w.w..', '...w.w.w...', '...wwwww...'],
};
function netFrame(rows, bent) {
  const L = layer(14, 11), d = bent ? 1 : 0;
  grid(L, 1, 1 + d, rows, { k: '#9a3a12', w: '#eef2fa' });
  rect(L, 0, d, 14, 1, '#e8783a'); rect(L, 0, 1 + d, 14, 1, '#9a3a12'); rect(L, 1, d, 6, 1, '#ffb36b');
  if (bent) { put(L, 12, 0, '#e8783a'); put(L, 13, 0, '#e8783a'); }
  return L;
}
function sparkle() { const L = layer(5, 5); grid(L, 0, 0, ['..y..', '..Y..', 'yYWYy', '..Y..', '..y..'], { y: C.yellowD, Y: C.yellow, W: '#fffbe0' }); return L; }
function shadowFrame(w) { const L = layer(w, 2); rect(L, 1, 0, w - 2, 1, '#6d3a1d'); rect(L, 0, 1, w, 1, '#5a3018'); return L; }
function digits(str) { const L = layer(24, 11); text(L, 0, 0, str, C.led, 2, C.ledD); return L; }
function dunkText() { const L = layer(60, 19); text(L, 2, 2, 'DUNK!', '#3d0f16', 3); text(L, 1, 1, 'DUNK!', '#8f2532', 3); text(L, 0, 0, 'DUNK!', C.yellow, 3); return L; }
function burst(r0, r1) {
  const L = layer(44, 34), cx = 22, cy = 17;
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2 + 0.13;
    for (let r = r0; r <= r1; r += 0.5) put(L, Math.round(cx + Math.cos(t) * r * 1.25), Math.round(cy + Math.sin(t) * r), r > r1 - 2 ? '#ffffff' : C.yellow); }
  return L;
}
function speedLines() { const L = layer(16, 16); [[3, 9, 0], [8, 13, 2], [13, 7, 4]].forEach(([y, w, x]) => { rect(L, x, y, w, 1, '#f3e6cf'); rect(L, x, y, 3, 1, '#cf8c4c'); }); return L; }
function crowdCheer() {
  const L = layer();
  for (let x = 2 + 6; x < W; x += 7) if (x > 82 && (x >> 1) % 3 !== 0) { rect(L, x - 1, 15, 1, 4, '#7a5240'); rect(L, x + 6, 15, 1, 4, '#7a5240'); put(L, x - 1, 14, '#94664c'); put(L, x + 6, 14, '#94664c'); }
  return L;
}

// ---------- timeline ----------
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const F = 55, RIM = [170, 20];
const tl = { cheer: [], score: [], clock: [], sh_aj: [], sh_ai: [], sh_d1: [], sh_d2: [], bsh: [], speed: [], aj: [], d1: [], d2: [], ai: [], ball: [], net: [], burst: [], spark: [], dunk: [] };
const SHAKE = [], FLASH = [];
const IMPACT = 56;
const hand = (e, which = 'hF') => { const [kind, pose, f] = e.f.split('_'), h = POSES[pose][which]; return [e.x + (f ? -h[0] : h[0]), e.y + h[1]]; };
const run = (t) => (((t >> 1) & 1) ? 'run2' : 'run1');
for (let t = 0; t < TICKS; t++) {
  const P = (kind, pose, x, lift = 0, flip = false) => ({ f: `${kind}_${pose}${flip ? '_f' : ''}`, x: Math.round(x), y: F - Math.round(lift), lift });
  // AJ: dribble, bounce pass, trail the play, celebrate
  let aj;
  if (t < 14) aj = P('aj', (t % 6) >= 4 || t % 6 === 0 ? 'high' : 'low', 26);
  else if (t < 18) aj = P('aj', 'pass', 26);
  else if (t < 36) aj = P('aj', run(t), lerp(26, 84, (t - 18) / 18));
  else if (t < IMPACT) aj = P('aj', 'idle', 84);
  else if (t < IMPACT + 8) aj = P('aj', run(t), lerp(84, 112, (t - IMPACT) / 8));
  else if (t < 76) aj = P('aj', 'cheer', 112, ((t >> 1) & 1) ? 3 : 0);
  else if (t < 82) aj = P('aj', run(t), lerp(112, 126, (t - 76) / 6));
  else aj = P('aj', 'cheer', 126, t < 90 && ((t >> 1) & 1) ? 3 : 0);
  // AI #23: catch, jab, drive, gather, leap over both defenders, slam, hang, drop, flex
  let ai;
  if (t < 17) ai = P('ai', 'idle', 84);
  else if (t < 22) ai = P('ai', 'catch', 84);
  else if (t < 24) ai = P('ai', 'crouch', 84);
  else if (t < 38) ai = P('ai', run(t), lerp(84, 130, (t - 24) / 14));
  else if (t < 41) ai = P('ai', 'gather', lerp(130, 134, (t - 38) / 3));
  else if (t < IMPACT) {
    const k = (t - 41) / (IMPACT - 41), x = lerp(134, 158, k);
    const lift = t <= 48 ? 21 * Math.sin(((t - 41) / 7) * Math.PI / 2) : lerp(21, 16, (t - 48) / (IMPACT - 48));
    ai = P('ai', t < 52 ? 'leap' : 'slam', x, lift);
  }
  else if (t === IMPACT) ai = P('ai', 'slam', 158, 16);
  else if (t < 69) ai = P('ai', Math.floor((t - IMPACT) / 3) % 2 ? 'hang2' : 'hang', 165, t === IMPACT + 1 ? 9 : t === IMPACT + 2 ? 4 : 2);
  else if (t < 72) ai = P('ai', 'land', 163, [1, 0, 0][t - 69]);
  else if (t < 82) ai = P('ai', 'flex', 163);
  else ai = P('ai', 'cheer', 163, t < 90 && ((t >> 1) & 1) ? 0 : 3);
  // defender #4 (guards AJ), sprints back as help to wall up the rim, contests, gets posterized
  let d1;
  if (t < 16) d1 = P('d1', 'stance', 45 + ((t >> 2) & 1), 0, true);
  else if (t < 36) d1 = P('d1', run(t), lerp(45, 152, (t - 16) / 20));
  else if (t < 46) d1 = P('d1', 'stance', 152 + ((t >> 2) & 1), 0, true);
  else if (t < 53) d1 = P('d1', 'jump', 152, [2, 4, 5, 5, 4, 3, 1][t - 46], true);
  else if (t < IMPACT) d1 = P('d1', 'stance', 152, 0, true);
  else if (t < IMPACT + 4) d1 = P('d1', 'fall', 152 + (t - IMPACT + 1) * 1.2, 0, true);
  else d1 = P('d1', 'sit', 157, 0, true);
  // defender #8 (guards #23): bites on the jab, gets blown by, chases and contests from behind
  let d2;
  if (t < 24) d2 = P('d2', 'stance', 102 - ((t >> 2) & 1), 0, true);
  else if (t < 34) d2 = P('d2', 'stance', lerp(102, 95, clamp01((t - 24) / 3)), t >= 26 && t < 30 ? 1 : 0, true);
  else if (t < 44) d2 = P('d2', run(t), lerp(95, 140, (t - 34) / 10));
  else if (t < 46) d2 = P('d2', 'stance', 140, 0, true);
  else if (t < 53) d2 = P('d2', 'jump', 140, [3, 5, 6, 6, 5, 3, 1][t - 46], true);
  else if (t < IMPACT) d2 = P('d2', 'stance', 140, 0, true);
  else if (t < IMPACT + 4) d2 = P('d2', 'fall', 140 + (t - IMPACT + 1) * 1.2, 0, true);
  else d2 = P('d2', 'sit', 145, 0, true);
  for (const [k, e] of [['aj', aj], ['ai', ai], ['d1', d1], ['d2', d2]]) {
    tl[k].push(e);
    const w = e.lift < 2 ? (e.f.includes('sit') ? 14 : 10) : e.lift < 8 ? 8 : e.lift < 16 ? 6 : 4;
    tl['sh_' + k].push({ f: 'sh' + w, x: e.x - (w >> 1) + (e.f.includes('sit') ? (e.f.endsWith('_f') ? -2 : 2) : 0), y: F - 1 });
  }
  // ball
  let b;
  if (t < 14) b = [aj.x + 9, F + [-11, -8, -4, -4, -8, -12][t % 6]];
  else if (t < 16) b = [aj.x + 12, F - 18];
  else if (t < 19) { const k = (t - 15) / 3; b = [lerp(38, 60, k), lerp(F - 18, F - 4, k * k)]; }
  else if (t < 22) { const k = (t - 18) / 3; const h = hand(tl.ai[t]); b = [lerp(60, h[0] + 1, k), lerp(F - 4, h[1], 1 - (1 - k) ** 2)]; }
  else if (t < 24) { const h = hand(ai); b = [h[0] + 1, h[1] - 1]; }
  else if (t < 38) b = [ai.x + 10, F + [-12, -7, -3, -7][t % 4]];
  else if (t <= IMPACT) { const h = hand(ai); b = [h[0] + (ai.f.includes('leap') ? 0 : 1), h[1] - 2]; }
  else if (t < IMPACT + 6) b = [RIM[0] - (t - IMPACT) * 0.6, RIM[1] + 4 + (t - IMPACT) * 5.5];
  else if (t < IMPACT + 12) { const k = (t - IMPACT - 6) / 6; b = [lerp(166, 150, k), F - 4 - 8 * Math.sin(Math.PI * k)]; }
  else if (t < IMPACT + 18) { const k = (t - IMPACT - 12) / 6; b = [lerp(150, 140, k), F - 4 - 3 * Math.sin(Math.PI * k)]; }
  else b = [lerp(140, 132, clamp01((t - IMPACT - 18) / 10)), F - 4];
  b = [Math.min(b[0], 199), Math.min(b[1], F - 4)];
  tl.ball.push({ f: 'ball' + ((t >> (t > IMPACT + 18 ? 1 : 0)) % 4), x: Math.round(b[0] - 4.5), y: Math.round(b[1] - 4.5) });
  const bh = F - b[1], bw = bh < 6 ? 8 : bh < 18 ? 6 : 4;
  tl.bsh.push({ f: 'sh' + bw, x: Math.round(b[0] - bw / 2), y: F - 1 });
  // rim/net, effects, scoreboard
  tl.net.push({ f: t >= IMPACT && t < 69 ? (t < IMPACT + 2 ? 'net_down_b' : 'net_rest_b') : t === 69 ? 'net_up' : 'net_rest', x: 163, y: 19 });
  tl.speed.push((t >= 27 && t < 38) || (t >= 42 && t < 51) ? { f: 'speed', x: ai.x - 22, y: ai.y - 20 } : null);
  tl.burst.push(t === IMPACT ? { f: 'burst1', x: RIM[0] - 22, y: RIM[1] - 17 } : t > IMPACT && t < IMPACT + 3 ? { f: 'burst2', x: RIM[0] - 22, y: RIM[1] - 17 } : null);
  tl.spark.push(t >= IMPACT + 1 && t < IMPACT + 6 ? { f: 'spark', x: [158, 178, 156, 180, 166][t - IMPACT - 1], y: [12, 10, 24, 22, 6][t - IMPACT - 1] } : null);
  tl.dunk.push(t >= IMPACT && t < IMPACT + 22 ? { f: 'dunk', x: 92 + (t === IMPACT ? -2 : 0), y: t === IMPACT ? 1 : t === IMPACT + 1 ? 2 : 3 } : null);
  tl.score.push({ f: t >= IMPACT ? 's30' : 's28', x: 33, y: 7 });
  tl.clock.push({ f: t < 20 ? 'c3' : t < 38 ? 'c2' : t < IMPACT ? 'c1' : (t < IMPACT + 12 && t % 4 >= 2) ? 'c0dim' : 'c0', x: 18, y: 15 });
  tl.cheer.push(t >= IMPACT && t < 90 && ((t >> 2) & 1) === 0 ? { f: 'cheer', x: 0, y: (t >> 1) & 1 ? 0 : -1 } : null);
  SHAKE.push([[-3, 1], [3, -1], [-2, 1], [2, 0], [-1, 0]][t - IMPACT] || [0, 0]);
  FLASH.push(t === IMPACT ? 0.45 : t === IMPACT + 1 ? 0.15 : 0);
}

// ---------- sprites ----------
const sprites = {};
for (const kind of Object.keys(KINDS)) for (const [name, pose] of Object.entries(POSES)) for (const f of [false, true]) {
  const key = `${kind}_${name}${f ? '_f' : ''}`;
  Object.defineProperty(sprites, key, { enumerable: true, configurable: true, get() { const s = figure(kind, pose, f); Object.defineProperty(sprites, key, { value: s }); return s; } });
}
for (let i = 0; i < 4; i++) sprites['ball' + i] = { L: ballFrame(i * Math.PI / 4), ox: 0, oy: 0 };
for (const [k, rows] of Object.entries(NETS)) { sprites['net_' + k] = { L: netFrame(rows, false), ox: 0, oy: 0 }; sprites['net_' + k + '_b'] = { L: netFrame(rows, true), ox: 0, oy: 0 }; }
for (const w of [4, 6, 8, 10, 14]) sprites['sh' + w] = { L: shadowFrame(w), ox: 0, oy: 0 };
for (const [k, str, c] of [['c3', '0:03', '#8c95ab'], ['c2', '0:02', '#8c95ab'], ['c1', '0:01', C.yellow], ['c0', '0:00', C.led], ['c0dim', '0:00', C.ledD]]) { const L = layer(16, 5); text(L, 0, 0, str, c); sprites[k] = { L, ox: 0, oy: 0 }; }
sprites.s28 = { L: digits('28'), ox: 0, oy: 0 }; sprites.s30 = { L: digits('30'), ox: 0, oy: 0 };
sprites.dunk = { L: dunkText(), ox: 0, oy: 0 }; sprites.spark = { L: sparkle(), ox: 0, oy: 0 }; sprites.cheer = { L: crowdCheer(), ox: 0, oy: 0 };
sprites.burst1 = { L: burst(5, 10), ox: 0, oy: 0 }; sprites.burst2 = { L: burst(10, 16), ox: 0, oy: 0 }; sprites.speed = { L: speedLines(), ox: 0, oy: 0 };

const ORDER = ['cheer', 'score', 'clock', 'sh_aj', 'sh_d1', 'sh_d2', 'sh_ai', 'bsh', 'speed', 'aj', 'd1', 'd2', 'ai', 'ball', 'net', 'burst', 'spark', 'dunk'];

// ---------- SVG output ----------
function rle(L) {
  const runs = [];
  for (let y = 0; y < L.h; y++) { let x = 0; while (x < L.w) { const c = L.px[y * L.w + x]; if (!c) { x++; continue; } let e = x + 1; while (e < L.w && L.px[y * L.w + e] === c) e++; runs.push({ x, y, w: e - x, h: 1, c }); x = e; } }
  const open = new Map(), out = [];
  for (const r of runs) { const k = `${r.x},${r.w},${r.c}`, o = open.get(k); if (o && o.y + o.h === r.y) o.h++; else { const n = { ...r }; open.set(k, n); out.push(n); } }
  const byFill = new Map(); for (const r of out) { if (!byFill.has(r.c)) byFill.set(r.c, []); byFill.get(r.c).push(r); }
  let svg = '';
  for (const [c, rs] of byFill) svg += `<path fill="${c}" d="${rs.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`).join('')}"/>`;
  return svg;
}
const kt = (i) => (i / TICKS).toFixed(4);
const comp = (vals) => { const k = [], v = []; vals.forEach((x, i) => { if (i === 0 || x !== vals[i - 1]) { k.push(kt(i)); v.push(x); } }); return { k: k.join(';'), v: v.join(';') }; };
const anim = (attr, vals, extra = '') => { const c = comp(vals); return c.v.includes(';') ? `<animate${extra ? 'Transform' : ''} attributeName="${attr}"${extra} dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${c.k}" values="${c.v}"/>` : ''; };
// One <g> per sprite frame: visible on the ticks that use it, moved with discrete translates.
function track(entries) {
  let out = '';
  const names = [...new Set(entries.filter(Boolean).map(e => e.f))];
  for (const name of names) {
    const s = sprites[name], vis = [], pos = [];
    let last = null;
    entries.forEach((e) => { const on = e && e.f === name; if (on) last = `${e.x - s.ox},${e.y - s.oy}`; vis.push(on ? 'visible' : 'hidden'); pos.push(last); });
    const first = pos.find(Boolean); for (let i = 0; i < pos.length; i++) if (!pos[i]) pos[i] = first;
    out += `<g visibility="${vis[0]}" transform="translate(${pos[0]})">${anim('visibility', vis)}${anim('transform', pos, ' type="translate"')}${rle(s.L)}</g>\n`;
  }
  return out;
}
const BG = background();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges" role="img" aria-label="Pixel-art loop: 2 on 2. AJ passes to AI teammate number 23, who drives through both defenders and dunks over them at the buzzer, 30 to 29">
<title>AJ + AI: pass, drive, dunk</title>
<rect x="-4" y="-4" width="${W + 8}" height="${H + 8}" fill="#121424"/>
<g transform="translate(0,0)">${anim('transform', SHAKE.map(([x, y]) => `${x},${y}`), ' type="translate"')}
<g>${rle(BG)}</g>
${ORDER.map((k) => track(tl[k])).join('')}</g>
<rect width="${W}" height="${H}" fill="#fff8e0" opacity="0">${anim('opacity', FLASH.map(String))}</rect>
</svg>`;
writeFileSync(new URL('../assets/hoops.svg', import.meta.url), svg);
console.log('wrote assets/hoops.svg', (svg.length / 1024).toFixed(1), 'KB');

// ---------- preview: composite frames into a PNG contact sheet (node tools/hoops.mjs --preview out.png [step]) ----------
const pi = process.argv.indexOf('--preview');
if (pi > 0) {
  const { deflateSync } = await import('node:zlib');
  const step = +(process.argv[pi + 2] || 4), t0 = +(process.argv[pi + 3] || 0), t1 = +(process.argv[pi + 4] || TICKS), ticks = []; for (let t = t0; t < t1; t += step) ticks.push(t);
  const cols = +(process.env.COLS || 2), s = +(process.env.S || 2), gap = 4, X0 = +(process.env.X0 || 0), CW = W - X0, FW = CW * s, FH = H * s, SW = cols * (FW + gap) + gap, SH = Math.ceil(ticks.length / cols) * (FH + gap) + gap;
  const img = new Uint8Array(SW * SH * 3).fill(24);
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  ticks.forEach((t, n) => {
    const fr = BG.px.slice();
    for (const k of ORDER) { const e = tl[k][t]; if (!e) continue; const sp = sprites[e.f], L = sp.L;
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const c = L.px[y * L.w + x]; const X = e.x - sp.ox + x, Y = e.y - sp.oy + y; if (c && X >= 0 && Y >= 0 && X < W && Y < H) fr[Y * W + X] = c; } }
    const [dx, dy] = SHAKE[t], fa = FLASH[t], ox = gap + (n % cols) * (FW + gap), oy = gap + ((n / cols) | 0) * (FH + gap);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const sx = ((x / s) | 0) + X0 - dx, sy = ((y / s) | 0) - dy; let c = sx >= 0 && sy >= 0 && sx < W && sy < H ? hex(fr[sy * W + sx]) : [18, 20, 36];
      if (fa) c = c.map((v, i) => Math.round(v + ([255, 248, 224][i] - v) * fa)); img.set(c, ((oy + y) * SW + ox + x) * 3); }
  });
  const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const tb = Buffer.from(ty), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(Buffer.concat([tb, d]))); return Buffer.concat([l, tb, d, c]); };
  const raw = Buffer.alloc((SW * 3 + 1) * SH); for (let y = 0; y < SH; y++) Buffer.from(img.buffer, y * SW * 3, SW * 3).copy(raw, y * (SW * 3 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(SW, 0); ih.writeUInt32BE(SH, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(process.argv[pi + 1], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('preview', process.argv[pi + 1], ticks.length, 'frames');
}
