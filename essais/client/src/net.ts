export interface Inp { mx: number; my: number; aim: number; fire: boolean }
export interface Ent { id: string; x: number; y: number; angle: number; hp: number; score: number; me: boolean }
export interface Net {
  name: string
  /** appelé à chaque image : envoie les entrées dues (20 Hz) et avance la prédiction */
  frame(now: number, inp: Inp): void
  players(now: number): Ent[]
  bullets(now: number): { id: string; x: number; y: number }[]
  /** délai en ms entre l'envoi d'une entrée et sa confirmation par le serveur (moyenne glissante) */
  ackMs(): number
}
