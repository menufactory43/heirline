// Les langues du jeu : français et anglais. Tout texte montré au joueur passe par une clé.
//  - Les textes de l'interface et les messages du serveur : fr/*.ts et en/*.ts (même forme, vérifiée par TypeScript).
//  - Le contenu (quêtes, PNJ, lieux, objets…) : le français reste dans les fiches de shared/ (la source), l'anglais
//    est dans contenu/*.ts, par identifiant ; tests/i18n.test.ts vérifie qu'il ne manque rien.
// Une valeur peut contenir des paramètres {nom} (avec une forme : {nom:de}, {nom:min}, {nom:maj}, {nom:Maj}) et un pluriel simple « {n} pièce|{n} pièces » (choisi avec le
// paramètre n). Un paramètre qui commence par « @ » est lui-même une clé (« @station.st_col.nom ») ; un tableau est
// traduit élément par élément et joint par des virgules.
// Le serveur n'envoie pas de texte : il envoie un Msg { k, p } (ou une suite de morceaux) que le client traduit (tx).
import { FR, EN } from './dicos.ts'

export type Lang = 'fr' | 'en'
export const LANGS: Lang[] = ['fr', 'en']
export type Param = string | number | Msg | Param[]
export type Params = Record<string, Param>
/** un texte venu du serveur : une clé et ses paramètres */
export interface Msg { k: string; p?: Params }
/** un texte à afficher : déjà prêt, une clé, ou une suite de morceaux mis bout à bout */
export type Texte = string | Msg | Texte[]

const DICOS: Record<Lang, () => Record<string, string>> = { fr: FR, en: EN }

/** la traduction de k dans la langue l (repli : le français, puis la clé elle-même) */
export function tr(l: Lang, k: string, p?: Params): string {
  const v = DICOS[l]()[k] ?? FR()[k]
  if (v === undefined) return k
  return remplir(l, v, p)
}

function remplir(l: Lang, v: string, p?: Params): string {
  if (v.includes('|') && p && typeof p.n === 'number') {
    const [un, plus] = v.split('|')
    v = (l === 'fr' ? Math.abs(p.n) < 2 : Math.abs(p.n) === 1) ? un : plus
  }
  if (!p) return v
  return v.replace(/\{(\w+)(?::(\w+))?\}/g, (m, nom: string, f?: string) => (nom in p ? forme(valeur(l, p[nom]), f) : m))
}

/** les petites formes : {lieu:de} (« de » + article français contracté), {x:min}, {x:maj}, {x:Maj} (première lettre) */
function forme(v: string, f?: string): string {
  if (f === 'de') return /^Le /.test(v) ? 'du ' + v.slice(3) : /^Les /.test(v) ? 'des ' + v.slice(4) : /^La /.test(v) ? 'de la ' + v.slice(3) : /^L'/.test(v) ? "de l'" + v.slice(2) : /^[AEIOUÉÈ]/.test(v) ? "d'" + v : 'de ' + v
  if (f === 'min') return v.toLowerCase()
  if (f === 'maj') return v.toUpperCase()
  if (f === 'Maj') return v.charAt(0).toUpperCase() + v.slice(1)
  return v
}

function valeur(l: Lang, x: Param): string {
  if (Array.isArray(x)) return x.map((y) => valeur(l, y)).join(', ')
  if (typeof x === 'string' && x.startsWith('@')) return tr(l, x.slice(1))
  if (x && typeof x === 'object') return tr(l, x.k, x.p)
  return String(x)
}

/** un texte du serveur (Msg, morceaux) ou déjà prêt (chaîne), dans la langue l */
export function trx(l: Lang, m: Texte | null | undefined): string {
  if (m == null) return ''
  if (typeof m === 'string') return m
  if (Array.isArray(m)) return m.map((x) => trx(l, x)).join('')
  return tr(l, m.k, m.p)
}

/** fabrique un Msg (côté serveur) */
export const msg = (k: string, p?: Params): Msg => (p ? { k, p } : { k })
/** une référence à une clé, à passer en paramètre */
export const ref = (k: string) => '@' + k

/** existe-t-il une traduction pour k ? */
export function aCle(k: string) { return k in FR() }

// ------------------------------------------------------------------ la langue courante (client)
let courante: Lang = 'fr'
export const CLE_LANGUE = 'heirline.langue'
/** au premier lancement : la langue du navigateur ; ensuite, le réglage gardé */
export function langueDepart(stocke: string | null, navigateur: string | undefined): Lang {
  if (stocke === 'fr' || stocke === 'en') return stocke
  return (navigateur ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en'
}
export function setLang(l: Lang) { courante = l }
export function lang(): Lang { return courante }
/** traduit dans la langue courante */
export function t(k: string, p?: Params): string { return tr(courante, k, p) }
/** traduit un texte du serveur dans la langue courante */
export function tx(m: Texte | null | undefined): string { return trx(courante, m) }

// ------------------------------------------------------------------ causes de mort (gardées en base)
/** une cause de mort à garder en base : un Msg en JSON */
export function cause(k: string, p?: Params) { return JSON.stringify(msg(k, p)) }
/** relit une cause gardée en base : un Msg en JSON, ou un ancien texte français ; `sansNiveau` : « un rampant » */
export function lireCause(s: string, sansNiveau = false): Texte {
  if (s.startsWith('{')) {
    try {
      const m = JSON.parse(s) as Msg
      if (sansNiveau && (m.k === 'srv.tueur.niveau' || m.k === 'srv.tueur.elite') && m.p?.qui) return msg('srv.tueur.sans', { qui: m.p.qui })
      return m
    } catch { /* un ancien texte */ }
  }
  return sansNiveau ? s.replace(/ de niveau \d+$/, '') : s
}
