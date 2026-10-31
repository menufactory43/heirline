// Le monorail de la Première Vague : le réseau (une ligne principale et un embranchement, surélevés sur des piliers),
// les trajets d'une gare à l'autre en passant par les gares intermédiaires, et la marche de la rame, calculée de la même
// façon au serveur et chez chaque client à partir du seul départ (gares, instant) : le serveur n'envoie que ça.
//  - Ligne du Col (principale) : Halte du Marais → Gare de Port-Ancre → Halte du Col → Halte du Bastion.
//  - Ligne de l'Ouest (embranchement au Col) : Halte du Col → Halte de la Fougère → Halte de l'Épave.
import { TILE } from './consts.ts'
import { STATION_BY_ID } from './monde.ts'

/** le rail passe à cette hauteur au-dessus du sol (px), comme sur l'auvent des gares */
export const RAIL_H = 30

export type LigneId = 'col' | 'ouest' | 'glane' | 'mer'
export interface Troncon { a: string; b: string; ligne: LigneId; pts: [number, number][] }

/** Les tronçons, en tuiles (le sol sous le rail), d'une gare à la suivante. Les gares sont traversées à l'horizontale. */
export const TRONCONS: Troncon[] = [
  { a: 'st_marais', b: 'st_port', ligne: 'col', pts: [[320, 291], [312, 291], [296, 295], [262, 310], [240, 316], [227, 316]] },
  { a: 'st_port', b: 'st_col', ligne: 'col', pts: [[227, 316], [215, 316], [207, 308], [206, 230], [208, 216], [214, 216]] },
  { a: 'st_col', b: 'st_bastion', ligne: 'col', pts: [[214, 216], [222, 216], [240, 204], [254, 182], [259, 173], [266, 173]] },
  { a: 'st_col', b: 'st_fougere', ligne: 'ouest', pts: [[214, 216], [208, 216], [198, 219], [150, 226], [96, 228], [80, 228]] },
  { a: 'st_fougere', b: 'st_epave', ligne: 'ouest', pts: [[80, 228], [72, 228], [65, 220], [66, 152], [88, 124], [97, 118], [104, 118]] },
  // la ligne de Glane : du Bastion vers l'isthme et les Hauts (campagne 2)
  { a: 'st_bastion', b: 'st_gue', ligne: 'glane', pts: [[266, 173], [274, 173], [300, 152], [330, 122], [362, 100], [392, 92], [424, 100], [440, 111], [448, 111]] },
  { a: 'st_gue', b: 'st_champs', ligne: 'glane', pts: [[448, 111], [456, 111], [470, 128], [490, 170], [512, 204], [520, 211], [527, 211]] },
  { a: 'st_gue', b: 'st_mat', ligne: 'glane', pts: [[448, 111], [456, 111], [480, 100], [520, 92], [540, 88], [548, 88]] },
  // la barge : d'Anse-Grise à Relâche par la mer (pas de rail, pas de piliers)
  { a: 'st_anse', b: 'st_relache', ligne: 'mer', pts: [[255, 347], [252, 351], [252, 360], [272, 368], [330, 370], [390, 346], [424, 306], [440, 282], [446, 279], [454, 279]] },
]

/** les gares de la mer : la barge y accoste, il n'y a ni rail ni rame */
export const GARES_MER = new Set(TRONCONS.filter((t) => t.ligne === 'mer').flatMap((t) => [t.a, t.b]))

/** un point du sol, en pixels, sous le rail */
const px = ([x, y]: [number, number]): [number, number] => [x * TILE + 8, y * TILE + 13]

/** un tronçon en pixels (le sol sous le rail) */
export function ligneTroncon(t: Troncon): Ligne { return ligne(t.pts.map(px)) }

/** Le plus court chemin (en tronçons) d'une gare à l'autre, par les seules gares ouvertes. */
export function chemin(de: string, vers: string, ouverte: (id: string) => boolean): { ids: string[]; troncons: { t: Troncon; sens: 1 | -1 }[] } | null {
  if (!ouverte(de) || !ouverte(vers) || de === vers) return null
  const prec = new Map<string, { id: string; t: Troncon; sens: 1 | -1 }>()
  const file = [de], vus = new Set([de])
  while (file.length) {
    const id = file.shift()!
    if (id === vers) break
    for (const t of TRONCONS) {
      const n = t.a === id ? t.b : t.b === id ? t.a : null
      if (!n || vus.has(n) || !ouverte(n)) continue
      vus.add(n); prec.set(n, { id, t, sens: t.a === id ? 1 : -1 }); file.push(n)
    }
  }
  if (!prec.has(vers)) return null
  const ids = [vers], troncons: { t: Troncon; sens: 1 | -1 }[] = []
  for (let id = vers; id !== de;) { const p = prec.get(id)!; troncons.unshift({ t: p.t, sens: p.sens }); ids.unshift(p.id); id = p.id }
  return { ids, troncons }
}

/** Une polyligne en pixels, avec les longueurs cumulées. */
export interface Ligne { x: number[]; y: number[]; s: number[] }
export function ligne(pts: [number, number][]): Ligne {
  const l: Ligne = { x: [], y: [], s: [] }
  for (const p of pts) {
    const [x, y] = p
    if (l.x.length && x === l.x[l.x.length - 1] && y === l.y[l.y.length - 1]) continue
    l.s.push(l.x.length ? l.s[l.s.length - 1] + Math.hypot(x - l.x[l.x.length - 1], y - l.y[l.y.length - 1]) : 0)
    l.x.push(x); l.y.push(y)
  }
  return l
}
export function longueur(l: Ligne) { return l.s[l.s.length - 1] }
/** le point à la distance s le long de la ligne, et le cap */
export function surLigne(l: Ligne, s: number): { x: number; y: number; a: number } {
  s = Math.max(0, Math.min(longueur(l), s))
  let i = 1
  while (i < l.s.length - 1 && l.s[i] < s) i++
  const k = (s - l.s[i - 1]) / ((l.s[i] - l.s[i - 1]) || 1)
  return { x: l.x[i - 1] + (l.x[i] - l.x[i - 1]) * k, y: l.y[i - 1] + (l.y[i] - l.y[i - 1]) * k, a: Math.atan2(l.y[i] - l.y[i - 1], l.x[i] - l.x[i - 1]) }
}

/** Les phases d'un trajet : la rame arrive et freine, on monte (portes ouvertes), le voyage, on descend. */
export const T_MONTEE = 1.6, T_DESCENTE = 1.4
const APPROCHE = 240, V_APPROCHE = 190
const ACC = 230, FREIN = 250, V_PASSAGE = 170, PAS = 1 / 30

export interface Trajet {
  de: string; vers: string; ids: string[]
  /** l'approche (vers la gare de départ) puis le voyage, en pixels du sol */
  approche: Ligne; voyage: Ligne
  /** les gares traversées : distance le long du voyage */
  arrets: { id: string; s: number }[]
  tApproche: number; tVoyage: number; total: number
  /** la distance parcourue pendant le voyage, échantillonnée tous les PAS */
  table: number[]
}

/** Le trajet d'une gare à l'autre (null si pas de chemin par des gares ouvertes). Déterministe : mêmes gares, même trajet. */
export function trajet(de: string, vers: string, ouverte: (id: string) => boolean): Trajet | null {
  const ch = chemin(de, vers, ouverte)
  if (!ch) return null
  const pts: [number, number][] = []
  for (const { t, sens } of ch.troncons) pts.push(...(sens === 1 ? t.pts : [...t.pts].reverse()).map(px))
  const voyage = ligne(pts)
  // les gares traversées
  const arrets: { id: string; s: number }[] = []
  let acc = 0
  for (let i = 0; i < ch.troncons.length - 1; i++) { acc += longueur(ligne(ch.troncons[i].t.pts.map(px))); arrets.push({ id: ch.ids[i + 1], s: acc }) }
  // l'approche : la rame vient par l'autre tronçon de la gare de départ s'il y en a un, sinon par celui qu'elle va
  // reprendre (une navette qui fait demi-tour au terminus)
  const premier = ch.troncons[0].t
  const autre = TRONCONS.find((t) => t !== premier && (t.a === de || t.b === de))
  const src = autre ? (autre.b === de ? autre.pts : [...autre.pts].reverse()) : [...(premier.a === de ? premier.pts : [...premier.pts].reverse())].reverse()
  const la = ligne(src.map(px))
  const L = longueur(la), debut = Math.max(0, L - APPROCHE)
  const approchePts: [number, number][] = []
  for (let d = debut; d < L; d += 8) { const p = surLigne(la, d); approchePts.push([p.x, p.y]) }
  approchePts.push([la.x[la.x.length - 1], la.y[la.y.length - 1]])
  const approche = ligne(approchePts)
  const tApproche = 2 * longueur(approche) / V_APPROCHE
  // le voyage : accélère, ralentit aux gares traversées, freine jusqu'à l'arrêt
  const Lv = longueur(voyage)
  const vmax = Math.max(190, Math.min(1600, Lv / 5.5))
  const table = [0]
  let s = 0, v = 0
  for (let n = 0; n < 4000 && s < Lv - 0.5; n++) {
    let lim = Math.min(vmax, v + ACC * PAS, Math.sqrt(2 * FREIN * Math.max(0, Lv - s)) + 4)
    for (const a of arrets) if (a.s > s) lim = Math.min(lim, Math.sqrt(V_PASSAGE ** 2 + 2 * FREIN * (a.s - s)))
    v = Math.max(8, lim)
    s = Math.min(Lv, s + v * PAS)
    table.push(s)
  }
  if (table[table.length - 1] < Lv) table.push(Lv)
  const tVoyage = (table.length - 1) * PAS
  return { de, vers, ids: ch.ids, approche, voyage, arrets, tApproche, tVoyage, total: tApproche + T_MONTEE + tVoyage + T_DESCENTE, table }
}

export type PhaseRame = 'approche' | 'montee' | 'voyage' | 'descente' | 'fini'
export interface EtatRame {
  phase: PhaseRame
  /** la rame : le point du sol sous elle, le cap, la vitesse (px/s) */
  x: number; y: number; a: number; v: number
  /** les portes : 0 fermées, 1 ouvertes */
  portes: number
  /** le soldat est dans la cabine */
  abord: boolean
  /** la prochaine gare (traversée ou terminus) */
  prochain: string
}

/** L'état de la rame t secondes après le départ du trajet. */
export function etatRame(tr: Trajet, t: number): EtatRame {
  if (t < tr.tApproche) {
    const L = longueur(tr.approche), d = L * (1 - (1 - t / tr.tApproche) ** 2)
    const p = surLigne(tr.approche, d)
    return { phase: 'approche', ...p, v: V_APPROCHE * (1 - t / tr.tApproche), portes: 0, abord: false, prochain: tr.de }
  }
  t -= tr.tApproche
  const fin = surLigne(tr.approche, longueur(tr.approche))
  const depart = surLigne(tr.voyage, 0)
  if (t < T_MONTEE) {
    const portes = Math.min(1, t / 0.3, (T_MONTEE - t) / 0.3)
    return { phase: 'montee', x: fin.x, y: fin.y, a: t < T_MONTEE / 2 ? fin.a : depart.a, v: 0, portes, abord: t > T_MONTEE * 0.55, prochain: tr.ids[1] }
  }
  t -= T_MONTEE
  if (t < tr.tVoyage) {
    const k = t / PAS, i = Math.floor(k), f = k - i
    const s = tr.table[i] + ((tr.table[i + 1] ?? tr.table[i]) - tr.table[i]) * f
    const v = ((tr.table[i + 1] ?? tr.table[i]) - tr.table[i]) / PAS
    const p = surLigne(tr.voyage, s)
    const prochain = tr.arrets.find((a) => a.s > s + 1)?.id ?? tr.vers
    return { phase: 'voyage', ...p, v, portes: 0, abord: true, prochain }
  }
  t -= tr.tVoyage
  const p = surLigne(tr.voyage, longueur(tr.voyage))
  if (t < T_DESCENTE) return { phase: 'descente', ...p, v: 0, portes: Math.min(1, t / 0.3, (T_DESCENTE - t) / 0.3), abord: t < T_DESCENTE * 0.35, prochain: tr.vers }
  return { phase: 'fini', ...p, v: 0, portes: 0, abord: false, prochain: tr.vers }
}

/** où l'on attend la rame, et où elle dépose : sur le quai, sous la gare (comme l'ancien voyage immédiat) */
export function quai(id: string) { const s = STATION_BY_ID[id]; return { x: s.x * TILE + 8, y: (s.y + 2) * TILE + 8 } }
