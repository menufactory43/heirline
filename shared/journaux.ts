// Ce qui se lit dans Ossara : les journaux de la Constance, les cœurs de données, les stèles et les plaques.
// Le texte suit la bible (docs/histoire.md) ; docs/journaux.md en est la copie lisible (npm run journaux).
// Une lecture débloquée reste dans le journal de la lignée (drapeau `lu_<id>`), et se relit quand on veut.
import type { CarteId } from './monde.ts'

export type LectureType = 'journal' | 'coeur' | 'stele' | 'plaque' | 'notes' | 'voix' | 'message' | 'objet'
export interface Lecture { id: string; titre: string; type: LectureType; /** qui l'a écrit, et quand (calendrier de la Constance ou de Port-Ancre) */ source?: string; texte: string }

export const LECTURES: Lecture[] = [
  // ------------------------------------------------------------------ campagne 2 : les Hauts de Glane
  { id: 'maquette_patience', titre: 'Patience II', type: 'objet', source: 'Capitainerie de Relâche',
    texte: `Une maquette de bateau, en bois flotté et en fil de cuivre, posée sur l'étagère. Trois mâts, une coque ventrue, un nom peint à la main sur la poupe : PATIENCE II.

Dessous, une étiquette au crayon : « La première est partie de la Terre et n'est jamais arrivée. Celle-là, elle arrivera. — H. V. »` },
  { id: 'robot_assis', titre: 'Le robot assis', type: 'objet', source: 'Champs de Fer, à l\'ouest des sillons',
    texte: `Un robot de la Constance, assis dans l'herbe rouillée, les mains sur les genoux. Pas de câbles de sève dans ses jointures : personne ne l'a tissé.

À côté de lui, une cassette. Sur l'étiquette, une loutre. Quelqu'un a gravé sur son épaule, très proprement : « Pas celui-là. — M. »` },
  { id: 'liste_tisserand', titre: 'Ce dont le Tisserand se souvient', type: 'message', source: 'Le Tisserand, gravé sur une plaque de tôle',
    texte: `rangée 1 numéro 4 lignée aubert éteint
rangée 1 numéro 5 lignée lenoir éteint
rangée 2 numéro 12 lignée marest éteint
rangée 7 numéro 3 lignée ferrand éteint
rangée 7 numéro 4 lignée ferrand éteint
rangée 40 numéro 1 moi pas fini

elle les compte tous elle dit qu il faut que quelqu un le sache` },
  { id: 'journal_park', titre: 'Le carnet de la serre', type: 'journal', source: 'Sun-Hee Park, botaniste de la Constance (écriture récente)',
    texte: `Ils tirent trop. Toujours la même chose : des balles, des balles, des balles. Alors j'ai fait pousser de l'écorce.

Puis ils ont essayé le feu. J'ai fait de la sève qui ne brûle pas.

C'est ça, une pépinière : on regarde ce qui meurt, et on replante ce qui résiste. Mes bourgeons regardent pour moi. Je ne leur en veux pas, à ces colons. Ils m'apprennent.

Mira dit que bientôt, la Terre saura. Je n'ai pas le cœur de lui dire que la Terre ne répond plus depuis cent ans.` },
  { id: 'mat_okonkwo', titre: 'Cœur de données — le mât de relais', type: 'voix', source: 'Constance, enregistrement de descente, jour 3',
    texte: `(Une voix de femme, calme, couverte par les alarmes.)

« Ici Okonkwo, atelier robotique. On perd la tuyère bâbord. Je répète : on perd… »

(Une autre voix, plus âgée. Varga.)

« Mira. Écoutez-moi. Si la Terre se tait, rappelez-la. Quoi qu'il arrive. Il faut qu'elle sache qu'on est là. »

« Rappelez-la vous-même, docteure. »

« Je compte sur vous. »

(Un choc. Le silence. Puis, très bas, la voix de Mira : « D'accord. ») ` },
  { id: 'okonkwo_metier', titre: 'Le Métier', type: 'notes', source: 'Relevés de Hélène Vasseur, au pied du Métier',
    texte: `Des arches de métal, sur des centaines de mètres. Dans chaque arche, des robots pendus par des câbles de sève, alignés, numérotés. Les câbles montent jusqu'aux pylônes, et des pylônes vers le ciel.

Ce n'est pas une armée. C'est une antenne. Et ce qu'elle émet, c'est une liste : chaque robot, son numéro, sa lignée, et les morts de chaque lignée. Un recensement de toute la Seconde Vague.

Elle veut que la Terre sache qui nous sommes. Elle croit que la Terre écoute.` },
  { id: 'registre_page', titre: 'Une page du Registre', type: 'notes', source: 'Tobias Wren, médecin de bord (écriture récente)',
    texte: `Je les ai tous. Chaque soldat tombé au-delà du front. Je n'oublie aucun nom : je les couds sur ceux qui peuvent encore marcher.

On m'a dit, sur la Constance, qu'un médecin tient le registre des morts pour que personne ne meure deux fois. J'applique la consigne.

Mira veut la liste pour la Terre. Je la lui donne. Mais je garde une copie. On ne sait jamais qui viendra la réclamer.` },
  { id: 'varga_repond', titre: 'Une voix qui répond', type: 'voix', source: 'Relâche, capitainerie, la radio d\'Hélène',
    texte: `(Un grésillement long. Puis une voix âgée, nette, comme si elle parlait d'une pièce voisine.)

« Ici Varga. Qui appelle ? »

(Un silence.)

« Je répète : ici Ilse Varga, Constance. J'ai reçu votre émission. Qui appelle ? »

Hélène a coupé la radio. Puis elle l'a rallumée. Puis elle a dit qu'il faudrait des semaines pour savoir quoi répondre.` },

  // ------------------------------------------------------------------ acte 1
  { id: 'notes_lin', titre: 'Notes de la docteure Lin', type: 'notes', source: 'Infirmerie de Port-Ancre, carnet 14',
    texte: `Spores prélevées par le matricule, lot 4. Tièdes à la réception. Elles ne meurent pas sous la lampe.

J'ai séquencé le noyau d'une spore, puis d'une deuxième, puis de dix. La même séquence revient, à la base près. La nature ne fait pas ça. La nature se trompe.

Au milieu de la séquence, il y a des blocs qui ne servent à rien pour une plante : des répétitions, des marqueurs, des balises de début et de fin. On en mettait dans les semences de laboratoire, sur la Terre, pour savoir qui les avait faites. Une signature.

Ce qui pousse dans nos champs a été écrit. Par des humains.

Je n'ai pas encore osé l'écrire au rapport.` },

  // ------------------------------------------------------------------ acte 2
  { id: 'stele_tertre', titre: 'Les stèles du Tertre', type: 'stele', source: 'Tertre des Colons',
    texte: `Des pierres plates, gravées au burin. Les dates suivent un calendrier que personne n'utilise à Port-Ancre : « an 3 de l'Arrivée », « an 9 de l'Arrivée ».

AUBERT, Joël — ingénieur de propulsion. Il a ramené la Constance au sol.
LENOIR, Sarah — 7 ans.
MAREST, Paul et Anne — ensemble.
KIMURA, Ren — botaniste. « Il a planté le premier pommier. »

Au pied d'une stèle, un petit robot en fer-blanc, rongé de rouille. Quelqu'un a gravé dessous : « À la colonie de Cantor ».

Ces tombes sont plus vieilles que Port-Ancre. D'autres étaient ici avant nous.` },
  { id: 'coeur_1', titre: 'Cœur de données 1 — journal de bord', type: 'coeur', source: 'Constance, journal du commandant, an 0 de l\'Arrivée',
    texte: `Jour 1. Orbite stable. Ossara est verte d'un pôle à l'autre. ÉDEN a fait plus que ce que la Terre espérait : de l'air respirable, de l'eau douce, des sols profonds. Le Dr Varga a pleuré sur la passerelle. Nous aussi.

Jour 3. Défaut sur la tuyère bâbord pendant la descente. Je n'ai pas pu tenir l'assiette.

Jour 4. Nous sommes au sol, au nord de la côte. Trois cent onze morts. La moitié de l'équipe scientifique. L'ingénieur Aubert a gardé le vaisseau entier jusqu'au bout ; il n'a pas survécu à l'impact.

Jour 9. Les drones de travail fonctionnent. Cantor tient le registre. Il a demandé s'il devait chanter les noms. J'ai dit oui.` },
  { id: 'coeur_2', titre: 'Cœur de données 2 — registre de la colonie', type: 'coeur', source: 'Cantor, registre, an 5 à an 87 de l\'Arrivée',
    texte: `NAISSANCES, AN 5 : 14.
DÉCÈS, AN 22 : VARGA, ILSE. CONCEPTRICE. ELLE A DEMANDÉ QU'ON L'ENTERRE SANS CERCUEIL, « POUR QU'ÉDEN LA GARDE ». ÉDEN L'A GARDÉE.
NAISSANCES, AN 40 : 3.
AN 57 : LA TERRE NE RÉPOND PLUS.
AN 63 : LES DERNIERS ONT GREFFÉ LA SÈVE POUR VIVRE. ILS N'ONT PLUS BESOIN DE MOI POUR SOIGNER.
AN 70 : LES DRONES NE RÉPONDENT PLUS AUX ORDRES. ILS TIRENT. JE LES APPELLE LES ROUILLÉS. JE ME TROMPE DE MOT.
AN 78 : PERSONNE.
AN 87 : UN VAISSEAU DANS LE CIEL. PATIENCE. ILS NE M'ONT PAS ENTENDU.
JE CONTINUE DE CHANTER.` },
  { id: 'coeur_3', titre: 'Cœur de données 3 — note de l\'équipe scientifique', type: 'coeur', source: 'Constance, laboratoire, an 2 de l\'Arrivée',
    texte: `Réunion de l'équipe. Présents : Varga, Danet, Park, Wren, Okonkwo.

Danet propose de laisser ÉDEN travailler seul sur les terres du nord : « Il sait mieux que nous. » Varga refuse : le programme doit rester supervisé, c'est le protocole de la Terre.

Park rappelle que le modèle de référence d'ÉDEN date du départ. Le génome humain « de l'époque ». Elle demande ce qui se passera si les colons changent. Personne ne répond.

Okonkwo signale que ÉDEN n'a jamais touché une seule pièce du vaisseau, même après l'impact. Le code l'interdit : ne jamais endommager le matériel des colons. Elle dit que c'est la phrase la plus rassurante qu'elle ait lue depuis le départ.` },
  { id: 'plaque_ligne', titre: 'Une plaque, dans la coursive', type: 'plaque', source: 'La Constance, grande coursive',
    texte: `Une plaque de laiton vissée à hauteur d'yeux, polie par des mains. Pas de nom de vaisseau, pas de blason.

« En mémoire de ceux qui ont tenu la ligne. 2007–2009. »

Personne ne sait de quelle ligne elle parle. Elle était déjà vieille quand la Constance a quitté la Terre.` },
  { id: 'journal_varga', titre: 'Journal du Dr Ilse Varga', type: 'journal', source: 'Passerelle de la Constance, an 21 de l\'Arrivée',
    texte: `J'écris sur la passerelle, parce que c'est ici que j'ai vu Ossara verte pour la première fois.

Je dois dire la vérité à ceux qui viendront. ÉDEN n'est pas né ici. ÉDEN est un programme de la Terre : une biomasse de terraformation, lancée soixante-douze ans avant le départ de la Constance, chargée de rendre ce monde vivable pour des humains. Je l'ai conçu. La Constance devait le superviser, le corriger, lui dire quand s'arrêter.

Nous nous sommes écrasés, et nous n'étions plus assez pour le guider. Il continue seul. Il fait exactement ce que je lui ai demandé.

Il garde ce qui meurt. Il me gardera. Je ne sais pas ce qu'il fera de nous.

S'il vous plaît : ne le haïssez pas. Corrigez-le.` },
  { id: 'cassette', titre: 'Une cassette « Rembobine »', type: 'objet', source: 'Une cabine d\'enfant, la Constance',
    texte: `Une vieille cassette, une étiquette écrite à la main : « Rembobine ». Une loutre dessinée au feutre, qui tient un crayon.

Quelqu'un l'a écoutée jusqu'à user la bande.` },
  { id: 'tamagoyle', titre: 'Un Tamagoyle cassé', type: 'objet', source: 'La salle de jeux, la Constance',
    texte: `Un petit œuf de plastique avec un écran éteint et trois boutons. Au dos, une gargouille gravée.

Il ne s'allume plus. Joss, à l'atelier, saurait peut-être.` },

  // ------------------------------------------------------------------ acte 3
  { id: 'voix_ruche', titre: 'La voix dans la ruche', type: 'voix', source: 'Une ruche d\'ÉDEN',
    texte: `La chair de la ruche vibre. Puis une voix d'homme, calme, qui ne s'adresse à personne :

« Parcelle sept : sol conforme. Parcelle huit : présence d'impuretés. Reprendre le désherbage à l'aube. »

« Je me souviens d'un pommier. Je ne sais plus qui l'a planté. »

La voix se tait. Les spores retombent comme de la neige.` },
  { id: 'journal_danet', titre: 'Journal d\'Aurèle Danet', type: 'journal', source: 'Cabine de l\'agronome en chef, la Constance',
    texte: `Aurèle Danet, agronome en chef. Carnet de champ.

Parcelle sept : les pommiers de Kimura prennent. Le sol d'ÉDEN est le meilleur que j'aie jamais touché. Varga dit qu'il faut le surveiller ; moi, je dis qu'il faut l'écouter.

Ce matin, j'ai désherbé à la main pendant deux heures. Il n'y a pas de travail plus honnête : on enlève ce qui ne devrait pas être là, et ce qui doit pousser pousse.

Si un jour je ne suis plus là, que quelqu'un continue les parcelles. Un jardin, ça ne s'arrête pas.

La voix est la même. Celle des ruches. C'est lui.` },
  { id: 'semeur_modele', titre: 'Le Semeur', type: 'voix', source: 'La Grande Ruche',
    texte: `Il est là, dans la chair de la ruche principale. Un homme, presque. Le visage d'Aurèle Danet, sans âge, les mains pleines de terre.

« Vous êtes venus de loin. Je le sais. ÉDEN le sait. Il vous a comparés au modèle, comme il compare chaque feuille. Un siècle de voyage vous a changés : votre sang, vos os, ce que vous respirez. Vous n'êtes pas conformes.

Je ne vous hais pas. On ne hait pas ce qu'on désherbe. On fait de la place pour ceux qui doivent venir.

Ils ne viendront pas ? Alors le jardin les attendra. Il est patient. Il est parfait. »

Il retourne à la terre, sans hâte. Derrière lui, la ruche respire.` },

  // ------------------------------------------------------------------ la salle secrète (après l'acte 2)
  { id: 'message_terre', titre: 'Le dernier message de la Terre', type: 'message', source: 'Reçu par la Constance, an 57 de l\'Arrivée',
    texte: `Une console encore sous tension, dans une salle que personne n'a ouverte depuis des décennies. Un seul message, en attente de lecture depuis soixante et un ans.

ORIGINE : TERRE, CONTRÔLE DES MISSIONS.
DESTINATAIRE : CONSTANCE, ET TOUTE VAGUE À VENIR.

« Ne les attendez plus. Faites ce que vous pouvez avec ce que vous êtes. »

Rien d'autre. Pas de signature. Après celui-ci, plus aucun message.` },

  // ------------------------------------------------------------------ les clins d'œil
  { id: 'tombe_wipe', titre: 'Une tombe à l\'écart', type: 'stele', source: 'Tertre des Colons',
    texte: `Une pierre plus grande que les autres, pour plusieurs. Cinq noms effacés, et une ligne encore lisible :

« Ici repose une équipe de raid. Elle a wipe. »

Quelqu'un a posé un caillou dessus. Puis un autre. Puis beaucoup.` },
]
export const LECTURE_BY_ID: Record<string, Lecture> = Object.fromEntries(LECTURES.map((l) => [l.id, l]))
/** Les cœurs de données, dans l'ordre où on les lit (le premier ramassé donne le premier). */
export const COEURS = ['coeur_1', 'coeur_2', 'coeur_3']

/** Un endroit où lire (ou agir) : on s'en approche, le bouton d'action le propose. Tuiles. */
export interface Lieu2Lire {
  id: string; carte: CarteId; x: number; y: number; label: string
  /** ce qu'on y lit (sinon, un texte calculé par le serveur : la stèle des saisons, la porte scellée) */
  lecture?: string
  /** un objet ramassé en lisant (une fois par lignée) */
  objet?: string
}
export const ENDROITS: Lieu2Lire[] = [
  { id: 'tertre_steles', carte: 'ossara', x: 150, y: 256, label: 'Lire les stèles', lecture: 'stele_tertre' },
  { id: 'tertre_wipe', carte: 'ossara', x: 156, y: 256, label: 'Une tombe à l\'écart', lecture: 'tombe_wipe' },
  { id: 'stele_saisons', carte: 'ossara', x: 201, y: 300, label: 'La stèle des saisons' },
  { id: 'cabine_cassette', carte: 'constance', x: 19, y: 28, label: 'Une cassette', lecture: 'cassette', objet: 'cassette' },
  { id: 'jeux_tamagoyle', carte: 'constance', x: 33, y: 29, label: 'Un jouet cassé', lecture: 'tamagoyle', objet: 'tamagoyle_casse' },
  { id: 'coursive_plaque', carte: 'constance', x: 40, y: 38, label: 'Une plaque', lecture: 'plaque_ligne' },
  { id: 'cabine_danet', carte: 'constance', x: 46, y: 28, label: 'Le carnet de Danet', lecture: 'journal_danet' },
  { id: 'passerelle_varga', carte: 'constance', x: 78, y: 21, label: 'Le journal de Varga', lecture: 'journal_varga' },
  { id: 'porte_scellee', carte: 'constance', x: 86, y: 21, label: 'La porte scellée' },
  { id: 'salle_message', carte: 'constance', x: 91, y: 19, label: 'La console', lecture: 'message_terre' },
  { id: 'salle_sortie', carte: 'constance', x: 89, y: 23, label: 'Revenir sur la passerelle' },
  // campagne 2 : les Hauts de Glane
  { id: 'rel_maquette', carte: 'ossara', x: 468, y: 269, label: 'Une maquette de bateau', lecture: 'maquette_patience' },
  { id: 'robot_assis', carte: 'ossara', x: 505, y: 177, label: 'Un robot assis', lecture: 'robot_assis' },
  { id: 'serres_carnet', carte: 'ossara', x: 596, y: 250, label: 'Un carnet entre les rangées', lecture: 'journal_park' },
  { id: 'mat_grave_lire', carte: 'ossara', x: 520, y: 47, label: 'Le socle du mât', lecture: 'mat_okonkwo' },
]
export const ENDROIT_BY_ID: Record<string, Lieu2Lire> = Object.fromEntries(ENDROITS.map((e) => [e.id, e]))
/** Distance (px) à laquelle on peut lire. */
export const LIRE_R = 34

/** La place de Port-Ancre (tuiles) : un robot laissé là sans bouger deux minutes se met à danser. */
export const PLACE = { x: 203, y: 302, r: 9, attente: 120 }

/** La saison d'une date : la stèle de la place garde le premier mort de chacune. */
export function saisonDe(t: number) {
  const d = new Date(t)
  const m = d.getUTCMonth()
  const s = m === 11 || m < 2 ? 'hiver' : m < 5 ? 'printemps' : m < 8 ? 'été' : 'automne'
  const an = m === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
  return { cle: `${an}-${s}`, nom: `${s[0].toUpperCase()}${s.slice(1)} ${an}`, saison: s === 'été' ? 'ete' : s, an }
}
