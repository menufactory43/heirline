// Le social : discussion (canaux, nettoyage, débit), groupes (XP et butin partagés, marques), échanges sûrs (double
// validation, tout revérifié au moment de faire, rien ne se duplique), guildes (rangs, droits), duels (jamais de mort).
// Base en mémoire : aucune lignée de test dans la vraie base.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Db, setDb, db } from '../server/db.ts'
import { Social, nettoyerTexte, type Salle } from '../server/social.ts'
import { World, type PSim } from '../server/world/World.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { E } from '../shared/rules.ts'
import { material, rollEquip } from '../shared/items.ts'
import { Ossara } from '../server/ossara.ts'
import { Vie } from '../server/world/Vie.ts'

setDb(new Db(':memory:'))

function monde(carte: 'ossara' | 'nid' = 'ossara') {
  const recu: Record<string, { type: string; m: any }[]> = {}
  const tous: { type: string; m: any }[] = []
  const w = new World({ mode: 'secteur', map: carteMap(carte) }, { fx() {}, log() {} })
  const salle: Salle = {
    carte, instance: carte !== 'ossara', temps: () => w.time, joueur: (sid) => w.players.get(sid),
    envoyer: (sid, type, m) => (recu[sid] ??= []).push({ type, m }),
    diffuser: (type, m) => tous.push({ type, m }),
    sauver() {}, pousserInv() {},
  }
  return { w, salle, recu, tous }
}
function soldat(w: World, fam: string, x = 3000, y = 3000) {
  const a = db().createGuest(fam)
  return w.addPlayer({ sid: 's-' + fam, account: a.id, soldierId: 0, given: 'Lou', family: fam, generation: 1, cls: 'fantassin', level: 10, xp: 0, x, y })
}
const dernier = (recu: Record<string, { type: string; m: any }[]>, p: PSim, type: string) => [...(recu[p.sid] ?? [])].reverse().find((r) => r.type === type)?.m

test('discussion : chaque canal va où il doit, texte nettoyé, débit limité', () => {
  const S = new Social()
  const { w, salle, recu, tous } = monde()
  const a = soldat(w, 'Arn'), b = soldat(w, 'Bel'), c = soldat(w, 'Cyr')
  for (const p of [a, b, c]) S.entrer(salle, p)
  assert.equal(nettoyerTexte('  bon\u0000jour\n\t  à  tous '), 'bon jour à tous')
  assert.equal(nettoyerTexte('x'.repeat(500)).length, 140)
  assert.ok(S.chat(a.account, 'local', 'salut'))
  assert.equal(tous.at(-1)!.m.t, 'salut')
  assert.ok(!S.chat(a.account, 'local', '   '), 'vide refusé')
  // privé : seulement l'expéditeur et le destinataire
  assert.ok(S.chat(a.account, 'prive', 'psst', 'Lou Bel'))
  assert.equal(dernier(recu, b, 'chat').t, 'psst'); assert.equal(dernier(recu, c, 'chat'), undefined)
  // groupe sans groupe : refusé
  assert.ok(!S.chat(a.account, 'groupe', 'hop'))
  // débit : cinq d'affilée, pas plus
  let n = 0
  for (let i = 0; i < 10; i++) if (S.chat(c.account, 'monde', 'm' + i)) n++
  assert.equal(n, 5)
})

test('groupe : invitation, chef, dix au plus, départ du chef, marques pour le groupe seulement', () => {
  const S = new Social()
  const { w, salle, recu } = monde()
  const ps = Array.from({ length: 12 }, (_, i) => soldat(w, 'G' + i))
  for (const p of ps) S.entrer(salle, p)
  assert.ok(S.inviter(ps[0].account, 'groupe', ps[1].sid))
  assert.equal(dernier(recu, ps[1], 'invitation').type, 'groupe')
  assert.ok(S.repondre(ps[1].account, 'groupe', true))
  assert.equal(ps[0].groupe, ps[1].groupe); assert.ok(ps[0].groupe)
  assert.ok(!S.inviter(ps[1].account, 'groupe', ps[2].sid), 'seul le chef invite')
  for (let i = 2; i < 10; i++) { S.inviter(ps[0].account, 'groupe', ps[i].sid); S.repondre(ps[i].account, 'groupe', true) }
  assert.equal(S.groupes.get(ps[0].groupe!)!.membres.length, 10)
  assert.ok(!S.inviter(ps[0].account, 'groupe', ps[10].sid), 'plein à dix')
  // une marque : tout le groupe la reçoit, pas les autres
  assert.ok(S.marquer(ps[3].account, 2, 100, 200))
  assert.deepEqual(dernier(recu, ps[7], 'marques')[2], { carte: 'ossara', x: 100, y: 200, cible: undefined })
  assert.equal(dernier(recu, ps[11], 'marques'), undefined)
  assert.ok(S.marquer(ps[3].account, 2, 100, 200)); assert.equal(dernier(recu, ps[7], 'marques')[2], null, 'la même marque l\'enlève')
  // le chef part : un autre devient chef ; la refuse tombe sans rien
  S.quitterGroupe(ps[0].account)
  assert.equal(ps[0].groupe, undefined)
  assert.notEqual(S.groupes.get(ps[1].groupe!)!.chef, ps[0].account)
  assert.ok(!S.repondre(ps[11].account, 'groupe', true), 'pas d\'invitation, pas d\'entrée')
})

test('groupe : l\'XP d\'un coup est partagée (avec un bonus), le butin tourne', () => {
  const S = new Social()
  const { w, salle } = monde()
  const a = soldat(w, 'Xa', 3000, 3000), b = soldat(w, 'Xb', 3040, 3000), c = soldat(w, 'Xc', 3080, 3000)
  for (const p of [a, b, c]) S.entrer(salle, p)
  S.inviter(a.account, 'groupe', b.sid); S.repondre(b.account, 'groupe', true)
  const xp0 = [a.xp, b.xp, c.xp]
  const es = w.spawnEnemy(E.RAMPANT, 3020, 3010, { level: 10 })
  w.killEnemy(es, a)
  const g = [a.xp - xp0[0], b.xp - xp0[1], c.xp - xp0[2]]
  assert.ok(g[0] > 0 && g[0] === g[1], `partagé à parts égales (${g})`)
  assert.ok(g[0] + g[1] > g[2] * 2, 'le groupe gagne plus que la moitié donnée au passant')
  // le butin tourne entre les membres
  const vie = new Vie(w)
  const oss = new Ossara(w, vie, { send() {}, log() {} } as any)
  const vus = new Set<string>()
  oss.loot = (p) => { vus.add(p.account) }
  for (let i = 0; i < 4; i++) oss.onKill(a, w.spawnEnemy(E.RAMPANT, 3020, 3010, { level: 10 }), [a, b])
  assert.deepEqual([...vus].sort(), [a.account, b.account].sort())
})

test('échange : double validation ; une offre changée remet tout à zéro ; tout est revérifié ; rien ne se duplique', () => {
  const S = new Social()
  const { w, salle } = monde()
  const a = soldat(w, 'Ea', 3000, 3000), b = soldat(w, 'Eb', 3050, 3000)
  for (const p of [a, b]) S.entrer(salle, p)
  db().addScrap(a.account, 300)
  const epee = rollEquip('arme', 10, 2, 'fantassin'), herbe = material('herbe', 3)
  a.inv = [epee]; b.inv = [herbe]
  assert.ok(S.inviter(a.account, 'echange', b.sid)); assert.ok(S.repondre(b.account, 'echange', true))
  assert.ok(S.offrir(a.account, [epee.u, 'faux-objet'], 9999))
  const e = S.echanges.get(S.echangeDe.get(a.account)!)!
  assert.deepEqual(e.offre[a.account], { u: [epee.u], f: 300 }, 'objet inconnu ignoré, ferraille plafonnée à la banque')
  S.offrir(b.account, [herbe.u], 0)
  assert.ok(!S.confirmer(a.account), 'pas de confirmation avant les deux verrous')
  S.verrouiller(a.account); S.verrouiller(b.account)
  assert.ok(S.confirmer(a.account))
  // b change son offre : verrous et confirmations tombent
  S.offrir(b.account, [], 0)
  assert.equal(e.verrou.size, 0); assert.equal(e.ok.size, 0)
  assert.ok(!S.confirmer(b.account))
  S.offrir(b.account, [herbe.u], 0); S.verrouiller(a.account); S.verrouiller(b.account)
  S.confirmer(a.account)
  // entre-temps, a dépense sa ferraille ailleurs : l'échange est refusé au moment de faire
  db().addScrap(a.account, -200)
  assert.equal(S.confirmer(b.account), false)
  assert.equal(a.inv.length, 1); assert.equal(b.inv.length, 1); assert.equal(db().account(b.account)!.scrap, 0)
  // on recommence proprement
  S.inviter(a.account, 'echange', b.sid); S.repondre(b.account, 'echange', true)
  S.offrir(a.account, [epee.u], 100); S.offrir(b.account, [herbe.u], 0)
  S.verrouiller(a.account); S.verrouiller(b.account); S.confirmer(b.account)
  assert.ok(S.confirmer(a.account))
  assert.deepEqual(a.inv.map((i) => i.u), [herbe.u]); assert.deepEqual(b.inv.map((i) => i.u), [epee.u])
  assert.equal(db().account(a.account)!.scrap, 0); assert.equal(db().account(b.account)!.scrap, 100)
  // trop loin : refusé
  S.inviter(a.account, 'echange', b.sid); S.repondre(b.account, 'echange', true)
  S.verrouiller(a.account); S.verrouiller(b.account); S.confirmer(a.account)
  b.s.x += 400
  assert.equal(S.confirmer(b.account), false)
  // un soldat de test n'échange pas
  a.test = { boss: 'x', niveau: 1 }
  b.s.x -= 400
  assert.ok(!S.inviter(a.account, 'echange', b.sid))
})

test('échange : un objet porté entre-temps (retiré du sac) annule tout', () => {
  const S = new Social()
  const { w, salle } = monde()
  const a = soldat(w, 'Pa', 3000, 3000), b = soldat(w, 'Pb', 3050, 3000)
  for (const p of [a, b]) S.entrer(salle, p)
  const casque = rollEquip('casque', 10, 1, 'fantassin')
  a.inv = [casque]; b.inv = []
  S.inviter(a.account, 'echange', b.sid); S.repondre(b.account, 'echange', true)
  S.offrir(a.account, [casque.u], 0); S.verrouiller(a.account); S.verrouiller(b.account); S.confirmer(a.account)
  a.inv = []; a.equip.casque = casque
  assert.equal(S.confirmer(b.account), false)
  assert.equal(b.inv.length, 0)
  assert.equal(a.equip.casque, casque)
})

test('guilde : fonder, inviter (officiers), rangs, exclure, chef qui part', () => {
  const S = new Social()
  const { w, salle } = monde()
  const [a, b, c, d] = ['Ga', 'Gb', 'Gc', 'Gd'].map((f) => soldat(w, f))
  for (const p of [a, b, c, d]) S.entrer(salle, p)
  assert.ok(!S.creerGuilde(a.account, 'x', 'AB'), 'nom trop court')
  assert.ok(!S.creerGuilde(a.account, 'Les Veilleurs', 'abcdef'), 'sigle trop long')
  assert.ok(S.creerGuilde(a.account, 'Les Veilleurs', 'vel'))
  assert.ok(!S.creerGuilde(b.account, 'les veilleurs', 'VV'), 'nom déjà pris (sans casse)')
  assert.ok(S.inviter(a.account, 'guilde', b.sid)); assert.ok(S.repondre(b.account, 'guilde', true))
  assert.ok(!S.inviter(b.account, 'guilde', c.sid), 'un membre n\'invite pas')
  assert.ok(S.rang(a.account, b.account, 1)); assert.equal(db().guildeDe(b.account)!.rang, 1)
  assert.ok(S.inviter(b.account, 'guilde', c.sid)); S.repondre(c.account, 'guilde', true)
  assert.ok(!S.exclureGuilde(c.account, b.account), 'un membre n\'exclut pas un officier')
  assert.ok(S.chat(c.account, 'guilde', 'bonjour'))
  assert.ok(!S.chat(d.account, 'guilde', 'moi aussi'), 'hors guilde')
  assert.ok(S.exclureGuilde(b.account, c.account)); assert.equal(db().guildeDe(c.account), undefined)
  // le chef part : l'officier devient chef
  S.quitterGuilde(a.account)
  assert.equal(db().guildeDe(b.account)!.rang, 2)
  S.quitterGuilde(b.account)
  assert.equal(db().guildeParNom('Les Veilleurs'), undefined, 'vide : la guilde disparaît')
})

test('duel : consenti, à 1 PV on perd sans tomber, les autres ne sont pas touchés, la fuite compte', () => {
  const S = new Social()
  const { w, salle, tous } = monde()
  w.hooks.duelFin = (g, p) => S.finDuel(salle, g, p, 'ko')
  const a = soldat(w, 'Da', 3000, 3000), b = soldat(w, 'Db', 3100, 3000), c = soldat(w, 'Dc', 3050, 3000)
  for (const p of [a, b, c]) { S.entrer(salle, p); p.invulT = 0 }
  assert.ok(S.inviter(a.account, 'duel', b.sid)); assert.ok(S.repondre(b.account, 'duel', true))
  assert.ok(a.duel && b.duel)
  // avant le compte à rebours, rien ; ensuite, seul b prend les balles de a (c, entre les deux, est traversé)
  w.time = a.duel!.debut + 0.1
  const hpc = c.s.hp
  for (let i = 0; i < 400 && a.duel; i++) { w.coupDuel(b, 25, a) }
  assert.equal(b.s.etat, 0, 'jamais à terre'); assert.equal(b.s.hp, b.s.maxHp, 'PV rendus'); assert.equal(a.duel, undefined)
  assert.equal(c.s.hp, hpc)
  assert.ok(tous.some((m) => m.m?.t?.k === 'srv.social.duel_gagne'))
  // la fuite : trop loin
  S.inviter(a.account, 'duel', b.sid); S.repondre(b.account, 'duel', true)
  w.time = (a.duel as any).debut + 1
  b.s.x += 600
  S.step(salle)
  assert.equal(a.duel, undefined); assert.ok(tous.some((m) => m.m?.t?.k === 'srv.social.duel_fuite'))
  // pas de duel dans une instance
  const n = monde('nid')
  const x = soldat(n.w, 'Ix', 3000, 3000), y = soldat(n.w, 'Iy', 3050, 3000)
  S.entrer(n.salle, x); S.entrer(n.salle, y)
  x.s.x = y.s.x - 50; x.s.y = y.s.y
  assert.ok(!S.inviter(x.account, 'duel', y.sid))
})

test('duel : les balles touchent l\'adversaire, et lui seul', () => {
  const S = new Social()
  const { w, salle } = monde()
  w.hooks.duelFin = (g, p) => S.finDuel(salle, g, p, 'ko')
  const a = soldat(w, 'Ba', 3000, 3000), b = soldat(w, 'Bb', 3060, 3000), c = soldat(w, 'Bc', 3000, 3060)
  for (const p of [a, b, c]) { S.entrer(salle, p); p.invulT = 0 }
  S.inviter(a.account, 'duel', b.sid); S.repondre(b.account, 'duel', true)
  const debut = a.duel!.debut
  // pendant le compte à rebours, une balle passe à travers
  w.addBullet(a.s.x + 12, a.s.y, 300, 0, 0, 20, 1, a, null)
  w.step(0.2)
  assert.equal(b.s.hp, b.s.maxHp)
  while (w.time < debut) w.step(0.05)
  b.s.x = a.s.x + 60; b.s.y = a.s.y; c.s.x = a.s.x; c.s.y = a.s.y + 60
  w.addBullet(a.s.x + 12, a.s.y, 300, 0, 0, 20, 1, a, null)
  w.addBullet(a.s.x, a.s.y + 12, 0, 300, 0, 20, 1, a, null)
  w.step(0.1); w.step(0.1)
  assert.ok(b.s.hp < b.s.maxHp, 'l\'adversaire est touché')
  assert.equal(c.s.hp, c.s.maxHp, 'le passant non')
})

test('instance : le groupe vient du serveur ; un groupe trop grand est repéré avant d\'entrer', () => {
  const S = new Social()
  const { w, salle } = monde()
  const ps = Array.from({ length: 7 }, (_, i) => soldat(w, 'I' + i))
  for (const p of ps) S.entrer(salle, p)
  for (let i = 1; i < 6; i++) { S.inviter(ps[0].account, 'groupe', ps[i].sid); S.repondre(ps[i].account, 'groupe', true) }
  const g = ps[0].groupe!
  assert.ok(S.peutEntrer(ps[3].account, g), 'un membre entre dans l\'instance de son groupe')
  assert.ok(!S.peutEntrer(ps[6].account, g), 'un autre qui annonce ce groupe est refusé')
  assert.ok(!S.peutEntrer(ps[3].account, ''), 'un membre ne se glisse pas dans une instance sans groupe')
  assert.ok(!S.peutEntrer(ps[3].account, 'g-inventé'))
  assert.ok(S.peutEntrer(ps[6].account, ''), 'seul, une instance sans groupe')
  assert.equal(S.depasse(ps[0].account, 5), 6, 'six pour une instance de cinq : averti')
  S.quitterGroupe(ps[5].account)
  assert.equal(S.depasse(ps[0].account, 5), 0, 'cinq pour cinq : rien à dire')
})
