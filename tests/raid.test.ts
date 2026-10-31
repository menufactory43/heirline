// Le raid « L'offensive du Semeur » : dix soldats IA avec des rôles (deux tanks, deux soigneurs, six tireurs) dans
// l'arène de paysage, trois phases et leurs mécaniques de groupe (le semis à partager, les greffes qui écartent, le
// désherbage sous le pommier), la taille prise par le tank. Le raid est lié au front : la Grande Ruche donne sa force
// au Semeur, et sa chute la fait reculer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENE, graine } from '../shared/motifs.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { CARTES, PASSAGES } from '../shared/monde.ts'
import { E, type ClassId } from '../shared/rules.ts'
import { RUCHES } from '../shared/front.ts'
import { World, type PSim } from '../server/world/World.ts'
import { BotBrain } from '../server/world/bots.ts'
import { classeManquante, roleDe } from '../server/rooms/Secteur.ts'

function raid(seed: number, opts: { tanks?: boolean } = {}) {
  const r = Math.random
  Math.random = graine(seed)
  try {
    const ev: Record<string, number> = {}
    const w = new World({ mode: 'secteur', map: carteMap('semeur') }, { fx(_x, _y, e) { if (e.k === 'txt' && e.s?.k) ev[e.s.k] = (ev[e.s.k] ?? 0) + 1 }, log() {}, arene() {} })
    const cx = (ARENE.x0 + ARENE.x1) / 2
    const groupe: { cls: ClassId }[] = []
    for (let i = 0; i < 10; i++) {
      let cls = classeManquante(groupe)
      if (opts.tanks === false && roleDe(cls) === 'tank') cls = 'eclaireur'
      groupe.push({ cls })
      const b = new BotBrain(); b.role = roleDe(cls)
      const p = w.addPlayer({ sid: (i ? 'ia' : 'moi') + i, account: i ? '' : 'a', soldierId: 0, given: 'S' + i, family: 'Banc', generation: 1, cls, level: 20, xp: 0, bot: i ? b : undefined, x: cx - 100 + (i % 5) * 50, y: ARENE.y1 - 30 - Math.floor(i / 5) * 20 })
      if (!i) p.auto = b
      w.giveRobot(p, 10)
    }
    const phases = new Set<number>()
    const coups: Record<string, number> = {}
    const dmg = w.damagePlayer.bind(w)
    w.damagePlayer = (q, n, by) => { if (q.s.etat === 0) { const k = JSON.parse(by).k; coups[`${roleDe(q.cls)}:${k}`] = (coups[`${roleDe(q.cls)}:${k}`] ?? 0) + 1 } dmg(q, n, by) }
    let fin = false
    const sp: Record<string, number> = {}
    const add = w.addTele.bind(w)
    w.addTele = (t) => { if (t.sp) sp[t.sp] = (sp[t.sp] ?? 0) + 1; add(t) }
    for (let i = 0; i < 20 * 420 && !fin; i++) {
      w.step(1 / 20)
      const a = w.arene!
      if (a.ferme) phases.add(a.phase)
      if (phases.size === 3 && !a.boss) fin = true
      if ([...w.players.values()].every((p) => p.s.etat !== 0)) break
    }
    const debout = [...w.players.values()].filter((p) => p.s.etat === 0).length
    return { fin, phases: [...phases].sort(), duree: w.time, debout, ev, coups, sp, seve: w.arene!.seve, w }
  } finally { Math.random = r }
}

test('le raid : dix soldats IA avec leurs rôles battent le Semeur, en passant par les trois phases', { timeout: 900000 }, () => {
  for (const seed of [1, 2, 3]) {
    const r = raid(seed)
    console.log(`graine ${seed} : ${r.fin ? 'victoire' : 'échec'} en ${r.duree.toFixed(0)} s, debout ${r.debout}/10, zones ${JSON.stringify(r.sp)}, sève ${r.seve}, textes ${JSON.stringify(r.ev)}`)
    console.log('   coups', JSON.stringify(r.coups))
    assert.ok(r.fin, `graine ${seed} : le raid doit gagner`)
    assert.deepEqual(r.phases, [1, 2, 3])
    assert.ok(r.duree > 120 && r.duree < 400, `durée ${r.duree.toFixed(0)} s`)
    assert.ok(r.debout >= 6, `${r.debout} debout`)
    for (const k of ['semis', 'greffe', 'taille', 'desherbage']) assert.ok((r.sp[k] ?? 0) > 0, `mécanique ${k}`)
    // la taille est prise par les tanks, pas par les tireurs
    const tailleTank = r.coups['tank:srv.tueur.taille'] ?? 0, tailleDps = r.coups['dps:srv.tueur.taille'] ?? 0
    assert.ok(tailleTank > tailleDps * 2, `taille : tanks ${tailleTank}, tireurs ${tailleDps}`)
  }
})

test('sans tank, la taille tombe sur les tireurs ou nourrit le Semeur (sève) : le raid ne passe pas', { timeout: 900000 }, () => {
  const r = raid(4, { tanks: false })
  console.log(`sans tank : ${r.fin ? 'victoire' : 'échec'} en ${r.duree.toFixed(0)} s, sève ${r.seve}`)
  assert.ok(!r.fin, 'sans tank, le raid tombe')
})

test('le semis : partagé à trois, chacun prend un tiers ; seul, la graine germe', () => {
  const w = new World({ mode: 'secteur', map: carteMap('semeur') }, { fx() {}, log() {}, arene() {} })
  w.arene!.eveil(1); w.arene!.etat = 1
  const ps: PSim[] = []
  for (let i = 0; i < 4; i++) ps.push(w.addPlayer({ sid: 's' + i, account: '', soldierId: 0, given: 'S' + i, family: 'B', generation: 1, cls: 'fantassin', level: 20, xp: 0, x: 500 + i * 3, y: 380 }))
  for (const p of ps) p.invulT = 0
  ps[3].s.x = 640
  const t = { kind: 'cercle' as const, x: 503, y: 380, x2: 0, y2: 0, r: 30, t: 0, total: 3, dmg: 300, src: '{"k":"srv.tueur.semis"}', sp: 'semis' as const, partage: 3 }
  const hp = ps.map((p) => p.s.hp)
  w.arene!.boomSp(t)
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(hp[i] - ps[i].s.hp - 100) < 40, `un tiers chacun (${hp[i] - ps[i].s.hp})`)
  assert.equal(ps[3].s.hp, hp[3], 'le quatrième, loin, ne prend rien')
  const avant = [...w.enemies.values()].filter((e) => e.kind === E.GREFFE).length
  ps[1].s.x = ps[2].s.x = 700
  w.arene!.boomSp(t)
  assert.equal([...w.enemies.values()].filter((e) => e.kind === E.GREFFE).length, avant + 2, 'seul : la graine germe')
})

test('le front : la Grande Ruche donne sa force au Semeur, et sa chute la repousse', () => {
  const pv = (r: number) => { const w = new World({ mode: "secteur", map: carteMap("semeur") }, { fx() {}, log() {}, arene() {} }); w.ruches[0] = r; w.arene!.eveil(1); const b = w.arene!.boss!; return b.e.maxHp / (b.resist ?? 1) }
  assert.ok(pv(RUCHES[0].rmax) > pv(RUCHES[0].rmin) * 1.5)
  const w = new World({ mode: 'secteur', map: carteMap('semeur') }, { fx() {}, log() {}, arene() {} })
  w.arene!.eveil(1)
  const r0 = w.ruches[0], r1 = w.ruches[1]
  w.killEnemy(w.arene!.boss!, null)
  assert.ok(w.ruches[0] <= r0 - 14, `la Grande Ruche recule (${r0} → ${w.ruches[0]})`)
  assert.ok(w.ruches[1] < r1)
  assert.equal(CARTES.semeur.raid?.joueurs, 10)
  assert.ok(PASSAGES.some((p) => p.carte === 'ossara' && p.vers === 'semeur'))
})

test('les zones du raid sont à portée : le pommier près du raid, les graines atteignables, la greffe se fige avant d\'éclater', () => {
  const w = new World({ mode: 'secteur', map: carteMap('semeur') }, { fx() {}, log() {}, arene() {} })
  const a = w.arene!
  a.eveil(1); a.etat = 1
  const ps: PSim[] = []
  for (let i = 0; i < 10; i++) ps.push(w.addPlayer({ sid: 'p' + i, account: '', soldierId: 0, given: 'P' + i, family: 'B', generation: 1, cls: 'eclaireur', level: 20, xp: 0, x: ARENE.x0 + 60 + i * 40, y: ARENE.y1 - 30 - (i % 3) * 30 }))
  const vit = Math.min(...ps.map((p) => p.s.vit))
  for (const phase of [1, 2, 3]) for (let k = 0; k < 30; k++) {
    w.teles = []; a.phase = phase; a.tour = 1
    const bo = a.borne
    ps.forEach((p, i) => { p.s.x = bo.x0 + 20 + i * (bo.x1 - bo.x0 - 40) / 9; p.s.y = bo.y1 - 10 - (i % 3) * 30 })
    a.zoneSemeur(ps, 1)
    for (const t of w.teles) {
      if (t.sp === 'desherbage') for (const p of ps) assert.ok(Math.hypot(p.s.x - t.x, p.s.y - t.y) - t.r2! + 4 < vit * t.total, `le pommier à portée de tous (${Math.hypot(p.s.x - t.x, p.s.y - t.y).toFixed(0)} px, vitesse ${vit}, borne ${JSON.stringify(a.borne)}, pommier ${t.x},${t.y})`)
      if (t.sp === 'semis') { const near = ps.filter((p) => Math.hypot(p.s.x - t.x, p.s.y - t.y) - t.r < vit * t.total * 0.8).length; assert.ok(near >= t.partage!, 'assez de soldats peuvent rejoindre la graine') }
      if (t.sp === 'greffe') {
        const q = w.players.get(t.suit!)!
        w.stepTeles(t.total - 0.85); const x = t.x; q.s.x += 30; w.stepTeles(0.1)
        assert.equal(t.x, x, 'figée dans la dernière seconde')
      }
    }
  }
})
