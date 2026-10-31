// Les quêtes d'Ossara : la trame (ÉDEN, le Semeur, les Fertiles, avec un vrai choix) et les quêtes de chaque région.
// Fiches partagées : le serveur fait avancer les objectifs, le client affiche les ! et les ?, le journal et la carte.
import { E, type Famille } from './rules.ts'
import { QUESTS_C2 } from './quetes-c2.ts'

export type Objectif =
  | { t: 'parler'; npc: string; texte: string }
  | { t: 'tuer'; kinds?: number[]; famille?: Famille; n: number; texte: string; ou?: string }
  /** `lecture` : ce qu'on y lit en arrivant (un texte de shared/journaux.ts, ouvert à l'écran) */
  | { t: 'explorer'; lieu: string; texte: string; lecture?: string }
  | { t: 'ramasser'; b: string; n: number; texte: string; ou?: string }
  | { t: 'escorte'; npc: string; vers: string; texte: string }
  | { t: 'reparer'; type: 'lampe' | 'balise'; n: number; texte: string }
  /** lire un texte (un journal, une stèle : voir shared/journaux.ts) ; `ou` : le lieu où le trouver */
  | { t: 'lire'; id: string; texte: string; ou?: string }

export interface Recompense { xp: number; ferraille: number; objet?: { b: 'arme' | 'armure' | 'module'; r: number }; items?: { b: string; n: number }[]; /** un drapeau de lignée (ex. la selle du robot) */ flag?: [string, string]; /** un texte à lire, débloqué */ lecture?: string }
export interface Choix { label: string; texte: string; flag: string; recompense: Recompense }
/** La fin de la campagne 1 : elle dépend du front (tout le serveur) et du choix de Haute-Sève (chaque lignée). */
export type FinCampagne = 'victoire_fertiles' | 'victoire_colonie' | 'evacuation'
/** La fin de la campagne 2 : le front des Hauts (les foyers, les victoires de l'assaut du Métier) et le choix du Métier. */
export type FinCampagne2 = 'victoire_delivres' | 'victoire_laisse' | 'repli'
export interface QuestDef {
  id: string; nom: string; zone: string; principale?: boolean
  /** l'acte de la trame ; la campagne (2 : les Hauts de Glane, sinon la 1) */
  acte?: 1 | 2 | 3; campagne?: 2
  donneur: string; rendre: string; niveau: number
  requis?: string[]
  /** au moins une de ces quêtes faite (les deux voies d'un choix) */
  requisUn?: string[]
  flag?: [string, string]
  /** un drapeau posé dès qu'on accepte (la clé de l'épave) */
  aAccepter?: [string, string]
  intro: string; fin: string
  objectifs: Objectif[]
  recompense: Recompense
  /** cle : le drapeau de lignée que le choix pose (« choix » par défaut, « choix2 » pour la campagne 2) */
  choix?: { question: string; a: Choix; b: Choix; cle?: string }
  /** une fin qui dépend de l'état du monde (le dernier pas de la campagne) */
  fins?: Partial<Record<FinCampagne | FinCampagne2, string>>
}

export const QUESTS: QuestDef[] = [
  // ======================================================== la trame : campagne 1, « La côte de Port-Ancre »
  // Acte 1 — La colonie (niveaux 1 à 6)
  { id: 'matricule', nom: 'Matricule', zone: 'plaines', principale: true, acte: 1, donneur: 'ysolde', rendre: 'ysolde', niveau: 1,
    intro: "Ton matricule est inscrit. Avant de sortir des murs, va voir Joss à l'atelier pour ton robot, puis Nadia sur la place pour ton arme. Ensuite, reviens.",
    fin: 'Te voilà équipé. Le Corps des Matricules ne promet qu\'une chose : on écrira ton nom.',
    objectifs: [{ t: 'parler', npc: 'joss', texte: "Parler à Joss, à l'atelier" }, { t: 'parler', npc: 'nadia', texte: "Parler à Nadia, l'armurière" }],
    recompense: { xp: 80, ferraille: 25, objet: { b: 'armure', r: 1 }, items: [{ b: 'trousse', n: 2 }] } },
  { id: 'ce_qui_pousse', nom: 'Ce qui pousse', zone: 'plaines', principale: true, acte: 1, donneur: 'ysolde', rendre: 'agathe', niveau: 2, requis: ['matricule'],
    intro: "ÉDEN pousse jusque dans nos champs. Abats ce qui sort de terre et ramène des spores à la docteure Lin : elle veut comprendre ce qu'on respire.",
    fin: "Elles sont tièdes… et elles s'organisent. Je les garde à l'œil. Joss voulait te voir pour ton robot, passe à l'atelier.",
    objectifs: [{ t: 'tuer', famille: 'eden', n: 8, texte: "Abattre des créatures d'ÉDEN" }, { t: 'ramasser', b: 'spore', n: 4, texte: "Rapporter des spores d'ÉDEN" }],
    recompense: { xp: 160, ferraille: 35, objet: { b: 'module', r: 1 } } },
  { id: 'la_selle', nom: 'La selle', zone: 'plaines', principale: true, acte: 1, donneur: 'joss', rendre: 'joss', niveau: 3, requis: ['matricule'],
    intro: "Ton robot peut te porter, tu sais. Les colons d'avant montaient dessus pour aller aux champs. Il me faut du cuir de Broutard pour la sangle, et les boucles que Basile garde sous son comptoir. Ramène-moi les deux.",
    fin: "Voilà. Le module de transport est posé, la selle tient. Appuie sur « Monter » : il va plus vite que toi. Mais au premier coup de feu, ou au premier coup reçu, tu redescends. Et la docteure Lin te cherche : le Poste de la Fougère ne répond plus.",
    objectifs: [{ t: 'tuer', kinds: [E.BROUTARD], n: 4, texte: 'Abattre des Broutards pour leur cuir', ou: 'plaines' }, { t: 'parler', npc: 'basile', texte: 'Récupérer les boucles chez Basile' }],
    recompense: { xp: 120, ferraille: 10, flag: ['selle', '1'] } },
  { id: 'message_fougere', nom: 'Le message de la Fougère', zone: 'foret', principale: true, acte: 1, donneur: 'agathe', rendre: 'corinne', niveau: 4, requis: ['ce_qui_pousse', 'la_selle'],
    intro: 'Le Poste de la Fougère ne répond plus depuis trois jours. Sors par la porte ouest, passe la ferme et le pont de la Claire, et porte mes notes à la lieutenante Saulnier. Monte ton robot : c\'est loin.',
    fin: "Des notes de Lin ? Alors Port-Ancre ne nous a pas oubliés. La biomasse est venue jusqu'aux palissades. Et dans la boue, après, on a trouvé des traces de pas. Des pas humains, pieds nus, qui partaient vers le sud.",
    objectifs: [{ t: 'explorer', lieu: 'fougere', texte: 'Rejoindre le Poste de la Fougère' }, { t: 'parler', npc: 'corinne', texte: 'Parler à la lieutenante Saulnier' }],
    recompense: { xp: 260, ferraille: 40, objet: { b: 'arme', r: 1 } } },
  { id: 'les_fertiles', nom: 'Les Fertiles', zone: 'foret', principale: true, acte: 1, donneur: 'corinne', rendre: 'maelle', niveau: 5, requis: ['message_fougere'],
    intro: "Les traces vont au sud de la forêt, vers un village. Les nôtres l'appellent Haute-Sève. Va voir qui ils sont, sans tirer le premier.",
    fin: "Tu n'as pas tiré. Bien. Nous sommes des colons, comme toi. Nous avons laissé ÉDEN entrer dans nos veines pour vivre ici. On nous appelle les Fertiles. D'où nous venons ? Ça, tu ne l'apprendras pas aujourd'hui.",
    objectifs: [{ t: 'explorer', lieu: 'hauteseve', texte: 'Trouver Haute-Sève' }, { t: 'parler', npc: 'maelle', texte: 'Parler à la doyenne du village' }],
    recompense: { xp: 320, ferraille: 30 } },
  { id: 'le_choix', nom: 'Le choix', zone: 'foret', principale: true, acte: 1, donneur: 'corinne', rendre: 'ysolde', niveau: 5, requis: ['les_fertiles'],
    intro: 'Port-Ancre exige un rapport sur Haute-Sève. La capitaine Brasier veut savoir où ils sont. Je ne te dis pas quoi répondre. Je te dis seulement qu\'elle a déjà fait brûler un village.',
    fin: 'Le Corps prend note.',
    objectifs: [{ t: 'parler', npc: 'ysolde', texte: 'Faire ton rapport à la capitaine Brasier' }],
    recompense: { xp: 500, ferraille: 0 },
    choix: {
      question: "Brasier déplie une carte. « Où vivent-ils, matricule ? Des gens qui laissent ÉDEN entrer dans leur sang ne sont plus des gens. Donne-moi la position et le Corps s'en occupera. »",
      a: { label: 'Livrer la position de Haute-Sève', flag: 'colonie', texte: "Brasier entoure le village au crayon rouge. « Le Corps n'oublie pas ceux qui le servent. » Dehors, on prépare des lance-flammes. La docteure Lin voulait te voir.", recompense: { xp: 0, ferraille: 160, objet: { b: 'armure', r: 2 } } },
      b: { label: 'Taire la position', flag: 'fertiles', texte: "« Rien vu, capitaine. Des fougères et des ruines. » Brasier te fixe longtemps. « Rompez. » Elle sait. Mais Haute-Sève vivra. La docteure Lin voulait te voir.", recompense: { xp: 0, ferraille: 20, objet: { b: 'module', r: 2 }, items: [{ b: 'baume', n: 3 }] } },
    } },
  { id: 'le_code', nom: 'Le code', zone: 'plaines', principale: true, acte: 1, donneur: 'agathe', rendre: 'agathe', niveau: 6, requis: ['le_choix'],
    intro: "J'ai besoin de spores fraîches, prises sur des bêtes d'ÉDEN vivantes ce matin, pas sur des cadavres d'hier. Il y a quelque chose dans leur noyau que je n'arrive pas à croire. Je veux en être sûre.",
    fin: "C'est confirmé. Dans chaque spore, la même séquence, à la base près, avec des marqueurs de début et de fin. Une signature de laboratoire. Ce qui pousse dans nos champs a été écrit par des humains. Je ne sais pas encore par qui. Ilona, la scribe, dit que les tombes du Tertre sont plus vieilles que nous. Commence par là.",
    objectifs: [{ t: 'tuer', famille: 'eden', n: 10, texte: "Abattre des créatures d'ÉDEN" }, { t: 'ramasser', b: 'spore', n: 3, texte: 'Rapporter des spores fraîches' }],
    recompense: { xp: 600, ferraille: 50, objet: { b: 'module', r: 1 }, lecture: 'notes_lin' } },

  // Acte 2 — La Première Vague (niveaux 6 à 13)
  { id: 'tertre', nom: 'Le Tertre', zone: 'plaines', principale: true, acte: 2, donneur: 'ilona', rendre: 'ilona', niveau: 6, requis: ['le_code'],
    intro: "Au sud, sur le Tertre, il y a des tombes. On a toujours dit que c'étaient celles des premiers de Port-Ancre. Mais Port-Ancre a trente et un ans, et ces pierres sont usées comme des galets. Va les lire. Moi, je n'ose plus.",
    fin: "« An 3 de l'Arrivée ». Nous, nous comptons depuis la Patience. Il y a eu une autre arrivée. D'autres colons, avant nous, ici. Et ce robot en fer-blanc… On raconte qu'un vieux robot chante au Cimetière des Machines, près de l'épave. Si quelqu'un connaît ces noms, c'est lui.",
    objectifs: [{ t: 'explorer', lieu: 'tertre', texte: 'Monter au Tertre des Colons' }, { t: 'lire', id: 'stele_tertre', texte: 'Lire les stèles', ou: 'tertre' }],
    recompense: { xp: 700, ferraille: 40 } },
  { id: 'chant_robot', nom: 'Le robot qui chante', zone: 'cimetiere', principale: true, acte: 2, donneur: 'septieme', rendre: 'septieme', niveau: 12, requis: ['tertre'],
    intro: 'LES GREFFÉS. ILS ÉTAIENT MES COLONS. ILS PORTENT ENCORE LEURS NOMS SOUS LA CHAIR. LIBÈRE-LES. JE CHANTERAI LEURS NOMS.',
    fin: '♪ … AUBERT, LENOIR, MAREST, KIMURA … ♪ MERCI. JE SUIS CANTOR, ROBOT DE LA COLONIE DE LA CONSTANCE. MÉMOIRE : 4 %. MES REGISTRES SONT RESTÉS DANS LES RUINES, AU-DELÀ DU FRONT.',
    objectifs: [{ t: 'tuer', kinds: [E.GREFFE], n: 6, texte: 'Libérer des Greffés' }],
    recompense: { xp: 820, ferraille: 70, objet: { b: 'arme', r: 2 } } },
  { id: 'journaux_bord', nom: 'Les journaux de bord', zone: 'plateaux', principale: true, acte: 2, donneur: 'septieme', rendre: 'septieme', niveau: 12, requis: ['chant_robot'],
    intro: "TROIS CŒURS DE DONNÉES. LE JOURNAL DU COMMANDANT, MON REGISTRE, LES NOTES DE L'ÉQUIPE. ILS SONT DANS LES RUINES DE LA COLONIE, SUR LES PLATEAUX. LA BIOMASSE LES A RECOUVERTS. RAPPORTE-LES. LIS-LES : CE SONT AUSSI LES TIENS.",
    fin: "TU AS LU. TU SAIS : LA CONSTANCE. NOUS SOMMES VENUS AVANT VOUS. NOUS NOUS SOMMES ÉCRASÉS. LE RESTE EST DANS L'ÉPAVE, SUR LA PASSERELLE. LE SAS EST SCELLÉ. QUELQU'UN DOIT L'OUVRIR.",
    objectifs: [{ t: 'ramasser', b: 'noyau', n: 3, texte: 'Récupérer des cœurs de données', ou: 'ruines' }],
    recompense: { xp: 1000, ferraille: 90, objet: { b: 'armure', r: 2 } } },
  // la Constance : selon le choix de l'acte 1, Maëlle Sève (Haute-Sève tue) ou Cantor (Haute-Sève livrée) ouvre le sas
  { id: 'la_constance', nom: 'La Constance', zone: 'cimetiere', principale: true, acte: 2, donneur: 'maelle', rendre: 'septieme', niveau: 12, requis: ['journaux_bord'], flag: ['choix', 'fertiles'], aAccepter: ['cle_constance', '1'],
    intro: "Tu as tenu ta langue devant Brasier. Alors je te dois la vérité. Mon arrière-grand-père s'appelait Paul Sève. Il était sur la Constance, le vaisseau d'avant le vôtre. Quand la colonie s'est vidée, les derniers ont laissé la sève entrer dans leur sang pour ne pas mourir. Nous sommes leurs enfants. Voici sa clé : elle ouvre le sas de l'épave. Monte jusqu'à la passerelle. Ce qu'il n'a jamais su nous dire, c'est là-haut.",
    fin: "LA CLÉ DE PAUL SÈVE. IL CHANTAIT FAUX. JE ME SOUVIENS. LA PASSERELLE EST OUVERTE ? ALORS LIS CE QUE VARGA A LAISSÉ.",
    objectifs: [{ t: 'explorer', lieu: 'constance_coursive', texte: "Entrer dans l'épave de la Constance" }, { t: 'explorer', lieu: 'passerelle', texte: 'Monter jusqu\'à la passerelle' }],
    recompense: { xp: 1100, ferraille: 80, objet: { b: 'module', r: 2 } } },
  { id: 'la_constance_c', nom: 'La Constance', zone: 'cimetiere', principale: true, acte: 2, donneur: 'septieme', rendre: 'septieme', niveau: 12, requis: ['journaux_bord'], flag: ['choix', 'colonie'], aAccepter: ['cle_constance', '1'],
    intro: "LES FERTILES AVAIENT UNE CLÉ. ILS NE LA DONNERONT PAS À CELUI QUI A MONTRÉ LE CHEMIN. JE CONNAIS LE CODE DU SAS : IL N'A PAS CHANGÉ DEPUIS L'AN 0. ENTRE. MONTE À LA PASSERELLE.",
    fin: "LA PASSERELLE. ELLE Y PASSAIT SES NUITS. LIS CE QUE VARGA A LAISSÉ.",
    objectifs: [{ t: 'explorer', lieu: 'constance_coursive', texte: "Entrer dans l'épave de la Constance" }, { t: 'explorer', lieu: 'passerelle', texte: 'Monter jusqu\'à la passerelle' }],
    recompense: { xp: 1100, ferraille: 80, objet: { b: 'module', r: 2 } } },
  { id: 'la_mission', nom: 'La mission', zone: 'cimetiere', principale: true, acte: 2, donneur: 'septieme', rendre: 'agathe', niveau: 13, requisUn: ['la_constance', 'la_constance_c'],
    intro: "LE JOURNAL DU DR VARGA EST SUR LA PASSERELLE. ELLE M'A DIT : « S'ILS REVIENNENT, QU'ILS LE LISENT. » TU ES REVENU. LIS-LE. PUIS PORTE-LE À CELLE QUI SOIGNE, À PORT-ANCRE.",
    fin: "… Un programme de la Terre. ÉDEN n'est pas une maladie, c'est un outil, et la Constance devait tenir le manche. Ils se sont écrasés, et l'outil a continué seul. Ça explique la signature dans les spores. Ça n'explique pas pourquoi il nous attaque, nous. Varga dit : « Corrigez-le. » Il faudrait d'abord savoir à qui parler.",
    objectifs: [{ t: 'lire', id: 'journal_varga', texte: 'Lire le journal de Varga, sur la passerelle', ou: 'passerelle' }],
    recompense: { xp: 1500, ferraille: 120, objet: { b: 'arme', r: 2 }, flag: ['acte2', '1'] } },

  // Acte 3 — Le Semeur (niveaux 13 à 20)
  { id: 'voix_semeur', nom: 'La voix du Semeur', zone: 'plateaux', principale: true, acte: 3, donneur: 'agathe', rendre: 'agathe', niveau: 13, requis: ['la_mission'],
    intro: "Les soldats qui reviennent des ruches disent qu'une voix parle dans la chair, une voix d'homme. Si le Semeur a été un homme, il a laissé des journaux. Va écouter la Ruche du Basalte, puis cherche dans l'épave, dans les cabines de l'équipe scientifique.",
    fin: "Aurèle Danet. Agronome en chef de la Constance. C'est sa voix dans les ruches, mot pour mot : « reprendre le désherbage ». Il est mort il y a un siècle, et ÉDEN garde ce qui meurt. Il l'a refait. Le Semeur n'est pas une bête ni une machine : c'est un homme recréé, avec ses souvenirs en morceaux et les ordres d'ÉDEN.",
    objectifs: [{ t: 'explorer', lieu: 'ruche_plateau', texte: 'Écouter la Ruche du Basalte', lecture: 'voix_ruche' }, { t: 'lire', id: 'journal_danet', texte: 'Trouver le carnet de Danet, dans l\'épave', ou: 'cabine_danet' }],
    recompense: { xp: 1800, ferraille: 120, objet: { b: 'arme', r: 2 } } },
  { id: 'les_ruches', nom: 'Les ruches', zone: 'plateaux', principale: true, acte: 3, donneur: 'ysolde', rendre: 'ysolde', niveau: 14, requis: ['voix_semeur'],
    intro: "Un général, alors. Un général, ça se fatigue. Le Corps lance des offensives contre les ruches de la côte : chaque bête abattue près de leur bordure les fait reculer, pour toute la Colonie. Va au front, matricule.",
    fin: "Les ruches reculent. Pas de beaucoup, mais elles reculent. Toutes les lignées l'ont senti. La docteure Lin dit que la Grande Ruche, au-dessus du nid, est sa tête.",
    objectifs: [{ t: 'tuer', famille: 'eden', n: 30, texte: 'Affaiblir les ruches (abattre au front)', ou: 'ruche_plateau' }],
    recompense: { xp: 2000, ferraille: 150, objet: { b: 'armure', r: 2 } } },
  { id: 'le_modele', nom: 'Le modèle', zone: 'eden', principale: true, acte: 3, donneur: 'agathe', rendre: 'agathe', niveau: 15, requis: ['les_ruches'],
    intro: "La Grande Ruche, au-dessus de la Gueule du nid. S'il est quelque part, il est là. Je ne te demande pas de le tuer. Je te demande de l'écouter. Il faut savoir pourquoi.",
    fin: "« Pas conformes. » Un siècle de voyage sur la Patience nous a changés, assez pour qu'ÉDEN ne nous reconnaisse plus comme ceux qu'il attendait. Nous ne sommes pas ses ennemis. Nous sommes ses mauvaises herbes. … Il faut abattre la Couveuse, ou il n'y aura bientôt plus de champs du tout.",
    objectifs: [{ t: 'explorer', lieu: 'nid', texte: 'Approcher la Grande Ruche', lecture: 'semeur_modele' }],
    recompense: { xp: 2400, ferraille: 160, objet: { b: 'module', r: 3 } } },
  { id: 'le_nid', nom: 'Le nid', zone: 'eden', principale: true, acte: 3, donneur: 'agathe', rendre: 'ysolde', niveau: 16, requis: ['le_modele'],
    intro: "La Couveuse garde le cœur du nid. C'est d'elle que la Pépinière fait naître les soldats d'ÉDEN. Elle est cuirassée tant qu'aucun métal n'approche : emmène ton robot, ou des amis et les leurs.",
    fin: 'La Couveuse est tombée. ÉDEN recule, pour un temps. Mais le Semeur, lui, n\'a pas bougé. Il prépare sa riposte.',
    objectifs: [{ t: 'tuer', kinds: [E.COUVEUSE], n: 1, texte: 'Abattre la Couveuse', ou: 'nid' }],
    recompense: { xp: 2600, ferraille: 250, objet: { b: 'arme', r: 3 } } },
  { id: 'le_gosier', nom: 'Ce que la Gueule avale', zone: 'eden', donneur: 'joss', rendre: 'joss', niveau: 19, requis: ['le_nid'],
    intro: "Les robots qu'on perd au nord ne sont pas cassés : ÉDEN ne casse pas le métal. La Glaneuse les éteint, et la Gueule les avale tout entiers, au fond du Gosier, derrière la Gueule du nid. Il y a là-dedans des robots de lignées qu'on croyait éteintes. Va ouvrir cette gorge, et rapporte-moi ce qu'elle garde.",
    fin: "Des châssis entiers, couverts de sève, mais intacts. Celui-ci porte encore le matricule d'une famille de la Seconde Vague. Okonkwo ne les détruit pas, elle les met de côté. Pour qui ? Je n'aime pas cette question.",
    objectifs: [{ t: 'tuer', kinds: [E.GUEULE], n: 1, texte: 'Abattre la Gueule, au fond du Gosier', ou: 'gueule' }],
    recompense: { xp: 3800, ferraille: 320, objet: { b: 'module', r: 3 }, items: [{ b: 'piece', n: 6 }] } },
  { id: 'offensive_semeur', nom: "L'offensive du Semeur", zone: 'eden', principale: true, acte: 3, donneur: 'ysolde', rendre: 'ysolde', niveau: 17, requis: ['le_modele', 'le_nid'],
    intro: "Il riposte. Toutes les ruches poussent en même temps vers la côte. Si elles passent, on évacue les champs et Port-Ancre ne tiendra que ses murs. Toutes les lignées montent au front. Toi aussi.",
    fin: "La ligne a tenu. Mais tant que le Semeur respire, il repoussera. Il se tient derrière la Grande Ruche, à côté du Gosier : il faut aller le frapper chez lui, à dix.",
    objectifs: [{ t: 'tuer', famille: 'eden', n: 40, texte: "Repousser l'offensive (abattre au front)", ou: 'ruche_nord' }],
    recompense: { xp: 3500, ferraille: 300, objet: { b: 'armure', r: 3 } } },
  { id: 'la_racine', nom: 'La racine', zone: 'eden', principale: true, acte: 3, donneur: 'ysolde', rendre: 'ysolde', niveau: 18, requis: ['offensive_semeur'],
    intro: "Aurèle Danet. Le Semeur. L'agronome de la Constance, mort dans le crash il y a plus d'un siècle ; ÉDEN lui a refait un corps et lui a donné le front. Il replante tout ce qu'on lui prend. Le Corps monte une offensive à dix contre lui, derrière la Grande Ruche. S'il tombe, les ruches perdent leur racine. Trouve neuf soldats, ou prends ceux que le Corps te prête.",
    fin: 'Le Semeur est tombé.',
    objectifs: [{ t: 'tuer', kinds: [E.SEMEUR], n: 1, texte: 'Abattre le Semeur (raid à dix)', ou: 'semeur' }],
    recompense: { xp: 4200, ferraille: 400, objet: { b: 'arme', r: 3 }, flag: ['campagne1', '1'] },
    fins: {
      victoire_fertiles: "Les ruches reculent jusqu'à leurs nids. La côte est libérée. Les Fertiles de Haute-Sève sont venus au front avec nous, sans qu'on le leur demande. Maëlle Sève et la capitaine Brasier se sont serré la main ; aucune des deux n'a souri. C'est un début. On dit qu'au nord, une voix de femme a demandé qui étaient « ces colons qui ne tuent pas tout ».",
      victoire_colonie: "Les ruches reculent jusqu'à leurs nids. La côte est libérée. Le Corps a pris Haute-Sève dans la foulée : il n'en reste que des serres brûlées. Brasier dit que c'est une victoire complète. Au sud, dans les fougères, des Fertiles regardent passer nos patrouilles, et ils ne baissent plus les yeux.",
      evacuation: "Les ruches ont passé la ligne. On évacue les champs ; Port-Ancre tient ses murs, et rien d'autre. ÉDEN garde la côte. Le Corps prépare des barges : s'il faut reprendre ce monde, on le reprendra depuis la mer.",
    } },

  // ======================================================== à côté de la trame
  { id: 'la_seve', nom: 'La sève', zone: 'foret', donneur: 'maelle', rendre: 'maelle', niveau: 5, requis: ['les_fertiles'],
    intro: 'Les Fougerôdes rôdent autour du village et nos baumes s\'épuisent. Aide-nous, et je te dirai ce que la sève nous a appris sur le Semeur.',
    fin: "La sève se souvient de tout ce qu'ÉDEN a gardé. Elle nous parle d'un homme qui marche dans les champs comme s'il les avait plantés lui-même, et qui arrache ce qui ne doit pas pousser. Le Semeur n'est ni un dieu ni une bête. Il a été l'un de nous. Je n'en dirai pas plus aujourd'hui.",
    objectifs: [{ t: 'tuer', kinds: [E.FOUGERODE], n: 5, texte: 'Chasser les Fougerôdes', ou: 'foret' }, { t: 'ramasser', b: 'herbe', n: 5, texte: 'Cueillir de la fougère-sang', ou: 'foret' }],
    recompense: { xp: 420, ferraille: 30, items: [{ b: 'baume', n: 2 }] } },

  // ======================================================== les plaines
  { id: 'rodeurs_aldo', nom: 'Les bêtes d\'Aldo', zone: 'plaines', donneur: 'aldo', rendre: 'aldo', niveau: 1,
    intro: 'Les Rôdeurs viennent la nuit et me prennent une bête à chaque fois. Ils traînent au sud et à l\'est des champs.',
    fin: 'Mes Broutards vont dormir tranquilles. Tiens, c\'est tout ce que j\'ai.',
    objectifs: [{ t: 'tuer', kinds: [E.RODEUR], n: 6, texte: 'Chasser les Rôdeurs', ou: 'plaines' }],
    recompense: { xp: 90, ferraille: 25 } },
  { id: 'ragout', nom: 'Le ragoût d\'Odile', zone: 'plaines', donneur: 'odile', rendre: 'odile', niveau: 1,
    intro: 'Plus de viande, plus de ragoût. Les Broutards paissent autour de la ville. Ils ne te feront rien, eux.',
    fin: 'Voilà de quoi tenir la semaine. Et une part pour toi, la plus grosse.',
    objectifs: [{ t: 'ramasser', b: 'viande', n: 5, texte: 'Rapporter de la viande de Broutard', ou: 'plaines' }],
    recompense: { xp: 80, ferraille: 15, items: [{ b: 'trousse', n: 2 }] } },
  { id: 'lampes', nom: 'Les lampes du rempart', zone: 'plaines', donneur: 'morel', rendre: 'morel', niveau: 2,
    intro: 'Trois lampes sont mortes autour des portes. Sans lumière, on ne voit pas ce qui monte la nuit. Approche-toi et répare-les.',
    fin: 'La lumière revient. Les gardes te remercient. Moi aussi, mais je ne le dirai pas deux fois.',
    objectifs: [{ t: 'reparer', type: 'lampe', n: 3, texte: 'Réparer les lampes en panne' }],
    recompense: { xp: 110, ferraille: 30, objet: { b: 'module', r: 0 } } },

  // ======================================================== la forêt
  { id: 'fougere_sang', nom: 'Fougère-sang', zone: 'foret', donneur: 'agathe', rendre: 'agathe', niveau: 3,
    intro: 'La fougère-sang arrête les hémorragies. Elle pousse dans la forêt, en touffes rouges. Rapporte-m\'en.',
    fin: 'Parfait. Ça fera des trousses pour dix soldats.',
    objectifs: [{ t: 'ramasser', b: 'herbe', n: 6, texte: 'Cueillir de la fougère-sang', ou: 'foret' }],
    recompense: { xp: 180, ferraille: 25, items: [{ b: 'trousse', n: 3 }] } },
  { id: 'fougerodes', nom: 'Toiles', zone: 'foret', donneur: 'corinne', rendre: 'corinne', niveau: 5,
    intro: 'Les Fougerôdes tendent leurs toiles sur la route. Une patrouille y est restée. Nettoie la route et rapporte de leur soie, on en fera des cordes.',
    fin: 'La route est libre. Pour un temps.',
    objectifs: [{ t: 'tuer', kinds: [E.FOUGERODE], n: 8, texte: 'Tuer des Fougerôdes', ou: 'foret' }, { t: 'ramasser', b: 'peau', n: 4, texte: 'Rapporter de la soie de Fougerôde' }],
    recompense: { xp: 300, ferraille: 40, objet: { b: 'armure', r: 1 } } },
  { id: 'botaniste', nom: 'Le botaniste', zone: 'foret', donneur: 'ilan', rendre: 'ilan', niveau: 5,
    intro: 'Je dois voir la Clairière aux Spores de mes yeux. Escorte-moi : je marche derrière toi, et je ne sais pas me battre.',
    fin: 'Elles respirent toutes en même temps. Comme un seul poumon. Merci. Je n\'aurais pas fait dix pas seul.',
    objectifs: [{ t: 'escorte', npc: 'ilan', vers: 'clairiere', texte: 'Escorter Ilan jusqu\'à la Clairière aux Spores' }],
    recompense: { xp: 340, ferraille: 35, objet: { b: 'module', r: 1 } } },
  { id: 'eclaireurs', nom: 'La Source Noire', zone: 'foret', donneur: 'tamsin', rendre: 'tamsin', niveau: 6,
    intro: 'Une patrouille est partie vers la Source Noire, au nord, là où naît la Claire. Personne n\'est revenu. Va voir. Et reviens, toi.',
    fin: 'Des sacs vides et des bottes. Pas de corps. ÉDEN ne laisse jamais de corps.',
    objectifs: [{ t: 'explorer', lieu: 'source', texte: 'Trouver la Source Noire' }],
    recompense: { xp: 380, ferraille: 40 } },

  // ======================================================== le marais
  { id: 'sangsues', nom: 'Sangsues', zone: 'marais', donneur: 'roque', rendre: 'roque', niveau: 8,
    intro: 'Les sangsues sortent de l\'eau et boivent mes hommes. Tue-les avant qu\'elles grossissent.',
    fin: 'Mes hommes pourront dormir sans bottes. Enfin, avec.',
    objectifs: [{ t: 'tuer', kinds: [E.SANGSUE], n: 8, texte: 'Tuer des sangsues des marais', ou: 'marais' }],
    recompense: { xp: 480, ferraille: 50, objet: { b: 'arme', r: 1 } } },
  { id: 'balises', nom: 'Les balises noyées', zone: 'marais', donneur: 'roque', rendre: 'roque', niveau: 8,
    intro: 'Nos balises guident les convois dans le brouillard. Trois sont tombées en panne. Répare-les.',
    fin: 'Les convois passeront. Tu as l\'œil d\'un ingénieur, quelle que soit ta classe.',
    objectifs: [{ t: 'reparer', type: 'balise', n: 3, texte: 'Réparer les balises du marais' }],
    recompense: { xp: 520, ferraille: 60 } },
  { id: 'lumivesse', nom: 'Lumivesse', zone: 'marais', donneur: 'gaspard', rendre: 'gaspard', niveau: 9,
    intro: 'Les lumivesses poussent sur les berges. Elles éclairent ma cabane la nuit. Et elles se vendent bien, aussi.',
    fin: 'Ah, ça brille ! Tiens, pour ta peine.',
    objectifs: [{ t: 'ramasser', b: 'champignon', n: 6, texte: 'Cueillir des lumivesses', ou: 'marais' }],
    recompense: { xp: 520, ferraille: 70 } },
  { id: 'engloutisseur', nom: "L'Engloutisseur", zone: 'marais', donneur: 'gaspard', rendre: 'gaspard', niveau: 12,
    intro: "Au sud, dans la mare la plus profonde, dort une bête qui avale les barques. On l'appelle l'Engloutisseur. Il faudra plusieurs fusils. Et du courage.",
    fin: 'Tu l\'as eu ? Alors je peux pêcher à nouveau. Elle reviendra, ces bêtes-là reviennent toujours. Mais pas aujourd\'hui.',
    objectifs: [{ t: 'tuer', kinds: [E.ENGLOUTISSEUR], n: 1, texte: "Abattre l'Engloutisseur", ou: 'antre' }],
    recompense: { xp: 1400, ferraille: 160, objet: { b: 'armure', r: 3 } } },

  // ======================================================== le cimetière des machines
  { id: 'pieces_rivet', nom: 'Pièces détachées', zone: 'cimetiere', donneur: 'rivet', rendre: 'rivet', niveau: 12,
    intro: 'Le cimetière est plein de pièces, et les Rouillards gardent les meilleures. Ramène-m\'en, je te paie mieux que Basile.',
    fin: 'Belle récolte. Tu feras une bonne Ferrailleuse, un jour. Ou un bon Ferrailleur.',
    objectifs: [{ t: 'ramasser', b: 'piece', n: 8, texte: 'Rapporter des pièces de robot', ou: 'cimetiere' }],
    recompense: { xp: 700, ferraille: 110 } },
  { id: 'rouillards', nom: 'Les Rouillards', zone: 'cimetiere', donneur: 'rivet', rendre: 'rivet', niveau: 12,
    intro: 'Des drones de la Première Vague, devenus fous. Ils tirent sur tout ce qui bouge. Débarrasse-moi d\'eux.',
    fin: 'Du calme, enfin. Garde ce module, il vient d\'un des leurs.',
    objectifs: [{ t: 'tuer', kinds: [E.ROUILLARD], n: 8, texte: 'Détruire des Rouillards', ou: 'cimetiere' }],
    recompense: { xp: 760, ferraille: 80, objet: { b: 'module', r: 2 } } },

  // ======================================================== les terres d'ÉDEN
  { id: 'echantillon', nom: 'Le Jardin Parfait', zone: 'eden', donneur: 'ilan', rendre: 'ilan', niveau: 15, requis: ['botaniste'],
    intro: "Au sud-est, ÉDEN a fait pousser un jardin sans défaut. Rapporte-moi un échantillon. Ne respire pas trop fort.",
    fin: 'Parfaitement symétrique. Chaque feuille identique à l\'autre. C\'est ça qu\'on lui a demandé ? C\'est terrifiant.',
    objectifs: [{ t: 'explorer', lieu: 'jardin', texte: 'Entrer dans le Jardin Parfait' }, { t: 'ramasser', b: 'echantillon', n: 1, texte: "Prélever un échantillon d'ÉDEN", ou: 'jardin' }],
    recompense: { xp: 1300, ferraille: 120, objet: { b: 'module', r: 3 } } },
  { id: 'greffes', nom: 'Ceux qui ont dit oui', zone: 'eden', donneur: 'maelle', rendre: 'maelle', niveau: 16, requis: ['le_choix'], flag: ['choix', 'fertiles'],
    intro: "Tous les Fertiles ne sont pas restés à Haute-Sève. Certains ont tout laissé entrer, jusqu'à ne plus être eux. Ils errent dans les terres d'ÉDEN. Délivre-les.",
    fin: 'Merci. Nous savons où s\'arrêter. Eux ne savaient plus.',
    objectifs: [{ t: 'tuer', kinds: [E.GREFFE], n: 10, texte: 'Délivrer des Greffés', ou: 'eden' }],
    recompense: { xp: 1500, ferraille: 120, objet: { b: 'armure', r: 2 } } },
  ...QUESTS_C2,
]
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]))

export type QuestEtat = 'en_cours' | 'fini'
export interface QuestProg { id: string; etat: QuestEtat; prog: number[] }

/** Une quête peut-elle être proposée à ce joueur ? */
export function questAvailable(q: QuestDef, done: Set<string>, active: Set<string>, level: number, flags: Record<string, string>) {
  if (done.has(q.id) || active.has(q.id)) return false
  if (q.requis && !q.requis.every((r) => done.has(r))) return false
  if (q.requisUn && !q.requisUn.some((r) => done.has(r))) return false
  if (q.flag && flags[q.flag[0]] !== q.flag[1]) return false
  return level >= q.niveau - 2
}

/** Les quêtes de la trame, dans l'ordre de la campagne (les deux voies de « La Constance » se suivent). */
export const TRAME = QUESTS.filter((q) => q.principale).map((q) => q.id)

export function objectiveTarget(o: Objectif) { return o.t === 'tuer' || o.t === 'ramasser' || o.t === 'reparer' ? o.n : 1 }
export function questComplete(q: QuestDef, prog: number[]) { return q.objectifs.every((o, i) => (prog[i] ?? 0) >= objectiveTarget(o)) }

/** Le marqueur au-dessus d'un PNJ : « ! » jaune = une quête à prendre ; « ? » gris = une quête prise dont les
 *  objectifs ne sont pas finis ; « ? » jaune = une quête à rendre. À rendre passe avant tout, puis à prendre. */
export type QuestMark = 'dispo' | 'encours' | 'rendre'
export function questMarkFor(npc: string, actives: { id: string; prog: number[] }[], faites: string[], level: number, flags: Record<string, string>): QuestMark | null {
  const done = new Set(faites), active = new Set(actives.map((a) => a.id))
  for (const a of actives) { const q = QUEST_BY_ID[a.id]; if (q?.rendre === npc && questComplete(q, a.prog)) return 'rendre' }
  for (const q of QUESTS) if (q.donneur === npc && questAvailable(q, done, active, level, flags)) return 'dispo'
  for (const a of actives) { const q = QUEST_BY_ID[a.id]; if (q?.rendre === npc) return 'encours' }
  return null
}
/** Couleur et signe d'un marqueur, partout (au-dessus des têtes, minicarte, carte). */
export const MARK_STYLE: Record<QuestMark, { g: '!' | '?'; c: string }> = {
  dispo: { g: '!', c: '#ffd23a' }, encours: { g: '?', c: '#9aa3ad' }, rendre: { g: '?', c: '#ffd23a' },
}
