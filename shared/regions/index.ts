// Toutes les régions du continent, et ce qu'on en déduit : quelle région à quelle tuile, quel lieu.
import { bruit } from '../tiles.ts'
import { PLAINES } from './plaines.ts'
import { FOUGERES } from './fougeres.ts'
import { MARAIS } from './marais.ts'
import { PLATEAUX } from './plateaux.ts'
import { CIMETIERE } from './cimetiere.ts'
import { EDEN } from './eden.ts'
import { HAUTS } from './hauts.ts'
import { HAUTS_X } from '../consts.ts'
import type { LieuDef, RegionDef } from './types.ts'

export type { RegionDef, LieuDef, PoiDef, NoeudType } from './types.ts'
/** Ossara (campagne 1), puis les Hauts de Glane (campagne 2, à l'est de HAUTS_X) */
export const REGIONS_C1: RegionDef[] = [PLAINES, FOUGERES, MARAIS, PLATEAUX, CIMETIERE, EDEN]
export const REGIONS_C2: RegionDef[] = HAUTS
export const REGIONS: RegionDef[] = [...REGIONS_C1, ...REGIONS_C2]
export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]))
export const LIEUX: LieuDef[] = REGIONS.flatMap((r) => r.lieux)
export const LIEU_BY_ID: Record<string, LieuDef> = Object.fromEntries(LIEUX.map((l) => [l.id, l]))

/** La région d'une tuile : le centre le plus proche, distances pondérées et bordures bruitées (calcul sans état). */
export function regionIdAt(tx: number, ty: number): string {
  const nx = (bruit(tx, ty, 23, 7) - 0.5) * 34 + (bruit(tx, ty, 7, 8) - 0.5) * 8
  const ny = (bruit(tx, ty, 23, 9) - 0.5) * 34 + (bruit(tx, ty, 7, 10) - 0.5) * 8
  // chaque massif garde ses régions : les Hauts ne mordent pas sur Ossara, ni l'inverse
  const set = tx >= HAUTS_X ? REGIONS_C2 : REGIONS_C1
  let best = set[0].id, bd = Infinity
  for (const r of set) {
    const d = Math.hypot(tx + nx - r.centre[0], ty + ny - r.centre[1]) / r.poids
    if (d < bd) { bd = d; best = r.id }
  }
  return best
}

export function lieuAt(tx: number, ty: number): LieuDef | null {
  for (const l of LIEUX) if (tx >= l.x0 && tx <= l.x1 && ty >= l.y0 && ty <= l.y1) return l
  return null
}

/** Le décalage d'un contenu posé à la main pour un lieu (voir `decale` dans les régions). Cantor, dans le
 *  Cimetière, n'a pas de lieu à lui : il chante au camp de l'Épave. */
const DECALE_HORS_LIEU: Record<string, [number, number]> = { cimetiere: [-255, 47] }
export function decaleLieu(lieu: string): [number, number] { return LIEU_BY_ID[lieu]?.decale ?? DECALE_HORS_LIEU[lieu] ?? [0, 0] }
