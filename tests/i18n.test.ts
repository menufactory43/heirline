// Les deux langues : rien ne manque en anglais, les paramètres sont les mêmes, les clés utilisées existent, et il ne
// reste pas de texte français en dur dans le client (détection par accents et petits mots français), ni de texte
// envoyé par le serveur à la place d'une clé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FR, EN } from '../shared/i18n/dicos.ts'
import { tr } from '../shared/i18n/index.ts'

const params = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]))].sort()

test('chaque clé française a sa traduction anglaise, et inversement', () => {
  const fr = FR(), en = EN()
  const manque = Object.keys(fr).filter((k) => !(k in en) || !en[k].trim())
  const enTrop = Object.keys(en).filter((k) => !(k in fr))
  assert.deepEqual(manque, [], `manquent en anglais : ${manque.slice(0, 30).join(', ')}${manque.length > 30 ? ` … (${manque.length})` : ''}`)
  assert.deepEqual(enTrop, [], `clés anglaises sans français : ${enTrop.slice(0, 30).join(', ')}`)
})

test('mêmes paramètres et mêmes pluriels dans les deux langues', () => {
  const fr = FR(), en = EN(), faux: string[] = []
  for (const k of Object.keys(fr)) {
    if (!(k in en)) continue
    if (params(fr[k]).join() !== params(en[k]).join()) faux.push(`${k} : {${params(fr[k])}} / {${params(en[k])}}`)
    if (fr[k].includes('|') !== en[k].includes('|')) faux.push(`${k} : pluriel`)
  }
  assert.deepEqual(faux, [])
})

test('interpolation, pluriels et références', () => {
  assert.equal(tr('fr', 'station.st_col.nom'), 'Halte du Col')
  assert.notEqual(tr('en', 'station.st_col.nom'), 'Halte du Col')
  assert.equal(tr('en', 'cle.inconnue'), 'cle.inconnue')
})

function fichiers(dir: string, ext = /\.ts$/): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? fichiers(p, ext) : ext.test(f) ? [p] : [] })
}
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

test('les clés écrites dans le code existent', () => {
  const fr = FR(), absentes: string[] = []
  for (const f of [...fichiers('client/src'), ...fichiers('server'), ...fichiers('shared')]) {
    if (f.includes('i18n')) continue
    const s = sansCommentaires(readFileSync(f, 'utf8'))
    for (const m of s.matchAll(/\b(?:t|tr|msg|ref)\(\s*(?:[a-z]+\s*,\s*)?'([a-zA-Z0-9_.]+)'/g)) if (!(m[1] in fr)) absentes.push(`${f} : ${m[1]}`)
  }
  assert.deepEqual(absentes, [])
})

// mots français courts qui ne trompent pas (entourés d'espaces ou en début de chaîne)
const MOTS = /(^|\s)(le|la|les|des|du|une|un|pas|est|et|ton|ta|tes|ou|pour|avec|sans|dans|sur|il|elle|on|tu|vous|nous|au|aux|qui|que|plus|déjà)(\s|$)/i
const ACCENTS = /[éèêàâùûçôîïëœÉÈÀÇ]/
/** Une chaîne affichée en dur ? Les sélecteurs, couleurs, clés, noms de textures ne comptent pas. */
function francais(s: string) {
  if (!/[a-zA-Zé]{2}/.test(s)) return false
  return ACCENTS.test(s) || (/\s/.test(s.trim()) && MOTS.test(s))
}

test('plus de texte français en dur dans le client (hors i18n)', () => {
  const trouves: string[] = []
  for (const f of [...fichiers('client/src'), 'client/index.html']) {
    const brut = readFileSync(f, 'utf8')
    const s = f.endsWith('.html') ? brut.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '\n') : sansCommentaires(brut)
    s.split('\n').forEach((ligne, i) => {
      if (ligne.includes('i18n-ok')) return
      const morceaux = f.endsWith('.html') ? [ligne] : [...ligne.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' '))
      for (const x of morceaux) if (francais(x.replace(/<[^>]*>/g, ' '))) trouves.push(`${f}:${i + 1} ${x.trim().slice(0, 70)}`)
    })
  }
  assert.deepEqual(trouves, [], `${trouves.length} chaînes :\n${trouves.slice(0, 40).join('\n')}`)
})

test('le serveur envoie des clés, pas du texte', () => {
  const trouves: string[] = []
  for (const f of fichiers('server')) {
    const s = sansCommentaires(readFileSync(f, 'utf8'))
    s.split('\n').forEach((l, i) => { if (/\btext:\s*['"`]/.test(l) || /hooks\.log\(\s*['"`]/.test(l)) trouves.push(`${f}:${i + 1}`) })
  }
  assert.deepEqual(trouves, [], trouves.slice(0, 30).join('\n'))
})
