// Les concessions : ce que les agents IA des joueurs peuvent construire, et les contraintes vérifiées par le serveur.
import { z } from 'zod'
import { E, ENEMIES } from './rules.ts'

/** La liste fermée des briques (version 1). Elle s'enrichira sans casser les concessions existantes. */
export const BRICKS_VERSION = 1
export const ENEMY_BRICKS = { rampant: E.RAMPANT, cracheur: E.CRACHEUR, cuirasse: E.CUIRASSE, oeuf: E.OEUF } as const
export const BOSS_BRICKS = { couveuse_mineure: E.COUVEUSE } as const
export type EnemyBrick = keyof typeof ENEMY_BRICKS

export const LIMITS = {
  largeur: [20, 64] as const, hauteur: [14, 40] as const,
  murs: 160, vagues: 8, groupesParVague: 6, ennemisTotal: 90, ennemisParVague: 40,
  budgetPuissance: 420, plafondJour: 300, publicationsParHeure: 12,
}

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur au format #rrggbb')
const variant = z.object({
  pv: z.number().min(0.5).max(2).default(1).describe('multiplicateur de PV (0,5 à 2)'),
  vitesse: z.number().min(0.7).max(1.3).default(1).describe('multiplicateur de vitesse (0,7 à 1,3)'),
  teinte: color.optional().describe('teinte de la biomasse'),
}).strict()

const tilePos = { x: z.number().int().min(1), y: z.number().int().min(1) }

export const ConcessionSchema = z.object({
  nom: z.string().min(3).max(40),
  description: z.string().max(300).default(''),
  taille: z.object({ largeur: z.number().int().min(LIMITS.largeur[0]).max(LIMITS.largeur[1]), hauteur: z.number().int().min(LIMITS.hauteur[0]).max(LIMITS.hauteur[1]) }).strict(),
  sol: z.enum(['roche', 'dalle', 'chair']).default('roche'),
  murs: z.array(z.object({ ...tilePos, l: z.number().int().min(1).max(64), h: z.number().int().min(1).max(40), type: z.enum(['roche', 'metal', 'caisse', 'chair']).default('roche') }).strict()).max(LIMITS.murs).default([]),
  depart: z.object(tilePos).strict(),
  vagues: z.array(z.object({
    delai: z.number().min(0).max(60).default(0).describe('secondes après la fin de la vague précédente'),
    groupes: z.array(z.object({
      brique: z.enum(Object.keys(ENEMY_BRICKS) as [EnemyBrick, ...EnemyBrick[]]),
      nombre: z.number().int().min(1).max(12),
      ...tilePos,
      variante: variant.optional(),
    }).strict()).min(1).max(LIMITS.groupesParVague),
  }).strict()).min(1).max(LIMITS.vagues),
  boss: z.object({ brique: z.enum(['couveuse_mineure']), ...tilePos, pv: z.number().min(0.3).max(1.2).default(0.5) }).strict().optional(),
  textes: z.object({ intro: z.string().max(200).optional(), victoire: z.string().max(200).optional() }).strict().default({}),
}).strict()

export type Concession = z.infer<typeof ConcessionSchema>

/** Le prix en puissance d'un groupe : le créateur ne choisit pas la récompense, il dépense un budget. */
export function groupCost(brique: EnemyBrick, nombre: number, v?: { pv?: number; vitesse?: number }) {
  const def = ENEMIES[ENEMY_BRICKS[brique]]
  return nombre * def.cout * (v?.pv ?? 1) * Math.pow(v?.vitesse ?? 1, 1.5)
}
export function concessionCost(c: Concession) {
  let cost = 0
  for (const v of c.vagues) for (const g of v.groupes) cost += groupCost(g.brique, g.nombre, g.variante)
  if (c.boss) cost += ENEMIES[E.COUVEUSE].cout * c.boss.pv
  return Math.round(cost)
}

// Un filtre de texte volontairement simple : insultes courantes, liens, publicité. (Une IA de modération viendra ensuite.)
const INTERDITS = ['connard', 'connasse', 'salope', 'enculé', 'encule', 'pute', 'nègre', 'negre', 'pédé', 'pede', 'bougnoule', 'youpin', 'nazi', 'hitler',
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'porn', 'sex']
export function textProblem(s: string): string | null {
  const t = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/https?:\/\/|www\.|\.(com|net|org|io|gg|fr)\b/.test(t)) return 'pas de lien ni d\'adresse web'
  for (const w of INTERDITS) {
    const n = w.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (new RegExp(`(^|[^a-z])${n}`).test(t)) return `mot refusé : « ${w} »`
  }
  return null
}

export interface Validation { ok: boolean; erreurs: string[]; cout: number; concession?: Concession }

/** Tout ce qui est vérifié avant la publication (sauf la passe des bots, faite par le serveur). */
export function validateConcession(input: unknown): Validation {
  const p = ConcessionSchema.safeParse(input)
  if (!p.success) return { ok: false, erreurs: p.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`), cout: 0 }
  const c = p.data
  const err: string[] = []
  const { largeur: W, hauteur: H } = c.taille
  const inside = (x: number, y: number, what: string) => { if (x < 1 || y < 1 || x > W - 2 || y > H - 2) err.push(`${what} : (${x}, ${y}) hors de la carte ${W}×${H}`) }
  inside(c.depart.x, c.depart.y, 'départ')
  c.murs.forEach((m, i) => { if (m.x + m.l > W - 1 || m.y + m.h > H - 1) err.push(`murs.${i} : dépasse de la carte`) })
  let total = 0
  c.vagues.forEach((v, i) => {
    let n = 0
    v.groupes.forEach((g, j) => { inside(g.x, g.y, `vagues.${i}.groupes.${j}`); n += g.nombre; if (Math.hypot(g.x - c.depart.x, g.y - c.depart.y) < 6) err.push(`vagues.${i}.groupes.${j} : trop près du départ (6 tuiles minimum)`) })
    if (n > LIMITS.ennemisParVague) err.push(`vagues.${i} : ${n} ennemis, ${LIMITS.ennemisParVague} au plus par vague`)
    total += n
  })
  if (c.boss) inside(c.boss.x, c.boss.y, 'boss')
  if (total > LIMITS.ennemisTotal) err.push(`${total} ennemis en tout, ${LIMITS.ennemisTotal} au plus`)
  const cout = concessionCost(c)
  if (cout > LIMITS.budgetPuissance) err.push(`budget de puissance dépassé : ${cout} pour ${LIMITS.budgetPuissance} au plus`)
  for (const [k, s] of [['nom', c.nom], ['description', c.description], ['textes.intro', c.textes.intro ?? ''], ['textes.victoire', c.textes.victoire ?? '']] as const) {
    const pb = textProblem(s); if (pb) err.push(`${k} : ${pb}`)
  }
  // le départ ne doit pas être dans un mur
  for (const m of c.murs) {
    if (c.depart.x >= m.x && c.depart.x < m.x + m.l && c.depart.y >= m.y && c.depart.y < m.y + m.h) err.push('départ : dans un mur')
  }
  return { ok: err.length === 0, erreurs: err, cout, concession: c }
}

/** La récompense découle de la difficulté mesurée par les bots, jamais du créateur. */
export function rewardFor(cout: number, mesure: { gagne: boolean; dureeS: number; degatsSubis: number }) {
  const difficulte = Math.min(2, (mesure.degatsSubis / 200) + (mesure.dureeS / 120))
  const base = cout * 0.35 * (0.5 + difficulte / 2)
  const ferraille = Math.round((mesure.gagne ? 1 : 0.6) * base)
  return { ferraille: Math.max(5, Math.min(150, ferraille)), xp: Math.max(10, Math.min(600, Math.round(ferraille * 3))), difficulte: Math.round(difficulte * 100) / 100 }
}

export const BRICK_CATALOG = {
  version: BRICKS_VERSION,
  ennemis: Object.fromEntries(Object.entries(ENEMY_BRICKS).map(([k, id]) => {
    const d = ENEMIES[id]
    return [k, { nom: d.nom, pv: d.pv, vitesse: d.vitesse, degats: d.degats, portee: d.portee, cout: d.cout }]
  })),
  boss: { couveuse_mineure: { nom: 'Couveuse mineure', pvBase: ENEMIES[E.COUVEUSE].pv, cout: ENEMIES[E.COUVEUSE].cout, note: 'cout multiplié par pv' } },
  murs: ['roche', 'metal', 'caisse', 'chair'],
  sols: ['roche', 'dalle', 'chair'],
  limites: LIMITS,
  regles: [
    'Des données seulement (ce schéma), jamais de code.',
    'Le budget de puissance limite ce que tu poses ; la récompense est calculée par le serveur après une passe de bots.',
    'Jamais de mort définitive dans une concession.',
    'Publication en direct : les joueurs déjà dedans finissent leur version, la nouvelle vaut à la prochaine entrée.',
    `Butin de concession plafonné à ${LIMITS.plafondJour} ferraille par joueur et par jour.`,
  ],
}

export function concessionJsonSchema() { return z.toJSONSchema(ConcessionSchema, { io: 'input' }) }
