// Les bâtiments posés à la main. Ceux des premiers lieux gardent les coordonnées de leur premier dessin :
// le générateur les décale avec leur lieu (voir `decale` dans les régions). Ceux des lieux ajoutés avec le
// continent sont en coordonnées du continent.
import { D } from './tiles.ts'
import type { Building } from './map.ts'

/** Les bâtiments : coordonnées en tuiles. La façade (sud) porte les fenêtres ; la porte est une ouverture du mur. */
export type BDef = Omit<Building, 'fenetres'> & { meubles: [number, number, number][]; fen?: number[] }
export const BATIMENTS: BDef[] = [
  // Port-Ancre, rangée nord (portes au sud)
  { id: 'caserne', nom: 'Caserne du Corps des Matricules', lieu: 'port', x: 12, y: 78, w: 14, h: 9, porte: { x: 18, y: 86 }, toit: 'tole', cheminee: { x: 23, y: 79 },
    meubles: [[13, 79, D.M_LIT], [15, 79, D.M_LIT], [17, 79, D.M_LIT], [19, 79, D.M_LIT], [21, 79, D.M_ARMOIRE], [24, 81, D.M_ARMOIRE], [14, 83, D.M_TABLE], [15, 83, D.M_TABLE], [22, 84, D.M_COMPTOIR], [23, 84, D.M_COMPTOIR], [13, 85, D.M_CAISSES]], fen: [14, 16, 21, 23] },
  { id: 'infirmerie', nom: 'Infirmerie', lieu: 'port', x: 28, y: 79, w: 9, h: 7, porte: { x: 32, y: 85 }, toit: 'tuile',
    meubles: [[29, 80, D.M_LIT], [31, 80, D.M_LIT], [33, 80, D.M_LIT], [35, 81, D.M_ETAGERE], [29, 83, D.M_COMPTOIR], [30, 83, D.M_COMPTOIR]], fen: [30, 34] },
  { id: 'maisonA', nom: 'Maison des Ferrand', lieu: 'port', x: 43, y: 79, w: 6, h: 6, porte: { x: 45, y: 84 }, toit: 'tuile', cheminee: { x: 47, y: 79 },
    meubles: [[44, 80, D.M_LIT], [47, 80, D.M_ARMOIRE], [44, 82, D.M_TABLE], [47, 82, D.M_FOUR]], fen: [47] },
  { id: 'atelier', nom: 'Atelier du robot', lieu: 'port', x: 50, y: 78, w: 14, h: 9, porte: { x: 56, y: 86 }, toit: 'tole', cheminee: { x: 61, y: 79 },
    meubles: [[51, 79, D.M_ETABLI], [53, 79, D.M_ETABLI], [55, 79, D.M_ENCLUME], [59, 79, D.M_ETAGERE], [62, 80, D.M_TONNEAU], [62, 82, D.M_TONNEAU], [51, 83, D.M_CAISSES], [52, 83, D.M_CAISSES], [60, 84, D.M_ETABLI]], fen: [52, 54, 59, 61] },
  // rangée du milieu
  { id: 'maisonB', nom: 'Maison des Aubert', lieu: 'port', x: 12, y: 89, w: 6, h: 6, porte: { x: 14, y: 94 }, toit: 'tuile', cheminee: { x: 16, y: 89 },
    meubles: [[13, 90, D.M_LIT], [16, 90, D.M_ARMOIRE], [13, 92, D.M_TABLE], [16, 92, D.M_FOUR]], fen: [16] },
  { id: 'maisonC', nom: 'Maison des Lenoir', lieu: 'port', x: 20, y: 89, w: 6, h: 6, porte: { x: 22, y: 94 }, toit: 'chaume', cheminee: { x: 24, y: 89 },
    meubles: [[21, 90, D.M_LIT], [24, 90, D.M_LIT], [21, 92, D.M_TABLE], [24, 92, D.M_ETAGERE]], fen: [24] },
  { id: 'maisonD', nom: 'Maison des Quesnel', lieu: 'port', x: 52, y: 89, w: 6, h: 6, porte: { x: 54, y: 94 }, toit: 'tuile', cheminee: { x: 56, y: 89 },
    meubles: [[53, 90, D.M_LIT], [56, 90, D.M_ARMOIRE], [53, 92, D.M_TABLE], [56, 92, D.M_FOUR]], fen: [56] },
  { id: 'entrepot', nom: 'Entrepôt', lieu: 'port', x: 60, y: 89, w: 9, h: 7, porte: { x: 64, y: 95 }, toit: 'tole',
    meubles: [[61, 90, D.M_CAISSES], [62, 90, D.M_CAISSES], [63, 90, D.M_TONNEAU], [66, 90, D.M_CAISSES], [67, 90, D.M_CAISSES], [61, 92, D.M_TONNEAU], [67, 93, D.M_CAISSES]], fen: [62] },
  // au sud de l'avenue (portes au nord)
  { id: 'cantine', nom: 'Cantine', lieu: 'port', x: 12, y: 104, w: 12, h: 8, porte: { x: 17, y: 104 }, toit: 'tuile', cheminee: { x: 21, y: 105 },
    meubles: [[13, 106, D.M_TABLE], [14, 106, D.M_TABLE], [13, 107, D.M_BANC], [14, 107, D.M_BANC], [17, 107, D.M_TABLE], [18, 107, D.M_TABLE], [17, 108, D.M_BANC], [18, 108, D.M_BANC], [21, 106, D.M_FOUR], [22, 106, D.M_FOUR], [20, 109, D.M_COMPTOIR], [21, 109, D.M_COMPTOIR], [22, 109, D.M_TONNEAU]], fen: [14, 19, 21] },
  { id: 'comptoir', nom: 'Comptoir des Ferrailleurs', lieu: 'port', x: 52, y: 104, w: 12, h: 8, porte: { x: 57, y: 104 }, toit: 'tole',
    meubles: [[53, 106, D.M_ETAGERE], [54, 106, D.M_ETAGERE], [61, 106, D.M_ETAGERE], [62, 106, D.M_ETAGERE], [56, 108, D.M_COMPTOIR], [57, 108, D.M_COMPTOIR], [58, 108, D.M_COMPTOIR], [53, 110, D.M_CAISSES], [62, 110, D.M_TONNEAU]], fen: [54, 61] },
  { id: 'maisonE', nom: 'Maison des Garnier', lieu: 'port', x: 27, y: 112, w: 6, h: 6, porte: { x: 29, y: 112 }, toit: 'chaume', cheminee: { x: 31, y: 113 },
    meubles: [[28, 114, D.M_TABLE], [31, 114, D.M_FOUR], [28, 116, D.M_LIT], [31, 116, D.M_ARMOIRE]], fen: [28, 31] },
  { id: 'maisonF', nom: 'Maison des Odile', lieu: 'port', x: 44, y: 112, w: 6, h: 6, porte: { x: 46, y: 112 }, toit: 'tuile', cheminee: { x: 48, y: 113 },
    meubles: [[45, 114, D.M_TABLE], [48, 114, D.M_ETAGERE], [45, 116, D.M_LIT], [48, 116, D.M_LIT]], fen: [45, 48] },
  { id: 'maisonG', nom: 'Maison des Teodor', lieu: 'port', x: 12, y: 114, w: 6, h: 6, porte: { x: 14, y: 114 }, toit: 'tuile', cheminee: { x: 16, y: 115 },
    meubles: [[13, 116, D.M_TABLE], [16, 116, D.M_FOUR], [13, 118, D.M_LIT], [16, 118, D.M_ARMOIRE]], fen: [13, 16] },
  { id: 'maisonH', nom: 'Maison des Rivet', lieu: 'port', x: 60, y: 114, w: 6, h: 6, porte: { x: 62, y: 114 }, toit: 'chaume', cheminee: { x: 64, y: 115 },
    meubles: [[61, 116, D.M_TABLE], [64, 116, D.M_FOUR], [61, 118, D.M_LIT], [64, 118, D.M_LIT]], fen: [61, 64] },
  // la ferme, hors les murs
  { id: 'grange', nom: 'Grange des Aldo', lieu: 'ferme', x: 82, y: 80, w: 10, h: 7, porte: { x: 86, y: 86 }, toit: 'chaume',
    meubles: [[83, 81, D.M_TONNEAU], [84, 81, D.M_CAISSES], [89, 81, D.M_CAISSES], [90, 81, D.M_TONNEAU], [83, 84, D.M_BANC]], fen: [83, 89] },
  { id: 'ferme', nom: 'Ferme des Aldo', lieu: 'ferme', x: 94, y: 81, w: 7, h: 6, porte: { x: 96, y: 86 }, toit: 'tuile', cheminee: { x: 99, y: 81 },
    meubles: [[95, 82, D.M_LIT], [99, 82, D.M_FOUR], [95, 84, D.M_TABLE], [99, 84, D.M_ARMOIRE]], fen: [95, 99] },
  // Poste de la Fougère (forêt)
  { id: 'poste_fougere', nom: 'Poste de la Fougère', lieu: 'fougere', x: 150, y: 54, w: 9, h: 6, porte: { x: 154, y: 59 }, toit: 'tole', cheminee: { x: 157, y: 55 },
    meubles: [[151, 55, D.M_LIT], [153, 55, D.M_LIT], [157, 57, D.M_ARMOIRE], [151, 57, D.M_TABLE], [152, 57, D.M_TABLE]], fen: [151, 157] },
  { id: 'baraque_fougere', nom: 'Baraque des éclaireurs', lieu: 'fougere', x: 160, y: 61, w: 5, h: 5, porte: { x: 162, y: 61 }, toit: 'toile',
    meubles: [[161, 63, D.M_LIT], [163, 63, D.M_CAISSES]], fen: [] },
  // Haute-Sève (les Fertiles)
  { id: 'seve_maison1', nom: 'Maison-racine', lieu: 'hauteseve', x: 171, y: 142, w: 7, h: 6, porte: { x: 174, y: 147 }, toit: 'organique',
    meubles: [[172, 143, D.M_LIT], [176, 143, D.M_ETAGERE], [172, 145, D.M_TABLE]], fen: [172, 176] },
  { id: 'seve_maison2', nom: 'Maison-racine', lieu: 'hauteseve', x: 181, y: 142, w: 7, h: 6, porte: { x: 184, y: 147 }, toit: 'organique',
    meubles: [[182, 143, D.M_LIT], [186, 143, D.M_LIT], [186, 145, D.M_TABLE]], fen: [182, 186] },
  { id: 'seve_serre', nom: 'La Serre des Fertiles', lieu: 'hauteseve', x: 174, y: 151, w: 11, h: 6, porte: { x: 179, y: 151 }, toit: 'organique',
    meubles: [[175, 153, D.M_ETAGERE], [176, 153, D.M_ETAGERE], [182, 153, D.M_ETAGERE], [183, 153, D.M_ETAGERE], [178, 155, D.M_COMPTOIR], [179, 155, D.M_COMPTOIR]], fen: [176, 182] },
  // Poste du Marais
  { id: 'poste_marais', nom: 'Poste du Marais', lieu: 'postemarais', x: 225, y: 120, w: 9, h: 6, porte: { x: 229, y: 125 }, toit: 'tole', cheminee: { x: 232, y: 121 },
    meubles: [[226, 121, D.M_LIT], [228, 121, D.M_LIT], [232, 123, D.M_ARMOIRE], [226, 123, D.M_TABLE]], fen: [226, 232] },
  // La Casse (Ferrailleurs)
  { id: 'casse_hangar', nom: 'Hangar de la Casse', lieu: 'casse', x: 266, y: 33, w: 10, h: 7, porte: { x: 270, y: 39 }, toit: 'tole', cheminee: { x: 274, y: 34 },
    meubles: [[267, 34, D.M_ETABLI], [269, 34, D.M_ENCLUME], [273, 35, D.M_CAISSES], [267, 37, D.M_COMPTOIR], [268, 37, D.M_COMPTOIR], [274, 37, D.M_TONNEAU]], fen: [267, 274] },
  { id: 'casse_tente1', nom: 'Tente de Rivet', lieu: 'casse', x: 278, y: 35, w: 5, h: 4, porte: { x: 280, y: 38 }, toit: 'toile', meubles: [[279, 36, D.M_LIT]], fen: [] },
  { id: 'casse_tente2', nom: 'Tente des Ferrailleurs', lieu: 'casse', x: 266, y: 42, w: 5, h: 4, porte: { x: 268, y: 42 }, toit: 'toile', meubles: [[267, 44, D.M_LIT]], fen: [] },

  // ------------------------------------------------ lieux ajoutés avec le continent (coordonnées du continent)
  // Anse-Grise, le hameau des pêcheurs
  { id: 'anse_cabane1', nom: 'Cabane des Morvan', lieu: 'anse', x: 240, y: 336, w: 6, h: 5, porte: { x: 242, y: 340 }, toit: 'chaume', cheminee: { x: 244, y: 337 },
    meubles: [[241, 337, D.M_LIT], [244, 338, D.M_TONNEAU]], fen: [244] },
  { id: 'anse_cabane2', nom: 'Fumoir à poisson', lieu: 'anse', x: 248, y: 336, w: 7, h: 5, porte: { x: 251, y: 340 }, toit: 'chaume', cheminee: { x: 253, y: 337 },
    meubles: [[249, 337, D.M_ETAGERE], [250, 337, D.M_ETAGERE], [253, 338, D.M_FOUR]], fen: [249] },
  { id: 'anse_hangar', nom: 'Hangar à filets', lieu: 'anse', x: 256, y: 337, w: 6, h: 5, porte: { x: 258, y: 341 }, toit: 'tole',
    meubles: [[257, 338, D.M_CAISSES], [260, 338, D.M_TONNEAU]], fen: [] },
  // Relais du Col
  { id: 'relais_auberge', nom: 'Auberge du Relais', lieu: 'relais', x: 192, y: 209, w: 9, h: 6, porte: { x: 196, y: 214 }, toit: 'tuile', cheminee: { x: 199, y: 210 },
    meubles: [[193, 210, D.M_TABLE], [194, 210, D.M_BANC], [198, 210, D.M_COMPTOIR], [199, 210, D.M_TONNEAU], [193, 212, D.M_LIT]], fen: [193, 199] },
  { id: 'relais_ecurie', nom: 'Garage des robots', lieu: 'relais', x: 203, y: 209, w: 6, h: 6, porte: { x: 205, y: 214 }, toit: 'tole',
    meubles: [[204, 210, D.M_ETABLI], [207, 210, D.M_CAISSES]], fen: [207] },
  // La Mine
  { id: 'mine_baraque', nom: 'Baraque des mineurs', lieu: 'mine', x: 142, y: 138, w: 8, h: 6, porte: { x: 145, y: 143 }, toit: 'tole', cheminee: { x: 148, y: 139 },
    meubles: [[143, 139, D.M_LIT], [144, 139, D.M_LIT], [148, 141, D.M_ETABLI]], fen: [143, 148] },
  { id: 'mine_forge', nom: 'Forge de la Mine', lieu: 'mine', x: 152, y: 138, w: 6, h: 6, porte: { x: 154, y: 143 }, toit: 'tole', cheminee: { x: 156, y: 139 },
    meubles: [[153, 139, D.M_ENCLUME], [156, 140, D.M_FOUR]], fen: [] },
  // Bastion de la Colonie
  { id: 'bastion_caserne', nom: 'Caserne du Bastion', lieu: 'bastion', x: 259, y: 155, w: 10, h: 6, porte: { x: 263, y: 160 }, toit: 'tole', cheminee: { x: 267, y: 156 },
    meubles: [[260, 156, D.M_LIT], [261, 156, D.M_LIT], [262, 156, D.M_LIT], [267, 157, D.M_ARMOIRE], [260, 158, D.M_TABLE]], fen: [260, 267] },
  { id: 'bastion_poudriere', nom: 'Poudrière', lieu: 'bastion', x: 270, y: 155, w: 5, h: 5, porte: { x: 272, y: 159 }, toit: 'tole',
    meubles: [[271, 156, D.M_CAISSES], [273, 156, D.M_CAISSES]], fen: [] },
  // Camp de l'Épave
  { id: 'camp_tente1', nom: 'Tente des récupérateurs', lieu: 'campepave', x: 88, y: 102, w: 6, h: 4, porte: { x: 90, y: 105 }, toit: 'toile', meubles: [[89, 103, D.M_LIT], [92, 103, D.M_CAISSES]], fen: [] },
  { id: 'camp_atelier', nom: 'Atelier de fortune', lieu: 'campepave', x: 97, y: 102, w: 7, h: 5, porte: { x: 100, y: 106 }, toit: 'tole', meubles: [[98, 103, D.M_ETABLI], [102, 103, D.M_CAISSES]], fen: [98] },
  // ------------------------------------------------------------ campagne 2 : les Hauts de Glane
  // Relâche, le port des Ferrailleurs et des exilés (rangée nord : portes au sud ; rangée sud : portes au nord)
  { id: 'rel_capitainerie', nom: 'Capitainerie de Relâche', lieu: 'relache', x: 461, y: 264, w: 12, h: 8, porte: { x: 466, y: 271 }, toit: 'tuile', cheminee: { x: 470, y: 265 },
    meubles: [[462, 265, D.M_ETAGERE], [463, 265, D.M_ETAGERE], [465, 267, D.M_TABLE], [466, 267, D.M_TABLE], [467, 267, D.M_TABLE], [465, 268, D.M_BANC], [466, 268, D.M_BANC], [471, 266, D.M_ARMOIRE], [462, 269, D.M_TABLEAU]], fen: [463, 469] },
  { id: 'rel_forge', nom: 'Forge des Hauts', lieu: 'relache', x: 480, y: 264, w: 10, h: 8, porte: { x: 484, y: 271 }, toit: 'tole', cheminee: { x: 487, y: 265 },
    meubles: [[481, 265, D.M_ENCLUME], [483, 265, D.M_ETABLI], [485, 265, D.M_ETABLI], [488, 266, D.M_TONNEAU], [481, 269, D.M_CAISSES], [488, 269, D.M_ETAGERE]], fen: [482, 487] },
  { id: 'rel_escale', nom: "L'Escale", lieu: 'relache', x: 461, y: 280, w: 11, h: 8, porte: { x: 466, y: 280 }, toit: 'chaume', cheminee: { x: 469, y: 281 },
    meubles: [[462, 282, D.M_TABLE], [463, 282, D.M_TABLE], [462, 283, D.M_BANC], [463, 283, D.M_BANC], [466, 284, D.M_TABLE], [467, 284, D.M_TABLE], [466, 285, D.M_BANC], [467, 285, D.M_BANC], [470, 282, D.M_FOUR], [469, 286, D.M_COMPTOIR], [470, 286, D.M_COMPTOIR]], fen: [463, 469] },
  { id: 'rel_tisserand', nom: 'Atelier du Tisserand', lieu: 'relache', x: 480, y: 280, w: 9, h: 7, porte: { x: 484, y: 280 }, toit: 'tole',
    meubles: [[481, 282, D.M_ETABLI], [482, 282, D.M_ETABLI], [486, 282, D.M_ETAGERE], [481, 285, D.M_CAISSES], [487, 285, D.M_TONNEAU]], fen: [482, 486] },
  // le Gué de Glane, premier poste du Corps dans les Hauts
  { id: 'gue_poste', nom: 'Poste du Gué', lieu: 'gue_glane', x: 441, y: 92, w: 8, h: 6, porte: { x: 444, y: 97 }, toit: 'tole', cheminee: { x: 447, y: 92 },
    meubles: [[442, 93, D.M_LIT], [444, 93, D.M_LIT], [447, 94, D.M_ARMOIRE]], fen: [446] },
  { id: 'gue_cabane', nom: 'Cabane du passeur', lieu: 'gue_glane', x: 451, y: 92, w: 6, h: 5, porte: { x: 453, y: 96 }, toit: 'chaume', meubles: [[452, 93, D.M_TABLE], [455, 93, D.M_FOUR]], fen: [455] },
  // le Sillon, le camp des Ferrailleurs au bord des Champs de Fer
  { id: 'sillon_tente', nom: 'Tente des glaneurs de fer', lieu: 'sillon', x: 522, y: 198, w: 6, h: 5, porte: { x: 524, y: 202 }, toit: 'toile', meubles: [[523, 199, D.M_LIT], [526, 199, D.M_CAISSES]], fen: [] },
  { id: 'sillon_atelier', nom: 'Atelier du Sillon', lieu: 'sillon', x: 528, y: 198, w: 6, h: 5, porte: { x: 530, y: 202 }, toit: 'tole', meubles: [[529, 199, D.M_ETABLI], [532, 199, D.M_ETAGERE]], fen: [529] },
]

