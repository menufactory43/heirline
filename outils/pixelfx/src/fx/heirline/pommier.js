// Heirline : le pommier du Semeur, le seul abri pendant le désherbage. Un arbre fruitier de la Constance, tronc noueux,
// couronne qui se balance, pommes rouges qui luisent, un cercle de sève vivante à ses pieds et des feuilles qui
// tombent. En boucle : il doit se lire de loin comme « ici, on est à l'abri ».
import { fit, TAU, rand, smooth, WHITE, hex } from "../../core/index.js";

export const meta = {
  name: "Sower's apple tree",
  desc: "A gnarled apple tree with a swaying crown and glowing red apples, a ring of living sap at its feet, leaves drifting down: the one safe spot.",
  tags: ["heirline", "tree", "apple", "safe", "nature", "loop"],
  size: [80, 104],
  origin: [40, 74],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#08160c", "#0f3418", "#1a5e26", "#2e9a3a", "#6ad66a", "#c0f7b0", "#ffffff"],
    bark: ["#2a1a0e", "#4a2e18", "#6a4a2a", "#8a6a44"],
    apple: ["#5a0e0e", "#b0201c", "#ff5040", "#ffc0a0"],
    seed: 2,
  },
};

const D = meta.duration;
const TOUFFES = Array.from({ length: 11 }, (_, i) => ({ x: -13 + rand(i, 1, 3) * 26, y: -46 + rand(i, 2, 3) * 18, r: 6 + rand(i, 4, 3) * 4 }));
const POMMES = Array.from({ length: 6 }, (_, i) => ({ x: -11 + rand(i, 5, 6) * 22, y: -44 + rand(i, 7, 6) * 14, ph: rand(i, 8, 6) * TAU }));

export function drawBack(p, t, o) {
  const C = fit(o.palette, 7), u = t / D;
  // le cercle de sève au sol : un anneau plat qui pulse
  const k = 0.5 + 0.5 * Math.sin(TAU * u);
  p.ellipse(0, 0, 26, 7, C[1], 0.45);
  // l'anneau à plat sur le sol : une ellipse de deux pixels d'épaisseur
  p.shade(-28, -9, 28, 9, (x, y, out) => {
    const d = Math.sqrt((x / 26) ** 2 + (y / 7.5) ** 2);
    if (Math.abs(d - 1) > 0.07) return;
    out.c = C[4]; out.a = 0.7 + 0.3 * k; out.l = C[3]; out.k = 0.3 * k;
  });
  p.glow(0, -2, 28, C[3], 0.14 + 0.08 * k);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), Bk = fit(o.bark, 4), A = fit(o.apple, 4), u = t / D;
  const balance = Math.sin(TAU * u) * 1.2;
  // le tronc : noueux, éclairé à gauche
  for (let y = -30; y <= 0; y++) {
    const w = y > -6 ? 4 : 3, cx = Math.round(Math.sin(y * 0.25) * 1.2 + (y < -20 ? balance * 0.3 : 0));
    for (let x = -w; x <= w; x++) p.px(cx + x, y, x === -w ? Bk[3] : x === w ? Bk[0] : x < 0 ? Bk[2] : Bk[1]);
  }
  // deux branches
  p.line(0, -24, -9 + balance * 0.5, -34, Bk[1]); p.line(0, -26, 9 + balance * 0.5, -36, Bk[1]);
  // la couronne : des touffes de feuilles, lumière en haut à gauche, qui se balancent
  for (const f of TOUFFES) {
    const fx = f.x + balance * (1 + (-f.y - 36) * 0.05);
    p.circle(fx, f.y, f.r, (x, y) => {
      const l = -(x - fx) / f.r * 0.5 - (y - f.y) / f.r * 0.8;
      return l > 0.6 ? C[5] : l > 0.2 ? C[4] : l > -0.3 ? C[3] : C[2];
    });
  }
  // le liseré sombre sous la couronne
  for (const f of TOUFFES) if (f.y > -40) p.arc(f.x + balance, f.y, f.r, 1, 0.2, Math.PI - 0.2, C[1], 0.8);
  // les pommes : elles luisent doucement
  for (const m of POMMES) {
    const mx = m.x + balance, g = 0.5 + 0.5 * Math.sin(TAU * u + m.ph);
    p.circle(mx, m.y, 2, (x, y) => (y < m.y - 0.5 ? A[2] : A[1]));
    p.px(mx - 1, m.y - 1, A[3]);
    p.light(mx, m.y, hex("#ff6040"), 0.25 + 0.25 * g);
  }
  // des feuilles qui tombent, en boucle
  for (let i = 0; i < 4; i++) {
    const v = (u + i / 4) % 1, x = -14 + rand(i, 9, 2) * 28 + Math.sin(TAU * v * 2 + i) * 4, y = -36 + v * 36;
    p.px(x, y, v < 0.5 ? C[4] : C[3]);
  }
  p.glow(0, -40, 24, C[4], 0.1);
}
