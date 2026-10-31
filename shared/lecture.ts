// La lecture de la Pépinière (campagne 2, docs/histoire.md § 12) : ÉDEN, dans les Hauts, apprend comment on le tue.
// Il compte, sur une fenêtre glissante d'une dizaine de minutes, les créatures des Hauts tuées par source (balles,
// explosions, robots, compétences) ; une mise à mort près d'un bourgeon-espion compte double. Quand une source domine,
// toutes les créatures des Hauts en prennent 30 % de moins. Tout le monde voit ce qu'il a lu ; on le trompe en variant,
// ou en abattant ses bourgeons avec une autre source (un bourgeon tué fait oublier un peu sa propre source).
// Fonctions pures : le serveur tient les comptes (service central, partagé par les copies), le client les affiche.

export type Source = 'balle' | 'explosion' | 'robot' | 'competence'
export const SOURCES: Source[] = ['balle', 'explosion', 'robot', 'competence']

export const LECTURE = {
  /** constante de temps de l'oubli (s) : un compte perd 63 % en 10 min */
  tau: 600,
  /** la réduction des dégâts de la source lue */
  reduc: 0.3,
  /** part qu'une source doit atteindre pour être lue, et compte minimal (en mises à mort pondérées) */
  part: 0.4, mini: 12,
  /** rayon (px) autour d'un bourgeon-espion où une mise à mort compte double */
  rayonBourgeon: 160,
  /** un bourgeon tué fait oublier cette part du compte de la source qui l'a tué */
  oubli: 0.15,
}

/** les créatures des Hauts de Glane (E 17 à 28 de shared/rules.ts) : elles seules lisent et s'adaptent */
export const estDesHauts = (kind: number) => kind >= 17 && kind <= 28

/** Les comptes par source (dans l'ordre de SOURCES). */
export type Comptes = [number, number, number, number]

export function oublier(c: Comptes, dt: number) { const k = Math.exp(-dt / LECTURE.tau); for (let i = 0; i < 4; i++) c[i] *= k }

/** Une créature des Hauts tombe sous cette source ; poids 2 près d'un bourgeon. Un bourgeon tué fait oublier. */
export function compter(c: Comptes, src: Source, poids: number, bourgeon = false) {
  const i = SOURCES.indexOf(src)
  if (i < 0) return
  if (bourgeon) c[i] *= 1 - LECTURE.oubli
  else c[i] += poids
}

/** La source lue (ou null), et sa part. */
export function lue(c: ArrayLike<number>): { src: Source | null; part: number } {
  let tot = 0, best = 0
  for (let i = 0; i < 4; i++) { tot += c[i]; if (c[i] > c[best]) best = i }
  if (tot < LECTURE.mini) return { src: null, part: tot ? c[best] / tot : 0 }
  const part = c[best] / tot
  return { src: part >= LECTURE.part ? SOURCES[best] : null, part }
}

/** Le multiplicateur des dégâts d'une source sur une créature. */
export function multLecture(kind: number, src: Source | undefined, lu: Source | null) {
  return lu && src === lu && estDesHauts(kind) ? 1 - LECTURE.reduc : 1
}

/** ce que l'état transporte : "balle:52" (source lue et sa part en %), ou "" */
export function codeLecture(c: ArrayLike<number>) { const l = lue(c); return l.src ? `${l.src}:${Math.round(l.part * 100)}` : '' }
