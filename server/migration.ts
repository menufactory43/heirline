// Les migrations du monde : quand la carte change, les données des joueurs suivent sans casser les lignées.
// v1 → v2 (le continent) : la bande de 480 × 200 et son front en bandes disparaissent. Les soldats ne gardent
// pas de position (ils repartent toujours de Port-Ancre) ; les avant-postes plantés sur l'ancienne carte
// rentrent à l'atelier, sans perte de niveau ; l'ancien front est effacé (les ruches repartent de leur rayon
// de départ). Les identifiants des quêtes, des lieux et des PNJ n'ont pas changé : le reste ne bouge pas.
import { WORLD_VERSION } from '../shared/monde.ts'
import type { Db } from './db.ts'

export interface Rapport { de: number; vers: number; avantPostesRentres: number; frontEfface: boolean; comptes: number; soldats: number }

export function versionDuMonde(d: Db) {
  const v = Number(d.get('monde_version'))
  if (Number.isFinite(v) && v > 0) return v
  // une base sans numéro : version 1 si elle a déjà servi (comptes ou front enregistré), sinon neuve
  const comptes = (d.db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n
  return comptes || d.get('front') ? 1 : WORLD_VERSION
}

export function migrer(d: Db): Rapport | null {
  const de = versionDuMonde(d)
  if (de >= WORLD_VERSION) { if (!d.get('monde_version')) d.set('monde_version', String(WORLD_VERSION)); return null }
  const comptes = (d.db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n
  const soldats = (d.db.prepare('SELECT COUNT(*) AS n FROM soldiers').get() as { n: number }).n
  let avantPostesRentres = 0, frontEfface = false
  d.db.exec('BEGIN')
  try {
    if (de < 2) {
      const r = d.db.prepare("UPDATE robots SET state = 'atelier', ox = 0, oy = 0, ohp = 0, ountil = 0, carte = 'ossara' WHERE state = 'avant-poste'").run()
      avantPostesRentres = Number(r.changes)
      frontEfface = !!d.get('front')
      d.db.prepare("DELETE FROM kv WHERE key = 'front'").run()
      d.set('ruches', '')
    }
    d.set('monde_version', String(WORLD_VERSION))
    d.db.exec('COMMIT')
  } catch (e) { d.db.exec('ROLLBACK'); throw e }
  const rapport = { de, vers: WORLD_VERSION, avantPostesRentres, frontEfface, comptes, soldats }
  d.set('migration_' + WORLD_VERSION, JSON.stringify({ ...rapport, at: Date.now() }))
  return rapport
}

// ---------------------------------------------------------------------------------------------------------------
// La trame v1 → v2 (la campagne 1 en trois actes, docs/histoire.md § 6). Les identifiants des quêtes n'ont pas
// changé, sauf l'ancienne « La voix du Semeur » (des cœurs de données et Cantor) : c'est maintenant « Les
// journaux de bord » (acte 2), et « La voix du Semeur » est le premier pas de l'acte 3. Rien de fait n'est
// perdu : celui qui avait fini l'ancienne voix du Semeur a fini les journaux de bord (et le code de Lin, qui les
// précède), avec leurs textes gardés au journal ; celui qui l'avait en cours reprend les journaux de bord, avec
// ses cœurs. Le reste (nid, Tertre, Cantor) garde son état. Les lignées, les soldats et les robots ne bougent pas.
export const TRAME_VERSION = 2
export interface RapportTrame { de: number; vers: number; comptes: number; voixFinies: number; voixEnCours: number }

export function migrerTrame(d: Db): RapportTrame | null {
  const de = Number(d.get('trame_version') ?? 1)
  if (de >= TRAME_VERSION) return null
  const rows = d.db.prepare("SELECT account, id, etat, prog_json FROM quests WHERE id = 'voix_semeur'").all() as { account: string; id: string; etat: string; prog_json: string }[]
  let voixFinies = 0, voixEnCours = 0
  const etat = (acc: string, id: string) => (d.db.prepare('SELECT etat FROM quests WHERE account = ? AND id = ?').get(acc, id) as { etat: string } | undefined)?.etat
  d.db.exec('BEGIN')
  try {
    for (const r of rows) {
      d.dropQuest(r.account, 'voix_semeur')
      if (etat(r.account, 'le_code') !== 'fini') { d.setQuest(r.account, 'le_code', 'fini', [10, 3]); d.setFlag(r.account, 'lu_notes_lin', '1') }
      if (r.etat === 'fini') {
        voixFinies++
        d.setQuest(r.account, 'journaux_bord', 'fini', [3])
        for (const c of ['coeur_1', 'coeur_2', 'coeur_3']) d.setFlag(r.account, 'lu_' + c, '1')
      } else {
        voixEnCours++
        const prog = (() => { try { return JSON.parse(r.prog_json || '[]') as number[] } catch { return [] } })()
        if (!etat(r.account, 'journaux_bord')) d.setQuest(r.account, 'journaux_bord', 'en_cours', [Math.min(3, prog[0] ?? 0)])
      }
    }
    d.set('trame_version', String(TRAME_VERSION))
    d.db.exec('COMMIT')
  } catch (e) { d.db.exec('ROLLBACK'); throw e }
  const comptes = new Set(rows.map((r) => r.account)).size
  const rapport = { de, vers: TRAME_VERSION, comptes, voixFinies, voixEnCours }
  d.set('migration_trame_' + TRAME_VERSION, JSON.stringify({ ...rapport, at: Date.now() }))
  return rapport
}
