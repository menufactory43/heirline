// Les habitants d'Ossara : qui ils sont, à quoi ils ressemblent, où ils vont selon l'heure, ce qu'ils disent.
// Le serveur les fait vivre ; le client lit les mêmes fiches pour les noms, les visages et les marqueurs de quête.
// Les habitants des premiers lieux gardent les coordonnées de leur premier dessin : on les décale avec leur lieu
// (voir `decale` dans shared/regions). Ceux des lieux ajoutés avec le continent sont en coordonnées du continent.
import { decaleLieu } from './regions/index.ts'

export type Routine = 'fixe' | 'habitant' | 'garde' | 'passant' | 'enfant'
export type Boutique = 'armurerie' | 'soins' | 'ferraille' | 'casse' | 'fertile' | 'cantine'
export interface Look { peau: string; cheveux: string; haut: string; haut2: string; bas: string; chapeau?: 'casque' | 'calot' | 'capuche' | 'foulard' | 'bob'; petit?: boolean; robot?: boolean; greffe?: boolean }

export interface NpcDef {
  id: string; nom: string; titre?: string; look: Look; routine: Routine
  /** tuiles */
  poste: [number, number]; maison?: [number, number]; soir?: [number, number]; ronde?: [number, number][]
  boutique?: Boutique
  salut: string[]
  bulles: string[]
  /** ne quitte pas son lieu (pas de marche en ville) */
  lieu: string
  /** un garde tire sur ÉDEN */
  arme?: boolean
}

const P = { clair: '#e8c8a8', mat: '#c89870', brun: '#8a5a3a', fonce: '#5a3a28', pale: '#f0d8c0' }
const L = {
  garde: (p: string): Look => ({ peau: p, cheveux: '#2a2a2a', haut: '#4a5d72', haut2: '#7890a6', bas: '#2d3a4a', chapeau: 'casque' }),
  colon: (p: string, c: string, h: string, b = '#3a3a40'): Look => ({ peau: p, cheveux: c, haut: h, haut2: shade(h), bas: b }),
}
function shade(h: string) { const n = parseInt(h.slice(1), 16); const r = Math.min(255, ((n >> 16) & 255) + 40), g = Math.min(255, ((n >> 8) & 255) + 40), b = Math.min(255, (n & 255) + 40); return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0') }

export const NPCS: NpcDef[] = [
  // ------------------------------------------------------------ Port-Ancre
  { id: 'ysolde', nom: 'Ysolde Brasier', titre: 'Capitaine du Corps', lieu: 'port', routine: 'habitant', poste: [20, 82], soir: [21, 84], maison: [24, 82],
    look: { peau: P.mat, cheveux: '#c0c0c0', haut: '#5d6b3c', haut2: '#8a9a58', bas: '#3c4527', chapeau: 'calot' },
    salut: ['Matricule. Tu tiens debout, c\'est déjà ça.', 'Le front ne recule pas tout seul.'],
    bulles: ['Rapport de la Fougère : toujours rien.', 'Doublez la garde à l\'est.', 'Qui a laissé la porte nord ouverte ?'] },
  { id: 'nadia', nom: 'Nadia Ferrand', titre: 'Armurière', lieu: 'port', routine: 'fixe', poste: [47, 95], boutique: 'armurerie',
    look: { peau: P.clair, cheveux: '#a04a2a', haut: '#6a4a3a', haut2: '#9a6a4a', bas: '#3a2a20', chapeau: 'foulard' },
    salut: ['Une arme qui s\'enraye, c\'est une tombe. Regarde ce que j\'ai.', 'Je reprends ton vieux fer, si tu veux.'],
    bulles: ['Canons neufs, tout juste rectifiés !', 'Pas de crédit. Jamais.', 'Ça, c\'est de l\'acier d\'avant la chute.'] },
  { id: 'morel', nom: 'Sergent Morel', lieu: 'port', routine: 'garde', poste: [69, 97], arme: true, ronde: [[69, 96], [69, 103], [66, 103], [66, 96]],
    look: L.garde(P.brun), salut: ['Porte est. Rien ne passe sans que je le voie.'], bulles: ['Ouvrez l\'œil.', 'Ça bouge, là-bas, dans les herbes.', 'Relève dans une heure.'] },
  { id: 'agathe', nom: 'Agathe Lin', titre: 'Docteure', lieu: 'port', routine: 'habitant', poste: [31, 81], soir: [35, 100], maison: [34, 81], boutique: 'soins',
    look: { peau: P.pale, cheveux: '#1a1a1a', haut: '#d8d8d0', haut2: '#ffffff', bas: '#8e928a' },
    salut: ['Assieds-toi. Non, pas là, c\'est stérile.', 'Les spores, ça ne s\'en va pas en toussant.'],
    bulles: ['Encore un brûlé à l\'acide.', 'Il me faut de la fougère-sang.', 'Lavez-vous les mains !'] },
  { id: 'joss', nom: 'Joss Ruelle', titre: 'Maître de l\'atelier', lieu: 'port', routine: 'habitant', poste: [54, 81], soir: [16, 109], maison: [59, 81],
    look: { peau: P.fonce, cheveux: '#3a3a3a', haut: '#b56e22', haut2: '#e39a3e', bas: '#2d3a4a', chapeau: 'bob' },
    salut: ['Un robot, c\'est une famille qui se souvient. Prends-en soin.', 'Amène des pièces, je fais des miracles.'],
    bulles: ['Passe-moi la clé de douze.', 'Celui-là a vu trois générations.', 'Ça sent le circuit grillé.'] },
  { id: 'odile', nom: 'Mère Odile', titre: 'Cantinière', lieu: 'port', routine: 'fixe', poste: [21, 110], boutique: 'cantine',
    look: { peau: P.clair, cheveux: '#e0e0e0', haut: '#8a3a3a', haut2: '#c45a5a', bas: '#4a3a30', chapeau: 'foulard' },
    salut: ['Mange, tu es tout pâle.', 'Le ragoût est chaud. La viande, c\'est autre chose.'],
    bulles: ['À table !', 'Qui a fini le pain ?', 'Plus de viande, plus de ragoût.'] },
  { id: 'basile', nom: 'Basile', titre: 'Ferrailleur', lieu: 'port', routine: 'fixe', poste: [57, 109], boutique: 'ferraille',
    look: { peau: P.mat, cheveux: '#6a4a2a', haut: '#5c3520', haut2: '#8a5230', bas: '#3a2418', chapeau: 'bob' },
    salut: ['Tout se revend. Même toi, un jour.', 'Montre-moi ton sac.'],
    bulles: ['J\'achète tout ce qui brille !', 'Prix d\'ami, aujourd\'hui seulement.', 'La Casse paie mieux ? Menteurs.'] },
  { id: 'ilona', nom: 'Ilona Garnier', titre: 'Scribe', lieu: 'port', routine: 'habitant', poste: [43, 95], soir: [30, 115], maison: [30, 115],
    look: { peau: P.pale, cheveux: '#3a2a1a', haut: '#3a4a6a', haut2: '#5a6a9a', bas: '#2a2a3a' },
    salut: ['J\'écris les noms de ceux qui tombent. Il y en a beaucoup.', 'Chaque lignée a son registre.'],
    bulles: ['Un nom de plus ce matin.', 'Mon encre gèle, la nuit.', 'Qui se souviendra de nous ?'] },
  { id: 'teodor', nom: 'Caporal Teodor', lieu: 'port', routine: 'garde', poste: [39, 77], arme: true, ronde: [[38, 77], [41, 77], [41, 79], [38, 79]],
    look: L.garde(P.clair), salut: ['Porte nord. On ne s\'y ennuie jamais assez.'], bulles: ['Encore un Rôdeur.', 'Il fait froid, ici.'] },
  { id: 'garde1', nom: 'Garde Hennequin', lieu: 'port', routine: 'garde', poste: [69, 80], arme: true, ronde: [[69, 80], [69, 92], [69, 108], [69, 120], [69, 108], [69, 92]],
    look: L.garde(P.mat), salut: ['Circule.'], bulles: ['Rien à signaler.', 'Les murs tiennent.'] },
  { id: 'garde2', nom: 'Garde Sorel', lieu: 'port', routine: 'garde', poste: [40, 122], arme: true, ronde: [[38, 122], [41, 122], [41, 120], [38, 120]],
    look: L.garde(P.fonce), salut: ['Porte sud. Le quai, la mer, et rien d\'autre.'], bulles: ['Les pêcheurs d\'Anse-Grise sont rentrés tôt.', 'Encore une nuit sans lune.'] },
  { id: 'garde3', nom: 'Garde Vautrin', lieu: 'port', routine: 'garde', poste: [12, 100], arme: true, ronde: [[11, 77], [11, 100], [11, 122], [11, 100]],
    look: L.garde(P.clair), salut: ['Le mur ouest. La ferme, et la forêt derrière.'], bulles: ['Calme plat.', 'Je compte les pierres.'] },
  { id: 'aldo', nom: 'Aldo', titre: 'Fermier', lieu: 'ferme', routine: 'habitant', poste: [88, 91], soir: [86, 84], maison: [96, 83],
    look: { peau: P.brun, cheveux: '#8a8a7a', haut: '#6a7a3a', haut2: '#8a9a5a', bas: '#5a4a30', chapeau: 'bob' },
    salut: ['Les Rôdeurs me volent mes bêtes la nuit.', 'Rien ne pousse comme avant. Sauf ÉDEN.'],
    bulles: ['Allez, avancez, les bêtes !', 'Mes pauvres champs.', 'Pluie demain, j\'espère.'] },
  // passants de Port-Ancre
  { id: 'p1', nom: 'Colon Brice', lieu: 'port', routine: 'passant', poste: [35, 100], maison: [14, 91], look: L.colon(P.clair, '#4a3a2a', '#5a6a7a'), salut: ['Belle journée pour mourir, hein ?'], bulles: ['On manque de tout.', 'T\'as vu les lumières au nid ?', 'Ma sœur est partie au front.'] },
  { id: 'p2', nom: 'Colone Maud', lieu: 'port', routine: 'passant', poste: [45, 102], maison: [22, 91], look: L.colon(P.mat, '#2a1a1a', '#7a4a6a'), salut: ['Bonjour, matricule.'], bulles: ['Les prix montent.', 'Tu crois qu\'ÉDEN rêve ?', 'J\'ai entendu chanter la nuit, dans les ruines.'] },
  { id: 'p3', nom: 'Colon Arsène', lieu: 'port', routine: 'passant', poste: [52, 99], maison: [54, 91], look: L.colon(P.fonce, '#1a1a1a', '#3a5a4a'), salut: ['On se connaît ?'], bulles: ['Le Semeur… des histoires.', 'Le ragoût d\'Odile est le meilleur.', 'Encore la pluie.'] },
  { id: 'p4', nom: 'Colone Inès', lieu: 'port', routine: 'passant', poste: [28, 100], maison: [46, 115], look: L.colon(P.pale, '#c0a060', '#6a3a3a'), salut: ['Fais attention à toi.'], bulles: ['Les Fertiles nous trahiront.', 'Mon fils veut être matricule.', 'Il paraît que la Casse vend des robots.'] },
  { id: 'p5', nom: 'Colon Gaston', lieu: 'port', routine: 'passant', poste: [40, 88], maison: [62, 116], look: L.colon(P.clair, '#8a6a4a', '#4a4a6a'), salut: ['Hm.'], bulles: ['Pas le temps.', 'Où est passée ma clé ?', 'Il faut réparer les lampes.'] },
  { id: 'p6', nom: 'Colone Lise', lieu: 'port', routine: 'passant', poste: [60, 99], maison: [14, 116], look: L.colon(P.brun, '#1a1a1a', '#8a7a3a'), salut: ['Salut.'], bulles: ['Encore une alerte à l\'est.', 'J\'ai faim.', 'Tu as des nouvelles du marais ?'] },
  { id: 'e1', nom: 'Petit Jules', lieu: 'port', routine: 'enfant', poste: [36, 96], maison: [30, 115], look: { ...L.colon(P.clair, '#c09050', '#5a7aaa'), petit: true }, salut: ['T\'as tué combien de Rampants ?'], bulles: ['Pan ! Pan !', 'Moi aussi j\'aurai un robot !', 'Attrape-moi !'] },
  { id: 'e2', nom: 'Petite Nour', lieu: 'port', routine: 'enfant', poste: [33, 96], maison: [46, 115], look: { ...L.colon(P.fonce, '#1a1a1a', '#aa5a7a'), petit: true }, salut: ['Ton robot, il a un nom ?'], bulles: ['Hihi !', 'C\'est moi le Semeur !', 'Maman, regarde !'] },
  // ------------------------------------------------------------ Poste de la Fougère
  { id: 'corinne', nom: 'Corinne Saulnier', titre: 'Lieutenante', lieu: 'fougere', routine: 'habitant', poste: [155, 57], soir: [156, 63], maison: [152, 56],
    look: { peau: P.clair, cheveux: '#3a2a1a', haut: '#3f6a4a', haut2: '#6a9a6a', bas: '#2a3a2a', chapeau: 'calot' },
    salut: ['La forêt se referme sur nous. Chaque jour un peu plus.', 'Port-Ancre nous a oubliés ?'],
    bulles: ['Tenez la palissade.', 'Les fougères bougent sans vent.', 'Encore une patrouille perdue.'] },
  { id: 'ilan', nom: 'Ilan Vasseur', titre: 'Botaniste', lieu: 'fougere', routine: 'fixe', poste: [151, 64],
    look: { peau: P.mat, cheveux: '#5a3a1a', haut: '#8a8a5a', haut2: '#aaaa7a', bas: '#4a4a3a', chapeau: 'bob' },
    salut: ['ÉDEN n\'est pas qu\'un monstre. C\'est un jardin qui a perdu la tête.'],
    bulles: ['Fascinant.', 'Ces spores ont une structure presque… écrite.', 'Il me faut un échantillon frais.'] },
  { id: 'tamsin', nom: 'Tamsin', titre: 'Éclaireuse', lieu: 'fougere', routine: 'habitant', poste: [157, 64], soir: [158, 62], maison: [162, 63],
    look: { peau: P.brun, cheveux: '#1a1a1a', haut: '#4a5a3a', haut2: '#6a7a4a', bas: '#3a3a2a', chapeau: 'capuche' },
    salut: ['Je connais chaque piste d\'ici au marais.'], bulles: ['Chut.', 'Des Fougerôdes au nord.', 'J\'ai vu de la lumière à Haute-Sève.'] },
  { id: 'garde_f', nom: 'Garde Lucas', lieu: 'fougere', routine: 'garde', poste: [147, 60], arme: true, ronde: [[147, 59], [147, 61], [149, 61], [149, 59]],
    look: L.garde(P.mat), salut: ['Fougère. Avance doucement.'], bulles: ['Il fait sombre, sous les fougères.'] },
  // ------------------------------------------------------------ Haute-Sève (les Fertiles)
  { id: 'maelle', nom: 'Maëlle Sève', titre: 'Doyenne des Fertiles', lieu: 'hauteseve', routine: 'habitant', poste: [179, 149], soir: [176, 149], maison: [173, 144],
    look: { peau: '#b8c8a0', cheveux: '#e8e8d0', haut: '#6a3a6a', haut2: '#9a5a8a', bas: '#3a2a3a', greffe: true },
    salut: ['Nous ne sommes pas tes ennemis, matricule. Nous avons juste cessé de nous battre.', 'La sève parle, si on l\'écoute.'],
    bulles: ['La terre a faim, mais elle donne aussi.', 'Respire. Lentement.', 'Le Semeur n\'a jamais voulu de guerre.'] },
  { id: 'ondine', nom: 'Ondine', titre: 'Herboriste', lieu: 'hauteseve', routine: 'fixe', poste: [179, 154], boutique: 'fertile',
    look: { peau: '#c8d0a8', cheveux: '#5a8a4a', haut: '#4a6a3a', haut2: '#7a9a5a', bas: '#3a4a2a', greffe: true },
    salut: ['Mes baumes guérissent mieux que tes seringues.'], bulles: ['Doucement avec les racines.', 'Tout pousse, ici.'] },
  { id: 'fertile1', nom: 'Fertile Arno', lieu: 'hauteseve', routine: 'passant', poste: [178, 146], maison: [184, 144], look: { peau: '#b0c098', cheveux: '#3a2a1a', haut: '#5a4a6a', haut2: '#8a7a9a', bas: '#3a3a3a', greffe: true }, salut: ['La Colonie t\'envoie ?'], bulles: ['Les racines chantent ce soir.', 'On ne vous veut pas de mal.'] },
  // ------------------------------------------------------------ Poste du Marais
  { id: 'roque', nom: 'Sergent Roque', lieu: 'postemarais', routine: 'habitant', poste: [229, 122], soir: [230, 128], maison: [227, 122],
    look: { peau: P.fonce, cheveux: '#1a1a1a', haut: '#4d6a5a', haut2: '#7a9a8a', bas: '#2a3a30', chapeau: 'casque' },
    salut: ['Bienvenue au bout du monde. Les pieds au sec, si tu peux.'],
    bulles: ['Les balises sont noyées.', 'Quelque chose de gros dort au sud.', 'Encore une sangsue dans ma botte.'] },
  { id: 'gaspard', nom: 'Gaspard', titre: 'Pêcheur', lieu: 'postemarais', routine: 'fixe', poste: [235, 128],
    look: { peau: P.brun, cheveux: '#9a9a8a', haut: '#5a6a5a', haut2: '#7a8a7a', bas: '#3a3a30', chapeau: 'bob' },
    salut: ['Ça ne mord plus. Plus rien ne mord, sauf ce qui mord les pêcheurs.'], bulles: ['Rien.', 'Toujours rien.', 'Ah ! Non, une botte.'] },
  // ------------------------------------------------------------ La Casse (Ferrailleurs)
  { id: 'rivet', nom: 'Mama Rivet', titre: 'Cheffe des Ferrailleurs', lieu: 'casse', routine: 'fixe', poste: [268, 36], boutique: 'casse',
    look: { peau: P.mat, cheveux: '#c06030', haut: '#5c3520', haut2: '#8a5230', bas: '#2a1810', chapeau: 'foulard' },
    salut: ['La Colonie nous appelle des voleurs. Nous, on appelle ça du recyclage.', 'Des pièces ? J\'en ai. Des questions ? Ça coûte plus cher.'],
    bulles: ['Qui a touché à mon générateur ?', 'Tout se répare.', 'Le cimetière est une mine d\'or.'] },
  { id: 'ferr1', nom: 'Ferrailleur Clou', lieu: 'casse', routine: 'passant', poste: [273, 42], maison: [280, 37], look: L.colon(P.brun, '#3a2a1a', '#6a4a2a', '#2a1810'), salut: ['T\'es perdu, matricule ?'], bulles: ['Pas touche.', 'Elle est à moi, cette épave.'] },
  { id: 'ferr2', nom: 'Ferrailleuse Pince', lieu: 'casse', routine: 'passant', poste: [273, 46], maison: [268, 44], look: L.colon(P.clair, '#8a3a1a', '#7a5a3a', '#3a2418'), salut: ['On fait pas de cadeaux.'], bulles: ['Ça vaut combien, ça ?', 'Faut aller au cimetière.'] },
  // ------------------------------------------------------------ le cimetière des machines
  { id: 'septieme', nom: 'Cantor', titre: 'Robot de la Première Vague', lieu: 'cimetiere', routine: 'fixe', poste: [350, 61],
    look: { peau: '#7890a6', cheveux: '#4a5d72', haut: '#5a6a7a', haut2: '#8aa0b6', bas: '#3a4a5a', robot: true },
    salut: ['UNITÉ CANTOR. MÉMOIRE : 3 %. … TU RESSEMBLES À QUELQU\'UN.', 'JE CHANTE POUR NE PAS OUBLIER LES NOMS.'],
    bulles: ['♪ … LA LA … ♪', 'ERREUR. ERREUR. SOUVENIR.', 'LE SEMEUR M\'A PARLÉ, UNE FOIS.'] },
  // ------------------------------------------------------------ lieux ajoutés avec le continent (coordonnées du continent)
  // Anse-Grise
  { id: 'yvon', nom: 'Yvon Morvan', titre: 'Patron pêcheur', lieu: 'anse', routine: 'habitant', poste: [249, 344], soir: [243, 342], maison: [242, 338],
    look: { peau: P.brun, cheveux: '#d0d0c8', haut: '#2e4a6a', haut2: '#4a6a8a', bas: '#3a3a40', chapeau: 'bob' },
    salut: ['La mer nous nourrit encore. Elle, ÉDEN n\'en veut pas.', 'Le vent tourne. Ça sent la pluie et la sève.'],
    bulles: ['Les filets sont pleins de vase.', 'Une barque de moins cet hiver.', 'Le phare de la Patience, je l\'ai vu enfant.'] },
  { id: 'soazig', nom: 'Soazig', titre: 'Fumeuse de poisson', lieu: 'anse', routine: 'fixe', poste: [252, 342], boutique: 'cantine',
    look: { peau: P.clair, cheveux: '#8a5a2a', haut: '#6a5a3a', haut2: '#8a7a5a', bas: '#3a3028', chapeau: 'foulard' },
    salut: ['Du poisson fumé contre de la viande, ça te va ?'], bulles: ['Ça sèche mal, avec cette brume.', 'Qui veut du hareng ?'] },
  // Relais du Col
  { id: 'brune', nom: 'Brune Castagne', titre: 'Aubergiste du Relais', lieu: 'relais', routine: 'habitant', poste: [197, 216], soir: [196, 212], maison: [195, 212],
    look: { peau: P.mat, cheveux: '#5a2a1a', haut: '#7a3a2a', haut2: '#a85a3a', bas: '#3a2a20', chapeau: 'foulard' },
    salut: ['Dernier toit avant les plateaux. Profites-en.', 'Les monorails passaient ici, avant. On entendait le chant des rails.'],
    bulles: ['Une soupe, une seule.', 'Les cols ferment quand il pleut.', 'J\'ai vu des lumières sur le Basalte.'] },
  { id: 'garde_col', nom: 'Garde Ferrat', lieu: 'relais', routine: 'garde', poste: [200, 208], arme: true, ronde: [[199, 208], [201, 208], [201, 220], [199, 220]],
    look: L.garde(P.brun), salut: ['Col du Relais. On monte à ses risques.'], bulles: ['Le vent siffle dans le col.', 'Rien ne descend des plateaux, ce soir.'] },
  // La Mine
  { id: 'gros_louis', nom: 'Gros-Louis', titre: 'Contremaître de la Mine', lieu: 'mine', routine: 'habitant', poste: [150, 144], soir: [147, 145], maison: [145, 140],
    look: { peau: P.fonce, cheveux: '#2a2a2a', haut: '#5a5a4a', haut2: '#7a7a6a', bas: '#2a2a2a', chapeau: 'casque' },
    salut: ['On creuse le métal de la Première Vague. Il y en a plus sous terre que dessus.'],
    bulles: ['Encore un éboulement.', 'Les rails descendent plus bas qu\'on ne le croit.', 'Pas de chair, ici. Pas encore.'] },
  { id: 'mineuse', nom: 'Mineuse Agnès', lieu: 'mine', routine: 'passant', poste: [151, 144], maison: [154, 140], look: L.colon(P.clair, '#3a2a1a', '#5a4a3a', '#2a2a2a'), salut: ['Fais gaffe aux wagonnets.'], bulles: ['Du fer, du fer, encore du fer.', 'J\'ai mal au dos.'] },
  // Bastion de la Colonie
  { id: 'varenne', nom: 'Commandante Varenne', titre: 'Bastion de la Colonie', lieu: 'bastion', routine: 'habitant', poste: [266, 163], soir: [263, 162], maison: [262, 157],
    look: { peau: P.pale, cheveux: '#3a3a3a', haut: '#4a5d72', haut2: '#7890a6', bas: '#2d3a4a', chapeau: 'calot' },
    salut: ['Le Bastion est la dent qu\'on plante dans ÉDEN. Elle ne lâche pas.', 'Trois ruches d\'ici. Je les compte chaque matin.'],
    bulles: ['Tenez les créneaux.', 'La Ruche du Basalte a encore grossi.', 'Rapport au Port, tout de suite.'] },
  { id: 'garde_b1', nom: 'Garde Lemaire', lieu: 'bastion', routine: 'garde', poste: [266, 152], arme: true, ronde: [[264, 153], [268, 153]], look: L.garde(P.mat), salut: ['Porte nord du Bastion.'], bulles: ['Ça grouille, au nord.'] },
  { id: 'garde_b2', nom: 'Garde Okafor', lieu: 'bastion', routine: 'garde', poste: [276, 164], arme: true, ronde: [[275, 162], [275, 167]], look: L.garde(P.fonce), salut: ['Porte est. Rien ne passe.'], bulles: ['La brume est violette, ce soir.'] },
  // Camp de l'Épave
  { id: 'harlan', nom: 'Harlan', titre: 'Récupérateur', lieu: 'campepave', routine: 'habitant', poste: [94, 108], soir: [96, 110], maison: [90, 103],
    look: { peau: P.mat, cheveux: '#6a6a6a', haut: '#4a4a3a', haut2: '#6a6a5a', bas: '#2a2a20', chapeau: 'capuche' },
    salut: ['La Constance. Le premier vaisseau. Personne n\'y entre longtemps.', 'Le sas s\'ouvre encore, si on sait où pousser.'],
    bulles: ['Il y a des noms gravés dans la coque.', 'Les Rouillards gardent la soute.', 'Le vieux robot chante toute la nuit.'] },
  // ------------------------------------------------------------ campagne 2 : les Hauts de Glane
  // Relâche
  { id: 'helene', nom: 'Hélène Vasseur', titre: 'Capitaine du port', lieu: 'relache', routine: 'habitant', poste: [468, 276], soir: [466, 283], maison: [466, 266],
    look: { peau: P.mat, cheveux: '#c8c0b0', haut: '#3a4a5a', haut2: '#5a6a7a', bas: '#2a2a30', chapeau: 'bob' },
    salut: ['Relâche loue ses barges à qui paie. Toi, tu as une tête à payer en services.', 'Ici, on ne demande pas d\'où tu viens. On demande ce que tu sais réparer.'],
    bulles: ['Une barge de moins, une dette de plus.', 'Les robots des Champs ne sont pas morts. Éteints.', 'Qui a encore emprunté mon sextant ?'] },
  { id: 'yaelle', nom: 'Yaëlle Brun', titre: "Tenancière de l'Escale", lieu: 'relache', routine: 'fixe', poste: [469, 284], boutique: 'cantine',
    look: { peau: P.clair, cheveux: '#a04a2a', haut: '#6a3a3a', haut2: '#8a5a5a', bas: '#3a2a28', chapeau: 'foulard' },
    salut: ['Soupe de varech, pain d\'algue. Ça tient au corps, pas au cœur.'], bulles: ['On ferme quand le dernier ronfle.', 'Encore un exilé sans le sou.', 'Le poisson d\'ici a un goût de rouille.'] },
  { id: 'tisserand', nom: 'Tisserand', titre: 'Robot à moitié tissé', lieu: 'relache', routine: 'fixe', poste: [484, 283],
    look: { peau: '#8a929c', cheveux: '#5a626c', haut: '#6a7078', haut2: '#9aa2ac', bas: '#4a5058', robot: true },
    salut: ['je me souviens de chacun d eux ils attendent dans les sillons', 'des fils encore dans mon châssis elle tisse elle compte elle ne s arrête pas'],
    bulles: ['un deux trois quatre je les compte aussi', 'le métier chante sous le vent', 'tu as un robot il te regarde'] },
  { id: 'ivo', nom: 'Ivo Sève', titre: 'Petit-fils de Maëlle', lieu: 'relache', routine: 'habitant', poste: [474, 287], soir: [470, 278], maison: [482, 284],
    look: { peau: P.brun, cheveux: '#2a4a2a', haut: '#3a5a3a', haut2: '#5a7a5a', bas: '#2a3a2a', greffe: true },
    salut: ['Ma grand-mère disait que la lande a une mémoire. Elle avait raison.', 'Les Hauts ne sont pas à vous. Ni à elle.'],
    bulles: ['La sève coule plus lente ici.', 'Les bourgeons regardent. Toujours.', 'Haute-Sève me manque.'] },
  { id: 'garde_rel1', nom: 'Docker Malo', lieu: 'relache', routine: 'garde', poste: [459, 276], arme: true, ronde: [[459, 275], [459, 278]],
    look: L.colon(P.fonce, '#1a1a1a', '#5a4a3a', '#2a2a2a'), salut: ['Le quai, c\'est par là. Les ennuis, par ici.'], bulles: ['La barge rentre à l\'heure, pour une fois.', 'Rien ne nage, dans ce bras de mer.'] },
  { id: 'garde_rel2', nom: 'Docker Sabine', lieu: 'relache', routine: 'garde', poste: [476, 263], arme: true, ronde: [[475, 263], [478, 263]],
    look: L.colon(P.pale, '#8a6a3a', '#4a5a4a', '#2a2a2a'), salut: ['Porte nord. Après, c\'est la lande.'], bulles: ['Des Glaneurs, encore, sur la crête.', 'Le vent rapporte des bruits de métal.'] },
  { id: 'rel_p1', nom: 'Exilé Thadée', lieu: 'relache', routine: 'passant', poste: [471, 277], maison: [464, 284], look: L.colon(P.mat, '#4a3a2a', '#5a5a3a'), salut: ['On a tout laissé derrière nous.'], bulles: ['Relâche, ça veut dire qu\'on souffle.', 'Mon robot ne répond plus depuis le Gué.'] },
  { id: 'rel_p2', nom: 'Ferrailleuse Nine', lieu: 'relache', routine: 'passant', poste: [479, 277], maison: [486, 284], look: L.colon(P.clair, '#2a2a2a', '#4a4a5a'), salut: ['Tu vends ? Tu achètes ? Tu traînes ?'], bulles: ['Les Champs, c\'est une mine d\'or. Une mine d\'or qui te regarde.', 'J\'ai vu un robot se relever tout seul.'] },
  // le Gué de Glane
  { id: 'kessler', nom: 'Brune Kessler', titre: 'Lieutenante du Corps', lieu: 'gue_glane', routine: 'habitant', poste: [446, 101], soir: [450, 100], maison: [444, 94],
    look: { peau: P.clair, cheveux: '#c8a040', haut: '#4a5d72', haut2: '#7890a6', bas: '#2d3a4a', chapeau: 'calot' },
    salut: ['Le Gué tient. Pour l\'instant. La Fougère m\'a appris à compter les nuits.', 'Ici, ÉDEN ne pousse pas : il moissonne.'],
    bulles: ['Doublez la garde côté lande.', 'Encore un robot qui a filé vers le nord.', 'Rapport au Bastion, par la ligne.'] },
  { id: 'garde_gue', nom: 'Garde Ansel', lieu: 'gue_glane', routine: 'garde', poste: [448, 107], arme: true, ronde: [[446, 107], [451, 107]],
    look: L.garde(P.mat), salut: ['Le Gué. On passe en file.'], bulles: ['L\'eau monte la nuit.', 'Rien sur l\'isthme.'] },
  // le Sillon
  { id: 'rade', nom: 'Corentin Rade', titre: 'Chef du Sillon', lieu: 'sillon', routine: 'habitant', poste: [527, 205], soir: [525, 204], maison: [524, 199],
    look: { peau: P.fonce, cheveux: '#5a5a5a', haut: '#5a4a3a', haut2: '#7a6a5a', bas: '#2a2a20', chapeau: 'casque' },
    salut: ['On récupère ce que les sillons rendent. Pas plus. Ceux qu\'on prend de trop se relèvent.'],
    bulles: ['Ne touche pas aux rangées du fond.', 'Une pièce, deux pièces… et un œil qui s\'allume.'] },
]
// les habitants des premiers lieux : on les place où leur lieu est sur le continent
for (const n of NPCS) {
  const [dx, dy] = decaleLieu(n.lieu)
  if (!dx && !dy) continue
  const m = (p: [number, number]): [number, number] => [p[0] + dx, p[1] + dy]
  n.poste = m(n.poste); if (n.maison) n.maison = m(n.maison); if (n.soir) n.soir = m(n.soir); if (n.ronde) n.ronde = n.ronde.map(m)
}
export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]))

/** Ce que vend chaque boutique (bases et niveaux) : le serveur tire le stock à partir de ces gabarits. */
export const BOUTIQUES: Record<Boutique, { nom: string; achete: string[] | 'tout'; vend: { b: string; r?: number; l?: number }[] }> = {
  armurerie: { nom: "L'étal de Nadia", achete: ['arme', 'armure', 'module'], vend: [{ b: 'arme', r: 0 }, { b: 'arme', r: 1 }, { b: 'armure', r: 0 }, { b: 'armure', r: 1 }, { b: 'module', r: 0 }, { b: 'trousse' }] },
  soins: { nom: "L'infirmerie", achete: ['herbe', 'champignon', 'spore'], vend: [{ b: 'trousse' }] },
  ferraille: { nom: 'Le comptoir de Basile', achete: 'tout', vend: [{ b: 'piece' }, { b: 'module', r: 1 }] },
  casse: { nom: 'La Casse', achete: 'tout', vend: [{ b: 'piece' }, { b: 'module', r: 1 }, { b: 'module', r: 2 }, { b: 'arme', r: 2 }] },
  fertile: { nom: "Les baumes d'Ondine", achete: ['herbe', 'champignon', 'spore', 'peau'], vend: [{ b: 'baume' }, { b: 'armure', r: 2 }, { b: 'module', r: 2 }] },
  cantine: { nom: 'La cantine', achete: ['viande'], vend: [{ b: 'trousse' }] },
}

/** La position de travail selon l'heure, pour les habitants. */
export function routineSpot(n: NpcDef, heure: number): { spot: [number, number]; act: number } {
  if (n.routine === 'fixe') return { spot: n.poste, act: 2 }
  if (n.routine === 'garde') return { spot: n.poste, act: 1 }
  const nuit = heure >= 22 || heure < 6.5
  if (nuit && n.maison) return { spot: n.maison, act: 4 }
  if (n.routine === 'habitant' && heure >= 19 && n.soir) return { spot: n.soir, act: 3 }
  return { spot: n.poste, act: n.routine === 'habitant' ? 2 : 1 }
}

/** Les lieux publics où flânent les passants. */
export const FLANERIE: Record<string, [number, number][]> = {
  anse: [[245, 343], [250, 344], [255, 343], [247, 340]],
  relais: [[196, 217], [203, 217], [200, 213]],
  relache: [[468, 277], [474, 278], [479, 276], [476, 284], [463, 276], [485, 277]],
  gue_glane: [[446, 102], [452, 101]],
  mine: [[146, 145], [150, 144], [155, 145]],
  port: [[33, 97], [46, 98], [40, 92], [36, 104], [48, 104], [20, 99], [60, 100], [40, 85], [28, 88], [55, 88], [40, 115], [17, 102], [30, 108]],
  hauteseve: [[176, 146], [182, 149], [179, 145], [185, 150], [172, 149]],
  casse: [[272, 42], [278, 44], [266, 41], [281, 32], [275, 31]],
}
for (const [lieu, pts] of Object.entries(FLANERIE)) { const [dx, dy] = decaleLieu(lieu); if (dx || dy) FLANERIE[lieu] = pts.map(([x, y]) => [x + dx, y + dy]) }

/** La faction d'un habitant, pour la fenêtre de dialogue (nom et couleur). */
export interface Faction { id: string; nom: string; couleur: 'orange' | 'vert' | 'froid' | 'violet' | '' }
const CORPS = new Set(['ysolde', 'morel', 'teodor', 'garde1', 'garde2', 'garde3', 'corinne', 'tamsin', 'garde_f', 'roque', 'garde_col', 'varenne', 'garde_b1', 'garde_b2', 'kessler', 'garde_gue'])
const FERRAILLEURS = new Set(['joss', 'basile', 'rivet', 'ferr1', 'ferr2', 'harlan', 'helene', 'garde_rel1', 'garde_rel2', 'rel_p2', 'rade'])
const FERTILES = new Set(['maelle', 'ondine', 'fertile1'])
export function factionOf(id: string): Faction {
  if (CORPS.has(id)) return { id: 'corps', nom: 'Corps colonial', couleur: 'orange' }
  if (FERRAILLEURS.has(id)) return { id: 'ferrailleurs', nom: 'Ferrailleurs', couleur: 'froid' }
  if (FERTILES.has(id)) return { id: 'fertiles', nom: 'Fertiles', couleur: 'vert' }
  if (id === 'ivo') return { id: 'fertiles', nom: 'Fertiles', couleur: 'vert' }
  if (id === 'septieme' || id === 'tisserand') return { id: 'premiere_vague', nom: 'Première Vague', couleur: 'violet' }
  return { id: 'colons', nom: 'Colons', couleur: '' }
}
