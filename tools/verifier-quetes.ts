// Les quêtes tiennent-elles debout ? Pour chaque quête : donneur et destinataire existent et se tiennent sur une case
// libre, prérequis existants et sans boucle, quête atteignable depuis le début (en suivant les prérequis et les deux
// voies des choix), objectifs faisables (habitant, lieu, texte, créature présente là où on l'envoie, objet qui
// s'obtient quelque part), niveau proche de celui de la région, récompense en rapport avec le niveau, traduction.
//   npx tsx tools/verifier-quetes.ts        (sortie : la liste des problèmes ; code 1 s'il y en a)
import { QUESTS, QUEST_BY_ID, type QuestDef } from '../shared/quests.ts'
import { NPC_BY_ID } from '../shared/npcs.ts'
import { ENEMIES, xpToNext } from '../shared/rules.ts'
import { BASES } from '../shared/items.ts'
import { LECTURE_BY_ID, ENDROIT_BY_ID } from '../shared/journaux.ts'
import { REGIONS, REGION_BY_ID, LIEU_BY_ID, regionIdAt } from '../shared/regions/index.ts'
import { carteMap } from '../shared/cartes/index.ts'
import { isSolidTile, T } from '../shared/map.ts'
import { trx } from '../shared/i18n/index.ts'

const pb: string[] = []
const couverts = { tuerLieu: 0, ramasserLieu: 0, niveau: 0 }
const ko = (q: QuestDef | null, m: string) => pb.push(`${q ? q.id : '—'} : ${m}`)
const ossara = carteMap('ossara'), constance = carteMap('constance')
const poisDe = (c: any) => (c.monde?.pois ?? []) as { id: string; x: number; y: number; r: number }[]
const tousPois = [...poisDe(ossara).map((p) => ({ ...p, carte: 'ossara' })), ...poisDe(constance).map((p) => ({ ...p, carte: 'constance' }))]
const libre = (m: any, x: number, y: number) => { const t = m.tiles[y * m.w + x]; return t !== undefined && !isSolidTile(t) && t !== T.MER }

// d'où vient un objet : les ressources à ramasser (par région), le butin des créatures, les cas à part
const NOEUD_OBJET: Record<string, string> = { herbe: 'herbe', champignon: 'champignon', pieces: 'piece', noyau: 'noyau', echantillon: 'echantillon' }
const BUTIN: Record<string, number[]> = { viande: [5, 13], peau: [7], piece: [10, 18, 27], champignon: [8], puce: [18], fil: [28], bouture: [20], spore: Object.keys(ENEMIES).map(Number).filter((k) => ENEMIES[k].famille === 'eden') }
const regionsDeObjet = (b: string) => new Set([
  ...REGIONS.filter((r) => r.noeuds.some(([t]) => NOEUD_OBJET[t] === b)).map((r) => r.id),
  ...REGIONS.filter((r) => r.camps.some(([kinds]) => kinds.some((k) => (BUTIN[b] ?? []).includes(k)))).map((r) => r.id),
])
const kindsDeRegion = (id: string) => new Set(REGION_BY_ID[id]?.camps.flatMap(([k]) => k) ?? [])
// un lieu d'objectif (« ou ») : une région, un lieu, un point d'intérêt, une carte
const regionDuLieu = (ou: string): string | null => {
  if (REGION_BY_ID[ou]) return ou
  const l = LIEU_BY_ID[ou]; if (l) return regionIdAt(Math.round((l.x0 + l.x1) / 2), Math.round((l.y0 + l.y1) / 2))
  const p = tousPois.find((x) => x.id === ou); if (p && p.carte === 'ossara') return regionIdAt(Math.round(p.x / 16), Math.round(p.y / 16))
  return null
}
const lieuConnu = (ou: string) => !!(REGION_BY_ID[ou] || LIEU_BY_ID[ou] || tousPois.some((p) => p.id === ou) || ENDROIT_BY_ID[ou] || ['nid', 'constance', 'antre', 'gueule', 'semeur', 'serre', 'serre_h', 'registre', 'registre_h', 'metier_raid'].includes(ou))

for (const q of QUESTS) {
  // habitants
  for (const [role, id] of [['donneur', q.donneur], ['destinataire', q.rendre]] as const) {
    const n = NPC_BY_ID[id]
    if (!n) { ko(q, `${role} « ${id} » n'existe pas`); continue }
    const m = n.lieu?.startsWith('constance') ? constance : ossara
    if (!libre(m, n.poste[0], n.poste[1])) ko(q, `${role} ${id} se tient dans un mur (${n.poste})`)
  }
  // prérequis
  for (const r of [...(q.requis ?? []), ...(q.requisUn ?? [])]) if (!QUEST_BY_ID[r]) ko(q, `prérequis « ${r} » inconnu`)
  // objectifs
  q.objectifs.forEach((o, i) => {
    const k = `objectif ${i + 1} (${o.t})`
    if (o.t === 'parler' || o.t === 'escorte') { if (!NPC_BY_ID[o.npc]) ko(q, `${k} : habitant « ${o.npc} » inconnu`) }
    if (o.t === 'escorte' && !lieuConnu(o.vers)) ko(q, `${k} : destination « ${o.vers} » inconnue`)
    if (o.t === 'explorer' && !tousPois.some((p) => p.id === o.lieu)) ko(q, `${k} : lieu « ${o.lieu} » absent des points d'intérêt des cartes (l'objectif ne peut pas s'accomplir)`)
    if (o.t === 'explorer' && o.lecture && !LECTURE_BY_ID[o.lecture]) ko(q, `${k} : texte « ${o.lecture} » inconnu`)
    if (o.t === 'lire' && !LECTURE_BY_ID[o.id]) ko(q, `${k} : texte « ${o.id} » inconnu`)
    if ((o.t === 'lire' || o.t === 'tuer' || o.t === 'ramasser') && o.ou && !lieuConnu(o.ou)) ko(q, `${k} : lieu « ${o.ou} » inconnu`)
    if (o.t === 'tuer') {
      for (const kd of o.kinds ?? []) if (!ENEMIES[kd]) ko(q, `${k} : créature ${kd} inconnue`)
      const reg = o.ou ? regionDuLieu(o.ou) : null
      if (reg) couverts.tuerLieu++
      if (reg && o.kinds?.length && !o.kinds.some((kd) => kindsDeRegion(reg).has(kd)) && !o.kinds.some((kd) => ENEMIES[kd].boss)) ko(q, `${k} : aucune des créatures demandées (${o.kinds.map((kd) => ENEMIES[kd].nom).join(', ')}) ne vit dans « ${o.ou} » (région ${reg})`)
    }
    if (o.t === 'ramasser') {
      if (!BASES[o.b]) { ko(q, `${k} : objet « ${o.b} » inconnu`); return }
      const sources = regionsDeObjet(o.b)
      const special = ['cassette', 'tamagoyle_casse', 'tamagoyle', 'noyau', 'echantillon'].includes(o.b)
      if (!sources.size && !special) ko(q, `${k} : « ${o.b} » ne s'obtient nulle part (ni ressource ni butin)`)
      const reg = o.ou ? regionDuLieu(o.ou) : null
      if (reg) couverts.ramasserLieu++
      if (reg && sources.size && !sources.has(reg)) ko(q, `${k} : « ${o.b} » ne s'obtient pas dans « ${o.ou} » (région ${reg}) ; on le trouve dans : ${[...sources].join(', ')}`)
    }
  })
  // niveau : dans la fourchette de la région où la quête envoie (à 2 près)
  const zr = REGION_BY_ID[q.zone]
  if (zr) { couverts.niveau++; if (q.niveau < zr.niveau[0] - 2 || q.niveau > zr.niveau[1] + 2) ko(q, `niveau ${q.niveau} hors de la région ${zr.nom} (${zr.niveau.join('–')})`) }
  // récompense : entre 15 % et 120 % du niveau suivant (jusqu'à 150 % aux deux premiers niveaux : les premières quêtes font monter)
  const besoin = xpToNext(q.niveau), plafond = q.niveau <= 2 ? 1.5 : 1.2
  if (q.recompense.xp < besoin * 0.15 || q.recompense.xp > besoin * plafond) ko(q, `récompense ${q.recompense.xp} XP pour un niveau ${q.niveau} (il faut ${besoin} XP pour monter)`)
  // traduction
  for (const l of ['fr', 'en'] as const) {
    const nom = trx(l, { k: `quete.${q.id}.nom` } as any)
    if (!nom || nom.startsWith('quete.')) ko(q, `pas de nom en ${l}`)
  }
}

// atteignable : on part de rien et on fait toutes les quêtes possibles, en boucle
const faites = new Set<string>()
for (let tour = 0; tour < QUESTS.length + 2; tour++) {
  for (const q of QUESTS) {
    if (faites.has(q.id)) continue
    if ((q.requis ?? []).every((r) => faites.has(r)) && (!q.requisUn?.length || q.requisUn.some((r) => faites.has(r)))) faites.add(q.id)
  }
}
for (const q of QUESTS) if (!faites.has(q.id)) ko(q, `jamais atteignable (prérequis : ${[...(q.requis ?? []), ...(q.requisUn ?? [])].join(', ')})`)
// la trame : les actes ne reculent pas le long des prérequis
for (const q of QUESTS) for (const r of q.requis ?? []) { const p = QUEST_BY_ID[r]; if (p?.acte && q.acte && (p.campagne ?? 1) === (q.campagne ?? 1) && p.acte > q.acte) ko(q, `acte ${q.acte} qui demande une quête de l'acte ${p.acte} (${r})`) }

console.log(`${QUESTS.length} quêtes, ${QUESTS.filter((q) => q.principale).length} de la trame ; contrôlés par lieu : ${couverts.tuerLieu} chasses, ${couverts.ramasserLieu} collectes, ${couverts.niveau} niveaux ; ${pb.length} problème(s)`)
for (const l of pb) console.log(' - ' + l)
process.exit(pb.length ? 1 : 0)
