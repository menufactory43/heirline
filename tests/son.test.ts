// Le son : chaque bruitage, ambiance ou musique demandé par le code existe dans le manifeste, et chaque fichier du
// manifeste existe ; les boucles de musique ont un début avant leur fin ; chaque classe, à chaque niveau, a son tir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import MAN from '../client/src/son-manifest.json' with { type: 'json' }
import { PARAMS } from '../shared/talents.ts'
import { CLASS_IDS } from '../shared/rules.ts'

const CLASSE_SON: Record<string, string> = { fantassin: 'fan', medic: 'med', ingenieur: 'ing' }
const tous = new Set([...Object.keys(MAN.sfx), ...Object.keys(MAN.amb), ...Object.keys(MAN.mus)])

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? fichiers(p) : p.endsWith('.ts') ? [p] : [] })
}

/** les arguments d'un appel qui commence à i (juste après la parenthèse), séparés au premier niveau */
function args(src: string, i: number): string[] {
  const out: string[] = []
  let prof = 0, deb = i, quote = ''
  for (let k = i; k < src.length; k++) {
    const c = src[k]
    if (quote) { if (c === quote && src[k - 1] !== '\\') quote = ''; continue }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if ('([{'.includes(c)) prof++
    else if (')]}'.includes(c)) { if (prof === 0) { out.push(src.slice(deb, k)); return out } prof-- }
    else if (c === ',' && prof === 0) { out.push(src.slice(deb, k)); deb = k + 1 }
  }
  return out
}

test('chaque son demandé par le client existe dans le manifeste', () => {
  const manque: string[] = []
  // l'argument qui nomme le son : le premier (joue, musique, jingle, ambiance, emit('son', …) : le deuxième), le
  // deuxième pour une couche (le premier est sa clé)
  const appels: [RegExp, number][] = [[/son\.(?:joue|musique|jingle|ambiance)\(/g, 0], [/son\.couche\(/g, 1], [/emit\('son',\s*/g, -1]]
  for (const f of fichiers('client/src')) {
    const src = readFileSync(f, 'utf8')
    for (const [re, n] of appels) for (const m of src.matchAll(re)) {
      const a = n < 0 ? [src.slice(m.index! + m[0].length).match(/^[^,)]*/)![0]] : args(src, m.index! + m[0].length)
      const arg = a[Math.max(0, n)] ?? ''
      // les noms en résultat (pas ceux d'une condition : === 'machine', contains('danger'))
      for (const l of arg.matchAll(/(?<!(?:===|!==|\()\s*)'([a-z][a-z0-9_]*)'/g)) if (!tous.has(l[1])) manque.push(`${f} : ${l[1]}`)
    }
  }
  assert.deepEqual(manque, [])
})

test('les sons construits par le code (tirs, butin, régions, compétences) existent', () => {
  const src = readFileSync('client/src/son-jeu.ts', 'utf8')
  const manque: string[] = []
  // chaque classe a son tir, en version de base et en version chargée (palier 3 et plus)
  for (const cls of CLASS_IDS) for (const v of [1, 2]) {
    const id = `tir_${CLASSE_SON[cls] ?? 'fan'}_${v}`
    if (!(id in MAN.sfx)) manque.push(id)
  }
  for (let r = 0; r <= 3; r++) if (!(`butin_${r}` in MAN.sfx)) manque.push(`butin_${r}`)
  // les tables du fichier : régions (musique, ambiance) et compétences
  const regions = src.slice(src.indexOf('const REGION'), src.indexOf('}', src.indexOf('const REGION')))
  for (const m of regions.matchAll(/\[\s*'(\w+)',\s*'(\w+)'\s*\]/g)) { if (!(m[1] in MAN.mus)) manque.push(m[1]); if (!(m[2] in MAN.amb)) manque.push(m[2]) }
  const sk = src.match(/const SON_COMP[^{]*\{([^}]*)\}/)?.[1] ?? ''
  for (const m of sk.matchAll(/:\s*'(\w+)'/g)) if (!(m[1] in MAN.sfx)) manque.push(m[1])
  assert.ok(sk.length > 0, 'la table des compétences est introuvable')
  // chaque compétence du jeu a son bruitage dans la table
  for (const id of Object.keys(PARAMS)) if (!new RegExp(`\\b${id}:`).test(sk)) manque.push('compétence ' + id)
  assert.deepEqual(manque, [])
})

test('chaque fichier du manifeste existe, et pèse quelque chose', () => {
  const absents: string[] = []
  const tousF = [...Object.values(MAN.sfx).flatMap((s: any) => s.f), ...Object.values(MAN.amb).map((a: any) => a.f), ...Object.values(MAN.mus).map((m: any) => m.f)]
  for (const f of tousF) { const p = join('client/public', f); if (!existsSync(p) || statSync(p).size < 500) absents.push(f) }
  assert.deepEqual(absents, [])
  assert.ok(Object.keys(MAN.sfx).length >= 60, 'au moins 60 bruitages')
})

test('les boucles de musique tiennent debout', () => {
  for (const [id, m] of Object.entries(MAN.mus as Record<string, { debut?: number; fin?: number }>)) {
    if (m.fin === undefined) continue
    assert.ok((m.debut ?? 0) < m.fin - 20, `${id} : boucle trop courte (${m.debut} → ${m.fin})`)
  }
})
