// Classes, compétences, créatures, boss de test (shared/rules.ts, shared/boss-test.ts).
// Clés : classe.<id>.nom / arme ; competence.<id>.nom / desc ; ennemi.<kind>.nom / un (« un rampant », pour « tué par… ») ;
// bosstest.<id>.nom / lieu
import { CLASSES, ENEMIES, E } from '../../rules.ts'
import { BOSS_TEST } from '../../boss-test.ts'

/** « un rampant », « une sangsue des marais », « la Couveuse » */
function un(kind: number, nom: string) {
  if (/^(La |L')/.test(nom)) return nom.charAt(0).toLowerCase() + nom.slice(1)
  return (kind === E.SANGSUE || kind === E.FILEUSE || kind === E.BALISE ? 'une ' : 'un ') + nom.charAt(0).toLowerCase() + nom.slice(1)
}

export function frRegles() {
  return {
    classe: Object.fromEntries(Object.values(CLASSES).map((c) => [c.id, { nom: c.nom, arme: c.arme.nom }])),
    competence: Object.fromEntries(Object.values(CLASSES).flatMap((c) => c.competences).map((s) => [s.id, { nom: s.nom, desc: s.desc }])),
    ennemi: Object.fromEntries(Object.entries(ENEMIES).map(([k, e]) => [k, { nom: e.nom, un: un(Number(k), e.nom) }])),
    bosstest: Object.fromEntries(Object.entries(BOSS_TEST).map(([k, b]) => [k, { nom: b.nom, lieu: b.lieu }])),
  }
}

export const enRegles: Record<string, unknown> = {
  classe: {
    fantassin: { nom: 'Trooper', arme: 'Assault rifle' },
    medic: { nom: 'Medic', arme: 'Pistol' },
    ingenieur: { nom: 'Engineer', arme: 'Shotgun' },
    eclaireur: { nom: 'Scout', arme: 'Sniper rifle' },
    demolisseur: { nom: 'Demolisher', arme: 'Grenade launcher' },
    brouilleur: { nom: 'Jammer', arme: 'Arc caster' },
  },
  competence: {
    bouclier: { nom: 'Shield', desc: 'Take 60% less damage for 4 s.' },
    grenade: { nom: 'Grenade', desc: 'Thrown where you aim, explodes in an area.' },
    injection: { nom: 'Injection', desc: 'Heals 35% HP to everyone nearby, robots included.' },
    adrenaline: { nom: 'Adrenaline', desc: 'You and nearby allies move 40% faster for 4 s; revives downed allies around you.' },
    tourelle: { nom: 'Turret', desc: 'Deploys a turret that fires for 12 s.' },
    surcharge: { nom: 'Overcharge', desc: 'Your robot fires twice as fast and repairs 30% over 6 s.' },
    marquage: { nom: 'Mark', desc: 'Marks enemies where you aim: they take 25% more damage for 8 s.' },
    piege: { nom: 'Trap', desc: 'Lays a mine at your feet: it blows when an enemy walks by (60 damage). Two at most.' },
    mortier: { nom: 'Mortar', desc: 'A shell lands where you aim after a warning: 90 area damage.' },
    onde: { nom: 'Shockwave', desc: 'Knocks back and stuns everything around you for 0.6 s (30 damage).' },
    champ: { nom: 'Jamming Field', desc: 'A field where you aim for 5 s: enemies inside move half as fast.' },
    leurre: { nom: 'Decoy', desc: 'A holographic double where you aim draws enemies for 6 s.' },
  },
  ennemi: {
    0: { nom: 'Crawler', un: 'a Crawler' }, 1: { nom: 'Spitter', un: 'a Spitter' }, 2: { nom: 'Plated', un: 'a Plated' }, 3: { nom: 'Egg', un: 'an Egg' }, 4: { nom: 'The Brooder', un: 'the Brooder' },
    5: { nom: 'Grazer', un: 'a Grazer' }, 6: { nom: 'Prowler', un: 'a Prowler' }, 7: { nom: 'Fernstalker', un: 'a Fernstalker' }, 8: { nom: 'Marsh Leech', un: 'a Marsh Leech' }, 9: { nom: 'Bloater', un: 'a Bloater' },
    10: { nom: 'Rustling', un: 'a Rustling' }, 11: { nom: 'Grafted', un: 'a Grafted' }, 12: { nom: 'The Engulfer', un: 'the Engulfer' }, 13: { nom: 'Leafhorn', un: 'a Leafhorn' }, 14: { nom: 'Brood Sac', un: 'a Brood Sac' }, 15: { nom: 'The Maw', un: 'the Maw' }, 16: { nom: 'The Sower', un: 'the Sower' },
    17: { nom: 'Gleaner', un: 'a Gleaner' }, 18: { nom: 'Turned Robot', un: 'a Turned Robot' }, 19: { nom: 'Spy Bud', un: 'a Spy Bud' }, 20: { nom: 'Cutting', un: 'a Cutting' },
    21: { nom: 'Loom Pylon', un: 'a Loom Pylon' }, 22: { nom: 'The Nursery', un: 'the Nursery' }, 23: { nom: 'The Registrar', un: 'the Registrar' }, 24: { nom: 'The Gleaner Queen', un: 'the Gleaner Queen' },
    25: { nom: 'Name-Bearer', un: 'a Name-Bearer' }, 26: { nom: 'Cutting Pot', un: 'a Cutting Pot' }, 27: { nom: 'Gleaned Beacon', un: 'a Gleaned Beacon' }, 28: { nom: 'Spinner', un: 'a Spinner' },
  },
  bosstest: {
    couveuse: { nom: 'The Brooder', lieu: 'an instance of the Nest' },
    engloutisseur: { nom: 'The Engulfer', lieu: "the Engulfer's Den" },
    engloutisseur_h: { nom: 'The Engulfer (heroic)', lieu: 'the Den, heroic' },
    gueule: { nom: 'The Maw', lieu: 'the Gullet' },
    gueule_h: { nom: 'The Maw (heroic)', lieu: 'the Gullet, heroic' },
    semeur: { nom: 'The Sower (raid)', lieu: "the Sower's Offensive, ten strong" },
    glaneuse: { nom: 'The Gleaner Queen (raid)', lieu: 'the Assault on the Loom, ten strong' },
    pepiniere: { nom: 'The Nursery', lieu: 'the Greenhouse' },
    pepiniere_h: { nom: 'The Nursery (heroic)', lieu: 'the Greenhouse, heroic' },
    greffier: { nom: 'The Registrar', lieu: 'the Registry' },
    greffier_h: { nom: 'The Registrar (heroic)', lieu: 'the Registry, heroic' },
  },
}
