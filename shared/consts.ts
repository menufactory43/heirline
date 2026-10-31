// Les nombres du monde, partagés par le serveur, le client (prédiction) et les tests.

export const TILE = 16
/** tuiles : le continent d'Ossara (400 de large) et, à l'est, les Hauts de Glane (campagne 2) ; les autres cartes sont plus petites */
export const MAP_W = 640
/** à partir de cette colonne, on est dans les Hauts de Glane (les régions de la campagne 2) */
export const HAUTS_X = 400
export const MAP_H = 400
export const TICK_HZ = 20
export const DT = 1 / TICK_HZ

/** Port-Ancre : la ville fortifiée, sur la côte sud. C'est la seule zone sûre (la ferraille y est mise à l'abri). */
export const CITY = { x0: 168, y0: 282, x1: 231, y1: 333 }
/** Gardé pour les anciens calculs : la limite est de Port-Ancre. */
export const PORT_W = CITY.x1 + 1
/** Le nid : un enclos de chair, dans sa propre carte (une instance par groupe). C'est l'arène de la Couveuse, en
 *  hauteur pour un téléphone tenu droit (16 × 30 tuiles à l'intérieur) ; entrée en bas du mur ouest. */
export const NEST = { x0: 20, x1: 49, y0: 12, y1: 27, doorY0: 21, doorY1: 24 }

export const PLAYER_R = 6
export const ROBOT_R = 5
export const NPC_R = 5
export const VIEW_IN = 440        // px : un objet entre dans la vue d'un client
export const VIEW_OUT = 540       // px : il en sort (hystérésis)

export const DOWNED_BEHIND_S = 12 // à terre derrière le front avant l'évacuation
export const DOWNED_BEYOND_S = 8  // à terre au-delà avant la mort définitive
export const REVIVE_S = 2.5
export const REVIVE_R = 26

/** Le temps : une journée d'Ossara dure DAY_S secondes réelles. */
export const DAY_S = Number((globalThis as any).process?.env?.DAY_S ?? 1440)

export type Zone = 'port' | 'derriere' | 'dela' | 'nid' | 'concession'

export function inCity(xPx: number, yPx: number) {
  const tx = xPx / TILE, ty = yPx / TILE
  return tx >= CITY.x0 && tx <= CITY.x1 + 1 && ty >= CITY.y0 && ty <= CITY.y1 + 1
}

/** La nuit : 0 en plein jour, 1 au cœur de la nuit. */
export function nightOf(heure: number) {
  if (heure >= 7 && heure <= 18.5) return 0
  if (heure > 18.5 && heure < 21) return (heure - 18.5) / 2.5
  if (heure >= 21 || heure < 5) return 1
  return 1 - (heure - 5) / 2 // 5 h → 7 h : l'aube
}
