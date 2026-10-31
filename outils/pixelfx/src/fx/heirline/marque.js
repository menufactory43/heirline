// Heirline : « marqué ». Un réticule de visée se referme sur la cible, se verrouille d'un coup, puis respire ;
// quatre crochets aux coins, un losange au-dessus de la tête, une ligne de balayage qui passe sur le corps.
import { fit, smooth, ease, TAU } from "../../core/index.js";

export const meta = {
  name: "Marked",
  desc: "A targeting reticle closes in on the target and locks with a snap, then breathes: four corner brackets, a diamond over the head, a scan line sweeping the body.",
  tags: ["status", "mark", "target", "reticle", "debuff", "loop"],
  size: [60, 70],
  origin: [30, 60],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#1a0614", "#4a0f3a", "#8a1a6a", "#d0359a", "#ff6bd8", "#ffc0f0", "#ffffff"],
    seed: 1,
  },
};

const D = meta.duration;

// a loop: the reticle closes in during the first 30 %, snaps, then breathes; it reopens just before the seam
function close(t) {
  const u = t / D;
  if (u < 0.3) return 1 - ease.outCubic(u / 0.3);
  if (u > 0.92) return smooth(0.92, 1, u);
  return 0;
}

function brackets(p, a, k, C, glow) {
  const cx = 0, cy = a.y + a.h / 2;
  const hw = a.w / 2 + 4 + k * 6, hh = a.h / 2 + 3 + k * 5, L = 5;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * hw, y = cy + sy * hh;
    p.line(x, y, x - sx * L, y, C[5]);
    p.line(x, y, x, y - sy * L, C[5]);
    p.px(x, y, C[6]);
    p.px(x - sx, y - sy, C[2]);
    if (glow) p.light(x, y, C[4], 0.5 * glow);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), a = o.actor, k = close(t), u = t / D;
  const locked = k === 0, snap = locked && u < 0.38 ? 1 - (u - 0.3) / 0.08 : 0;
  const breathe = 0.5 + 0.5 * Math.sin(TAU * 2 * u);
  brackets(p, a, k + (locked ? breathe * 0.08 : 0), C, locked ? 0.4 + 0.6 * snap : 0);
  // the diamond over the head, bobbing; white on the snap
  const hy = a.y - 6 - (locked ? Math.round(breathe) : 3 * k);
  const dc = snap > 0.3 ? C[6] : C[4];
  p.px(0, hy - 2, dc); p.px(-1, hy - 1, dc); p.px(1, hy - 1, dc); p.px(-2, hy, dc); p.px(2, hy, dc);
  p.px(-1, hy + 1, dc); p.px(1, hy + 1, dc); p.px(0, hy + 2, dc); p.px(0, hy, C[3]);
  p.light(0, hy, C[4], 0.6 + 0.4 * snap);
  // a scan line sweeping down the body once locked
  if (locked) {
    const s = ((u - 0.3) / 0.62) * 1.4 % 1, y = a.y + s * a.h;
    p.line(-a.w / 2 - 1, y, a.w / 2 + 1, y, C[4], 0.55);
    p.glowLine(-a.w / 2, y, a.w / 2, y, 2, C[3], 0.25);
  }
  // the snap: a quick ring of light round the target
  if (snap > 0) p.glowRing(0, a.y + a.h / 2, a.w / 2 + 6 + (1 - snap) * 6, 2, C[4], 0.5 * snap);
}
