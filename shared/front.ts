// Le front et la mort : des fonctions pures, testées sans serveur.
// ÉDEN se répand depuis plusieurs ruches, en taches de biomasse ; le front est la bordure de ces taches.
// Chaque ruche a un rayon qui grandit tout seul, recule quand on tue ses créatures près de la bordure,
// et recule autour des avant-postes actifs (qui creusent aussi une poche tenue dans la tache).
import { TILE, NEST, inCity, type Zone } from './consts.ts'
import { lieuAt } from './regions/index.ts'

export interface OutpostLike { x: number; y: number; actif: boolean }

export interface Ruche {
  /** identifiant stable */
  id: string; nom: string
  /** centre (tuiles) */
  x: number; y: number
  /** rayon de départ, plancher et plafond (tuiles) */
  r0: number; rmin: number; rmax: number
  /** phases de la bordure (sa forme propre) */
  phi: number; psi: number
  /** 2 : un foyer de la Glaneuse dans les Hauts de Glane (campagne 2) ; sinon une ruche d'Ossara */
  campagne?: 2
}

export const RUCHES: Ruche[] = [
  { id: 'ruche_nord', nom: 'La Grande Ruche', x: 330, y: 72, r0: 46, rmin: 26, rmax: 62, phi: 0.4, psi: 2.1 },
  { id: 'ruche_est', nom: 'La Ruche des Falaises', x: 372, y: 166, r0: 26, rmin: 12, rmax: 40, phi: 1.7, psi: 0.3 },
  { id: 'ruche_marais', nom: 'La Ruche Noyée', x: 372, y: 250, r0: 20, rmin: 8, rmax: 34, phi: 2.9, psi: 4.4 },
  { id: 'ruche_plateau', nom: 'La Ruche du Basalte', x: 240, y: 108, r0: 16, rmin: 6, rmax: 28, phi: 5.1, psi: 1.2 },
  { id: 'ruche_epave', nom: 'La Ruche des Carcasses', x: 34, y: 44, r0: 14, rmin: 6, rmax: 24, phi: 3.3, psi: 5.8 },
  // campagne 2 : les foyers de la Glaneuse, toujours après les ruches d'Ossara (les rayons enregistrés gardent leur ordre)
  { id: 'foyer_champs', nom: 'Le Foyer des Sillons', x: 566, y: 150, r0: 18, rmin: 8, rmax: 30, phi: 0.9, psi: 3.6, campagne: 2 },
  { id: 'foyer_serre', nom: 'Le Foyer des Serres', x: 606, y: 222, r0: 18, rmin: 8, rmax: 30, phi: 4.2, psi: 1.9, campagne: 2 },
  { id: 'foyer_metier', nom: 'Le Foyer du Métier', x: 558, y: 38, r0: 24, rmin: 12, rmax: 36, phi: 2.4, psi: 0.7, campagne: 2 },
]
/** les ruches d'Ossara (campagne 1) sont les NB_RUCHES_C1 premières */
export const NB_RUCHES_C1 = RUCHES.filter((r) => !r.campagne).length
export const RUCHE_BY_ID: Record<string, Ruche> = Object.fromEntries(RUCHES.map((r) => [r.id, r]))
export const RAYONS_DEPART = RUCHES.map((r) => r.r0)

/** Réglages du front (tuiles par seconde). En dev, on accélère avec FRONT_RATE. */
export const FRONT = {
  avance: Number((globalThis as any).process?.env?.FRONT_RATE ?? 0.012), // ~0,7 tuile de rayon par minute
  pousseeKill: 0.08,       // une mise à mort près d'une bordure fait reculer sa ruche d'autant
  pousseeBoss: 3,          // la Couveuse tombée : toutes les ruches reculent d'autant
  pousseeAvantPoste: 0.04, // par seconde, un avant-poste actif dans la tache fait reculer sa ruche
  poche: 7,                // rayon (tuiles) de la poche tenue autour d'un avant-poste actif
  porteeKill: 6,           // tuiles autour de la bordure où une mise à mort compte
}

/** Le rayon de la bordure d'une ruche dans une direction (la tache n'est pas un cercle). */
export function bordure(h: Ruche, r: number, a: number) { return r * (1 + 0.18 * Math.sin(3 * a + h.phi) + 0.1 * Math.sin(7 * a + h.psi)) }

/** Distance (tuiles, signée) d'un point à la bordure d'une ruche : négative dedans. */
export function ecartBordure(h: Ruche, r: number, tx: number, ty: number) {
  const dx = tx - h.x, dy = ty - h.y
  return Math.hypot(dx, dy) - bordure(h, r, Math.atan2(dy, dx))
}

/** La biomasse couvre-t-elle cette tuile (sans compter les lieux habités ni les poches) ? */
export function sousBiomasse(rayons: ArrayLike<number>, tx: number, ty: number) {
  for (let i = 0; i < RUCHES.length; i++) if (ecartBordure(RUCHES[i], rayons[i] ?? RUCHES[i].r0, tx, ty) < 0) return i
  return -1
}

export function dansPoche(outposts: Iterable<OutpostLike> | undefined, x: number, y: number) {
  if (!outposts) return false
  for (const o of outposts) if (o.actif && Math.hypot(o.x - x, o.y - y) < FRONT.poche * TILE) return true
  return false
}

export type CarteZone = 'continent' | 'nid' | 'abri'

/**
 * La zone d'un point : Port-Ancre, derrière le front (terre tenue), au-delà (dans la biomasse), le nid.
 * `carte` : 'continent' (les ruches), 'nid' (l'enclos est le nid, le reste est au-delà), 'abri' (une carte
 * reliée hors d'ÉDEN : l'intérieur de l'épave, terre tenue).
 */
export function zoneAt(rayons: ArrayLike<number>, x: number, y: number, outposts?: Iterable<OutpostLike>, carte: CarteZone = 'continent'): Zone {
  const tx = x / TILE, ty = y / TILE
  if (carte === 'nid') return tx >= NEST.x0 && tx <= NEST.x1 && ty >= NEST.y0 && ty <= NEST.y1 ? 'nid' : 'dela'
  if (carte === 'abri') return 'derriere'
  if (inCity(x, y)) return 'port'
  if (sousBiomasse(rayons, tx, ty) < 0) return 'derriere'
  if (lieuAt(Math.floor(tx), Math.floor(ty))?.habite) return 'derriere'
  if (dansPoche(outposts, x, y)) return 'derriere'
  return 'dela'
}

/** Ce que devient un soldat dont les PV tombent à zéro, selon l'endroit. */
export type DeathRule = { aTerre: number; ensuite: 'evacuation' | 'mort-definitive' | 'reapparition' }
export function deathRule(zone: Zone): DeathRule {
  if (zone === 'concession') return { aTerre: 0, ensuite: 'reapparition' }
  if (zone === 'port' || zone === 'derriere') return { aTerre: 12, ensuite: 'evacuation' }
  return { aTerre: 8, ensuite: 'mort-definitive' } // au-delà du front et au nid
}

/** Un pas du front : chaque ruche grandit, et recule devant les avant-postes actifs plantés dans sa tache. */
export function stepRuches(rayons: number[], dt: number, outposts: OutpostLike[]) {
  for (let i = 0; i < RUCHES.length; i++) {
    const h = RUCHES[i]
    let r = (rayons[i] ?? h.r0) + FRONT.avance * dt
    for (const o of outposts) {
      if (!o.actif) continue
      if (ecartBordure(h, r, o.x / TILE, o.y / TILE) < FRONT.poche) r -= (FRONT.pousseeAvantPoste + FRONT.avance) * dt
    }
    rayons[i] = clampRayon(i, r)
  }
}

/** Une mise à mort près d'une bordure fait reculer cette ruche. Rend l'indice de la ruche, ou -1. */
export function pushFrontByKill(rayons: number[], x: number, y: number) {
  const tx = x / TILE, ty = y / TILE
  for (let i = 0; i < RUCHES.length; i++) {
    if (Math.abs(ecartBordure(RUCHES[i], rayons[i], tx, ty)) <= FRONT.porteeKill) { rayons[i] = clampRayon(i, rayons[i] - FRONT.pousseeKill); return i }
  }
  return -1
}

/** fait reculer toutes les ruches d'une campagne (1 : Ossara, 2 : les foyers des Hauts ; sans campagne : toutes) */
export function pushFrontAll(rayons: number[], tiles: number, campagne?: 1 | 2) {
  for (let i = 0; i < RUCHES.length; i++) if (!campagne || (RUCHES[i].campagne ?? 1) === campagne) rayons[i] = clampRayon(i, rayons[i] - tiles)
}

/** complète des rayons enregistrés avant l'arrivée de nouvelles ruches (les anciennes gardent leur rayon) */
export function completerRayons(r: unknown): number[] | undefined {
  if (!Array.isArray(r) || r.length === 0 || r.length > RUCHES.length || !r.every(Number.isFinite)) return undefined
  return RUCHES.map((h, i) => clampRayon(i, i < r.length ? r[i] : h.r0))
}

export function clampRayon(i: number, r: number) { return Math.max(RUCHES[i].rmin, Math.min(RUCHES[i].rmax, r)) }
