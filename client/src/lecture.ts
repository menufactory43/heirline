// L'écran de lecture : un journal, un cœur de données, une stèle, une plaque. Un écran simple, en papier et en
// encre, posé dans la boîte des écrans (ui.showScreen). Le fond et la police selon le type de texte : style.css, .lecture.t-<type>.
import { LECTURES } from '../../shared/journaux.ts'
import { esc, entete } from './ui.ts'
import { t, tx, type Texte } from '../../shared/i18n/index.ts'
import { ico } from './icones.ts'

export interface LectureMsg { id: string; titre: Texte; source?: Texte; texte: Texte; auto?: boolean }

export function lectureHtml(m: LectureMsg) {
  const type = LECTURES.find((l) => l.id === m.id)?.type ?? 'autre'
  const corps = tx(m.texte).split(/\n\n+/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
  return `${entete(esc(tx(m.titre)), 'journal')}
    <div class="lecture t-${type}">
      ${m.source ? `<div class="source">${esc(tx(m.source))}</div>` : ''}
      ${corps}
    </div>
    <div class="rangee lecture-boutons">
      <button data-a="journal">${ico('journal', 'ico p')} ${t('ui.journal.titre')}</button>
      <button data-a="fermer">${t('ui.fermer')}</button>
    </div>`
}

/** Les textes déjà lus par la lignée, pour les relire depuis le journal. */
export function lecturesHtml(flags: Record<string, string>) {
  const lus = LECTURES.filter((l) => flags['lu_' + l.id] === '1')
  if (!lus.length) return ''
  return `<h3 id="lectures">${t('ui.lecture.titre')} <small class="doux">${lus.length} / ${LECTURES.length}</small></h3><div class="dispo">${lus.map((l) => `<button class="recompense" data-a="relire" data-id="${l.id}">${ico('journal', 'ico p')}${esc(t(`lecture.${l.id}.titre`))}</button>`).join('')}</div>`

}
