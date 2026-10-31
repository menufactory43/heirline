// Les noms de lieux. Clés : region.<id>.nom ; lieu.<id>.nom (lieux habités, points d'intérêt, salles de la Constance,
// ruches, cols, rivières) ; batiment.<id>.nom ; station.<id>.nom ; carte.<id>.nom ; passage.<id>.nom
import { REGIONS, LIEUX } from '../../regions/index.ts'
import { COLS, RIVIERES } from '../../regions/relief.ts'
import { CONSTANCE_LIEUX } from '../../cartes/constance.ts'
import { RUCHES } from '../../front.ts'
import { BATIMENTS } from '../../batiments.ts'
import { STATIONS, CARTES, PASSAGES } from '../../monde.ts'

const noms = (l: { id: string; nom: string }[]) => Object.fromEntries(l.map((x) => [x.id, { nom: x.nom }]))
export function frLieux() {
  return {
    region: noms(REGIONS),
    lieu: { ...noms(REGIONS.flatMap((r) => r.pois)), ...noms(LIEUX), ...noms(CONSTANCE_LIEUX), ...noms(RUCHES), ...noms(COLS), ...noms(RIVIERES), nid: { nom: 'Le nid (par la Gueule)' } },
    batiment: noms(BATIMENTS),
    station: noms(STATIONS),
    carte: noms(Object.values(CARTES)),
    passage: noms(PASSAGES),
  }
}

export const enLieux: Record<string, unknown> = {
  region: {
    plaines: { nom: 'Coastal Plains' }, foret: { nom: 'Fernwood' }, marais: { nom: 'The Sapmire' },
    plateaux: { nom: 'Basalt Plateaus' }, cimetiere: { nom: 'Machine Graveyard' }, eden: { nom: 'EDEN Lands' },
    lisiere: { nom: 'The Fringe' }, champs: { nom: 'The Iron Fields' }, pepiniere: { nom: 'The Nursery' }, metier: { nom: 'The High Loom' },
  },
  lieu: {
    tertre: { nom: "Settlers' Mound" }, clairiere: { nom: 'Spore Glade' }, source: { nom: 'The Black Spring' },
    antre: { nom: "The Engulfer's Den" }, champ_epaves: { nom: 'The Carcass Field' }, jardin: { nom: 'The Perfect Garden' },
    port: { nom: 'Anchorport' }, ferme: { nom: 'Aldo Farm' }, anse: { nom: 'Greycove' }, fougere: { nom: 'Fern Outpost' },
    hauteseve: { nom: 'Highsap' }, postemarais: { nom: 'Marsh Outpost' }, relais: { nom: 'Pass Relay' }, mine: { nom: 'The Mine' },
    ruines: { nom: 'First Wave Ruins' }, bastion: { nom: 'Colony Bastion' }, epave: { nom: 'Wreck of the Constance' },
    campepave: { nom: 'Wreck Camp' }, casse: { nom: 'The Scrapyard' }, gueule: { nom: 'The Nest Maw' },
    constance_coursive: { nom: 'The Main Gangway' }, cabine_enfant: { nom: "A Child's Cabin" }, salle_jeux: { nom: 'The Playroom' },
    soute: { nom: 'The Drone Hold' }, machines: { nom: 'The Engine Room' }, passerelle: { nom: 'The Bridge' }, salle_cachee: { nom: 'A Sealed Room' },
    ruche_nord: { nom: 'The Great Hive' }, ruche_est: { nom: 'The Cliff Hive' }, ruche_marais: { nom: 'The Drowned Hive' },
    ruche_plateau: { nom: 'The Basalt Hive' }, ruche_epave: { nom: 'The Carcass Hive' },
    col_sud: { nom: 'Relay Pass' }, col_ouest: { nom: 'Mine Pass' }, col_est: { nom: 'Bastion Pass' }, col_nord: { nom: 'Carcass Pass' }, col_eden: { nom: 'Violet Pass' },
    relache: { nom: 'Relâche' }, gue_glane: { nom: 'Glane Ford' }, sillon: { nom: 'The Furrow' }, serres: { nom: 'The Greenhouses' }, mat: { nom: 'The Relay Mast' },
    greves: { nom: 'The Rust Strands' }, lande_vent: { nom: 'The Windy Heath' }, sillons: { nom: 'The Robot Furrows' }, robot_cassette: { nom: 'A Seated Robot' },
    verriere: { nom: 'The Great Glasshouse' }, mat_grave: { nom: 'The Carved Mast' }, metier_vue: { nom: 'The Loom' },
    foyer_champs: { nom: 'The Furrow Hearth' }, foyer_serre: { nom: 'The Greenhouse Hearth' }, foyer_metier: { nom: 'The Loom Hearth' },
    claire: { nom: 'The Clearwater' }, seve: { nom: 'The Sap' }, nid: { nom: 'The Nest (through the Maw)' },
  },
  batiment: {
    caserne: { nom: 'Numbered Corps Barracks' }, infirmerie: { nom: 'Infirmary' }, maisonA: { nom: 'The Ferrand House' },
    atelier: { nom: 'Robot Workshop' }, maisonB: { nom: 'The Aubert House' }, maisonC: { nom: 'The Lenoir House' },
    maisonD: { nom: 'The Quesnel House' }, entrepot: { nom: 'Warehouse' }, cantine: { nom: 'Canteen' },
    comptoir: { nom: 'Scrappers\' Counter' }, maisonE: { nom: 'The Garnier House' }, maisonF: { nom: 'The Odile House' },
    maisonG: { nom: 'The Teodor House' }, maisonH: { nom: 'The Rivet House' }, grange: { nom: 'Aldo Barn' }, ferme: { nom: 'Aldo Farm' },
    poste_fougere: { nom: 'Fern Outpost' }, baraque_fougere: { nom: 'Scouts\' Hut' }, seve_maison1: { nom: 'Root House' },
    seve_maison2: { nom: 'Root House' }, seve_serre: { nom: 'The Fertile Greenhouse' }, poste_marais: { nom: 'Marsh Outpost' },
    casse_hangar: { nom: 'Scrapyard Hangar' }, casse_tente1: { nom: "Rivet's Tent" }, casse_tente2: { nom: 'Scrappers\' Tent' },
    anse_cabane1: { nom: 'The Morvan Shack' }, anse_cabane2: { nom: 'Fish Smokehouse' }, anse_hangar: { nom: 'Net Shed' },
    relais_auberge: { nom: 'Relay Inn' }, relais_ecurie: { nom: 'Robot Garage' }, mine_baraque: { nom: "Miners' Hut" },
    mine_forge: { nom: 'Mine Forge' }, bastion_caserne: { nom: 'Bastion Barracks' }, bastion_poudriere: { nom: 'Powder Store' },
    camp_tente1: { nom: "Salvagers' Tent" }, camp_atelier: { nom: 'Makeshift Workshop' },
    rel_capitainerie: { nom: "Relâche Harbour Office" }, rel_forge: { nom: 'Highlands Forge' }, rel_escale: { nom: 'The Stopover' }, rel_tisserand: { nom: "Weaver's Workshop" },
    gue_poste: { nom: 'Ford Post' }, gue_cabane: { nom: "Ferryman's Hut" }, sillon_tente: { nom: 'Iron Gleaners\' Tent' }, sillon_atelier: { nom: 'Furrow Workshop' },
  },
  station: {
    st_port: { nom: 'Anchorport Station' }, st_fougere: { nom: 'Fern Halt' }, st_marais: { nom: 'Marsh Halt' },
    st_col: { nom: 'Pass Halt' }, st_epave: { nom: 'Wreck Halt' }, st_bastion: { nom: 'Bastion Halt' },
    st_gue: { nom: 'Ford Halt' }, st_champs: { nom: 'Fields Halt' }, st_mat: { nom: 'Mast Halt' }, st_anse: { nom: 'Greycove Landing' }, st_relache: { nom: 'Relâche Quay' },
  },
  carte: { ossara: { nom: 'Ossara, the continent' }, constance: { nom: 'Wreck of the Constance' }, nid: { nom: 'The Nest' }, semeur: { nom: "The Sower's Offensive" }, antre: { nom: "The Engulfer's Den" }, antre_h: { nom: "The Engulfer's Den (heroic)" }, gueule: { nom: 'The Gullet' }, gueule_h: { nom: 'The Gullet (heroic)' }, serre: { nom: 'The Greenhouse' }, serre_h: { nom: 'The Greenhouse (heroic)' }, registre: { nom: 'The Registry' }, registre_h: { nom: 'The Registry (heroic)' }, metier_raid: { nom: 'The Assault on the Loom' } },
  passage: {
    sas_constance: { nom: 'Constance Airlock' }, constance_sas: { nom: 'Out to the Graveyard' },
    gueule_nid: { nom: 'The Nest Maw' }, nid_sortie: { nom: 'Nest Exit' },
    antre_entree: { nom: "The Engulfer's Den" }, antre_entree_h: { nom: 'The Den (heroic)' }, antre_sortie: { nom: 'Den Exit' }, antre_h_sortie: { nom: 'Den Exit' },
    semeur_entree: { nom: "The Sower's Offensive" }, semeur_sortie: { nom: 'Back to the front' },
    gueule_entree: { nom: 'The Gullet' }, gueule_entree_h: { nom: 'The Gullet (heroic)' }, gueule_sortie: { nom: 'Gullet Exit' }, gueule_h_sortie: { nom: 'Gullet Exit' },
    serre_entree: { nom: 'The Greenhouse' }, serre_entree_h: { nom: 'The Greenhouse (heroic)' }, serre_sortie: { nom: 'Greenhouse Exit' }, serre_h_sortie: { nom: 'Greenhouse Exit' },
    metier_entree: { nom: 'The Assault on the Loom' }, metier_sortie: { nom: 'Back to the Highlands' },
    registre_entree: { nom: 'The Registry' }, registre_entree_h: { nom: 'The Registry (heroic)' }, registre_sortie: { nom: 'Registry Exit' }, registre_h_sortie: { nom: 'Registry Exit' },
  },
}
