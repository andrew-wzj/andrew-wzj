// Generates assets/hoops.svg: an original pixel-art loop.
// AJ dribbles and passes, the AI teammate (#23) rises and shoots, swish, the scoreboard goes 28 → 30.
// Native canvas 200×60, drawn at 4× with crisp rects. Frame animation uses SMIL (works in GitHub READMEs).
// Run: node tools/hoops.mjs
import { writeFileSync } from 'node:fs';

const W = 200, H = 60, SCALE = 4, FPS = 12, TICKS = 64;
const T = TICKS / FPS;

// ---------- palettes: each ramp goes outline, shadow, base, light, highlight ----------
const R = {
  skin:  ['#3a2219', '#9a5a3e', '#c98763', '#e8ae84', '#f8d4b0'],
  teal:  ['#0c3134', '#16747a', '#22a8a8', '#4fd9cf', '#a9f2ea'],
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
  while (x < W) { x = text(L, x, 27, 'PASS · SHOOT · SWISH', '#3fe3e0') + 4; x = text(L, x, 27, 'AJ + AI', C.yellow) + 8; }
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
  // shadows under players
  for (const [cx, w] of [[34, 14], [110, 14]]) { rect(L, cx - w / 2, 55, w, 2, '#5a3018'); rect(L, cx - w / 2 + 2, 54, w - 4, 1, '#6d3a1d'); }
  // hoop: pole, arm, backboard, back of rim
  rect(L, 186, 9, 4, 48, R.metal[1]); rect(L, 186, 9, 1, 48, R.metal[3]); rect(L, 189, 9, 1, 48, R.metal[0]);
  rect(L, 183, 55, 10, 4, R.metal[0]); rect(L, 184, 55, 8, 1, R.metal[2]);
  rect(L, 179, 12, 8, 3, R.metal[1]); rect(L, 179, 12, 8, 1, R.metal[3]);
  rect(L, 176, 4, 4, 24, '#ffffff'); rect(L, 175, 3, 6, 1, C.ink); rect(L, 175, 28, 6, 1, C.ink); rect(L, 175, 4, 1, 24, C.ink); rect(L, 180, 4, 1, 24, C.ink);
  rect(L, 178, 4, 2, 24, '#d6dcea'); rect(L, 177, 13, 1, 9, '#e8584b');
  rect(L, 164, 20, 12, 1, '#9a3a12');                         // back half of the rim
  // scoreboard frame (digits are animated)
  rect(L, 4, 3, 52, 21, C.ink); rect(L, 5, 4, 50, 19, '#07070c'); rect(L, 5, 4, 50, 1, '#2a2f4a');
  text(L, 8, 7, 'AJ+AI', C.yellow);
  text(L, 8, 15, '4Q', '#8c95ab');
  return L;
}
function mix(a, b, k) {
  if (!a) return b;
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// ---------- characters ----------
const HEAD_AJ = [
  '..kkkkk..',
  '.khHHHhk.',
  'khhHHhhhk',
  'khhhhhLLk',
  'khhsSSeLk',
  'kkksSSSLk',
  '.kssSSSSk',
  '.ksSSSmk.',
  '..ksSSk..',
  '...kkk...',
];
const HEAD_AI = [
  '....ky....',
  '....k.....',
  '.kkkkkkkk.',
  'k4443332k.',
  'kvvvvVVvk.',
  'kvVgvvVvk.',
  'k3333221k.',
  '.k22211k..',
  '..kkkkk...',
];
const mapAJ = { k: R.skin[0], h: C.hair, H: C.hairL, s: R.skin[1], S: R.skin[2], L: R.skin[3], e: C.eye, m: C.mouth };
const mapAI = { k: R.metal[0], y: C.yellow, 1: R.metal[1], 2: R.metal[2], 3: R.metal[3], 4: R.metal[4], v: C.visor, V: C.visorL, g: C.glint };

// pose: points relative to the feet (x right, y up = negative)
function figure(kind, pose) {
  const L = layer(36, 46), ox = 16, oy = 44;
  const P = (p) => [ox + p[0], oy + p[1]];
  const ai = kind === 'ai';
  const limb = ai ? R.metal : R.skin, limbD = ai ? R.metalD : R.skin.map((c, i) => (i ? R.skin[Math.max(1, i - 1)] : c));
  const shirt = ai ? R.red : R.teal, shorts = ai ? R.redD : R.tealD;
  const { n, p, eF, hF, eB, hB, kF, fF, kB, fB } = pose;
  const sh = (dx) => [n[0] + dx, n[1] + 1.5];
  // back arm + back leg (one step darker)
  capsule(L, P(sh(-1.5)), P(eB), 1.3, limbD); capsule(L, P(eB), P(hB), 1.2, limbD); disc(L, P(hB), 1.6, limbD);
  capsule(L, P([p[0] - 1.5, p[1]]), P(kB), 1.6, limbD); capsule(L, P(kB), P(fB), 1.4, limbD);
  shoe(L, P(fB), true);
  // torso + shorts
  capsule(L, P([n[0], n[1] + 3]), P([p[0], p[1] - 2]), 4.6, shirt);
  capsule(L, P([p[0] - 0.5, p[1] - 1.5]), P([p[0] + 0.5, p[1] + 1.5]), 4.4, shorts);
  // jersey number, catching the light
  const num = ai ? '23' : '1', tx = Math.round(P(n)[0] - textWidth(num) / 2 + (ai ? -1 : 0.5)), ty = Math.round(P(n)[1] + 4);
  text(L, tx, ty, num, '#ffffff');
  // front leg
  capsule(L, P([p[0] + 1.5, p[1]]), P(kF), 1.6, limb); capsule(L, P(kF), P(fF), 1.4, limb);
  if (!ai) { const [fx, fy] = P(fF); rect(L, Math.round(fx) - 1, Math.round(fy) - 4, 3, 2, '#f2f2f6'); }
  shoe(L, P(fF), false);
  // head
  const [hx, hy] = P(n);
  if (ai) grid(L, Math.round(hx) - 4, Math.round(hy) - 9, HEAD_AI, mapAI); else grid(L, Math.round(hx) - 4, Math.round(hy) - 10, HEAD_AJ, mapAJ);
  // front arm
  capsule(L, P(sh(1.5)), P(eF), 1.3, limb); capsule(L, P(eF), P(hF), 1.2, limb); disc(L, P(hF), 1.7, limb);
  return { L, ox, oy };
}
function shoe(L, [x, y], back) {
  x = Math.round(x); y = Math.round(y);
  const r = back ? R.shoe.map((c, i) => (i ? R.shoe[Math.max(1, i - 1)] : c)) : R.shoe;
  rect(L, x - 2, y - 1, 5, 2, r[2]); rect(L, x - 2, y - 1, 5, 1, r[3]); rect(L, x - 3, y, 7, 1, r[0]); rect(L, x - 3, y - 2, 6, 1, r[0]);
  put(L, x + 2, y - 1, back ? '#8f2532' : '#e8584b');
}
const v = (x, y) => [x, y];
const POSES = {
  aj: {
    low:  { n: v(1, -22), p: v(0, -12), eF: v(5, -16), hF: v(8, -12), eB: v(-3, -16), hB: v(-2, -12), kF: v(4, -6), fF: v(4, 0), kB: v(-2, -6), fB: v(-4, 0) },
    high: { n: v(1, -23), p: v(0, -12), eF: v(5, -17), hF: v(8, -15), eB: v(-3, -17), hB: v(-2, -13), kF: v(4, -6), fF: v(4, 0), kB: v(-2, -6), fB: v(-4, 0) },
    pass: { n: v(2, -22), p: v(0, -12), eF: v(6, -19), hF: v(11, -18), eB: v(5, -18), hB: v(10, -16), kF: v(5, -6), fF: v(7, 0), kB: v(-2, -5), fB: v(-5, 0) },
    cheer:{ n: v(0, -23), p: v(0, -12), eF: v(3, -27), hF: v(5, -32), eB: v(-3, -27), hB: v(-4, -32), kF: v(2, -6), fF: v(2, 0), kB: v(-2, -6), fB: v(-3, 0) },
  },
  ai: {
    idle:  { n: v(0, -22), p: v(0, -12), eF: v(2, -16), hF: v(3, -11), eB: v(-2, -16), hB: v(-2, -11), kF: v(1, -6), fF: v(2, 0), kB: v(-1, -6), fB: v(-2, 0) },
    catch: { n: v(0, -22), p: v(0, -12), eF: v(4, -18), hF: v(6, -17), eB: v(2, -18), hB: v(5, -16), kF: v(2, -6), fF: v(3, 0), kB: v(-1, -6), fB: v(-3, 0) },
    crouch:{ n: v(1, -19), p: v(-1, -9), eF: v(4, -15), hF: v(5, -18), eB: v(2, -15), hB: v(4, -17), kF: v(3, -5), fF: v(2, 0), kB: v(1, -5), fB: v(-2, 0) },
    rise:  { n: v(0, -22), p: v(0, -12), eF: v(3, -27), hF: v(4, -31), eB: v(1, -26), hB: v(3, -30), kF: v(1, -6), fF: v(1, 0), kB: v(-1, -6), fB: v(-1, 0) },
    flick: { n: v(0, -22), p: v(0, -12), eF: v(4, -27), hF: v(7, -31), eB: v(1, -24), hB: v(3, -27), kF: v(1, -6), fF: v(1, 0), kB: v(-1, -6), fB: v(-1, 0) },
    land:  { n: v(1, -20), p: v(-1, -10), eF: v(4, -26), hF: v(6, -30), eB: v(2, -16), hB: v(3, -12), kF: v(3, -5), fF: v(2, 0), kB: v(1, -5), fB: v(-2, 0) },
  },
};

// ---------- ball, net, rim front, sparkles ----------
function ballFrame(angle) {
  const L = layer(9, 9), c = [4.5, 4.5];
  disc(L, c, 3.4, R.ball);
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
function netFrame(rows) {
  const L = layer(14, 10);
  grid(L, 1, 1, rows, { k: '#9a3a12', w: '#eef2fa' });
  rect(L, 0, 0, 14, 1, '#e8783a'); rect(L, 0, 1, 14, 1, '#9a3a12'); rect(L, 1, 0, 6, 1, '#ffb36b');  // front of the rim
  return L;
}
function sparkle() { const L = layer(5, 5); grid(L, 0, 0, ['..y..', '..Y..', 'yYWYy', '..Y..', '..y..'], { y: C.yellowD, Y: C.yellow, W: '#fffbe0' }); return L; }
function shadowFrame(w) { const L = layer(w, 2); rect(L, 1, 0, w - 2, 1, '#6d3a1d'); rect(L, 0, 1, w, 1, '#5a3018'); return L; }
function digits(str) { const L = layer(24, 11); text(L, 0, 0, str, C.led, 2, C.ledD); return L; }
function swish() { const L = layer(60, 14); text(L, 1, 1, 'SWISH!', '#1a1206', 2); text(L, 0, 0, 'SWISH!', C.yellow, 2); return L; }
function crowdCheer() {
  // raised arms in the front crowd row
  const L = layer();
  for (let x = 2 + 6 + 56; x < W; x += 14) { rect(L, x - 1, 15, 1, 4, '#7a5240'); rect(L, x + 6, 15, 1, 4, '#7a5240'); put(L, x - 1, 14, '#94664c'); put(L, x + 6, 14, '#94664c'); }
  return L;
}

// ---------- timeline ----------
const lerp = (a, b, k) => a + (b - a) * k;
const AJ_X = 34, AI_X = 110, FLOOR_Y = 55;
const tl = { aj: [], ai: [], ball: [], net: [], score: [], swish: [], spark: [], shadow: [], cheer: [], clock: [] };
for (let t = 0; t < TICKS; t++) {
  // AJ
  let aj = t < 18 ? ((t % 6) >= 4 || t % 6 === 0 ? 'high' : 'low') : t < 24 ? 'pass' : t >= 52 ? 'cheer' : 'low';
  tl.aj.push({ f: 'aj_' + aj, x: AJ_X, y: FLOOR_Y });
  // AI
  let ai = 'idle', lift = 0;
  if (t >= 26 && t < 31) ai = 'catch';
  else if (t >= 31 && t < 35) ai = 'crouch';
  else if (t >= 35 && t < 39) { ai = 'rise'; lift = [3, 6, 8, 9][t - 35]; }
  else if (t >= 39 && t < 43) { ai = 'flick'; lift = [9, 8, 6, 3][t - 39]; }
  else if (t >= 43 && t < 47) ai = 'land';
  else if (t >= 47) ai = t >= 52 ? 'land' : 'idle';
  tl.ai.push({ f: 'ai_' + ai, x: AI_X, y: FLOOR_Y - lift });
  // ball centre
  let b = null;
  if (t < 18) { const ph = t % 6; b = [AJ_X + 9, FLOOR_Y + [-11, -8, -4, -4, -8, -12][ph]]; }
  else if (t < 20) b = [AJ_X + 12, FLOOR_Y - 18];
  else if (t < 24) { const k = (t - 19) / 4; b = [lerp(AJ_X + 12, 74, k), lerp(FLOOR_Y - 18, FLOOR_Y - 4, k * k)]; }
  else if (t < 27) { const k = (t - 23) / 3; b = [lerp(74, AI_X + 6, k), lerp(FLOOR_Y - 4, FLOOR_Y - 17, 1 - (1 - k) ** 2)]; }
  else if (t < 31) b = [AI_X + 6, FLOOR_Y - 17];
  else if (t < 35) b = [AI_X + 5, FLOOR_Y - 18];
  else if (t < 39) b = [AI_X + 4, FLOOR_Y - tl.ai[t].y * 0 - (FLOOR_Y - tl.ai[t].y) - 33];
  else if (t < 52) { const k = (t - 39) / 12; b = [lerp(AI_X + 7, 170, k), lerp(FLOOR_Y - 9 - 33, 19, k) - 9 * 4 * k * (1 - k)]; }
  else if (t < 55) b = [170, [23, 28, 33][t - 52]];
  else if (t < 58) { const k = (t - 54) / 3; b = [lerp(170, 166, k), lerp(33, FLOOR_Y - 4, k * k)]; }
  else if (t < 62) { const k = (t - 57) / 4; b = [lerp(166, 156, k), FLOOR_Y - 4 - 7 * Math.sin(Math.PI * k)]; }
  tl.ball.push(b ? { f: 'ball' + (t % 4), x: Math.round(b[0] - 4.5), y: Math.round(b[1] - 4.5) } : null);
  tl.shadow.push(b && t < 62 ? (() => { const hgt = FLOOR_Y - b[1]; const w = hgt < 6 ? 8 : hgt < 18 ? 6 : 4; return { f: 'sh' + w, x: Math.round(b[0] - w / 2), y: FLOOR_Y - 1 }; })() : null);
  tl.net.push({ f: t === 52 || t === 53 ? 'net_down' : t === 54 ? 'net_up' : 'net_rest', x: 163, y: 19 });
  tl.score.push({ f: t >= 52 ? 's30' : 's28', x: 33, y: 7 });
  // game clock counts down 0:03 → 0:00; it hits zero as the ball leaves AI's hand (buzzer beater)
  tl.clock.push({ f: t < 15 ? 'c3' : t < 27 ? 'c2' : t < 39 ? 'c1' : (t < 52 && t % 4 >= 2) ? 'c0dim' : 'c0', x: 18, y: 15 });
  tl.swish.push(t >= 52 && t < 62 && !(t === 57 || t === 58) ? { f: 'swish', x: 120, y: 4 } : null);
  tl.spark.push(t >= 52 && t < 56 ? { f: 'spark', x: [158, 176, 160, 174][t - 52], y: [14, 15, 26, 25][t - 52] } : null);
  tl.cheer.push(t >= 52 && t < 63 ? { f: 'cheer', x: 0, y: 0 } : null);
}

// ---------- sprites ----------
const sprites = {};
for (const [name, pose] of Object.entries(POSES.aj)) { const { L, ox, oy } = figure('aj', pose); sprites['aj_' + name] = { L, ox, oy }; }
for (const [name, pose] of Object.entries(POSES.ai)) { const { L, ox, oy } = figure('ai', pose); sprites['ai_' + name] = { L, ox, oy }; }
for (let i = 0; i < 4; i++) sprites['ball' + i] = { L: ballFrame(i * Math.PI / 4), ox: 0, oy: 0 };
for (const [k, rows] of Object.entries(NETS)) sprites['net_' + k] = { L: netFrame(rows), ox: 0, oy: 0 };
for (const w of [4, 6, 8]) sprites['sh' + w] = { L: shadowFrame(w), ox: 0, oy: 0 };
for (const [k, str, c] of [['c3', '0:03', '#8c95ab'], ['c2', '0:02', '#8c95ab'], ['c1', '0:01', C.yellow], ['c0', '0:00', C.led], ['c0dim', '0:00', C.ledD]]) { const L = layer(16, 5); text(L, 0, 0, str, c); sprites[k] = { L, ox: 0, oy: 0 }; }
sprites.s28 = { L: digits('28'), ox: 0, oy: 0 }; sprites.s30 = { L: digits('30'), ox: 0, oy: 0 };
sprites.swish = { L: swish(), ox: 0, oy: 0 }; sprites.spark = { L: sparkle(), ox: 0, oy: 0 }; sprites.cheer = { L: crowdCheer(), ox: 0, oy: 0 };

// ---------- SVG output ----------
function rle(L) {
  let out = '';
  for (let y = 0; y < L.h; y++) {
    let x = 0;
    while (x < L.w) {
      const c = L.px[y * L.w + x];
      if (!c) { x++; continue; }
      let e = x + 1; while (e < L.w && L.px[y * L.w + e] === c) e++;
      out += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${c}"/>`;
      x = e;
    }
  }
  return out;
}
const kt = (i) => (i / TICKS).toFixed(4);
// One <g> per sprite frame: visible on the ticks that use it, moved with discrete translates.
function track(entries) {
  let out = '';
  const names = [...new Set(entries.filter(Boolean).map(e => e.f))];
  for (const name of names) {
    const s = sprites[name];
    const vis = [], pos = [];
    let last = null;
    entries.forEach((e, i) => {
      const on = e && e.f === name;
      if (on) last = `${e.x - s.ox},${e.y - s.oy}`;
      vis.push(on ? 'visible' : 'hidden');
      pos.push(last);
    });
    const first = pos.find(Boolean); for (let i = 0; i < pos.length; i++) if (!pos[i]) pos[i] = first;
    const comp = (vals) => { const k = [], v = []; vals.forEach((x, i) => { if (i === 0 || x !== vals[i - 1]) { k.push(kt(i)); v.push(x); } }); return { k: k.join(';'), v: v.join(';') }; };
    const cv = comp(vis), cp = comp(pos);
    const anim = `<animate attributeName="visibility" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${cv.k}" values="${cv.v}"/>`
      + (cp.v.includes(';') ? `<animateTransform attributeName="transform" type="translate" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${cp.k}" values="${cp.v}"/>` : '');
    out += `<g visibility="${vis[0]}" transform="translate(${pos[0]})">${anim}${rle(s.L)}</g>\n`;
  }
  return out;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" shape-rendering="crispEdges" role="img" aria-label="Pixel-art loop: AJ dribbles and passes, the AI teammate number 23 shoots, swish, the score goes from 28 to 30">
<title>AJ + AI: pass, shoot, swish</title>
<g>${rle(background())}</g>
${track(tl.cheer)}${track(tl.score)}${track(tl.clock)}${track(tl.shadow)}${track(tl.aj)}${track(tl.ai)}${track(tl.ball)}${track(tl.net)}${track(tl.spark)}${track(tl.swish)}
</svg>`;
writeFileSync(new URL('../assets/hoops.svg', import.meta.url), svg);
console.log('wrote assets/hoops.svg', (svg.length / 1024).toFixed(1), 'KB');
