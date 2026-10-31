// Le pixel art du monde ouvert, dessiné par le code : terrains des cinq régions, murs et façades, mobilier,
// arbres, toits, habitants, faune et créatures d'ÉDEN, projectiles, marqueurs de quête, icônes d'objets, météo.
// Les créatures et les arbres sont faits de formes, puis ombrés et détourés automatiquement (même lumière partout).
import Phaser from 'phaser'
import { D, rng, type Building } from '../../shared/map.ts'
import type { Look } from '../../shared/npcs.ts'
import { TILESET, PAL } from './pixel.ts'

type Ctx = CanvasRenderingContext2D

// ----------------------------------------------------------------- outils
function hex(c: string) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function mix(c: string, k: number) { const [r, g, b] = hex(c); const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})` }

/** Ombre en haut-à-gauche, détour sombre : ce qui donne aux formes l'air d'un sprite dessiné à la main. */
function finish(ctx: Ctx, x0: number, y0: number, w: number, h: number, outline = '#14100c', shade = true) {
  const img = ctx.getImageData(x0, y0, w, h), d = img.data
  const a = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h ? d[(y * w + x) * 4 + 3] : 0
  const out = new Uint8ClampedArray(d)
  const [or, og, ob] = hex(outline)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    if (d[i + 3] > 0) {
      if (!shade) continue
      const top = !a(x, y - 1) || !a(x - 1, y), bot = !a(x, y + 1) || !a(x + 1, y + 1)
      const k = top ? 0.22 : bot ? -0.28 : 0
      if (k) for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, k > 0 ? d[i + c] + (255 - d[i + c]) * k : d[i + c] * (1 + k)))
    } else if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
      out[i] = or; out[i + 1] = og; out[i + 2] = ob; out[i + 3] = 255
    }
  }
  ctx.putImageData(new ImageData(out, w, h), x0, y0)
}
function ell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  ctx.fillStyle = col
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) ctx.fillRect(x, y, 1, 1)
  }
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, w = 1) {
  ctx.fillStyle = col
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w)
}
function dot(ctx: Ctx, x: number, y: number, col: string, a = 1) { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1 }

/** Une feuille de N images, chacune dessinée par `fn(ctx, ox, frame)`, finie (ombre + détour). */
function shapeSheet(scene: Phaser.Scene, key: string, w: number, h: number, frames: number, fn: (c: Ctx, ox: number, f: number) => void, outline = '#14100c') {
  const tex = scene.textures.createCanvas(key, w * frames, h)!
  const ctx = tex.getContext()
  for (let f = 0; f < frames; f++) { fn(ctx, f * w, f); finish(ctx, f * w, 0, w, h, outline); tex.add(f, 0, f * w, 0, w, h) }
  tex.refresh()
  return tex
}

// ----------------------------------------------------------------- les tuiles du monde
export function drawWorldTiles(ctx: Ctx) {
  const px = (i: number, x: number, y: number, c: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(i * 16 + x, y, 1, 1); ctx.globalAlpha = 1 }
  const rect = (i: number, x: number, y: number, w: number, h: number, c: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(i * 16 + x, y, w, h); ctx.globalAlpha = 1 }
  const fill = (i: number, c: string) => rect(i, 0, 0, 16, 16, c)
  const noise = (i: number, seed: number, cols: string[], dens: number) => { const R = rng(seed); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (R() < dens) px(i, x, y, cols[Math.floor(R() * cols.length)]) }
  const T = TILESET

  // herbe des plaines : brins, touffes, une fleur de temps en temps
  for (let v = 0; v < 4; v++) {
    const i = T.HERBE + v
    fill(i, '#5d7a38'); noise(i, 200 + v, ['#68863e', '#526e30', '#6f8e44'], 0.45)
    const R = rng(210 + v)
    for (let k = 0; k < 7; k++) { const x = Math.floor(R() * 15), y = 2 + Math.floor(R() * 13); px(i, x, y, '#86a650'); px(i, x, y - 1, '#94b45a'); if (R() < 0.4) px(i, x + 1, y, '#4a6228') }
    if (v === 3) { px(i, 11, 5, '#f0e6a0'); px(i, 4, 11, '#e8a0c0') }
  }
  // mousse de la forêt : sombre, feuilles mortes
  for (let v = 0; v < 4; v++) {
    const i = T.MOUSSE + v
    fill(i, '#2c5434'); noise(i, 220 + v, ['#336040', '#264a2e', '#3a6a46'], 0.5)
    const R = rng(230 + v)
    for (let k = 0; k < 3; k++) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(i, x, y, '#6a5a2e'); px(i, x + 1, y, '#7a6a36') }
    for (let k = 0; k < 4; k++) px(i, Math.floor(R() * 16), Math.floor(R() * 16), '#4a8050')
  }
  // boue du marais
  for (let v = 0; v < 4; v++) {
    const i = T.BOUE
    fill(i + v, '#4a4a34'); noise(i + v, 240 + v, ['#545438', '#3e3e2c', '#5a5a3e'], 0.45)
    const R = rng(250 + v)
    for (let k = 0; k < 3; k++) { const x = Math.floor(R() * 13), y = Math.floor(R() * 15); rect(i + v, x, y, 3, 1, '#62705e', 0.8); px(i + v, x + 1, y, '#7a8a78') }
  }
  // eau profonde, avec des rides
  for (let v = 0; v < 4; v++) {
    const i = T.EAU + v
    fill(i, '#1f4058'); noise(i, 260 + v, ['#234a64', '#1b3a50'], 0.4)
    for (let k = 0; k < 3; k++) { const y = (k * 5 + v * 2) % 16, x = (k * 7 + v * 3) % 12; rect(i, x, y, 4, 1, '#3a6c8c'); px(i, x + 1, y, '#5a90b0') }
  }
  // berge : l'eau sous une rive
  { const i = T.EAU_BORD; fill(i, '#1f4058'); noise(i, 270, ['#234a64', '#1b3a50'], 0.4); rect(i, 0, 0, 16, 3, '#3e3e2c'); rect(i, 0, 3, 16, 1, '#2a2a1e'); rect(i, 0, 4, 16, 2, '#163044', 0.6); rect(i, 3, 9, 4, 1, '#3a6c8c') }
  // mare : boue noyée, roseaux
  for (let v = 0; v < 2; v++) {
    const i = T.MARE + v
    fill(i, '#38504a'); noise(i, 280 + v, ['#2e4640', '#40585a', '#4a5a40'], 0.45)
    rect(i, 2 + v * 5, 6, 5, 1, '#5a8a9a', 0.7)
  }
  // ferraille du cimetière : rouille, écrous, câbles
  for (let v = 0; v < 4; v++) {
    const i = T.FERRAILLE + v
    fill(i, '#55504a'); noise(i, 290 + v, ['#5e5852', '#4a4540', '#6a4a30', '#5a3a26'], 0.5)
    const R = rng(300 + v)
    for (let k = 0; k < 3; k++) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(i, x, y, '#8a9aa8'); px(i, x + 1, y, '#5a6a78') }
    if (v % 2) { let x = 0, y = Math.floor(R() * 16); for (let k = 0; k < 16; k++) { px(i, x, y, '#2a2420'); x++; if (R() < 0.3) y = Math.max(0, Math.min(15, y + (R() < 0.5 ? -1 : 1))) } }
  }
  // pavés de Port-Ancre
  for (let v = 0; v < 2; v++) {
    const i = T.PAVE + v
    fill(i, '#2e3138')
    for (let r = 0; r < 4; r++) for (let c = -1; c < 4; c++) {
      const x = c * 4 + (r % 2 ? 2 : 0) + (v ? 1 : 0), y = r * 4
      const R = rng(310 + v * 50 + r * 7 + c)
      const col = ['#5a5f69', '#636873', '#53575f'][Math.floor(R() * 3)]
      for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) if (x + xx >= 0 && x + xx < 16) px(i, x + xx, y + yy, col)
      if (x >= 0 && x < 16) px(i, x, y, '#767b86')
    }
  }
  // plancher
  for (let v = 0; v < 2; v++) {
    const i = T.PLANCHER + v
    fill(i, '#6e4c2e')
    for (let y = 0; y < 16; y += 4) { rect(i, 0, y, 16, 1, '#4a321e'); const off = ((y / 4) % 2 ? 9 : 3) + v * 2; px(i, off % 16, y + 1, '#4a321e'); px(i, off % 16, y + 2, '#4a321e') }
    noise(i, 320 + v, ['#7a5836', '#64442a'], 0.25)
    px(i, 2, 2, '#9a7a50'); px(i, 13, 10, '#9a7a50')
  }
  // rempart : dessus crénelé, face en gros blocs
  for (let v = 0; v < 2; v++) {
    let i = T.MURP_HAUT + v
    fill(i, '#6b707a'); noise(i, 330 + v, ['#757a84', '#60656e'], 0.35)
    rect(i, 0, 0, 16, 1, '#8a909a'); rect(i, 0, 15, 16, 1, '#4a4e56')
    if (v) { rect(i, 0, 0, 5, 4, '#7d828c'); rect(i, 10, 0, 5, 4, '#7d828c') }
    i = T.MURP_FACE + v
    fill(i, '#4e525c')
    for (let r = 0; r < 3; r++) { rect(i, 0, 2 + r * 5, 16, 1, '#363940'); for (let c = 0; c < 3; c++) rect(i, ((c * 6 + (r % 2) * 3 + v * 2) % 16), 2 + r * 5, 1, 5, '#363940') }
    noise(i, 340 + v, ['#585c66', '#454952'], 0.25)
    rect(i, 0, 0, 16, 2, '#8a909a'); rect(i, 0, 15, 16, 1, '#1a1c20')
  }
  // murs des maisons : chaperon, et façade enduite à colombages
  for (let v = 0; v < 2; v++) {
    let i = T.MURB_HAUT + v
    fill(i, '#8a6a48'); noise(i, 350 + v, ['#9a7a54', '#7a5a3e'], 0.3)
    rect(i, 0, 0, 16, 1, '#b08a60'); rect(i, 0, 15, 16, 1, '#4a3420')
    i = T.MURB_FACE + v
    fill(i, '#c2ad88'); noise(i, 360 + v, ['#cbb894', '#b6a07c'], 0.3)
    rect(i, 0, 0, 16, 2, '#6a4a2e'); rect(i, 0, 12, 16, 4, '#6a6e78'); rect(i, 0, 12, 16, 1, '#8a8e98'); rect(i, 0, 15, 16, 1, '#2a2c30')
    if (v) { rect(i, 7, 2, 2, 10, '#6a4a2e') } else { line(ctx, i * 16 + 1, 3, i * 16 + 6, 11, '#7a5a3a') }
  }
  { const i = T.MURB_FENETRE; fill(i, '#c2ad88'); noise(i, 370, ['#cbb894', '#b6a07c'], 0.3); rect(i, 0, 0, 16, 2, '#6a4a2e'); rect(i, 0, 12, 16, 4, '#6a6e78'); rect(i, 0, 12, 16, 1, '#8a8e98'); rect(i, 0, 15, 16, 1, '#2a2c30')
    rect(i, 3, 3, 10, 8, '#4a321e'); rect(i, 4, 4, 8, 6, '#1c2a3a'); rect(i, 7, 4, 1, 6, '#4a321e'); rect(i, 4, 7, 8, 1, '#4a321e'); px(i, 5, 5, '#5a7a9a'); px(i, 9, 5, '#5a7a9a'); rect(i, 2, 11, 12, 1, '#8a6a48') }
  { const i = T.PORTE; fill(i, '#6e4c2e'); rect(i, 0, 0, 16, 16, '#2a1c12'); rect(i, 2, 0, 12, 13, '#120c08'); rect(i, 1, 0, 1, 14, '#8a6a48'); rect(i, 14, 0, 1, 14, '#8a6a48'); rect(i, 1, 0, 14, 2, '#8a6a48'); rect(i, 2, 13, 12, 3, '#6e4c2e'); rect(i, 3, 2, 10, 4, '#1e140c', 0.8) }
  // champ labouré
  for (let v = 0; v < 2; v++) {
    const i = T.CHAMP + v
    fill(i, '#5a4428')
    for (let y = 1; y < 16; y += 4) { rect(i, 0, y, 16, 2, '#4a3620'); rect(i, 0, y + 2, 16, 1, '#6a5232') }
    if (v) for (let x = 1; x < 16; x += 3) { px(i, x, 2, '#7aa040'); px(i, x, 1, '#9ac050'); px(i, x + 1, 6, '#7aa040'); px(i, x + 1, 5, '#9ac050') }
  }
  // clôtures (sur l'herbe)
  for (const [i, hor] of [[T.CLOTURE_H, true], [T.CLOTURE_V, false]] as [number, boolean][]) {
    fill(i, '#5d7a38'); noise(i, 380 + i, ['#68863e', '#526e30'], 0.4)
    if (hor) { rect(i, 0, 6, 16, 2, '#8a6a48'); rect(i, 0, 10, 16, 2, '#7a5a3a'); rect(i, 2, 3, 2, 11, '#6a4a2e'); rect(i, 11, 3, 2, 11, '#6a4a2e'); rect(i, 0, 13, 16, 1, '#3a4a22', 0.6) }
    else { rect(i, 6, 0, 2, 16, '#8a6a48'); rect(i, 9, 0, 2, 16, '#7a5a3a'); rect(i, 5, 4, 7, 2, '#6a4a2e'); rect(i, 5, 11, 7, 2, '#6a4a2e') }
  }
  // palissade de rondins pointus
  { const i = T.PALISSADE_HAUT; fill(i, '#5a3e24'); for (let x = 0; x < 16; x += 4) { rect(i, x, 0, 3, 16, '#7a5432'); rect(i, x, 0, 1, 16, '#8a6440'); ell(ctx, i * 16 + x + 1.5, 8, 1.4, 1.4, '#4a321c') } }
  { const i = T.PALISSADE_FACE; fill(i, '#3a2614'); for (let x = 0; x < 16; x += 4) { rect(i, x, 3, 3, 13, '#7a5432'); rect(i, x, 3, 1, 13, '#9a7450'); rect(i, x + 1, 1, 1, 2, '#7a5432'); px(i, x + 1, 0, '#9a7450') } rect(i, 0, 9, 16, 1, '#4a3a2a'); rect(i, 0, 15, 16, 1, '#1a1008') }
  // racines vivantes de Haute-Sève
  { const i = T.RACINE_HAUT; fill(i, '#3e2a3a'); for (let k = 0; k < 4; k++) { let x = k * 4 + 1, y = 0; for (let s = 0; s < 16; s++) { rect(i, x, y, 2, 1, s % 5 ? '#6a4a5a' : '#7a5a6a'); y++; if (s % 3 === 0) x += (k % 2 ? 1 : -1); x = Math.max(0, Math.min(14, x)) } } px(i, 5, 6, '#b6ff5a'); px(i, 11, 12, '#7fffd0') }
  { const i = T.RACINE_FACE; fill(i, '#2a1a28'); for (let k = 0; k < 5; k++) { const x = k * 3 + 1; rect(i, x, 2, 2, 14, k % 2 ? '#5a3a4a' : '#6a4a5a'); px(i, x, 2, '#8a6a7a') } rect(i, 0, 0, 16, 2, '#7a5a6a'); px(i, 4, 8, '#b6ff5a'); px(i, 10, 11, '#b6ff5a'); rect(i, 0, 15, 16, 1, '#120a10') }
  // sol d'ÉDEN : chair et veines
  for (let v = 0; v < 4; v++) {
    const i = T.CHAIRSOL + v
    fill(i, '#5a2656'); noise(i, 400 + v, ['#66305f', '#4c1e48', '#6e3466'], 0.5)
    const R = rng(410 + v)
    let y = Math.floor(R() * 16)
    for (let x = 0; x < 16; x++) { px(i, x, y, '#8b2f80'); if (R() < 0.3) y = Math.max(0, Math.min(15, y + (R() < 0.5 ? -1 : 1))) }
    if (v % 2) { px(i, 4 + v, 9, '#ff8ae0'); px(i, 5 + v, 9, '#c45bb0') }
  }

  // falaise : dessus de basalte, face haute striée, éboulis au pied
  for (let v = 0; v < 2; v++) {
    let i = T.FALAISE_HAUT + v
    fill(i, '#5a5048'); noise(i, 500 + v, ['#645a50', '#4e463e', '#6c6258'], 0.45)
    rect(i, 0, 0, 16, 1, '#7a7064'); if (v) { rect(i, 3, 6, 5, 1, '#3e3832'); rect(i, 9, 11, 4, 1, '#3e3832') }
    i = T.FALAISE_FACE + v
    fill(i, '#3a322c')
    for (let k = 0; k < 6; k++) { const x = (k * 3 + v * 2) % 16; rect(i, x, 1, 1, 13, '#2a2420'); rect(i, x + 1, 1, 1, 13, '#4a4038', 0.7) }
    noise(i, 510 + v, ['#443a32', '#2e2822'], 0.3)
    rect(i, 0, 0, 16, 2, '#6c6258'); rect(i, 0, 14, 16, 2, '#1c1814')
  }
  // mer : profonde, houle
  for (let v = 0; v < 4; v++) {
    const i = T.MER + v
    fill(i, '#163650'); noise(i, 520 + v, ['#1a3e5a', '#122c44', '#1c4462'], 0.45)
    for (let k = 0; k < 2; k++) { const y = (k * 7 + v * 3) % 15, x = (k * 9 + v * 5) % 11; rect(i, x, y, 5, 1, '#3a6e94'); rect(i, x + 1, y + 1, 3, 1, '#2a5678') }
  }
  // l'écume au bord de la mer
  { const i = T.MER_BORD; fill(i, '#163650'); noise(i, 530, ['#1a3e5a', '#122c44'], 0.4); rect(i, 0, 0, 16, 2, '#c8b88a'); rect(i, 0, 2, 16, 2, '#dfe8ea', 0.75); for (let x = 0; x < 16; x += 3) px(i, x, 4, '#dfe8ea', 0.6); rect(i, 4, 9, 5, 1, '#3a6e94') }
  // sable de la côte
  for (let v = 0; v < 4; v++) {
    const i = T.SABLE + v
    fill(i, '#b8a678'); noise(i, 540 + v, ['#c4b284', '#a8966a', '#ccbc90'], 0.45)
    const R = rng(550 + v)
    for (let k = 0; k < 2; k++) { const x = Math.floor(R() * 14), y = Math.floor(R() * 14); px(i, x, y, '#8a7a56'); px(i, x + 1, y, '#e0d4a8') }
    if (v === 2) { px(i, 10, 4, '#e8e0d0'); px(i, 11, 4, '#d8c8b0') }
  }
  // ponts : planches sur l'eau, garde-fous
  { const i = T.PONT_H; fill(i, '#1f4058'); rect(i, 0, 2, 16, 12, '#7a5432'); for (let x = 0; x < 16; x += 3) rect(i, x, 2, 1, 12, '#4a321c'); rect(i, 0, 2, 16, 1, '#3a2614'); rect(i, 0, 13, 16, 1, '#2a1a0e'); rect(i, 0, 1, 16, 1, '#5a3e24'); rect(i, 0, 14, 16, 1, '#5a3e24'); px(i, 4, 7, '#9a7048'); px(i, 11, 9, '#9a7048') }
  { const i = T.PONT_V; fill(i, '#1f4058'); rect(i, 2, 0, 12, 16, '#7a5432'); for (let y = 0; y < 16; y += 3) rect(i, 2, y, 12, 1, '#4a321c'); rect(i, 1, 0, 1, 16, '#5a3e24'); rect(i, 14, 0, 1, 16, '#5a3e24'); px(i, 7, 5, '#9a7048') }
  // gué : galets sous une eau basse
  for (let v = 0; v < 2; v++) {
    const i = T.GUE + v
    fill(i, '#3e6878'); noise(i, 560 + v, ['#4a7686', '#36606e'], 0.4)
    const R = rng(570 + v)
    for (let k = 0; k < 6; k++) { const x = Math.floor(R() * 13), y = Math.floor(R() * 13); rect(i, x, y, 3, 2, '#8a8478'); px(i, x, y, '#aaa498') }
    rect(i, 2 + v * 4, 12, 6, 1, '#9ac8d8', 0.7)
  }
  // sas : un seuil de métal rayé, la lueur d'un passage
  { const i = T.SAS; fill(i, '#2a2e34'); for (let k = -16; k < 16; k += 4) for (let y = 0; y < 16; y++) { const x = k + y; if (x >= 0 && x < 16) { px(i, x, y, '#c8a030'); if (x + 1 < 16) px(i, x + 1, y, '#c8a030') } } rect(i, 0, 0, 16, 1, '#5a6068'); rect(i, 0, 15, 16, 1, '#14161a'); rect(i, 5, 5, 6, 6, '#20262c'); rect(i, 6, 6, 4, 4, '#7fd6ff', 0.8) }
  // porte scellée : un battant de coque soudé
  { const i = T.SCELLE; fill(i, '#3a3e46'); rect(i, 0, 0, 16, 2, '#6a707a'); rect(i, 7, 0, 2, 16, '#22252a'); for (const y of [4, 8, 12]) { px(i, 2, y, '#8a909a'); px(i, 13, y, '#8a909a') } for (let y = 2; y < 16; y += 2) px(i, 8, y, '#ff9b3d', 0.85); rect(i, 0, 15, 16, 1, '#14161a') }

  // ----------------------------------------------------------- décor au sol
  const deco = (d: number) => TILESET.DECO + d
  { const i = deco(D.FLEUR); for (const [x, y, c] of [[3, 5, '#f0e6a0'], [11, 4, '#ffffff'], [7, 11, '#e8a0c0'], [12, 12, '#f0e6a0']] as [number, number, string][]) { px(i, x, y + 1, '#4a6a28'); px(i, x, y + 2, '#4a6a28'); px(i, x - 1, y, c); px(i, x + 1, y, c); px(i, x, y - 1, c); px(i, x, y, '#ffd36b') } }
  { const i = deco(D.CHAMPI); for (const [x, y] of [[4, 8], [10, 5], [11, 11]]) { rect(i, x, y + 1, 1, 3, '#d8d8c0'); rect(i, x - 2, y - 1, 5, 2, '#5affd0'); rect(i, x - 1, y - 2, 3, 1, '#9affe8'); px(i, x - 1, y - 1, '#e0fff6') } }
  { const i = deco(D.ROSEAU); for (let k = 0; k < 6; k++) { const x = 2 + k * 2 + (k % 2), h = 6 + (k * 5) % 5; rect(i, x, 15 - h, 1, h, k % 2 ? '#6a8a4a' : '#7a9a52'); rect(i, x, 15 - h - 2, 1, 3, '#6a4a2a') } }
  { const i = deco(D.FOUGERE); for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.38; for (let s = 2; s < 8; s++) { const x = 8 + Math.cos(a) * s, y = 14 + Math.sin(a) * s * 1.2; px(i, Math.round(x), Math.round(y), s > 5 ? '#6ab060' : '#3f8a4a'); if (s % 2) px(i, Math.round(x + 1), Math.round(y), '#2f6a3a') } } }
  { const i = deco(D.PNEU); ell(ctx, i * 16 + 8, 9, 5, 3.5, '#1a1a1c'); ell(ctx, i * 16 + 8, 9, 2.5, 1.5, '#55504a'); rect(i, 4, 7, 2, 1, '#3a3a3e') }
  { const i = deco(D.TUYAU); rect(i, 1, 7, 14, 4, '#6a4a30'); rect(i, 1, 7, 14, 1, '#9a6a40'); rect(i, 1, 10, 14, 1, '#3a2418'); rect(i, 5, 6, 2, 6, '#5a6a78'); rect(i, 11, 6, 2, 6, '#5a6a78') }
  { const i = deco(D.PAILLE); for (let k = 0; k < 9; k++) { const x = 1 + k * 2 - (k % 2), y = 3 + (k * 7) % 10; rect(i, x, y, 1, 3, '#c8aa5a'); px(i, x, y - 1, '#e0c878') } }
  { const i = deco(D.BUISSON); ell(ctx, i * 16 + 8, 9, 6, 5, '#3e6a2e'); ell(ctx, i * 16 + 7, 8, 4.5, 3.5, '#4e7e36'); ell(ctx, i * 16 + 6, 7, 2, 1.5, '#6a9a46'); rect(i, 3, 14, 10, 1, '#1a2a10', 0.5); px(i, 10, 9, '#c04040') }
  // mobilier
  const M = (d: number) => deco(d)
  { const i = M(D.M_TABLE); rect(i, 1, 4, 14, 8, '#3a2614'); rect(i, 1, 3, 14, 7, '#8a6440'); rect(i, 1, 3, 14, 1, '#a07a50'); rect(i, 2, 10, 2, 4, '#4a321c'); rect(i, 12, 10, 2, 4, '#4a321c'); px(i, 5, 5, '#d8d0b8'); px(i, 6, 5, '#d8d0b8'); rect(i, 9, 5, 3, 2, '#a0a8b0') }
  { const i = M(D.M_LIT); rect(i, 2, 0, 12, 16, '#3a2614'); rect(i, 3, 1, 10, 14, '#7a5a3a'); rect(i, 4, 2, 8, 3, '#e8e4d8'); rect(i, 3, 6, 10, 9, '#4a5a8a'); rect(i, 3, 6, 10, 1, '#6a7aaa'); for (let y = 8; y < 15; y += 3) rect(i, 4, y, 8, 1, '#3a4a72') }
  { const i = M(D.M_ETABLI); rect(i, 0, 4, 16, 9, '#3a2614'); rect(i, 0, 3, 16, 6, '#7a5a3a'); rect(i, 0, 3, 16, 1, '#9a7a50'); rect(i, 2, 4, 4, 2, '#8a9aa8'); rect(i, 9, 2, 2, 4, '#5a6a78'); rect(i, 12, 4, 3, 1, '#c04040'); rect(i, 1, 9, 2, 5, '#3a2614'); rect(i, 13, 9, 2, 5, '#3a2614') }
  { const i = M(D.M_COMPTOIR); rect(i, 0, 3, 16, 11, '#3e2a18'); rect(i, 0, 3, 16, 3, '#9a7048'); rect(i, 0, 3, 16, 1, '#b88a5a'); rect(i, 0, 6, 16, 1, '#2a1a0e'); for (let x = 2; x < 16; x += 5) rect(i, x, 8, 3, 5, '#4e3420') }
  { const i = M(D.M_ETAGERE); rect(i, 1, 0, 14, 15, '#3a2614'); rect(i, 2, 1, 12, 13, '#5a3e24'); for (const y of [4, 9]) rect(i, 2, y, 12, 1, '#7a5a3a'); for (const [x, y, c] of [[3, 2, '#7dff9a'], [5, 1, '#c45bb0'], [8, 2, '#7fd6ff'], [11, 1, '#ffd36b'], [4, 7, '#d8d0b8'], [7, 6, '#c04040'], [10, 7, '#8a9aa8'], [12, 6, '#7dff9a'], [3, 12, '#a07a50'], [9, 11, '#d8d0b8']] as [number, number, string][]) rect(i, x, y, 2, 2, c) }
  { const i = M(D.M_TONNEAU); ell(ctx, i * 16 + 8, 9, 5, 6, '#7a5432'); ell(ctx, i * 16 + 8, 5, 4.5, 2, '#9a7048'); ell(ctx, i * 16 + 8, 5, 3, 1, '#4a321c'); rect(i, 3, 8, 10, 1, '#3a3a40'); rect(i, 3, 12, 10, 1, '#3a3a40') }
  { const i = M(D.M_FOUR); rect(i, 1, 1, 14, 14, '#5a2a1e'); for (let y = 2; y < 15; y += 3) for (let x = (y % 2) * 2 + 1; x < 15; x += 4) rect(i, x, y, 3, 2, '#8a3e2a'); rect(i, 4, 7, 8, 6, '#1a0a06'); rect(i, 5, 9, 6, 4, '#ff7a2a'); rect(i, 6, 10, 4, 3, '#ffd36b'); rect(i, 5, 0, 6, 2, '#3a3a40') }
  { const i = M(D.M_CAISSES); rect(i, 1, 4, 9, 9, '#3e321f'); rect(i, 2, 5, 7, 7, '#7a6542'); line(ctx, i * 16 + 2, 5, i * 16 + 8, 11, '#5a4a32'); rect(i, 7, 1, 8, 8, '#3e321f'); rect(i, 8, 2, 6, 6, '#8a7550'); line(ctx, i * 16 + 8, 2, i * 16 + 13, 7, '#5a4a32') }
  { const i = M(D.M_ARMOIRE); rect(i, 1, 0, 14, 15, '#2a1a0e'); rect(i, 2, 1, 12, 13, '#5a3a20'); rect(i, 7, 1, 1, 13, '#2a1a0e'); px(i, 6, 7, '#ffd36b'); px(i, 9, 7, '#ffd36b'); rect(i, 2, 1, 12, 1, '#7a5432') }
  { const i = M(D.M_BANC); rect(i, 0, 6, 16, 4, '#3a2614'); rect(i, 0, 5, 16, 3, '#8a6440'); rect(i, 0, 5, 16, 1, '#a07a50'); rect(i, 2, 8, 2, 4, '#4a321c'); rect(i, 12, 8, 2, 4, '#4a321c') }
  { const i = M(D.M_ETAL); rect(i, 1, 6, 14, 8, '#5a3e24'); rect(i, 1, 6, 14, 2, '#8a6440'); for (const [x, c] of [[2, '#c04040'], [5, '#ffd36b'], [8, '#7dff9a'], [11, '#8a9aa8']] as [number, string][]) rect(i, x, 7, 2, 2, c); for (let x = 0; x < 16; x += 4) { rect(i, x, 0, 2, 5, '#b83a2e'); rect(i, x + 2, 0, 2, 5, '#e8e0d0') } rect(i, 0, 4, 16, 1, '#7a2a20'); rect(i, 1, 5, 1, 9, '#3a2614'); rect(i, 14, 5, 1, 9, '#3a2614') }
  { const i = M(D.M_ARCHE); rect(i, 4, 2, 8, 14, '#3a2a48'); rect(i, 5, 3, 6, 12, '#5a4a6a'); rect(i, 5, 3, 1, 12, '#7a6a8a'); ell(ctx, i * 16 + 8, 3, 3, 3, '#c48bff'); px(i, 7, 2, '#ffffff'); rect(i, 3, 14, 10, 2, '#2a2030') }
  { const i = M(D.M_ENCLUME); rect(i, 5, 10, 6, 4, '#2a2a30'); rect(i, 2, 5, 12, 5, '#4a4a54'); rect(i, 2, 5, 12, 1, '#7a7a88'); rect(i, 0, 6, 3, 2, '#4a4a54'); rect(i, 4, 14, 8, 2, '#5a3e24') }
  { const i = M(D.M_LANTERNE); rect(i, 7, 5, 2, 11, '#3a3a40'); rect(i, 5, 1, 6, 5, '#2a2a30'); rect(i, 6, 2, 4, 3, '#ffd36b'); px(i, 7, 3, '#fff3c4') }
  { const i = M(D.M_TABLEAU); rect(i, 1, 2, 14, 10, '#4a321c') }
  { const i = M(D.M_FONTAINE); rect(i, 0, 0, 16, 16, '#5a5f69') }
  // fontaine (2 × 2 tuiles)
  {
    const base = TILESET.FONTAINE
    const g = document.createElement('canvas'); g.width = 32; g.height = 32
    const c = g.getContext('2d')!
    c.fillStyle = '#2e3138'; c.fillRect(0, 0, 32, 32)
    ell(c, 16, 17, 15, 13, '#2a2c30'); ell(c, 16, 16, 15, 13, '#8a8e98'); ell(c, 16, 16, 13, 11, '#6a6e78'); ell(c, 16, 16, 11, 9, '#2f6a90'); ell(c, 16, 15, 9, 7, '#3a7ab0')
    for (let k = 0; k < 6; k++) { c.fillStyle = '#7ab8e0'; c.fillRect(8 + k * 3, 12 + (k % 3) * 3, 2, 1) }
    ell(c, 16, 14, 3, 3, '#8a8e98'); c.fillStyle = '#a0a8b8'; c.fillRect(15, 6, 2, 8); c.fillStyle = '#c0e8ff'; c.fillRect(15, 4, 2, 3); c.fillRect(13, 6, 1, 3); c.fillRect(18, 6, 1, 3)
    for (let q = 0; q < 4; q++) ctx.drawImage(g, (q % 2) * 16, (q >> 1) * 16, 16, 16, (base + q) * 16, 0, 16, 16)
  }
  // tableau des morts (2 tuiles)
  {
    const base = TILESET.TABLEAU
    const g = document.createElement('canvas'); g.width = 32; g.height = 16
    const c = g.getContext('2d')!
    c.fillStyle = '#5a5f69'; c.fillRect(0, 0, 32, 16)
    c.fillStyle = '#2a1a0e'; c.fillRect(3, 9, 2, 7); c.fillRect(27, 9, 2, 7)
    c.fillStyle = '#3a2614'; c.fillRect(1, 0, 30, 12); c.fillStyle = '#5a3e24'; c.fillRect(2, 1, 28, 10)
    const R = rng(7)
    for (let k = 0; k < 11; k++) { const x = 3 + (k % 6) * 4 + Math.floor(R() * 2), y = 2 + Math.floor(k / 6) * 4 + Math.floor(R() * 2); c.fillStyle = R() < 0.3 ? '#d8c8a0' : '#e8e0c8'; c.fillRect(x, y, 3, 3); c.fillStyle = '#6a5a4a'; c.fillRect(x, y + 1, 2, 1) }
    c.fillStyle = '#e8e0c8'; c.fillRect(14, 12, 2, 3); c.fillStyle = '#ffd36b'; c.fillRect(14, 11, 2, 1)
    for (let q = 0; q < 2; q++) ctx.drawImage(g, q * 16, 0, 16, 16, (base + q) * 16, 0, 16, 16)
  }
}

// ----------------------------------------------------------------- les habitants (et les Greffés)
const PNJ_HAUT = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhHHhhhhk...',
  '...khsssssshk...',
  '...ksseSSessk...',
  '...kssssssssk...',
  '....kssmmssk....',
  '...kaaAAAAaak...',
  '..kaaaAccAaaak..',
  '..kskaaccaaksk..',
  '..kskaaaaaaksk..',
  '...kkaaaaaakk...',
]
const PNJ_JAMBES = [
  ['....kgggkgggk...', '....kgg.kggk....', '....kbbk.kbbk...', '....kkk..kkk....'],
  ['....kgggkgggk...', '...kggk..kggk...', '...kbbk...kbbk..', '...kkk....kkk...'],
  ['....kgggkgggk...', '....kggkkggk....', '....kbbkkbbk....', '....kkkkkkk.....'],
  ['....kgggkgggk...', '.....kggk.kggk..', '....kbbk..kbbk..', '....kkk...kkk...'],
]
function hatRows(rows: string[], hat: Look['chapeau']) {
  const r = rows.slice()
  if (hat === 'casque') { r[1] = '....kkkkkkkk....'; r[2] = '...kGGGGGGGGk...'; r[3] = '..kGGGWGGGGGGk..'; r[4] = '...kGsssssGk....'.padEnd(16, '.') }
  if (hat === 'calot') { r[1] = '....kkkkkkk.....'; r[2] = '...kccccccck....'; r[3] = '...khhhhhhhhk...' }
  if (hat === 'capuche') { r[1] = '.....kkkkkk.....'; r[2] = '....kaaaaaak....'; r[3] = '...kaAAaaaaak...'; r[4] = '...kasssssak....'.padEnd(16, '.'); r[5] = '...kaseSSesak...'; r[6] = '...kassssssak...' }
  if (hat === 'foulard') { r[2] = '....kccccccck...'; r[3] = '...kcccCcccck...' }
  if (hat === 'bob') { r[1] = '.....kkkkkk.....'; r[2] = '....kccccccck...'; r[3] = '..kkcccccccckk..'; r[4] = '..kkhssssshkk...'.padEnd(16, '.') }
  return r
}

/** La feuille d'images d'un habitant (4 images de marche), selon son apparence. */
export function npcSheet(scene: Phaser.Scene, key: string, look: Look) {
  if (scene.textures.exists(key)) return
  if (look.robot) {
    const R = rng(77)
    shapeSheet(scene, key, 16, 20, 4, (c, ox, f) => {
      const b = f % 2
      c.fillStyle = '#4a5d72'; c.fillRect(ox + 5, 15, 2, 4 + b); c.fillRect(ox + 9, 15, 2, 5 - b)
      ell(c, ox + 8, 11, 5, 5, '#6a7a88'); ell(c, ox + 8, 10, 4, 3.5, '#8aa0b6')
      for (let k = 0; k < 7; k++) { c.fillStyle = R() < 0.5 ? '#8a5230' : '#6a4028'; c.fillRect(ox + 4 + Math.floor(R() * 8), 8 + Math.floor(R() * 7), 1, 1) }
      ell(c, ox + 8, 4, 3.5, 3, '#5a6a7a'); c.fillStyle = '#7fd6ff'; c.fillRect(ox + 6, 4, 4, 1); c.fillStyle = '#d4f4ff'; c.fillRect(ox + 7, 4, 1, 1)
      c.fillStyle = '#3a4a5a'; c.fillRect(ox + 8, 0, 1, 2); c.fillStyle = f === 1 ? '#ffd36b' : '#c9a227'; c.fillRect(ox + 8, 0, 1, 1)
      c.fillStyle = '#4a5d72'; c.fillRect(ox + 2, 10 + b, 2, 4); c.fillRect(ox + 12, 10 - b + 1, 2, 4)
    }, '#10141a')
    return
  }
  const pal: Record<string, string> = {
    k: '#14100c', h: look.cheveux, H: mix(look.cheveux, 0.25), s: look.peau, S: mix(look.peau, 0.15), e: '#1a1410', m: mix(look.peau, -0.25),
    a: look.haut, A: look.haut2, c: look.chapeau === 'casque' ? '#d8b040' : mix(look.haut2, 0.2), g: look.bas, b: '#1a1612',
    G: '#4a5d72', W: '#9ab0c4', p: '#8b2f80', P: '#c45bb0', L: '#b6ff5a',
  }
  if (look.chapeau === 'foulard' || look.chapeau === 'bob') pal.c = mix(look.haut, 0.35)
  if (look.chapeau === 'calot') pal.c = mix(look.haut, -0.2)
  let top = hatRows(PNJ_HAUT, look.chapeau)
  if (look.greffe) { top = top.slice(); top[4] = top[4].slice(0, 9) + 'pP' + top[4].slice(11); top[8] = '...kpPAAAAaak...'; top[9] = '..kpPLAccAaaak..' }
  const frames = PNJ_JAMBES.map((j) => [...top, ...j].map((r) => r.padEnd(16, '.')))
  const tex = scene.textures.createCanvas(key, 16 * 4, 17)!
  const ctx = tex.getContext()
  frames.forEach((rows, i) => {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 16; x++) { const col = pal[rows[y][x]]; if (col) { ctx.fillStyle = col; ctx.fillRect(i * 16 + x, y, 1, 1) } }
    tex.add(i, 0, i * 16, 0, 16, 17)
  })
  tex.refresh()
}

// ----------------------------------------------------------------- arbres
function trees(scene: Phaser.Scene) {
  // 0, 1 : fougères géantes ; 2 : arbre des plaines ; 3 : arbre mort du marais ; 4 : tige d'ÉDEN
  const W = 40, H = 48
  shapeSheet(scene, 'arbres', W, H, 5, (c, ox, f) => {
    const R = rng(500 + f)
    const cx = ox + 20, base = 46
    if (f <= 1) {
      c.fillStyle = '#4a3420'; c.fillRect(cx - 1, base - 16, 3, 16); c.fillStyle = '#6a4a2e'; c.fillRect(cx - 1, base - 16, 1, 16)
      const n = f ? 11 : 9
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * (f ? 0.32 : 0.36) + (R() - 0.5) * 0.1
        const len = 14 + R() * 6
        for (let s = 0; s < len; s++) {
          const t = s / len
          const x = cx + Math.cos(a) * s * 1.05, y = base - 18 + Math.sin(a) * s * 0.85 + t * t * 8
          c.fillStyle = t > 0.7 ? (f ? '#5aa060' : '#6ab868') : f ? '#2f6a3a' : '#3f8a4a'
          c.fillRect(Math.round(x), Math.round(y), 2, 2)
          if (s % 2 === 0 && s > 2) { const nx = -Math.sin(a), ny = Math.cos(a); c.fillStyle = f ? '#3a7a44' : '#4a9a52'; c.fillRect(Math.round(x + nx * 2), Math.round(y + ny * 2), 1, 1); c.fillRect(Math.round(x - nx * 2), Math.round(y - ny * 2), 1, 1) }
        }
      }
      ell(c, cx, base - 18, 3, 2, f ? '#2a5a30' : '#357a40')
    } else if (f === 2) {
      c.fillStyle = '#4a3420'; c.fillRect(cx - 2, base - 14, 4, 14); c.fillStyle = '#6a4a2e'; c.fillRect(cx - 2, base - 14, 1, 14)
      line(c, cx, base - 12, cx - 6, base - 18, '#4a3420', 2); line(c, cx, base - 10, cx + 7, base - 17, '#4a3420', 2)
      for (const [x, y, r] of [[-7, -22, 8], [7, -22, 8], [0, -28, 10], [-3, -18, 7], [5, -17, 7]]) ell(c, cx + x, base + y, r, r * 0.85, '#4e7e34')
      for (let k = 0; k < 40; k++) { const a = R() * 6.28, d = R() * 12; c.fillStyle = R() < 0.5 ? '#6a9a44' : '#3e6a2a'; c.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(base - 24 + Math.sin(a) * d * 0.8), 2, 1) }
      for (let k = 0; k < 4; k++) { c.fillStyle = '#c84040'; c.fillRect(Math.round(cx - 8 + R() * 16), Math.round(base - 30 + R() * 14), 1, 1) }
    } else if (f === 3) {
      let x = cx, y = base
      for (let s = 0; s < 26; s++) { c.fillStyle = s % 4 ? '#5a5048' : '#6a6058'; c.fillRect(Math.round(x) - 1, y, 3, 1); y--; x += Math.sin(s * 0.4) * 0.5 }
      line(c, x, y + 4, x - 10, y - 4, '#5a5048', 2); line(c, x, y + 8, x + 11, y - 2, '#5a5048', 2); line(c, x - 10, y - 4, x - 13, y - 9, '#5a5048'); line(c, x + 11, y - 2, x + 15, y - 6, '#5a5048')
      for (let k = 0; k < 6; k++) { const hx = Math.round(x - 10 + k * 4), hy = Math.round(y - 2 + (k % 2) * 3); c.fillStyle = '#6a8a5a'; c.fillRect(hx, hy, 1, 4 + (k % 3)) }
    } else {
      let x = cx, y = base
      for (let s = 0; s < 24; s++) { c.fillStyle = s % 3 ? '#6e2a66' : '#8b2f80'; c.fillRect(Math.round(x) - 2, y, 4, 1); y--; x += Math.sin(s * 0.3) * 0.4 }
      ell(c, x, y - 4, 7, 6, '#8b2f80'); ell(c, x, y - 5, 5, 4, '#c45bb0'); ell(c, x - 1, y - 6, 2, 2, '#ff8ae0')
      for (let k = 0; k < 5; k++) { const a = Math.PI + k * 0.6; line(c, x, y + 6, x + Math.cos(a) * 8, y + 6 + Math.sin(a) * 4 + 4, '#6e2a66') }
    }
  })
}

// ----------------------------------------------------------------- faune, machines et créatures d'ÉDEN
function creatures(scene: Phaser.Scene) {
  hauts(scene)
  // Broutard : un gros herbivore laineux, paisible
  shapeSheet(scene, 'broutard', 20, 15, 2, (c, ox, f) => {
    const b = f
    for (const [x, ph] of [[4, 0], [7, 1], [11, 0], [14, 1]]) { c.fillStyle = '#4a3828'; c.fillRect(ox + x, 10, 2, 4 - ((ph + b) % 2)) }
    ell(c, ox + 9, 7.5, 7.5, 4.5, '#b8a07a')
    for (let k = 0; k < 14; k++) { c.fillStyle = k % 2 ? '#c8b08a' : '#a08a64'; c.fillRect(ox + 3 + (k * 5) % 13, 5 + (k * 3) % 5, 2, 1) }
    ell(c, ox + 16, 6 + b * 0.5, 3, 2.6, '#7a5a3e'); c.fillStyle = '#2a1a10'; c.fillRect(ox + 17, 5 + b, 1, 1)
    c.fillStyle = '#e8dcc0'; c.fillRect(ox + 15, 2 + b, 1, 2); c.fillRect(ox + 17, 2 + b, 1, 2)
    c.fillStyle = '#5a4030'; c.fillRect(ox + 18, 7 + b, 1, 1)
  })
  // Cornefeuille : un cervidé aux bois feuillus
  shapeSheet(scene, 'cornefeuille', 20, 20, 2, (c, ox, f) => {
    for (const [x, ph] of [[5, 0], [7, 1], [12, 0], [14, 1]]) { c.fillStyle = '#5a3a20'; c.fillRect(ox + x, 12, 1, 6 - ((ph + f) % 2)) }
    ell(c, ox + 10, 11, 6, 3, '#9a6a3a'); c.fillStyle = '#e8d8b8'; c.fillRect(ox + 5, 9, 2, 2)
    line(c, ox + 14, 10, ox + 16, 6, '#9a6a3a', 2); ell(c, ox + 17, 5, 2.5, 2, '#a87a48'); c.fillStyle = '#1a1008'; c.fillRect(ox + 18, 4, 1, 1)
    for (const [x0, y0, x1, y1] of [[16, 3, 14, 0], [17, 3, 19, 0], [15, 1, 13, 1], [18, 1, 19, 2]]) line(c, ox + x0, y0, ox + x1, y1, '#6aa04a')
    c.fillStyle = '#9ad06a'; c.fillRect(ox + 13, 0, 1, 1); c.fillRect(ox + 19, 0, 1, 1)
  })
  // Rôdeur : prédateur bas sur pattes, œil rouge
  shapeSheet(scene, 'rodeur', 20, 14, 2, (c, ox, f) => {
    for (const [x, ph] of [[4, 0], [6, 1], [12, 0], [14, 1]]) { c.fillStyle = '#2a2a30'; c.fillRect(ox + x, 9, 2, 4 - ((ph + f) % 2)) }
    ell(c, ox + 9, 7, 7, 3.2, '#4a4a54'); for (let k = 0; k < 5; k++) { c.fillStyle = '#3a3a44'; c.fillRect(ox + 4 + k * 2, 4 + (k % 2), 1, 2) }
    line(c, ox + 2, 6, ox + 0, 3 + f, '#4a4a54', 2)
    ell(c, ox + 16, 6, 3.4, 2.4, '#55555f'); c.fillStyle = '#3a3a44'; c.fillRect(ox + 17, 8, 3, 1)
    c.fillStyle = '#ff4040'; c.fillRect(ox + 17, 5, 1, 1); c.fillStyle = '#e8e8e0'; c.fillRect(ox + 19, 8, 1, 1)
    c.fillStyle = '#4a4a54'; c.fillRect(ox + 15, 2, 1, 2)
  })
  // Fougerôde : une araignée qui imite les fougères
  shapeSheet(scene, 'fougerode', 20, 14, 2, (c, ox, f) => {
    for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
      const a = (side < 0 ? Math.PI : 0) + (k - 1.5) * 0.45 * side
      const kx = ox + 10 + Math.cos(a) * 3, ky = 7 + Math.sin(a) * 2
      const ex = kx + Math.cos(a) * 5, ey = ky - 3 + ((k + f) % 2)
      line(c, kx, ky, ex, ey, '#2a3a1e'); line(c, ex, ey, ex + Math.cos(a) * 2, ey + 5, '#2a3a1e')
    }
    ell(c, ox + 8, 7, 4.5, 3.5, '#3a6a32'); for (let k = 0; k < 6; k++) { c.fillStyle = '#5a9a4a'; c.fillRect(ox + 5 + k, 5 + (k % 2) * 3, 1, 1) }
    ell(c, ox + 13, 7, 2.5, 2.2, '#2e5a28'); c.fillStyle = '#b6ff5a'; c.fillRect(ox + 14, 6, 1, 1); c.fillRect(ox + 13, 6, 1, 1); c.fillRect(ox + 14, 8, 1, 1)
  })
  // Sangsue des marais : longue, annelée, ventre rouge
  shapeSheet(scene, 'sangsue', 20, 10, 2, (c, ox, f) => {
    for (let x = 1; x < 17; x++) { const y = 5 + Math.sin(x * 0.6 + f * 1.5) * 1.5; ell(c, ox + x, y, 1.6, 2.6 - Math.abs(x - 9) * 0.08, x % 3 ? '#3a2a3a' : '#4a3448') }
    for (let x = 2; x < 16; x += 2) { c.fillStyle = '#8a2a3a'; c.fillRect(ox + x, Math.round(7 + Math.sin(x * 0.6 + f * 1.5) * 1.5), 1, 1) }
    ell(c, ox + 17.5, 5 + Math.sin(17 * 0.6 + f * 1.5) * 1.5, 2, 2, '#5a3a4a'); c.fillStyle = '#ff6b6b'; c.fillRect(ox + 18, Math.round(5 + Math.sin(17 * 0.6 + f * 1.5) * 1.5), 1, 1)
  })
  // Gonflé : une poche d'ÉDEN qui enfle, et éclate
  shapeSheet(scene, 'gonfle', 18, 18, 2, (c, ox, f) => {
    for (const x of [5, 8, 11]) { c.fillStyle = PAL.chair1; c.fillRect(ox + x, 14, 1, 3) }
    const r = 6.5 + f * 0.6
    ell(c, ox + 9, 9, r, r - 0.5, PAL.chair3); ell(c, ox + 8, 8, r - 2, r - 2.5, PAL.chair4)
    const R = rng(9)
    for (let k = 0; k < 10; k++) { const a = R() * 6.28, d = R() * (r - 1); c.fillStyle = R() < 0.5 ? PAL.acide : PAL.lueur; c.fillRect(Math.round(ox + 9 + Math.cos(a) * d), Math.round(9 + Math.sin(a) * d), 1, 1) }
    line(c, ox + 4, 6, ox + 9, 12, PAL.chair2); line(c, ox + 13, 5, ox + 10, 13, PAL.chair2)
  }, PAL.chair0)
  // Rouillard : un drone de la Première Vague, devenu fou
  shapeSheet(scene, 'rouillard', 16, 16, 2, (c, ox, f) => {
    c.fillStyle = '#3a3a40'; c.fillRect(ox + 2, 2, 12, 1); c.fillStyle = '#8a9aa8'; f ? c.fillRect(ox + 1, 1, 5, 1) : c.fillRect(ox + 10, 1, 5, 1)
    c.fillStyle = '#3a3a40'; c.fillRect(ox + 7, 3, 2, 2)
    ell(c, ox + 8, 8.5, 5.5, 4.5, '#6a5a4a'); ell(c, ox + 8, 8, 4.5, 3.5, '#7a6a58')
    for (const [x, y] of [[4, 7], [11, 10], [6, 11]]) { c.fillStyle = '#8a5230'; c.fillRect(ox + x, y, 2, 1) }
    ell(c, ox + 8, 8.5, 2, 2, '#2a0a0a'); c.fillStyle = '#ff3030'; c.fillRect(ox + 7, 8, 2, 2); c.fillStyle = '#ffb0b0'; c.fillRect(ox + 7, 8, 1, 1)
    c.fillStyle = '#4a4a50'; c.fillRect(ox + 5, 13, 1, 2); c.fillRect(ox + 10, 13, 1, 2 + f)
  }, '#120e0c')
  // L'Engloutisseur : la bête du marais (64 × 52)
  shapeSheet(scene, 'engloutisseur', 64, 52, 2, (c, ox, f) => {
    const R = rng(66)
    for (let k = 0; k < 6; k++) { const a = Math.PI * (0.15 + k * 0.14), x0 = ox + 32 + Math.cos(a) * 16, y0 = 34; let x = x0, y = y0; for (let s = 0; s < 12; s++) { c.fillStyle = s > 9 ? '#2a3a26' : '#3e5636'; c.fillRect(Math.round(x), Math.round(y), 3, 2); x += Math.cos(a) * 1.3; y += 1 + Math.sin(s * 0.5 + k + f) * 0.6 } }
    ell(c, ox + 32, 28 + f * 0.5, 27, 18, '#3e5636'); ell(c, ox + 32, 25, 24, 14, '#4e6a40'); ell(c, ox + 28, 20, 14, 7, '#5e7e4c')
    for (let k = 0; k < 40; k++) { const x = ox + 10 + Math.floor(R() * 44), y = 14 + Math.floor(R() * 26); c.fillStyle = R() < 0.5 ? '#6a8a54' : '#34482c'; c.fillRect(x, y, 2, 1) }
    // la gueule
    ell(c, ox + 32, 33, 15, 7 + f, '#1a0a0c'); ell(c, ox + 32, 33, 13, 5 + f, '#5a1a22')
    for (let k = 0; k < 9; k++) { c.fillStyle = '#e8e0c0'; c.fillRect(ox + 21 + k * 2.6, 27 + (k % 2), 1, 3); c.fillRect(ox + 22 + k * 2.6, 38 + f - (k % 2), 1, 2) }
    // les yeux
    for (const x of [20, 44]) { ell(c, ox + x, 18, 4, 3.5, '#2a3a20'); ell(c, ox + x, 18, 2.5, 2.5, '#ffd36b'); c.fillStyle = '#1a0a00'; c.fillRect(ox + x, 17, 1, 3) }
    for (let k = 0; k < 7; k++) { c.fillStyle = '#9fd08a'; c.fillRect(ox + 14 + k * 6, 9 + (k % 3) * 2, 1, 1) }
  }, '#121a10')
}

// ----------------------------------------------------------------- toits
export function roofTexture(scene: Phaser.Scene, key: string, b: Building) {
  if (scene.textures.exists(key)) return
  const southDoor = b.porte.y === b.y + b.h - 1
  const rows = b.h - 1 + (southDoor ? 1 : 0)
  const W = b.w * 16 + 4, H = rows * 16 + 2
  const tex = scene.textures.createCanvas(key, W, H)!
  const c = tex.getContext()
  const R = rng(b.x * 31 + b.y)
  const pal = {
    tuile: ['#8a3e2a', '#a84e32', '#c0603c', '#6a2e20'],
    tole: ['#5a6878', '#6a7a8a', '#7a8a9a', '#3e4a58'],
    chaume: ['#a08448', '#b89a5a', '#c8aa6a', '#7a6434'],
    organique: ['#5a2e58', '#6e3a68', '#8a4a7a', '#3e1e3c'],
    toile: ['#a89870', '#c0b088', '#d0c098', '#7a6a4a'],
  }[b.toit]
  const ridge = Math.round(H * 0.42)
  // pente du haut (au soleil) et du bas (à l'ombre)
  c.fillStyle = pal[2]; c.fillRect(0, 0, W, ridge)
  c.fillStyle = pal[1]; c.fillRect(0, ridge, W, H - ridge)
  if (b.toit === 'tuile') {
    for (let y = 1; y < H - 3; y += 4) { const off = (y / 4) % 2 ? 2 : 0; for (let x = off; x < W; x += 4) { c.fillStyle = y < ridge ? pal[1] : pal[0]; c.fillRect(x, y + 3, 3, 1); c.fillRect(x + 3, y, 1, 4) } }
  } else if (b.toit === 'tole') {
    for (let x = 0; x < W; x += 3) { c.fillStyle = pal[0]; c.fillRect(x, 0, 1, H) ; c.fillStyle = pal[3]; c.fillRect(x + 2, ridge, 1, H - ridge) }
    for (let k = 0; k < W * H / 120; k++) { c.fillStyle = R() < 0.6 ? '#8a5230' : '#6a4028'; c.fillRect(Math.floor(R() * W), Math.floor(R() * H), 2 + Math.floor(R() * 3), 1 + Math.floor(R() * 2)) }
  } else if (b.toit === 'chaume') {
    for (let k = 0; k < W * H / 3; k++) { const x = Math.floor(R() * W), y = Math.floor(R() * H); c.fillStyle = [pal[0], pal[2], pal[3]][Math.floor(R() * 3)]; c.fillRect(x, y, 1, 2 + Math.floor(R() * 2)) }
  } else if (b.toit === 'organique') {
    for (let k = 0; k < 8; k++) { let x = R() * W, y = 0; for (let s = 0; s < H; s++) { c.fillStyle = '#8b2f80'; c.fillRect(Math.round(x), s, 1, 1); x += (R() - 0.5) * 1.6 } }
    for (let k = 0; k < W * H / 60; k++) { c.fillStyle = R() < 0.5 ? '#4a7a40' : '#5a8a4a'; ell(c, R() * W, R() * H, 1.5 + R() * 2, 1 + R() * 1.5, c.fillStyle as string) }
    for (let k = 0; k < 6; k++) { c.fillStyle = '#b6ff5a'; c.fillRect(Math.floor(R() * W), Math.floor(R() * H), 1, 1) }
  } else {
    for (let x = 0; x < W; x += 8) { c.fillStyle = pal[3]; c.fillRect(x, 0, 1, H) }
  }
  // faîtage, rives, avant-toit
  c.fillStyle = pal[3]; c.fillRect(0, ridge - 1, W, 2)
  c.fillStyle = mix(pal[2], 0.25); c.fillRect(0, ridge - 2, W, 1)
  c.fillStyle = pal[3]; c.fillRect(0, 0, 2, H); c.fillRect(W - 2, 0, 2, H)
  c.fillStyle = mix(pal[3], -0.3); c.fillRect(0, H - 3, W, 3)
  c.fillStyle = mix(pal[1], 0.2); c.fillRect(0, 0, W, 1)
  // cheminée
  if (b.cheminee) {
    const cx = (b.cheminee.x - b.x) * 16 + 2 + 4, cy = (b.cheminee.y - b.y + (southDoor ? 1 : 0)) * 16 - 6
    c.fillStyle = '#5a2a1e'; c.fillRect(cx, Math.max(0, cy), 8, 10); c.fillStyle = '#8a3e2a'; c.fillRect(cx, Math.max(0, cy), 8, 2); c.fillStyle = '#1a0a06'; c.fillRect(cx + 2, Math.max(0, cy), 4, 1)
  }
  // une porte au nord : un auvent au bord du toit
  if (!southDoor) {
    const dx = (b.porte.x - b.x) * 16 + 2
    c.fillStyle = '#2a1c12'; c.fillRect(dx - 2, 0, 20, 5); c.fillStyle = b.toit === 'tole' ? '#b83a2e' : '#7a5a3a'; c.fillRect(dx - 1, 0, 18, 3)
    for (let x = dx - 1; x < dx + 17; x += 4) { c.fillStyle = '#e8e0d0'; c.fillRect(x, 0, 2, 3) }
  }
  tex.refresh()
}

// ----------------------------------------------------------------- petites textures du monde
function small(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, fn: (c: Ctx) => void) => { if (scene.textures.exists(key)) return; const t = scene.textures.createCanvas(key, w, h)!; fn(t.getContext()); t.refresh() }
  // projectiles ennemis : acide, laser, épine ; et la balle des gardes
  make('pj0', 9, 9, (c) => { ell(c, 4.5, 4.5, 4, 3.6, '#3a8a1e'); ell(c, 4, 4, 3, 2.6, PAL.acide2); ell(c, 3.5, 3.5, 1.6, 1.4, PAL.acide); c.fillStyle = '#f0ffd8'; c.fillRect(3, 2, 1, 1); c.fillStyle = '#2a6a12'; c.fillRect(1, 6, 1, 1) })
  make('pj1', 11, 3, (c) => { c.fillStyle = '#8a0a0a'; c.fillRect(0, 0, 11, 3); c.fillStyle = '#ff3030'; c.fillRect(1, 1, 10, 1); c.fillStyle = '#ffd0d0'; c.fillRect(6, 1, 5, 1) })
  make('pj2', 10, 5, (c) => { c.fillStyle = '#2a0a28'; c.fillRect(0, 1, 7, 3); c.fillRect(7, 2, 3, 1); c.fillStyle = PAL.chair3; c.fillRect(1, 2, 6, 1); c.fillStyle = PAL.lueur; c.fillRect(8, 2, 2, 1); c.fillStyle = PAL.chair4; c.fillRect(2, 1, 3, 1) })
  make('pj3', 5, 3, (c) => { c.fillStyle = '#c9a227'; c.fillRect(0, 1, 5, 1); c.fillStyle = '#ffe9a0'; c.fillRect(2, 0, 3, 3) })
  make('goutte', 1, 6, (c) => { const g = c.createLinearGradient(0, 0, 0, 6); g.addColorStop(0, 'rgba(180,210,255,0)'); g.addColorStop(1, 'rgba(200,225,255,0.85)'); c.fillStyle = g; c.fillRect(0, 0, 1, 6) })
  make('fumee', 8, 8, (c) => { const g = c.createRadialGradient(4, 4, 0, 4, 4, 4); g.addColorStop(0, 'rgba(210,210,215,0.85)'); g.addColorStop(1, 'rgba(210,210,215,0)'); c.fillStyle = g; c.fillRect(0, 0, 8, 8) })
  make('brume', 128, 64, (c) => { for (let k = 0; k < 9; k++) { const x = 20 + k * 11, y = 32 + Math.sin(k) * 8; const g = c.createRadialGradient(x, y, 0, x, y, 30); g.addColorStop(0, 'rgba(220,226,235,0.30)'); g.addColorStop(1, 'rgba(220,226,235,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 64) } })
  make('luciole', 3, 3, (c) => { c.fillStyle = 'rgba(200,255,120,0.5)'; c.fillRect(0, 1, 3, 1); c.fillRect(1, 0, 1, 3); c.fillStyle = '#f0ffb0'; c.fillRect(1, 1, 1, 1) })
  make('feuille', 3, 2, (c) => { c.fillStyle = '#6a9a3a'; c.fillRect(0, 0, 2, 1); c.fillStyle = '#4a7a2a'; c.fillRect(1, 1, 2, 1) })
  // marqueurs de quête : ! jaune, ? jaune, ? gris — 10 × 17, lisibles sur un téléphone (k : contour, h : reflet, s : ombre)
  const mark = (key: string, rows: string[], col: string) => make(key, 10, 17, (c) => { for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const ch = rows[y][x]; if (ch === '.') continue; c.fillStyle = ch === 'k' ? '#1a1206' : ch === 'h' ? '#fff6c8' : ch === 's' ? (col === '#9aa3ad' ? '#6a727c' : '#c98a10') : col; c.fillRect(x, y, 1, 1) } })
  const EX = ['..kkkkk...', '.kh###sk..', '.k####sk..', '.k####sk..', '.k####sk..', '.k####sk..', '..k###k...', '..k###k...', '..k##sk...', '...k#k....', '...kkk....', '..........', '..kkkkk...', '.kh###sk..', '.k####sk..', '..kkkkk...', '..........']
  const QU = ['..kkkkkk..', '.kh#####k.', 'kh##kk##sk', 'k##k..k#sk', 'kkk..k##sk', '....k##sk.', '...k##sk..', '...k#sk...', '...k#sk...', '...kkkk...', '..........', '..........', '..kkkkk...', '.kh##sk...', '.k###sk...', '..kkkkk...', '..........']
  mark('marq_ex', EX, '#ffd23a'); mark('marq_q', QU, '#ffd23a'); mark('marq_qg', QU, '#9aa3ad')
  // bulle de paroles : un fond à neuf parties
  make('bulle', 12, 12, (c) => { c.fillStyle = '#1a1206'; c.fillRect(1, 0, 10, 12); c.fillRect(0, 1, 12, 10); c.fillStyle = '#f4ecd8'; c.fillRect(1, 1, 10, 10) })
  // nœuds de ressources (au sol, avec une lueur pour les repérer)
  make('noeud_herbe', 12, 12, (c) => { for (let k = 0; k < 5; k++) { line(c, 6, 11, 2 + k * 2, 3 + (k % 2) * 2, '#3a7a2a'); c.fillStyle = '#d83a3a'; c.fillRect(2 + k * 2, 2 + (k % 2) * 2, 2, 2) } })
  make('noeud_champignon', 12, 12, (c) => { for (const [x, y] of [[3, 6], [8, 4], [7, 9]]) { c.fillStyle = '#d8d8c0'; c.fillRect(x, y, 1, 3); ell(c, x + 0.5, y, 2.5, 1.6, '#5affd0'); c.fillStyle = '#e0fff6'; c.fillRect(x - 1, y - 1, 1, 1) } })
  make('noeud_pieces', 14, 12, (c) => { ell(c, 7, 8, 6, 3.5, '#4a4a50'); for (const [x, y, col] of [[3, 6, '#8a9aa8'], [8, 5, '#c9a227'], [6, 8, '#6a7a88'], [10, 7, '#8a5230']] as [number, number, string][]) { c.fillStyle = col; c.fillRect(x, y, 3, 2) } c.fillStyle = '#7fd6ff'; c.fillRect(7, 4, 1, 1) })
  make('noeud_noyau', 12, 14, (c) => { c.fillStyle = '#2a3440'; c.fillRect(2, 4, 8, 9); c.fillStyle = '#4a5d72'; c.fillRect(3, 5, 6, 7); c.fillStyle = '#7fd6ff'; c.fillRect(4, 6, 4, 2); c.fillRect(5, 9, 2, 2); c.fillStyle = '#d4f4ff'; c.fillRect(5, 6, 1, 1); c.fillStyle = '#1a2028'; c.fillRect(5, 1, 2, 3) })
  make('noeud_echantillon', 12, 14, (c) => { ell(c, 6, 9, 4, 4, '#8b2f80'); ell(c, 6, 8, 2.5, 2.5, '#ff8ae0'); c.fillStyle = '#e8f0ff'; c.fillRect(5, 2, 2, 4); c.fillStyle = '#ffffff'; c.fillRect(5, 2, 1, 1) })
  // pannes : lampe et balise
  make('balise', 10, 22, (c) => { c.fillStyle = '#3a3a40'; c.fillRect(4, 6, 2, 16); c.fillStyle = '#5a5a64'; c.fillRect(3, 19, 4, 3); c.fillStyle = '#2a2a30'; c.fillRect(2, 1, 6, 6); c.fillStyle = '#c9a227'; c.fillRect(0, 9, 10, 2) })
}

const ICONES: Record<string, (c: Ctx) => void> = {
  armure: (c) => { ell(c, 8, 9, 6, 6, '#5a6a7a'); c.fillStyle = '#7a8a9a'; c.fillRect(4, 4, 8, 3); c.fillStyle = '#3a4a5a'; c.fillRect(7, 6, 2, 8); c.fillStyle = '#9aaaba'; c.fillRect(4, 4, 3, 1) },
  casque: (c) => { ell(c, 8, 8, 6, 5, '#5a6a7a'); c.fillStyle = '#3a4a5a'; c.fillRect(2, 9, 12, 3); c.fillStyle = '#7fd6ff'; c.fillRect(4, 9, 8, 2); c.fillStyle = '#9aaaba'; c.fillRect(5, 4, 4, 1) },
  gants: (c) => { c.fillStyle = '#6a5a48'; c.fillRect(4, 5, 8, 8); c.fillStyle = '#8a7a62'; for (let k = 0; k < 4; k++) c.fillRect(4 + k * 2, 2, 1, 4); c.fillRect(12, 7, 2, 3); c.fillStyle = '#3a3428'; c.fillRect(4, 12, 8, 2) },
  bottes: (c) => { c.fillStyle = '#4a3a2a'; c.fillRect(4, 2, 5, 9); c.fillRect(4, 10, 9, 4); c.fillStyle = '#6a5a42'; c.fillRect(5, 3, 3, 7); c.fillStyle = '#2a2018'; c.fillRect(4, 13, 10, 1) },
  chassis: (c) => { c.fillStyle = '#4a525c'; c.fillRect(2, 4, 12, 9); c.fillStyle = '#6a7480'; c.fillRect(3, 5, 10, 3); c.fillStyle = '#c9a227'; c.fillRect(3, 10, 2, 2); c.fillRect(11, 10, 2, 2); c.fillStyle = '#7fd6ff'; c.fillRect(7, 9, 2, 2) },
  canon: (c) => { c.fillStyle = '#4a525c'; c.fillRect(2, 8, 6, 5); c.fillStyle = '#6a7480'; c.fillRect(6, 6, 9, 3); c.fillStyle = '#2e343b'; c.fillRect(13, 6, 2, 3); c.fillStyle = '#ffd36b'; c.fillRect(3, 9, 2, 1) },
  module: (c) => { c.fillStyle = '#1a3a2a'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#2a6a4a'; c.fillRect(4, 4, 8, 8); c.fillStyle = '#7dff9a'; c.fillRect(6, 6, 4, 4); for (let k = 0; k < 4; k++) { c.fillStyle = '#c9a227'; c.fillRect(1, 4 + k * 2, 2, 1); c.fillRect(13, 4 + k * 2, 2, 1) } },
  piece: (c) => { ell(c, 8, 8, 6, 6, '#6a7a88'); ell(c, 8, 8, 2.5, 2.5, '#2a3440'); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.fillStyle = '#8a9aa8'; c.fillRect(Math.round(8 + Math.cos(a) * 6.5) - 1, Math.round(8 + Math.sin(a) * 6.5) - 1, 2, 2) } },
  viande: (c) => { ell(c, 9, 8, 5, 4, '#a83a3a'); ell(c, 9, 7, 3.5, 2.5, '#c85a5a'); c.fillStyle = '#e8e0c8'; c.fillRect(2, 10, 5, 2); c.fillRect(1, 9, 2, 1) },
  spore: (c) => { ell(c, 8, 9, 5, 5, PAL.chair3); ell(c, 7, 8, 3, 3, PAL.chair4); c.fillStyle = PAL.acide; c.fillRect(6, 7, 1, 1); c.fillRect(10, 11, 1, 1) },
  herbe: (c) => { for (let k = 0; k < 5; k++) { line(c, 8, 14, 3 + k * 2.5, 4 + (k % 2) * 2, '#3a7a2a'); c.fillStyle = '#d83a3a'; c.fillRect(3 + k * 2.5, 3 + (k % 2) * 2, 2, 2) } },
  champignon: (c) => { c.fillStyle = '#d8d8c0'; c.fillRect(7, 8, 2, 6); ell(c, 8, 7, 5, 3, '#3ad8b0'); ell(c, 7, 6, 2.5, 1.5, '#9affe8') },
  peau: (c) => { for (let k = 0; k < 5; k++) line(c, 2, 3 + k * 2, 14, 5 + k * 2, k % 2 ? '#d8e8d0' : '#a8c8a0') },
  noyau: (c) => { c.fillStyle = '#2a3440'; c.fillRect(3, 2, 10, 12); c.fillStyle = '#4a5d72'; c.fillRect(4, 3, 8, 10); c.fillStyle = '#7fd6ff'; c.fillRect(5, 5, 6, 2); c.fillRect(6, 9, 4, 2) },
  trousse: (c) => { c.fillStyle = '#e8e8e0'; c.fillRect(2, 4, 12, 9); c.fillStyle = '#c03030'; c.fillRect(7, 5, 2, 7); c.fillRect(5, 7, 6, 3); c.fillStyle = '#8a8a80'; c.fillRect(6, 2, 4, 2) },
  baume: (c) => { c.fillStyle = '#4a6a3a'; c.fillRect(5, 4, 6, 10); c.fillStyle = '#7dff9a'; c.fillRect(6, 7, 4, 6); c.fillStyle = '#8a6a48'; c.fillRect(5, 2, 6, 2) },
  echantillon: (c) => { c.fillStyle = '#e8f0ff'; c.fillRect(6, 1, 4, 13); ell(c, 8, 10, 2, 3, PAL.lueur) },
}
const iconCache = new Map<string, string>()
/** L'icône d'un objet pour l'interface (data URL), d'après la texture de l'arme de la classe si c'est une arme. */
export function itemIcon(scene: Phaser.Scene | null, b: string, cls?: string) {
  const key = b + (cls ?? '')
  const hit = iconCache.get(key)
  if (hit) return hit
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16
  const c = cv.getContext('2d')!
  if (b === 'arme' && scene) {
    const ci = ['fantassin', 'medic', 'ingenieur', 'eclaireur', 'demolisseur', 'brouilleur'].indexOf(cls ?? 'fantassin')
    const src = scene.textures.get(`arme${Math.max(0, ci)}`).getSourceImage() as HTMLCanvasElement
    c.save(); c.translate(8, 8); c.rotate(-0.6); c.drawImage(src, -src.width / 2, -src.height / 2); c.restore()
  } else (ICONES[b] ?? ICONES.piece)(c)
  finish(c, 0, 0, 16, 16, '#0a0806', false)
  const url = cv.toDataURL()
  iconCache.set(key, url)
  return url
}

/** Une gare du monorail de la Première Vague : deux piliers, un auvent, le rail au-dessus, un panneau (allumé ou mort). */
function gares(scene: Phaser.Scene) {
  for (const on of [true, false]) {
    const W = 36, H = 34
    const tex = scene.textures.createCanvas(on ? 'gare_on' : 'gare_off', W, H)!
    const c = tex.getContext()
    const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h) }
    // le rail suspendu, qui sort des deux côtés
    r(0, 3, W, 3, '#4a525c'); r(0, 3, W, 1, '#7a838e'); for (let x = 2; x < W; x += 6) r(x, 6, 1, 1, '#2e343b')
    // les piliers
    r(5, 6, 3, 26, '#5a626c'); r(5, 6, 1, 26, '#8a929c'); r(28, 6, 3, 26, '#5a626c'); r(28, 6, 1, 26, '#8a929c')
    // l'auvent
    r(2, 10, 32, 4, on ? '#6a7480' : '#4a4e54'); r(2, 10, 32, 1, on ? '#a8b2bc' : '#6a6e74'); r(2, 14, 32, 1, '#1a1e22')
    if (!on) { r(20, 10, 6, 4, '#2a2420'); r(22, 14, 2, 3, '#3a3430') }
    // le quai
    r(3, 28, 30, 5, '#4e5258'); r(3, 28, 30, 1, '#7a7e86'); r(3, 32, 30, 1, '#1a1c20')
    for (let x = 5; x < 32; x += 4) r(x, 30, 2, 1, '#c8a030')
    // le panneau
    r(11, 16, 14, 7, on ? '#1e3a48' : '#2a2a2a'); r(11, 16, 14, 1, '#8a929c')
    if (on) { r(13, 18, 10, 1, '#7fd6ff'); r(13, 20, 6, 1, '#7fd6ff'); r(22, 20, 1, 1, '#ffd36b') } else { r(13, 19, 3, 1, '#5a5a5a'); r(18, 18, 1, 3, '#5a5a5a') }
    finish(c, 0, 0, W, H)
    tex.refresh()
  }
}

/** Le monorail de la Première Vague : piliers, poutre du rail (en morceaux répétables), et la rame suspendue, rouillée
 *  et rafistolée, vue de côté (portes fermées / ouvertes) et de face ou de dos (pour les montées et descentes). */
function monorail(scene: Phaser.Scene) {
  const toile = (cle: string, W: number, H: number, f: (r: (x: number, y: number, w: number, h: number, col: string) => void, c: Ctx) => void, contour = true) => {
    const tex = scene.textures.createCanvas(cle, W, H)!
    const c = tex.getContext()
    f((x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h) }, c)
    if (contour) finish(c, 0, 0, W, H)
    tex.refresh()
    return tex
  }
  // un pilier : béton de la colonie, rongé ; l'ombre au pied
  for (const mort of [false, true]) toile(mort ? 'rail_pilier_mort' : 'rail_pilier', 10, 34, (r) => {
    r(1, 31, 8, 3, 'rgba(0,0,0,0.35)')
    const b = mort ? '#4e4a46' : '#5e646c', cl = mort ? '#6a625a' : '#8a929c', fo = mort ? '#36322e' : '#40464e'
    r(3, 2, 4, 30, b); r(3, 2, 1, 30, cl); r(6, 2, 1, 30, fo)
    r(2, 0, 6, 3, fo); r(2, 0, 6, 1, cl) // le chapiteau sous la poutre
    r(2, 29, 6, 3, fo)
    for (let y = 6; y < 28; y += 7) r(3, y, 4, 1, fo)
    if (mort) { r(4, 12, 2, 5, '#2a2622'); r(5, 18, 1, 4, '#2a2622'); r(3, 22, 1, 2, '#7a3a1a') }
    else { r(4, 9, 1, 3, '#8a4a22'); r(5, 20, 1, 2, '#8a4a22') }
  })
  // la poutre du rail : 8 px répétables (un rivet, une rainure)
  for (const mort of [false, true]) toile(mort ? 'rail_poutre_mort' : 'rail_poutre', 8, 6, (r) => {
    r(0, 0, 8, 6, mort ? '#3e3a36' : '#4a525c'); r(0, 0, 8, 1, mort ? '#5a524a' : '#7a838e'); r(0, 5, 8, 1, '#22262a')
    r(3, 2, 1, 1, mort ? '#6a3a1a' : '#2e343b'); if (mort) r(6, 3, 2, 1, '#7a4422')
  }, false)
  // la rame vue de côté : 48 × 26, accrochée au rail par deux bogies ; image 0 portes fermées, 1 ouvertes
  const W = 48, H = 26
  const cote = scene.textures.createCanvas('rame_cote', W * 2, H)!
  const c = cote.getContext()
  for (let f = 0; f < 2; f++) {
    const o = f * W
    const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(o + x, y, w, h) }
    // les bogies sur le rail
    r(8, 0, 6, 4, '#2e343b'); r(34, 0, 6, 4, '#2e343b'); r(10, 4, 2, 2, '#40464e'); r(36, 4, 2, 2, '#40464e')
    // la caisse : tôle rouillée, plaques rapportées, rivets
    r(2, 6, 44, 17, '#8a5636'); r(2, 6, 44, 2, '#b07848'); r(2, 21, 44, 2, '#4a2a1a')
    r(1, 9, 1, 11, '#6a3e26'); r(46, 9, 1, 11, '#6a3e26')
    r(5, 15, 9, 6, '#7a828a'); r(5, 15, 9, 1, '#a8b0b8'); r(33, 16, 10, 5, '#6a6258'); r(33, 16, 10, 1, '#8e867a')
    for (let x = 6; x < 13; x += 3) r(x, 19, 1, 1, '#3a3e44')
    for (let x = 34; x < 43; x += 3) r(x, 19, 1, 1, '#3a3e44')
    // la bande de la colonie (bleu passé) et le numéro
    r(2, 13, 44, 1, '#4a7a92'); r(39, 9, 1, 3, '#d8c8a0'); r(41, 9, 2, 1, '#d8c8a0'); r(42, 10, 1, 2, '#d8c8a0')
    // les vitres (des trous : on voit l'intérieur et le soldat par-derrière)
    for (const x of [5, 12, 31]) { c.clearRect(o + x, 8, 5, 4) }
    // la porte au milieu
    if (f === 0) { r(19, 8, 10, 13, '#7a4a2e'); r(23, 8, 1, 13, '#3a2214'); r(20, 9, 3, 3, '#1c2a32'); r(25, 9, 3, 3, '#1c2a32') }
    else { c.clearRect(o + 20, 8, 8, 13); r(17, 8, 3, 13, '#7a4a2e'); r(28, 8, 3, 13, '#7a4a2e') }
    // les phares et le feu arrière
    r(46, 16, 1, 2, '#ffe9a0'); r(1, 16, 1, 2, '#c03020')
  }
  finish(c, 0, 0, W * 2, H)
  cote.refresh()
  cote.add(0, 0, 0, 0, W, H); cote.add(1, 0, W, 0, W, H)
  // l'intérieur, derrière la caisse : une pénombre chaude
  toile('rame_dedans', W, H, (r) => { r(3, 7, 42, 14, '#1a1410'); r(3, 7, 42, 1, '#3a2a1a') }, false)
  // de face (descendre vers le bas de l'écran) et de dos : 22 × 26
  const fd = scene.textures.createCanvas('rame_face', 44, H)!
  const d = fd.getContext()
  for (let f = 0; f < 2; f++) {
    const o = f * 22
    const r = (x: number, y: number, w: number, h: number, col: string) => { d.fillStyle = col; d.fillRect(o + x, y, w, h) }
    r(8, 0, 6, 5, '#2e343b')
    r(2, 5, 18, 18, '#8a5636'); r(2, 5, 18, 2, '#b07848'); r(2, 21, 18, 2, '#4a2a1a'); r(2, 14, 18, 1, '#4a7a92')
    if (f === 0) { d.clearRect(o + 5, 8, 12, 5); r(4, 17, 3, 2, '#ffe9a0'); r(15, 17, 3, 2, '#ffe9a0'); r(9, 19, 4, 2, '#6a6258') }
    else { r(5, 8, 12, 5, '#3a2a20'); r(5, 17, 2, 2, '#c03020'); r(15, 17, 2, 2, '#c03020'); r(8, 16, 6, 4, '#7a828a') }
  }
  finish(d, 0, 0, 44, H)
  fd.refresh()
  fd.add(0, 0, 0, 0, 22, H); fd.add(1, 0, 22, 0, 22, H)
  toile('rame_face_dedans', 22, H, (r) => { r(4, 7, 14, 7, '#1a1410') }, false)
  // la barge de Relâche (la ligne de mer, Anse-Grise ↔ Relâche) : une coque de ferraille, une cabine ouverte, une
  // cheminée ; vue de côté, 48 × 26 (même cadre que la rame : le soldat s'y assoit de la même façon)
  const bg = scene.textures.createCanvas('barge', W * 2, H)!
  const b = bg.getContext()
  for (let f = 0; f < 2; f++) {
    const o = f * W
    const r = (x: number, y: number, w: number, h: number, col: string) => { b.fillStyle = col; b.fillRect(o + x, y, w, h) }
    // la cheminée et sa fumée accrochée
    r(9, 2, 4, 7, '#3a3e44'); r(9, 2, 4, 1, '#6a7078'); r(10, 1, 2, 1, '#2a2622')
    // la cabine : des planches, un toit de tôle ; ouverte à l'arrière (on voit le soldat)
    r(16, 6, 22, 2, '#6a7480'); r(16, 6, 22, 1, '#a8b2bc')
    r(17, 8, 2, 9, '#6a4a2a'); r(35, 8, 2, 9, '#6a4a2a')
    b.clearRect(o + 19, 8, 16, 8)
    // la coque : ferraille rivetée, la ligne de flottaison, l'étrave relevée
    r(2, 16, 44, 6, '#5a4a3e'); r(2, 16, 44, 1, '#8a7258'); r(4, 22, 40, 2, '#3a2e26'); r(44, 14, 3, 4, '#5a4a3e'); r(44, 14, 3, 1, '#8a7258')
    for (let x = 5; x < 44; x += 4) r(x, 18, 1, 1, '#2e2622')
    r(2, 20, 44, 1, f ? '#c87a3a' : '#b06a32') // la bande orange de la colonie
    r(6, 17, 6, 3, '#7a828a'); r(30, 17, 7, 3, '#6a6258') // deux plaques rapportées
    // le fanal à la proue
    r(45, 12, 1, 2, '#ffe9a0')
  }
  finish(b, 0, 0, W * 2, H)
  bg.refresh()
  bg.add(0, 0, 0, 0, W, H); bg.add(1, 0, W, 0, W, H)
  toile('barge_dedans', W, H, (r) => { r(19, 8, 16, 8, '#1a1410'); r(19, 8, 16, 1, '#3a2a1a') }, false)
}

/** Les créatures des Hauts de Glane (campagne 2) : la moisson de la Glaneuse. ÉDEN y mêle sa chair aux machines. */
function hauts(scene: Phaser.Scene) {
  const rouille = '#8a5230', cuivre = '#c87a3a', acier = '#6a727c', acierC = '#9aa2ac', acierF = '#3a3e44'
  // Glaneur : un moissonneur d'ÉDEN, long et bas, deux faux en avant, une hotte de boulons sur le dos
  shapeSheet(scene, 'glaneur', 20, 14, 2, (c, ox, f) => {
    for (const [x, ph] of [[5, 0], [8, 1], [11, 0], [14, 1]]) line(c, ox + x, 9, ox + x - 1 + ((ph + f) % 2) * 2, 13, PAL.chair1)
    ell(c, ox + 9, 8, 7, 3, PAL.chair2); ell(c, ox + 9, 7, 5.5, 2, PAL.chair3)
    // la hotte : des boulons et une plaque de robot glanés
    c.fillStyle = acierF; c.fillRect(ox + 4, 2, 6, 4); c.fillStyle = acier; c.fillRect(ox + 4, 2, 6, 1)
    for (const [x, y] of [[5, 3], [8, 4], [6, 5]]) dot(c, ox + x, y, cuivre)
    // la tête et les faux, qui fauchent d'une image à l'autre
    ell(c, ox + 16, 7, 2.6, 2.2, PAL.chair3); dot(c, ox + 17, 6, PAL.lueur); dot(c, ox + 18, 7, PAL.lueur)
    line(c, ox + 15, 9, ox + 19, 11 - f * 3, '#d8c8b0'); line(c, ox + 19, 11 - f * 3, ox + 17, 13 - f * 3, '#d8c8b0')
    line(c, ox + 14, 9, ox + 18, 12 - (1 - f) * 2, '#b8a890')
  }, PAL.chair0)
  // Robot retourné : un robot de lignée éteint puis rallumé par ÉDEN, des vrilles dans les jointures, l'œil violet
  shapeSheet(scene, 'retourne', 18, 18, 2, (c, ox, f) => {
    c.fillStyle = acierF; c.fillRect(ox + 5, 14, 2, 3); c.fillRect(ox + 11, 14, 2, 3 - f)
    c.fillStyle = acier; c.fillRect(ox + 3, 6, 12, 9); c.fillStyle = acierC; c.fillRect(ox + 3, 6, 12, 1)
    c.fillStyle = rouille; c.fillRect(ox + 4, 12, 3, 1); c.fillRect(ox + 11, 9, 2, 1)
    // la bande de lignée, grattée
    c.fillStyle = '#4a7a92'; c.fillRect(ox + 3, 10, 12, 1); c.fillStyle = acier; c.fillRect(ox + 8, 10, 2, 1)
    // la tête et l'œil
    c.fillStyle = acier; c.fillRect(ox + 5, 2, 8, 5); c.fillStyle = acierC; c.fillRect(ox + 5, 2, 8, 1)
    c.fillStyle = '#1a0a1e'; c.fillRect(ox + 7, 3, 4, 3); c.fillStyle = PAL.lueur; c.fillRect(ox + 8 + f, 4, 2, 1)
    // les vrilles d'ÉDEN qui sortent des jointures
    line(c, ox + 3, 8, ox + 0, 6 + f, PAL.chair3); line(c, ox + 15, 13, ox + 17, 11 - f, PAL.chair3); line(c, ox + 9, 2, ox + 10, 0, PAL.chair4)
    // le canon
    c.fillStyle = acierF; c.fillRect(ox + 14, 8, 3, 2); dot(c, ox + 17, 8, f ? '#ffd27a' : acierF)
  })
  // Bourgeon-espion : une tige, un bourgeon, un seul œil qui regarde (il ne bouge pas : il compte)
  shapeSheet(scene, 'bourgeon', 14, 18, 2, (c, ox, f) => {
    ell(c, ox + 7, 16.5, 4, 1.5, PAL.chair1)
    line(c, ox + 7, 15, ox + 6, 9, '#4a6a2a', 2)
    line(c, ox + 6, 12, ox + 3, 11, '#5a8a3a'); line(c, ox + 7, 13, ox + 10, 12, '#5a8a3a')
    ell(c, ox + 7, 6, 4.5, 5, '#6a9a3a'); ell(c, ox + 7, 5.5, 3.5, 4, '#8aba4a')
    // les sépales entrouverts, et l'œil
    line(c, ox + 3, 4, ox + 5, 1, '#4a7a2a'); line(c, ox + 11, 4, ox + 9, 1, '#4a7a2a')
    ell(c, ox + 7, 6, 2.4, 2.2, '#f0e8d8'); c.fillStyle = PAL.chair2; c.fillRect(ox + 6 + f, 5, 2, 2); dot(c, ox + 6 + f, 5, PAL.lueur)
  })
  // Bouturé : une masse de bois greffé, des branches en guise de bras, des boutures qui lui poussent dans le dos
  shapeSheet(scene, 'bouture', 22, 22, 2, (c, ox, f) => {
    c.fillStyle = '#3a2a1a'; c.fillRect(ox + 6, 17, 3, 4 - f); c.fillRect(ox + 13, 17, 3, 3 + f)
    ell(c, ox + 11, 12, 7.5, 6.5, '#5a4028'); ell(c, ox + 10, 11, 6, 5, '#7a5a36')
    for (let k = 0; k < 6; k++) line(c, ox + 6 + k * 2, 8 + (k % 2), ox + 6 + k * 2, 15, '#4a3420')
    // les bras-branches
    line(c, ox + 4, 11, ox + 1, 6 + f, '#5a4028', 2); line(c, ox + 18, 11, ox + 21, 7 - f, '#5a4028', 2)
    dot(c, ox + 1, 5 + f, '#6aa04a'); dot(c, ox + 21, 6 - f, '#6aa04a')
    // les boutures du dos et la chair qui suinte entre les écorces
    for (const [x, h] of [[7, 4], [11, 6], [15, 3]]) { line(c, ox + x, 6, ox + x, 6 - h, '#4a7a2a'); dot(c, ox + x - 1, 6 - h, '#8aca5a'); dot(c, ox + x + 1, 7 - h, '#8aca5a') }
    for (const [x, y] of [[9, 13], [13, 10], [12, 15]]) dot(c, ox + x, y, PAL.chair4)
    c.fillStyle = PAL.lueur; c.fillRect(ox + 12, 9, 1, 1); c.fillRect(ox + 15, 9, 1, 1)
  })
  // Fileuse : une araignée de cuivre et de chair, un fil tendu qui luit entre ses pattes
  shapeSheet(scene, 'fileuse', 20, 16, 2, (c, ox, f) => {
    for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
      const a = (side < 0 ? Math.PI : 0) + (k - 1.5) * 0.5 * side
      const kx = ox + 10 + Math.cos(a) * 3, ky = 8 + Math.sin(a) * 2
      const ex = kx + Math.cos(a) * 5, ey = ky - 3 + ((k + f) % 2)
      line(c, kx, ky, ex, ey, cuivre); line(c, ex, ey, ex + Math.cos(a) * 2, ey + 6, '#8a4a22')
    }
    ell(c, ox + 10, 9, 4.5, 3.5, PAL.chair2); ell(c, ox + 10, 8, 3.5, 2.5, PAL.chair3)
    // l'abdomen : une bobine de fil
    ell(c, ox + 10, 4, 3, 2.5, '#6a3a1a'); for (let x = 8; x <= 12; x++) dot(c, ox + x, 4, cuivre); dot(c, ox + 10, 3, '#ffd27a')
    // le fil tendu, qui scintille
    line(c, ox + 4, 12, ox + 16, 12, f ? '#ffd27a' : '#c87a3a')
    c.fillStyle = PAL.lueur; c.fillRect(ox + 9, 9, 1, 1); c.fillRect(ox + 11, 9, 1, 1)
  }, PAL.chair0)
  // Pot de bouture : un pot de terre cuite fêlé, une tige qui tremble (il repoussera)
  shapeSheet(scene, 'pot', 12, 14, 2, (c, ox, f) => {
    c.fillStyle = '#8a4a2a'; c.fillRect(ox + 2, 7, 8, 6); c.fillStyle = '#a85a32'; c.fillRect(ox + 1, 6, 10, 2)
    c.fillStyle = '#5a2a1a'; c.fillRect(ox + 3, 12, 6, 1); line(c, ox + 7, 8, ox + 6, 11, '#4a2010')
    line(c, ox + 6, 6, ox + 6 + f, 1, '#5a8a3a'); dot(c, ox + 5 + f, 2, '#8aca5a'); dot(c, ox + 7 + f, 1, '#8aca5a'); dot(c, ox + 6 + f, 0, PAL.lueur)
  })
  // Balise glanée : un trépied de la Colonie, une antenne, une lentille rallumée en violet
  shapeSheet(scene, 'balise', 14, 20, 2, (c, ox, f) => {
    line(c, ox + 7, 12, ox + 2, 19, acierF); line(c, ox + 7, 12, ox + 12, 19, acierF); line(c, ox + 7, 12, ox + 7, 19, acier)
    c.fillStyle = acier; c.fillRect(ox + 4, 7, 7, 6); c.fillStyle = acierC; c.fillRect(ox + 4, 7, 7, 1)
    c.fillStyle = '#1a0a1e'; c.fillRect(ox + 5, 9, 5, 3); c.fillStyle = f ? PAL.lueur : PAL.chair4; c.fillRect(ox + 6, 10, 3, 1)
    line(c, ox + 9, 7, ox + 11, 1, acierC); dot(c, ox + 11, 0, f ? '#ff5a5a' : '#7a2a2a')
    line(c, ox + 4, 12, ox + 2, 10 - f, PAL.chair3)
  })
  // Porte-nom : une silhouette voûtée qui porte une plaque où sont greffés des noms (le Registre)
  shapeSheet(scene, 'portenom', 14, 18, 2, (c, ox, f) => {
    c.fillStyle = PAL.chair1; c.fillRect(ox + 4, 14, 2, 3 - f); c.fillRect(ox + 8, 14, 2, 2 + f)
    ell(c, ox + 7, 10, 4, 5, PAL.chair2); ell(c, ox + 7, 4, 2.5, 2.5, PAL.chair3); dot(c, ox + 8, 4, PAL.lueur)
    // la plaque, tenue devant lui : trois lignes de noms
    c.fillStyle = '#c8b890'; c.fillRect(ox + 2, 8, 10, 6); c.fillStyle = '#e8dcc0'; c.fillRect(ox + 2, 8, 10, 1)
    for (let y = 10; y <= 12; y++) for (let x = 3; x < 11; x += 2) dot(c, ox + x + ((y + f) % 2), y, '#3a2a1a')
    line(c, ox + 2, 9, ox + 1, 12, PAL.chair3); line(c, ox + 12, 9, ox + 13, 12, PAL.chair3)
  })
  // Pylône du Métier : une tour de treillis où pendent des câbles et des morceaux de robots
  shapeSheet(scene, 'pylone', 16, 26, 2, (c, ox, f) => {
    line(c, ox + 3, 25, ox + 7, 2, acierF); line(c, ox + 12, 25, ox + 8, 2, acierF)
    for (let y = 6; y < 25; y += 4) { const k = (25 - y) / 23; line(c, ox + 3 + 4 * (1 - k), y, ox + 12 - 4 * (1 - k), y, acier) }
    for (let y = 6; y < 22; y += 8) { line(c, ox + 5, y, ox + 10, y + 4, acierF); line(c, ox + 10, y, ox + 5, y + 4, acierF) }
    c.fillStyle = acierC; c.fillRect(ox + 6, 0, 4, 3); dot(c, ox + 7 + f, 1, PAL.lueur)
    line(c, ox + 8, 3, ox + 15, 10 + f, cuivre); line(c, ox + 7, 3, ox + 0, 12 - f, cuivre)
    c.fillStyle = acier; c.fillRect(ox + 13, 12 + f, 3, 3); c.fillStyle = rouille; c.fillRect(ox + 0, 13 - f, 2, 2)
  })
  // La Pépinière (Sun-Hee Park) : une botaniste prise dans une armature de serre, la robe en racines plantées dans le
  // sol, des bourgeons-yeux sur les épaules, une couronne de fleurs ; ses mains tiennent un sécateur et un pot (48 × 48)
  shapeSheet(scene, 'pepiniere', 48, 48, 2, (c, ox, f) => {
    // l'armature de verre derrière elle : des montants, des carreaux qui reflètent
    for (const x of [6, 16, 32, 42]) line(c, ox + x, 4, ox + x, 40, '#5a7a6a')
    line(c, ox + 6, 4, ox + 24, 0, '#5a7a6a'); line(c, ox + 42, 4, ox + 24, 0, '#5a7a6a'); line(c, ox + 6, 20, ox + 42, 20, '#4a6a5a')
    for (const [x, y] of [[8, 8], [36, 10], [10, 24], [36, 26]]) { c.fillStyle = 'rgba(180,230,210,0.35)'; c.fillRect(ox + x, y, 5, 8) }
    // la robe de racines, plantée dans la terre
    for (let k = 0; k < 9; k++) { const x0 = ox + 24 + (k - 4) * 1.6, x1 = ox + 24 + (k - 4) * 3.4 + (k % 2 ? f : -f); line(c, x0, 28, x1, 46, k % 2 ? '#5a4028' : '#6a4a2e', 2) }
    ell(c, ox + 24, 45, 13, 2.5, '#3a2a1a')
    // le buste, la blouse de la Constance tachée de sève
    ell(c, ox + 24, 24, 7, 7, '#c8d8c8'); ell(c, ox + 24, 23, 5.5, 5.5, '#e0ece0')
    c.fillStyle = '#4a7a92'; c.fillRect(ox + 18, 22, 12, 1)
    for (const [x, y] of [[21, 26], [26, 24], [23, 28]]) dot(c, ox + x, y, '#8aca5a')
    // les bras : sécateur à gauche, pot à droite, le geste change d'une image à l'autre
    line(c, ox + 18, 21, ox + 11, 25 - f * 2, '#c8d8c8', 2); line(c, ox + 11, 25 - f * 2, ox + 8, 22 - f * 2, '#b8b8b8'); line(c, ox + 11, 25 - f * 2, ox + 8, 26 - f * 3, '#b8b8b8')
    line(c, ox + 30, 21, ox + 37, 25 + f, '#c8d8c8', 2)
    c.fillStyle = '#a85a32'; c.fillRect(ox + 36, 25 + f, 6, 5); c.fillStyle = '#8a4a2a'; c.fillRect(ox + 37, 29 + f, 4, 2); line(c, ox + 39, 25 + f, ox + 39, 20 + f, '#5a8a3a'); dot(c, ox + 39, 19 + f, PAL.lueur)
    // le visage, calme ; les cheveux noirs pris de lierre ; la couronne de fleurs
    ell(c, ox + 24, 13, 4.5, 5, '#e8c8a8'); c.fillStyle = '#1a1a22'; c.fillRect(ox + 19, 8, 10, 3); c.fillRect(ox + 19, 9, 2, 8); c.fillRect(ox + 27, 9, 2, 8)
    c.fillStyle = '#2a1a1a'; c.fillRect(ox + 22, 13, 1, 1); c.fillRect(ox + 25, 13, 1, 1); c.fillStyle = '#b07a6a'; c.fillRect(ox + 23, 16, 2, 1)
    for (let k = 0; k < 5; k++) dot(c, ox + 20 + k * 2, 7 - (k % 2), k % 2 ? '#ff9ad0' : '#ffe08a')
    line(c, ox + 19, 12, ox + 18, 18, '#4a7a2a'); line(c, ox + 29, 12, ox + 30, 17, '#4a7a2a')
    // les bourgeons-yeux sur les épaules : ils regardent le groupe
    for (const x of [15, 33]) { ell(c, ox + x, 18, 3, 3, '#6a9a3a'); ell(c, ox + x, 18, 1.8, 1.6, '#f0e8d8'); dot(c, ox + x - 1 + f, 18, PAL.chair2) }
  }, '#0e1a12')
  // Le Greffier (Tobias Wren) : le médecin de bord, voûté, dans une longue blouse faite de pages cousues ; une plume
  // d'encre à la main, le registre ouvert, des fils de suture au visage (48 × 48)
  shapeSheet(scene, 'greffier', 48, 48, 2, (c, ox, f) => {
    // la blouse de pages : des rectangles crème cousus, qui flottent
    for (let k = 0; k < 7; k++) { const x = ox + 12 + k * 3.5, h = 18 + (k % 3) * 2 + ((k + f) % 2); c.fillStyle = k % 2 ? '#d8ccb0' : '#c8b898'; c.fillRect(Math.round(x), 24, 4, h); c.fillStyle = '#3a2a1a'; c.fillRect(Math.round(x), 28 + (k % 4) * 3, 3, 1) }
    for (let y = 26; y < 42; y += 4) line(c, ox + 12, y, ox + 36, y + 1, '#8a3a3a')
    // le buste voûté, la tête en avant
    ell(c, ox + 24, 22, 9, 6, '#b8ac90'); ell(c, ox + 23, 20, 7, 4, '#d8ccb0')
    c.fillStyle = '#e8e8e8'; c.fillRect(ox + 21, 17, 6, 2) // le col de la blouse de la Constance
    ell(c, ox + 22, 12, 5, 5.5, '#c8b8a0'); ell(c, ox + 21, 11, 4, 4.5, '#d8c8b0')
    // les lunettes rondes, les sutures
    for (const x of [19, 24]) { c.fillStyle = '#1a1a22'; c.fillRect(ox + x, 10, 3, 3); c.fillStyle = f ? '#c8b8ff' : '#8a7ad8'; c.fillRect(ox + x + 1, 11, 1, 1) }
    line(c, ox + 18, 15, ox + 25, 15, '#6a2a2a'); for (let x = 19; x < 25; x += 2) dot(c, ox + x, 14, '#6a2a2a')
    c.fillStyle = '#e0e0e0'; c.fillRect(ox + 18, 6, 8, 2) // les cheveux blancs, rares
    // le registre ouvert dans la main gauche, la plume dans la droite (elle écrit d'une image à l'autre)
    c.fillStyle = '#4a2a1a'; c.fillRect(ox + 6, 24, 12, 8); c.fillStyle = '#f0e8d0'; c.fillRect(ox + 7, 25, 5, 6); c.fillRect(ox + 13, 25, 4, 6)
    for (let y = 26; y < 31; y++) { c.fillStyle = '#3a2a1a'; c.fillRect(ox + 8, y, 3, 1); c.fillRect(ox + 14, y, 2, 1) }
    line(c, ox + 16, 21, ox + 11, 24, '#b8ac90', 2)
    line(c, ox + 31, 21, ox + 38, 26 - f * 2, '#b8ac90', 2); line(c, ox + 38, 26 - f * 2, ox + 43, 17 - f * 2, '#2a1a3a'); line(c, ox + 43, 17 - f * 2, ox + 45, 14 - f * 2, '#e8e0ff')
    dot(c, ox + 38, 27 - f * 2, '#1a0a2a'); if (f) dot(c, ox + 37, 30, '#3a2a5a')
    // des fils qui pendent de ses manches, avec des noms au bout
    line(c, ox + 33, 24, ox + 35, 34 + f, '#8a3a3a'); c.fillStyle = '#e8dcc0'; c.fillRect(ox + 34, 34 + f, 3, 2)
  }, '#120e18')
  // La Glaneuse (Mira Okonkwo) : l'ingénieure refaite par ÉDEN, haute sur six pattes de robot, deux grandes pinces, le
  // métier à tisser dans le dos (des câbles et des robots pendus), une antenne qui émet (64 × 56)
  shapeSheet(scene, 'glaneuse', 64, 56, 2, (c, ox, f) => {
    // les pattes : des membres de robots glanés, chacun d'une autre lignée (une bande de couleur)
    const bandes = ['#4a7a92', '#c87a3a', '#7a9a4a', '#a85a8a', '#d8c060', '#5a6ab0']
    for (let k = 0; k < 6; k++) { const side = k < 3 ? -1 : 1, j = k % 3, kx = ox + 32 + side * (6 + j * 3), ky = 34, ex = ox + 32 + side * (16 + j * 5), ey = 40 + ((j + f) % 2) * 2
      line(c, kx, ky, ex, ky - 6 + j * 2, acier, 2); line(c, ex, ky - 6 + j * 2, ex + side * 2, 54 - j, acierF, 2); dot(c, ex, ky - 6 + j * 2, bandes[k]); void ey }
    // le métier dans le dos : un cadre, des câbles de sève, deux petits robots pendus
    line(c, ox + 18, 4, ox + 18, 28, acierF, 2); line(c, ox + 46, 4, ox + 46, 28, acierF, 2); line(c, ox + 18, 4, ox + 46, 4, acier, 2)
    for (let x = 22; x <= 42; x += 4) line(c, ox + x, 5, ox + x + (x % 8 ? f : -f), 26, x % 8 ? '#8a4a8a' : cuivre)
    for (const x of [24, 38]) { c.fillStyle = acier; c.fillRect(ox + x, 12 + (x === 24 ? f : 1 - f), 5, 5); c.fillStyle = '#1a0a1e'; c.fillRect(ox + x + 1, 13 + (x === 24 ? f : 1 - f), 3, 2) }
    // le corps : chair et plaques rivetées
    ell(c, ox + 32, 30, 11, 8, PAL.chair2); ell(c, ox + 32, 29, 9, 6, PAL.chair3)
    c.fillStyle = acier; c.fillRect(ox + 26, 26, 12, 4); c.fillStyle = acierC; c.fillRect(ox + 26, 26, 12, 1)
    for (const x of [27, 31, 35]) dot(c, ox + x, 28, cuivre)
    // la tête : le visage de Mira, la moitié sous un masque de soudeur, les tresses devenues câbles
    ell(c, ox + 32, 19, 5, 5.5, '#7a4a32'); c.fillStyle = acierF; c.fillRect(ox + 32, 15, 5, 9); c.fillStyle = f ? PAL.lueur : PAL.chair4; c.fillRect(ox + 33, 18, 3, 1)
    c.fillStyle = '#f0e0d0'; c.fillRect(ox + 29, 18, 1, 1)
    for (const [x, l] of [[28, 8], [30, 10], [37, 9]]) line(c, ox + x, 15, ox + x - 1 + (x > 32 ? 2 : -1), 15 + l, '#2a1a1a')
    // l'antenne au sommet du métier : elle émet
    line(c, ox + 32, 4, ox + 32, 0, acierC); dot(c, ox + 32, 0, f ? '#ffd27a' : '#c87a3a')
    if (f) { dot(c, ox + 29, 1, '#ffd27a'); dot(c, ox + 35, 1, '#ffd27a') }
    // les pinces : deux grandes mâchoires de robot de chantier, qui s'ouvrent et se ferment
    for (const side of [-1, 1]) {
      const bx = ox + 32 + side * 10, px = ox + 32 + side * 22
      line(c, bx, 30, px, 36, acier, 3)
      line(c, px, 36, px + side * 6, 32 - f * 2, acierC, 2); line(c, px, 36, px + side * 6, 42 + f * 2, acierC, 2)
      dot(c, px + side * 6, 32 - f * 2, '#e8e0c0'); dot(c, px + side * 6, 42 + f * 2, '#e8e0c0')
    }
  }, '#140c14')
}

export function makeWorldTextures(scene: Phaser.Scene) {
  gares(scene)
  monorail(scene)
  trees(scene)
  creatures(scene)
  small(scene)
  // les Greffés : des colons dont ÉDEN a pris la place
  npcSheet(scene, 'greffe', { peau: '#9a8aa0', cheveux: '#3a2a3a', haut: '#4a3a4a', haut2: '#6a5a6a', bas: '#2a2030', greffe: true })
}
