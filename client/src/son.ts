// Le moteur du son : WebAudio, quatre bus (musique, ambiance, effets, interface) sous un compresseur.
// Les bruitages (client/public/son/sfx, petits) se chargent tous au premier toucher ; les musiques et ambiances
// (boucles plus lourdes) seulement quand on en a besoin. Les fichiers et leurs réglages viennent de
// son-manifest.json, écrit par tools/son/construire.py. iOS refuse le son avant un geste : le contexte naît au
// premier toucher, et se met en pause quand l'app passe en arrière-plan.
import MAN from './son-manifest.json'

export type Bus = 'mus' | 'amb' | 'fx' | 'ui'
interface SfxDef { f: string[]; vol: number; bus: Bus; voix: number; prio: number; var: number; dist: number }
interface BoucleDef { f: string; vol: number; debut?: number; fin?: number }
const SFX = MAN.sfx as Record<string, SfxDef>
const AMB = MAN.amb as Record<string, BoucleDef>
const MUS = MAN.mus as Record<string, BoucleDef>
export const SONS = Object.keys(SFX)
export const AMBIANCES = Object.keys(AMB)
export const MUSIQUES = Object.keys(MUS)

// ------------------------------------------------------------------ réglages (enregistrés sur l'appareil)
export interface Reglages { mus: number; amb: number; fx: number; ui: number; muet: boolean }
const CLE = 'heirline.son'
export const reglages: Reglages = (() => {
  const d: Reglages = { mus: 0.6, amb: 0.7, fx: 0.8, ui: 0.7, muet: false }
  try { return { ...d, ...JSON.parse(localStorage.getItem(CLE) ?? '{}') } } catch { return d }
})()
export function enregistrer() {
  localStorage.setItem(CLE, JSON.stringify(reglages))
  appliquer()
}

let ctx: AudioContext | null = null
let master: GainNode
let comp: DynamicsCompressorNode
const bus = {} as Record<Bus, GainNode>
/** la musique baisse pendant un jingle (victoire, mort) ; le jingle a son propre gain, hors de cette baisse */
let duck: GainNode
let jingles: GainNode

function appliquer() {
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.setTargetAtTime(reglages.muet ? 0 : 1, t, 0.05)
  for (const b of ['mus', 'amb', 'fx', 'ui'] as Bus[]) bus[b].gain.setTargetAtTime(reglages[b] * (b === 'mus' ? 0.8 : 1), t, 0.05)
  jingles.gain.setTargetAtTime(reglages.mus * 0.8, t, 0.05)
}

// ------------------------------------------------------------------ déverrouillage (iOS : au premier geste)
function relancer() {
  if (!ctx || ctx.state === 'running' || document.hidden) return
  ctx.resume().catch(() => {})
}

export function deverrouiller() {
  if (ctx) return relancer()
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return
  ctx = new AC({ latencyHint: 'interactive' })
  master = ctx.createGain()
  comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2
  master.connect(comp).connect(ctx.destination)
  duck = ctx.createGain()
  duck.connect(master)
  jingles = ctx.createGain()
  jingles.connect(master)
  for (const b of ['mus', 'amb', 'fx', 'ui'] as Bus[]) { bus[b] = ctx.createGain(); bus[b].connect(b === 'mus' ? duck : master) }
  appliquer()
  // iOS : un son muet joué dans le geste ouvre la sortie audio
  const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource()
  s.buffer = b; s.connect(ctx.destination); s.start(0)
  relancer()
  for (const id of SONS) for (const f of SFX[id].f) charger(f)
  // ce qui a été demandé avant le premier geste
  if (voulu.mus) { const m = voulu.mus; voulu.mus = ''; musique(m) }
  if (voulu.amb) { const a = voulu.amb; voulu.amb = ''; ambiance(a) }
}
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, deverrouiller, { capture: true, passive: true })
document.addEventListener('visibilitychange', () => {
  if (!ctx) return
  if (document.hidden) ctx.suspend().catch(() => {})
  else relancer()
})
addEventListener('pagehide', () => { ctx?.suspend().catch(() => {}) })
addEventListener('pageshow', relancer)

export const pret = () => !!ctx && ctx.state === 'running'

// ------------------------------------------------------------------ chargement
const tampons = new Map<string, AudioBuffer>()
const enCours = new Map<string, Promise<AudioBuffer | null>>()
function charger(f: string): Promise<AudioBuffer | null> {
  const hit = tampons.get(f)
  if (hit) return Promise.resolve(hit)
  let p = enCours.get(f)
  if (!p) {
    p = fetch(f).then((r) => r.arrayBuffer()).then((a) => new Promise<AudioBuffer>((ok, ko) => ctx!.decodeAudioData(a, ok, ko)))
      .then((b) => { tampons.set(f, b); return b }).catch(() => null)
    enCours.set(f, p)
  }
  return p
}

// ------------------------------------------------------------------ l'auditeur (le soldat) et la spatialisation
const ecoute = { x: 0, y: 0 }
export function auditeur(x: number, y: number) { ecoute.x = x; ecoute.y = y }
/** à moins de PROCHE px, plein volume ; au-delà de LOIN, plus rien */
const PROCHE = 90, LOIN = 520
function spatial(x: number | undefined, y: number | undefined, dist: number): [number, number] {
  if (x === undefined || y === undefined || dist <= 0) return [1, 0]
  const dx = x - ecoute.x, d = Math.hypot(dx, y - ecoute.y)
  const a = Math.max(0, Math.min(1, 1 - (d - PROCHE) / (LOIN - PROCHE)))
  return [1 - dist + dist * a * a, Math.max(-1, Math.min(1, dx / 340)) * 0.75 * dist]
}

// ------------------------------------------------------------------ les bruitages
interface Voix { src: AudioBufferSourceNode; t0: number; prio: number; id: string }
const voix = new Map<string, Voix[]>()
let total = 0
const MAX_VOIX = 28
const dernier = new Map<string, number>()

function arreter(v: Voix) {
  try { v.src.stop() } catch { /* déjà fini */ }
}

export interface Opts { x?: number; y?: number; vol?: number; rate?: number }
/** joue le bruitage id ; avec x, y : plus faible et décalé selon la distance au soldat */
export function joue(id: string, o: Opts = {}) {
  const d = SFX[id]
  if (!d || !ctx || reglages.muet || ctx.state !== 'running') return
  const [att, pan] = spatial(o.x, o.y, d.dist)
  const g = d.vol * (o.vol ?? 1) * att
  if (g < 0.008) return
  const liste = voix.get(id) ?? []
  // trop de ce même son à la fois : on coupe le plus ancien (son important) ou on se tait (son de décor)
  if (liste.length >= d.voix) { if (d.prio < 1) return; arreter(liste[0]) }
  if (total >= MAX_VOIX) {
    if (d.prio === 0) return
    for (const l of voix.values()) { const v = l.find((x) => x.prio === 0); if (v) { arreter(v); break } }
  }
  // une variante, jamais la même deux fois de suite
  let i = Math.floor(Math.random() * d.f.length)
  if (d.f.length > 1 && i === dernier.get(id)) i = (i + 1) % d.f.length
  dernier.set(id, i)
  const buf = tampons.get(d.f[i])
  if (!buf) { charger(d.f[i]); return }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * d.var)
  const gain = ctx.createGain()
  gain.gain.value = g
  let sortie: AudioNode = gain
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; gain.connect(p); sortie = p }
  src.connect(gain)
  sortie.connect(bus[d.bus])
  const v: Voix = { src, t0: ctx.currentTime, prio: d.prio, id }
  liste.push(v); voix.set(id, liste); total++
  src.onended = () => {
    const l = voix.get(id); if (l) { const k = l.indexOf(v); if (k >= 0) { l.splice(k, 1); total-- } }
    src.disconnect(); gain.disconnect(); if (sortie !== gain) sortie.disconnect()
  }
  src.start()
}

// ------------------------------------------------------------------ boucles : musique, ambiance, sons qui durent
interface Piste { id: string; src: AudioBufferSourceNode | null; gain: GainNode; jeton: number }
const voulu = { mus: '', amb: '' }
let jeton = 0

function lancer(def: BoucleDef, b: Bus | AudioNode, vol: number, fondu: number, boucle = true): Piste {
  const gain = ctx!.createGain()
  gain.gain.value = 0
  gain.connect(typeof b === 'string' ? bus[b] : b)
  const p: Piste = { id: def.f, src: null, gain, jeton: ++jeton }
  charger(def.f).then((buf) => {
    if (!buf || !ctx || p.jeton < 0) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    if (boucle) {
      src.loop = true
      src.loopStart = def.debut ?? 0
      src.loopEnd = Math.min(buf.duration, def.fin ?? buf.duration)
    }
    src.connect(gain)
    src.start()
    gain.gain.setTargetAtTime(vol, ctx.currentTime, fondu / 3)
    p.src = src
  })
  return p
}
function eteindre(p: Piste | null, fondu: number) {
  if (!p || !ctx) return
  p.jeton = -1
  const t = ctx.currentTime
  p.gain.gain.cancelScheduledValues(t)
  p.gain.gain.setTargetAtTime(0, t, fondu / 3)
  const src = p.src
  setTimeout(() => { try { src?.stop() } catch { /* fini */ } p.gain.disconnect() }, fondu * 1000 + 200)
}

let pisteMus: (Piste & { nom: string }) | null = null
/** change de musique, en fondu enchaîné ; null : silence */
export function musique(nom: string | null, fondu = 2.5) {
  if (!ctx) { voulu.mus = nom ?? ''; return }
  if ((pisteMus?.nom ?? null) === nom) return
  eteindre(pisteMus, fondu)
  pisteMus = null
  const d = nom ? MUS[nom] : null
  if (d && nom) pisteMus = { ...lancer(d, 'mus', d.vol, fondu), nom }
}
export const musiqueCourante = () => pisteMus?.nom ?? null

/** un jingle (victoire, mort) : la musique baisse le temps qu'il passe */
export function jingle(nom: string) {
  const d = MUS[nom]
  if (!d || !ctx || reglages.muet) return
  const p = lancer(d, jingles, d.vol, 0.05, false)
  const t = ctx.currentTime
  duck.gain.cancelScheduledValues(t)
  duck.gain.setTargetAtTime(0.2, t, 0.15)
  charger(d.f).then((b) => {
    const dur = b?.duration ?? 8
    setTimeout(() => { if (ctx) duck.gain.setTargetAtTime(1, ctx.currentTime, 1.2); eteindre(p, 0.5) }, dur * 1000)
  })
}

let pisteAmb: (Piste & { nom: string }) | null = null
export function ambiance(nom: string | null, fondu = 3) {
  if (!ctx) { voulu.amb = nom ?? ''; return }
  if ((pisteAmb?.nom ?? null) === nom) return
  eteindre(pisteAmb, fondu)
  pisteAmb = null
  const d = nom ? AMB[nom] : null
  if (d && nom) pisteAmb = { ...lancer(d, 'amb', d.vol, fondu), nom }
}
export const ambianceCourante = () => pisteAmb?.nom ?? null

/** des boucles nommées, en plus (la pluie, le roulement d'une rame) : volume réglable à chaque image */
const couches = new Map<string, Piste & { vol: number }>()
export function couche(cle: string, nom: string | null, vol = 1, b: Bus = 'amb') {
  if (!ctx) return
  const c = couches.get(cle)
  if (!nom || vol <= 0.005) { if (c) { eteindre(c, 1.2); couches.delete(cle) } return }
  const d = AMB[nom]
  if (!d) return
  if (c && c.id === d.f) {
    if (Math.abs(c.vol - vol) > 0.01) { c.vol = vol; c.gain.gain.setTargetAtTime(d.vol * vol, ctx.currentTime, 0.15) }
    return
  }
  if (c) eteindre(c, 1.2)
  couches.set(cle, { ...lancer(d, b, d.vol * vol, 1.2), vol })
}
/** volume d'une couche placée dans le monde (une rame qui passe) */
export function attenuation(x: number, y: number) { return spatial(x, y, 1)[0] }

/** pour les captures vidéo : la sortie du jeu en flux (MediaRecorder) */
export function flux(): MediaStream | null {
  if (!ctx) return null
  const d = ctx.createMediaStreamDestination()
  comp.connect(d)
  return d.stream
}

/** pour les tests et les captures : ce qui joue */
export function etat() {
  return { pret: pret(), musique: musiqueCourante(), ambiance: ambianceCourante(), couches: [...couches.keys()], voix: total, tampons: tampons.size }
}
