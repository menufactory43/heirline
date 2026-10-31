// Ce que les agents IA des joueurs peuvent faire : lire, et construire des concessions publiées en direct.
// Les mêmes fonctions servent l'API REST et le serveur MCP.
import { db, type Account } from './db.ts'
import { BRICK_CATALOG, concessionJsonSchema, validateConcession, rewardFor, LIMITS } from '../shared/bricks.ts'
import { measureConcession } from './measure.ts'
import { CLASSES, robotUpgradeCost, ROBOT } from '../shared/rules.ts'
import { matchMaker } from 'colyseus'
import { TILE, CITY, MAP_W, MAP_H, nightOf } from '../shared/consts.ts'
import { ZONES } from '../shared/map.ts'
import { RUCHES, FRONT } from '../shared/front.ts'
import { CARTES, PASSAGES, STATIONS, WORLD_VERSION } from '../shared/monde.ts'
import { LIEUX } from '../shared/regions/index.ts'
import { central } from './central.ts'
import { NPCS, NPC_BY_ID } from '../shared/npcs.ts'
import { QUESTS, questAvailable } from '../shared/quests.ts'
import { itemKey } from '../shared/items.ts'
import { tr, trx, lireCause, type Lang } from '../shared/i18n/index.ts'
import { ENEMIES } from '../shared/rules.ts'
import type { Secteur } from './rooms/Secteur.ts'

let secteur: Secteur | null = null
/** Les agents lisent le monde dans une langue (paramètre lang, anglais par défaut) : les noms, les textes des quêtes,
 *  les causes de mort sont traduits ; les noms des champs (le schéma de l'API) ne changent pas. */
export function langue(x: unknown): Lang { return x === 'fr' ? 'fr' : 'en' }
const nom = (l: Lang, k: string) => tr(l, k)
const morts = (l: Lang, rows: { killer: string }[]) => rows.map((r) => ({ ...r, killer: trx(l, lireCause(r.killer)) }))
export function setSecteur(s: Secteur) { secteur = s }

export function front(l: Lang = 'en') {
  const w = secteur?.world
  const c = central()
  return {
    explication: tr(l, 'srv.agent.front', { w: MAP_W, h: MAP_H, x0: CITY.x0, x1: CITY.x1, y0: CITY.y0, y1: CITY.y1, n: RUCHES.length, avance: FRONT.avance }),
    versionDuMonde: WORLD_VERSION,
    ruches: RUCHES.map((r, i) => ({ id: r.id, nom: nom(l, `lieu.${r.id}.nom`), centre: { x: r.x, y: r.y }, rayon: Math.round(c.rayons[i] * 10) / 10, rayonMin: r.rmin, rayonMax: r.rmax })),
    avantPostes: [...c.outposts.values()].map((o) => ({ famille: o.family, soldat: o.given, carte: o.carte, x: Math.round(o.x / TILE), y: Math.round(o.y / TILE), pv: o.hp, pvMax: o.maxHp, actif: Date.now() < o.until })),
    couveuse: w ? (w.state.bossPv ? tr(l, 'srv.agent.vivante', { pv: w.state.bossPv }) : tr(l, 'srv.agent.couveuse_dort_groupe')) : tr(l, 'srv.agent.inconnue'),
    soldatsEnLigne: w ? [...w.players.values()].filter((p) => !p.bot).length : 0,
    soldatsIA: w ? [...w.players.values()].filter((p) => p.bot).length : 0,
    mortsRecentes: morts(l, db().deaths(10) as { killer: string }[]),
  }
}

/** Le graphe du monde : cartes, copies ouvertes, passages, gares (et celles réparées par la lignée du compte). */
export async function cartes(a?: Account, l: Lang = 'en') {
  const salles = await matchMaker.query({})
  const flags = a ? db().flags(a.id) : {}
  return {
    versionDuMonde: WORLD_VERSION,
    cartes: Object.values(CARTES).map((c) => {
      const copies = salles.filter((r: any) => (r.name === 'secteur' || r.name === 'nid') && (r.metadata?.carte ?? 'ossara') === c.id)
      return { id: c.id, nom: nom(l, `carte.${c.id}.nom`), salon: c.salon, joueursParCopie: c.seuil, instanceDeGroupe: !!c.instance, copies: copies.map((r: any) => ({ id: r.roomId, joueurs: r.clients })) }
    }),
    passages: PASSAGES.map((p) => ({ id: p.id, nom: nom(l, `passage.${p.id}.nom`), carte: p.carte, x: p.x, y: p.y, vers: p.vers, arrivee: p.arrivee })),
    gares: STATIONS.map((s) => ({ id: s.id, nom: nom(l, `station.${s.id}.nom`), x: s.x, y: s.y, lieu: s.lieu, ouverte: !!s.ouverte || flags['st_' + s.id] === '1' })),
  }
}

export function me(a: Account, l: Lang = 'en') {
  const rob = db().robot(a.id)
  const s = db().livingSoldier(a.id)
  const live = secteur ? [...secteur.world.players.values()].find((p) => p.account === a.id) : undefined
  return {
    famille: a.family, ferraille: a.scrap,
    soldat: s ? { prenom: s.given, classe: nom(l, `classe.${s.cls}.nom`), niveau: live?.level ?? s.level, generation: s.generation, enLigne: !!live, position: live ? { x: Math.round(live.s.x / TILE), y: Math.round(live.s.y / TILE) } : null } : null,
    robot: { niveau: rob.level, etat: rob.state, prochainNiveau: rob.level < ROBOT.niveauMax ? robotUpgradeCost(rob.level) : null, avantPoste: rob.state === 'avant-poste' ? { x: Math.round(rob.ox / TILE), y: Math.round(rob.oy / TILE), actifJusqua: new Date(rob.ountil).toISOString() } : null },
    lignee: db().lineage(a.id).map((x) => ({ prenom: x.given, classe: nom(l, `classe.${x.cls}.nom`), niveau: x.level, generation: x.generation, vivant: !!x.alive, mort: x.death_json ? mort(l, JSON.parse(x.death_json)) : null })),
  }
}

function mort(l: Lang, d: { killer?: string }) { return d.killer ? { ...d, killer: trx(l, lireCause(d.killer)) } : d }

export function bricks() { return { ...BRICK_CATALOG, schema: concessionJsonSchema() } }

export function listConcessions() {
  return db().concessions().map((c) => ({ id: c.id, nom: c.name, version: c.version, createur: c.owner_family, parties: c.plays, recompense: JSON.parse(c.reward_json), maj: new Date(c.updated).toISOString() }))
}

export function getConcession(id: string) {
  const c = db().concession(id)
  if (!c) return null
  return { id: c.id, nom: c.name, version: c.version, createur: db().account(c.owner)?.family, parties: c.plays, recompense: JSON.parse(c.reward_json), contenu: JSON.parse(c.json), versions: db().versions(id) }
}

export function publish(a: Account, input: unknown, id?: string) {
  if (db().publicationsLastHour(a.id) >= LIMITS.publicationsParHeure) return { ok: false, erreurs: [`limite de ${LIMITS.publicationsParHeure} publications par heure atteinte`] }
  const v = validateConcession(input)
  if (!v.ok || !v.concession) return { ok: false, erreurs: v.erreurs, cout: v.cout }
  const mesure = measureConcession(v.concession)
  const recompense = rewardFor(v.cout, mesure)
  try {
    const r = db().publishConcession(a.id, id, v.concession.nom, JSON.stringify(v.concession), JSON.stringify(recompense))
    return { ok: true, id: r.id, version: r.version, enDirect: true, cout: v.cout, budget: LIMITS.budgetPuissance, passeDesBots: mesure, recompense, note: 'Publiée. Les joueurs déjà dedans finissent leur version ; la nouvelle vaut à la prochaine entrée (porte des concessions, à Port-Ancre).' }
  } catch (e: any) { return { ok: false, erreurs: [e.message] } }
}

export function rollback(a: Account, id: string, version: number) {
  const c = db().concession(id)
  if (!c) return { ok: false, erreurs: ['concession inconnue'] }
  if (c.owner !== a.id) return { ok: false, erreurs: ["cette concession appartient à quelqu'un d'autre"] }
  const old = db().concessionVersion(id, version)
  if (!old) return { ok: false, erreurs: [`version ${version} introuvable`] }
  const r = db().publishConcession(a.id, id, c.name, old.json, old.reward_json)
  return { ok: true, id, version: r.version, depuis: version, note: `La version ${version} est republiée comme version ${r.version}.` }
}

/** Le monde ouvert : régions, lieux, heure, temps, boss, les choix des lignées. */
export function monde(l: Lang = 'en') {
  const w = secteur?.world
  const m = w?.map.monde
  const heure = central().heure
  return {
    heure: `${Math.floor(heure)} h ${String(Math.floor((heure % 1) * 60)).padStart(2, '0')}`,
    nuit: nightOf(heure) > 0.5,
    meteo: tr(l, `srv.agent.meteo.${central().meteo}`),
    regions: ZONES.map((z) => ({ id: z.id, nom: nom(l, `region.${z.id}.nom`), centre: { x: z.centre[0], y: z.centre[1] }, niveaux: z.niveau })),
    lieux: LIEUX.map((x) => ({ id: x.id, nom: nom(l, `lieu.${x.id}.nom`), x: [x.x0, x.x1], y: [x.y0, x.y1], habite: !!x.habite })),
    pointsDInteret: (m?.pois ?? []).map((p) => ({ id: p.id, nom: tr(l, `lieu.${p.id}.nom`) === `lieu.${p.id}.nom` ? p.nom : tr(l, `lieu.${p.id}.nom`), x: Math.round(p.x / TILE), y: Math.round(p.y / TILE) })),
    batiments: (m?.batiments ?? []).filter((b) => b.lieu === 'port').map((b) => nom(l, `batiment.${b.id}.nom`)),
    engloutisseur: w?.state.boss2 ? tr(l, 'srv.agent.eveille', { pv: w.state.boss2 }) : tr(l, 'srv.agent.englou_dort', { x: Math.round((m?.boss?.x ?? 0) / TILE), y: Math.round((m?.boss?.y ?? 0) / TILE) }),
    couveuse: w ? (w.state.bossPv ? tr(l, 'srv.agent.vivante', { pv: w.state.bossPv }) : tr(l, 'srv.agent.couveuse_dort')) : tr(l, 'srv.agent.inconnue'),
    creaturesEnJeu: w ? w.enemies.size : 0,
    lesLigneesOntChoisi: { donnerHauteSeve: Number(db().get('choix_colonie') ?? 0), taireHauteSeve: Number(db().get('choix_fertiles') ?? 0) },
  }
}

/** Les quêtes du compte : en cours, finies, et celles qu'on peut prendre (avec qui les donne et où). */
export function quetes(a: Account, l: Lang = 'en') {
  const o = secteur?.ossara
  if (!o) return { erreur: tr(l, 'srv.agent.indisponible') }
  const s = o.state(a.id)
  const live = [...secteur!.world.players.values()].find((p) => p.account === a.id)
  const level = live?.level ?? db().livingSoldier(a.id)?.level ?? 1
  const dispo = QUESTS.filter((q) => questAvailable(q, s.done, new Set(s.active.keys()), level, s.flags)).map((q) => {
    const n = NPC_BY_ID[q.donneur]
    return { id: q.id, nom: nom(l, `quete.${q.id}.nom`), region: q.zone, niveau: q.niveau, principale: !!q.principale, donneur: nom(l, `pnj.${n.id}.nom`), ou: { x: n.poste[0], y: n.poste[1] } }
  })
  return { ...o.summary(a.id, l), disponibles: dispo, sac: live ? live.inv.map((it) => `${nom(l, itemKey(it))}${it.n > 1 ? ' ×' + it.n : ''}${it.r ? ' (' + nom(l, `rarete.${it.r}.nom`) + ')' : ''}`) : null, equipement: live ? Object.fromEntries(Object.entries(live.equip).map(([k, it]) => [k, `${nom(l, itemKey(it!))} — ${Object.entries(it!.s).filter(([, v]) => v).map(([sk, v]) => `+${v}${nom(l, `stat.${sk}`)}`).join(', ')}`])) : null }
}

/** Les habitants : où ils sont maintenant, ce qu'ils font, ce qu'ils vendent. */
export function pnj(lieu?: string, l: Lang = 'en') {
  const vie = secteur?.vie
  const acts = ['debout', 'marche', 'travaille', 'discute', 'dort', 'escorte', 'tire']
  return NPCS.filter((n) => !lieu || n.lieu === lieu).map((n) => {
    const ns = vie?.npcs.get(n.id)
    return { id: n.id, nom: nom(l, `pnj.${n.id}.nom`), titre: n.titre ? nom(l, `pnj.${n.id}.titre`) : null, lieu: n.lieu, boutique: n.boutique ?? null, position: ns ? { x: Math.round(ns.n.x / TILE), y: Math.round(ns.n.y / TILE) } : null, activite: ns ? acts[ns.n.act] : null, donne: QUESTS.filter((q) => q.donneur === n.id).map((q) => nom(l, `quete.${q.id}.nom`)) }
  })
}

export function bestiaire(l: Lang = 'en') {
  return Object.entries(ENEMIES).map(([k, d]) => ({ id: Number(k), nom: nom(l, `ennemi.${k}.nom`), famille: d.famille, paisible: !!d.passif, distance: !!d.tir, boss: !!d.boss }))
}
