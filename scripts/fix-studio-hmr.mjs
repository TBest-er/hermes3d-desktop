// Narrow compatibility fix for the inspected Studio/Next 16.1.7 custom server.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const original = 'const handleUpgrade = app.getUpgradeHandler();'
const replacement = 'const handleUpgrade = app.upgradeHandler ?? app.getUpgradeHandler();'

export function patchStudioServer(source, nextVersion) {
  if (nextVersion !== '16.1.7') throw new Error(`Unreviewed Next version: ${nextVersion}; refusing to patch.`)
  if (source.includes(replacement)) return source
  if (source.split(original).length !== 2) throw new Error('Expected exactly one known upgrade handler; refusing to patch.')
  // getUpgradeHandler() reaches NextNodeServer's no-op in this version.
  // The prepared custom server's router upgradeHandler handles webpack HMR.
  return source.replace(original, replacement)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = resolve(process.argv[2] || '')
  if (!process.argv[2]) throw new Error('Usage: node scripts/fix-studio-hmr.mjs /path/to/Hermes3D')
  const file = resolve(dir, 'server/index.js')
  const next = JSON.parse(await readFile(resolve(dir, 'node_modules/next/package.json'), 'utf8'))
  const before = await readFile(file, 'utf8')
  const after = patchStudioServer(before, next.version)
  if (after !== before) {
    await writeFile(`${file}.before-hermes3d-hmr`, before, { flag: 'wx' })
    await writeFile(file, after)
    console.log('Patched Studio HMR routing. Restart only the Studio server to apply; backup saved beside index.js.')
  } else console.log('Studio HMR fix already applied.')
}
