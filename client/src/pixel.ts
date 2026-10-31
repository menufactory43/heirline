// Tout le pixel art d'Heirline, dessiné par le code : des grilles de lettres et des palettes pour les personnages,
// des tuiles procédurales pour le terrain. Les textures sont créées une fois au démarrage.
import Phaser from 'phaser'
import { T, D, rng } from '../../shared/map.ts'
import { drawWorldTiles, makeWorldTextures } from './pixel2.ts'

export const PAL = {
  k: '#11161d',
  // la Colonie : acier froid et lampes chaudes
  acier0: '#1b2430', acier1: '#2d3a4a', acier2: '#4a5d72', acier3: '#7890a6', acier4: '#b8c9d8',
  lampe: '#ffd36b', lampe2: '#fff3c4', cyan: '#7fd6ff', cyan2: '#d4f4ff',
  // ÉDEN : chair, veines, lueurs
  chair0: '#1d0a24', chair1: '#3b1144', chair2: '#5e1d63', chair3: '#8b2f80', chair4: '#c45bb0', lueur: '#ff8ae0',
  acide: '#b6ff5a', acide2: '#6fcf3a',
  // le terrain
  sol0: '#2f2a24', sol1: '#3d362e', sol2: '#4a4238', sol3: '#5a5044', sol4: '#6f6352', herbe: '#6e6a3a', herbe2: '#8b864a',
  dalle0: '#262c33', dalle1: '#323a43', dalle2: '#3e4752', dalle3: '#55606c',
  route0: '#2a2d31', route1: '#34383d', jaune: '#c9a227',
  rouille0: '#3a2418', rouille1: '#5c3520', rouille2: '#8a5230',
}

// Classes : armure principale, armure claire, armure sombre, visière
const CLASS_COLORS = [
  { a: '#5d6b3c', A: '#8a9a58', d: '#3c4527', v: '#ffd36b', c: '#c9a227' },   // Fantassin
  { a: '#c9ccc4', A: '#eef0ea', d: '#8e928a', v: '#7fd6ff', c: '#d9463e' },   // Médic
  { a: '#b56e22', A: '#e39a3e', d: '#7a4614', v: '#ffd36b', c: '#2d3a4a' },   // Ingénieur
  { a: '#4f6f78', A: '#7fa0a8', d: '#2f454c', v: '#d8f4ff', c: '#a8c0c8' },   // Éclaireur : gris-bleu de veille
  { a: '#7a3a2a', A: '#a8583e', d: '#4a2218', v: '#ffb347', c: '#2a2a2a' },   // Démolisseur : brique et suie
  { a: '#4a3a7a', A: '#7060a8', d: '#2a204a', v: '#e0a8ff', c: '#d8d0ff' },   // Brouilleur : violet d'onde
]

function draw(scene: Phaser.Scene, key: string, rows: string[], pal: Record<string, string>, scale = 1) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length
  const tex = scene.textures.createCanvas(key, w * scale, h * scale)!
  const ctx = tex.getContext()
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x]
    if (ch === '.' || ch === ' ') continue
    const col = pal[ch]
    if (!col) continue
    ctx.fillStyle = col
    ctx.fillRect(x * scale, y * scale, scale, scale)
  }
  tex.refresh()
  return tex
}

/** Plusieurs images côte à côte dans une texture, découpées en frames. */
function sheet(scene: Phaser.Scene, key: string, frames: string[][], pal: Record<string, string>) {
  const w = Math.max(...frames.flat().map((r) => r.length)), h = Math.max(...frames.map((f) => f.length))
  const tex = scene.textures.createCanvas(key, w * frames.length, h)!
  const ctx = tex.getContext()
  frames.forEach((rows, i) => {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const col = pal[rows[y][x]]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(i * w + x, y, 1, 1)
    }
    tex.add(i, 0, i * w, 0, w, h)
  })
  tex.refresh()
  return { w, h }
}

// ----------------------------------------------------------------- le soldat (16 × 16, vu de trois quarts)
const SOLDAT_HAUT = [
  '................',
  '.....kkkkkk.....',
  '....kHHhhhhk....',
  '...kHhhhhhhdk...',
  '...khhhhhhhhk...',
  '...kdvvvvvvdk...',
  '...kdvVvvvvdk...',
  '....kddddddk....',
  '...kpaAAAaapk...',
  '..kgpaAccAapgk..',
  '..kGkaacca.kGk..',
  '..kGkaaaaaakgk..',
  '...kkddddddkk...',
]
const JAMBES = [
  ['....kgggkgggk...', '....kgg.kggk....', '....kbbk.kbbk...', '....kkk..kkk....'],
  ['....kgggkgggk...', '...kggk..kggk...', '...kbbk...kbbk..', '...kkk....kkk...'],
  ['....kgggkgggk...', '....kggkkggk....', '....kbbkkbbk....', '....kkkkkkk.....'],
  ['....kgggkgggk...', '.....kggk.kggk..', '....kbbk..kbbk..', '....kkk...kkk...'],
]
function soldier(scene: Phaser.Scene, ci: number) {
  const c = CLASS_COLORS[ci]
  const pal: Record<string, string> = {
    k: PAL.k, h: c.a, H: c.A, d: c.d, a: c.a, A: c.A, v: c.v, V: '#ffffff', c: c.c,
    g: PAL.acier1, G: PAL.acier2, b: '#1a1d22', p: PAL.acier0,
  }
  const frames = JAMBES.map((j) => [...SOLDAT_HAUT, ...j].map((r) => r.padEnd(16, '.')))
  sheet(scene, `soldat${ci}`, frames, pal)
}

// les armes, pointées vers la droite ; l'origine est la poignée
const ARMES: Record<string, string[]> = {
  arme0: [ // fusil d'assaut
    '..............',
    '.kkkkkkkkkkk..',
    'kGGGGGGGGGGGkk',
    'kgggkkgggggk..',
    '.kk..kgk......',
    '.....kk.......',
  ],
  arme1: [ // pistolet
    '.........',
    '.kkkkkkk.',
    'kGGGGGGGk',
    'kgggkkkk.',
    '.kgk.....',
    '.kk......',
  ],
  arme2: [ // fusil à pompe
    '.............',
    'kkkkkkkkkkkk.',
    'kGGGGGGGGGGGk',
    'kgggoooogggk.',
    '.kgk.kkkk....',
    '.kk..........',
  ],
  arme3: [ // fusil de précision : long canon, lunette
    '....kkkk.........',
    '...kGGGGk........',
    '.kkkkkkkkkkkkkkkk',
    'kGGGGGGGGGGGGGGGk',
    'kgggkkggk.kkkkkk.',
    '.kk..kgk.........',
    '.....kk..........',
  ],
  arme4: [ // lance-grenades : gros tube, barillet
    '..............',
    '..kkkkkkkkkkk.',
    '.kGGGGGGGGGGGk',
    'kkoooGGGGGGGGk',
    'kgoookgggggkk.',
    '.kkk.kgk......',
    '.....kk.......',
  ],
  arme5: [ // lance-arcs : bobines lumineuses
    '.............',
    '.kkk.kkk.kkk.',
    'kGvGkGvGkGvGk',
    'kgggggggggggk',
    '.kgk.kkkkkkk.',
    '.kk..........',
  ],
}

// ----------------------------------------------------------------- le robot (14 × 14, il flotte)
const ROBOT = [
  [
    '..............',
    '.....kkkk.....',
    '...kkGGGGkk...',
    '..kGGBBBBGGk..',
    '.kGBBccccBBGk.',
    '.kGBc7777cBGk.',
    'kkGBc7WW7cBGkk',
    'kgGBc7777cBGgk',
    '.kGBBccccBBGk.',
    '..kgGBBBBGgk..',
    '...kkggggkk...',
    '....k.kk.k....',
    '....o.oo.o....',
    '.....O..O.....',
  ],
  [
    '..............',
    '.....kkkk.....',
    '...kkGGGGkk...',
    '..kGGBBBBGGk..',
    '.kGBBccccBBGk.',
    '.kGBc7777cBGk.',
    'kkGBc77777BGkk',
    'kgGBc7777cBGgk',
    '.kGBBccccBBGk.',
    '..kgGBBBBGgk..',
    '...kkggggkk...',
    '....k.kk.k....',
    '.....o..o.....',
    '..............',
  ],
]
const AVANT_POSTE = [
  '......kk......',
  '......77......',
  '......kk......',
  '......kk......',
  '......kk......',
  '.....kGGk.....',
  '.....kkkk.....',
  '...kkGGGGkk...',
  '..kGGBBBBGGk..',
  '.kGBBccccBBGk.',
  'kkGBc7777cBGkk',
  'kgGBc7777cBGgk',
  'kgGBBccccBBGgk',
  'kkgGBBBBBBGgkk',
  'kkkkgggggggkkk',
  'kGGGGGGGGGGGGk',
  'kkkkkkkkkkkkkk',
]
const TOURELLE = [
  '..........',
  '...kkkk...',
  '..kGGGGk..',
  '.kGc77cGk.',
  '.kGc77cGkk',
  '.kgGGGGgkk',
  'kkkgggkkk.',
  'kGGkkkGGk.',
  'kk.....kk.',
]

// ----------------------------------------------------------------- ÉDEN
const RAMPANT = [
  [
    '................',
    '......kkkk......',
    '....kk3333kk....',
    '...k32244223k...',
    '..k3224LL4223k..',
    '.k32244444422 3k',
    '.k3222222222223k',
    'k.k3k2kk2kk3k.k.',
    '.k..k.k..k.k..k.',
    '..k..........k..',
  ],
  [
    '................',
    '......kkkk......',
    '....kk3333kk....',
    '...k32244223k...',
    '..k3224LL4223k..',
    '.k3224444442 23k',
    '.k3222222222223k',
    '..k3k2kk2kk3k...',
    '.k.k..k..k..k.k.',
    'k..............k',
  ],
]
const CRACHEUR = [
  [
    '.....kkkkk......',
    '...kk44444kk....',
    '..k4LaaaaaL4k...',
    '..k4aAAAAAa4k...',
    '.k44aAAAAAa44k..',
    '.k34aaaaaaa43k..',
    '.k334444444331k.',
    '..k3kkkkkk33k1..',
    '..k32kmmk223k...',
    '...k3kmmk33k....',
    '..k33222223 3k..',
    '.k3k3k3k3k3k3k..',
    '.k.k.k.k.k.k.k..',
    '................',
  ],
  [
    '.....kkkkk......',
    '...kk44444kk....',
    '..k4LaaaaaL4k...',
    '..k4aAAAAAa4k...',
    '.k44aAAAAAa44k..',
    '.k34aaaaaaa43k..',
    '.k334444444331k.',
    '..k3kkkkkk33k1..',
    '..k32kkkkk23k...',
    '...k3kmmk33k....',
    '..k33222223 3k..',
    '..k3k3k3k3k3k...',
    '.k.k.k.k.k.k.k..',
    '................',
  ],
]
const CUIRASSE = [
  [
    '.......kkkkkk.......',
    '.....kkGGGGGGkk.....',
    '....kGG3333333Gk....',
    '...kG3322222233Gk...',
    '..kG332LL22LL233Gk..',
    '..kG3222222222223k..',
    '.kG322kkkkkkkk2233k.',
    '.kG32kG333333Gk223k.',
    '.k332kG322223Gk2233k',
    '.k322k3222222k3k223k',
    '.k322k3222222k3k223k',
    '.k332kG322223Gk2233k',
    '.kG32kG333333Gk223k.',
    '..kG3kkkkkkkkk333k..',
    '..k.kk3k3kk3k3kk.k..',
    '.k..k.k..kk..k.k..k.',
    'k..k..k......k..k..k',
    '....................',
  ],
  [
    '.......kkkkkk.......',
    '.....kkGGGGGGkk.....',
    '....kGG3333333Gk....',
    '...kG3322222233Gk...',
    '..kG332LL22LL233Gk..',
    '..kG3222222222223k..',
    '.kG322kkkkkkkk2233k.',
    '.kG32kG333333Gk223k.',
    '.k332kG322223Gk2233k',
    '.k322k3222222k3k223k',
    '.k322k3222222k3k223k',
    '.k332kG322223Gk2233k',
    '.kG32kG333333Gk223k.',
    '..kG3kkkkkkkkk333k..',
    '...kk3k3kk3k3kk.....',
    '..k.k.k..kk..k.k.k..',
    '.k..k..k....k..k..k.',
    '....................',
  ],
]
const OEUF = [
  [
    '...kkkk...',
    '..k4444k..',
    '.k4LaaL4k.',
    '.k4aAAa4k.',
    'k34aAAa43k',
    'k34aaaa43k',
    'k334aa433k',
    'k33344333k',
    '.k333333k.',
    '.k232232k.',
    '..kk22kk..',
    '....kk....',
  ],
  [
    '...kkkk...',
    '..k4444k..',
    '.k4LaaL4k.',
    '.k4aaaa4k.',
    'k34aAAa43k',
    'k34aAAa43k',
    'k334aa433k',
    'k33344333k',
    '.k333333k.',
    '.k232232k.',
    '..kk22kk..',
    '....kk....',
  ],
]
const PAL_EDEN: Record<string, string> = {
  k: PAL.chair0, '1': PAL.chair1, '2': PAL.chair2, '3': PAL.chair3, '4': PAL.chair4, L: PAL.lueur,
  a: PAL.acide2, A: PAL.acide, m: '#2a0a10', G: '#4b3a55',
}

// La Couveuse : dessinée par formes (48 × 44), deux images de pulsation.
function couveuse(scene: Phaser.Scene) {
  const W = 48, H = 44
  const tex = scene.textures.createCanvas('couveuse', W * 2, H)!
  const ctx = tex.getContext()
  for (let f = 0; f < 2; f++) {
    const ox = f * W
    const R = rng(91)
    const blob = (cx: number, cy: number, rx: number, ry: number, col: string) => {
      ctx.fillStyle = col
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) ctx.fillRect(ox + cx + x, cy + y, 1, 1)
    }
    const p = f ? 1 : 0
    // pattes / racines
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, l = 20 + (i % 2) * 2 + p
      for (let s = 0; s < l; s++) {
        const x = 24 + Math.cos(a) * s, y = 24 + Math.sin(a) * s * 0.8
        ctx.fillStyle = s > l - 3 ? PAL.chair0 : s % 3 ? PAL.chair1 : PAL.chair2
        ctx.fillRect(ox + Math.round(x), Math.round(y), 2, 2)
      }
    }
    blob(24, 24, 17 + p, 14 + p, PAL.chair0)
    blob(24, 23, 16 + p, 13 + p, PAL.chair2)
    blob(24, 21, 13 + p, 9 + p, PAL.chair3)
    blob(22, 18, 7, 4, PAL.chair4)
    // poches à œufs
    for (const [x, y] of [[13, 28], [35, 28], [24, 33], [16, 19], [33, 18]]) { blob(x, y, 3, 3, PAL.chair1); blob(x, y - 1, 2, 2, PAL.acide2); ctx.fillStyle = PAL.acide; ctx.fillRect(ox + x - 1, y - 2, 1, 1) }
    // le cœur, l'œil
    blob(24, 24, 6, 5, PAL.chair0)
    blob(24, 24, 5, 4, p ? PAL.lueur : PAL.chair4)
    blob(24, 24, 2, 3, '#ffffff')
    ctx.fillStyle = PAL.chair0; ctx.fillRect(ox + 24, 22, 1, 5)
    // veines
    for (let i = 0; i < 40; i++) { const x = 10 + Math.floor(R() * 28), y = 12 + Math.floor(R() * 22); ctx.fillStyle = R() < 0.5 ? PAL.chair1 : PAL.chair4; ctx.fillRect(ox + x, y, 1, 1) }
    tex.add(f, 0, ox, 0, W, H)
  }
  tex.refresh()
}

// Un sac de ponte de la Couveuse (26 × 30) : une poche translucide pleine d'œufs, pendue à une tige de chair.
function sac(scene: Phaser.Scene) {
  const W = 26, H = 30
  const tex = scene.textures.createCanvas('sac', W * 2, H)!
  const ctx = tex.getContext()
  for (let f = 0; f < 2; f++) {
    const ox = f * W, p = f
    const blob = (cx: number, cy: number, rx: number, ry: number, col: string) => {
      ctx.fillStyle = col
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) ctx.fillRect(ox + cx + x, cy + y, 1, 1)
    }
    // la tige qui le relie au corps
    for (let y = 0; y < 8; y++) { ctx.fillStyle = y % 3 ? PAL.chair1 : PAL.chair2; ctx.fillRect(ox + 12 + Math.round(Math.sin(y / 2) * 1), y, 2, 1) }
    blob(13, 18, 11 + p, 11, PAL.chair0)
    blob(13, 18, 10 + p, 10, PAL.chair2)
    blob(13, 17, 8 + p, 8, PAL.acide2)
    // les œufs qu'on voit à travers
    for (const [x, y] of [[9, 15], [16, 14], [12, 21], [17, 20], [8, 21]]) { blob(x, y, 2, 2, PAL.chair1); ctx.fillStyle = p ? PAL.acide : PAL.lueur; ctx.fillRect(ox + x, y - 1, 1, 1) }
    // reflets
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ox + 7, 11, 2, 1); ctx.fillRect(ox + 6, 12, 1, 2)
    // veines
    ctx.fillStyle = PAL.chair1
    for (let k = 0; k < 6; k++) ctx.fillRect(ox + 4 + k * 3, 24 + (k % 2), 1, 3)
    tex.add(f, 0, ox, 0, W, H)
  }
  tex.refresh()
}

// ----------------------------------------------------------------- les tuiles (16 × 16, procédurales)
export const TILESET = {
  SOL: 0, SOL_N: 4, ROC_HAUT: 8, ROC_FACE: 10, METAL_HAUT: 12, METAL_FACE: 14, CAISSE: 16, EPAVE: 18,
  DALLE: 20, ROUTE: 22, ROUTE_LIGNE: 23, CHAIR_HAUT: 24, CHAIR_FACE: 26, NIDSOL: 28, OMBRE: 30,
  BIO: 32, BIO_BORD: 36,
  // le monde ouvert
  HERBE: 48, MOUSSE: 52, BOUE: 56, EAU: 60, FERRAILLE: 64, PAVE: 68, PLANCHER: 70, MURP_HAUT: 72, MURP_FACE: 74,
  MURB_HAUT: 76, MURB_FACE: 78, MURB_FENETRE: 80, PORTE: 81, CHAMP: 82, CLOTURE_H: 84, CLOTURE_V: 85,
  PALISSADE_HAUT: 86, PALISSADE_FACE: 87, RACINE_HAUT: 88, RACINE_FACE: 89, CHAIRSOL: 90, MARE: 94, BERGE: 96,
  DECO: 100, // DECO + index de D
  FONTAINE: 136, TABLEAU: 140, EAU_BORD: 142,
  // le continent : falaises, mer, sable, ponts, gués, sas, porte scellée
  FALAISE_HAUT: 144, FALAISE_FACE: 146, MER: 148, SABLE: 152, PONT_H: 156, PONT_V: 157, GUE: 158, SAS: 160, SCELLE: 161, MER_BORD: 162,
  COUNT: 164,
}

function tiles(scene: Phaser.Scene) {
  const N = TILESET.COUNT
  const tex = scene.textures.createCanvas('tuiles', N * 16, 16)!
  const ctx = tex.getContext()
  const px = (i: number, x: number, y: number, c: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(i * 16 + x, y, 1, 1); ctx.globalAlpha = 1 }
  const fill = (i: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(i * 16, 0, 16, 16) }
  const noise = (i: number, seed: number, cols: string[], dens: number) => { const R = rng(seed); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (R() < dens) px(i, x, y, cols[Math.floor(R() * cols.length)]) }

  // sol : poussière et cailloux, 4 variantes
  for (let v = 0; v < 4; v++) {
    const i = TILESET.SOL + v
    fill(i, PAL.sol2); noise(i, 10 + v, [PAL.sol1, PAL.sol3, PAL.sol3, PAL.sol1], 0.35)
    const R = rng(30 + v)
    for (let k = 0; k < 2 + v; k++) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(i, x, y, PAL.sol4); px(i, x + 1, y, PAL.sol3); px(i, x, y + 1, PAL.sol0) }
  }
  // sol sous un mur : ombre portée
  for (let v = 0; v < 4; v++) { const i = TILESET.SOL_N + v; fill(i, PAL.sol2); noise(i, 50 + v, [PAL.sol1, PAL.sol3], 0.3); ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.fillRect(i * 16, 0, 16, 5); ctx.globalAlpha = 0.2; ctx.fillRect(i * 16, 5, 16, 3); ctx.globalAlpha = 1 }
  // roche : dessus clair, face sombre striée
  for (let v = 0; v < 2; v++) {
    let i = TILESET.ROC_HAUT + v
    fill(i, PAL.sol3); noise(i, 60 + v, [PAL.sol4, PAL.sol2, '#7a6c58'], 0.45)
    for (let x = 0; x < 16; x++) if ((x + v) % 5 === 0) px(i, x, (x * 7) % 16, PAL.sol1)
    i = TILESET.ROC_FACE + v
    fill(i, PAL.sol1); noise(i, 70 + v, [PAL.sol0, PAL.sol2], 0.4)
    for (let x = 0; x < 16; x++) { px(i, x, 0, PAL.sol4); px(i, x, 1, PAL.sol3) }
    for (let x = 1; x < 16; x += 4 + v) for (let y = 3; y < 15; y++) if ((y + x) % 3) px(i, x, y, PAL.sol0)
    for (let x = 0; x < 16; x++) px(i, x, 15, PAL.k)
  }
  // métal : plaques et rivets
  for (let v = 0; v < 2; v++) {
    let i = TILESET.METAL_HAUT + v
    fill(i, PAL.acier2)
    for (let x = 0; x < 16; x++) { px(i, x, 0, PAL.acier3); px(i, x, 15, PAL.acier1) }
    for (let y = 0; y < 16; y++) { px(i, 0, y, PAL.acier3); px(i, 15, y, PAL.acier1) }
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(i, x, y, PAL.acier4)
    if (v) for (let k = 3; k < 13; k++) px(i, k, k, PAL.acier1)
    i = TILESET.METAL_FACE + v
    fill(i, PAL.acier1)
    for (let x = 0; x < 16; x++) { px(i, x, 0, PAL.acier4); px(i, x, 1, PAL.acier3); px(i, x, 15, PAL.k) }
    for (let x = 0; x < 16; x++) for (let y = 4; y < 14; y += 3) px(i, x, y, PAL.acier0)
    if (v) for (let x = 0; x < 16; x++) { px(i, x, 10, x % 4 < 2 ? PAL.jaune : PAL.k); px(i, x, 11, x % 4 < 2 ? PAL.jaune : PAL.k) }
  }
  // caisse (abri)
  {
    const i = TILESET.CAISSE
    fill(i, PAL.k)
    ctx.fillStyle = '#5a4a32'; ctx.fillRect(i * 16 + 1, 1, 14, 13)
    ctx.fillStyle = '#7a6542'; ctx.fillRect(i * 16 + 1, 1, 14, 3)
    for (let k = 0; k < 10; k++) { px(i, 3 + k, 4 + k * 0.9 | 0, '#3e321f'); px(i, 12 - k, 4 + k * 0.9 | 0, '#3e321f') }
    for (let x = 1; x < 15; x++) { px(i, x, 4, '#3e321f'); px(i, x, 14, '#2a2115') }
    for (const [x, y] of [[2, 2], [13, 2]]) px(i, x, y, PAL.acier4)
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(i * 16, 15, 16, 1); ctx.globalAlpha = 1
  }
  // épave rouillée
  {
    const i = TILESET.EPAVE
    fill(i, PAL.rouille0); noise(i, 80, [PAL.rouille1, PAL.rouille2, '#2a1810'], 0.5)
    for (let x = 0; x < 16; x++) { px(i, x, 0, PAL.rouille2); px(i, x, 15, PAL.k) }
    for (let y = 2; y < 14; y += 4) for (let x = 2; x < 14; x++) px(i, x, y, '#24150c')
    px(i, 5, 6, PAL.acier3); px(i, 11, 9, PAL.acier3)
    const j = TILESET.EPAVE + 1
    fill(j, PAL.acier1); noise(j, 81, [PAL.rouille1, PAL.acier0, PAL.rouille2], 0.45)
    for (let x = 0; x < 16; x++) { px(j, x, 0, PAL.acier3); px(j, x, 15, PAL.k) }
  }
  // dalles de Port-Ancre
  for (let v = 0; v < 2; v++) {
    const i = TILESET.DALLE + v
    fill(i, PAL.dalle1); noise(i, 90 + v, [PAL.dalle0, PAL.dalle2], 0.18)
    for (let x = 0; x < 16; x++) { px(i, x, 0, PAL.dalle0); px(i, x, 8, PAL.dalle0) }
    for (let y = 0; y < 8; y++) px(i, v ? 4 : 11, y, PAL.dalle0)
    for (let y = 8; y < 16; y++) px(i, v ? 11 : 4, y, PAL.dalle0)
    px(i, 1, 1, PAL.dalle3); px(i, 9, 9, PAL.dalle3)
  }
  // route
  { const i = TILESET.ROUTE; fill(i, PAL.route1); noise(i, 100, [PAL.route0, '#3c4045'], 0.3) }
  { const i = TILESET.ROUTE_LIGNE; fill(i, PAL.route1); noise(i, 101, [PAL.route0, '#3c4045'], 0.3); for (let x = 2; x < 12; x++) { px(i, x, 7, PAL.jaune); px(i, x, 8, PAL.jaune) } }
  // chair (murs du nid)
  for (let v = 0; v < 2; v++) {
    let i = TILESET.CHAIR_HAUT + v
    fill(i, PAL.chair3); noise(i, 110 + v, [PAL.chair2, PAL.chair4, PAL.chair2], 0.5)
    for (let k = 0; k < 4; k++) px(i, 3 + k * 3, 4 + (k % 2) * 6, PAL.lueur)
    i = TILESET.CHAIR_FACE + v
    fill(i, PAL.chair1); noise(i, 120 + v, [PAL.chair0, PAL.chair2], 0.45)
    for (let x = 0; x < 16; x++) { px(i, x, 0, PAL.chair4); px(i, x, 1, PAL.chair3) }
    for (let x = 2; x < 16; x += 5) for (let y = 3; y < 15; y++) px(i, x + (y % 2), y, PAL.chair0)
  }
  // sol du nid
  { const i = TILESET.NIDSOL; fill(i, PAL.chair1); noise(i, 130, [PAL.chair0, PAL.chair2, PAL.chair2], 0.45); for (let k = 0; k < 6; k++) px(i, (k * 5) % 16, (k * 7) % 16, PAL.chair3) }
  { const i = TILESET.NIDSOL + 1; fill(i, PAL.chair1); noise(i, 131, [PAL.chair0, PAL.chair2], 0.4); for (let x = 0; x < 16; x++) px(i, x, (8 + Math.round(Math.sin(x / 2) * 2)), PAL.chair3) }
  // biomasse : voile de veines par-dessus le terrain d'ÉDEN (4 variantes), et sa lisière
  for (let v = 0; v < 4; v++) {
    const i = TILESET.BIO + v
    const R = rng(140 + v)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = R()
      if (r < 0.22) px(i, x, y, PAL.chair2, 0.55)
      else if (r < 0.3) px(i, x, y, PAL.chair1, 0.6)
    }
    // une veine qui traverse
    let y = Math.floor(R() * 16)
    for (let x = 0; x < 16; x++) { px(i, x, y, PAL.chair3, 0.9); if (R() < 0.35) y = Math.max(0, Math.min(15, y + (R() < 0.5 ? -1 : 1))) }
    if (v % 2) { const x = Math.floor(R() * 12) + 2, yy = Math.floor(R() * 12) + 2; px(i, x, yy, PAL.lueur); px(i, x + 1, yy, PAL.chair4) }
  }
  for (let v = 0; v < 4; v++) {
    const i = TILESET.BIO_BORD + v
    const R = rng(160 + v)
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = x / 16
      if (R() < k * 0.35) px(i, x, y, R() < 0.5 ? PAL.chair2 : PAL.chair3, 0.6)
    }
    for (let t = 0; t < 3; t++) { let x = 15, y = Math.floor(R() * 16); for (let s = 0; s < 8 + R() * 6; s++) { px(i, x, y, PAL.chair3, 0.85); x--; if (R() < 0.4) y = Math.max(0, Math.min(15, y + (R() < 0.5 ? -1 : 1))) } }
  }
  // ombre (sous les murs, dalles comprises)
  { const i = TILESET.OMBRE; ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.fillRect(i * 16, 0, 16, 5); ctx.globalAlpha = 0.18; ctx.fillRect(i * 16, 5, 16, 3); ctx.globalAlpha = 1 }
  // décor
  const deco = (d: number) => TILESET.DECO + d
  { const i = deco(D.CAILLOUX); for (const [x, y] of [[3, 4], [10, 9], [6, 12], [12, 3]]) { px(i, x, y, PAL.sol4); px(i, x + 1, y, PAL.sol3); px(i, x, y + 1, PAL.sol0); px(i, x + 1, y + 1, PAL.sol1) } }
  { const i = deco(D.TOUFFE); for (let k = 0; k < 7; k++) { const x = 5 + k, h = 2 + (k * 3) % 5; for (let y = 0; y < h; y++) px(i, x + (y > 2 ? (k % 2 ? 1 : -1) : 0), 13 - y, y > h - 2 ? PAL.herbe2 : PAL.herbe) } }
  { const i = deco(D.FISSURE); let x = 2, y = 5; for (let k = 0; k < 13; k++) { px(i, x, y, PAL.sol0); x++; if (k % 3 === 1) y++ } }
  { const i = deco(D.OS); for (let x = 4; x < 12; x++) px(i, x, 8, '#d8d0b8'); for (const [x, y] of [[3, 7], [3, 9], [12, 7], [12, 9]]) px(i, x, y, '#efe8d4'); px(i, 7, 11, '#d8d0b8'); px(i, 8, 11, '#d8d0b8') }
  { const i = deco(D.LAMPE); for (let y = 4; y < 15; y++) px(i, 7, y, PAL.acier2); for (let y = 4; y < 15; y++) px(i, 8, y, PAL.acier0); for (let x = 5; x < 11; x++) px(i, x, 15, PAL.acier1); for (let x = 5; x < 11; x++) { px(i, x, 2, PAL.acier3); px(i, x, 3, PAL.lampe) } px(i, 7, 3, PAL.lampe2); px(i, 8, 3, PAL.lampe2) }
  { const i = deco(D.VRILLE); for (let t = 0; t < 3; t++) { let x = 4 + t * 4, y = 15; for (let s = 0; s < 9 + t; s++) { px(i, x, y, s > 6 ? PAL.chair4 : PAL.chair3); y--; if (s % 2) x += t === 1 ? 1 : -1 + (s % 4 === 1 ? 2 : 0) } px(i, x, y, PAL.lueur) } }
  { const i = deco(D.FLAQUE); for (let y = 6; y < 11; y++) for (let x = 3; x < 13; x++) if (((x - 8) ** 2) / 25 + ((y - 8) ** 2) / 6 < 1) px(i, x, y, (x + y) % 5 ? PAL.acide2 : PAL.acide, 0.8) }
  drawWorldTiles(ctx)
  tex.refresh()
}

// ----------------------------------------------------------------- petites textures
function small(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, fn: (c: CanvasRenderingContext2D) => void) => { const t = scene.textures.createCanvas(key, w, h)!; fn(t.getContext()); t.refresh() }
  make('px', 2, 2, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2) })
  make('balle0', 5, 3, (c) => { c.fillStyle = PAL.lampe; c.fillRect(0, 1, 5, 1); c.fillStyle = PAL.lampe2; c.fillRect(2, 0, 3, 3); c.fillStyle = '#fff'; c.fillRect(3, 1, 2, 1) })
  make('balle2', 5, 3, (c) => { c.fillStyle = PAL.cyan; c.fillRect(0, 1, 5, 1); c.fillStyle = PAL.cyan2; c.fillRect(2, 0, 3, 3) })
  make('balle1', 5, 5, (c) => { c.fillStyle = PAL.acide2; c.fillRect(1, 0, 3, 5); c.fillRect(0, 1, 5, 3); c.fillStyle = PAL.acide; c.fillRect(1, 1, 3, 3); c.fillStyle = '#efffd0'; c.fillRect(1, 1, 1, 1) })
  make('ombre', 14, 5, (c) => { c.fillStyle = 'rgba(0,0,0,0.38)'; for (let y = 0; y < 5; y++) { const w = Math.round(14 * Math.sqrt(1 - ((y - 2) / 2.6) ** 2)); c.fillRect((14 - w) >> 1, y, w, 1) } })
  make('grenade', 4, 4, (c) => { c.fillStyle = PAL.k; c.fillRect(0, 0, 4, 4); c.fillStyle = '#5d6b3c'; c.fillRect(1, 1, 2, 2); c.fillStyle = PAL.lampe; c.fillRect(1, 0, 1, 1) })
  make('tache', 16, 12, (c) => { const R = rng(5); for (let i = 0; i < 70; i++) { const a = R() * 6.28, d = R() * 6; c.fillStyle = R() < 0.5 ? PAL.chair2 : PAL.chair1; c.fillRect(8 + Math.cos(a) * d | 0, 6 + Math.sin(a) * d * 0.7 | 0, 2, 1) } c.fillStyle = PAL.acide2; c.fillRect(7, 5, 2, 1) })
  make('halo', 64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64) })
  make('eclat', 7, 7, (c) => { c.fillStyle = '#fff'; c.fillRect(3, 0, 1, 7); c.fillRect(0, 3, 7, 1); c.fillRect(2, 2, 3, 3) })
}

export function makeTextures(scene: Phaser.Scene) {
  for (let i = 0; i < CLASS_COLORS.length; i++) soldier(scene, i)
  for (const [k, rows] of Object.entries(ARMES)) draw(scene, k, rows, { k: PAL.k, G: PAL.acier3, g: PAL.acier1, o: '#7a5a3a', v: '#c48bff' })
  const palR = { k: PAL.k, G: PAL.acier3, B: PAL.acier2, g: PAL.acier1, c: PAL.acier0, '7': PAL.cyan, W: PAL.cyan2, o: '#ff9b3d', O: '#ffd36b' }
  sheet(scene, 'robot', ROBOT, palR)
  draw(scene, 'avantposte', AVANT_POSTE, palR)
  draw(scene, 'tourelle', TOURELLE, palR)
  sheet(scene, 'rampant', RAMPANT.map((f) => f.map((r) => r.replace(/ /g, '3'))), PAL_EDEN)
  sheet(scene, 'cracheur', CRACHEUR.map((f) => f.map((r) => r.replace(/ /g, '3'))), PAL_EDEN)
  sheet(scene, 'cuirasse', CUIRASSE, PAL_EDEN)
  sheet(scene, 'oeuf', OEUF, PAL_EDEN)
  couveuse(scene)
  sac(scene)
  tiles(scene)
  small(scene)
  makeWorldTextures(scene)
}

export { CLASS_COLORS }
export const TILE_OF = { T, D }
