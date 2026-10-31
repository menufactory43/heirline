// Les recettes d'effets d'Heirline, écrites une fois ici puis posées en JSON dans vfx/recettes/.
// Rendu : vfx/construire.mjs (npm run vfx). Moteur : outils/pixel-vfx (Scenario, gardé en local, hors dépôt) ; sans lui, vfx/construire.mjs garde les images déjà rendues.
//
// Règles (voir outils/pixel-vfx/references/vfx-craft.md) : une forme dominante lisible au téléphone, un éclair d'une
// ou deux images, une expansion rapide puis une dissipation lente, deux rampes au plus, la densité de pixels des
// personnages (16 px) : un projectile tient dans 12 à 32 px, un impact dans 12 à 40 px.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const DOSSIER = path.join(ICI, 'recettes')

// les couleurs d'ÉDEN : un violet maladif qui vire au vert acide
const EDEN = ['#1a0820', '#3d1240', '#6e1f6a', '#a8358f', '#d85bb0', '#f2a0d4', '#ffe0f2']
const ACIDE = ['#0f1a08', '#25400f', '#3f6e14', '#6fa81e', '#a8e030', '#d8ff6a', '#f6ffd0']
const ROUILLE = ['#1a0e08', '#40200f', '#6e3a14', '#a85a1e', '#e08a30', '#ffc36a', '#fff0d0']
const SEVE = ['#08160c', '#0f3418', '#1a5e26', '#2e9a3a', '#6ad66a', '#c0f7b0', '#ffffff']
const CYAN = ['#08141f', '#0f2a40', '#145a7a', '#1e90b0', '#4fd0e8', '#a8f4ff', '#f0ffff']

const R = []
const add = (r) => { R.push({ outline: 'outside', fps: 15, frames: 16, loop: false, seed: 1, pivot: [0.5, 0.5], ...r }); return r }

// ------------------------------------------------------------------ les tirs des héros, par classe et palier
// palier 1 : niv 1–4 · 2 : 5–9 · 3 : 10–14 · 4 : 15 et plus. Le palier 1 est un traceur militaire ; le 4 est un sort.
const CLASSES = {
  // le Fantassin : solaire, doré, puis sacré
  fan: { ramps: ['solar', 'gold', 'fire', 'holy'], spark: ['gold', 'gold', 'solar', 'white'], forme: 'star', taille: [[18, 6], [22, 8], [28, 10], [32, 12]] },
  // le Médic : vert de sève, puis blanc sacré
  med: { ramps: ['nature', 'nature', SEVE, SEVE], spark: ['white', 'white', 'holy', 'holy'], forme: 'cross', taille: [[16, 6], [20, 8], [24, 10], [28, 12]] },
  // l'Ingénieur : électrique, bleu-cyan, puis plasma
  ing: { ramps: ['energy', 'lightning', 'ice', 'lightning'], spark: ['white', 'white', 'lightning', 'arcane'], forme: 'plus', taille: [[12, 5], [14, 6], [17, 7], [20, 8]], plombs: true },
  // l'Éclaireur : un trait de givre long et fin, puis blanc pur
  ecl: { ramps: ['ice', 'ice', 'frost', 'white'], spark: ['white', 'white', 'ice', 'holy'], forme: 'diamond', taille: [[22, 4], [26, 5], [30, 6], [34, 7]] },
  // le Démolisseur : une grenade qui fume, puis une boule de lave
  dem: { ramps: ['fire', 'fire', 'lava', 'lava'], spark: ['ash', 'gold', 'fire', 'solar'], forme: 'chunk', taille: [[12, 7], [14, 8], [16, 9], [18, 10]] },
  // le Brouilleur : des arcs violets, puis le vide
  bro: { ramps: ['arcane', 'arcane', 'plasma', 'void'], spark: ['white', 'arcane', 'lightning', 'arcane'], forme: 'ring', taille: [[12, 5], [14, 6], [16, 7], [18, 8]] },
}

for (const [c, d] of Object.entries(CLASSES)) {
  for (let t = 1; t <= 4; t++) {
    const [w, h] = d.taille[t - 1]
    const main = d.ramps[t - 1], spark = d.spark[t - 1]
    // le projectile, en boucle
    // les unités suivent le petit côté : la demi-largeur vaut w / h ; la tête vers la droite, la traîne derrière
    const k = w / h, tete = k - 0.75
    const layers = [
      { type: 'comet', ramp: '$main', r: 0.5 + t * 0.04, len: k * 1.35, speed: 2, x: tete, rough: 0.55 },
    ]
    if (t >= 2) layers.push({ type: 'particles', ramp: '$spark', mode: 'spray', count: 3 + t * 3, dir: 180, spread: 30, speed: [1, 2.2], life: [0.3, 0.7], shape: t >= 3 ? d.forme : 'dot', x: tete - 0.4, size: [1, 1] })
    if (t >= 3) layers.push({ type: 'orb', ramp: '$spark', r: 0.3, spin: 1, x: tete, gain: 0.75 })
    if (t >= 4) layers.push({ type: 'particles', ramp: '$spark', mode: 'orbit', count: 3, orbitR: 0.7, turns: 1, x: tete, shape: 'diamond', life: [0.6, 0.9] })
    if (c === 'ing' && t >= 3) layers.push({ type: 'bolt', ramp: '$spark', mode: 'radial', count: 2, len: 0.7, x: tete, hold: 2, gain: 0.8 })
    if (c === 'bro' && t >= 2) layers.push({ type: 'bolt', ramp: '$spark', mode: 'radial', count: 1 + t, len: 0.8, x: tete, hold: 2, gain: 0.8 })
    if (c === 'dem') layers.unshift({ type: 'puffs', ramp: 'smoke', count: 3, spread: 0.3, rise: 0.1, dir: 180, x: tete - 1, gain: 0.5 })
    add({ name: `tir-${c}-${t}`, w, h, frames: 8, fps: 15, loop: true, seed: 3 + t, ramps: { main, spark }, layers })

    // l'éclair de bouche
    const m = 12 + t * 3
    const ml = [
      { type: 'star', ramp: '$main', points: t >= 3 ? 6 : 4, r: 0.5 + t * 0.08, inner: 0.25, pop: 0.3 },
      { type: 'particles', ramp: '$spark', mode: 'spray', count: 3 + t * 2, dir: 0, spread: 50, speed: [1.6, 3], life: [0.4, 0.8], shape: 'streak', size: [1, 1] },
      { type: 'flash', ramp: '$main', r: 0.32 + t * 0.04, dur: 0.18 },
    ]
    if (t >= 3) ml.unshift({ type: 'rays', ramp: '$spark', count: 6 + t, r: 0.85, gain: 0.6, t1: 0.7 })
    add({ name: `bouche-${c}-${t}`, w: m, h: m, frames: 6, fps: 20, seed: 7 + t, ramps: { main, spark }, layers: ml })

    // l'impact
    // l'impact grandit avec le palier mais reste à l'échelle des soldats (16 px) : 15 à 24 px
    // le fusil à pompe tire six plombs : des impacts plus petits, sinon la gerbe fait une tache
    const s = d.plombs ? 10 + t * 2 : 12 + t * 3
    const il = [
      { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.85, th: 0.24, breakup: 0.6 },
      { type: 'particles', ramp: '$spark', mode: 'burst', count: 5 + t * 3, speed: [2, 3.2], drag: 2.4, shape: t >= 3 ? d.forme : 'streak', size: [1, 1] },
      { type: 'flash', ramp: '$main', r: 0.35 + t * 0.04, dur: 0.12 },
    ]
    if (t >= 2) il.splice(1, 0, { type: 'star', ramp: '$spark', points: 4 + t, r: 0.45 + t * 0.07, pop: 0.25 })
    if (t >= 4) il.unshift({ type: 'glyph', ramp: '$main', r: 0.9, star: c === 'med' ? 0 : 5, runes: 6, ticks: 12, draw: 0.25, gain: 0.55, t1: 0.8 })
    if (c === 'ing' && t >= 2) il.push({ type: 'bolt', ramp: '$spark', mode: 'radial', count: 2 + t, len: 0.8, hold: 2, fadeStart: 0.4 })
    if (c === 'med' && t >= 3) il.push({ type: 'particles', ramp: '$spark', mode: 'rise', count: 4, shape: 'cross', speed: [0.6, 1], life: [0.6, 1], area: 0.4 })
    add({ name: `impact-${c}-${t}`, w: s, h: s, frames: 10, fps: 20, seed: 11 + t, ramps: { main, spark }, layers: il })
  }
}

// ------------------------------------------------------------------ le robot : un laser cyan qui gagne en puissance
for (let t = 1; t <= 4; t++) {
  const w = 14 + t * 3, h = 6 + t, k = w / h
  const main = t <= 2 ? CYAN : 'ice', spark = t >= 4 ? 'arcane' : 'white'
  const layers = [
    { type: 'comet', ramp: '$main', r: 0.5, len: k * 1.5, speed: 2, x: k - 0.7, rough: 0.25 },
  ]
  if (t >= 2) layers.push({ type: 'orb', ramp: '$spark', r: 0.3, spin: 1, x: k - 0.7, gain: 0.7 })
  if (t >= 3) layers.push({ type: 'particles', ramp: '$spark', mode: 'spray', count: 6, dir: 180, spread: 25, speed: [1, 2], life: [0.3, 0.6], shape: 'square', x: k - 1.2 })
  add({ name: `tir-rob-${t}`, w, h, frames: 8, loop: true, seed: 20 + t, ramps: { main, spark }, layers })
  const s = 12 + t * 4
  add({ name: `impact-rob-${t}`, w: s, h: s, frames: 8, fps: 20, seed: 30 + t, ramps: { main, spark }, layers: [
    { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.8, th: 0.22 },
    { type: 'particles', ramp: '$spark', mode: 'burst', count: 4 + t * 2, speed: [2, 3], drag: 2.4, shape: 'square' },
    { type: 'flash', ramp: '$main', r: 0.4, dur: 0.12 },
  ] })
}
add({ name: 'tir-garde', w: 14, h: 6, frames: 8, loop: true, seed: 3, ramps: { main: 'gold', spark: 'white' }, layers: [
  { type: 'comet', ramp: '$main', r: 0.5, len: 3, speed: 2, x: 1.6, rough: 0.3 },
] })

// ------------------------------------------------------------------ les compétences
add({ name: 'bouclier', w: 32, h: 32, frames: 12, fps: 12, loop: true, seed: 2, ramps: { main: 'frost' }, outline: 'none', layers: [
  { type: 'bubble', ramp: '$main', r: 0.86, th: 0.08, hex: 0.45, cell: 0.2, fill: 0.14, shimmer: 1 },
] })
add({ name: 'bouclier-pose', w: 40, h: 40, frames: 10, fps: 20, seed: 3, ramps: { main: 'frost', spark: 'white' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.9, r1: 0.5, th: 0.18, ease: 'outQuart' },
  { type: 'particles', ramp: '$spark', mode: 'implode', count: 12, implodeR: 0.9, shape: 'diamond' },
  { type: 'flash', ramp: '$main', r: 0.5, dur: 0.14 },
] })
add({ name: 'grenade', w: 64, h: 64, frames: 18, fps: 16, seed: 4, ramps: { main: 'fire', smoke: 'smoke', spark: 'gold' }, layers: [
  { type: 'puffs', ramp: '$smoke', count: 8, t0: 0.18, spread: 0.45, rise: 0.5, gain: 0.8 },
  { type: 'burst', ramp: '$main', r1: 0.62, rough: 0.6, erode: 1 },
  { type: 'ring', ramp: '$main', r0: 0.15, r1: 0.98, th: 0.16, breakup: 0.8, squash: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 18, speed: [2.2, 3.6], drag: 2, shape: 'chunk', gravity: 1.5, size: [2, 1] },
  { type: 'flash', ramp: '$main', r: 0.55, dur: 0.1 },
] })
add({ name: 'injection', w: 128, h: 72, frames: 16, fps: 15, seed: 5, ramps: { main: 'nature', spark: 'holy' }, pivot: [0.5, 0.6], layers: [
  { type: 'ring', ramp: '$main', r0: 0.15, r1: 1.4, th: 0.12, squash: 0.5, y: 0.2, breakup: 0.5 },
  { type: 'glyph', ramp: '$spark', r: 0.55, squash: 0.5, y: 0.2, star: 0, runes: 8, ticks: 16, draw: 0.3, gain: 0.6 },
  { type: 'pillar', ramp: '$spark', w: 0.18, hgt: 1.1, y: 0.25, gain: 0.55 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 14, shape: 'cross', speed: [0.6, 1.2], life: [0.6, 1], areaX: 1.1, areaY: 0.3, y: 0.2 },
] })
add({ name: 'adrenaline', w: 96, h: 64, frames: 12, fps: 18, seed: 6, ramps: { main: 'gold', spark: 'white' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.2, r1: 1.1, th: 0.1, squash: 0.55 },
  { type: 'streaks', ramp: '$spark', mode: 'speed', count: 10, len: 0.6, spanY: 0.8 },
  { type: 'particles', ramp: '$main', mode: 'rise', count: 10, shape: 'chevron', speed: [1, 1.6], life: [0.5, 0.9], areaX: 0.9 },
] })
add({ name: 'surcharge', w: 28, h: 32, frames: 12, fps: 12, loop: true, seed: 7, ramps: { main: 'lightning', spark: 'white' }, pivot: [0.5, 0.75], layers: [
  { type: 'flame', ramp: '$main', w: 0.6, hgt: 1.2, hollow: 0.85, y: 0.5, speed: 2, gain: 0.8 },
  { type: 'bolt', ramp: '$spark', mode: 'radial', count: 3, len: 0.7, hold: 2, y: 0.2 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 6, shape: 'plus', life: [0.4, 0.8], areaX: 0.5, y: 0.4 },
] })
add({ name: 'surcharge-pose', w: 40, h: 40, frames: 10, fps: 20, seed: 8, ramps: { main: 'thunder', spark: 'lightning' }, layers: [
  { type: 'bolt', ramp: '$spark', mode: 'strike', count: 2, hold: 2 },
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.9, th: 0.2, squash: 0.5, y: 0.3 },
  { type: 'flash', ramp: '$main', r: 0.5, dur: 0.12 },
] })
add({ name: 'tourelle', w: 40, h: 32, frames: 12, fps: 18, seed: 9, ramps: { main: 'steel', spark: 'gold' }, pivot: [0.5, 0.7], layers: [
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 1, th: 0.14, squash: 0.4, y: 0.4 },
  { type: 'cracks', ramp: '$main', count: 5, len: 0.7, y: 0.4, gain: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 10, shape: 'square', gravity: 2, speed: [1.5, 2.5], y: 0.3 },
  { type: 'flash', ramp: '$spark', r: 0.35, dur: 0.12, y: 0.3 },
] })
add({ name: 'esquive', w: 32, h: 20, frames: 8, fps: 20, seed: 10, ramps: { main: 'wind', spark: 'white' }, outline: 'none', layers: [
  { type: 'streaks', ramp: '$main', mode: 'speed', count: 6, len: 1.2, spanY: 0.7, angle: 180 },
  { type: 'puffs', ramp: '$main', count: 4, spread: 0.3, rise: 0.2, gain: 0.6, x: -0.5 },
] })
add({ name: 'monture', w: 24, h: 14, frames: 8, fps: 16, seed: 11, ramps: { main: 'dust', spark: 'lightning' }, outline: 'none', pivot: [0.5, 0.7], layers: [
  { type: 'puffs', ramp: '$main', count: 5, spread: 0.5, rise: 0.4, gain: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'spray', count: 3, dir: 180, spread: 60, speed: [1, 2], life: [0.3, 0.6], shape: 'dot' },
] })
add({ name: 'niveau', w: 56, h: 72, frames: 20, fps: 15, seed: 12, ramps: { main: 'gold', spark: 'holy' }, pivot: [0.5, 0.82], layers: [
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.95, th: 0.14, squash: 0.35, y: 0.62 },
  { type: 'pillar', ramp: '$spark', w: 0.3, hgt: 1.6, y: 0.62, gain: 0.7 },
  { type: 'particles', ramp: '$main', mode: 'rise', count: 14, shape: 'chevron', speed: [1, 1.8], life: [0.5, 1], areaX: 0.6, y: 0.5 },
  { type: 'text', ramp: '$main', text: 'NIVEAU', y: -0.6, rise: 0.25, t0: 0.2 },
  { type: 'flash', ramp: '$spark', r: 0.4, dur: 0.1, y: 0.4 },
] })
add({ name: 'quete', w: 44, h: 44, frames: 16, fps: 15, seed: 13, ramps: { main: 'gold', spark: 'white' }, layers: [
  { type: 'rays', ramp: '$main', count: 10, r: 0.9, gain: 0.7 },
  { type: 'star', ramp: '$spark', points: 5, r: 0.55, pop: 0.3 },
  { type: 'particles', ramp: '$main', mode: 'burst', count: 10, shape: 'coin', speed: [1.4, 2.4], gravity: 1.2 },
] })
add({ name: 'releve', w: 48, h: 80, frames: 20, fps: 14, seed: 14, ramps: { main: 'holy', spark: 'frost' }, pivot: [0.5, 0.85], layers: [
  { type: 'pillar', ramp: '$main', w: 0.4, hgt: 1.9, y: 0.7, gain: 0.8 },
  { type: 'ring', ramp: '$spark', r0: 0.2, r1: 1, th: 0.12, squash: 0.35, y: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 12, shape: 'diamond', speed: [1, 1.6], areaX: 0.5, y: 0.6 },
  { type: 'flash', ramp: '$main', r: 0.35, dur: 0.12, y: 0.6 },
] })
// le robot qui danse sur la place de Port-Ancre : un sol qui s'allume en rythme et des étincelles de toutes les couleurs
add({ name: 'danse', w: 32, h: 28, frames: 16, fps: 12, loop: true, seed: 21, ramps: { main: 'rainbow', spark: 'rainbow' }, outline: 'none', pivot: [0.5, 0.78], layers: [
  { type: 'glyph', ramp: '$main', r: 0.75, squash: 0.35, y: 0.55, rings: [1, 0.7], star: 0, runes: 0, ticks: 16, draw: 0, spin: 1, gain: 0.55 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 10, shape: 'star', speed: [0.8, 1.4], life: [0.5, 0.9], areaX: 0.8, y: 0.3, twinkle: 1, size: [2, 1], heat: [1, 0.6] },
  { type: 'particles', ramp: 'hue:300', mode: 'rise', count: 5, shape: 'diamond', speed: [0.6, 1.1], life: [0.5, 0.9], areaX: 0.8, y: 0.3, seed: 3 },
  { type: 'particles', ramp: '$spark', mode: 'orbit', count: 3, orbitR: 0.75, turns: 1, y: -0.1, shape: 'diamond', squash: 0.5 },
] })
add({ name: 'repare', w: 32, h: 32, frames: 12, fps: 18, seed: 15, ramps: { main: CYAN, spark: 'gold' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.9, th: 0.18 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 12, shape: 'square', speed: [1.5, 2.8], gravity: 1 },
  { type: 'flash', ramp: '$main', r: 0.4, dur: 0.12 },
] })
add({ name: 'avantposte', w: 48, h: 56, frames: 16, fps: 15, seed: 16, ramps: { main: CYAN, spark: 'white' }, pivot: [0.5, 0.75], layers: [
  { type: 'pillar', ramp: '$main', w: 0.3, hgt: 1.5, y: 0.5, gain: 0.7 },
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 1, th: 0.12, squash: 0.35, y: 0.5 },
  { type: 'glyph', ramp: '$spark', r: 0.6, squash: 0.35, y: 0.5, star: 6, runes: 6, draw: 0.35, gain: 0.6 },
] })
add({ name: 'avantposte-veille', w: 40, h: 20, frames: 12, fps: 10, loop: true, seed: 17, ramps: { main: CYAN }, outline: 'none', layers: [
  { type: 'glyph', ramp: '$main', r: 0.95, star: 6, runes: 6, ticks: 18, draw: 0, spin: 1, gain: 0.55 },
] })

// ------------------------------------------------------------------ ÉDEN, les machines, le monde
add({ name: 'pj-acide', w: 12, h: 12, frames: 8, fps: 12, loop: true, seed: 2, ramps: { main: ACIDE, spark: ACIDE }, layers: [
  { type: 'orb', ramp: '$main', r: 0.55, spin: 1, pulse: 0.1, pulseRate: 2 },
  { type: 'particles', ramp: '$spark', mode: 'fall', count: 3, life: [0.4, 0.8], shape: 'drop' },
] })
add({ name: 'pj-laser', w: 20, h: 6, frames: 8, loop: true, seed: 3, ramps: { main: 'blood', spark: 'fire' }, layers: [
  { type: 'comet', ramp: '$main', r: 0.55, len: 4.5, speed: 2, x: 2.6, rough: 0.2 },
] })
add({ name: 'pj-epine', w: 16, h: 8, frames: 8, loop: true, seed: 4, ramps: { main: EDEN, spark: EDEN }, layers: [
  { type: 'comet', ramp: '$main', r: 0.5, len: 2.6, speed: 2, x: 1.25, rough: 0.8 },
  { type: 'particles', ramp: '$spark', mode: 'spray', count: 4, dir: 180, spread: 30, life: [0.3, 0.6], shape: 'shard', x: 0.2 },
] })
add({ name: 'impact-acide', w: 20, h: 20, frames: 10, fps: 18, seed: 5, ramps: { main: ACIDE, spark: ACIDE }, layers: [
  { type: 'burst', ramp: '$main', r1: 0.6, rough: 0.7, erode: 1 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 8, shape: 'drop', gravity: 2, speed: [1.2, 2.2] },
] })
add({ name: 'impact-joueur', w: 16, h: 16, frames: 8, fps: 20, seed: 6, ramps: { main: 'blood', spark: 'white' }, layers: [
  { type: 'star', ramp: '$main', points: 5, r: 0.7, pop: 0.25 },
  { type: 'particles', ramp: '$main', mode: 'burst', count: 6, shape: 'streak', speed: [2, 3] },
  { type: 'flash', ramp: '$spark', r: 0.35, dur: 0.12 },
] })
add({ name: 'mort-eden', w: 32, h: 32, frames: 14, fps: 16, seed: 7, ramps: { main: EDEN, alt: ACIDE, spark: ACIDE }, layers: [
  { type: 'burst', ramp: '$main', r1: 0.7, rough: 0.8, wobble: 0.6, erode: 1 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 12, shape: 'drop', gravity: 1.6, speed: [1.4, 2.6] },
  { type: 'puffs', ramp: '$alt', count: 4, t0: 0.3, spread: 0.4, gain: 0.5 },
] })
add({ name: 'mort-eden-boss', w: 96, h: 96, frames: 24, fps: 14, seed: 8, ramps: { main: EDEN, alt: ACIDE, spark: ACIDE }, layers: [
  { type: 'puffs', ramp: '$alt', count: 10, t0: 0.25, spread: 0.6, rise: 0.6, gain: 0.6 },
  { type: 'burst', ramp: '$main', r1: 0.75, rough: 0.8, wobble: 0.7, erode: 1 },
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 1, th: 0.12, breakup: 0.7 },
  { type: 'spikes', ramp: '$main', count: 7, spread: 0.8, y: 0.3 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 28, shape: 'drop', gravity: 1.4, speed: [1.6, 3.2] },
  { type: 'flash', ramp: '$main', r: 0.5, dur: 0.1 },
] })
add({ name: 'mort-machine', w: 32, h: 32, frames: 14, fps: 16, seed: 9, ramps: { main: ROUILLE, smoke: 'smoke', spark: 'gold' }, layers: [
  { type: 'puffs', ramp: '$smoke', count: 5, t0: 0.2, spread: 0.4, rise: 0.6, gain: 0.7 },
  { type: 'burst', ramp: '$main', r1: 0.55, rough: 0.5, erode: 1 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 12, shape: 'shard', gravity: 2, speed: [1.6, 3] },
  { type: 'flash', ramp: '$spark', r: 0.4, dur: 0.1 },
] })
add({ name: 'mort-bete', w: 24, h: 24, frames: 12, fps: 16, seed: 10, ramps: { main: 'dust', spark: 'blood' }, layers: [
  { type: 'puffs', ramp: '$main', count: 5, spread: 0.4, rise: 0.4, gain: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 6, shape: 'chunk', gravity: 2, speed: [1, 2] },
] })
add({ name: 'eclosion', w: 28, h: 28, frames: 12, fps: 16, seed: 11, ramps: { main: ACIDE, spark: EDEN }, layers: [
  { type: 'spikes', ramp: '$spark', count: 5, spread: 0.6, y: 0.3 },
  { type: 'particles', ramp: '$main', mode: 'burst', count: 8, shape: 'bubble', speed: [1, 2] },
] })
add({ name: 'boum-eden', w: 64, h: 64, frames: 16, fps: 16, seed: 12, ramps: { main: EDEN, spark: ACIDE }, layers: [
  { type: 'burst', ramp: '$main', r1: 0.8, rough: 0.8, wobble: 0.5, erode: 1 },
  { type: 'ring', ramp: '$main', r0: 0.2, r1: 1, th: 0.14, breakup: 0.8, squash: 0.6 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 16, shape: 'drop', gravity: 1.2, speed: [1.6, 3] },
  { type: 'flash', ramp: '$spark', r: 0.5, dur: 0.1 },
] })
add({ name: 'tele-glyphe', w: 64, h: 64, frames: 16, fps: 12, loop: true, seed: 13, ramps: { main: EDEN }, outline: 'none', layers: [
  { type: 'glyph', ramp: '$main', r: 0.95, star: 7, runes: 10, ticks: 28, draw: 0, spin: 1, gain: 0.8 },
] })
add({ name: 'spores', w: 96, h: 64, frames: 24, fps: 10, loop: true, seed: 14, ramps: { main: EDEN }, outline: 'none', layers: [
  { type: 'particles', ramp: '$main', mode: 'ambient', count: 14, shape: 'dot', life: [0.5, 0.9], gain: 0.7 },
  { type: 'particles', ramp: '$main', mode: 'rise', count: 5, shape: 'bubble', life: [0.4, 0.8], areaX: 1, gain: 0.6 },
] })
add({ name: 'gare', w: 24, h: 24, frames: 12, fps: 14, loop: true, seed: 15, ramps: { main: 'lightning', spark: CYAN }, outline: 'none', pivot: [0.5, 0.8], layers: [
  { type: 'particles', ramp: '$main', mode: 'spray', count: 6, dir: -90, spread: 80, speed: [1, 2], life: [0.3, 0.7], gravity: 2, shape: 'dot' },
  { type: 'orb', ramp: '$spark', r: 0.18, spin: 1, y: 0.3, gain: 0.6 },
] })

// ------------------------------------------------------------------ l'arène de la Couveuse (shared/motifs.ts, server/world/arene.ts)
// les balles des motifs : de petits astres lumineux qui se lisent sur la chair sombre ; le rayon de touche est plus
// petit que l'image (2 px de soldat + 3 px de balle), comme dans un jeu de tir à défilement
const SPORE = ['#1a1404', '#40300a', '#7a5a10', '#c09018', '#ffd040', '#fff09a', '#ffffff']
const ROSE = ['#1a0614', '#4a0f3a', '#8a1a6a', '#d0359a', '#ff6bd8', '#ffc0f0', '#ffffff']
add({ name: 'balle-acide', w: 12, h: 12, frames: 8, fps: 14, loop: true, seed: 40, ramps: { main: ACIDE }, outline: 'outside', outlineColor: '#0b1a04', layers: [
  { type: 'orb', ramp: '$main', r: 0.62, spin: 1, pulse: 0.12, pulseRate: 2, gain: 1.15, rim: 0.5 },
] })
add({ name: 'balle-spore', w: 12, h: 12, frames: 8, fps: 14, loop: true, seed: 41, ramps: { main: SPORE }, outline: 'outside', outlineColor: '#1a1004', layers: [
  { type: 'orb', ramp: '$main', r: 0.58, spin: 1, pulse: 0.1, pulseRate: 2, gain: 1.1 },
  { type: 'star', ramp: '$main', points: 4, r: 0.75, inner: 0.2, pop: 0, hollow: 0, t1: 1, gain: 0.8 },
] })
add({ name: 'balle-eden', w: 12, h: 12, frames: 8, fps: 14, loop: true, seed: 42, ramps: { main: ROSE }, outline: 'outside', outlineColor: '#1a0414', layers: [
  { type: 'orb', ramp: '$main', r: 0.64, spin: 1, pulse: 0.14, pulseRate: 2, gain: 1.15, rim: 0.45 },
] })
add({ name: 'balle-touche', w: 16, h: 16, frames: 8, fps: 20, seed: 43, ramps: { main: ROSE, spark: 'white' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.9, th: 0.25 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 6, shape: 'dot', speed: [1.6, 2.6] },
  { type: 'flash', ramp: '$spark', r: 0.4, dur: 0.15 },
] })
// la chair qui pousse quand le nid se referme : des épines de chair qui jaillissent
add({ name: 'mur-pousse', w: 24, h: 32, frames: 14, fps: 16, seed: 44, ramps: { main: EDEN, spark: ACIDE }, pivot: [0.5, 0.85], layers: [
  { type: 'spikes', ramp: '$main', count: 5, spread: 0.95, hgt: [1.1, 1.7], width: [0.16, 0.24], y: 0.75, grow: 0.3, hold: 0.9 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 8, shape: 'drop', gravity: 2, speed: [1, 2], y: 0.5 },
] })
// le sol arraché : une case se fend, la chair jaillit, l'acide remonte
add({ name: 'sol-arrache', w: 32, h: 32, frames: 14, fps: 16, seed: 45, ramps: { main: EDEN, alt: ACIDE, spark: ACIDE }, layers: [
  { type: 'cracks', ramp: '$alt', count: 6, len: 0.95, squash: 0.8, grow: 0.25 },
  { type: 'spikes', ramp: '$main', count: 3, spread: 0.5, hgt: [0.5, 0.9], y: 0.4, grow: 0.25, hold: 0.5 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 12, shape: 'chunk', gravity: 2, speed: [1.4, 2.6], size: [2, 1] },
  { type: 'flash', ramp: '$spark', r: 0.4, dur: 0.1 },
] })
// l'acide qui bouillonne dans une case arrachée
add({ name: 'sol-bulles', w: 16, h: 16, frames: 12, fps: 10, loop: true, seed: 46, ramps: { main: ACIDE }, outline: 'none', layers: [
  { type: 'particles', ramp: '$main', mode: 'ambient', count: 6, shape: 'bubble', life: [0.5, 0.9], gain: 0.9 },
] })
// les spores qui tombent en colonne : une pluie dorée, puis l'impact au sol
add({ name: 'colonne-spores', w: 32, h: 96, frames: 14, fps: 16, seed: 47, ramps: { main: SPORE, alt: EDEN, spark: 'white' }, pivot: [0.5, 0.95], layers: [
  { type: 'pillar', ramp: '$main', w: 0.55, hgt: 5.4, y: 2.7, speed: 3, rough: 0.7, grow: 0.12, gain: 0.85 },
  { type: 'particles', ramp: '$main', mode: 'fall', count: 26, shape: 'dot', speed: [3, 5], life: [0.3, 0.6], areaX: 0.6, y: -2.4, size: [2, 1] },
  { type: 'puffs', ramp: '$alt', count: 5, t0: 0.15, spread: 0.6, rise: 0.4, y: 2.6, gain: 0.7 },
  { type: 'flash', ramp: '$spark', r: 0.6, dur: 0.1, y: 2.6 },
] })
// l'anneau qui éclate autour d'un soldat
add({ name: 'anneau-boum', w: 96, h: 96, frames: 14, fps: 18, seed: 48, ramps: { main: ROSE, alt: EDEN, spark: 'white' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.4, r1: 1, th: 0.3, breakup: 0.5, ease: 'outQuart' },
  { type: 'ring', ramp: '$alt', r0: 0.3, r1: 0.85, th: 0.18, breakup: 0.8, t0: 0.1 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 14, shape: 'diamond', speed: [1.8, 3] },
] })
// une case du damier qui éclate (la ponte)
add({ name: 'case-boum', w: 32, h: 32, frames: 12, fps: 18, seed: 49, ramps: { main: EDEN, spark: ACIDE }, layers: [
  { type: 'burst', ramp: '$main', r1: 0.7, rough: 0.7, erode: 1 },
  { type: 'spikes', ramp: '$main', count: 3, spread: 0.6, hgt: [0.4, 0.7], y: 0.3, grow: 0.2 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 6, shape: 'drop', gravity: 1.5, speed: [1.2, 2.2] },
] })
// la Couveuse blanchit avant une grosse attaque
add({ name: 'flash-couveuse', w: 128, h: 128, frames: 12, fps: 18, seed: 50, ramps: { main: 'holy', spark: 'white' }, outline: 'none', layers: [
  { type: 'rays', ramp: '$main', count: 14, r: 0.95, width: 0.16, gain: 0.85, t1: 0.8 },
  { type: 'ring', ramp: '$spark', r0: 0.2, r1: 1, th: 0.1, breakup: 0.3 },
  { type: 'flash', ramp: '$spark', r: 0.55, dur: 0.25 },
] })
// un sac de ponte qui crève
add({ name: 'sac-creve', w: 64, h: 64, frames: 18, fps: 16, seed: 51, ramps: { main: ACIDE, alt: EDEN, spark: ACIDE }, layers: [
  { type: 'puffs', ramp: '$alt', count: 7, t0: 0.2, spread: 0.5, rise: 0.4, gain: 0.6 },
  { type: 'burst', ramp: '$main', r1: 0.75, rough: 0.8, wobble: 0.6, erode: 1 },
  { type: 'ring', ramp: '$alt', r0: 0.15, r1: 1, th: 0.14, breakup: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 24, shape: 'drop', gravity: 1.6, speed: [1.6, 3.2] },
  { type: 'flash', ramp: '$main', r: 0.5, dur: 0.1 },
] })
// la lueur d'un sac de ponte vivant, en boucle sous son corps
add({ name: 'sac-lueur', w: 40, h: 40, frames: 12, fps: 10, loop: true, seed: 52, ramps: { main: ACIDE }, outline: 'none', layers: [
  { type: 'particles', ramp: '$main', mode: 'rise', count: 7, shape: 'bubble', life: [0.5, 0.9], areaX: 0.6, gain: 0.8 },
  { type: 'orb', ramp: '$main', r: 0.35, spin: 1, pulse: 0.12, gain: 0.45 },
] })


// ------------------------------------------------------------------ les compétences des trois nouvelles classes et des spécialités
// les zones qui durent (en boucle, à l'échelle de leur rayon : 64 px de large = un rayon de 32)
add({ name: 'zone-champ', w: 64, h: 64, frames: 12, fps: 10, loop: true, seed: 60, ramps: { main: 'arcane', spark: 'white' }, outline: 'none', layers: [
  { type: 'glyph', ramp: '$main', r: 0.95, star: 0, runes: 10, ticks: 32, draw: 0.01, spin: 0.25, gain: 0.55 },
  { type: 'bolt', ramp: '$spark', mode: 'radial', count: 3, len: 0.9, hold: 3, gain: 0.5 },
  { type: 'particles', ramp: '$main', mode: 'ambient', count: 10, shape: 'plus', area: 0.8, life: [0.5, 1], gain: 0.7 },
] })
add({ name: 'zone-toxine', w: 64, h: 64, frames: 12, fps: 8, loop: true, seed: 61, ramps: { main: 'poison', spark: 'nature' }, outline: 'none', layers: [
  { type: 'puffs', ramp: '$main', count: 14, spread: 0.92, rise: 0.12, r0: 0.24, r1: 0.42, flat: 0.85, gain: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 8, shape: 'bubble', areaX: 0.8, areaY: 0.5, life: [0.5, 1] },
] })
add({ name: 'zone-brasier', w: 64, h: 64, frames: 12, fps: 12, loop: true, seed: 62, ramps: { main: 'fire', spark: 'solar' }, outline: 'none', layers: [
  { type: 'ring', ramp: '$main', r0: 0.88, r1: 0.92, th: 0.14, thEnd: 0.12, breakup: 0.4, fade: 0, gain: 0.8 },
  { type: 'particles', ramp: '$main', mode: 'rise', count: 18, shape: 'drop', area: 0.92, life: [0.4, 0.8], speed: [0.6, 1.2], gain: 0.9 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 8, shape: 'dot', area: 0.8, life: [0.4, 0.8] },
] })
add({ name: 'zone-perfusion', w: 64, h: 64, frames: 12, fps: 10, loop: true, seed: 63, ramps: { main: SEVE, spark: 'holy' }, outline: 'none', layers: [
  { type: 'ring', ramp: '$main', r0: 0.9, r1: 0.92, th: 0.06, thEnd: 0.05, breakup: 0.2, fade: 0, gain: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 10, shape: 'cross', area: 0.85, life: [0.5, 1], speed: [0.5, 0.9] },
] })
add({ name: 'zone-bastion', w: 64, h: 64, frames: 12, fps: 10, loop: true, seed: 64, ramps: { main: 'gold', spark: 'holy' }, outline: 'none', layers: [
  { type: 'glyph', ramp: '$main', r: 0.95, star: 6, runes: 6, ticks: 24, draw: 0.01, spin: 0.15, gain: 0.5 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 6, shape: 'chevron', area: 0.7, life: [0.5, 1] },
] })
add({ name: 'zone-blindage', w: 32, h: 32, frames: 12, fps: 12, loop: true, seed: 65, ramps: { main: 'steel', spark: CYAN }, outline: 'none', layers: [
  { type: 'bubble', ramp: '$spark', r: 0.8, th: 0.08, hex: 0.45, fill: 0.12, gain: 0.85 },
] })
// les états des créatures, en petites boucles au-dessus d'elles
add({ name: 'etat-marque', w: 16, h: 16, frames: 8, fps: 10, loop: true, seed: 66, ramps: { main: 'blood', spark: 'white' }, outline: 'none', layers: [
  { type: 'glyph', ramp: '$main', r: 0.8, star: 0, rings: [[1, 0.8, 0.5]], ticks: 8, runes: 0, draw: 0.01, spin: 1 },
  { type: 'particles', ramp: '$spark', mode: 'implode', count: 4, shape: 'dot', implodeR: 0.8 },
] })
add({ name: 'etat-etourdi', w: 18, h: 10, frames: 8, fps: 10, loop: true, seed: 67, ramps: { main: 'gold' }, outline: 'none', layers: [
  { type: 'particles', ramp: '$main', mode: 'orbit', count: 3, orbitR: 0.75, turns: 1, shape: 'star', life: [1, 1] },
] })
add({ name: 'etat-feu', w: 14, h: 16, frames: 8, fps: 14, loop: true, seed: 68, ramps: { main: 'fire' }, outline: 'none', pivot: [0.5, 0.85], layers: [
  { type: 'flame', ramp: '$main', w: 0.5, hgt: 1.1, gain: 0.85 },
] })
add({ name: 'etat-ralenti', w: 16, h: 10, frames: 8, fps: 8, loop: true, seed: 69, ramps: { main: 'arcane' }, outline: 'none', layers: [
  { type: 'particles', ramp: '$main', mode: 'fall', count: 4, shape: 'plus', areaX: 0.7, life: [0.6, 1], gain: 0.8 },
] })
// les petites machines : la mine qui clignote, le drone, l'éclat d'un leurre qui s'éteint
add({ name: 'mine', w: 12, h: 12, frames: 8, fps: 6, loop: true, seed: 70, ramps: { main: 'steel', spark: 'blood' }, layers: [
  { type: 'orb', ramp: '$main', r: 0.42, pulse: 0, spin: 0.2, rim: 0.6 },
  { type: 'flash', ramp: '$spark', r: 0.2, dur: 0.3 },
] })
add({ name: 'drone', w: 12, h: 10, frames: 6, fps: 16, loop: true, seed: 71, ramps: { main: 'steel', spark: CYAN }, layers: [
  { type: 'orb', ramp: '$main', r: 0.35, spin: 1, rim: 0.5 },
  { type: 'streaks', ramp: '$spark', mode: 'flow', count: 2, r: 0.9, squash: 0.25, turns: 1, gain: 0.8 },
] })
add({ name: 'leurre-fin', w: 32, h: 32, frames: 10, fps: 16, seed: 72, ramps: { main: 'arcane', spark: 'white' }, layers: [
  { type: 'particles', ramp: '$main', mode: 'burst', count: 16, shape: 'square', speed: [1, 2] },
  { type: 'flash', ramp: '$spark', r: 0.3, dur: 0.15 },
] })
// les éclats des compétences
add({ name: 'onde', w: 96, h: 96, frames: 10, fps: 20, seed: 73, ramps: { main: 'dust', spark: 'gold' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.1, r1: 0.98, th: 0.16, squash: 0.6, breakup: 0.5 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 20, shape: 'chunk', speed: [2, 3.4], drag: 2.2 },
  { type: 'flash', ramp: '$spark', r: 0.3, dur: 0.12 },
] })
add({ name: 'marquage', w: 64, h: 64, frames: 12, fps: 16, seed: 74, ramps: { main: 'blood', spark: 'white' }, layers: [
  { type: 'glyph', ramp: '$main', r: 0.9, star: 0, runes: 4, ticks: 16, draw: 0.3, gain: 0.8 },
  { type: 'ring', ramp: '$spark', r0: 0.95, r1: 0.2, th: 0.1, ease: 'outQuart' },
] })
add({ name: 'court-circuit', w: 64, h: 64, frames: 10, fps: 18, seed: 75, ramps: { main: 'lightning', spark: 'arcane' }, layers: [
  { type: 'bolt', ramp: '$main', mode: 'radial', count: 7, len: 0.95, hold: 1, thick: 1 },
  { type: 'ring', ramp: '$spark', r0: 0.1, r1: 0.9, th: 0.16 },
  { type: 'flash', ramp: '$main', r: 0.4, dur: 0.12 },
] })
add({ name: 'filet', w: 48, h: 48, frames: 12, fps: 14, seed: 76, ramps: { main: 'dust', spark: 'white' }, layers: [
  { type: 'glyph', ramp: '$main', r: 0.9, star: 0, rings: [[1, 0.66, 0.33]], ticks: 12, runes: 0, draw: 0.2, spin: 0 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 10, shape: 'cross', speed: [0.6, 1.2] },
] })
add({ name: 'voile', w: 32, h: 32, frames: 12, fps: 14, seed: 77, ramps: { main: 'shadow', spark: 'arcane' }, layers: [
  { type: 'puffs', ramp: '$main', count: 8, spread: 0.6, rise: 0.4, r0: 0.18, r1: 0.36 },
  { type: 'particles', ramp: '$spark', mode: 'implode', count: 10, shape: 'dot', implodeR: 0.9 },
] })
add({ name: 'ange', w: 40, h: 40, frames: 14, fps: 14, seed: 78, ramps: { main: 'holy', spark: 'white' }, layers: [
  { type: 'pillar', ramp: '$main', w: 0.3, hgt: 1.6, grow: 0.2 },
  { type: 'rays', ramp: '$spark', count: 8, r: 0.9, gain: 0.7 },
  { type: 'particles', ramp: '$spark', mode: 'rise', count: 10, shape: 'petal', area: 0.4 },
] })
add({ name: 'essaim', w: 48, h: 48, frames: 10, fps: 16, seed: 79, ramps: { main: CYAN, spark: 'white' }, layers: [
  { type: 'ring', ramp: '$main', r0: 0.2, r1: 0.9, th: 0.1 },
  { type: 'particles', ramp: '$spark', mode: 'burst', count: 12, shape: 'square', speed: [1, 2] },
] })
add({ name: 'tapis', w: 32, h: 32, frames: 8, fps: 16, seed: 80, ramps: { main: 'fire', spark: 'smoke' }, layers: [
  { type: 'puffs', ramp: '$spark', count: 5, spread: 0.4 },
  { type: 'flash', ramp: '$main', r: 0.3, dur: 0.2 },
] })
// les traits : le tir perforant (un rayon, couché sur la droite, qu'on étire à la longueur voulue) et la Percée
add({ name: 'rayon-perforant', w: 64, h: 12, frames: 8, fps: 18, seed: 81, ramps: { main: 'ice', spark: 'white' }, pivot: [0, 0.5], layers: [
  { type: 'beam', ramp: '$main', len: 5.2, th: 0.5, cap: 0.6, grow: 0.12, x: -2.6 },
  { type: 'particles', ramp: '$spark', mode: 'spray', count: 14, dir: 0, spread: 8, speed: [2, 4], areaX: 2.5, x: 0 },
] })
add({ name: 'trait-percee', w: 64, h: 16, frames: 8, fps: 18, seed: 82, ramps: { main: 'gold', spark: 'solar' }, pivot: [0, 0.5], layers: [
  { type: 'streaks', ramp: '$main', mode: 'speed', count: 6, len: 1.6, spanY: 0.6, speed: 2, angle: 180 },
  { type: 'particles', ramp: '$spark', mode: 'spray', count: 10, dir: 180, spread: 20, speed: [1, 2], areaX: 2 },
] })

fs.rmSync(DOSSIER, { recursive: true, force: true })
fs.mkdirSync(DOSSIER, { recursive: true })
for (const r of R) fs.writeFileSync(path.join(DOSSIER, `${r.name}.json`), JSON.stringify(r, null, 2) + '\n')
console.log(`${R.length} recettes dans ${path.relative(process.cwd(), DOSSIER)}/`)
