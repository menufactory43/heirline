// Les motifs de balles des boss d'arène. Le serveur n'envoie qu'un motif (sa forme, son instant de départ, sa graine
// et quelques paramètres) : le client et le serveur en tirent exactement les mêmes balles, avec le même code. Le
// client les dessine, le serveur vérifie les touches. Une balle est une fonction du temps, sans pas d'intégration :
// la position à l'instant t ne dépend que du motif et de t, jamais de la cadence d'images.
import { TILE, NEST } from './consts.ts'

export type MotifKind = 'serpent' | 'spirale' | 'vague' | 'vise'
export const MOTIF_KINDS: MotifKind[] = ['serpent', 'spirale', 'vague', 'vise']

/** Un motif tel qu'il part sur le réseau (JSON). t0 : le temps du monde où la première balle part. */
export interface Motif { id: number; k: MotifKind; t0: number; seed: number; x: number; y: number; a: number; n: number; p: number }

/** Une balle : départ ts (secondes après t0), point de départ, cap, vitesse, ondulation, durée de vie, rayon, couleur. */
export interface Balle { ts: number; x: number; y: number; a: number; v: number; amp: number; f: number; ph: number; life: number; r: number; c: number }

/** couleurs des balles : 0 acide (sacs), 1 spore (vagues), 2 rose d'ÉDEN (corps) */
export const COULEURS = [0xb6ff4a, 0xffe36a, 0xff6bd8]

/** l'arène de la Couveuse : l'intérieur de l'enclos du nid, en pixels (sans les murs), large pour le paysage */
export const ARENE = { x0: (NEST.x0 + 1) * TILE, x1: NEST.x1 * TILE, y0: (NEST.y0 + 1) * TILE, y1: NEST.y1 * TILE }
export const ARENE_COLS = NEST.x1 - NEST.x0 - 1
export const ARENE_ROWS = NEST.y1 - NEST.y0 - 1
/** la ruche qui se referme (phase 2) : tant de tuiles de chaque côté, et tant par le bas */
export const RETRECI = 3
export const RETRECI_BAS = 2
/** le rayon de touche du soldat face aux balles : petit, comme dans un jeu de tir à défilement */
export const TOUCHE_R = 2

/** le sol de l'arène : 0 intact, 1 fissuré (annonce), 2 acide, 3 vide */
export const SOL = { INTACT: 0, FISSURE: 1, ACIDE: 2, VIDE: 3 } as const

/** Un générateur pseudo-aléatoire à graine (mulberry32) : identique partout, sans Math.random. */
export function graine(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cache = new WeakMap<Motif, Balle[]>()

/** Les balles d'un motif : toujours les mêmes pour le même motif (même graine, mêmes paramètres). */
export function balles(m: Motif): Balle[] {
  let out = cache.get(m)
  if (out) return out
  out = genere(m)
  cache.set(m, out)
  return out
}

function genere(m: Motif): Balle[] {
  const R = graine(m.seed)
  const out: Balle[] = []
  const vie = (v: number) => 640 / v
  switch (m.k) {
    case 'serpent': {
      // un flot d'acide qui balaie et ondule : deux sacs en miroir (p = +1, -1) font deux flots qui se croisent
      const ph0 = R() * 6.28
      for (let i = 0; i < m.n; i++) {
        const a = m.a + m.p * 0.62 * Math.sin(i * 0.19 + ph0)
        out.push({ ts: i * 0.075, x: m.x, y: m.y, a, v: 78, amp: 6, f: 7, ph: i * 0.5, life: vie(78), r: 3, c: 0 })
      }
      break
    }
    case 'spirale': {
      // des bras qui tournent autour du corps ; p donne le sens, n le nombre de pas
      const bras = 3 + Math.floor(R() * 2)
      const pas = 0.21 + R() * 0.05
      for (let i = 0; i < m.n; i++) for (let b = 0; b < bras; b++) {
        const a = m.a + m.p * i * pas + b * Math.PI * 2 / bras
        out.push({ ts: i * 0.11, x: m.x + Math.cos(a) * 10, y: m.y + Math.sin(a) * 10, a, v: 58, amp: 0, f: 0, ph: 0, life: vie(58), r: 3, c: 2 })
      }
      break
    }
    case 'vague': {
      // des rangées de spores qui descendent, chacune avec un trou à trouver ; x et p : bord gauche et largeur
      const pasX = 12
      const cols = Math.floor(m.p / pasX)
      let trouPrec = -1
      for (let rang = 0; rang < m.n; rang++) {
        // le trou se déplace d'une rangée à l'autre, mais reste atteignable (au plus 5 colonnes plus loin)
        let trou = Math.floor(R() * (cols - 3))
        if (trouPrec >= 0 && Math.abs(trou - trouPrec) > 5) trou = trouPrec + Math.sign(trou - trouPrec) * 5
        trouPrec = trou
        for (let c = 0; c <= cols; c++) {
          if (c >= trou && c < trou + 3) continue
          out.push({ ts: rang * 0.95, x: m.x + 6 + c * pasX, y: m.y, a: Math.PI / 2, v: 50, amp: 2, f: 5, ph: c * 0.7, life: vie(50), r: 3, c: 1 })
        }
      }
      break
    }
    case 'vise': {
      // des salves en éventail vers un point (le soldat visé, à l'instant de l'envoi) ; n salves
      for (let s = 0; s < m.n; s++) {
        const d = (R() - 0.5) * 0.12
        for (let i = -2; i <= 2; i++) out.push({ ts: s * 0.32, x: m.x, y: m.y, a: m.a + d + i * 0.17, v: 104, amp: 0, f: 0, ph: 0, life: vie(104), r: 3, c: 2 })
      }
      break
    }
  }
  return out
}

/** La position d'une balle à l'instant t (temps du monde), ou null si elle n'est pas en vol. */
export function posBalle(m: Motif, b: Balle, t: number): { x: number; y: number } | null {
  const d = t - m.t0 - b.ts
  if (d < 0 || d > b.life) return null
  const l = b.v * d, w = b.amp ? b.amp * Math.sin(b.f * d + b.ph) : 0
  const ca = Math.cos(b.a), sa = Math.sin(b.a)
  const x = b.x + ca * l - sa * w, y = b.y + sa * l + ca * w
  // sortie de l'arène (avec une marge : les murs avalent les balles)
  if (x < ARENE.x0 - 10 || x > ARENE.x1 + 10 || y < ARENE.y0 - 40 || y > ARENE.y1 + 10) return null
  return { x, y }
}

/** La fin d'un motif : quand sa dernière balle a quitté l'arène au plus tard. */
export function finMotif(m: Motif) {
  let f = 0
  for (const b of balles(m)) f = Math.max(f, b.ts + b.life)
  return m.t0 + f
}

/** Le soldat touché par une balle de ce motif à l'instant t : l'indice de la balle, ou -1. */
export function touche(m: Motif, t: number, x: number, y: number, mortes?: Set<number>): number {
  const bs = balles(m)
  for (let i = 0; i < bs.length; i++) {
    if (mortes?.has(i)) continue
    const p = posBalle(m, bs[i], t)
    if (p && (p.x - x) ** 2 + (p.y - y) ** 2 < (bs[i].r + TOUCHE_R) ** 2) return i
  }
  return -1
}

/** Les bornes où l'on peut se tenir dans l'arène fermée (la ruche resserrée en phase 2). */
export function borneArene(phase: number) {
  const k = phase >= 2 ? RETRECI * TILE : 0, kb = phase >= 2 ? RETRECI_BAS * TILE : 0
  return { x0: ARENE.x0 + k + 6, x1: ARENE.x1 - k - 6, y0: ARENE.y0 + 6, y1: ARENE.y1 - kb - 6 }
}

/** Ramène un corps dans les bornes : le même calcul côté serveur et dans la prédiction du client. */
export function clampArene(s: { x: number; y: number }, b: { x0: number; x1: number; y0: number; y1: number }) {
  if (s.x < b.x0) s.x = b.x0; else if (s.x > b.x1) s.x = b.x1
  if (s.y < b.y0) s.y = b.y0; else if (s.y > b.y1) s.y = b.y1
}

/** La case du sol sous un point de l'arène, ou -1. */
export function caseSol(x: number, y: number) {
  const cx = Math.floor((x - ARENE.x0) / TILE), cy = Math.floor((y - ARENE.y0) / TILE)
  if (cx < 0 || cy < 0 || cx >= ARENE_COLS || cy >= ARENE_ROWS) return -1
  return cy * ARENE_COLS + cx
}
