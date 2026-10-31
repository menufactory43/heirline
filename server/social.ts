// Le social, pour tout le serveur (toutes les salles tournent dans le même processus) : les canaux de discussion, les
// groupes (XP partagée, butin partagé, marques), les échanges sûrs (double validation côté serveur), les guildes
// (enregistrées dans la base) et les duels consentis (jamais de mort définitive).
// Une lignée (compte) est la clé de tout : un passage d'une carte à l'autre change la session, pas le groupe.
import { db } from './db.ts'
import { msg, ref, type Texte } from '../shared/i18n/index.ts'
import { addToInv, INV_MAX, type Item } from '../shared/items.ts'
import type { CarteId } from '../shared/monde.ts'
import type { PSim } from './world/World.ts'

/** une salle (une copie d'une carte) vue du social */
export interface Salle {
  carte: CarteId
  instance: boolean
  temps(): number
  joueur(sid: string): PSim | undefined
  envoyer(sid: string, type: string, m: unknown): void
  /** le canal local : toute la salle */
  diffuser(type: string, m: unknown): void
  sauver(p: PSim): void
  pousserInv(p: PSim): void
}

export type Canal = 'local' | 'groupe' | 'guilde' | 'monde' | 'prive'
export const CANAUX: Canal[] = ['local', 'groupe', 'guilde', 'monde', 'prive']
export const GROUPE_MAX = 10
export const MARQUES = 5
export const CHAT_MAX = 140
const ECHANGE_DIST = 160, DUEL_DIST = 200, DUEL_FUITE = 420, DUEL_DUREE = 90, DUEL_COMPTE = 3
const INVIT_S = 30

interface Present { account: string; sid: string; salle: Salle; p: PSim }
interface Groupe { id: string; chef: string; membres: string[]; marques: ({ carte: CarteId; x: number; y: number; cible?: string } | null)[] }
interface Invitation { type: 'groupe' | 'guilde' | 'echange' | 'duel'; de: string; jusqua: number }
interface Offre { u: string[]; f: number }
interface Echange { id: string; a: string; b: string; offre: Record<string, Offre>; verrou: Set<string>; ok: Set<string> }

const nomDe = (p: PSim) => `${p.given} ${p.family}`
let nextId = 1

/** Nettoie un message : pas de caractères de contrôle, espaces resserrés, 140 caractères au plus. */
export function nettoyerTexte(t: unknown) {
  return String(t ?? '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX)
}
export const NOM_GUILDE = /^[\p{L}\p{N}][\p{L}\p{N} '’-]{1,22}[\p{L}\p{N}]$/u
export const TAG_GUILDE = /^[A-Z0-9]{2,4}$/

export class Social {
  presents = new Map<string, Present>()
  groupes = new Map<string, Groupe>()
  groupeDe = new Map<string, string>()
  invitations = new Map<string, Invitation>()
  echanges = new Map<string, Echange>()
  echangeDe = new Map<string, string>()
  /** jetons de discussion par lignée (5 messages, un de plus toutes les 1,2 s) */
  jetons = new Map<string, { n: number; t: number }>()
  /** les absents d'un groupe : quand ils sont partis (retirés au bout de 3 minutes) */
  absents = new Map<string, number>()
  /** pour les tests : l'horloge */
  maintenant = () => Date.now() / 1000

  // ------------------------------------------------------------------ présence
  entrer(salle: Salle, p: PSim) {
    if (!p.account || p.bot) return
    this.presents.set(p.account, { account: p.account, sid: p.sid, salle, p })
    this.absents.delete(p.account)
    const g = this.groupeDe.get(p.account)
    if (g) { p.groupe = g; this.pousserGroupe(g) }
    this.pousserGuilde(p.account)
  }
  sortir(account: string, sid: string) {
    const pr = this.presents.get(account)
    if (!pr || pr.sid !== sid) return
    this.presents.delete(account)
    this.annulerEchange(account, 'srv.social.echange_parti')
    if (pr.p.duel) this.finDuel(pr.salle, null, pr.p, 'fuite')
    const g = this.groupeDe.get(account)
    if (g) { this.absents.set(account, this.maintenant()); this.pousserGroupe(g) }
  }
  /** les absents depuis plus de 3 minutes quittent leur groupe ; les invitations périmées tombent */
  balayer() {
    const t = this.maintenant()
    for (const [a, depuis] of this.absents) if (t - depuis > 180) { this.absents.delete(a); this.quitterGroupe(a) }
    for (const [a, inv] of this.invitations) if (inv.jusqua < t) this.invitations.delete(a)
  }
  dire(account: string, t: Texte, color = '#8fb3c9') { const pr = this.presents.get(account); if (pr) pr.salle.envoyer(pr.sid, 'log', { t, color }) }
  envoyer(account: string, type: string, m: unknown) { const pr = this.presents.get(account); if (pr) pr.salle.envoyer(pr.sid, type, m) }
  parNom(nom: string) {
    const n = nettoyerTexte(nom).toLowerCase()
    if (!n) return null
    const tous = [...this.presents.values()]
    return tous.find((pr) => nomDe(pr.p).toLowerCase() === n) ?? (tous.filter((pr) => pr.p.given.toLowerCase() === n).length === 1 ? tous.find((pr) => pr.p.given.toLowerCase() === n)! : null)
  }

  /** l'entrée dans une instance : le groupe de l'instance doit être celui de la lignée selon le serveur (aucun, ou le sien) */
  peutEntrer(account: string, groupeInstance: string) { return (this.groupeDe.get(account) ?? '') === groupeInstance }
  /** le groupe dépasse la taille d'une instance : rend la taille du groupe (membres en ligne), sinon 0 */
  depasse(account: string, seuil: number) {
    const g = this.groupes.get(this.groupeDe.get(account) ?? '')
    const n = g ? g.membres.filter((a) => this.presents.has(a)).length : 0
    return n > seuil ? n : 0
  }

  // ------------------------------------------------------------------ discussion
  chat(account: string, canal: Canal, texte: unknown, a?: string): boolean {
    const pr = this.presents.get(account)
    if (!pr || !CANAUX.includes(canal)) return false
    const t = nettoyerTexte(texte)
    if (!t) return false
    const now = this.maintenant()
    const j = this.jetons.get(account) ?? { n: 5, t: now }
    j.n = Math.min(5, j.n + (now - j.t) / 1.2); j.t = now
    if (j.n < 1) { this.dire(account, msg('srv.social.trop_vite'), '#ff9b6b'); this.jetons.set(account, j); return false }
    j.n -= 1; this.jetons.set(account, j)
    const gm = db().guildeDe(account), tag = gm ? db().guilde(gm.guilde)?.tag : undefined
    const m = { c: canal, de: nomDe(pr.p), t, g: tag }
    if (canal === 'local') pr.salle.diffuser('chat', m)
    else if (canal === 'monde') for (const q of this.presents.values()) q.salle.envoyer(q.sid, 'chat', m)
    else if (canal === 'groupe') {
      const g = this.groupes.get(this.groupeDe.get(account) ?? '')
      if (!g) { this.dire(account, msg('srv.social.pas_de_groupe'), '#ff9b6b'); return false }
      for (const x of g.membres) this.envoyer(x, 'chat', m)
    } else if (canal === 'guilde') {
      if (!gm) { this.dire(account, msg('srv.social.pas_de_guilde'), '#ff9b6b'); return false }
      for (const x of db().membresGuilde(gm.guilde)) this.envoyer(x.account, 'chat', m)
    } else {
      const q = this.parNom(a ?? '')
      if (!q) { this.dire(account, msg('srv.social.introuvable', { qui: nettoyerTexte(a) }), '#ff9b6b'); return false }
      q.salle.envoyer(q.sid, 'chat', m)
      pr.salle.envoyer(pr.sid, 'chat', { ...m, a: nomDe(q.p) })
    }
    return true
  }

  // ------------------------------------------------------------------ invitations
  inviter(account: string, type: Invitation['type'], cibleSid: string, nom?: string) {
    const pr = this.presents.get(account)
    if (!pr) return false
    const q = cibleSid ? [...this.presents.values()].find((x) => x.sid === cibleSid && x.salle === pr.salle) : this.parNom(nom ?? '')
    if (!q || q.account === account) { this.dire(account, msg('srv.social.introuvable', { qui: nettoyerTexte(nom) || '?' }), '#ff9b6b'); return false }
    // l'échange et le duel se font de près, dans la même salle ; un soldat de test n'échange pas
    if (type === 'echange' || type === 'duel') {
      if (q.salle !== pr.salle || Math.hypot(q.p.s.x - pr.p.s.x, q.p.s.y - pr.p.s.y) > (type === 'duel' ? DUEL_DIST : ECHANGE_DIST)) { this.dire(account, msg('srv.social.trop_loin'), '#ff9b6b'); return false }
      if (type === 'echange' && (pr.p.test || q.p.test)) { this.dire(account, msg('srv.social.pas_en_test'), '#ff9b6b'); return false }
      if (type === 'duel' && (pr.salle.instance || pr.p.duel || q.p.duel)) { this.dire(account, msg('srv.social.duel_impossible'), '#ff9b6b'); return false }
    }
    if (type === 'groupe') {
      const g = this.groupes.get(this.groupeDe.get(account) ?? '')
      if (this.groupeDe.has(q.account)) { this.dire(account, msg('srv.social.deja_groupe', { qui: nomDe(q.p) }), '#ff9b6b'); return false }
      if (g && g.chef !== account) { this.dire(account, msg('srv.social.chef_seul'), '#ff9b6b'); return false }
      if (g && g.membres.length >= GROUPE_MAX) { this.dire(account, msg('srv.social.groupe_plein'), '#ff9b6b'); return false }
    }
    if (type === 'guilde') {
      const gm = db().guildeDe(account)
      if (!gm || gm.rang < 1) { this.dire(account, msg('srv.social.officier_seul'), '#ff9b6b'); return false }
      if (db().guildeDe(q.account)) { this.dire(account, msg('srv.social.deja_guilde', { qui: nomDe(q.p) }), '#ff9b6b'); return false }
    }
    this.invitations.set(q.account, { type, de: account, jusqua: this.maintenant() + INVIT_S })
    const gm = type === 'guilde' ? db().guilde(db().guildeDe(account)!.guilde) : undefined
    q.salle.envoyer(q.sid, 'invitation', { type, de: nomDe(pr.p), guilde: gm?.nom })
    this.dire(account, msg('srv.social.invite', { qui: nomDe(q.p) }))
    return true
  }

  repondre(account: string, type: Invitation['type'], oui: boolean) {
    const inv = this.invitations.get(account)
    if (!inv || inv.type !== type || inv.jusqua < this.maintenant()) return false
    this.invitations.delete(account)
    const de = this.presents.get(inv.de), moi = this.presents.get(account)
    if (!de || !moi) return false
    if (!oui) { this.dire(inv.de, msg('srv.social.refuse', { qui: nomDe(moi.p) }), '#ff9b6b'); return false }
    if (type === 'groupe') return this.rejoindreGroupe(inv.de, account)
    if (type === 'guilde') {
      const gm = db().guildeDe(inv.de)
      if (!gm || db().guildeDe(account)) return false
      db().rejoindreGuilde(account, gm.guilde, 0)
      for (const x of db().membresGuilde(gm.guilde)) { this.dire(x.account, msg('srv.social.guilde_rejoint', { qui: nomDe(moi.p) }), '#9fe07a'); this.pousserGuilde(x.account) }
      return true
    }
    if (type === 'echange') return this.ouvrirEchange(inv.de, account)
    return this.debutDuel(de, moi)
  }

  // ------------------------------------------------------------------ groupes
  rejoindreGroupe(chef: string, account: string) {
    let g = this.groupes.get(this.groupeDe.get(chef) ?? '')
    if (this.groupeDe.has(account)) return false
    if (!g) {
      g = { id: 'g' + nextId++, chef, membres: [chef], marques: Array(MARQUES).fill(null) }
      this.groupes.set(g.id, g); this.groupeDe.set(chef, g.id)
    }
    if (g.membres.length >= GROUPE_MAX) { this.dire(account, msg('srv.social.groupe_plein'), '#ff9b6b'); return false }
    g.membres.push(account); this.groupeDe.set(account, g.id)
    const nom = this.presents.get(account) ? nomDe(this.presents.get(account)!.p) : '?'
    for (const x of g.membres) this.dire(x, msg('srv.social.groupe_rejoint', { qui: nom }), '#9fe07a')
    this.pousserGroupe(g.id)
    return true
  }
  quitterGroupe(account: string) {
    const g = this.groupes.get(this.groupeDe.get(account) ?? '')
    if (!g) return false
    g.membres = g.membres.filter((x) => x !== account)
    this.groupeDe.delete(account)
    const pr = this.presents.get(account)
    if (pr) { pr.p.groupe = undefined; pr.salle.envoyer(pr.sid, 'groupe', null) }
    if (g.membres.length <= 1) {
      for (const x of g.membres) { this.groupeDe.delete(x); const q = this.presents.get(x); if (q) { q.p.groupe = undefined; q.salle.envoyer(q.sid, 'groupe', null); this.dire(x, msg('srv.social.groupe_dissous')) } }
      this.groupes.delete(g.id)
      return true
    }
    if (g.chef === account) g.chef = g.membres.find((x) => this.presents.has(x)) ?? g.membres[0]
    for (const x of g.membres) this.dire(x, msg('srv.social.groupe_quitte', { qui: pr ? nomDe(pr.p) : '?' }))
    this.pousserGroupe(g.id)
    return true
  }
  exclure(chef: string, cible: string) {
    const g = this.groupes.get(this.groupeDe.get(chef) ?? '')
    if (!g || g.chef !== chef || !g.membres.includes(cible) || cible === chef) return false
    this.dire(cible, msg('srv.social.exclu'), '#ff9b6b')
    return this.quitterGroupe(cible)
  }
  nommerChef(chef: string, cible: string) {
    const g = this.groupes.get(this.groupeDe.get(chef) ?? '')
    if (!g || g.chef !== chef || !g.membres.includes(cible)) return false
    g.chef = cible
    this.pousserGroupe(g.id)
    return true
  }
  /** une marque (0 à 4) sur un ennemi ou au sol ; la même marque au même endroit l'enlève */
  marquer(account: string, i: number, x: number, y: number, cible?: string) {
    const g = this.groupes.get(this.groupeDe.get(account) ?? '')
    const pr = this.presents.get(account)
    if (!g || !pr || !Number.isInteger(i) || i < 0 || i >= MARQUES || !Number.isFinite(x) || !Number.isFinite(y)) return false
    const m = g.marques[i]
    g.marques[i] = m && m.carte === pr.salle.carte && Math.hypot(m.x - x, m.y - y) < 12 && m.cible === cible ? null : { carte: pr.salle.carte, x: Math.round(x), y: Math.round(y), cible: cible?.slice(0, 24) }
    for (const a of g.membres) this.envoyer(a, 'marques', g.marques)
    return true
  }
  pousserGroupe(id: string) {
    const g = this.groupes.get(id)
    if (!g) return
    const membres = g.membres.map((a) => {
      const pr = this.presents.get(a)
      return { a, nom: pr ? nomDe(pr.p) : db().account(a)?.family ?? '?', en_ligne: !!pr, carte: pr?.salle.carte, sid: pr?.sid, cls: pr?.p.cls, level: pr?.p.level }
    })
    for (const a of g.membres) {
      const pr = this.presents.get(a)
      if (pr) pr.p.groupe = g.id
      this.envoyer(a, 'groupe', { id: g.id, chef: g.chef, moi: a, membres })
      this.envoyer(a, 'marques', g.marques)
    }
  }

  // ------------------------------------------------------------------ guildes
  creerGuilde(account: string, nom: unknown, tag: unknown) {
    const n = nettoyerTexte(nom), t = nettoyerTexte(tag).toUpperCase()
    if (db().guildeDe(account)) { this.dire(account, msg('srv.social.deja_en_guilde'), '#ff9b6b'); return false }
    if (!NOM_GUILDE.test(n) || !TAG_GUILDE.test(t)) { this.dire(account, msg('srv.social.guilde_nom'), '#ff9b6b'); return false }
    if (db().guildeParNom(n)) { this.dire(account, msg('srv.social.guilde_prise', { nom: n }), '#ff9b6b'); return false }
    db().creerGuilde(n, t, account)
    this.dire(account, msg('srv.social.guilde_creee', { nom: n, tag: t }), '#9fe07a')
    this.pousserGuilde(account)
    return true
  }
  quitterGuilde(account: string) {
    const gm = db().guildeDe(account)
    if (!gm) return false
    db().quitterGuilde(account)
    const reste = db().membresGuilde(gm.guilde)
    if (!reste.length) db().supprimerGuilde(gm.guilde)
    else if (gm.rang === 2) db().rangGuilde(reste[0].account, 2) // le plus haut gradé, le plus ancien, devient chef
    this.envoyer(account, 'guilde', null)
    for (const x of reste) this.pousserGuilde(x.account)
    return true
  }
  /** promouvoir (+1) ou rétrograder (-1) : le chef seul ; promouvoir un officier lui passe la tête de la guilde */
  rang(account: string, cible: string, sens: 1 | -1) {
    const a = db().guildeDe(account), b = db().guildeDe(cible)
    if (!a || !b || a.guilde !== b.guilde || a.rang !== 2 || cible === account) return false
    if (sens === 1 && b.rang === 1) { db().rangGuilde(cible, 2); db().rangGuilde(account, 1) }
    else if (sens === 1 && b.rang === 0) db().rangGuilde(cible, 1)
    else if (sens === -1 && b.rang === 1) db().rangGuilde(cible, 0)
    else return false
    for (const x of db().membresGuilde(a.guilde)) this.pousserGuilde(x.account)
    return true
  }
  /** exclure : un officier exclut un membre, le chef exclut tout le monde */
  exclureGuilde(account: string, cible: string) {
    const a = db().guildeDe(account), b = db().guildeDe(cible)
    if (!a || !b || a.guilde !== b.guilde || cible === account || a.rang < 1 || a.rang <= b.rang) return false
    db().quitterGuilde(cible)
    this.envoyer(cible, 'guilde', null); this.dire(cible, msg('srv.social.guilde_exclu'), '#ff9b6b')
    for (const x of db().membresGuilde(a.guilde)) this.pousserGuilde(x.account)
    return true
  }
  pousserGuilde(account: string) {
    if (!this.presents.has(account)) return
    const gm = db().guildeDe(account)
    if (!gm) return this.envoyer(account, 'guilde', null)
    const g = db().guilde(gm.guilde)!
    const membres = db().membresGuilde(gm.guilde).map((m) => { const pr = this.presents.get(m.account); return { a: m.account, nom: pr ? nomDe(pr.p) : m.family, rang: m.rang, en_ligne: !!pr } })
    this.envoyer(account, 'guilde', { nom: g.nom, tag: g.tag, rang: gm.rang, moi: account, membres })
  }

  // ------------------------------------------------------------------ échanges
  ouvrirEchange(a: string, b: string) {
    if (this.echangeDe.has(a) || this.echangeDe.has(b)) return false
    const e: Echange = { id: 'e' + nextId++, a, b, offre: { [a]: { u: [], f: 0 }, [b]: { u: [], f: 0 } }, verrou: new Set(), ok: new Set() }
    this.echanges.set(e.id, e); this.echangeDe.set(a, e.id); this.echangeDe.set(b, e.id)
    this.pousserEchange(e)
    return true
  }
  /** changer son offre : tout verrou et toute confirmation tombent, des deux côtés */
  offrir(account: string, u: unknown, f: unknown) {
    const e = this.echanges.get(this.echangeDe.get(account) ?? '')
    const pr = this.presents.get(account)
    if (!e || !pr) return false
    const uids = [...new Set((Array.isArray(u) ? u : []).map(String))].slice(0, 12).filter((x) => pr.p.inv.some((it) => it.u === x))
    const scrap = db().account(account)?.scrap ?? 0
    const fer = Math.max(0, Math.min(scrap, Math.floor(Number(f) || 0)))
    e.offre[account] = { u: uids, f: fer }
    e.verrou.clear(); e.ok.clear()
    this.pousserEchange(e)
    return true
  }
  verrouiller(account: string) {
    const e = this.echanges.get(this.echangeDe.get(account) ?? '')
    if (!e) return false
    e.verrou.add(account)
    this.pousserEchange(e)
    return true
  }
  /** la seconde validation : seulement quand les deux offres sont verrouillées ; à deux confirmations, l'échange se fait */
  confirmer(account: string) {
    const e = this.echanges.get(this.echangeDe.get(account) ?? '')
    if (!e || e.verrou.size < 2) return false
    e.ok.add(account)
    if (e.ok.size < 2) { this.pousserEchange(e); return true }
    return this.executer(e)
  }
  annulerEchange(account: string, raison = 'srv.social.echange_annule') {
    const e = this.echanges.get(this.echangeDe.get(account) ?? '')
    if (!e) return false
    this.fermerEchange(e)
    for (const x of [e.a, e.b]) this.dire(x, msg(raison), '#ff9b6b')
    return true
  }
  fermerEchange(e: Echange) {
    this.echanges.delete(e.id); this.echangeDe.delete(e.a); this.echangeDe.delete(e.b)
    for (const x of [e.a, e.b]) this.envoyer(x, 'echange', null)
  }
  /** Tout est revérifié au moment de faire : les deux là, dans la même salle, de près, debout, les objets toujours dans
   *  le sac (pas portés), la ferraille en banque, la place dans le sac d'en face. Sinon rien ne bouge. */
  executer(e: Echange) {
    const A = this.presents.get(e.a), B = this.presents.get(e.b)
    const echec = (k: string) => { this.fermerEchange(e); for (const x of [e.a, e.b]) this.dire(x, msg(k), '#ff9b6b'); return false }
    if (!A || !B || A.salle !== B.salle) return echec('srv.social.echange_parti')
    if (A.p.s.etat !== 0 || B.p.s.etat !== 0 || Math.hypot(A.p.s.x - B.p.s.x, A.p.s.y - B.p.s.y) > ECHANGE_DIST) return echec('srv.social.trop_loin')
    const prendre = (pr: Present, o: Offre) => o.u.map((u) => pr.p.inv.find((it) => it.u === u))
    const da = prendre(A, e.offre[e.a]), dbb = prendre(B, e.offre[e.b])
    if (da.some((x) => !x) || dbb.some((x) => !x)) return echec('srv.social.echange_change')
    if ((db().account(e.a)?.scrap ?? 0) < e.offre[e.a].f || (db().account(e.b)?.scrap ?? 0) < e.offre[e.b].f) return echec('srv.social.echange_change')
    // la place : on simule sur des copies
    const apres = (pr: Present, donne: Item[], recoit: Item[]) => {
      const inv = pr.p.inv.filter((it) => !donne.includes(it)).map((it) => ({ ...it }))
      return recoit.every((it) => addToInv(inv, { ...it })) && inv.length <= INV_MAX
    }
    if (!apres(A, da as Item[], dbb as Item[]) || !apres(B, dbb as Item[], da as Item[])) return echec('srv.social.echange_plein')
    A.p.inv = A.p.inv.filter((it) => !da.includes(it)); B.p.inv = B.p.inv.filter((it) => !dbb.includes(it))
    for (const it of dbb as Item[]) addToInv(A.p.inv, it)
    for (const it of da as Item[]) addToInv(B.p.inv, it)
    const fa = e.offre[e.a].f, fb = e.offre[e.b].f
    if (fa) { db().addScrap(e.a, -fa); db().addScrap(e.b, fa) }
    if (fb) { db().addScrap(e.b, -fb); db().addScrap(e.a, fb) }
    for (const pr of [A, B]) { pr.salle.sauver(pr.p); pr.salle.pousserInv(pr.p) }
    console.log(`[echange] ${nomDe(A.p)} ↔ ${nomDe(B.p)} : ${da.length} objet(s) + ${fa} ferraille contre ${dbb.length} objet(s) + ${fb} ferraille`)
    this.fermerEchange(e)
    for (const x of [e.a, e.b]) this.dire(x, msg('srv.social.echange_fait'), '#9fe07a')
    return true
  }
  pousserEchange(e: Echange) {
    const A = this.presents.get(e.a), B = this.presents.get(e.b)
    for (const [moi, lui] of [[A, B], [B, A]] as const) {
      if (!moi) continue
      const vue = (pr: Present | undefined, a: string) => ({ nom: pr ? nomDe(pr.p) : '?', f: e.offre[a].f, objets: e.offre[a].u.map((u) => pr?.p.inv.find((it) => it.u === u)).filter(Boolean), verrou: e.verrou.has(a), ok: e.ok.has(a) })
      this.envoyer(moi.account, 'echange', { moi: vue(moi, moi.account), lui: vue(lui, lui?.account ?? (moi.account === e.a ? e.b : e.a)) })
    }
  }

  // ------------------------------------------------------------------ duels
  debutDuel(a: Present, b: Present) {
    if (a.salle !== b.salle || a.p.duel || b.p.duel || a.salle.instance || a.p.s.etat !== 0 || b.p.s.etat !== 0) return false
    const t = a.salle.temps()
    a.p.duel = { contre: b.p.sid, debut: t + DUEL_COMPTE, fin: t + DUEL_COMPTE + DUEL_DUREE }
    b.p.duel = { contre: a.p.sid, debut: t + DUEL_COMPTE, fin: t + DUEL_COMPTE + DUEL_DUREE }
    for (const [x, y] of [[a, b], [b, a]]) x.salle.envoyer(x.sid, 'duel', { contre: nomDe(y.p), sid: y.sid, dans: DUEL_COMPTE, duree: DUEL_DUREE })
    a.salle.diffuser('log', { t: msg('srv.social.duel_debut', { a: nomDe(a.p), b: nomDe(b.p) }), color: '#ffd36b' })
    return true
  }
  /** la fin d'un duel : PV rendus aux deux, personne à terre, rien de perdu */
  finDuel(salle: Salle, gagnant: PSim | null, perdant: PSim, raison: 'ko' | 'fuite' | 'temps') {
    const autre = gagnant ?? salle.joueur(perdant.duel?.contre ?? '') ?? null
    for (const p of [perdant, autre]) if (p) { p.duel = undefined; p.s.hp = p.s.maxHp; salle.envoyer(p.sid, 'duel', null) }
    const t: Texte = raison === 'temps' || !autre ? msg('srv.social.duel_nul', { a: nomDe(perdant), b: autre ? nomDe(autre) : '?' })
      : msg(raison === 'fuite' ? 'srv.social.duel_fuite' : 'srv.social.duel_gagne', { a: nomDe(autre), b: nomDe(perdant) })
    salle.diffuser('log', { t, color: '#ffd36b' })
  }
  /** chaque seconde, par salle : la fin du temps, la fuite (trop loin, ou parti) */
  step(salle: Salle) {
    const t = salle.temps()
    for (const pr of [...this.presents.values()]) {
      if (pr.salle !== salle || !pr.p.duel) continue
      const d = pr.p.duel, q = salle.joueur(d.contre)
      if (!q || !q.duel) this.finDuel(salle, q ?? null, pr.p, 'fuite')
      else if (t > d.fin) this.finDuel(salle, null, pr.p, 'temps')
      else if (t > d.debut && Math.hypot(q.s.x - pr.p.s.x, q.s.y - pr.p.s.y) > DUEL_FUITE) this.finDuel(salle, q, pr.p, 'fuite')
    }
  }

  // ------------------------------------------------------------------ les messages du client
  action(account: string, m: any) {
    const a = String(m?.a ?? '')
    switch (a) {
      case 'inviter': return this.inviter(account, m.type, String(m.sid ?? ''), m.nom)
      case 'repondre': return this.repondre(account, m.type, !!m.oui)
      case 'quitter': return this.quitterGroupe(account)
      case 'exclure': return this.exclure(account, String(m.qui ?? ''))
      case 'chef': return this.nommerChef(account, String(m.qui ?? ''))
      case 'marquer': return this.marquer(account, Number(m.i), Number(m.x), Number(m.y), m.cible ? String(m.cible) : undefined)
      case 'guilde_creer': return this.creerGuilde(account, m.nom, m.tag)
      case 'guilde_quitter': return this.quitterGuilde(account)
      case 'guilde_rang': return this.rang(account, String(m.qui ?? ''), m.sens === -1 ? -1 : 1)
      case 'guilde_exclure': return this.exclureGuilde(account, String(m.qui ?? ''))
      case 'offre': return this.offrir(account, m.u, m.f)
      case 'verrou': return this.verrouiller(account)
      case 'confirmer': return this.confirmer(account)
      case 'annuler': return this.annulerEchange(account)
      case 'abandon': { const pr = this.presents.get(account); if (pr?.p.duel) { const q = pr.salle.joueur(pr.p.duel.contre); this.finDuel(pr.salle, q ?? null, pr.p, 'fuite') } return true }
      case 'etat': this.pousserGuilde(account); { const g = this.groupeDe.get(account); if (g) this.pousserGroupe(g) } return true
    }
    return false
  }
}

let seul: Social | null = null
export function social() { return (seul ??= new Social()) }
void ref
