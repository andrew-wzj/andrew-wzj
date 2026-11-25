// Generates assets/hoops.svg: an original pixel-art loop. AJ passes, the AI teammate shoots, swish, 30 points.
// Run: node tools/hoops.mjs
import { writeFileSync } from 'node:fs';

const P = { K:'#1d1a17', S:'#f1c29a', H:'#2b2d42', T:'#3dd6d0', W:'#ffffff', O:'#ff8a3d', o:'#c85a1e', R:'#ff6b6b', B:'#5ec8f2',
            G:'#b8c0d0', g:'#7d869a', C:'#3dd6d0', Y:'#ffd23f', N:'#c8925a', n:'#a8743f' };
const sprite = (rows, x, y, s, extra = '') => {
  let out = '';
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') out += `<rect x="${x + i * s}" y="${y + j * s}" width="${s}" height="${s}" fill="${P[c]}"/>`; }));
  return `<g ${extra}>${out}</g>`;
};
const AJ = [
  '...HHHH...','..HHHHHH..','..HSSSSH..','..SKSSKS..','..SSSSSS..','...SRRS...',
  '.TTTTTTTT.','STTTWWTTTS','STTTTWTTTS','STTTWWTTTS','.TTTTTTTT.','..BBBBBB..','..BB..BB..','..SS..SS..','..SS..SS..','.KKK..KKK.'];
const AI = [
  '....Y.....','....K.....','.KKKKKKKK.','.KGGGGGGK.','.KGCGGCGK.','.KGGGGGGK.','.KGKKKKGK.','.KKKKKKKK.',
  '.RRRRRRRR.','gRRWWWRRRg','gRRRRWRRRg','gRRWWWRRRg','.RRRRRRRR.','..KKKKKK..','..GG..GG..','..GG..GG..','.KKK..KKK.'];
const BALL = ['..KKKK..','.KOOKOK.','KOOOKOOK','KKKKKKKK','KOOKOOOK','KOOKOOOK','.KOKOOK.','..KKKK..'];

const W = 800, H = 220, FLOOR = 184, s = 4, T = 4.5;
// ball path as timed waypoints (t in seconds, x, y = ball centre)
const lerp = (a, b, k) => a + (b - a) * k;
const pts = [];
const seg = (t0, t1, f) => { for (let i = 0; i <= 30; i++) { const k = i / 30; pts.push([lerp(t0, t1, k), ...f(k)]); } };
const handAJ = [142, 128], handAI = [420, 124], over = [412, 70], rim = [688, 96];
seg(0.0, 0.45, k => [lerp(handAJ[0], 280, k), lerp(handAJ[1], FLOOR - 16, k * k)]);                         // bounce pass down
seg(0.45, 0.9, k => [lerp(280, handAI[0], k), lerp(FLOOR - 16, handAI[1], 1 - (1 - k) * (1 - k))]);         // ...and up to AI
seg(0.9, 1.3, k => [lerp(handAI[0], over[0], k), lerp(handAI[1], over[1], k)]);                              // rise for the shot
seg(1.3, 2.4, k => [lerp(over[0], rim[0], k), lerp(over[1], rim[1], k) - 150 * k * (1 - k) * 1.2]);          // jumper
seg(2.4, 2.8, k => [rim[0], lerp(rim[1], FLOOR - 16, k * k)]);                                               // through the net
seg(2.8, T, k => [rim[0] + 40 * k, FLOOR - 16 - 18 * Math.sin(Math.PI * Math.min(1, k * 2)) ]);              // little bounce
const kt = pts.map(p => (p[0] / T).toFixed(4)).join(';');
const vals = pts.map(p => `${(p[1] - 16).toFixed(1)},${(p[2] - 16).toFixed(1)}`).join(';');
const at = (t) => (t / T).toFixed(4);
const blink = (t0, t1) => `<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${at(t0)};${at(t1)}" values="0;1;0"/>`;

// court: hardwood planks
let floor = '';
for (let x = 0; x < W; x += 48) floor += `<rect x="${x}" y="${FLOOR}" width="47" height="${H - FLOOR}" fill="${(x / 48) % 2 ? P.N : '#d39d63'}"/>`;
floor += `<rect x="0" y="${FLOOR}" width="${W}" height="4" fill="${P.n}"/>`;
// crowd dots
let crowd = '';
for (let i = 0; i < 70; i++) { const x = (i * 53) % W, y = 18 + ((i * 37) % 70); crowd += `<rect x="${x}" y="${y}" width="4" height="4" fill="${['#3b3f5c','#4a4f72','#2f3350'][i % 3]}"/>`; }

// hoop: pole, backboard, rim, net
const hoop = `
  <rect x="752" y="40" width="8" height="${FLOOR - 40}" fill="${P.g}"/>
  <rect x="712" y="52" width="44" height="6" fill="${P.g}"/>
  <rect x="704" y="30" width="12" height="76" fill="${P.W}"/><rect x="704" y="30" width="12" height="76" fill="none" stroke="${P.K}" stroke-width="4"/>
  <rect x="664" y="96" width="44" height="6" fill="${P.R}"/><rect x="664" y="96" width="44" height="6" fill="none" stroke="${P.K}" stroke-width="2"/>
  <g id="net"><path d="M668 102 L676 126 L684 102 L692 126 L700 102 L704 126 M672 126 L700 126 M676 114 L700 114" stroke="${P.W}" stroke-width="3" fill="none"/>
    <animateTransform attributeName="transform" type="translate" dur="${T}s" repeatCount="indefinite" calcMode="linear"
      keyTimes="0;${at(2.45)};${at(2.55)};${at(2.7)};1" values="0,0;0,0;0,6;0,0;0,0"/></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" role="img" aria-label="Pixel-art loop: AJ passes, the AI teammate shoots, swish, 30 points">
<title>AJ + AI: 30 points</title>
<rect width="${W}" height="${H}" fill="#24273f"/>
${crowd}
<rect x="0" y="${FLOOR - 70}" width="${W}" height="70" fill="#2d3150"/>
${floor}
<!-- scoreboard -->
<g font-family="'Courier New',monospace" font-weight="700">
  <rect x="24" y="16" width="196" height="64" fill="${P.K}"/><rect x="28" y="20" width="188" height="56" fill="#111"/>
  <text x="40" y="42" fill="${P.Y}" font-size="16">AJ + AI</text>
  <text x="40" y="66" fill="${P.G}" font-size="12">4TH QTR · 0:01</text>
  <text x="160" y="64" fill="${P.R}" font-size="34">28<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${at(2.5)}" values="1;0"/></text>
  <text x="160" y="64" fill="${P.R}" font-size="34" opacity="0">30<animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${at(2.5)}" values="0;1"/></text>
</g>
${sprite(AJ, 104, FLOOR - AJ.length * s - 0, s)}
<text x="124" y="${FLOOR + 24}" text-anchor="middle" font-family="'Courier New',monospace" font-weight="700" font-size="14" fill="${P.K}">AJ · PG</text>
<g>${sprite(AI, 396, FLOOR - AI.length * s, s)}
  <animateTransform attributeName="transform" type="translate" dur="${T}s" repeatCount="indefinite" calcMode="linear"
    keyTimes="0;${at(1.0)};${at(1.35)};${at(1.7)};1" values="0,0;0,0;0,-22;0,0;0,0"/></g>
<text x="416" y="${FLOOR + 24}" text-anchor="middle" font-family="'Courier New',monospace" font-weight="700" font-size="14" fill="${P.K}">AI · #23</text>
${hoop}
<g><g>${sprite(BALL, 0, 0, s)}
  <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="0.9s" repeatCount="indefinite"/></g>
  <animateTransform attributeName="transform" type="translate" dur="${T}s" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${vals}"/></g>
<g font-family="'Courier New',monospace" font-weight="700" opacity="0">
  <text x="560" y="64" fill="${P.Y}" font-size="30" stroke="${P.K}" stroke-width="1.5">SWISH!</text>
  <text x="300" y="44" fill="${P.W}" font-size="15">AJ → AI · AST 1 · PTS 30</text>
  ${blink(2.5, 4.4)}
</g>
</svg>`;
writeFileSync(new URL('../assets/hoops.svg', import.meta.url), svg);
console.log('wrote assets/hoops.svg', svg.length, 'bytes');
