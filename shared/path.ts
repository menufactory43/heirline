// Recherche de chemin (A*) sur la grille des tuiles, pour les habitants qui vont d'un lieu à l'autre.
import { isSolidTile, type GameMap } from './map.ts'

/** Le plus proche voisin praticable d'une tuile (spirale bornée). */
export function nearestFree(m: GameMap, tx: number, ty: number, max = 6): [number, number] | null {
  for (let r = 0; r <= max; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
    const x = tx + dx, y = ty + dy
    if (x >= 0 && y >= 0 && x < m.w && y < m.h && !isSolidTile(m.tiles[y * m.w + x])) return [x, y]
  }
  return null
}

/** Un chemin de tuiles de (sx,sy) à (tx,ty), diagonales comprises sans couper les coins ; null si introuvable. */
export function findPath(m: GameMap, sx: number, sy: number, tx: number, ty: number, maxNodes = 5000): [number, number][] | null {
  const w = m.w
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < m.h && !isSolidTile(m.tiles[y * w + x])
  if (!free(tx, ty)) { const n = nearestFree(m, tx, ty); if (!n) return null; [tx, ty] = n }
  if (!free(sx, sy)) { const n = nearestFree(m, sx, sy, 2); if (!n) return null; [sx, sy] = n }
  const start = sy * w + sx, goal = ty * w + tx
  if (start === goal) return [[tx, ty]]
  const g = new Map<number, number>([[start, 0]])
  const from = new Map<number, number>()
  const open: [number, number][] = [[start, 0]] // tas binaire (nœud, f)
  const h = (i: number) => { const x = i % w, y = (i / w) | 0; const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy) }
  const push = (n: number, f: number) => { open.push([n, f]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][1] <= open[i][1]) break; [open[p], open[i]] = [open[i], open[p]]; i = p } }
  const pop = () => { const top = open[0]; const last = open.pop()!; if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < open.length && open[l][1] < open[s][1]) s = l; if (r < open.length && open[r][1] < open[s][1]) s = r; if (s === i) break; [open[s], open[i]] = [open[i], open[s]]; i = s } } return top }
  let n = 0
  while (open.length && n++ < maxNodes) {
    const [cur] = pop()
    if (cur === goal) {
      const out: [number, number][] = []
      let c: number | undefined = cur
      while (c !== undefined && c !== start) { out.push([c % w, (c / w) | 0]); c = from.get(c) }
      return out.reverse()
    }
    const cx = cur % w, cy = (cur / w) | 0, gc = g.get(cur)!
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = cx + dx, ny = cy + dy
      if (!free(nx, ny)) continue
      if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue
      const ni = ny * w + nx, ng = gc + (dx && dy ? 1.41 : 1)
      if (ng < (g.get(ni) ?? Infinity)) { g.set(ni, ng); from.set(ni, cur); push(ni, ng + h(ni)) }
    }
  }
  return null
}
