// Écrit docs/journaux.md depuis shared/journaux.ts (le texte en jeu fait foi) : npm run journaux
import { writeFileSync } from 'node:fs'
import { LECTURES, ENDROITS } from '../shared/journaux.ts'
import { QUESTS } from '../shared/quests.ts'

const TYPES: Record<string, string> = { journal: 'Journal', coeur: 'Cœur de données', stele: 'Stèle', plaque: 'Plaque', notes: 'Notes', voix: 'Voix', message: 'Message', objet: 'Objet' }
const ou = (id: string) => {
  const e = ENDROITS.filter((x) => x.lecture === id).map((x) => `${x.carte === 'ossara' ? 'Ossara' : 'épave de la Constance'} (${x.x}, ${x.y}), « ${x.label} »`)
  const q = QUESTS.filter((x) => x.recompense.lecture === id || x.objectifs.some((o) => (o.t === 'lire' && o.id === id) || (o.t === 'explorer' && o.lecture === id)))
  const c = id.startsWith('coeur_') ? ['en ramassant un cœur de données (dans l\'ordre : 1, 2, 3)'] : []
  return [...e, ...c, ...q.map((x) => `quête « ${x.nom} »`)].join(' ; ') || '—'
}
const md = `# Heirline — les textes à lire

Généré par \`npm run journaux\` depuis \`shared/journaux.ts\` (le texte du jeu, qui fait foi : ne pas modifier ce fichier à la main). Les textes
suivent la bible (\`docs/histoire.md\`). Un texte lu reste dans le journal de la lignée (drapeau \`lu_<id>\`) et se
relit depuis l'écran Journal. La stèle des saisons (place de Port-Ancre) et la porte scellée (passerelle) ont un
texte calculé par le serveur (\`server/ossara.ts\`).

${LECTURES.map((l) => `## ${l.titre}

*${TYPES[l.type]}* · \`${l.id}\`${l.source ? ` · ${l.source}` : ''}
Où : ${ou(l.id)}

${l.texte.split('\n').map((x) => (x ? '> ' + x : '>')).join('\n')}
`).join('\n')}
## Les endroits où l'on lit ou agit

| Endroit | Carte | Tuile | Bouton | Texte |
|---|---|---|---|---|
${ENDROITS.map((e) => `| \`${e.id}\` | ${e.carte} | ${e.x}, ${e.y} | ${e.label} | ${e.lecture ? '`' + e.lecture + '`' : 'calculé'}${e.objet ? ` (+ objet \`${e.objet}\`)` : ''} |`).join('\n')}
`
writeFileSync(new URL('../docs/journaux.md', import.meta.url), md)
console.log('docs/journaux.md :', LECTURES.length, 'textes,', ENDROITS.length, 'endroits')
