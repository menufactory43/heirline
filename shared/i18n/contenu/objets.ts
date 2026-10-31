// Les objets (shared/items.ts). Clés : objet.<b>.nom / desc ; rarete.<i>.nom ; stat.<k> ;
// equip.arme.<classe>.<rareté> ; equip.armure.<rareté> ; equip.module.<stat>.<rareté> (noms tirés au sort, voir itemKey)
import { BASES, RARETES, STAT_NOMS, NOMS_ARME, NOMS_ARMURE, NOMS_MODULE, NOMS_TENUE, LEGENDAIRES, ENSEMBLES } from '../../items.ts'

export function frObjets() {
  return {
    objet: Object.fromEntries(Object.entries(BASES).map(([k, b]) => [k, { nom: b.nom, desc: b.desc }])),
    rarete: RARETES.map((r) => ({ nom: r.nom })),
    stat: { ...STAT_NOMS },
    equip: { arme: NOMS_ARME, armure: NOMS_ARMURE, module: NOMS_MODULE, ...NOMS_TENUE },
    legendaire: Object.fromEntries(LEGENDAIRES.map((l) => [l.id, { nom: l.nom, desc: l.desc }])),
    ensemble: Object.fromEntries(ENSEMBLES.map((e) => [e.id, { nom: e.nom, quatre: e.quatre, ...e.noms }])),
  }
}

export const enObjets: Record<string, unknown> = {
  objet: {
    arme: { nom: 'Weapon', desc: "Replaces your class's weapon." },
    armure: { nom: 'Armor', desc: 'Health and resistance.' },
    module: { nom: 'Module', desc: 'A Colony circuit, wired into your suit.' },
    casque: { nom: 'Helmet', desc: 'Health, and whatever the affixes add.' },
    gants: { nom: 'Gloves', desc: 'Fire rate.' },
    bottes: { nom: 'Boots', desc: 'Walking speed.' },
    chassis: { nom: 'Robot chassis', desc: 'Fits on your robot: health for it.' },
    canon: { nom: 'Robot cannon', desc: 'Fits on your robot: damage for it.' },
    piece: { nom: 'Robot parts', desc: 'Servos, cables, plating: the workshop needs them to upgrade a robot.' },
    viande: { nom: 'Grazer meat', desc: 'The canteen turns it into stew.' },
    spore: { nom: 'EDEN spore', desc: 'A warm sac of spores. Still moving.' },
    herbe: { nom: 'Bloodfern', desc: 'An herb that stops bleeding. The Fertile know how to prepare it.' },
    champignon: { nom: 'Glowcap', desc: 'A marsh mushroom that glows in the dark.' },
    peau: { nom: 'Fernstalker silk', desc: 'Tough as cable.' },
    noyau: { nom: 'Data core', desc: 'The memory of a First Wave machine.' },
    echantillon: { nom: 'EDEN sample', desc: 'A piece of the Perfect Garden, sealed in glass.' },
    cassette: { nom: '"Rembobine" tape', desc: 'An otter on the label. Someone played it until the tape wore thin.' },
    tamagoyle_casse: { nom: 'Broken Tamagoyle', desc: 'A little three-button egg, screen dead. Joss at the workshop might know.' },
    tamagoyle: { nom: 'Tamagoyle', desc: "A tiny gargoyle blinks on the screen. It's hungry. Joss won't say what it is." },
    fil: { nom: 'Loom thread', desc: 'A thread of copper and sap, pulled from a Spinner. It hums when you point it north.' },
    bouture: { nom: 'Living cutting', desc: 'A stem cut from a Cutting. It is looking for soil.' },
    puce: { nom: 'Census chip', desc: 'A chip torn from a turned robot: a line of numbers, a bloodline name.' },
    trousse: { nom: 'Medkit', desc: 'Restores 45% HP. Tap the button to use it.' },
    baume: { nom: 'Fertile balm', desc: 'Restores 70% HP.' },
  },
  rarete: [{ nom: 'Common' }, { nom: 'Uncommon' }, { nom: 'Rare' }, { nom: 'Epic' }, { nom: 'Legendary' }, { nom: 'Set piece' }],
  stat: {
    deg: '% damage', cad: '% fire rate', pv: ' HP', red: '% resistance', vit: '% speed', robot: '% robot damage',
    robotPv: '% robot HP', crit: '% critical chance', critDeg: '% critical damage', cdr: '% faster cooldowns', soin: '% healing', zone: '% radius',
    puissance: '% power', portee: '% range', vol: '% lifesteal', esquive: '% faster dodge recharge', relever: '% revive speed',
  },
  equip: {
    arme: {
      fantassin: ['Assault rifle', 'Corps carbine', 'Numbered rifle', 'Fire Anchor'],
      medic: ['Pistol', 'Service pistol', 'Needle pistol', 'The Oath'],
      ingenieur: ['Shotgun', 'Riveter', 'Breach gun', 'Pile Driver'],
      eclaireur: ['Sniper rifle', 'Long carbine', 'Watch rifle', 'Last Word'],
      demolisseur: ['Grenade launcher', 'Blunderbuss', 'Charge thrower', 'Great Thunder'],
      brouilleur: ['Arc caster', 'Emitter', 'Ridge jammer', 'Whisper'],
    },
    armure: ['Canvas vest', 'Reinforced plate', 'Corps armor', 'First Wave carapace'],
    module: {
      vit: ['Leg servo', 'Tuned leg servo', "Runner's legs", "Sower's springs"],
      robot: ['Robot relay', 'Calibrated relay', 'Bloodline link', 'Workshop heart'],
      deg: ['Sight', 'Stabilized sight', "Marksman's sight", 'Eye of the Colony'],
      pv: ['Back plate', 'Doubled plate', 'Neck guard', 'Grafted frame'],
    },
    casque: ['Canvas cap', 'Dented helmet', 'Corps helmet', 'First Wave helm'],
    gants: ['Mittens', 'Work gloves', "Shooter's gloves", 'Corps grips'],
    bottes: ['Brogans', 'Marching boots', 'Patrol boots', 'Corps boots'],
    chassis: ['Scrap chassis', 'Reinforced chassis', 'Armored chassis', 'Workshop chassis'],
    canon: ['Patched cannon', 'Calibrated cannon', 'Guard cannon', 'Workshop cannon'],
  },
  legendaire: {
    ricochet: { nom: 'The Last Round', desc: 'One shot in eight bounces to two nearby enemies.' },
    visiere: { nom: "Lookout's Visor", desc: 'Your critical hits mark the target: 25% more damage taken for 4 s.' },
    rappel: { nom: 'Recall Cuirass', desc: 'Once every 30 s, a hit that takes you below 25% HP releases a wave that pushes back and stuns for 1 s.' },
    recycleur: { nom: "Recycler's Gauntlets", desc: 'Each enemy killed takes 1 s off your dodge recharge.' },
    braise: { nom: 'Ember Soles', desc: 'Your dodge leaves a 3 s fire behind you that burns enemies.' },
    condensateur: { nom: 'Cracked Capacitor', desc: 'After a skill, a one-in-five chance its cooldown is reset.' },
    porteur: { nom: "Bearer's Chassis", desc: 'If your robot is within 160 px, it takes 20% of the damage dealt to you.' },
    jumeau: { nom: 'Twin Cannon', desc: 'Your robot fires two bullets with each shot.' },
    fil: { nom: 'The Loom Thread', desc: 'Each shot leaves a thread on a Highlands creature; at the fifth, it is bound for 1.5 s and the threads fall.' },
    masque_seve: { nom: 'Sap Mask', desc: "The Nursery can't read your hits: they don't count in its reading, and its reduction doesn't apply to you." },
    recenseur: { nom: "Census-Taker's Gloves", desc: '4% more damage per different source used in the last 6 seconds (bullets, explosions, robot, skills), up to 16%.' },
    sillon: { nom: 'Furrow Boots', desc: 'Your dodge restores 6% of your HP per enemy brushed past (60 px), up to 18%.' },
    bobine: { nom: "Weaver's Bobbin", desc: "Gleaners can't switch off your robot, and it regains 2% of its HP per second." },
  },
  ensemble: {
    couveuse: { nom: "Brooder's Remains", quatre: 'Each enemy you kill bursts into a spore that heals you and nearby allies for 4%.', casque: "Brooder's Skull", armure: "Brooder's Shell", gants: "Brooder's Claws", bottes: "Brooder's Legs" },
    engloutisseur: { nom: "Engulfer's Jaws", quatre: 'Every 10 s, your next shot is devouring: 150% extra damage, and it pulls small enemies towards the impact.', casque: "Engulfer's Snout", armure: "Engulfer's Belly", gants: "Engulfer's Fangs", bottes: "Engulfer's Scales" },
    constance: { nom: 'Crew of the Constance', quatre: 'While your robot is within 120 px, you both take 15% less damage, and it shoots what you hit.', casque: "Bosun's cap", armure: 'Deck jacket', gants: 'Watch gloves', bottes: 'Deck boots' },
    trame: { nom: 'Weft of the Loom', quatre: 'Each different source you use weaves a thread (four at most); with all four, your next skill does not go on cooldown and the threads fall.', casque: 'Weft hood', armure: 'Warp-and-weft mail', gants: 'Shuttle fingers', bottes: 'Selvedge steps' },
  },
}
