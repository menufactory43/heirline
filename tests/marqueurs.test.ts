// Les marqueurs de quête au-dessus des PNJ : ! jaune à prendre, ? gris en cours, ? jaune à rendre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { questMarkFor, MARK_STYLE, QUEST_BY_ID } from '../shared/quests.ts'

const q = QUEST_BY_ID['ce_qui_pousse']
const plein = q.objectifs.map((o) => ('n' in o ? (o as any).n : 1))
const vide = q.objectifs.map(() => 0)

test('quête disponible : ! jaune chez le donneur', () => {
  assert.equal(questMarkFor('ysolde', [], [], 1, {}), 'dispo')
  assert.deepEqual(MARK_STYLE.dispo, { g: '!', c: '#ffd23a' })
})

test('quête prise, objectifs pas finis : ? gris chez celui à qui la rendre', () => {
  assert.equal(questMarkFor('agathe', [{ id: 'ce_qui_pousse', prog: vide }], ['matricule', 'fougere_sang'], 2, {}), 'encours') // Agathe n'a plus rien à donner
  assert.equal(MARK_STYLE.encours.g, '?')
  assert.equal(MARK_STYLE.encours.c, '#9aa3ad')
})

test('objectifs finis : ? jaune, et ça passe avant une quête à prendre', () => {
  assert.equal(questMarkFor('agathe', [{ id: 'ce_qui_pousse', prog: plein }], ['matricule'], 2, {}), 'rendre')
  assert.equal(MARK_STYLE.rendre.c, '#ffd23a')
})

test('rien à faire avec ce PNJ : pas de marqueur', () => {
  assert.equal(questMarkFor('ysolde', [{ id: 'ce_qui_pousse', prog: vide }], ['matricule'], 2, {}), null)
})
