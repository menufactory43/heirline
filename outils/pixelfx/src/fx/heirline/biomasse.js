// Heirline : la biomasse d'ÉDEN qui gagne une case. Des racines violettes rampent depuis le bord, se ramifient, se
// gonflent de bulbes qui palpitent et s'allument, puis la nappe de chair recouvre le sol et s'efface : le jeu
// garde la case dessinée, l'effet n'est que la poussée.
import { fit, smooth, ease, TAU, rand, loopNoise, WHITE } from "../../core/index.js";

export const meta = {
  name: "Biomass creep",
  desc: "Violet roots creep in from the edge, branch, swell with pulsing bulbs that light up, and a sheet of flesh covers the ground, breathing.",
  tags: ["heirline", "eden", "biomass", "creep", "roots", "ground", "one-shot"],
  size: [64, 46],
  origin: [32, 30],
  duration: 1.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1a0820", "#3d1240", "#6e1f6a", "#a8358f", "#d85bb0", "#f2a0d4", "#ffe0f2"],
    seed: 3,
  },
};

const D = meta.duration;
// un effet unique : la nappe pousse, palpite, puis s'efface (la case garde sa biomasse dessinée par le jeu)
const fin = (t) => 1 - smooth(D - 0.5, D - 0.05, t);
// des racines fixes (même graine, même dessin) : un tronc et deux branches chacune
const RACINES = [];
for (let i = 0; i < 7; i++) {
  const pts = [];
  let x = -26 + i * 8 + (rand(i, 1, 9) - 0.5) * 4, y = 8, a = -Math.PI / 2 + (rand(i, 2, 9) - 0.5) * 1.2;
  for (let j = 0; j < 8; j++) { pts.push([x, y]); a += (rand(i, j, 7) - 0.5) * 0.9; x += Math.cos(a) * 2.4; y += Math.sin(a) * 1.4 }
  RACINES.push(pts);
}
const BULBES = Array.from({ length: 9 }, (_, i) => ({ x: -24 + rand(i, 3, 4) * 48, y: -9 + rand(i, 5, 4) * 14, r: 1.5 + rand(i, 6, 4) * 1.6, ph: rand(i, 8, 4) * TAU }));

export function draw(p, t, o) {
  const C = fit(o.palette, 7), u = t / D;
  // la croissance va de 0 à 1 sur la première moitié, reste pleine, puis repart pour la boucle sans couture
  const pousse = ease.outCubic(Math.min(1, u / 0.55)), F = fin(t);
  if (F <= 0.02) return;
  const respire = 0.5 + 0.5 * Math.sin(TAU * u * 2);
  // la nappe : une ellipse de chair au sol, bord bruité
  const rx = 6 + 24 * pousse, ry = 3 + 7 * pousse;
  p.shade(-rx - 2, -ry - 2, rx + 2, ry + 2, (x, y, out) => {
    const n = loopNoise(x * 0.25, y * 0.4, 0, 1) * 0.35;
    const d = (x / rx) ** 2 + (y / ry) ** 2 - n;
    if (d > 1) return;
    out.c = d > 0.8 ? C[2] : d > 0.4 ? C[1] : (x + y) % 5 === 0 ? C[2] : C[1];
    out.a = (d > 0.85 ? 0.7 : 1) * F;
  });
  // les racines : elles avancent avec la croissance
  for (const pts of RACINES) {
    const n = Math.max(2, Math.round(pts.length * pousse));
    const q = pts.slice(0, n).map(([x, y]) => [x * (0.4 + 0.6 * pousse), y * (0.4 + 0.6 * pousse) - 2]);
    p.polyline(q, C[3], F);
    const [hx, hy] = q[q.length - 1];
    if (F > 0.5) p.px(hx, hy, C[5]);
    p.light(hx, hy, C[4], 0.3 * F);
  }
  // les bulbes : ils sortent quand la nappe est là, palpitent et s'allument
  for (const b of BULBES) {
    const k = F * smooth(0.25, 0.55, u) * (Math.hypot(b.x / rx, b.y / ry) < 1 ? 1 : 0);
    if (k <= 0) continue;
    const r = b.r * (0.6 + 0.4 * k) * (1 + 0.15 * Math.sin(TAU * u * 2 + b.ph));
    p.circle(b.x, b.y, r, (x, y) => (y < b.y - r * 0.3 ? C[5] : C[3]));
    if (k > 0.5) p.px(b.x - 1, b.y - r * 0.5, WHITE);
    p.glow(b.x, b.y, r * 3, C[4], (0.15 + 0.2 * respire) * k);
  }
  p.glow(0, 0, rx, C[3], (0.08 + 0.06 * respire) * F);
}
