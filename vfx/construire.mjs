// Rend toutes les recettes de vfx/recettes/ avec le moteur Pixel VFX (outils/pixel-vfx), puis les effets pixelfx
// (vfx/pixelfx.mjs, outils/pixelfx : le moteur prioritaire ; un effet pixelfx remplace la recette du même nom) :
//  - client/public/vfx/<nom>.png : une bande horizontale d'images (spritesheet Phaser) ;
//  - client/src/vfx-manifest.json (et sa copie .ts pour le client) : taille, nombre d'images, fps, boucle, image d'impact, pivot ;
//  - captures/vfx/planche-<groupe>.png : toutes les images agrandies ×4 (plus proche voisin), pour relire.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePNG } from './png.mjs'
import { EFFETS, rendre } from './pixelfx.mjs'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const RECETTES = path.join(RACINE, 'vfx/recettes')
const SORTIE = path.join(RACINE, 'client/public/vfx')
const MANIFESTE = path.join(RACINE, 'client/src/vfx-manifest.json')
const MANIFESTE_TS = path.join(RACINE, 'client/src/vfx-manifest.ts')
const PLANCHES = path.join(RACINE, 'captures/vfx')

// L'ancien moteur (Pixel VFX de Scenario) n'est pas publié avec le dépôt : sans lui, les recettes ne sont pas
// rendues à nouveau, on garde leurs images déjà versionnées (client/public/vfx) et leur ligne du manifeste.
const MOTEUR = path.join(RACINE, 'outils/pixel-vfx/scripts/lib/engine.js')
const avecMoteur = fs.existsSync(MOTEUR)
const render = avecMoteur ? (await import(MOTEUR)).render : null

const manifeste = {}
const rendus = []
const t0 = Date.now()
if (avecMoteur) {
  fs.rmSync(SORTIE, { recursive: true, force: true })
} else {
  console.log('outils/pixel-vfx absent : les anciennes recettes gardent leurs images versionnées, seuls les effets pixelfx sont rendus')
  const ancien = fs.existsSync(MANIFESTE) ? JSON.parse(fs.readFileSync(MANIFESTE, 'utf8')) : {}
  for (const [nom, d] of Object.entries(ancien)) if (!d.pixelfx && fs.existsSync(path.join(SORTIE, `${nom}.png`))) manifeste[nom] = d
}
fs.mkdirSync(SORTIE, { recursive: true })
fs.mkdirSync(PLANCHES, { recursive: true })
for (const f of avecMoteur ? fs.readdirSync(RECETTES).filter((f) => f.endsWith('.json')).sort() : []) {
  const recette = JSON.parse(fs.readFileSync(path.join(RECETTES, f), 'utf8'))
  const nom = f.replace(/\.json$/, '')
  const res = render(recette)
  const { w, h } = res, n = res.frames.length
  const bande = new Uint8ClampedArray(n * w * h * 4)
  res.frames.forEach((img, i) => {
    for (let y = 0; y < h; y++) bande.set(img.subarray(y * w * 4, (y + 1) * w * 4), (y * n * w + i * w) * 4)
  })
  fs.writeFileSync(path.join(SORTIE, `${nom}.png`), encodePNG(n * w, h, bande))
  manifeste[nom] = { w, h, n, fps: res.fps, loop: !!res.loop, impact: res.impact ?? 0, pivot: recette.pivot || [0.5, 0.5] }
  rendus.push({ nom, w, h, frames: res.frames })
}
// pixelfx : rendu au build, recoloré, rogné ; « echelle » dit au jeu comment l'afficher (pixels fins : 0,5)
const FX = path.join(RACINE, 'outils/pixelfx/src/fx')
const bande = (frames, w, h) => {
  const n = frames.length, b = new Uint8ClampedArray(n * w * h * 4)
  frames.forEach((img, i) => { for (let y = 0; y < h; y++) b.set(img.subarray(y * w * 4, (y + 1) * w * 4), (y * n * w + i * w) * 4) })
  return b
}
let remplaces = 0
for (const e of EFFETS) {
  const r = await rendre(e, FX)
  if (manifeste[e.nom]) { remplaces++; const i = rendus.findIndex((x) => x.nom === e.nom); if (i >= 0) rendus.splice(i, 1) }
  fs.writeFileSync(path.join(SORTIE, `${e.nom}.png`), encodePNG(r.frames.length * r.w, r.h, bande(r.frames, r.w, r.h)))
  manifeste[e.nom] = { w: r.w, h: r.h, n: r.frames.length, fps: r.fps, loop: r.loop, impact: r.impact, pivot: r.pivot, echelle: r.echelle, pixelfx: e.fx }
  rendus.push({ nom: e.nom, w: r.w, h: r.h, frames: r.frames })
}
console.log(`pixelfx : ${EFFETS.length} effets (${remplaces} remplacent une recette)`)
fs.writeFileSync(MANIFESTE, JSON.stringify(manifeste, null, 1) + '\n')
fs.writeFileSync(MANIFESTE_TS, `// Généré par vfx/construire.mjs (npm run vfx) : ne pas modifier à la main.\nexport interface VfxDef { w: number; h: number; n: number; fps: number; loop: boolean; impact: number; pivot: number[]; echelle?: number; pixelfx?: string }\nexport const VFX: Record<string, VfxDef> = ${JSON.stringify(manifeste)}\n`)

// les planches : une ligne par effet, ×4, sur un fond de nuit d'Ossara à damier
const PFX = new Set(EFFETS.map((e) => e.nom))
const GROUPES = {
  pixelfx: (n) => PFX.has(n),
  'tirs-fantassin': (n) => /-fan-/.test(n),
  'tirs-medic': (n) => /-med-/.test(n),
  'tirs-ingenieur': (n) => /-ing-/.test(n),
  'tirs-nouvelles': (n) => /-(ecl|dem|bro)-/.test(n),
  'competences-2': (n) => /^(zone-|etat-|mine|drone|leurre-|onde|marquage|court-|filet|voile|ange|essaim|tapis|rayon-|trait-)/.test(n),
  'tirs-robot': (n) => /-rob-|garde/.test(n),
  'eden-monde': (n) => /^(pj-|impact-acide|impact-joueur|mort-|eclosion|boum-|tele-|spores|gare)/.test(n),
  'arene-couveuse': (n) => /^(balle-|mur-|sol-|colonne-|anneau-|case-|flash-|sac-)/.test(n),
}
const groupe = (n) => Object.keys(GROUPES).find((g) => GROUPES[g](n)) || 'competences'
const Z = 4, M = 4
for (const g of [...Object.keys(GROUPES), 'competences']) {
  const liste = rendus.filter((r) => groupe(r.nom) === g)
  if (!liste.length) continue
  const larg = Math.min(4096, Math.max(...liste.map((r) => r.frames.length * (r.w + M))) * Z + M * Z)
  const haut = liste.reduce((s, r) => s + (r.h + M) * Z, M * Z)
  const px = new Uint8ClampedArray(larg * haut * 4)
  for (let y = 0; y < haut; y++) for (let x = 0; x < larg; x++) {
    const c = ((x >> 4) + (y >> 4)) & 1 ? 0x1c : 0x16, o = (y * larg + x) * 4
    px[o] = c; px[o + 1] = c + 4; px[o + 2] = c + 10; px[o + 3] = 255
  }
  let oy = M * Z
  for (const r of liste) {
    r.frames.forEach((img, i) => {
      const ox = (M + i * (r.w + M)) * Z
      if (ox + r.w * Z > larg) return
      for (let y = 0; y < r.h * Z; y++) for (let x = 0; x < r.w * Z; x++) {
        const s = (((y / Z) | 0) * r.w + ((x / Z) | 0)) * 4, a = img[s + 3] / 255
        if (!a) continue
        const o = ((oy + y) * larg + ox + x) * 4
        for (let k = 0; k < 3; k++) px[o + k] = img[s + k] * a + px[o + k] * (1 - a)
      }
    })
    oy += (r.h + M) * Z
  }
  fs.writeFileSync(path.join(PLANCHES, `planche-${g}.png`), encodePNG(larg, haut, px))
}
console.log(`${rendus.length} effets rendus en ${Date.now() - t0} ms → client/public/vfx/, manifeste, planches dans captures/vfx/`)
