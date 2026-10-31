// Le service central du monde : ce qui doit être le même dans toutes les copies d'une carte.
// Les ruches (le front), les avant-postes et leurs PV partagés, l'heure et le temps qu'il fait, les choix des
// lignées. Chaque salle (copie) lit cet état à chaque pas et lui envoie ses événements (mises à mort près
// d'une bordure, coups sur un avant-poste). Un seul processus aujourd'hui : un objet en mémoire, enregistré
// dans SQLite ; plus tard, le même contrat derrière Redis pour plusieurs processus.
import { msg, type Texte } from '../shared/i18n/index.ts'
import { DAY_S } from '../shared/consts.ts'
import { oublier, type Comptes } from '../shared/lecture.ts'
import { completerRayons, RAYONS_DEPART, stepRuches, pushFrontByKill, pushFrontAll, clampRayon } from '../shared/front.ts'
import type { CarteId } from '../shared/monde.ts'

export interface OutpostRec {
  id: string; account: string; family: string; given: string; level: number
  carte: CarteId; x: number; y: number; hp: number; maxHp: number; until: number
}

/** Où le service central lit et écrit (la base en jeu, rien dans les tests). */
export interface CentralStore {
  load(): { rayons?: number[]; heure?: number; outposts: OutpostRec[]; semeurVaincu?: number; glaneuseVaincue?: number }
  save(c: Central): void
  /** un avant-poste vient de tomber (une seule fois, quelle que soit la copie qui l'a achevé) */
  outpostDestroyed(rec: OutpostRec): void
}

export interface CentralListener {
  log?(t: Texte, color: string): void
}

export class Central {
  rayons: number[] = [...RAYONS_DEPART]
  heure = 9
  /** les victoires du raid contre le Semeur pendant cette campagne (tout le serveur) : elles comptent pour la fin */
  semeurVaincu = 0
  /** les victoires de l'assaut du Métier pendant la campagne 2 (tout le serveur) */
  glaneuseVaincue = 0
  /** la lecture de la Pépinière (campagne 2), partagée par les copies : morts des Hauts par source, oubliées en 10 min */
  lecture: Comptes = [0, 0, 0, 0]
  meteo = 0
  meteoT = 240
  outposts = new Map<string, OutpostRec>()
  listeners = new Set<CentralListener>()
  store: CentralStore | null
  timer: ReturnType<typeof setInterval> | null = null
  saveAcc = 0
  /** version des avant-postes : les copies se resynchronisent quand elle change */
  rev = 0

  constructor(store: CentralStore | null = null) {
    this.store = store
    if (store) {
      const d = store.load()
      { const r = completerRayons(d.rayons); if (r) this.rayons = r }
      if (Number.isFinite(d.heure)) this.heure = d.heure!
      if (Number.isFinite(d.semeurVaincu)) this.semeurVaincu = Math.max(0, d.semeurVaincu!)
      if (Number.isFinite(d.glaneuseVaincue)) this.glaneuseVaincue = Math.max(0, d.glaneuseVaincue!)
      for (const o of d.outposts) this.outposts.set(o.id, o)
    }
  }

  /** Le pas du monde partagé, une fois par seconde, quelles que soient les copies ouvertes. */
  start() { if (!this.timer) this.timer = setInterval(() => this.step(1), 1000) }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.store?.save(this) }

  step(dt: number) {
    this.heure = (this.heure + dt * 24 / DAY_S) % 24
    this.meteoT -= dt
    if (this.meteoT <= 0) {
      const r = Math.random()
      this.meteo = this.meteo !== 0 ? 0 : r < 0.5 ? 1 : 2
      this.meteoT = this.meteo === 0 ? 240 + Math.random() * 240 : 120 + Math.random() * 120
    }
    const now = Date.now()
    oublier(this.lecture, dt)
    stepRuches(this.rayons, dt, [...this.outposts.values()].filter((o) => o.carte === 'ossara').map((o) => ({ x: o.x, y: o.y, actif: now < o.until })))
    this.saveAcc += dt
    if (this.saveAcc >= 10) { this.saveAcc = 0; this.store?.save(this) }
  }

  // ------------------------------------------------------------------ le front
  /** Une créature d'ÉDEN tuée près d'une bordure : sa ruche recule, pour toutes les copies. */
  killNear(x: number, y: number) { return pushFrontByKill(this.rayons, x, y) }
  /** La Couveuse tombée : toutes les ruches reculent. */
  pushAll(tiles: number, campagne?: 1 | 2) { pushFrontAll(this.rayons, tiles, campagne) }

  // ------------------------------------------------------------------ les avant-postes
  addOutpost(o: OutpostRec) { this.outposts.set(o.id, o); this.rev++ }
  removeOutpost(id: string) { if (this.outposts.delete(id)) this.rev++ }
  /** Un coup sur un avant-poste, d'où qu'il vienne : les PV sont partagés. Rend les PV restants. */
  hitOutpost(id: string, n: number) {
    const o = this.outposts.get(id)
    if (!o) return 0
    if (Date.now() >= o.until) return o.hp
    o.hp = Math.max(0, o.hp - n)
    if (o.hp <= 0) {
      this.outposts.delete(id); this.rev++
      this.store?.outpostDestroyed(o)
      this.broadcast(msg('srv.annonce.avant_poste', { famille: o.family }), '#ff9b6b')
    }
    return o.hp
  }

  broadcast(t: Texte, color: string) { for (const l of this.listeners) l.log?.(t, color) }
}

let shared: Central | null = null
export function central() { return (shared ??= new Central()) }
export function setCentral(c: Central | null) { shared = c }
