// Le continent d'Ossara (400 × 400 tuiles), généré par graine : le serveur et le client calculent exactement
// la même carte. Le générateur lit les régions décrites en données (shared/regions/*.ts) et le relief
// (côte, falaises et cols des plateaux, rivières, gués), puis pose par-dessus le contenu fait à la main :
// Port-Ancre sur la côte sud, les postes, les villages, l'épave de la Constance, la Gueule du nid,
// les stations du monorail et les passages vers les autres cartes.
import { TILE, MAP_W, MAP_H, CITY, HAUTS_X } from './consts.ts'
import { T, D, rng, bruit, isSolidTile, blocksShots } from './tiles.ts'
import { REGIONS, REGION_BY_ID, LIEUX, LIEU_BY_ID, regionIdAt, decaleLieu, lieuAt as lieuDefAt, type LieuDef } from './regions/index.ts'
export { decaleLieu } from './regions/index.ts'
import { COTE, COTE2, ISTHME, COLS, RIVIERES, GUES } from './regions/relief.ts'
import { BATIMENTS } from './batiments.ts'
import { ENDROITS } from './journaux.ts'
import { PASSAGES, STATIONS, type CarteId, type Passage, type Station } from './monde.ts'
import { RUCHES } from './front.ts'
import type { CarteZone } from './front.ts'

export { T, D, DECO_MAX, rng, isSolidTile, blocksShots } from './tiles.ts'

export interface Point { x: number; y: number }
export type Toit = 'tuile' | 'tole' | 'chaume' | 'organique' | 'toile'
export interface Building { id: string; nom: string; x: number; y: number; w: number; h: number; porte: Point; toit: Toit; fenetres: Point[]; cheminee?: Point; lieu: string }
export interface ZoneDef { id: string; nom: string; niveau: [number, number]; couleur: string; centre: [number, number] }
export interface Poi { id: string; nom: string; x: number; y: number; r: number; type: 'lieu' | 'ville' }
export interface Camp { id: string; zone: string; x: number; y: number; kinds: number[]; niveau: number; n: number }
export interface Noeud { id: string; type: 'herbe' | 'noyau' | 'pieces' | 'champignon' | 'echantillon'; x: number; y: number }
export interface Panne { id: string; type: 'lampe' | 'balise'; x: number; y: number }
export interface Arbre { x: number; y: number; v: number }
export interface Lieu { id: string; nom: string; x0: number; y0: number; x1: number; y1: number }
export interface Monde {
  zones: ZoneDef[]; batiments: Building[]; pois: Poi[]; camps: Camp[]; noeuds: Noeud[]; pannes: Panne[]; arbres: Arbre[]
  lieux: Lieu[]; lampes: Point[]; boss: Point | null
}
export interface GameMap {
  w: number; h: number
  tiles: Uint8Array
  deco: Uint8Array
  /** quelle carte du graphe du monde, et comment s'y lit la zone (ruches, nid, abri) */
  carte: CarteId | 'concession'
  zoneCarte: CarteZone
  points: { spawn: Point; atelier: Point; porte: Point; tableau: Point; nid: Point; nidCentre: Point }
  passages: Passage[]
  stations: Station[]
  monde?: Monde
}

export function tileAt(m: { w: number; h: number; tiles: Uint8Array }, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return T.ROC
  return m.tiles[ty * m.w + tx]
}
export function solidAtPx(m: { w: number; h: number; tiles: Uint8Array }, x: number, y: number) {
  return isSolidTile(tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)))
}
export function shotBlockedAtPx(m: { w: number; h: number; tiles: Uint8Array }, x: number, y: number) {
  return blocksShots(tileAt(m, Math.floor(x / TILE), Math.floor(y / TILE)))
}

/** Ligne de vue entre deux points (pas d'un demi-tuile) : seuls les obstacles qui arrêtent les tirs comptent. */
export function lineOfSight(m: { w: number; h: number; tiles: Uint8Array }, x0: number, y0: number, x1: number, y1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.ceil(d / (TILE / 2))
  for (let i = 1; i < n; i++) {
    const k = i / n
    if (shotBlockedAtPx(m, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) return false
  }
  return true
}

// ------------------------------------------------------------------ les régions
export const ZONES: ZoneDef[] = REGIONS.map((r) => ({ id: r.id, nom: r.nom, niveau: r.niveau, couleur: r.couleur, centre: r.centre }))
export function zoneIdAt(tx: number, ty: number) { return regionIdAt(tx, ty) }
export function zoneDef(id: string) { return ZONES.find((z) => z.id === id)! }
export const LIEUX_LISTE: Lieu[] = LIEUX
export function lieuAt(tx: number, ty: number): Lieu | null { return lieuDefAt(tx, ty) }

/** Est-ce de la terre (et pas la mer) ? Calcul sans état : la côte est la même partout. */
export function terreAt(tx: number, ty: number) {
  const n = (bruit(tx, ty, 17, 3) - 0.5) * 2 * COTE.bruit + (bruit(tx, ty, 5, 4) - 0.5) * 3
  const dx = Math.abs(tx - COTE.cx) / (COTE.rx + n), dy = Math.abs(ty - COTE.cy) / (COTE.ry + n)
  if (dx ** COTE.puissance + dy ** COTE.puissance < 1) return true
  if (tx < 300) return false
  // les Hauts de Glane, et l'isthme qui y mène
  const n2 = (bruit(tx, ty, 17, 13) - 0.5) * 2 * COTE2.bruit + (bruit(tx, ty, 5, 14) - 0.5) * 3
  const ex = Math.abs(tx - COTE2.cx) / (COTE2.rx + n2), ey = Math.abs(ty - COTE2.cy) / (COTE2.ry + n2)
  if (ex ** COTE2.puissance + ey ** COTE2.puissance < 1) return true
  const I = ISTHME, sx = I.x1 - I.x0, sy = I.y1 - I.y0
  const k = Math.max(0, Math.min(1, ((tx - I.x0) * sx + (ty - I.y0) * sy) / (sx * sx + sy * sy)))
  return Math.hypot(tx - I.x0 - sx * k, ty - I.y0 - sy * k) < I.demi + (bruit(tx, ty, 7, 15) - 0.5) * 5
}


// ------------------------------------------------------------------ chemins des routes (A* pondéré)
function cheminRoute(w: number, h: number, cout: (x: number, y: number) => number, sx: number, sy: number, tx: number, ty: number): [number, number][] {
  const N = w * h
  const g = new Float64Array(N).fill(Infinity)
  const ferme = new Uint8Array(N)
  const from = new Int32Array(N).fill(-1)
  const heap: number[] = [], hf: number[] = []
  const push = (i: number, f: number) => {
    heap.push(i); hf.push(f)
    let k = heap.length - 1
    while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break;[heap[p], heap[k]] = [heap[k], heap[p]];[hf[p], hf[k]] = [hf[k], hf[p]]; k = p }
  }
  const pop = () => {
    const top = heap[0]
    const li = heap.pop()!, lf = hf.pop()!
    if (heap.length) {
      heap[0] = li; hf[0] = lf
      let k = 0
      for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && hf[a] < hf[m]) m = a; if (b < heap.length && hf[b] < hf[m]) m = b; if (m === k) break;[heap[m], heap[k]] = [heap[k], heap[m]];[hf[m], hf[k]] = [hf[k], hf[m]]; k = m }
    }
    return top
  }
  const s = sy * w + sx, goal = ty * w + tx
  g[s] = 0; push(s, 0)
  while (heap.length) {
    const i = pop()
    if (ferme[i]) continue
    ferme[i] = 1
    if (i === goal) break
    const x = i % w, y = (i / w) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue
      const j = ny * w + nx
      const c = cout(nx, ny)
      if (!Number.isFinite(c)) continue
      const ng = g[i] + c
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + (Math.abs(tx - nx) + Math.abs(ty - ny))) }
    }
  }
  const out: [number, number][] = []
  if (from[goal] < 0 && goal !== s) return out
  for (let i = goal; i >= 0; i = from[i]) { out.push([i % w, (i / w) | 0]); if (i === s) break }
  return out.reverse()
}

// ------------------------------------------------------------------ la génération du continent
export function generateWorld(seed: number): GameMap {
  const w = MAP_W, h = MAP_H
  const R = rng(seed)
  const tiles = new Uint8Array(w * h)
  const deco = new Uint8Array(w * h)
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t }
  const get = (x: number, y: number) => tileAt({ w, h, tiles }, x, y)
  const setD = (x: number, y: number, d: number) => { if (x >= 0 && y >= 0 && x < w && y < h) deco[y * w + x] = d }
  const arbres: Arbre[] = []
  const lampes: Point[] = []
  const lampe = (x: number, y: number) => { if (!isSolidTile(get(x, y))) { setD(x, y, D.LAMPE); lampes.push({ x: x * TILE + 8, y: y * TILE + 3 }) } }

  // 1. La terre et la mer, et la région de chaque tuile.
  const reg = new Uint8Array(w * h)
  const terre = new Uint8Array(w * h)
  const ridx: Record<string, number> = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    terre[i] = terreAt(x, y) ? 1 : 0
    reg[i] = ridx[regionIdAt(x, y)]
  }
  // les lieux habités sont toujours sur la terre ferme
  for (const l of LIEUX) for (let y = l.y0 - 3; y <= l.y1 + 3; y++) for (let x = l.x0 - 3; x <= l.x1 + 3; x++) if (x >= 0 && y >= 0 && x < w && y < h) terre[y * w + x] = 1
  const rg = (x: number, y: number) => REGIONS[reg[y * w + x]]
  const solDe = (x: number, y: number) => rg(x, y).sol

  // 2. Le sol de chaque région, et des amas (roche, eau, épaves, chair) par bruit à deux octaves.
  const grid = (step: number) => {
    const gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2
    const gr = new Float32Array(gw * gh)
    for (let i = 0; i < gr.length; i++) gr[i] = R()
    return (x: number, y: number) => {
      const fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy)
      const sx = fx - ix, sy = fy - iy, ux = sx * sx * (3 - 2 * sx), uy = sy * sy * (3 - 2 * sy)
      const v = (a: number, b: number) => gr[(iy + b) * gw + ix + a]
      return (v(0, 0) * (1 - ux) + v(1, 0) * ux) * (1 - uy) + (v(0, 1) * (1 - ux) + v(1, 1) * ux) * uy
    }
  }
  const n1 = grid(9), n2 = grid(4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (!terre[i]) { tiles[i] = T.MER; continue }
    const r = rg(x, y)
    let t: number = r.sol
    if (n1(x, y) * 0.7 + n2(x, y) * 0.3 > r.seuil) t = r.amas
    else for (const [vt, p] of r.variantes ?? []) if (R() < p) { t = vt; break }
    tiles[i] = t
  }
  // la plage : du sable le long de la mer
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    if (!terre[i]) continue
    let mer = false
    for (let dy = -2; dy <= 2 && !mer; dy++) for (let dx = -2; dx <= 2; dx++) if (!terre[(y + dy) * w + x + dx]) { mer = true; break }
    if (mer) tiles[i] = T.SABLE
  }
  // berges : l'eau entourée de boue peu profonde
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (get(x, y) === T.BOUE) {
    let eau = 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y + dy) === T.EAU) eau++
    if (eau && R() < 0.5) set(x, y, T.MARE)
  }

  // 3. Les falaises : les plateaux sont ceinturés, on n'y monte que par les cols.
  const plat = ridx.plateaux
  const auCol = (x: number, y: number, marge = 0) => COLS.some((c) => Math.hypot(x - c.x, y - c.y) <= c.r + marge)
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    if (!terre[i]) continue
    const dedans = reg[i] === plat
    let bord = false
    for (let dy = -1; dy <= 1 && !bord; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = (y + dy) * w + x + dx
      if (terre[j] && (reg[j] === plat) !== dedans && (dedans || Math.abs(dx) + Math.abs(dy) === 1)) { bord = true; break }
    }
    if (!bord) continue
    tiles[i] = auCol(x, y) ? T.SOL : T.FALAISE
  }
  for (const c of COLS) for (let dy = -c.r; dy <= c.r; dy++) for (let dx = -c.r; dx <= c.r; dx++) {
    const x = c.x + dx, y = c.y + dy
    if (Math.hypot(dx, dy) <= c.r && terre[y * w + x] && isSolidTile(get(x, y))) set(x, y, T.SOL)
  }

  // 4. Les rivières : des plateaux à la mer, plus larges vers l'embouchure. Les gués : des hauts-fonds.
  for (const rv of RIVIERES) {
    for (let k = 0; k < rv.points.length - 1; k++) {
      const [ax, ay] = rv.points[k], [bx, by] = rv.points[k + 1]
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2)
      for (let s = 0; s <= n; s++) {
        const f = s / n
        const wob = (bruit(ax + f * (bx - ax), ay + f * (by - ay), 11, 21) - 0.5) * 8
        const cx = ax + (bx - ax) * f + wob, cy = ay + (by - ay) * f
        const larg = rv.largeur + (k / rv.points.length) * 1.2
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const x = Math.round(cx + dx), y = Math.round(cy + dy)
          if (x < 0 || y < 0 || x >= w || y >= h || !terre[y * w + x]) continue
          const d = Math.hypot(dx, dy)
          if (d <= larg * 0.75) set(x, y, T.EAU)
          else if (d <= larg * 0.75 + 1.2 && !isSolidTile(get(x, y)) && get(x, y) !== T.EAU) set(x, y, rg(x, y).id === 'plateaux' ? T.SOL : T.MARE)
        }
      }
    }
  }
  for (const g of GUES) for (let dy = -4; dy <= 4; dy++) for (let dx = -2; dx <= 2; dx++) if (get(g.x + dx, g.y + dy) === T.EAU || get(g.x + dx, g.y + dy) === T.MARE) set(g.x + dx, g.y + dy, T.GUE)

  // 5. Arbres : des fougères géantes en forêt, quelques arbres dans les plaines, des troncs morts au marais, des tiges d'ÉDEN.
  for (let y = 2; y < h - 3; y++) for (let x = 2; x < w - 2; x++) {
    const r = rg(x, y)
    if (R() >= r.arbres) continue
    if (tiles[y * w + x] !== r.sol) continue
    let ok = true
    for (const a of arbres.slice(-80)) if (Math.abs(a.x - x) < 3 && Math.abs(a.y - y) < 3) { ok = false; break }
    if (!ok) continue
    set(x, y, T.ARBRE)
    arbres.push({ x, y, v: r.arbreV[Math.floor(R() * r.arbreV.length)] })
  }

  // 6. Les carcasses du Cimetière, et des caisses et débris (abris) un peu partout hors des plaines.
  for (let i = 0; i < 90; i++) {
    const x = 6 + Math.floor(R() * 170), y = 6 + Math.floor(R() * 170)
    if (rg(x, y).id !== 'cimetiere') continue
    const ew = 2 + Math.floor(R() * 4), eh = 2 + Math.floor(R() * 2)
    for (let dy = 0; dy < eh; dy++) for (let dx = 0; dx < ew; dx++) if (rg(x + dx, y + dy).id === 'cimetiere' && terre[(y + dy) * w + x + dx] && get(x + dx, y + dy) !== T.FALAISE) set(x + dx, y + dy, R() < 0.85 ? T.EPAVE : T.METAL)
  }
  for (let i = 0; i < 420; i++) {
    const x = 4 + Math.floor(R() * (w - 8)), y = 4 + Math.floor(R() * (h - 8))
    const r = rg(x, y)
    if (r.id === 'plaines' && R() < 0.7) continue
    const hor = R() < 0.5, len = 2 + Math.floor(R() * 2)
    for (let k = 0; k < len; k++) { const cx = hor ? x + k : x, cy = hor ? y : y + k; if (tiles[cy * w + cx] === rg(cx, cy).sol) set(cx, cy, T.CAISSE) }
  }

  // 7. Les lieux : on les dégage, puis on les construit.
  const clear = (x0: number, y0: number, x1: number, y1: number, t: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { set(x, y, t); setD(x, y, 0) } }
  for (const l of LIEUX) clear(l.x0 - 2, l.y0 - 2, l.x1 + 2, l.y1 + 2, l.id === 'port' || l.id === 'anse' ? T.HERBE : solDe((l.x0 + l.x1) >> 1, (l.y0 + l.y1) >> 1))
  const L = LIEU_BY_ID
  const off = (id: string) => decaleLieu(id)

  // Port-Ancre : remparts, portes, pavés, place, fontaine (dessin d'origine décalé sur la côte sud).
  {
    const [ox, oy] = off('port')
    const P = (x: number, y: number, t: number) => set(x + ox, y + oy, t)
    const PD = (x: number, y: number, d: number) => setD(x + ox, y + oy, d)
    const c = { x0: CITY.x0 - ox, y0: CITY.y0 - oy, x1: CITY.x1 - ox, y1: CITY.y1 - oy }
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
      const bord = x <= c.x0 + 1 || x >= c.x1 - 1 || y <= c.y0 + 1 || y >= c.y1 - 1
      P(x, y, bord ? T.MURP : T.DALLE)
    }
    // portes : est (vers le marais), nord (vers les plateaux), sud (vers le port), et ouest (vers la ferme)
    for (let y = 98; y <= 101; y++) for (let x = c.x1 - 1; x <= c.x1; x++) P(x, y, T.PAVE)
    for (let y = 98; y <= 101; y++) for (let x = c.x0; x <= c.x0 + 1; x++) P(x, y, T.PAVE)
    for (let x = 38; x <= 41; x++) { P(x, c.y0, T.PAVE); P(x, c.y0 + 1, T.PAVE); P(x, c.y1, T.PAVE); P(x, c.y1 - 1, T.PAVE) }
    for (let x = c.x0 + 2; x <= c.x1 - 2; x++) for (let y = 98; y <= 101; y++) P(x, y, T.PAVE)
    for (let y = c.y0 + 2; y <= c.y1 - 2; y++) for (let x = 38; x <= 41; x++) P(x, y, T.PAVE)
    for (let x = c.x0 + 2; x <= c.x1 - 2; x++) for (let y = 87; y <= 88; y++) P(x, y, T.PAVE)
    for (let y = 90; y <= 109; y++) for (let x = 30; x <= 49; x++) P(x, y, T.PAVE)
    for (const [x, y] of [[34, 93], [35, 93], [34, 94], [35, 94]]) { P(x, y, T.MEUBLE); PD(x, y, D.M_FONTAINE) }
    P(44, 93, T.MEUBLE); PD(44, 93, D.M_TABLEAU); P(45, 93, T.MEUBLE); PD(45, 93, D.M_TABLEAU)
    P(44, 106, T.MEUBLE); PD(44, 106, D.M_ARCHE); P(46, 106, T.MEUBLE); PD(46, 106, D.M_ARCHE)
    for (const x of [31, 33]) { P(x, 107, T.MEUBLE); PD(x, 107, D.M_ETAL) }
    for (const x of [47, 48]) { P(x, 96, T.MEUBLE); PD(x, 96, D.M_ETAL) }
    for (const [x, y] of [[31, 91], [48, 91], [31, 108], [48, 108], [37, 97], [42, 97], [37, 102], [42, 102], [12, 97], [26, 97], [54, 97], [66, 97], [12, 102], [26, 102], [54, 102], [66, 102], [37, 80], [42, 80], [37, 120], [42, 120]]) lampe(x + ox, y + oy)
    for (const [x, y] of [[33, 100], [46, 100], [35, 109], [44, 90]]) { P(x, y, T.MEUBLE); PD(x, y, D.M_BANC) }
    for (let y = 114; y <= 121; y++) for (let x = 19; x <= 25; x++) P(x, y, (y % 2) ? T.CHAMP : T.SOL)
    for (let y = 114; y <= 121; y++) for (let x = 51; x <= 58; x++) P(x, y, (y % 2) ? T.CHAMP : T.SOL)
    for (let y = 90; y <= 96; y++) for (let x = 27; x <= 28; x++) P(x, y, T.HERBE)
    // le quai : de la porte sud à la mer, puis une jetée de planches
    const qx0 = 38 + ox, qx1 = 41 + ox
    let y = CITY.y1 + 1
    for (; y < h - 2 && terre[y * w + qx0]; y++) for (let x = qx0; x <= qx1; x++) set(x, y, T.PAVE)
    for (let k = 0; k < 7; k++, y++) for (let x = qx0; x <= qx1; x++) set(x, y, T.PLANCHER)
    for (let x = qx0 - 4; x <= qx1 + 4; x++) set(x, y, T.PLANCHER)
    lampe(qx0 - 1, CITY.y1 + 3); lampe(qx1 + 1, CITY.y1 + 3)
  }
  // la ferme : champs clôturés
  {
    const [ox, oy] = off('ferme')
    for (let y = 88; y <= 95; y++) for (let x = 80; x <= 104; x++) set(x + ox, y + oy, (y % 2) ? T.CHAMP : T.SOL)
    for (let x = 79; x <= 105; x++) if (x < 90 || x > 92) { set(x + ox, 87 + oy, T.CLOTURE); set(x + ox, 96 + oy, T.CLOTURE) }
    for (let y = 87; y <= 96; y++) { set(79 + ox, y + oy, T.CLOTURE); set(105 + ox, y + oy, T.CLOTURE) }
  }
  // enceintes des postes : palissades avec des ouvertures
  const enceinte = (l: LieuDef, t: number, ouvertures: [number, number][], decale = true) => {
    const [ox, oy] = decale ? off(l.id) : [0, 0]
    for (let x = l.x0; x <= l.x1; x++) { set(x, l.y0, t); set(x, l.y1, t) }
    for (let y = l.y0; y <= l.y1; y++) { set(l.x0, y, t); set(l.x1, y, t) }
    for (const [x, y] of ouvertures) set(x + ox, y + oy, solDe(x + ox, y + oy))
  }
  enceinte(L.fougere, T.PALISSADE, [[146, 59], [146, 60], [146, 61], [168, 59], [168, 60], [157, 68], [158, 68]])
  enceinte(L.postemarais, T.PALISSADE, [[221, 124], [221, 125], [238, 124], [238, 125], [229, 131], [230, 131]])
  // Haute-Sève : des racines vivantes en guise de murs, des champignons qui luisent
  {
    const l = L.hauteseve, [ox, oy] = off('hauteseve')
    for (let x = l.x0; x <= l.x1; x++) for (const y of [l.y0, l.y1]) if (R() < 0.8 && Math.abs(x - (179 + ox)) > 2) set(x, y, T.RACINE)
    for (let y = l.y0; y <= l.y1; y++) for (const x of [l.x0, l.x1]) if (R() < 0.8 && Math.abs(y - (149 + oy)) > 2) set(x, y, T.RACINE)
    for (let i = 0; i < 26; i++) { const x = l.x0 + 1 + Math.floor(R() * 24), y = l.y0 + 1 + Math.floor(R() * 20); if (get(x, y) === T.MOUSSE) setD(x, y, D.CHAMPI) }
  }
  // La Casse : un mur d'épaves
  {
    const l = L.casse, [ox, oy] = off('casse')
    for (let x = l.x0; x <= l.x1; x++) for (const y of [l.y0, l.y1]) if (Math.abs(x - (273 + ox)) > 2) set(x, y, R() < 0.6 ? T.EPAVE : T.METAL)
    for (let y = l.y0; y <= l.y1; y++) for (const x of [l.x0, l.x1]) if (Math.abs(y - (40 + oy)) > 2) set(x, y, R() < 0.6 ? T.EPAVE : T.METAL)
    for (const [x, y] of [[272, 45], [276, 45], [284, 31]]) { set(x + ox, y + oy, T.MEUBLE); setD(x + ox, y + oy, D.M_ETAL) }
  }
  // Les ruines de la Première Vague : des murs de métal effondrés, la carcasse d'une navette
  {
    const l = L.ruines, [ox, oy] = off('ruines')
    for (let x = l.x0; x <= l.x1; x++) for (const y of [l.y0, l.y1]) if (R() < 0.55) set(x, y, T.METAL)
    for (let y = l.y0; y <= l.y1; y++) for (const x of [l.x0, l.x1]) if (R() < 0.55) set(x, y, T.METAL)
    for (let y = 136; y <= 141; y++) for (let x = 328; x <= 340; x++) if ((x - 334) ** 2 / 40 + (y - 138.5) ** 2 / 7 < 1) set(x + ox, y + oy, T.EPAVE)
    for (let x = 326; x <= 342; x += 4) for (let y = 145; y <= 147; y++) if (R() < 0.7) set(x + ox, y + oy, T.METAL)
  }
  // Anse-Grise : une plage, une jetée, des barques tirées sur le sable
  {
    const l = L.anse
    for (let y = l.y0; y <= l.y1; y++) for (let x = l.x0; x <= l.x1; x++) if (y > 342) set(x, y, T.SABLE)
    for (let y = 343; y < h - 2 && (terre[y * w + 250] || y < 352); y++) set(250, y, T.PLANCHER), set(251, y, T.PLANCHER)
    for (let k = 0; k < 6; k++) { set(250, 352 + k, T.PLANCHER); set(251, 352 + k, T.PLANCHER) }
    for (const [x, y] of [[242, 345], [245, 346], [256, 345]]) { set(x, y, T.MEUBLE); setD(x, y, D.M_TONNEAU) }
    lampe(239, 343); lampe(261, 343)
  }
  // Relais du Col : une palissade, ouverte au nord (les plateaux) et au sud (Port-Ancre)
  enceinte(L.relais, T.PALISSADE, [[199, 207], [200, 207], [201, 207], [199, 221], [200, 221], [201, 221], [210, 216], [210, 217]], false)
  lampe(191, 208); lampe(209, 208); lampe(191, 220); lampe(209, 220)
  // La Mine : la bouche du puits dans la roche, des rails, des wagonnets
  {
    const l = L.mine
    for (let x = l.x0; x <= l.x1; x++) for (let y = l.y0; y <= l.y0 + 4; y++) set(x, y, T.ROC)
    for (let x = 147; x <= 151; x++) for (let y = l.y0 + 2; y <= l.y0 + 4; y++) set(x, y, T.SOL)
    for (let y = l.y0 + 5; y <= l.y1; y++) setD(149, y, D.FISSURE)
    for (const [x, y] of [[147, 136], [151, 136]]) { set(x, y, T.MEUBLE); setD(x, y, D.M_CAISSES) }
    lampe(146, 135); lampe(152, 135)
  }
  // Bastion de la Colonie : un mur de pierre, deux portes, des tours de guet
  {
    const l = L.bastion
    for (let x = l.x0; x <= l.x1; x++) for (const y of [l.y0, l.y1]) set(x, y, T.MURP)
    for (let y = l.y0; y <= l.y1; y++) for (const x of [l.x0, l.x1]) set(x, y, T.MURP)
    for (const [x, y] of [[265, 170], [266, 170], [267, 170], [265, 152], [266, 152], [267, 152], [256, 164], [256, 165], [277, 164], [277, 165]]) set(x, y, T.PAVE)
    for (let y = l.y0 + 1; y < l.y1; y++) for (let x = l.x0 + 1; x < l.x1; x++) if (get(x, y) !== T.MURP) set(x, y, T.DALLE)
    for (const [x, y] of [[258, 154], [275, 154], [258, 168], [275, 168]]) lampe(x, y)
  }
  // Camp de l'Épave : des tentes, un feu, des pièces triées
  {
    for (const [x, y] of [[93, 110], [96, 112]]) { set(x, y, T.MEUBLE); setD(x, y, D.M_CAISSES) }
    lampe(88, 108); lampe(104, 108)
  }
  // L'épave de la Constance : la coque couchée, un sas au sud
  {
    for (let y = 66; y <= 94; y++) for (let x = 52; x <= 110; x++) {
      const k = ((x - 80) / 27) ** 2 + ((y - 80) / 10) ** 2
      // la coque rouillée, et les membrures de métal qui la tiennent encore
      if (k < 1) set(x, y, k < 0.72 && (x % 6 === 0 || y === 80) ? T.METAL : T.EPAVE)
    }
    // l'aileron arraché, la tuyère
    for (let y = 70; y <= 74; y++) for (let x = 104; x <= 112; x++) if (R() < 0.75) set(x, y, T.METAL)
    for (let y = 77; y <= 83; y++) for (let x = 48; x <= 53; x++) set(x, y, T.EPAVE)
  }
  // la Gueule du nid : un anneau de chair autour de l'entrée, au cœur de la Grande Ruche
  {
    const l = L.gueule
    for (let y = l.y0; y <= l.y1; y++) for (let x = l.x0; x <= l.x1; x++) {
      const d = Math.hypot(x - 330, y - 72)
      if (d < 8) set(x, y, d > 6.4 && !(Math.abs(x - 330) <= 1 && y > 72) ? T.CHAIR : T.NIDSOL)
      else if (d < 9.5) set(x, y, T.CHAIRSOL)
    }
  }
  // lanternes des postes
  const lanternes: [string, [number, number][]][] = [
    ['fougere', [[147, 51], [167, 51], [147, 67], [167, 67]]], ['postemarais', [[222, 117], [237, 117], [222, 130], [237, 130]]],
    ['casse', [[262, 29], [285, 29], [262, 48], [285, 48]]], ['hauteseve', [[170, 141], [189, 141], [170, 157], [189, 157]]],
  ]
  for (const [id, pts] of lanternes) { const [ox, oy] = off(id); for (const [x, y] of pts) lampe(x + ox, y + oy) }

  // ---- campagne 2 : les Hauts de Glane (coordonnées du continent, pas de décalage)
  // Relâche : une palissade de tôles, deux rues pavées en croix, une petite place, un quai de planches sur le détroit
  {
    const l = L.relache
    enceinte(l, T.PALISSADE, [[458, 276], [458, 277], [476, 262], [477, 262], [494, 276], [494, 277], [476, 292], [477, 292]], false)
    for (let x = l.x0; x <= l.x1; x++) for (let y = 276; y <= 277; y++) set(x, y, T.PAVE)
    for (let y = l.y0; y <= l.y1; y++) for (let x = 476; x <= 477; x++) set(x, y, T.PAVE)
    for (let y = 273; y <= 279; y++) for (let x = 473; x <= 480; x++) set(x, y, T.PAVE)
    for (const [x, y, d] of [[473, 273, D.M_ETAL], [480, 273, D.M_ETAL], [473, 279, D.M_BANC], [480, 279, D.M_TONNEAU], [474, 279, D.M_CAISSES]] as const) { set(x, y, T.MEUBLE); setD(x, y, d) }
    // le quai : des planches de la porte ouest jusqu'en eau profonde, des bittes d'amarrage (tonneaux)
    for (let y = 276; y <= 281; y++) for (let x = 442; x <= 457; x++) if (y <= 277 || x <= 456) set(x, y, T.PLANCHER)
    for (const [x, y] of [[443, 281], [449, 281]]) { set(x, y, T.MEUBLE); setD(x, y, D.M_TONNEAU) }
    for (const [x, y] of [[460, 275], [460, 278], [472, 275], [481, 278], [492, 275], [492, 278], [475, 264], [478, 264], [475, 290], [478, 290], [444, 276], [450, 276]]) lampe(x, y)
  }
  // le Gué de Glane : la palissade du Corps, ouverte sur l'isthme, la lande et la halte
  enceinte(L.gue_glane, T.PALISSADE, [[438, 99], [438, 100], [458, 99], [458, 100], [448, 108], [449, 108]], false)
  for (const [x, y] of [[440, 98], [440, 101], [456, 98], [456, 101], [447, 106], [450, 106]]) lampe(x, y)
  // le Sillon : des tonneaux et des caisses en demi-cercle, des lanternes
  {
    const l = L.sillon
    for (let x = l.x0; x <= l.x1; x += 2) if (x < 525 || x > 529) { set(x, l.y0 - 1, T.CAISSE) }
    for (const [x, y] of [[520, 205], [534, 205], [521, 207]]) { set(x, y, T.MEUBLE); setD(x, y, D.M_TONNEAU) }
    for (const [x, y] of [[521, 203], [533, 203], [526, 208], [529, 208]]) lampe(x, y)
  }
  // les Champs de Fer : des robots éteints alignés en sillons (des allées tous les 14 tuiles pour passer)
  for (let y = 128; y <= 196; y += 5) for (let x = 492; x <= 624; x += 2) {
    if (rg(x, y).id !== 'champs' || !terre[y * w + x] || lieuDefAt(x, y) || (x % 14) < 3 || R() < 0.18) continue
    set(x, y, R() < 0.7 ? T.METAL : T.EPAVE)
  }
  // le mât gravé : une clairière sur la crête, le vieux mât au milieu (on lit son cœur de données au pied)
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) <= 3.2 && terre[(46 + dy) * w + 520 + dx]) set(520 + dx, 46 + dy, T.SOL)
  set(520, 45, T.METAL)
  // le robot assis (un clin d'œil) : une clairière ronde, un seul robot au milieu
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.hypot(dx, dy) <= 3 && terre[(176 + dy) * w + 506 + dx]) set(506 + dx, 176 + dy, T.SOL)
  set(506, 176, T.METAL)
  // les Serres : une armature de verre (clôture), des rangées de pots (champs), des racines qui ont percé
  {
    const l = L.serres
    enceinte(l, T.CLOTURE, [[586, 252], [586, 253], [596, 260], [597, 260], [606, 252]], false)
    for (let y = l.y0 + 2; y < l.y1 - 1; y += 3) for (let x = l.x0 + 2; x <= l.x1 - 2; x++) if (x !== 596 && x !== 597) set(x, y, T.CHAMP)
    for (const [x, y] of [[590, 247], [602, 255], [599, 249]]) set(x, y, T.RACINE)
  }
  // le Mât de relais : un pied de métal, des haubans, la base d'une antenne de la Première Vague
  {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(548 + dx, 77 + dy, T.METAL)
    for (const [dx, dy] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) set(548 + dx, 77 + dy, T.METAL)
    for (const [x, y] of [[543, 72], [553, 72], [543, 82], [553, 82]]) lampe(x, y)
  }
  // le Métier, vu de loin : des arches de métal où pendent des robots (on n'y entre que par le raid)
  for (let k = 0; k < 5; k++) for (let a = 0; a <= 12; a++) {
    const x = 556 + k * 4, y = 30 + Math.round(Math.abs(a - 6) * 0.9)
    if (terre[y * w + x] && !lieuDefAt(x, y)) set(x, y + (a % 4 === 0 ? 0 : 0), a % 3 === 0 ? T.EPAVE : T.METAL)
  }

  // 8. Les bâtiments : murs, porte, plancher, meubles.
  const batiments: Building[] = []
  for (const b0 of BATIMENTS) {
    const [ox, oy] = off(b0.lieu)
    const b = { ...b0, x: b0.x + ox, y: b0.y + oy, porte: { x: b0.porte.x + ox, y: b0.porte.y + oy }, cheminee: b0.cheminee && { x: b0.cheminee.x + ox, y: b0.cheminee.y + oy } }
    // rien ne pousse dans une maison ni contre ses murs (un arbre posé avant le bâtiment y resterait dessiné)
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (get(x, y) === T.ARBRE) set(x, y, solDe(x, y))
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const bord = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1
      set(x, y, bord ? T.MURB : T.PLANCHER); setD(x, y, 0)
    }
    set(b.porte.x, b.porte.y, T.PLANCHER)
    const dy = b.porte.y === b.y ? -1 : 1
    for (let k = 1; k <= 2; k++) for (const dx of [-1, 0, 1]) { const t = get(b.porte.x + dx, b.porte.y + dy * k); if (isSolidTile(t) && t !== T.MURB && t !== T.MURP) set(b.porte.x + dx, b.porte.y + dy * k, t === T.MEUBLE ? T.DALLE : T.SOL) }
    for (const [x, y, d] of b0.meubles) { set(x + ox, y + oy, T.MEUBLE); setD(x + ox, y + oy, d) }
    batiments.push({ id: b.id, nom: b.nom, lieu: b.lieu, x: b.x, y: b.y, w: b.w, h: b.h, porte: b.porte, toit: b.toit, cheminee: b.cheminee, fenetres: (b0.fen ?? []).map((x) => ({ x: x + ox, y: b.y + b.h - 1 })) })
  }

  // 9. Les stations du monorail et les passages (sas) vers les autres cartes.
  const stations = STATIONS.map((s) => ({ ...s }))
  for (const s of stations) for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
    const t = get(s.x + dx, s.y + dy)
    if (t !== T.MURB && t !== T.MURP) { set(s.x + dx, s.y + dy, T.PAVE); setD(s.x + dx, s.y + dy, 0) }
  }
  // le quai (où l'on attend la rame, deux tuiles sous la gare) reste dégagé
  for (const s of stations) for (const dx of [-1, 0, 1]) { const t = get(s.x + dx, s.y + 2); if (isSolidTile(t) && t !== T.MURB && t !== T.MURP && t !== T.MER) set(s.x + dx, s.y + 2, solDe(s.x + dx, s.y + 2)) }
  const passages = PASSAGES.filter((p) => p.carte === 'ossara')
  for (const p of passages) {
    set(p.x, p.y, T.SAS)
    for (let k = 1; k <= 3; k++) { const x = p.x + Math.sign(p.sortie[0]) * k, y = p.y + Math.sign(p.sortie[1]) * k; if (isSolidTile(get(x, y))) set(x, y, solDe(x, y) === T.CHAIRSOL ? T.CHAIRSOL : T.SOL) }
  }

  // 10. Les routes : chemins les moins coûteux (falaises et mer interdites, hors des cols ; un pont sur l'eau).
  const passable = (x: number, y: number) => {
    const t = get(x, y), i = y * w + x
    if (!terre[i] || t === T.MER) return Infinity
    if (t === T.FALAISE) return auCol(x, y, 2) ? 3 : Infinity
    if (t === T.MURB || t === T.MURP || t === T.PALISSADE || t === T.RACINE || t === T.CLOTURE || t === T.MEUBLE || t === T.SCELLE || t === T.CHAIR) return Infinity
    const l = lieuDefAt(x, y)
    if (l && l.habite && l.id !== 'port') return 6
    if (t === T.EAU) return 7
    if (t === T.ROUTE || t === T.PONT || t === T.PAVE || t === T.GUE) return 0.6
    if (isSolidTile(t)) return 4
    return 1.6
  }
  const route = (a: [number, number], b: [number, number], larg = 1) => {
    const ch = cheminRoute(w, h, passable, a[0], a[1], b[0], b[1])
    for (const [x, y] of ch) for (let dy = -larg; dy <= larg; dy++) for (let dx = -larg; dx <= larg; dx++) {
      if (Math.abs(dx) === larg && Math.abs(dy) === larg) continue
      const xx = x + dx, yy = y + dy
      const t = get(xx, yy)
      const l = lieuDefAt(xx, yy)
      if (l && l.id !== 'gueule' && l.id !== 'epave') continue
      if (t === T.MURB || t === T.MURP || t === T.MEUBLE || t === T.NIDSOL || t === T.PALISSADE || t === T.CLOTURE || t === T.RACINE || t === T.MER || t === T.SAS || t === T.SCELLE || t === T.PAVE || t === T.GUE) continue
      if (t === T.FALAISE && !auCol(xx, yy, 2)) continue
      if (t === T.ARBRE) continue
      const z = rg(xx, yy).id
      set(xx, yy, t === T.EAU || t === T.PONT ? T.PONT : z === 'eden' ? T.CHAIRSOL : z === 'marais' && t === T.MARE ? T.BOUE : T.ROUTE)
      setD(xx, yy, 0)
    }
  }
  const pO = off('port')
  const porteEst: [number, number] = [CITY.x1 + 1, 99 + pO[1]], porteNord: [number, number] = [40 + pO[0], CITY.y0 - 1], porteOuest: [number, number] = [CITY.x0 - 1, 99 + pO[1]]
  const sud = (l: LieuDef): [number, number] => [(l.x0 + l.x1) >> 1, l.y1 + 3]
  const nord = (l: LieuDef): [number, number] => [(l.x0 + l.x1) >> 1, l.y0 - 3]
  const est = (l: LieuDef): [number, number] => [l.x1 + 3, (l.y0 + l.y1) >> 1]
  const ouest = (l: LieuDef): [number, number] => [l.x0 - 3, (l.y0 + l.y1) >> 1]
  route(porteOuest, est(L.ferme))
  route(nord(L.ferme), est(L.fougere))
  route(sud(L.fougere), nord(L.hauteseve))
  route(porteEst, ouest(L.postemarais))
  route(sud(L.postemarais), [348, 300])
  route(porteEst, nord(L.anse))
  route(porteNord, sud(L.relais))
  route(nord(L.relais), sud(L.ruines))
  route(nord(L.relais), est(L.mine))
  route(nord(L.mine), sud(L.casse))
  route(ouest(L.casse), est(L.campepave))
  route(nord(L.campepave), [84, 93])
  route(est(L.relais), ouest(L.bastion))
  route(est(L.bastion), nord(L.postemarais))
  route(nord(L.bastion), [330, 81])
  route(est(L.ruines), nord(L.bastion))
  route(ouest(L.fougere), [46, 124])
  route([150, 258], [CITY.x0 - 1, 290])
  // campagne 2 : l'isthme, puis les Hauts (des chemins qui serpentent : les routes contournent sillons et roches)
  route([330, 81], ouest(L.gue_glane))
  const lacets = (pts: [number, number][]) => { for (let i = 0; i + 1 < pts.length; i++) route(pts[i], pts[i + 1]) }
  lacets([[452, 112], [470, 140], [446, 176], [474, 212], [452, 242], nord(L.relache)])
  lacets([est(L.relache), [506, 262], [494, 232], ouest(L.sillon)])
  lacets([est(L.sillon), [556, 214], [548, 238], [572, 246], ouest(L.serres)])
  lacets([nord(L.sillon), [514, 170], [548, 146], [520, 118], [548, 90]])
  lacets([est(L.gue_glane), [482, 84], [506, 104], ouest(L.mat)])
  // les gares (la barge accoste au quai : pas de route à tracer depuis la mer)
  for (const s of stations) if (s.id !== 'st_port' && s.id !== 'st_anse' && s.id !== 'st_relache') { const l = L[s.lieu]; route([s.x, s.y + 2], sud(l)) }

  // 11. Ce qui n'est pas atteignable depuis Port-Ancre devient infranchissable.
  const spawn = { x: (39 + pO[0]) * TILE + 8, y: (104 + pO[1]) * TILE + 8 }
  const seen = new Uint8Array(w * h)
  const stack = [Math.floor(spawn.y / TILE) * w + Math.floor(spawn.x / TILE)]
  while (stack.length) {
    const i = stack.pop()!
    if (seen[i] || isSolidTile(tiles[i])) continue
    seen[i] = 1
    const x = i % w, y = (i / w) | 0
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1); if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w)
  }
  for (let i = 0; i < w * h; i++) if (!seen[i] && !isSolidTile(tiles[i])) {
    const x = i % w, y = (i / w) | 0
    const z = rg(x, y).id
    tiles[i] = !terre[i] || tiles[i] === T.SABLE ? T.MER : z === 'marais' ? T.EAU : z === 'eden' ? T.CHAIR : T.ROC
  }

  // 12. Le décor au sol.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (deco[i] || lieuDefAt(x, y)?.id === 'port') continue
    const t = tiles[i], r = R()
    if (t === T.HERBE) deco[i] = r < 0.06 ? D.TOUFFE : r < 0.09 ? D.FLEUR : r < 0.11 ? D.CAILLOUX : r < 0.115 ? D.BUISSON : 0
    else if (t === T.SOL) deco[i] = r < 0.07 ? D.CAILLOUX : r < 0.1 ? D.FISSURE : 0
    else if (t === T.SABLE) deco[i] = r < 0.03 ? D.CAILLOUX : r < 0.04 ? D.OS : 0
    else if (t === T.MOUSSE) deco[i] = r < 0.1 ? D.FOUGERE : r < 0.13 ? D.CHAMPI : r < 0.15 ? D.BUISSON : 0
    else if (t === T.BOUE || t === T.MARE) deco[i] = r < 0.1 ? D.ROSEAU : r < 0.12 ? D.OS : 0
    else if (t === T.FERRAILLE) deco[i] = r < 0.05 ? D.PNEU : r < 0.1 ? D.TUYAU : r < 0.13 ? D.OS : 0
    else if (t === T.CHAIRSOL) deco[i] = r < 0.08 ? D.VRILLE : r < 0.1 ? D.FLAQUE : r < 0.12 ? D.OS : 0
    else if (t === T.CHAMP) deco[i] = r < 0.6 ? D.PAILLE : 0
  }

  // 13. Ce qui vit dans le monde : camps de créatures, nœuds à ramasser, pannes à réparer.
  const free = (x: number, y: number) => x > 1 && y > 1 && x < w - 2 && y < h - 2 && !isSolidTile(get(x, y)) && !lieuDefAt(x, y) && seen[y * w + x] && get(x, y) !== T.SAS
  const pickIn = (zone: string, tries = 200): Point | null => {
    const r = REGION_BY_ID[zone]
    for (let k = 0; k < tries; k++) {
      const x = Math.round(r.centre[0] + (R() - 0.5) * 190), y = Math.round(r.centre[1] + (R() - 0.5) * 190)
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2 || rg(x, y).id !== zone) continue
      if (free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x - 1, y) && free(x, y - 1)) return { x, y }
    }
    return null
  }
  const port = { x: (CITY.x0 + CITY.x1) / 2, y: (CITY.y0 + CITY.y1) / 2 }
  const camps: Camp[] = []
  let ci = 0
  for (const r of REGIONS) for (const [kinds, nb, n] of r.camps) for (let k = 0; k < nb; k++) {
    const p = pickIn(r.id)
    if (!p) continue
    if (Math.hypot(p.x - port.x, p.y - port.y) < 52) continue // pas sous les murs
    if (Math.hypot(p.x - 476, p.y - 277) < 34 || Math.hypot(p.x - 448, p.y - 100) < 22) continue // ni sous ceux de Relâche et du Gué
    camps.push({ id: 'c' + ci++, zone: r.id, x: p.x * TILE + 8, y: p.y * TILE + 8, kinds, niveau: niveauAt(p.x, p.y), n })
  }
  const noeuds: Noeud[] = []
  let ni = 0
  for (const r of REGIONS) for (const [type, nb] of r.noeuds) for (let k = 0; k < nb; k++) { const p = pickIn(r.id); if (p) noeuds.push({ id: 'n' + ni++, type, x: p.x * TILE + 8, y: p.y * TILE + 8 }) }
  { const [ox, oy] = off('ruines'); for (const [x, y] of [[331, 133], [341, 147], [326, 143]]) noeuds.push({ id: 'n' + ni++, type: 'noyau', x: (x + ox) * TILE + 8, y: (y + oy) * TILE + 8 }) }
  for (const [x, y] of [[348, 120], [353, 124], [346, 126], [355, 118]]) noeuds.push({ id: 'n' + ni++, type: 'echantillon', x: x * TILE + 8, y: y * TILE + 8 })
  for (const n of noeuds) { const tx = Math.floor(n.x / TILE), ty = Math.floor(n.y / TILE); if (isSolidTile(get(tx, ty))) set(tx, ty, solDe(tx, ty)) }
  const pm = off('postemarais')
  const pannes: Panne[] = [
    { id: 'p_lampe1', type: 'lampe', x: (74 + pO[0]) * TILE + 8, y: (96 + pO[1]) * TILE + 8 }, { id: 'p_lampe2', type: 'lampe', x: (74 + pO[0]) * TILE + 8, y: (103 + pO[1]) * TILE + 8 },
    { id: 'p_lampe3', type: 'lampe', x: (44 + pO[0]) * TILE + 8, y: (71 + pO[1]) * TILE + 8 },
    { id: 'p_balise1', type: 'balise', x: (214 + pm[0]) * TILE + 8, y: (108 + pm[1]) * TILE + 8 }, { id: 'p_balise2', type: 'balise', x: (248 + pm[0]) * TILE + 8, y: (136 + pm[1]) * TILE + 8 },
    { id: 'p_balise3', type: 'balise', x: (262 + pm[0]) * TILE + 8, y: (98 + pm[1]) * TILE + 8 },
  ]
  for (const p of pannes) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = get(tx + dx, ty + dy); if (isSolidTile(t) && t !== T.MURP) set(tx + dx, ty + dy, solDe(tx + dx, ty + dy)) }
  }
  // l'antre de l'Engloutisseur, dans le marais près de la côte : une clairière sur l'eau
  const boss = { x: 348 * TILE + 8, y: 312 * TILE + 8 }
  for (let y = 302; y <= 322; y++) for (let x = 336; x <= 360; x++) if ((x - 348) ** 2 / 110 + (y - 312) ** 2 / 70 < 1 && terre[y * w + x]) set(x, y, (x + y) % 7 ? T.BOUE : T.MARE)

  const pois: Poi[] = [
    ...LIEUX.map((l) => ({ id: l.id, nom: l.nom, x: ((l.x0 + l.x1) / 2) * TILE, y: ((l.y0 + l.y1) / 2) * TILE, r: Math.max(l.x1 - l.x0, l.y1 - l.y0) * TILE * 0.6, type: (l.id === 'port' ? 'ville' : 'lieu') as Poi['type'] })),
    ...REGIONS.flatMap((r) => r.pois.map((p) => ({ id: p.id, nom: p.nom, x: p.x * TILE, y: p.y * TILE, r: p.r * TILE, type: 'lieu' as const }))),
    // le nid est une carte à part : sur le continent, on vise sa Gueule
    { id: 'nid', nom: 'Le nid (par la Gueule)', x: 330 * TILE + 8, y: 76 * TILE + 8, r: 90, type: 'lieu' },
    ...RUCHES.map((r) => ({ id: r.id, nom: r.nom, x: r.x * TILE, y: r.y * TILE, r: 120, type: 'lieu' as const })),
  ]
  for (const p of pois.filter((q) => ['clairiere', 'source', 'tertre', 'champ_epaves', 'jardin'].includes(q.id))) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE)
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const t = get(tx + dx, ty + dy); if (isSolidTile(t) && t !== T.ARBRE && t !== T.MER) set(tx + dx, ty + dy, solDe(tx + dx, ty + dy)) }
  }
  // le Tertre : des stèles en rang
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) { const x = 147 + k * 2, y = 253 + j * 2; set(x, y, T.MEUBLE); setD(x, y, D.M_ARCHE) }
  // à l'écart, une tombe plus large que les autres (docs/histoire.md § 8) ; sur la place, la stèle des saisons
  set(156, 255, T.MEUBLE); setD(156, 255, D.M_ARCHE)
  set(201, 299, T.MEUBLE); setD(201, 299, D.M_ARCHE)
  // là où l'on lit, on peut se tenir
  for (const e of ENDROITS) if (e.carte === 'ossara' && isSolidTile(get(e.x, e.y))) { set(e.x, e.y, solDe(e.x, e.y)); setD(e.x, e.y, 0) }

  // la liste des arbres suit les tuiles : un arbre recouvert (bâtiment, route, nœud, passage) n'est plus dessiné
  for (let i = arbres.length - 1; i >= 0; i--) if (get(arbres[i].x, arbres[i].y) !== T.ARBRE) arbres.splice(i, 1)

  return {
    w, h, tiles, deco, carte: 'ossara', zoneCarte: 'continent', passages, stations,
    points: {
      spawn,
      atelier: { x: (56 + pO[0]) * TILE + 8, y: (84 + pO[1]) * TILE + 8 },
      porte: { x: (45 + pO[0]) * TILE + 8, y: (107 + pO[1]) * TILE + 8 },
      tableau: { x: (45 + pO[0]) * TILE, y: (94 + pO[1]) * TILE + 8 },
      nid: { x: 330 * TILE + 8, y: 76 * TILE + 8 },
      nidCentre: { x: 330 * TILE + 8, y: 72 * TILE + 8 },
    },
    monde: { zones: ZONES, batiments, pois, camps, noeuds, pannes, arbres, lieux: LIEUX, lampes, boss },
  }
}

/** Le niveau des créatures à une tuile : celui de sa région, plus haut en s'éloignant de Port-Ancre. */
export function niveauAt(tx: number, ty: number) {
  const z = zoneDef(zoneIdAt(Math.floor(tx), Math.floor(ty)))
  // dans les Hauts, on compte depuis Relâche
  const hauts = tx >= HAUTS_X
  const px = hauts ? 476 : (CITY.x0 + CITY.x1) / 2, py = hauts ? 277 : (CITY.y0 + CITY.y1) / 2
  const dc = Math.hypot(z.centre[0] - px, z.centre[1] - py)
  const k = Math.max(0, Math.min(1, 0.5 + (Math.hypot(tx - px, ty - py) - dc) / 120))
  return Math.round(z.niveau[0] + (z.niveau[1] - z.niveau[0]) * k)
}

/** Ancien nom : le secteur est maintenant le continent d'Ossara. */
export const generateSector = generateWorld
export const SECTOR_SEED = 41
