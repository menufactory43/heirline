// Les chaînes de quêtes tiennent debout : tools/verifier-quetes.ts (habitants, prérequis, objectifs faisables là où on
// envoie le joueur, niveaux de région, récompenses, traductions) ne trouve rien.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('vérificateur des quêtes : aucun problème', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'tools/verifier-quetes.ts'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})
