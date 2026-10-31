// Spécialités, maîtrises, talents (shared/talents.ts) et les compétences de spécialité.
// Clés : specialite.<id>.nom / desc ; maitrise.<id>.nom / desc ; talent.<arbre>.<id> (le nom) ;
// competence.<id>.nom / desc pour les compétences de spécialité (celles des classes sont dans regles.ts).
import { SPECS, MAITRISES, TALENTS } from '../../talents.ts'

export function frTalents() {
  const talent: Record<string, Record<string, string>> = {}
  for (const t of TALENTS) { const [a, id] = t.id.split('.'); (talent[a] ??= {})[id] = t.nom }
  return {
    specialite: Object.fromEntries(SPECS.map((s) => [s.id, { nom: s.nom, desc: s.desc }])),
    maitrise: Object.fromEntries(MAITRISES.map((m) => [m.id, { nom: m.nom, desc: m.desc }])),
    talent,
    competence: Object.fromEntries(SPECS.map((s) => [s.competence, { nom: s.competenceNom, desc: s.competenceDesc }])),
  }
}

export const enTalents: Record<string, unknown> = {
  specialite: {
    rempart: { nom: 'Bulwark', desc: 'Soak hits, hold the line, protect the squad.' },
    assaut: { nom: 'Assault', desc: 'Damage and movement: get in, hit hard, get out.' },
    tireur: { nom: 'Sharpshooter', desc: 'One shot, one target, from very far.' },
    pisteur: { nom: 'Tracker', desc: 'Traps, marks, the hunt.' },
    chirurgien: { nom: 'Field Surgeon', desc: 'Keep everyone on their feet.' },
    biochimiste: { nom: 'Biochemist', desc: "Turn EDEN's chemistry against it." },
    mecanicien: { nom: 'Mechanic', desc: 'A tougher robot that takes the hits for you.' },
    dronier: { nom: 'Droner', desc: 'Swarms of small machines.' },
    artificier: { nom: 'Bombardier', desc: 'Explosives, and plenty of them.' },
    incendiaire: { nom: 'Firebrand', desc: 'Fire that holds the ground.' },
    parasite: { nom: 'Parasite', desc: "Scramble EDEN's signals." },
    spectre: { nom: 'Wraith', desc: 'Vanish, strike, vanish.' },
  },
  maitrise: {
    inebranlable: { nom: 'Unshakable', desc: 'Bastion lasts 3 s longer and blocks 55% of damage. +10% HP.' },
    phalange: { nom: 'Phalanx', desc: 'Bastion instantly revives downed allies in its area. +6% resistance.' },
    fureur: { nom: 'Fury', desc: 'Each kill takes 1 s off your skill cooldowns. +8% fire rate.' },
    belier: { nom: 'Battering Ram', desc: 'Breach deals 90 damage and stuns what it passes through for 1.5 s.' },
    faucon: { nom: 'Hawk Eye', desc: '+15% critical chance on targets more than 200 px away. +20% range.' },
    execution: { nom: 'Execution', desc: 'Piercing Shot deals triple damage to enemies under 30% HP and recharges 3 s faster.' },
    meute: { nom: 'Pack', desc: 'Net also lays a mine under each enemy caught (three at most).' },
    traque: { nom: 'Manhunt', desc: 'Marked enemies take 40% more damage instead of 25%. +6% speed.' },
    ange: { nom: 'Guardian Angel', desc: 'Once a minute, a nearby ally about to fall stays at 1 HP, untouchable for 3 s.' },
    transfusion: { nom: 'Transfusion', desc: "Drip heals 8% per second, and allies inside recharge their skills twice as fast." },
    contagion: { nom: 'Contagion', desc: 'An enemy dying in the Toxin hatches a new cloud, once per cloud.' },
    acide: { nom: 'Acid', desc: 'Your shots eat into biomass: 30% extra damage over 3 s. +5% damage.' },
    forteresse: { nom: 'Walking Fortress', desc: 'Your robot has 40% more HP, and Plating lasts 10 s.' },
    artilleur: { nom: 'Gunner', desc: 'Your robot deals 35% more damage, and its shots burst in an area.' },
    nuee: { nom: 'Horde', desc: 'Swarm releases five drones.' },
    kamikaze: { nom: 'Kamikaze', desc: 'When Swarm ends, each drone dives at the nearest enemy and explodes (60 damage).' },
    chaine: { nom: 'Chain Reaction', desc: 'Your explosions have a one-in-four chance to set off a second one nearby.' },
    saturation: { nom: 'Saturation', desc: 'Carpet Bombing drops eight wider charges.' },
    phenix: { nom: 'Phoenix', desc: 'While your Blaze burns, you regain 3% HP per second.' },
    napalm: { nom: 'Napalm', desc: 'Your shots set things alight: an enemy hit burns for 3 s (10 damage per second).' },
    surtension: { nom: 'Surge', desc: 'Short Circuit jumps to three other nearby enemies.' },
    sourdine: { nom: 'Damper', desc: 'Your shots slow by 40%, and a slowed enemy takes 15% more damage.' },
    ombre: { nom: 'Shade', desc: 'Veil lasts 6 s, and you move 30% faster inside it.' },
    assassin: { nom: 'Assassin', desc: 'The shot that breaks the Veil stuns for 2 s, and a kill under the Veil extends it by 2 s.' },
  },
  talent: {
    fantassin: { cuir: 'Thick Hide', gachette: 'Hair Trigger', tenir: 'Hold the Line', discipline: 'Discipline', veteran: 'Veteran', endurance: 'Stamina' },
    medic: { serment: 'Oath', constitution: 'Constitution', calme: 'Calm', gestes: 'Steady Hands', pas_vifs: 'Quick Steps', aiguilles: 'Needles' },
    ingenieur: { soudure: 'Welding', calibrage: 'Calibration', outillage: 'Toolkit', tablier: 'Leather Apron', ingenieux: 'Ingenious', chevrotine: 'Buckshot' },
    eclaireur: { oeil_vif: 'Sharp Eye', jambes: 'Long Legs', souffle: 'Held Breath', longue_vue: 'Spyglass', mise_a_mort: 'Kill Shot', camouflage: 'Camouflage' },
    demolisseur: { poudre: 'Black Powder', carrure: 'Broad Shoulders', souffle_large: 'Wide Blast', rechargement: 'Reload Drill', tete_froide: 'Cool Head', grosse_charge: 'Heavy Charge' },
    brouilleur: { frequence: 'Frequency', furtif: 'Stealthy', interference: 'Interference', siphon: 'Siphon', reflexes: 'Reflexes', resonance: 'Resonance' },
    rempart: { murs: 'Walls', bouclier_lourd: 'Heavy Shield', provocation: 'Provocation', carapace: 'Carapace', garde: 'Bodyguard', coup_de_crosse: 'Rifle Butt' },
    assaut: { elan: 'Momentum', rafale: 'Burst', acharnement: 'Relentless', charge: 'Charge', massacre: 'Carnage', instinct: 'Instinct' },
    tireur: { calibre: 'Heavy Calibre', stabilite: 'Stability', balistique: 'Ballistics', patience: 'Patience', concentration: 'Focus', perforant: 'Armour Piercing' },
    pisteur: { collets: 'Snares', pistes: 'Trails', terrain: 'Reading the Land', flair: 'Nose', embuscade: 'Ambush', sang_froid: 'Composure' },
    chirurgien: { bistouri: 'Scalpel', triage: 'Triage', garrot: 'Tourniquet', protocole: 'Protocol', veille: 'Vigil', miracle: 'Small Miracles' },
    biochimiste: { culture: 'Culture', virulence: 'Virulence', incubation: 'Incubation', mutagene: 'Mutagen', immunite: 'Immunity', catalyse: 'Catalysis' },
    mecanicien: { renforts: 'Bracing', servos: 'Servos', boulons: 'Bolts', entretien: 'Maintenance', hydraulique: 'Hydraulics', surpuissance: 'Overdrive' },
    dronier: { rotors: 'Rotors', essaim_dense: 'Dense Swarm', telemetrie: 'Telemetry', batteries: 'Batteries', micro_missiles: 'Micro-missiles', escorte: 'Escort' },
    artificier: { meche_courte: 'Short Fuse', charge_creuse: 'Shaped Charge', souffle: 'Blast Wave', detonateur: 'Detonator', demineur: 'Sapper', bouquet: 'Grand Finale' },
    incendiaire: { combustible: 'Fuel', bruleur: 'Burner', ignifuge: 'Fireproof Skin', tisonnier: 'Poker', foyer: 'Hearth', cendres: 'Ashes' },
    parasite: { virus: 'Virus', signal: 'Saturated Signal', brouillage: 'Jamming', parasitage: 'Leeching', ecrasement: 'Crush', retour: 'Backfire' },
    spectre: { pas_feutres: 'Soft Steps', lame: 'Blade', evanescence: 'Evanescence', point_faible: 'Weak Spot', disparition: 'Disappearance', dague: 'Dagger' },
  },
  competence: {
    bastion: { nom: 'Bastion', desc: 'You plant your pennant: you and nearby allies take 40% less damage for 6 s, and enemies around turn on you.' },
    percee: { nom: 'Breach', desc: 'You charge towards your aim, hurting everything in your path (50 damage), then your fire rate rises by 30% for 4 s.' },
    tir_lourd: { nom: 'Piercing Shot', desc: 'Half a second of aiming, then a shot that goes through everything on its line: 160 damage.' },
    filet: { nom: 'Net', desc: 'A net thrown towards your aim: enemies caught are held still for 2.5 s and marked.' },
    perfusion: { nom: 'Drip', desc: 'A healing aura around you for 6 s: 5% HP per second to nearby allies, robots included.' },
    toxine: { nom: 'Toxin', desc: "A cloud towards your aim for 5 s: 14 damage per second, double against EDEN's biomass." },
    blindage: { nom: 'Plating', desc: 'Your robot repairs 40%, takes 50% less damage and draws enemies for 6 s.' },
    essaim: { nom: 'Swarm', desc: 'Three drones circle you for 10 s and shoot whatever comes close.' },
    tapis: { nom: 'Carpet Bombing', desc: 'Five charges fall in a line towards your aim, one after another: 70 damage each.' },
    brasier: { nom: 'Blaze', desc: 'A ring of fire around you for 5 s: 22 damage per second to enemies inside.' },
    court_circuit: { nom: 'Short Circuit', desc: 'A discharge towards your aim: 40 damage, and enemies hit are stunned for 2.5 s (a boss is only slowed).' },
    voile: { nom: 'Veil', desc: 'You vanish for 4 s: enemies lose sight of you, and your first shot deals triple damage.' },
  },
}
