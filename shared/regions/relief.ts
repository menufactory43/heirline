// Le relief du continent, qui structure les déplacements : la côte, les falaises des plateaux et leurs cols,
// les rivières (on les passe sur les ponts des routes, ou à gué).

/** La côte : un continent presque carré aux bords bruités ; Port-Ancre est sur la côte sud. */
export const COTE = { cx: 200, cy: 186, rx: 194, ry: 172, puissance: 3.4, bruit: 9 }

/** Les Hauts de Glane (campagne 2) : un second massif, à l'est, de l'autre côté du détroit. */
export const COTE2 = { cx: 528, cy: 168, rx: 104, ry: 150, puissance: 2.6, bruit: 9 }
/** L'Isthme de Glane : une langue de lande, au-delà de la Grande Ruche, qui relie Ossara aux Hauts (segment, demi-largeur). */
export const ISTHME = { x0: 366, y0: 84, x1: 440, y1: 100, demi: 10 }

/** Les cols : seuls passages à travers les falaises qui ceinturent les plateaux. */
export const COLS: { id: string; nom: string; x: number; y: number; r: number }[] = [
  { id: 'col_sud', nom: 'Col du Relais', x: 200, y: 204, r: 5 },
  { id: 'col_ouest', nom: 'Col de la Mine', x: 128, y: 150, r: 4 },
  { id: 'col_est', nom: 'Col du Bastion', x: 255, y: 158, r: 4 },
  { id: 'col_nord', nom: 'Col des Carcasses', x: 150, y: 78, r: 4 },
  { id: 'col_eden', nom: 'Passe Violette', x: 262, y: 104, r: 4 },
]

/** Les rivières : des plateaux à la mer. Points de passage en tuiles, largeur en tuiles. */
export const RIVIERES: { id: string; nom: string; points: [number, number][]; largeur: number }[] = [
  { id: 'claire', nom: 'La Claire', largeur: 2, points: [[124, 168], [116, 196], [102, 228], [96, 262], [92, 300], [84, 336], [78, 372]] },
  { id: 'seve', nom: 'La Sève', largeur: 2, points: [[238, 178], [250, 210], [262, 244], [272, 280], [282, 314], [290, 350], [296, 380]] },
]

/** Les gués : des hauts-fonds où l'on traverse à pied, sans pont. */
export const GUES: { id: string; x: number; y: number }[] = [
  { id: 'gue_claire', x: 96, y: 262 },
  { id: 'gue_seve', x: 262, y: 244 },
]
