// Le nid : une carte d'instance (une copie par groupe de quatre, complété par des soldats IA). On y entre
// par la Gueule, au cœur de la Grande Ruche. Une antichambre de chair, puis l'enclos de la Couveuse.
import { TILE, NEST } from '../consts.ts'
import { T, D, rng } from '../tiles.ts'
import { PASSAGES } from '../monde.ts'
import type { GameMap, Point } from '../map.ts'

export const NID_W = 52, NID_H = 42

export function generateNid(seed = 77): GameMap {
  const w = NID_W, h = NID_H
  const R = rng(seed)
  const tiles = new Uint8Array(w * h).fill(T.CHAIR)
  const deco = new Uint8Array(w * h)
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t }
  // l'antichambre : un boyau qui ondule de l'entrée vers la porte du nid, au mur ouest
  const porteY = (NEST.doorY0 + NEST.doorY1) >> 1
  for (let x = 2; x < NEST.x0; x++) {
    const k = Math.max(0, (x - 8) / (NEST.x0 - 8))
    const cy = Math.round(21 + (porteY - 21) * k + Math.sin(x / 3) * 3 * (1 - k))
    for (let y = cy - 4; y <= cy + 4; y++) set(x, y, T.CHAIRSOL)
  }
  for (let y = NEST.doorY0 - 3; y <= NEST.doorY1 + 2; y++) for (let x = NEST.x0 - 3; x <= NEST.x0 - 1; x++) set(x, y, T.CHAIRSOL)
  // l'enclos : sol nu, sans piliers (on y esquive des flots de balles)
  for (let y = NEST.y0; y <= NEST.y1; y++) for (let x = NEST.x0; x <= NEST.x1; x++) {
    const bord = x === NEST.x0 || y === NEST.y0 || x === NEST.x1 || y === NEST.y1
    set(x, y, bord ? T.CHAIR : T.NIDSOL)
  }
  for (let y = NEST.doorY0; y <= NEST.doorY1; y++) set(NEST.x0, y, T.NIDSOL)
  for (let i = 0; i < w * h; i++) if (tiles[i] === T.CHAIRSOL && R() < 0.1) deco[i] = R() < 0.6 ? D.VRILLE : D.FLAQUE
  const passages = PASSAGES.filter((p) => p.carte === 'nid')
  for (const p of passages) for (let dy = -1; dy <= 1; dy++) for (let dx = 0; dx <= 2; dx++) set(p.x + dx, p.y + dy, dx === 0 && dy === 0 ? T.SAS : T.CHAIRSOL)
  const e = passages[0]
  const spawn = { x: (e.x + e.sortie[0]) * TILE + 8, y: (e.y + e.sortie[1]) * TILE + 8 }
  const door: Point = { x: NEST.x0 * TILE + 8, y: ((NEST.doorY0 + NEST.doorY1) >> 1) * TILE + 8 }
  // le centre du nid : là où se tient la Couveuse, en haut de l'arène
  const centre: Point = { x: ((NEST.x0 + NEST.x1 + 1) / 2) * TILE, y: (NEST.y0 + 3) * TILE }
  return {
    w, h, tiles, deco, carte: 'nid', zoneCarte: 'nid', passages, stations: [],
    points: { spawn, atelier: spawn, porte: spawn, tableau: spawn, nid: door, nidCentre: centre },
    monde: { zones: [], batiments: [], pois: [{ id: 'nid', nom: 'Le nid', x: centre.x, y: centre.y, r: 200, type: 'lieu' }], camps: [], noeuds: [], pannes: [], arbres: [], lieux: [{ id: 'nid', nom: 'Le nid', x0: NEST.x0, y0: NEST.y0, x1: NEST.x1, y1: NEST.y1 }], lampes: [], boss: null },
  }
}
