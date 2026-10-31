// Les donjons : une instance par groupe (comme le nid), un parcours en lacets, puis l'arène de paysage du boss, à la
// même place que l'enclos du nid (NEST) pour que l'arène serve telle quelle. Le parcours part du bas à gauche, va et
// vient d'un bord à l'autre en remontant (cinq lacets, jamais tout droit), longe le mur ouest et entre par la porte.
import { TILE, NEST } from '../consts.ts'
import { T, D, rng } from '../tiles.ts'
import { PASSAGES, type CarteId } from '../monde.ts'
import type { GameMap, Point } from '../map.ts'

export const DONJON_W = 52, DONJON_H = 74
/** les lacets : la rangée du milieu de chaque couloir, du bas vers le haut */
export const LACETS = [69, 61, 53, 45, 37]

export function generateDonjon(carte: CarteId, theme: 'vase' | 'chair' | 'serre' | 'registre' | 'metier', seed = 101): GameMap {
  const w = DONJON_W, h = DONJON_H
  const R = rng(seed)
  // la Serre : des racines qui ont envahi les allées, l'arène sous une armature de verre ; le Registre : des murs de métal, un dallage
  const TH = { vase: [T.ROC, T.BOUE, T.MOUSSE], chair: [T.CHAIR, T.CHAIRSOL, T.NIDSOL], serre: [T.RACINE, T.HERBE, T.MOUSSE], registre: [T.METAL, T.DALLE, T.PAVE], metier: [T.EPAVE, T.FERRAILLE, T.DALLE] }[theme]
  const mur = TH[0], sol = TH[1], arene = TH[2]
  const tiles = new Uint8Array(w * h).fill(mur)
  const deco = new Uint8Array(w * h)
  const set = (x: number, y: number, t: number) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) tiles[y * w + x] = t }
  // les lacets : chaque couloir ondule, de 3 à 5 tuiles de haut, avec un mur d'au moins deux tuiles entre deux étages ;
  // on change de sens à chaque étage
  const etapes: Point[] = []
  LACETS.forEach((cy, i) => {
    const versDroite = i % 2 === 0
    for (let x = 3; x <= w - 4; x++) {
      const yy = Math.round(cy + Math.sin(x / 4 + i) * 1.1)
      const demi = 1 + (x % 9 < 3 ? 1 : 0)
      for (let y = yy - demi; y <= yy + demi; y++) set(x, y, sol)
    }
    // le virage : un puits qui monte à l'étage du dessus, du côté où l'on arrive
    if (i < LACETS.length - 1) { const x0 = versDroite ? w - 9 : 3; for (let y = LACETS[i + 1]; y <= cy; y++) for (let x = x0; x < x0 + 6; x++) set(x, y, sol) }
    etapes.push({ x: (versDroite ? w * 0.65 : w * 0.35) * TILE, y: cy * TILE + 8 })
  })
  // du dernier lacet, le long du mur ouest, jusqu'à la porte de l'arène
  const porteY = (NEST.doorY0 + NEST.doorY1) >> 1
  for (let y = porteY - 3; y <= LACETS[LACETS.length - 1]; y++) for (let x = 3; x <= 8; x++) set(x, y, sol)
  for (let x = 3; x < NEST.x0; x++) for (let y = porteY - 2 + Math.round(Math.sin(x / 2)); y <= porteY + 2 + Math.round(Math.sin(x / 2)); y++) set(x, y, sol)
  // l'arène, à la place de l'enclos du nid
  for (let y = NEST.y0; y <= NEST.y1; y++) for (let x = NEST.x0; x <= NEST.x1; x++) {
    const bord = x === NEST.x0 || y === NEST.y0 || x === NEST.x1 || y === NEST.y1
    tiles[y * w + x] = bord ? (theme === 'serre' ? T.CLOTURE : mur) : arene
  }
  for (let y = NEST.doorY0; y <= NEST.doorY1; y++) tiles[y * w + NEST.x0] = arene
  for (let i = 0; i < w * h; i++) if (tiles[i] === sol && R() < 0.08) deco[i] = theme === 'vase' ? (R() < 0.5 ? D.ROSEAU : D.FLAQUE) : theme === 'serre' ? (R() < 0.5 ? D.FOUGERE : D.FLEUR) : theme === 'registre' || theme === 'metier' ? (R() < 0.5 ? D.FISSURE : theme === 'metier' ? D.TUYAU : D.CAILLOUX) : (R() < 0.6 ? D.VRILLE : D.FLAQUE)
  const passages = PASSAGES.filter((p) => p.carte === carte)
  for (const p of passages) for (let dy = -1; dy <= 1; dy++) for (let dx = 0; dx <= 2; dx++) set(p.x + dx, p.y + dy, dx === 0 && dy === 0 ? T.SAS : sol)
  const e = passages[0]
  const spawn = { x: (e.x + e.sortie[0]) * TILE + 8, y: (e.y + e.sortie[1]) * TILE + 8 }
  const door: Point = { x: NEST.x0 * TILE + 8, y: porteY * TILE + 8 }
  const centre: Point = { x: ((NEST.x0 + NEST.x1 + 1) / 2) * TILE, y: (NEST.y0 + 3) * TILE }
  return {
    w, h, tiles, deco, carte, zoneCarte: 'nid', passages, stations: [],
    points: { spawn, atelier: spawn, porte: spawn, tableau: spawn, nid: door, nidCentre: centre, ...Object.fromEntries(etapes.map((p, i) => [`etape${i}`, p])) },
    monde: { zones: [], batiments: [], pois: [{ id: carte, nom: carte, x: centre.x, y: centre.y, r: 200, type: 'lieu' }], camps: [], noeuds: [], pannes: [], arbres: [], lieux: [{ id: 'nid', nom: carte, x0: NEST.x0, y0: NEST.y0, x1: NEST.x1, y1: NEST.y1 }], lampes: [], boss: null },
  }
}
