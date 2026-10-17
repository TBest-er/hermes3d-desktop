import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const { outputFiles } = await build({ entryPoints: ['desktop/plugin.js'], bundle: true, write: false, platform: 'node', format: 'esm', alias: { '@hermes/plugin-sdk': './tests/sdk.mjs' } })
const plugin = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
test('registers the office route, sidebar and palette', () => {
  let entries
  plugin.default.register({ registerMany: (items) => { entries = items } })
  assert.equal(entries.length, 3)
  assert.equal(entries.find(x => x.area === 'routes').data.path, '/hermes3d')
  assert.equal(entries.find(x => x.area === 'sidebar').data.path, '/hermes3d')
})
test('exports URL validation', () => assert.equal(typeof plugin.normalizeStudioUrl, 'function'))
for (const value of ['javascript:alert(1)', 'https://', 'http://user:password@localhost:3000', 'file:///etc/passwd', 'https://example.com/?token=secret']) {
  test(`rejects unsafe or malformed URL: ${value}`, () => assert.throws(() => plugin.normalizeStudioUrl(value)))
}
test('normalizes bare Studio origin directly to office', () => assert.equal(plugin.normalizeStudioUrl(' http://127.0.0.1:3000 '), 'http://127.0.0.1:3000/office'))
test('preserves custom deployment paths', () => assert.equal(plugin.normalizeStudioUrl('https://office.example.com/studio/office'), 'https://office.example.com/studio/office'))
