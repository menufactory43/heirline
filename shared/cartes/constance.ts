// L'intérieur de l'épave de la Constance, le vaisseau de la Première Vague : une carte reliée au continent
// par le sas du Cimetière. Une coursive d'ouest en est, les cabines, la salle de jeux, la soute des drones
// devenus Rouillards, la salle des machines, et tout au bout la passerelle. Derrière la passerelle, une salle
// scellée : le dernier message de la Terre, qu'on n'ouvre qu'après l'acte 2 (docs/histoire.md § 8).
import { TILE } from '../consts.ts'
import { T, D, rng, isSolidTile } from '../tiles.ts'
import { PASSAGES } from '../monde.ts'
import { ENDROITS } from '../journaux.ts'
import type { GameMap, Building, Camp, Noeud, Point, Poi, Lieu } from '../map.ts'

export const CONSTANCE_W = 96, CONSTANCE_H = 56

export const CONSTANCE_LIEUX: Lieu[] = [
  { id: 'constance_coursive', nom: 'La grande coursive', x0: 2, y0: 36, x1: 80, y1: 44 },
  { id: 'cabine_enfant', nom: 'Une cabine d\'enfant', x0: 14, y0: 24, x1: 22, y1: 33 },
  { id: 'salle_jeux', nom: 'La salle de jeux', x0: 26, y0: 24, x1: 38, y1: 33 },
  { id: 'soute', nom: 'La soute des drones', x0: 40, y0: 47, x1: 66, y1: 54 },
  { id: 'machines', nom: 'La salle des machines', x0: 14, y0: 47, x1: 36, y1: 54 },
  { id: 'passerelle', nom: 'La passerelle', x0: 70, y0: 14, x1: 86, y1: 28 },
  { id: 'salle_cachee', nom: 'Une salle scellée', x0: 88, y0: 16, x1: 93, y1: 26 },
]

export function generateConstance(seed = 1938): GameMap {
  const w = CONSTANCE_W, h = CONSTANCE_H
  const R = rng(seed)
  const tiles = new Uint8Array(w * h).fill(T.METAL)
  const deco = new Uint8Array(w * h)
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t }
  const setD = (x: number, y: number, d: number) => { if (x >= 0 && y >= 0 && x < w && y < h) deco[y * w + x] = d }
  const salle = (x0: number, y0: number, x1: number, y1: number, sol: number = T.DALLE) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, sol) }
  const lampes: Point[] = []
  const lampe = (x: number, y: number) => { setD(x, y, D.LAMPE); lampes.push({ x: x * TILE + 8, y: y * TILE + 3 }) }

  // la coursive, et ses tronçons effondrés
  salle(2, 37, 80, 43)
  for (let x = 6; x < 80; x += 9) lampe(x, 37)
  for (let i = 0; i < 14; i++) { const x = 8 + Math.floor(R() * 70), y = 38 + Math.floor(R() * 5); set(x, y, R() < 0.5 ? T.CAISSE : T.EPAVE) }
  // cabines au nord (portes sur la coursive)
  salle(14, 25, 22, 32, T.PLANCHER); salle(17, 33, 18, 36, T.PLANCHER)
  for (const [x, y, d] of [[15, 26, D.M_LIT], [21, 26, D.M_ARMOIRE], [15, 30, D.M_TABLE]] as const) { set(x, y, T.MEUBLE); setD(x, y, d) }
  salle(26, 25, 38, 32, T.PLANCHER); salle(31, 33, 32, 36, T.PLANCHER)
  for (const [x, y, d] of [[27, 26, D.M_TABLE], [28, 26, D.M_BANC], [36, 26, D.M_ETAGERE], [37, 26, D.M_ETAGERE], [27, 31, D.M_CAISSES]] as const) { set(x, y, T.MEUBLE); setD(x, y, d) }
  salle(42, 25, 50, 32, T.PLANCHER); salle(45, 33, 46, 36, T.PLANCHER)
  for (const [x, y, d] of [[43, 26, D.M_LIT], [49, 26, D.M_LIT], [43, 31, D.M_ARMOIRE]] as const) { set(x, y, T.MEUBLE); setD(x, y, d) }
  // salle des machines et soute au sud
  salle(14, 47, 36, 54); salle(24, 44, 26, 46)
  for (let x = 16; x <= 34; x += 4) for (let y = 49; y <= 52; y++) set(x, y, T.METAL)
  salle(40, 47, 66, 54, T.FERRAILLE); salle(52, 44, 54, 46)
  for (let i = 0; i < 18; i++) { const x = 42 + Math.floor(R() * 23), y = 48 + Math.floor(R() * 6); if (R() < 0.6) set(x, y, T.EPAVE); else setD(x, y, R() < 0.5 ? D.PNEU : D.TUYAU) }
  lampe(20, 47); lampe(30, 47); lampe(46, 47); lampe(60, 47)
  // l'escalier vers la passerelle, la passerelle et ses consoles
  salle(76, 29, 79, 36)
  salle(70, 15, 86, 28)
  for (let x = 72; x <= 84; x += 3) { set(x, 16, T.MEUBLE); setD(x, 16, D.M_COMPTOIR) }
  for (const [x, y, d] of [[71, 22, D.M_ETAGERE], [85, 22, D.M_ETAGERE], [78, 20, D.M_TABLE]] as const) { set(x, y, T.MEUBLE); setD(x, y, d) }
  lampe(74, 15); lampe(82, 15)
  // derrière la passerelle : une porte scellée, et la salle qu'elle garde (la console du dernier message)
  set(87, 21, T.SCELLE)
  salle(88, 17, 93, 25, T.DALLE)
  set(92, 18, T.MEUBLE); setD(92, 18, D.M_COMPTOIR); lampe(90, 17)
  // la plaque de la coursive (docs/histoire.md § 8), et les endroits où l'on lit restent dégagés
  set(40, 37, T.MEUBLE); setD(40, 37, D.M_TABLEAU)
  for (const e of ENDROITS) if (e.carte === 'constance') { set(e.x, e.y, tiles[e.y * w + e.x] === T.PLANCHER ? T.PLANCHER : T.DALLE); setD(e.x, e.y, 0) }
  // le sas, à l'ouest
  for (let y = 38; y <= 42; y++) for (let x = 1; x <= 4; x++) set(x, y, T.DALLE)
  const passages = PASSAGES.filter((p) => p.carte === 'constance')
  for (const p of passages) set(p.x, p.y, T.SAS)

  // l'épave est le cœur de l'acte 2 (niveaux 6 à 12) : ses Rouillards sont un cran sous ceux du Cimetière
  const camps: Camp[] = [
    { id: 'k0', zone: 'cimetiere', x: 52 * TILE, y: 50 * TILE, kinds: [10], niveau: 11, n: 4 },
    { id: 'k1', zone: 'cimetiere', x: 60 * TILE, y: 52 * TILE, kinds: [10, 2], niveau: 12, n: 3 },
    { id: 'k2', zone: 'cimetiere', x: 26 * TILE, y: 50 * TILE, kinds: [10], niveau: 11, n: 3 },
    { id: 'k3', zone: 'cimetiere', x: 66 * TILE, y: 40 * TILE, kinds: [10, 11], niveau: 12, n: 3 },
    { id: 'k4', zone: 'cimetiere', x: 78 * TILE, y: 24 * TILE, kinds: [10], niveau: 13, n: 3 },
  ]
  const noeuds: Noeud[] = [
    { id: 'kn0', type: 'pieces', x: 44 * TILE + 8, y: 52 * TILE + 8 }, { id: 'kn1', type: 'pieces', x: 63 * TILE + 8, y: 49 * TILE + 8 },
    { id: 'kn2', type: 'pieces', x: 33 * TILE + 8, y: 52 * TILE + 8 }, { id: 'kn3', type: 'noyau', x: 80 * TILE + 8, y: 18 * TILE + 8 },
    { id: 'kn4', type: 'noyau', x: 48 * TILE + 8, y: 30 * TILE + 8 },
  ]
  for (const n of noeuds) { const i = Math.floor(n.y / TILE) * w + Math.floor(n.x / TILE); if (isSolidTile(tiles[i])) tiles[i] = T.DALLE }
  const pois: Poi[] = CONSTANCE_LIEUX.map((l) => ({ id: l.id, nom: l.nom, x: ((l.x0 + l.x1) / 2) * TILE, y: ((l.y0 + l.y1) / 2) * TILE, r: Math.max(l.x1 - l.x0, l.y1 - l.y0) * TILE * 0.6, type: 'lieu' as const }))
  const entree = passages[0]
  const spawn = { x: (entree.x + entree.sortie[0]) * TILE + 8, y: (entree.y + entree.sortie[1]) * TILE + 8 }
  const batiments: Building[] = []
  return {
    w, h, tiles, deco, carte: 'constance', zoneCarte: 'abri', passages, stations: [],
    points: { spawn, atelier: spawn, porte: spawn, tableau: spawn, nid: spawn, nidCentre: spawn },
    monde: { zones: [], batiments, pois, camps, noeuds, pannes: [], arbres: [], lieux: CONSTANCE_LIEUX, lampes, boss: null },
  }
}
