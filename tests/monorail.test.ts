// Le monorail de la Première Vague : un réseau relié et cohérent avec les gares, des trajets déterministes (le serveur
// n'envoie que les gares du chemin), la bonne gare d'arrivée, un soldat invulnérable et sans tir pendant le trajet.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STATIONS, STATION_BY_ID } from '../shared/monde.ts'
import { TRONCONS, GARES_MER, chemin, trajet, etatRame, quai, ligneTroncon, surLigne, longueur, T_MONTEE } from '../shared/monorail.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { T } from '../shared/tiles.ts'
import { TILE } from '../shared/consts.ts'
import { World } from '../server/world/World.ts'

const toutes = () => true

test('le réseau relie les gares du rail, la barge relie Anse-Grise à Relâche, chaque tronçon part et arrive à une gare', () => {
  for (const t of TRONCONS) {
    const a = STATION_BY_ID[t.a], b = STATION_BY_ID[t.b]
    assert.deepEqual(t.pts[0], [a.x, a.y], t.a)
    assert.deepEqual(t.pts[t.pts.length - 1], [b.x, b.y], t.b)
  }
  for (const g of STATIONS) if (!GARES_MER.has(g.id)) assert.ok(chemin('st_port', g.id, toutes) || g.id === 'st_port', `${g.id} relié à Port-Ancre`)
  assert.deepEqual(chemin('st_anse', 'st_relache', toutes)!.ids, ['st_anse', 'st_relache'])
  assert.equal(chemin('st_port', 'st_relache', toutes), null, 'la barge ne se prend pas depuis le rail')
  assert.deepEqual(chemin('st_port', 'st_mat', toutes)!.ids, ['st_port', 'st_col', 'st_bastion', 'st_gue', 'st_mat'])
  // une ligne principale et un embranchement au Col
  assert.deepEqual(chemin('st_marais', 'st_bastion', toutes)!.ids, ['st_marais', 'st_port', 'st_col', 'st_bastion'])
  assert.deepEqual(chemin('st_port', 'st_epave', toutes)!.ids, ['st_port', 'st_col', 'st_fougere', 'st_epave'])
})

test('le rail passe surtout au-dessus de la terre ferme (les piliers ne sont pas plantés dans l\'eau)', () => {
  const m = carteMap('ossara')
  let n = 0, eau = 0
  for (const t of TRONCONS) {
    if (t.ligne === 'mer') continue
    const l = ligneTroncon(t)
    for (let s = 0; s < longueur(l); s += 44) {
      const p = surLigne(l, s)
      const tt = m.tiles[Math.floor(p.y / TILE) * m.w + Math.floor(p.x / TILE)]
      n++; if (tt === T.EAU || tt === T.MER) eau++
    }
  }
  assert.ok(eau / n < 0.15, `${eau}/${n} piliers dans l'eau`)
  for (const g of STATIONS) { const q = quai(g.id); const tt = m.tiles[Math.floor(q.y / TILE) * m.w + Math.floor(q.x / TILE)]; assert.ok(tt !== T.EAU && tt !== T.MER, g.id) }
})

test('un trajet passe par les gares ouvertes seulement, et il est le même chez le client (gares reçues en JSON)', () => {
  const ouv = (id: string) => ['st_port', 'st_col'].includes(id)
  assert.equal(trajet('st_port', 'st_fougere', ouv), null)
  assert.ok(trajet('st_port', 'st_col', ouv))
  const serveur = trajet('st_port', 'st_epave', toutes)!
  const ids: string[] = JSON.parse(JSON.stringify(serveur.ids))
  const client = trajet(ids[0], ids[ids.length - 1], (id) => ids.includes(id))!
  assert.deepEqual(client.table, serveur.table)
  for (let t = 0; t < serveur.total + 1; t += 0.37) assert.deepEqual(etatRame(client, t), etatRame(serveur, t))
})

test('des durées courtes mais réalistes, la rame passe les gares intermédiaires sans s\'arrêter et finit à quai', () => {
  for (const a of STATIONS) for (const b of STATIONS) {
    if (a === b || GARES_MER.has(a.id) !== GARES_MER.has(b.id)) continue
    const tr = trajet(a.id, b.id, toutes)!
    // jusqu'aux Hauts, par quatre gares, c'est plus long : on ralentit à chacune
    assert.ok(tr.tVoyage >= 6 && tr.tVoyage <= Math.max(20, 6 + 5 * tr.arrets.length), `${a.id} → ${b.id} : ${tr.tVoyage.toFixed(1)} s`)
    const fin = etatRame(tr, tr.total - 0.01)
    const g = STATION_BY_ID[b.id]
    assert.ok(Math.hypot(fin.x - (g.x * TILE + 8), fin.y - (g.y * TILE + 13)) < 1, 'la rame s\'arrête à la gare')
    // elle ralentit au passage d'une gare intermédiaire, mais ne s'y arrête pas
    for (const arr of tr.arrets) {
      let vmin = Infinity
      for (let t = tr.tApproche + T_MONTEE; t < tr.tApproche + T_MONTEE + tr.tVoyage; t += 0.05) {
        const e = etatRame(tr, t)
        if (Math.hypot(e.x - (STATION_BY_ID[arr.id].x * TILE + 8), e.y - (STATION_BY_ID[arr.id].y * TILE + 13)) < 30) vmin = Math.min(vmin, e.v)
      }
      assert.ok(vmin > 60 && vmin < 260, `${arr.id} traversée à ${vmin.toFixed(0)} px/s`)
    }
  }
  const pc = trajet('st_port', 'st_col', toutes)!
  assert.ok(pc.tVoyage < 10, `Port-Ancre → Col : ${pc.tVoyage.toFixed(1)} s`)
})

test('en monorail, le soldat suit la rame, ne prend aucun coup, ne tire pas, et descend à la bonne gare', () => {
  const w = new World({ mode: 'secteur', map: carteMap('ossara') }, { fx() {}, log() {} })
  const q0 = quai('st_port')
  const p = w.addPlayer({ sid: 'moi', account: 'a', soldierId: 0, given: 'T', family: 'B', generation: 1, cls: 'fantassin', level: 5, xp: 0, x: q0.x, y: q0.y })
  w.giveRobot(p, 2)
  const tr = trajet('st_port', 'st_col', toutes)!
  w.partirRail(p, tr)
  const hp = p.s.hp
  let vu = false, ecart = 0
  let tirs = 0
  for (let i = 0; i < 20 * (tr.total + 2) && p.rail; i++) {
    p.pending.push({ mx: 1, my: 0, aim: 0, fire: true })
    w.step(1 / 20)
    w.damagePlayer(p, 50, 'un test')
    w.skill(p, 0)
    tirs += [...w.bullets.values()].filter((b) => b.ownerP === p).length
    if (p.rail) {
      const e = etatRame(tr, w.time - p.rail.t0)
      if (e.abord) { vu = true; ecart = Math.max(ecart, Math.hypot(p.s.x - e.x, p.s.y - e.y)); assert.equal(p.s.rame, true) }
    }
  }
  assert.ok(vu, 'le soldat a voyagé dans la rame')
  assert.ok(ecart < 0.01, 'il suit exactement la rame')
  assert.equal(p.rail, null)
  assert.equal(p.s.rame, false)
  assert.equal(p.s.hp, hp, 'aucun coup pendant le trajet')
  assert.equal(tirs, 0, 'aucun tir du soldat pendant le trajet')
  const q = quai('st_col')
  assert.ok(Math.hypot(p.s.x - q.x, p.s.y - q.y) < 1, 'déposé sur le quai du Col')
  assert.ok(Math.hypot(p.robot!.r.x - p.s.x, p.robot!.r.y - p.s.y) < 30, 'le robot a voyagé avec lui')
})
