import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { patchStudioServer } from '../scripts/fix-studio-hmr.mjs'
const source = 'const handleUpgrade = app.getUpgradeHandler(); handleUpgrade();'
test('Studio uses the prepared router handler rather than the no-op server handler', () => {
  const calls = []
  vm.runInNewContext(patchStudioServer(source, '16.1.7'), { app: { upgradeHandler: () => calls.push('HMR'), getUpgradeHandler: () => () => calls.push('no-op') } })
  assert.deepEqual(calls, ['HMR'])
})
test('HMR patch is idempotent', () => { const once = patchStudioServer(source, '16.1.7'); assert.equal(patchStudioServer(once, '16.1.7'), once) })
test('HMR patch refuses unreviewed Next versions', () => assert.throws(() => patchStudioServer(source, '17.0.0'), /Unreviewed/))
test('HMR patch refuses changed server source', () => assert.throws(() => patchStudioServer('other code', '16.1.7'), /exactly one/))
