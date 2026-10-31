// La campagne 1 (docs/histoire.md § 6) jouée de bout en bout par un soldat de test, sur les deux voies du choix
// de Haute-Sève ; la migration de l'ancienne trame ; les lectures et les clins d'œil ; et rien dans les maisons.
import { trx, type Texte } from '../shared/i18n/index.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TILE } from '../shared/consts.ts'
import { T, isSolidTile } from '../shared/tiles.ts'
import { E, ENEMIES } from '../shared/rules.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { PASSAGE_BY_ID, type CarteId } from '../shared/monde.ts'
import { RAYONS_DEPART } from '../shared/front.ts'
import { findPath } from '../shared/path.ts'
import { QUESTS, QUEST_BY_ID, TRAME as TRAME_TOUTE, questAvailable, type QuestDef } from '../shared/quests.ts'
// la campagne 1 seule (la 2 se joue à part, tests/campagne2.test.ts)
const TRAME = TRAME_TOUTE.filter((id) => !QUEST_BY_ID[id].campagne)
import { LECTURES, LECTURE_BY_ID, ENDROITS, ENDROIT_BY_ID, PLACE, COEURS } from '../shared/journaux.ts'
import { NPC_BY_ID } from '../shared/npcs.ts'
import { countInv, material } from '../shared/items.ts'
import { World, type PSim } from '../server/world/World.ts'
import { Vie } from '../server/world/Vie.ts'
import { Ossara } from '../server/ossara.ts'
import { Db, setDb, db } from '../server/db.ts'
import { migrerTrame } from '../server/migration.ts'
/** les textes du serveur, lus en français */
const fr = (t: Texte | null | undefined) => trx('fr', t)

/** Un monde par carte (le continent, l'épave), la même base : le soldat passe de l'un à l'autre comme en jeu. */
function partie(family = 'Essai') {
  setDb(new Db(':memory:'))
  const acc = db().createGuest(family)
  const sent: { type: string; msg: any }[] = []
  const logs: string[] = []
  const cartes = new Map<CarteId, { w: World; vie: Vie; o: Ossara; p: PSim }>()
  for (const c of ['ossara', 'constance'] as CarteId[]) {
    const w = new World({ mode: 'secteur', map: carteMap(c) }, { fx() {}, log() {} })
    const vie = new Vie(w); w.life = vie
    const o = new Ossara(w, vie, { send: (_p, type, msg) => sent.push({ type, msg }), log: (t) => logs.push(fr(t)) })
    w.hooks.kill = (by, es, near) => o.onKill(by, es, near)
    const p = w.addPlayer({ sid: 's-' + c, account: acc.id, soldierId: 0, given: 'Ana', family, generation: 1, cls: 'fantassin', level: 20, xp: 0 })
    cartes.set(c, { w, vie, o, p })
  }
  /** passer sur une carte : la base fait foi (comme en jeu, `forget` à l'arrivée) ; le sac suit le soldat */
  let ici: CarteId = 'ossara'
  const sur = (c: CarteId) => {
    const de = cartes.get(ici)!, vers = cartes.get(c)!
    if (c !== ici) { vers.p.inv = de.p.inv; vers.o.forget(acc.id); ici = c }
    return vers
  }
  return { acc, sent, logs, cartes, sur, get ici() { return ici } }
}
type Partie = ReturnType<typeof partie>

const EDEN_KIND = Number(Object.entries(ENEMIES).find(([, d]) => d.famille === 'eden' && !d.boss && !d.passif)![0])
const poiDe = (lieu: string) => {
  for (const c of ['ossara', 'constance'] as CarteId[]) { const p = carteMap(c).monde!.pois.find((x) => x.id === lieu); if (p) return { carte: c, x: p.x, y: p.y } }
  return null
}
function allerPnj(g: Partie, npc: string) {
  const c = g.sur('ossara')
  const n = c.vie.npcs.get(npc)!.n
  c.p.s.x = n.x + 10; c.p.s.y = n.y + 6
  return c
}

/** Le soldat de test : prend la quête, fait chaque objectif comme un joueur le ferait, la rend. */
function jouer(g: Partie, id: string, voie: 'A' | 'B' = 'B') {
  const q = QUEST_BY_ID[id]
  let c = allerPnj(g, q.donneur)
  const d = c.o.talk(c.p, q.donneur)!
  assert.ok(d.options.some((o) => o.id === 'voir:' + id), `${NPC_BY_ID[q.donneur].nom} propose « ${q.nom} » (${id})`)
  c.o.choose(c.p, q.donneur, 'accepter:' + id)
  assert.ok(c.o.state(g.acc.id).active.has(id) || c.o.state(g.acc.id).done.has(id), `${id} acceptée`)
  q.objectifs.forEach((o, i) => {
    const prog = () => g.cartes.get(g.ici)!.o.state(g.acc.id).active.get(id)?.[i] ?? 0
    if (o.t === 'parler') { c = allerPnj(g, o.npc); c.o.talk(c.p, o.npc) }
    else if (o.t === 'tuer') {
      c = g.sur('ossara')
      const kind = o.kinds?.[0] ?? (o.famille === 'eden' ? EDEN_KIND : E.RODEUR)
      for (let k = 0; k < o.n; k++) { const es = c.w.spawnEnemy(kind, c.p.s.x + 40, c.p.s.y, { level: 5 }); c.w.damageEnemy(es, 1e6, c.p) }
    } else if (o.t === 'explorer') {
      const poi = poiDe(o.lieu)!
      assert.ok(poi, `lieu ${o.lieu} introuvable`)
      c = g.sur(poi.carte); c.p.s.x = poi.x; c.p.s.y = poi.y
      c.o.checkExplore(c.p)
      if (o.lecture) assert.ok(g.sent.some((s) => s.type === 'lecture' && s.msg.id === o.lecture), `en arrivant à ${o.lieu}, on lit ${o.lecture}`)
    } else if (o.t === 'ramasser') {
      c = g.sur('ossara')
      if (o.b === 'noyau') {
        // les vrais cœurs de données, dans les ruines de la Première Vague
        const noeuds = c.w.map.monde!.noeuds.filter((n) => n.type === 'noyau')
        for (const n of noeuds) { if (countInv(c.p.inv, 'noyau') >= o.n) break; c.p.s.x = n.x; c.p.s.y = n.y; c.o.pick(c.p, n.id) }
      } else c.o.give(c.p, material(o.b, o.n))
    } else if (o.t === 'lire') {
      const e = ENDROITS.find((x) => x.lecture === o.id)
      if (e) { c = g.sur(e.carte); c.p.s.x = e.x * TILE + 8; c.p.s.y = e.y * TILE + 8; c.o.lire(c.p, e.id) }
      else c.o.unlock(c.p, o.id)
    }
    assert.ok(prog() >= (o.t === 'tuer' || o.t === 'ramasser' ? o.n : 1), `${id} : objectif « ${o.texte} » rempli`)
  })
  c = allerPnj(g, q.rendre)
  c.o.talk(c.p, q.rendre)
  const r = c.o.choose(c.p, q.rendre, 'rendre:' + id)!
  if (q.choix) c.o.choose(c.p, q.rendre, (voie === 'A' ? 'choixA:' : 'choixB:') + id)
  assert.ok(c.o.state(g.acc.id).done.has(id), `${id} rendue à ${NPC_BY_ID[q.rendre].nom}`)
  return r
}

function campagne(voie: 'A' | 'B') {
  const g = partie(voie === 'A' ? 'Livre' : 'Tait')
  const joue: string[] = []
  let fin = ''
  for (const id of TRAME) {
    const q = QUEST_BY_ID[id]
    const s = g.cartes.get(g.ici)!.o.state(g.acc.id)
    if (q.flag && s.flags[q.flag[0]] !== q.flag[1]) continue // l'autre voie
    const d = jouer(g, id, voie)
    joue.push(id)
    if (q.fins) fin = fr(d.texte)
  }
  return { g, joue, fin, s: g.cartes.get(g.ici)!.o.state(g.acc.id) }
}

test('campagne 1 : les trois actes de bout en bout, Haute-Sève tue (Maëlle ouvre l\'épave)', () => {
  const { g, joue, fin, s } = campagne('B')
  assert.equal(s.flags.choix, 'fertiles')
  assert.ok(joue.includes('la_constance') && !joue.includes('la_constance_c'), 'Maëlle donne la clé de l\'épave')
  assert.equal(QUEST_BY_ID.la_constance.donneur, 'maelle')
  for (const a of [1, 2, 3]) assert.ok(joue.some((id) => QUEST_BY_ID[id].acte === a), `acte ${a} joué`)
  assert.equal(s.flags.cle_constance, '1'); assert.equal(s.flags.acte2, '1'); assert.equal(s.flags.campagne1, '1')
  // les révélations, dans l'ordre de la bible
  for (const id of ['notes_lin', 'stele_tertre', ...COEURS, 'journal_varga', 'voix_ruche', 'journal_danet', 'semeur_modele']) assert.equal(s.flags['lu_' + id], '1', `lu : ${id}`)
  assert.match(QUEST_BY_ID.le_code.fin, /écrit par des humains/)
  assert.match(QUEST_BY_ID.la_mission.fin, /programme de la Terre/)
  assert.match(QUEST_BY_ID.voix_semeur.fin, /Aurèle Danet/)
  assert.match(QUEST_BY_ID.le_modele.fin, /Pas conformes/)
  // la fin : le front a tenu (rien n'a avancé dans le test) et Haute-Sève a été tue
  assert.equal(s.flags.fin_c1, 'victoire_fertiles')
  assert.equal(fin, QUEST_BY_ID.la_racine.fins!.victoire_fertiles)
  assert.ok(g.logs.some((t) => t.includes('les ruches du Semeur reculent')), '« Les ruches » fait reculer le front pour tous')
})

test('campagne 2 : des Hauts de Glane au Métier, de bout en bout, les deux choix et leurs fins', { timeout: 120000 }, () => {
  for (const voie of ['A', 'B'] as const) {
    const { g, s: s1 } = campagne('B')
    assert.equal(s1.flags.fin_c1, 'victoire_fertiles')
    // un soldat de la fin de la campagne 1 : au niveau des Hauts, le sac vidé (les récompenses l'ont rempli)
    const sac: typeof g.cartes extends Map<any, infer V> ? V extends { p: { inv: infer I } } ? I : never : never = []
    for (const c of g.cartes.values()) { c.p.level = 35; c.p.inv = sac }
    const joue: string[] = []
    let fin = ''
    for (const id of TRAME_TOUTE.filter((x) => QUEST_BY_ID[x].campagne === 2)) {
      const q = QUEST_BY_ID[id]
      const s = g.cartes.get(g.ici)!.o.state(g.acc.id)
      if (q.flag && s.flags[q.flag[0]] !== q.flag[1]) continue // une autre entrée
      const d = jouer(g, id, voie)
      joue.push(id)
      if (q.fins) fin = fr(d.texte)
    }
    const s = g.cartes.get(g.ici)!.o.state(g.acc.id)
    assert.ok(joue.includes('la_sente') && !joue.includes('les_exiles'), 'Maëlle ouvre la sente quand Haute-Sève a été tue')
    for (const a of [1, 2, 3]) assert.ok(joue.some((id) => QUEST_BY_ID[id].acte === a), `acte ${a} joué`)
    assert.equal(s.flags.choix2, voie === 'A' ? 'delivrer' : 'laisser')
    assert.equal(s.flags.campagne2, '1')
    assert.equal(s.flags.fin_c2, voie === 'A' ? 'victoire_delivres' : 'victoire_laisse')
    assert.equal(fin, QUEST_BY_ID.l_assaut.fins![s.flags.fin_c2 as 'victoire_delivres'])
    // la suite selon le choix
    const apres = voie === 'A' ? 'le_dernier_chant' : 'qui_ecoute'
    jouer(g, apres, voie)
    // les révélations de la trame : la page du Registre, puis Varga qui répond
    for (const id of ['registre_page', 'varga_repond']) assert.equal(s.flags['lu_' + id], '1', `lu : ${id}`)
  }
})

test('campagne 1 : Haute-Sève livrée, Cantor ouvre l\'épave ; l\'évacuation si le front a avancé', () => {
  const g = partie('Livre')
  for (const id of TRAME) {
    const q = QUEST_BY_ID[id]
    const s = g.cartes.get(g.ici)!.o.state(g.acc.id)
    if (q.flag && s.flags[q.flag[0]] !== q.flag[1]) continue
    if (id === 'la_constance_c') {
      // Maëlle ne propose rien : Haute-Sève est vide, c'est Cantor qui connaît le code
      const c = allerPnj(g, 'maelle')
      assert.ok(!c.o.menu(c.p, 'maelle').options.some((o) => o.id.startsWith('voir:la_constance')))
    }
    if (id === 'offensive_semeur') {
      // le front a passé la ligne pendant ce temps (toutes les ruches au maximum)
      const w = g.cartes.get('ossara')!.w
      w.ruches.forEach((_, i) => { w.ruches[i] += 30 })
    }
    jouer(g, id, 'A')
  }
  const s = g.cartes.get(g.ici)!.o.state(g.acc.id)
  assert.equal(s.flags.choix, 'colonie')
  assert.ok(s.done.has('la_constance_c') && !s.done.has('la_constance'))
  assert.equal(s.flags.fin_c1, 'evacuation')
})

test('la trame : chaque pas ouvre le suivant, rien d\'autre ; chaque quête a ses PNJ, lieux et textes', () => {
  for (const q of QUESTS) {
    assert.ok(NPC_BY_ID[q.donneur] && NPC_BY_ID[q.rendre], `${q.id} : PNJ connus`)
    for (const r of [...(q.requis ?? []), ...(q.requisUn ?? [])]) assert.ok(QUEST_BY_ID[r], `${q.id} : requis ${r}`)
    for (const o of q.objectifs) {
      if (o.t === 'explorer') { assert.ok(poiDe(o.lieu), `${q.id} : lieu ${o.lieu}`); if (o.lecture) assert.ok(LECTURE_BY_ID[o.lecture]) }
      if (o.t === 'lire') assert.ok(LECTURE_BY_ID[o.id], `${q.id} : texte ${o.id}`)
    }
    if (q.recompense.lecture) assert.ok(LECTURE_BY_ID[q.recompense.lecture])
  }
  assert.ok(!/machine/i.test(QUEST_BY_ID.la_seve.fin) || /ni une machine|n'est ni/i.test(QUEST_BY_ID.la_seve.fin), 'la sève ne dit plus que le Semeur est une machine')
  assert.equal(QUEST_BY_ID.voix_semeur.intro.startsWith('Les soldats') || QUEST_BY_ID.voix_semeur.intro.includes('Si le Semeur a été un homme, il a laissé des journaux.'), true)
  assert.equal(NPC_BY_ID.septieme.nom, 'Cantor')
  for (const [id, nom] of [['ysolde', 'Brasier'], ['joss', 'Joss'], ['nadia', 'Nadia'], ['agathe', 'Lin'], ['odile', 'Odile'], ['maelle', 'Maëlle Sève']]) assert.ok(NPC_BY_ID[id].nom.includes(nom), `${id} = ${nom}`)
  // un soldat neuf : seule la première quête de la trame est proposée
  const trameDispo = QUESTS.filter((q) => q.principale && questAvailable(q, new Set(), new Set(), 20, {}))
  assert.deepEqual(trameDispo.map((q) => q.id), ['matricule'])
})

test('migration de la trame : l\'ancienne voix du Semeur devient les journaux de bord, les lignées restent', () => {
  const d = new Db(':memory:'); setDb(d)
  const meff = d.createGuest('Meff'), autre = d.createGuest('Autre'), neuf = d.createGuest('Neuf')
  const s1 = d.createSoldier(meff.id, 'medic', 8, 1, 'Héloïse')
  d.killSoldier(s1, { killer: 'un rôdeur de niveau 3', x: 150 * TILE, y: 280 * TILE, family: 'Meff' })
  d.createSoldier(meff.id, 'fantassin', 6, 2, 'Malo')
  for (const id of ['matricule', 'ce_qui_pousse', 'message_fougere', 'les_fertiles', 'la_seve', 'le_choix', 'voix_semeur', 'le_nid']) d.setQuest(meff.id, id, 'fini', [1, 1])
  d.setFlag(meff.id, 'choix', 'fertiles'); d.setFlag(meff.id, 'selle', '1')
  for (const id of ['matricule', 'ce_qui_pousse', 'message_fougere', 'les_fertiles', 'la_seve', 'le_choix']) d.setQuest(autre.id, id, 'fini', [1])
  d.setQuest(autre.id, 'voix_semeur', 'en_cours', [2, 0])
  d.setQuest(autre.id, 'tertre', 'en_cours', [1])
  const avant = d.lineage(meff.id)
  const r = migrerTrame(d)!
  assert.equal(r.voixFinies, 1); assert.equal(r.voixEnCours, 1)
  const etat = (a: string) => Object.fromEntries(d.quests(a).map((q) => [q.id, q.etat]))
  // celui qui avait fini : les journaux de bord (et le code) faits, textes gardés ; le nid reste fait
  const e1 = etat(meff.id)
  assert.equal(e1.voix_semeur, undefined); assert.equal(e1.journaux_bord, 'fini'); assert.equal(e1.le_code, 'fini'); assert.equal(e1.le_nid, 'fini')
  assert.equal(d.flags(meff.id).lu_coeur_3, '1'); assert.equal(d.flags(meff.id).selle, '1'); assert.equal(d.flags(meff.id).choix, 'fertiles')
  assert.deepEqual(d.lineage(meff.id), avant, 'la lignée de Meff ne bouge pas')
  // celui qui l'avait en cours : il reprend les journaux de bord avec ses deux cœurs
  const e2 = etat(autre.id)
  assert.equal(e2.journaux_bord, 'en_cours'); assert.deepEqual(JSON.parse(d.quests(autre.id).find((q) => q.id === 'journaux_bord')!.prog_json), [2])
  assert.equal(e2.tertre, 'en_cours')
  assert.deepEqual(etat(neuf.id), {})
  assert.equal(migrerTrame(d), null, 'une seule fois')
  // et le jeu les relit sans heurt : la suite est proposée, l'ancien Tertre en cours garde son exploration
  const w = new World({ mode: 'secteur', map: carteMap('ossara') }, { fx() {}, log() {} })
  const vie = new Vie(w); w.life = vie
  const o = new Ossara(w, vie, { send() {}, log() {} })
  const sm = o.state(meff.id)
  assert.ok(QUESTS.filter((q) => questAvailable(q, sm.done, new Set(sm.active.keys()), 12, sm.flags)).some((q) => q.id === 'la_constance'), 'Meff peut entrer dans la Constance')
  assert.deepEqual(o.state(autre.id).active.get('tertre'), [1])
})

test('les lectures : la tombe du raid, la plaque, la cassette, le Tamagoyle, la porte scellée, la stèle des saisons', () => {
  const g = partie()
  const lire = (id: string) => {
    const e = ENDROIT_BY_ID[id]
    const c = g.sur(e.carte); c.p.s.x = e.x * TILE + 8; c.p.s.y = e.y * TILE + 8
    g.sent.length = 0
    c.o.lire(c.p, id)
    return { c, l: g.sent.find((s) => s.type === 'lecture')?.msg }
  }
  assert.match(fr(lire('tertre_wipe').l.texte), /Ici repose une équipe de raid\. Elle a wipe\./)
  assert.match(fr(lire('coursive_plaque').l.texte), /En mémoire de ceux qui ont tenu la ligne\. 2007–2009\./)
  let r = lire('cabine_cassette')
  assert.match(fr(r.l.texte), /Quelqu'un l'a écoutée jusqu'à user la bande\./); assert.equal(countInv(r.c.p.inv, 'cassette'), 1)
  lire('cabine_cassette'); assert.equal(countInv(r.c.p.inv, 'cassette'), 1, 'une seule cassette par lignée')
  r = lire('jeux_tamagoyle'); assert.equal(countInv(r.c.p.inv, 'tamagoyle_casse'), 1)
  // Joss le répare, sans dire ce que c'est
  const c = allerPnj(g, 'joss')
  const m = c.o.menu(c.p, 'joss')
  assert.ok(m.options.some((o) => o.id === 'tama'))
  const d = c.o.choose(c.p, 'joss', 'tama')!
  assert.match(fr(d.texte), /Ne me demande pas ce que c'est/)
  assert.equal(countInv(c.p.inv, 'tamagoyle'), 1); assert.equal(countInv(c.p.inv, 'tamagoyle_casse'), 0)
  // la porte scellée : fermée avant la fin de l'acte 2, puis la salle et le dernier message de la Terre
  r = lire('porte_scellee')
  assert.match(fr(r.l.texte), /porte blindée/); assert.ok(r.c.p.s.x < 87 * TILE)
  r.c.o.setFlag(r.c.p, 'acte2', '1')
  r.c.o.lire(r.c.p, 'porte_scellee')
  assert.ok(r.c.p.s.x >= 88 * TILE && r.c.p.s.x < 94 * TILE, 'dans la salle secrète')
  r = lire('salle_message')
  assert.match(fr(r.l.texte), /Ne les attendez plus\. Faites ce que vous pouvez avec ce que vous êtes\./)
  r = lire('salle_sortie'); assert.ok(r.c.p.s.x < 87 * TILE, 'retour sur la passerelle')
  // trop loin : rien
  g.sent.length = 0; r.c.p.s.x += 300; r.c.o.lire(r.c.p, 'coursive_plaque'); assert.ok(!g.sent.some((s) => s.type === 'lecture'))
  // la stèle des saisons : le premier mort de chaque saison, pour toujours
  const s = db().createSoldier(g.acc.id, 'medic', 4, 1, 'Héloïse')
  db().killSoldier(s, { killer: 'un rôdeur de niveau 3', x: 0, y: 0, family: 'Essai' })
  const s2 = db().createSoldier(g.acc.id, 'medic', 4, 2, 'Malo')
  db().killSoldier(s2, { killer: 'un rampant de niveau 2', x: 0, y: 0, family: 'Essai' })
  const st = fr(lire('stele_saisons').l.texte)
  assert.match(st, /Héloïse Essai, génération 1\. Un rôdeur\.|Héloïse Essai, génération 1\. un rôdeur\./); assert.ok(!st.includes('Malo'), 'seul le premier de la saison')
  // le journal garde ce qui a été lu, et se relit
  g.sent.length = 0
  r.c.o.relire(r.c.p, 'tombe_wipe'); assert.ok(g.sent.some((x) => x.type === 'lecture' && x.msg.id === 'tombe_wipe'))
  g.sent.length = 0
  r.c.o.relire(r.c.p, 'journal_varga'); assert.ok(!g.sent.some((x) => x.type === 'lecture'), 'pas lu, pas relu')
  for (const l of LECTURES) assert.ok(l.texte.length > 40, l.id)
})

test('les lignées dans l\'histoire : les ancêtres, les morts chantés par Cantor, les exploits d\'Odile', () => {
  const g = partie('Garnier')
  const s = db().createSoldier(g.acc.id, 'medic', 9, 1, 'Héloïse')
  db().killSoldier(s, { killer: 'une sangsue des marais de niveau 9', x: 300 * TILE, y: 240 * TILE, family: 'Garnier', carte: 'ossara' })
  const autre = db().createGuest('Vidal')
  db().killSoldier(db().createSoldier(autre.id, 'fantassin', 12, 3, 'Octave'), { killer: 'un rouillard', x: 0, y: 0, family: 'Vidal' })
  const c = allerPnj(g, 'joss')
  let ligne = ''
  for (let i = 0; i < 60 && !ligne.includes('Héloïse'); i++) ligne = fr(c.o.greeting(c.p, 'joss'))
  assert.match(ligne, /Héloïse/); assert.match(ligne, /sangsue/); assert.ok(!/de niveau/.test(ligne))
  const chant = fr(allerPnj(g, 'septieme').o.greeting(c.p, 'septieme'))
  assert.match(chant, /OCTAVE VIDAL/); assert.match(chant, /HÉLOÏSE GARNIER/); assert.match(chant, /JE CHANTE AUSSI HÉLOÏSE, DE TA LIGNÉE/)
  assert.equal(chant, chant.toUpperCase(), 'Cantor écrit en majuscules')
  // le premier à abattre l'Engloutisseur : Odile le raconte
  const es = c.w.spawnEnemy(E.ENGLOUTISSEUR, c.p.s.x + 40, c.p.s.y, { level: 12 })
  c.w.damageEnemy(es, 1e7, c.p)
  assert.equal(db().get('exploit_engloutisseur'), 'Ana Garnier')
  let od = ''
  for (let i = 0; i < 80 && !od.includes('Engloutisseur'); i++) od = fr(c.o.greeting(c.p, 'odile'))
  assert.match(od, /Ana Garnier/)
})

test('Port-Ancre : un robot laissé deux minutes sur la place se met à danser', () => {
  const g = partie()
  const { w, o, p } = g.cartes.get('ossara')!
  w.giveRobot(p, 2)
  p.s.x = PLACE.x * TILE + 8; p.s.y = PLACE.y * TILE + 8
  p.robot!.r.x = p.s.x - 14; p.robot!.r.y = p.s.y + 6
  for (let t = 0; t <= 119; t++) { w.time = t; o.robotsQuiDansent() }
  assert.ok(!p.robot!.danse, 'pas encore')
  w.time = 121; o.robotsQuiDansent()
  assert.ok(p.robot!.danse, 'il danse')
  w.stepRobot(p.robot!, 0.05)
  assert.equal(p.robot!.r.fx & 2, 2, 'le client le voit (fx)')
  p.s.x += 40; w.time = 122; o.robotsQuiDansent()
  assert.ok(!p.robot!.danse, 'on bouge : il s\'arrête')
  // ailleurs qu'à la place, jamais
  p.s.x = 100 * TILE; p.robot!.r.x = p.s.x
  for (let t = 200; t <= 400; t += 10) { w.time = t; o.robotsQuiDansent() }
  assert.ok(!p.robot!.danse)
})

test('rien dans les maisons : ni arbre, ni rocher, ni meuble hors des murs ; on peut se tenir où l\'on lit', () => {
  const m = carteMap('ossara')
  for (const b of m.monde!.batiments) {
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      const t = m.tiles[y * m.w + x]
      assert.ok(t === T.PLANCHER || t === T.MEUBLE, `${b.id} : tuile ${t} en (${x},${y})`)
    }
    for (const a of m.monde!.arbres) assert.ok(!(a.x >= b.x - 1 && a.x <= b.x + b.w && a.y >= b.y - 1 && a.y <= b.y + b.h), `${b.id} : un arbre en (${a.x},${a.y})`)
    for (const n of m.monde!.noeuds) { const tx = Math.floor(n.x / TILE), ty = Math.floor(n.y / TILE); assert.ok(!(tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h), `${b.id} : nœud ${n.id}`) }
    const porte = m.tiles[b.porte.y * m.w + b.porte.x]
    assert.ok(!isSolidTile(porte), `${b.id} : la porte est ouverte`)
  }
  for (const a of m.monde!.arbres) assert.equal(m.tiles[a.y * m.w + a.x], T.ARBRE, 'chaque arbre dessiné est un vrai arbre')
  // les endroits où l'on lit : debout dessus, et on y arrive (depuis Port-Ancre, ou depuis le sas de l'épave)
  for (const e of ENDROITS) {
    const mm = carteMap(e.carte)
    assert.ok(!isSolidTile(mm.tiles[e.y * mm.w + e.x]), `${e.id} : on peut s'y tenir`)
    if (e.id === 'salle_message' || e.id === 'salle_sortie') continue // la salle secrète : on y entre par la porte scellée
    const sp = e.carte === 'ossara' ? mm.points.spawn : (() => { const s = PASSAGE_BY_ID.constance_sas; return { x: (s.x + s.sortie[0]) * TILE + 8, y: (s.y + s.sortie[1]) * TILE + 8 } })()
    assert.ok(findPath(mm, Math.floor(sp.x / TILE), Math.floor(sp.y / TILE), e.x, e.y, 400000), `${e.id} : atteignable`)
  }
})

test('le raid du Semeur compte dans la fin de campagne : chaque victoire donne de la marge à la ligne', () => {
  const g = partie('Raid')
  const c = g.sur('ossara')
  const w = c.w
  // la ligne a cédé de 6 tuiles en tout : sans raid gagné, c'est l'évacuation
  w.ruches[0] += 6
  assert.equal(c.o.finCampagne(c.p), 'evacuation')
  // un raid gagné quelque part sur le serveur : 8 tuiles de marge
  const avant = w.semeurVaincu
  const es = w.spawnEnemy(E.SEMEUR, c.p.s.x + 40, c.p.s.y, { level: 20 })
  w.damageEnemy(es, 1e7, c.p)
  assert.equal(w.semeurVaincu, avant + 1)
  // la chute a aussi fait reculer les ruches ; on remet la ligne 6 tuiles au-delà pour isoler la marge
  w.ruches.forEach((_, i) => { w.ruches[i] = RAYONS_DEPART[i] }); w.ruches[0] += 6
  assert.notEqual(c.o.finCampagne(c.p), 'evacuation')
  // la marge plafonne à trois victoires
  w.semeurVaincu = 10; w.ruches[0] += 30
  assert.equal(c.o.finCampagne(c.p), 'evacuation')
  // et c'est bien « La racine » (le raid) qui donne la fin de la campagne
  assert.ok(QUEST_BY_ID.la_racine.fins && QUEST_BY_ID.la_racine.principale && QUEST_BY_ID.la_racine.acte === 3)
  assert.ok(!QUEST_BY_ID.offensive_semeur.fins)
  assert.equal(TRAME[TRAME.length - 1], 'la_racine')
})
