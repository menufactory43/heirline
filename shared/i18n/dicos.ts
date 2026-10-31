// Les deux dictionnaires, aplatis (clé → texte), construits une fois à la première traduction.
import { aplatir } from './forme.ts'
import { frUi } from './fr/ui.ts'
import { frSrv } from './fr/srv.ts'
import { enUi } from './en/ui.ts'
import { enSrv } from './en/srv.ts'
import { frQuetes, enQuetes } from './contenu/quetes.ts'
import { frLectures, enLectures, frEndroits, enEndroits } from './contenu/lectures.ts'
import { frPnj, enPnj } from './contenu/pnj.ts'
import { frLieux, enLieux } from './contenu/lieux.ts'
import { frObjets, enObjets } from './contenu/objets.ts'
import { frRegles, enRegles } from './contenu/regles.ts'
import { frTalents, enTalents } from './contenu/talents.ts'

/** les textes du jeu (interface, serveur) : même forme dans les deux langues */
export const textesFr = () => ({ ui: frUi, srv: frSrv })
export const textesEn = () => ({ ui: enUi, srv: enSrv })
/** le contenu : en français depuis les fiches, en anglais depuis contenu/*.ts */
export const contenuFr = () => fusion({ quete: frQuetes(), lecture: frLectures(), endroit: frEndroits(), ...frPnj(), ...frLieux(), ...frObjets() }, frRegles(), frTalents())
export const contenuEn = () => fusion({ quete: enQuetes, lecture: enLectures, endroit: enEndroits, ...enPnj, ...enLieux, ...enObjets }, enRegles, enTalents)
/** plusieurs fichiers de contenu peuvent remplir la même branche (competence : classes et spécialités) */
function fusion(...l: Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, any> = {}
  for (const o of l) for (const [k, v] of Object.entries(o)) out[k] = out[k] && typeof out[k] === 'object' && typeof v === 'object' && !Array.isArray(v) ? { ...out[k], ...(v as object) } : v
  return out
}

let fr: Record<string, string> | null = null, en: Record<string, string> | null = null
export function FR() { return (fr ??= aplatir({ ...textesFr(), ...contenuFr() })) }
export function EN() { return (en ??= aplatir({ ...textesEn(), ...contenuEn() })) }
