// Équilibrage du butin par simulation : un soldat monte de niveau en tuant ce que donne la région de son niveau, garde
// le meilleur objet de chaque emplacement, et on regarde sa puissance (dégâts par seconde × PV effectifs, relative à un
// soldat nu du même niveau). Usage : npx tsx tools/sim-butin.ts [graine]
import { butinEquip } from '../shared/butin.ts'
import { totalStats, slotsFor, SLOTS, type Equip, type Item } from '../shared/items.ts'
import { CLASSES, E, hpFor } from '../shared/rules.ts'
import { graine } from '../shared/motifs.ts'

const REGION = (l: number) => l < 4 ? 'plaines' : l < 8 ? 'foret' : l < 12 ? 'marais' : l < 14 ? 'plateaux' : l < 16 ? 'cimetiere' : 'eden'
/** la puissance d'une tenue : dégâts × cadence × critique, fois PV × résistance (relative à nu) */
export function puissance(eq: Equip, level: number) {
  const s = totalStats(eq)
  const crit = Math.min(40, s.crit) / 100 * (0.5 + s.critDeg / 100)
  const dps = (1 + s.deg / 100) / (1 - Math.min(60, s.cad) / 100) * (1 + crit)
  const pv = (hpFor('fantassin', level) + s.pv) / hpFor('fantassin', level) / (1 - Math.min(60, s.red) / 100)
  return dps * pv
}
const note = (it: Item, l: number) => puissance({ [slotsFor(it)[0]]: it }, l)

export function simuler(g = 1, tuesParNiveau = 60, elitesParNiveau = 3) {
  const R = graine(g)
  const eq: Equip = {}
  const lignes: { niveau: number; puissance: number; objets: number; leg: number; sets: number }[] = []
  let objets = 0, leg = 0, sets = 0
  for (let l = 1; l <= 30; l++) {
    const tirages = [...Array(tuesParNiveau).fill(false), ...Array(elitesParNiveau).fill(true)]
    for (const elite of tirages) for (const it of butinEquip({ kind: E.RAMPANT, level: l, elite, endroit: REGION(l), cls: 'fantassin' }, R)) {
      objets++; if (it.r === 4) leg++; if (it.set) sets++
      const sl = slotsFor(it).find((s) => !eq[s]) ?? slotsFor(it)[0]
      if (it.l > l + 3) continue
      if (!eq[sl] || note(it, l) > note(eq[sl]!, l)) eq[sl] = it
    }
    // un boss tous les 5 niveaux à partir du 10
    if (l >= 10 && l % 5 === 0) for (const it of butinEquip({ kind: l % 10 ? E.ENGLOUTISSEUR : E.COUVEUSE, level: l, elite: false, endroit: 'nid', cls: 'fantassin' }, R)) {
      objets++; if (it.set) sets++
      const sl = slotsFor(it).find((s) => !eq[s]) ?? slotsFor(it)[0]
      if (!eq[sl] || note(it, l) > note(eq[sl]!, l)) eq[sl] = it
    }
    lignes.push({ niveau: l, puissance: Math.round(puissance(eq, l) * 100) / 100, objets, leg, sets })
  }
  return { lignes, eq }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { lignes, eq } = simuler(Number(process.argv[2] ?? 1))
  for (const x of lignes) if (x.niveau % 5 === 0 || x.niveau === 1) console.log(`niv ${String(x.niveau).padStart(2)} · puissance ×${x.puissance} · ${x.objets} objets (${x.leg} légendaires, ${x.sets} pièces d'ensemble)`)
  console.log('tenue au 30 :', SLOTS.map((s) => `${s}:${eq[s]?.r ?? '-'}`).join(' '))
  void CLASSES
}
