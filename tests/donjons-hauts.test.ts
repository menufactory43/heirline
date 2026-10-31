// Les donjons des Hauts de Glane : la lecture de la Pépinière (robots compris, donc leurrable), les pots qui n'éclosent
// que seuls, l'appel du Greffier (un nom qui arrive le soigne et élargit la rature, un nom abattu soigne le groupe) et la
// rature posée sur les deux soldats les plus éloignés.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENE } from '../shared/motifs.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { E } from '../shared/rules.ts'
import { World, type PSim } from '../server/world/World.ts'

function arene(carte: 'serre' | 'registre', n = 3) {
  const w = new World({ mode: 'secteur', map: carteMap(carte) }, { fx() {}, log() {}, arene() {} })
  const cx = (ARENE.x0 + ARENE.x1) / 2, y = ARENE.y1 - 40
  const ps: PSim[] = []
  for (let i = 0; i < n; i++) ps.push(w.addPlayer({ sid: 's' + i, account: 'a' + i, soldierId: i, given: 'S' + i, family: 'Banc', generation: 1, cls: 'fantassin', level: 30, xp: 0, x: cx - 30 + i * 30, y }))
  w.arene!.eveil(1); w.arene!.fermer()
  return { w, a: w.arene!, ps, cx, y }
}
/** huit secondes de relevés avec les silhouettes là où elles sont */
const relever = (a: World['arene']) => { a!.releves = []; for (let i = 0; i < 16; i++) a!.releves.push(a!.silhouettes()) }

test('la Pépinière lit le groupe : serrés → essaim (un cercle), dispersés → épines (une bande) ; les robots comptent', () => {
  const { w, a, ps, cx, y } = arene('serre')
  // serrés : à 20 px les uns des autres
  ps.forEach((p, i) => { p.s.x = cx - 20 + i * 20; p.s.y = y })
  relever(a); a.lire()
  assert.equal(a.doctrine, 'essaim')
  w.teles = []; a.zonePepiniere(ps, 1, 50)
  assert.equal(w.teles.length, 1); assert.equal(w.teles[0].kind, 'cercle')
  // dispersés : à 120 px
  ps.forEach((p, i) => { p.s.x = ARENE.x0 + 60 + i * 120; p.s.y = y })
  relever(a); a.lire()
  assert.equal(a.doctrine, 'epines')
  w.teles = []; a.zonePepiniere(ps, 1, 50)
  assert.equal(w.teles.length, 1); assert.equal(w.teles[0].kind, 'ligne')
  // le leurre : les mêmes soldats dispersés, mais chacun avec son robot collé à lui → elle les croit serrés
  for (const p of ps) w.giveRobot(p, 10, p.s.x + 10, p.s.y)
  relever(a); a.lire()
  assert.equal(a.doctrine, 'essaim', 'les robots trompent la lecture')
  // et les épines vont à la silhouette la plus seule, robot compris : un robot envoyé seul attire la bande
  for (const r of w.robots.values()) { r.r.x = r.owner!.s.x + 10; r.r.y = r.owner!.s.y }
  const leurre = [...w.robots.values()][0]; leurre.r.x = cx; leurre.r.y = ARENE.y0 + 110
  for (const p of ps) p.s.y = y
  ps[0].s.x = ps[1].s.x - 15 // son soldat rejoint un camarade : seul le robot est isolé
  a.doctrine = 'epines'; w.teles = []; a.zonePepiniere(ps, 1, 50)
  assert.equal(Math.round(w.teles[0].y), ARENE.y0 + 110, 'la bande tombe sur le robot envoyé seul')
})

test('un pot de bouture n\'éclot que s\'il reste seul', () => {
  const { w, ps } = arene('serre', 1)
  const p = ps[0]
  const pres = w.spawnEnemy(E.POT, p.s.x + 20, p.s.y, { level: 27 }); pres.hatchT = 2
  const seul = w.spawnEnemy(E.POT, ARENE.x0 + 40, ARENE.y0 + 100, { level: 27 }); seul.hatchT = 2
  for (let i = 0; i < 60; i++) { p.s.x = pres.e.x - 20; p.s.y = pres.e.y; w.step(1 / 20) }
  assert.ok(w.enemies.has(pres.id), 'le pot gardé n\'a pas éclos')
  assert.ok(!w.enemies.has(seul.id), 'le pot laissé seul a éclos')
  assert.ok([...w.enemies.values()].some((e) => e.kind === E.BOUTURE), 'il en sort un Bouturé')
})

test('l\'appel du Greffier : les balles ne font rien à un nom ; le toucher le rend (soin du groupe) ; arrivé, il élargit la rature', () => {
  const { w, a, ps } = arene('registre', 2)
  const b = a.boss!
  for (const p of ps) { p.s.x = ARENE.x0 + 40; p.s.y = ARENE.y0 + 120 }
  a.appelT = 0; a.stepGreffier(0.05)
  const noms = [...w.enemies.values()].filter((e) => e.kind === E.PORTENOM)
  assert.ok(noms.length >= 2 && noms.every((e) => e.e.nom.length > 0), 'chaque porte-nom porte un nom')
  // tirer dessus ne sert à rien
  const pv = noms[1].e.hp
  w.damageEnemy(noms[1], 500, ps[0], false, false, 'balle')
  assert.equal(noms[1].e.hp, pv)
  // le premier arrive jusqu'à lui : cousu au registre, la rature s'élargit (le Greffier ne se soigne pas)
  const pv0 = b.e.hp
  noms[0].e.x = b.e.x; noms[0].e.y = b.e.y + 20
  a.stepPorteNom(noms[0], 0.05)
  assert.equal(b.e.hp, pv0)
  assert.equal(a.encre, 1)
  assert.ok(!w.enemies.has(noms[0].id))
  // un soldat va toucher le second : le nom est rendu, le groupe reprend 5 % de ses PV
  for (const p of ps) p.s.hp = Math.round(p.s.maxHp / 2)
  const hp0 = ps[1].s.hp
  ps[0].s.x = noms[1].e.x + 4; ps[0].s.y = noms[1].e.y
  a.stepPorteNom(noms[1], 0.05)
  assert.ok(!w.enemies.has(noms[1].id))
  assert.ok(ps[1].s.hp > hp0)
  // la rature : sur la droite des deux soldats, élargie par l'encre
  ps[0].s.x = ARENE.x0 + 60; ps[0].s.y = ARENE.y1 - 40; ps[1].s.x = ARENE.x1 - 60; ps[1].s.y = ARENE.y1 - 80
  a.phase = 1; w.teles = []; a.zoneGreffier(ps, 1, 50)
  const t = w.teles[0]
  assert.equal(t.kind, 'ligne'); assert.equal(t.r, 22)
  assert.ok(w.inTele(t, ps[0].s.x, ps[0].s.y, 4) && w.inTele(t, ps[1].s.x, ps[1].s.y, 4), 'les deux soldats sont sur la rature')
  assert.equal(a.encre, 0, 'l\'encre est dépensée')
})
