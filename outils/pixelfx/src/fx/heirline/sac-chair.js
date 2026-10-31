// Heirline : le sac de ponte de la Couveuse qui crève. Une poche de chair veinée gonfle par à-coups, ses veines
// s'allument, elle tremble, puis éclate : une image blanche, des lambeaux de membrane qui retombent et collent, des
// gouttes de sève acide en gerbe, une flaque qui s'étale et fume. De la chair, pas un œuf.
import { Particles, Bits, Lights, P, B, Rng, fit, clamp, smooth, ease, TAU, WHITE, hex } from "../../core/index.js";

export const meta = {
  name: "Flesh sac burst",
  desc: "A veined flesh sac swells in pulses, veins lighting up, shivers, then bursts: a white frame, falling membrane shreds, a spray of acid sap, a steaming puddle.",
  tags: ["heirline", "eden", "flesh", "sac", "burst", "gore", "acid", "one-shot"],
  size: [112, 88],
  origin: [56, 72],
  duration: 2.1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#14040a", "#3a0a1c", "#6e1430", "#a82a48", "#d85a6a", "#f2a0a0", "#ffe0d8"],
    sap: ["#25400f", "#6fa81e", "#d8ff6a"],
    seed: 5,
  },
};

const POP = 0.3, RX = 13, RY = 15, CY = -16;

export function create(o) {
  const C = fit(o.palette, 7), S = fit(o.sap, 3), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, S[2], S[1], S[0]], haze: S[0] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  // des veines : quelques chemins tortueux depuis le bas de la poche
  const veines = [];
  for (let i = 0; i < 6; i++) {
    let a = -Math.PI / 2 + R.range(-1.1, 1.1), x = R.range(-4, 4), y = RY - 2;
    const pts = [];
    for (let j = 0; j < 9; j++) { pts.push([x, y]); a += R.range(-0.5, 0.5); x += Math.cos(a) * 2.2; y += Math.sin(a) * 2.2 }
    veines.push(pts);
  }
  let t = 0, eclate = false, flaque = 0;
  // la poche gonfle en trois battements, chaque fois plus fort
  const gonfle = (t) => 1 + 0.1 * smooth(0, POP, t) + 0.06 * Math.max(0, Math.sin(t * 18)) * smooth(0.1, POP, t)
  return {
    update(dt) {
      t += dt;
      if (!eclate && t >= POP) {
        eclate = true;
        lights.add(0, CY, 46, C[5], 1, 0.35);
        lights.add(0, CY, 18, WHITE, 1, 0.1);
        for (let i = 0; i < 16; i++) {
          const a = R.range(0, TAU), sp = R.range(60, 150);
          bits.add({ kind: B.CHUNK, x: Math.cos(a) * RX * 0.6, y: CY + Math.sin(a) * RY * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 1, drag: 0.5, bounce: 0.15, life: R.range(0.7, 1.1), a: R.range(0, TAU), va: R.range(-15, 15), s: R.range(1.2, 2.6), c: R.pick([C[3], C[4], C[2], C[5]]) });
        }
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + R.range(-1.6, 1.6), sp = R.range(70, 190);
          ps.spawn(P.SPARK, R.range(-4, 4), CY + R.range(-4, 4), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.35, 0.7), R.pick([S[2], S[1], WHITE]), 1);
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.VAPOUR, R.range(-8, 8), CY + R.range(-6, 6), R.range(-12, 12), -R.range(8, 20), R.range(0.6, 1.0), S[0], R.range(2, 3.5));
      }
      if (eclate) {
        flaque = Math.min(1, flaque + dt * 3.5);
        if (t < POP + 0.9 && R.chance(0.3)) ps.spawn(P.VAPOUR, R.range(-14, 14), -1, R.range(-4, 4), -R.range(6, 14), R.range(0.5, 0.8), S[0], R.range(1.5, 2.5));
      }
      bits.update(dt); ps.update(dt); lights.update(dt);
    },
    drawBack(p) {
      // la flaque de sève : une ellipse qui s'étale puis sèche
      const kf = flaque * (1 - smooth(1.3, meta.duration - 0.15, t))
      if (flaque > 0 && kf > 0.02) {
        const k = kf, rx = 6 + 16 * ease.outCubic(flaque), ry = 2 + 3 * flaque;
        p.ellipse(0, 0, rx, ry, (x, y) => ((x / rx) ** 2 + (y / ry) ** 2 > 0.6 ? S[1] : S[0]), 0.85 * k);
        p.glow(0, 0, rx, S[1], 0.12 * k);
      } else if (!eclate) {
        p.ellipse(0, 0, RX * 0.9, 2.5, C[0], 0.5);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      if (!eclate) {
        const g = gonfle(t), rx = RX * g, ry = RY * g, vib = t > POP - 0.15 ? Math.round(Math.sin(t * 140)) : 0;
        const allume = smooth(0.1, POP, t);
        p.shade(-rx - 2 + vib, CY - ry - 2, rx + 2 + vib, CY + ry + 2, (x, y, out) => {
          const u = (x - vib) / rx, v = (y - CY) / ry, d = u * u + v * v;
          if (d > 1) return;
          // une chair luisante éclairée d'en haut à gauche, sombre en bas, un liseré foncé au bord
          const l = -u * 0.5 - v * 0.7 + (1 - d) * 0.6;
          out.c = d > 0.86 ? C[1] : l > 0.75 ? C[6] : l > 0.45 ? C[5] : l > 0.1 ? C[4] : l > -0.3 ? C[3] : C[2];
        });
        for (const pts of veines) {
          const q = pts.map(([x, y]) => [x * g + vib, CY + (y - 2) * g]);
          p.polyline(q, C[2], 0.8);
          if (allume > 0.2) for (const [x, y] of q) p.light(x, y, S[1], 0.25 * allume);
        }
        // le reflet humide
        p.px(-rx * 0.45 + vib, CY - ry * 0.5, WHITE); p.px(-rx * 0.45 + 1 + vib, CY - ry * 0.5, C[6]);
        p.glow(vib, CY, rx + 6, C[4], 0.12 + 0.25 * allume);
      } else if (t < POP + 0.06) {
        // l'image blanche de l'éclatement
        p.circle(0, CY, RX * 1.2, WHITE);
        p.glow(0, CY, RX * 3, C[5], 0.8);
      } else {
        // ce qui reste : la base déchirée de la poche, qui retombe
        const k = 1 - smooth(POP, POP + 0.8, t);
        if (k > 0) p.arc(0, -2, RX * 0.7, 3, Math.PI * 1.05, Math.PI * 1.95, C[2], k);
      }
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
