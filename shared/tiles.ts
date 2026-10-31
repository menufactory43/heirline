// Les tuiles et les décors : les numéros partagés par la génération, le serveur, le client et les outils.

export const T = {
  SOL: 0, ROC: 1, METAL: 2, CAISSE: 3, EPAVE: 4, DALLE: 5, ROUTE: 6, CHAIR: 7, NIDSOL: 8,
  HERBE: 9, MOUSSE: 10, BOUE: 11, EAU: 12, FERRAILLE: 13, PAVE: 14, PLANCHER: 15, MURP: 16, MURB: 17,
  ARBRE: 18, MEUBLE: 19, CHAMP: 20, CLOTURE: 21, PALISSADE: 22, RACINE: 23, CHAIRSOL: 24, MARE: 25,
  // le continent : relief, côte, rivières, passages vers d'autres cartes
  FALAISE: 26, MER: 27, SABLE: 28, PONT: 29, GUE: 30, SAS: 31, SCELLE: 32,
} as const

export const D = {
  RIEN: 0, CAILLOUX: 1, TOUFFE: 2, FISSURE: 3, OS: 4, LAMPE: 5, VRILLE: 6, FLAQUE: 7,
  FLEUR: 8, CHAMPI: 9, ROSEAU: 10, FOUGERE: 11, PNEU: 12, TUYAU: 13, PAILLE: 14, BUISSON: 15,
  // meubles (posés sur une tuile MEUBLE)
  M_TABLE: 20, M_LIT: 21, M_ETABLI: 22, M_COMPTOIR: 23, M_ETAGERE: 24, M_TONNEAU: 25, M_FOUR: 26, M_CAISSES: 27,
  M_ARMOIRE: 28, M_BANC: 29, M_ETAL: 30, M_FONTAINE: 31, M_TABLEAU: 32, M_ARCHE: 33, M_ENCLUME: 34, M_LANTERNE: 35,
} as const
export const DECO_MAX = 36

const SOLIDES = new Set<number>([T.ROC, T.METAL, T.CAISSE, T.EPAVE, T.CHAIR, T.EAU, T.MURP, T.MURB, T.ARBRE, T.MEUBLE, T.CLOTURE, T.PALISSADE, T.RACINE, T.FALAISE, T.MER, T.SCELLE])
/** Ce qui arrête les tirs : tout ce qui est solide, sauf l'eau, la mer, les clôtures et les meubles bas. */
const ARRETE_TIRS = new Set<number>([T.ROC, T.METAL, T.CAISSE, T.EPAVE, T.CHAIR, T.MURP, T.MURB, T.ARBRE, T.PALISSADE, T.RACINE, T.FALAISE, T.SCELLE])

export function isSolidTile(t: number) { return SOLIDES.has(t) }
export function blocksShots(t: number) { return ARRETE_TIRS.has(t) }

/** Un générateur pseudo-aléatoire à graine (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Un bruit de valeurs lisse, sans état : la même valeur partout (serveur, client, outils) pour un point donné. */
export function bruit(x: number, y: number, pas: number, graine: number) {
  const h = (ix: number, iy: number) => {
    let n = (ix * 374761393 + iy * 668265263 + graine * 2147483647) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const fx = x / pas, fy = y / pas, ix = Math.floor(fx), iy = Math.floor(fy)
  const sx = fx - ix, sy = fy - iy, ux = sx * sx * (3 - 2 * sx), uy = sy * sy * (3 - 2 * sy)
  return (h(ix, iy) * (1 - ux) + h(ix + 1, iy) * ux) * (1 - uy) + (h(ix, iy + 1) * (1 - ux) + h(ix + 1, iy + 1) * ux) * uy
}
