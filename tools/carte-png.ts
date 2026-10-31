// Dessine le continent en PNG (1 tuile = 2 px) pour vérifier la génération : terrain, ruches (bordure de la
// biomasse), lieux, gares du monorail, passages, camps, ressources, PNJ (et ceux qu'on ne peut pas atteindre).
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { generateWorld, SECTOR_SEED, T, isSolidTile } from '../shared/map.ts'
import { NPCS } from '../shared/npcs.ts'
import { RUCHES, RAYONS_DEPART, bordure } from '../shared/front.ts'
import { LIEUX } from '../shared/regions/index.ts'
import { findPath, nearestFree } from '../shared/path.ts'

const m = generateWorld(SECTOR_SEED)
const S = 2, W = m.w * S, H = m.h * S
const px = Buffer.alloc(W * H * 3)
const col: Record<number, number[]> = {
  [T.SOL]: [90, 80, 64], [T.ROC]: [60, 54, 46], [T.METAL]: [74, 93, 114], [T.CAISSE]: [120, 100, 60], [T.EPAVE]: [110, 60, 30], [T.DALLE]: [60, 66, 75],
  [T.ROUTE]: [150, 140, 110], [T.CHAIR]: [120, 30, 110], [T.NIDSOL]: [70, 20, 70], [T.HERBE]: [110, 140, 60], [T.MOUSSE]: [50, 110, 60], [T.BOUE]: [80, 90, 70],
  [T.EAU]: [40, 70, 100], [T.FERRAILLE]: [110, 100, 90], [T.PAVE]: [140, 140, 150], [T.PLANCHER]: [150, 110, 70], [T.MURP]: [200, 200, 200], [T.MURB]: [220, 120, 80],
  [T.ARBRE]: [20, 60, 30], [T.MEUBLE]: [255, 220, 120], [T.CHAMP]: [180, 160, 80], [T.CLOTURE]: [160, 120, 80], [T.PALISSADE]: [130, 90, 50], [T.RACINE]: [90, 60, 100],
  [T.CHAIRSOL]: [150, 70, 140], [T.MARE]: [70, 100, 110],
  [T.FALAISE]: [44, 38, 34], [T.MER]: [22, 44, 78], [T.SABLE]: [196, 180, 130], [T.PONT]: [190, 140, 70], [T.GUE]: [110, 160, 170], [T.SAS]: [0, 255, 200], [T.SCELLE]: [255, 0, 0],
}
for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
  const c = col[m.tiles[y * m.w + x]] ?? [255, 0, 0]
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const i = ((y * S + dy) * W + x * S + dx) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2] }
}
const dot = (x: number, y: number, c: number[], r = 2) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = Math.round(x * S) + dx, Y = Math.round(y * S) + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) { const i = (Y * W + X) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2] } } }
for (const c of m.monde!.camps) dot(c.x / 16, c.y / 16, [255, 40, 40])
for (const n of m.monde!.noeuds) dot(n.x / 16, n.y / 16, [255, 255, 0], 1)
for (const p of m.monde!.pannes) dot(p.x / 16, p.y / 16, [0, 255, 255])
dot(m.monde!.boss!.x / 16, m.monde!.boss!.y / 16, [255, 0, 255], 4)
// la bordure de chaque ruche à son rayon de départ
RUCHES.forEach((r, i) => { for (let a = 0; a < Math.PI * 2; a += 0.01) { const d = bordure(r, RAYONS_DEPART[i], a); dot(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, [255, 60, 220], 0) } dot(r.x, r.y, [255, 60, 220], 3) })
for (const l of LIEUX) { for (let x = l.x0; x <= l.x1; x++) { dot(x, l.y0, [255, 210, 60], 0); dot(x, l.y1, [255, 210, 60], 0) } for (let y = l.y0; y <= l.y1; y++) { dot(l.x0, y, [255, 210, 60], 0); dot(l.x1, y, [255, 210, 60], 0) } }
for (const s of m.stations) dot(s.x, s.y, [255, 140, 0], 3)
for (const p of m.passages) dot(p.x, p.y, [0, 255, 200], 3)
const sp = m.points.spawn
let bad = 0
for (const n of NPCS) {
  const [x, y] = n.poste
  const solid = isSolidTile(m.tiles[y * m.w + x])
  const path = findPath(m, Math.floor(sp.x / 16), Math.floor(sp.y / 16), x, y, 400000)
  if (solid || !path) { bad++; console.log('PNJ', n.id, 'poste', x, y, solid ? 'SOLIDE' : '', path ? '' : 'INACCESSIBLE', nearestFree(m, x, y)) }
  for (const s of [n.maison, n.soir]) if (s && isSolidTile(m.tiles[s[1] * m.w + s[0]])) console.log('PNJ', n.id, 'spot solide', s)
  dot(x, y, [255, 255, 255], 2)
}
console.log('camps', m.monde!.camps.length, 'noeuds', m.monde!.noeuds.length, 'arbres', m.monde!.arbres.length, 'pnj mal placés', bad)
// PNG
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3) }
const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return ~c >>> 0 }
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
writeFileSync(process.argv[2] ?? '/tmp/heirline-carte.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
