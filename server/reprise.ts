// Reprendre là où on s'est arrêté : la carte et la position du soldat, gardées dans sa fiche (soldiers.pos_json),
// revérifiées à la connexion. Une instance (le nid, son arène) ne survit pas au départ : on ressort par la Gueule.
// Une position dans un mur ou hors carte : la case libre la plus proche, sinon le départ de la carte.
import { TILE } from '../shared/consts.ts'
import { isSolidTile, type GameMap } from '../shared/map.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { CARTES, PASSAGES, PASSAGE_BY_ID, isCarte, type CarteId } from '../shared/monde.ts'

export interface Pos { carte: CarteId; x: number; y: number }

const maps = new Map<CarteId, GameMap>()
const mapDe = (c: CarteId) => { let m = maps.get(c); if (!m) { m = carteMap(c); maps.set(c, m) } return m }

/** Port-Ancre : le départ du continent (évacuation, héritier, fiche sans position). */
export function depart(): Pos { const sp = mapDe('ossara').points.spawn; return { carte: 'ossara', x: sp.x, y: sp.y } }

const libre = (m: GameMap, tx: number, ty: number) => tx >= 1 && ty >= 1 && tx < m.w - 1 && ty < m.h - 1 && !isSolidTile(m.tiles[ty * m.w + tx])

/** La case libre la plus proche (par anneaux, 12 cases au plus), ou null. */
export function caseLibre(m: GameMap, x: number, y: number): { x: number; y: number } | null {
  const tx0 = Math.floor(x / TILE), ty0 = Math.floor(y / TILE)
  if (libre(m, tx0, ty0)) return { x, y }
  for (let r = 1; r <= 12; r++) {
    let best: { x: number; y: number; d: number } | null = null
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !libre(m, tx0 + dx, ty0 + dy)) continue
      const d = dx * dx + dy * dy
      if (!best || d < best.d) best = { x: (tx0 + dx) * TILE + 8, y: (ty0 + dy) * TILE + 8, d }
    }
    if (best) return { x: best.x, y: best.y }
  }
  return null
}

/** Où reprend un soldat, d'après ce qui est gardé dans sa fiche (texte JSON, peut-être vide ou abîmé). */
export function reprise(json: string | null | undefined): Pos {
  let p: any = null
  try { p = json ? JSON.parse(json) : null } catch { p = null }
  if (!p || !isCarte(p.carte) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return depart()
  // l'instance du nid (et son arène) s'est refermée : on ressort par la Gueule, sur le continent
  if (CARTES[p.carte as CarteId].instance) {
    // on ressort par l'entrée de cette instance (la Gueule du nid, l'Antre, le Gosier)
    const sortie = PASSAGES.find((q) => q.carte === p.carte)
    const g = (sortie && PASSAGE_BY_ID[sortie.arrivee]) ?? PASSAGE_BY_ID.gueule_nid
    return { carte: g.carte, x: (g.x + g.sortie[0]) * TILE + 8, y: (g.y + g.sortie[1]) * TILE + 8 }
  }
  const m = mapDe(p.carte)
  if (p.x < 0 || p.y < 0 || p.x >= m.w * TILE || p.y >= m.h * TILE) { const sp = m.points.spawn; return { carte: p.carte, x: sp.x, y: sp.y } }
  const c = caseLibre(m, p.x, p.y)
  if (!c) { const sp = m.points.spawn; return { carte: p.carte, x: sp.x, y: sp.y } }
  return { carte: p.carte, x: c.x, y: c.y }
}
