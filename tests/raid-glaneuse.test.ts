// Le raid de la campagne 2, « L'assaut du Métier » : dix soldats IA avec leurs rôles (deux tanks, deux soigneurs, un
// ingénieur qui veille les robots, des tireurs) battent la Glaneuse en trois phases. Sans tank, la pince (×3 sur qui
// n'est ni fantassin ni démolisseur) décime le raid ; sans veilleur, les robots glanés deviennent des balises et elle
// se renforce à chaque glane : le raid ne passe pas. Le raid est lié au front : le foyer du Métier donne sa force à la
// Glaneuse, sa chute fait reculer les trois foyers des Hauts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENE, graine } from '../shared/motifs.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { CARTES, PASSAGES } from '../shared/monde.ts'
import { E, type ClassId } from '../shared/rules.ts'
import { RUCHES, RAYONS_DEPART } from '../shared/front.ts'
import { World } from '../server/world/World.ts'
import { BotBrain } from '../server/world/bots.ts'
import { classeManquante, roleDe } from '../server/rooms/Secteur.ts'

function raid(seed: number, opts: { tanks?: boolean; veilleur?: boolean } = {}) {
  const r = Math.random
  Math.random = graine(seed)
  try {
    const w = new World({ mode: 'secteur', map: carteMap('metier_raid') }, { fx() {}, log() {}, arene() {} })
    const cx = (ARENE.x0 + ARENE.x1) / 2
    const groupe: { cls: ClassId }[] = []
    for (let i = 0; i < 10; i++) {
      let cls = classeManquante(groupe)
      // sans tank : ni fantassin ni démolisseur (la pince est pour eux)
      if (opts.tanks === false && (cls === 'fantassin' || cls === 'demolisseur')) cls = 'eclaireur'
      groupe.push({ cls })
      const b = new BotBrain(); b.role = roleDe(cls)
      b.veille = opts.veilleur !== false && cls === 'ingenieur'
      const p = w.addPlayer({ sid: (i ? 'ia' : 'moi') + i, account: i ? '' : 'a', soldierId: 0, given: 'S' + i, family: 'Banc', generation: 1, cls, level: 33, xp: 0, bot: i ? b : undefined, x: cx - 100 + (i % 5) * 50, y: ARENE.y1 - 30 - Math.floor(i / 5) * 20 })
      if (!i) p.auto = b
      w.giveRobot(p, 10)
    }
    const phases = new Set<number>()
    const sp: Record<string, number> = {}
    const add = w.addTele.bind(w)
    w.addTele = (t) => { if (t.sp) sp[t.sp] = (sp[t.sp] ?? 0) + 1; add(t) }
    let fin = false
    for (let i = 0; i < 20 * 480 && !fin; i++) {
      w.step(1 / 20)
      const a = w.arene!
      if (a.ferme) phases.add(a.phase)
      if (phases.size === 3 && !a.boss) fin = true
      if ([...w.players.values()].every((p) => p.s.etat !== 0)) break
    }
    const debout = [...w.players.values()].filter((p) => p.s.etat === 0).length
    return { fin, phases: [...phases].sort(), duree: w.time, debout, sp, glanes: w.arene!.glanes, w }
  } finally { Math.random = r }
}

test('l\'assaut du Métier : dix soldats IA avec leurs rôles battent la Glaneuse, en trois phases', { timeout: 900000 }, () => {
  for (const seed of [1, 2, 3]) {
    const r = raid(seed)
    console.log(`graine ${seed} : ${r.fin ? 'victoire' : 'échec'} en ${r.duree.toFixed(0)} s, debout ${r.debout}/10, glanes réussies ${r.glanes}, zones ${JSON.stringify(r.sp)}`)
    assert.ok(r.fin, `graine ${seed} : le raid doit gagner`)
    assert.deepEqual(r.phases, [1, 2, 3])
    assert.ok(r.duree > 120 && r.duree < 480, `durée ${r.duree.toFixed(0)} s`)
    assert.ok((r.sp.glane ?? 0) > 0, 'la glane a eu lieu')
  }
})

test('sans tank, la pince décime le raid : il ne passe pas', { timeout: 900000 }, () => {
  const r = raid(4, { tanks: false })
  console.log(`sans tank : ${r.fin ? 'victoire' : 'échec'} en ${r.duree.toFixed(0)} s, debout ${r.debout}`)
  assert.ok(!r.fin, 'sans tank, le raid tombe')
})

test('sans veilleur, les robots sont glanés (balises, Glaneuse renforcée) : le raid ne passe pas', { timeout: 900000 }, () => {
  const r = raid(5, { veilleur: false })
  console.log(`sans veilleur : ${r.fin ? 'victoire' : 'échec'} en ${r.duree.toFixed(0)} s, debout ${r.debout}, glanes ${r.glanes}`)
  assert.ok(r.glanes >= 3, `${r.glanes} robots glanés`)
  assert.ok(!r.fin, 'sans veilleur, le raid tombe')
})

test('le front : le foyer du Métier donne sa force à la Glaneuse, sa chute fait reculer les foyers des Hauts', () => {
  const i = RUCHES.findIndex((x) => x.id === 'foyer_metier')
  const pv = (rayon: number) => {
    const w = new World({ mode: 'secteur', map: carteMap('metier_raid') }, { fx() {}, log() {}, arene() {} })
    w.ruches[i] = rayon; w.arene!.eveil(1)
    const b = w.arene!.boss!
    return { w, hp: b.e.maxHp / (b.resist ?? 1) } // les PV vrais (au-delà de 65 000, la barre est divisée)
  }
  const bas = pv(RUCHES[i].rmin), haut = pv(RUCHES[i].rmax)
  assert.ok(haut.hp > bas.hp * 1.5, 'un foyer au plafond la rend bien plus forte')
  const { w } = haut
  const avant = [...w.ruches]
  const b = w.arene!.boss!
  w.damageEnemy(b, 1e9, null)
  assert.equal(w.glaneuseVaincue, 1)
  assert.ok(w.ruches[i] < avant[i] - 10, 'le foyer du Métier recule fort')
  for (const k of RUCHES.map((x, j) => x.campagne === 2 ? j : -1).filter((j) => j >= 0)) assert.ok(w.ruches[k] < avant[k], `${RUCHES[k].id} recule`)
  for (let k = 0; k < 5; k++) assert.equal(w.ruches[k], avant[k], 'les ruches de la campagne 1 ne bougent pas')
  void RAYONS_DEPART
})

test('le raid est ouvert dès le niveau 30, à dix, par le Métier', () => {
  assert.deepEqual(CARTES.metier_raid.raid, { joueurs: 10, niveauMin: 30 })
  assert.ok(PASSAGES.some((p) => p.carte === 'ossara' && p.vers === 'metier_raid'))
  void E
})
