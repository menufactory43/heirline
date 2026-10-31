// La carte d'une concession, construite à partir des données publiées par un agent.
import { TILE } from './consts.ts'
import { T, D, rng, type GameMap } from './map.ts'
import type { Concession } from './bricks.ts'

export function concessionMap(c: Concession, seed = 7): GameMap {
  const w = c.taille.largeur, h = c.taille.hauteur
  const tiles = new Uint8Array(w * h)
  const deco = new Uint8Array(w * h)
  const sol = c.sol === 'dalle' ? T.DALLE : c.sol === 'chair' ? T.NIDSOL : T.SOL
  tiles.fill(sol)
  const MUR = { roche: T.ROC, metal: T.METAL, caisse: T.CAISSE, chair: T.CHAIR } as const
  for (const m of c.murs) for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.l; x++) if (x > 0 && y > 0 && x < w - 1 && y < h - 1) tiles[y * w + x] = MUR[m.type]
  for (let x = 0; x < w; x++) { tiles[x] = T.ROC; tiles[(h - 1) * w + x] = T.ROC }
  for (let y = 0; y < h; y++) { tiles[y * w] = T.ROC; tiles[y * w + w - 1] = T.ROC }
  // le départ reste toujours dégagé
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = c.depart.x + dx, y = c.depart.y + dy
    if (x > 0 && y > 0 && x < w - 1 && y < h - 1) tiles[y * w + x] = sol
  }
  const R = rng(seed)
  for (let i = 0; i < w * h; i++) if (tiles[i] === sol && R() < 0.12) deco[i] = sol === T.NIDSOL ? D.VRILLE : [D.CAILLOUX, D.TOUFFE, D.FISSURE][Math.floor(R() * 3)]
  const spawn = { x: (c.depart.x + 0.5) * TILE, y: (c.depart.y + 0.5) * TILE }
  return { w, h, tiles, deco, carte: 'concession', zoneCarte: 'abri', passages: [], stations: [], points: { spawn, atelier: spawn, porte: spawn, tableau: spawn, nid: spawn, nidCentre: spawn } }
}
