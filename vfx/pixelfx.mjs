// Les effets pixelfx d'Heirline (outils/pixelfx, MIT, patch-gg/pixelfx) : le moteur prioritaire pour tout effet ajouté
// ou refait. Chaque entrée prend un effet de la bibliothèque (ou un des nôtres dans src/fx/heirline), le recolore à une
// palette d'Heirline, le rend à 12 images/s, coupe les longues traînes (fondu sur 0,3 s), rogne la planche au plus juste
// et la pose dans client/public/vfx comme les recettes (même manifeste). Rendu au build (npm run vfx), jamais en direct.
//
// Échelle : pixelfx dessine pour un personnage de 24 × 38 px, nos soldats font 16 × 20. En « pixels fins »
// (DENSITE = 2), la planche garde sa résolution et le jeu l'affiche à ×0,5 : la taille colle à nos soldats et les
// zooms pairs restent nets. DENSITE = 1 : mêmes pixels que nos sprites, effets presque deux fois plus gros.
import { createFrame, clearFrame, createFx, composite } from '../outils/pixelfx/src/core/index.js'

export const DENSITE = 2
export const FPS = 12

const P = {
  solaire: ['#2a1204', '#7a2e05', '#d65d0a', '#ff9f1c', '#ffe066', '#fff6c0', '#ffffff'],
  eden: ['#1a0820', '#3d1240', '#6e1f6a', '#a8358f', '#d85bb0', '#f2a0d4', '#ffe0f2'],
  acide: ['#0f1a08', '#25400f', '#3f6e14', '#6fa81e', '#a8e030', '#d8ff6a', '#f6ffd0'],
  rouille: ['#1a0e08', '#40200f', '#6e3a14', '#a85a1e', '#e08a30', '#ffc36a', '#fff0d0'],
  seve: ['#08160c', '#0f3418', '#1a5e26', '#2e9a3a', '#6ad66a', '#c0f7b0', '#ffffff'],
  cyan: ['#08141f', '#0f2a40', '#145a7a', '#1e90b0', '#4fd0e8', '#a8f4ff', '#f0ffff'],
  spore: ['#1a1404', '#40300a', '#7a5a10', '#c09018', '#ffd040', '#fff09a', '#ffffff'],
  rose: ['#1a0614', '#4a0f3a', '#8a1a6a', '#d0359a', '#ff6bd8', '#ffc0f0', '#ffffff'],
  chair: ['#14040a', '#3a0a1c', '#6e1430', '#a82a48', '#d85a6a', '#f2a0a0', '#ffe0d8'],
  gris: ['#14161a', '#2a2e36', '#4a505c', '#7a8290', '#b0b8c4', '#dde3ea', '#ffffff'],
  vert: ['#08140a', '#14301a', '#1e5a2a', '#2e9a46', '#5ad67a', '#b0f7c0', '#ffffff'],
  bleu: ['#060c1c', '#0f1e40', '#1a3a7a', '#2e64c0', '#5a9aff', '#b0d0ff', '#ffffff'],
  violet: ['#10061c', '#2a0f40', '#4a1a7a', '#7a30c0', '#b06aff', '#dcb8ff', '#ffffff'],
  givre: ['#06101a', '#0f2638', '#1e4a6a', '#3a80a8', '#7ac0e0', '#c8ecff', '#ffffff'],
  orange: ['#1a0a04', '#4a1a06', '#8a3a0a', '#d06a14', '#ffa640', '#ffd8a0', '#ffffff'],
  legende: ['#1a1004', '#4a3006', '#8a5a0a', '#d09a14', '#ffd040', '#fff0a0', '#ffffff'],
  encre: ['#06040c', '#120c26', '#221a48', '#3a2e70', '#5a4ea0', '#9a90d0', '#e0dcff'],
  verre: ['#0a1612', '#16302a', '#2a5a4e', '#4a9080', '#8ad0c0', '#d0fff4', '#ffffff'],
  papier: ['#1a1610', '#3a3226', '#6a5e4a', '#a89878', '#d8ccb0', '#f4ecd8', '#ffffff'],
}

/**
 * nom : le nom dans le manifeste (un nom déjà pris par une recette la remplace) ; fx : l'effet ; pal : la palette ;
 * coupe : durée gardée (s) pour un effet unique, puis fondu ; opts : options de l'effet ; impact : image d'impact ;
 * debut : secondes d'élan sautées (l'effet démarre à l'impact) ; pivot : le point d'ancrage, s'il n'est pas l'origine ;
 * taille : un facteur en plus de la densité, pour les tirs et les impacts que pixelfx dessine larges (traînée, gerbes).
 */
export const EFFETS = [
  // --- le lot « mieux » de l'avant/après (~/essais-pixelfx, 31/10)
  { nom: 'impact-fan-1', fx: 'impacts/hit-spark', pal: P.solaire, coupe: 0.5, impact: 1, taille: 0.6 },
  { nom: 'tir-ing-4', fx: 'projectiles/plasma-shot', pal: P.cyan, taille: 0.6 },
  { nom: 'grenade', fx: 'explosions/grenade', pal: P.rouille, debut: 1.58, coupe: 0.9, impact: 1, pivot: [0.5, 0.78] },
  { nom: 'etat-etourdi', fx: 'status/stunned', pal: P.spore },
  { nom: 'etat-ralenti', fx: 'status/slowed', pal: P.cyan },
  { nom: 'etat-marque', fx: 'heirline/marque', pal: P.rose },
  { nom: 'impact-acide', fx: 'nature/acid-splash', pal: P.acide, coupe: 0.7, impact: 1, taille: 0.7 },
  { nom: 'butin-0', fx: 'pickups/loot-beam', pal: P.gris, coupe: 0.8 },
  { nom: 'butin-1', fx: 'pickups/loot-beam', pal: P.vert, coupe: 0.8 },
  { nom: 'butin-2', fx: 'pickups/loot-beam', pal: P.bleu, coupe: 0.8 },
  { nom: 'butin-3', fx: 'pickups/loot-beam', pal: P.violet, coupe: 0.8 },
  { nom: 'butin-4', fx: 'pickups/loot-beam', pal: P.legende, coupe: 1.0 },
  { nom: 'butin-5', fx: 'pickups/loot-beam', pal: P.orange, coupe: 1.0 },
  { nom: 'rail', fx: 'impacts/ricochet', pal: P.spore, coupe: 0.4, taille: 0.5 },
  { nom: 'desherbage', fx: 'fire/fire-ring', pal: P.rouille, coupe: 0.9, impact: 1 },
  { nom: 'transition', fx: 'transitions/iris', pal: P.eden, fps: 8 },
  // --- les tirs hauts des trois nouvelles classes, leurs impacts, leurs compétences
  { nom: 'tir-ecl-3', fx: 'projectiles/laser-bolt', pal: P.givre, taille: 0.65 },
  { nom: 'tir-ecl-4', fx: 'projectiles/laser-bolt', pal: P.cyan, taille: 0.75 },
  { nom: 'impact-ecl-4', fx: 'ice/ice-shatter', pal: P.givre, coupe: 0.6, impact: 1, taille: 0.6 },
  // (la roquette de pixelfx traîne 230 px de fumée : les tirs du Démolisseur gardent leurs recettes)
  { nom: 'tir-bro-3', fx: 'projectiles/energy-disc', pal: P.violet, taille: 0.55 },
  { nom: 'tir-bro-4', fx: 'projectiles/energy-disc', pal: P.rose, taille: 0.65 },
  { nom: 'impact-bro-4', fx: 'lightning/zap-hit', pal: P.violet, coupe: 0.5, impact: 1, taille: 0.6 },
  { nom: 'mortier', fx: 'explosions/dirt-explosion', pal: P.rouille, coupe: 0.6, impact: 1 },
  { nom: 'leurre-fin', fx: 'scifi/warp-out', pal: P.violet, coupe: 0.8 },
  { nom: 'champ', fx: 'scifi/emp-blast', pal: P.violet, coupe: 0.9, impact: 1 },
  // --- l'équipement : légendaires et ensembles
  { nom: 'eqp-devore', fx: 'shadow/life-steal', pal: P.violet, coupe: 0.9 },
  { nom: 'eqp-spore-soin', fx: 'nature/healing-bloom', pal: P.seve, coupe: 1.0 },
  { nom: 'eqp-recycle', fx: 'pickups/collect-burst', pal: P.rouille, coupe: 0.7 },
  { nom: 'eqp-ricochet', fx: 'impacts/ricochet', pal: P.orange, coupe: 0.4, taille: 0.6 },
  // --- sur le personnage : brûlé, soin reçu
  { nom: 'etat-feu', fx: 'status/burning', pal: P.rouille },
  { nom: 'soin-perso', fx: 'holy/heal', pal: P.seve, coupe: 1.0 },
  // --- ÉDEN : le sac de chair, la biomasse, les greffes et les boutures du Semeur, le pommier
  { nom: 'sac-creve', fx: 'heirline/sac-chair', pal: P.chair, impact: 2 },
  { nom: 'biomasse', fx: 'heirline/biomasse', pal: P.eden },
  { nom: 'greffe', fx: 'shadow/hex-sigil', pal: P.violet, fps: 8 },
  { nom: 'bouture', fx: 'nature/root-snare', pal: P.seve },
  { nom: 'pommier', fx: 'heirline/pommier', pal: P.seve },
  // --- les Hauts de Glane : la Serre (essaim, épines, vitres), le Registre (rature, pages, encre), le Métier (glane,
  // pince, appel, fils)
  { nom: 'essaim-pep', fx: 'nature/spore-burst', pal: P.vert, debut: 1.4, coupe: 1.0, impact: 1 },
  { nom: 'epines', fx: 'nature/thorns', pal: P.seve, coupe: 1.0, impact: 1, taille: 0.7 },
  { nom: 'colonne-vitres', fx: 'ice/icicle-fall', pal: P.verre, debut: 0.5, coupe: 1.0, impact: 1, pivot: [0.5, 0.9] },
  { nom: 'colonne-pages', fx: 'nature/leaf-storm', pal: P.papier, coupe: 1.0 },
  { nom: 'rature', fx: 'water/splash', pal: P.encre, coupe: 0.9, impact: 1, taille: 0.6 },
  { nom: 'encre-anneau', fx: 'fire/fire-ring', pal: P.encre, coupe: 0.9, impact: 1 },
  { nom: 'glane', fx: 'lightning/zap-hit', pal: P.violet, coupe: 0.8, impact: 1, taille: 0.7 },
  { nom: 'pince', fx: 'melee/heavy-cleave', pal: P.rouille, debut: 0.5, coupe: 0.8, impact: 1, taille: 0.7 },
  { nom: 'appel', fx: 'lightning/charge-up', pal: P.legende, debut: 1.4, coupe: 1.1, impact: 1 },
  { nom: 'colonne-fils', fx: 'lightning/lightning-strike', pal: P.rouille, debut: 1.0, coupe: 1.0, impact: 1, pivot: [0.5, 0.9] },
]

/** Le bord d'un halo coupé par la toile se voit comme une boîte : on l'adoucit (repris de pixelfx tools/lib). */
function adoucirBords(f, E = 8) {
  const { w, h, light: L } = f
  for (let y = 0; y < h; y++) {
    const ey = Math.min(y, h - 1 - y)
    for (let x = 0; x < w; x++) {
      const e = Math.min(ey, x, w - 1 - x)
      if (e >= E) { x = w - 1 - E; continue }
      const i = y * w + x, l = L[i]
      if (!(l & 0xffffff)) continue
      const u = (e + 0.5) / E, k = u * u * (3 - 2 * u)
      L[i] = (l & 0xff000000) | Math.round((l & 255) * k) | (Math.round(((l >>> 8) & 255) * k) << 8) | (Math.round(((l >>> 16) & 255) * k) << 16)
    }
  }
}

/** Rend un effet : { w, h, frames: RGBA[], fps, loop, impact, pivot, echelle }. */
export async function rendre(e, dossierFx) {
  const mod = await import(`${dossierFx}/${e.fx}.js`)
  const meta = mod.meta, [W, H] = meta.size, [OX, OY] = meta.origin
  const fps = e.fps ?? FPS
  const ecran = W >= 320 && Math.abs(W / H - 16 / 9) < 0.05
  const inst = createFx(mod, { x: OX, y: OY, seed: e.seed ?? 7, palette: e.pal, ...(e.opts ?? {}) })
  // debut : on saute l'élan (une grenade lancée, une poche qui gonfle) pour que l'effet parte à l'instant de l'événement
  const debut = e.debut ?? 0
  for (let tt = 0; tt < debut - 1e-6; tt += 1 / 120) inst.update(Math.min(1 / 120, debut - tt))
  const coupe = !meta.loop && e.coupe && debut + e.coupe < meta.duration ? debut + e.coupe : null
  const duree = meta.loop ? meta.duration : (coupe ? coupe + 0.3 : meta.duration) - debut
  const n = Math.max(1, Math.round(duree * fps) + (meta.loop ? 0 : 1))
  const f = createFrame(W, H)
  const brut = []
  for (let i = 0; i < n; i++) {
    if (i > 0) inst.update(1 / fps)
    if (coupe && inst.t >= coupe) inst.stop()
    clearFrame(f)
    inst.draw(f)
    if (!ecran) adoucirBords(f)
    brut.push(composite(f, new Uint8ClampedArray(W * H * 4), null))
  }
  // un effet unique finit vide : la dernière image transparente ne sert à rien
  if (!meta.loop && brut.length > 1) brut.pop()
  // rogner au plus juste (union de toutes les images), un pixel de marge
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  if (ecran) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1 } else {
    for (const img of brut) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img[(y * W + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0 }
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1)
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const frames = brut.map((img) => {
    const o = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) o.set(img.subarray(((y + y0) * W + x0) * 4, ((y + y0) * W + x0 + w) * 4), y * w * 4)
    return o
  })
  return {
    w, h, frames, fps, loop: !!meta.loop, impact: e.impact ?? 0,
    pivot: e.pivot ?? [Math.round(((OX - x0) / w) * 1000) / 1000, Math.round(((OY - y0) / h) * 1000) / 1000],
    echelle: ecran ? 1 : (e.taille ?? 1) / DENSITE, ecran,
  }
}
