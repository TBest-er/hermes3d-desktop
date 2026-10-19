import { chromium } from 'playwright'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { outputFiles } = await build({ entryPoints: ['tests/harness.jsx'], bundle: true, write: false, format: 'iife', alias: { '@hermes/plugin-sdk': './tests/sdk.mjs' } })
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/app.js' ? 'application/javascript' : 'text/html')
  res.end(req.url === '/app.js' ? outputFiles[0].text : '<style>body{font-family:sans-serif;margin:0}#root{height:calc(100vh - 40px)}</style><button id="menu">Hermes3D</button><button id="palette">Palette: Open office</button><button id="home">Home</button><main id="root"></main><script src="/app.js"></script>')
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-webgl'] })
const page = await browser.newPage()
const results = [], errors = []
page.on('pageerror', e => errors.push(e.message))
async function check(name, fn) { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name) }
async function edit(value) { await page.getByRole('button', { name: 'Change URL', exact: true }).click(); await page.getByRole('textbox', { name: 'Studio URL' }).fill(value) }
try {
  // Browser-local test preferences; do not modify Studio's saved server configuration.
  await page.addInitScript(() => {
    localStorage.setItem('hermes3d:onboarding:completed', 'true')
    localStorage.setItem('hermes-office-render-mode-v1', '2d')
  })
  await page.goto(origin)
  await check('Sidebar opens the office route', async () => { await page.locator('#menu').click(); await page.getByRole('toolbar').waitFor(); await page.locator('iframe').waitFor(); assert.equal(await page.locator('iframe').getAttribute('src'), 'http://127.0.0.1:3000/office') })
  await check('Live Studio renders inside the frame', async () => { await page.frameLocator('iframe').locator('body').waitFor({ timeout: 90000 }); await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Frame loaded'), { timeout: 90000 }); const text = await page.frameLocator('iframe').locator('body').innerText(); assert.ok(text.length > 20); console.log('STUDIO TEXT', text.slice(0, 900)) })
  await check('Loaded frame does not turn into a timeout failure', async () => { await page.waitForTimeout(8500); assert.match(await page.getByRole('status').innerText(), /^Frame loaded/) })
  await check('Malformed URL is rejected without changing the frame', async () => { await edit('https://'); await page.getByRole('button', { name: 'Save', exact: true }).click(); assert.ok(await page.evaluate(() => window.__notices.some(x => x.kind === 'error'))); assert.equal(await page.locator('iframe').getAttribute('src'), 'http://127.0.0.1:3000/office'); await page.getByRole('button', { name: 'Cancel', exact: true }).click() })
  await check('Save failure keeps settings and office unchanged', async () => { await page.evaluate(() => window.__saveFails = true); await edit('http://localhost:3000/office'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForFunction(() => window.__notices.some(x => x.message.includes('could not save'))); assert.equal(await page.locator('iframe').getAttribute('src'), 'http://127.0.0.1:3000/office'); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.evaluate(() => window.__saveFails = false) })
  await check('Keyboard Save normalizes and persists the URL', async () => { await edit('http://127.0.0.1:3000'); await page.getByRole('textbox', { name: 'Studio URL' }).press('Enter'); await page.waitForFunction(() => localStorage.getItem('studioUrl') === 'http://127.0.0.1:3000/office') })
  await check('Browser action uses the OS integration', async () => { await page.getByRole('button', { name: 'Open in browser', exact: true }).click(); assert.equal(await page.evaluate(() => window.__opened.at(-1)), 'http://127.0.0.1:3000/office') })
  await check('Failed browser action produces a visible notification', async () => { await page.evaluate(() => window.__openFails = true); await page.getByRole('button', { name: 'Open in browser', exact: true }).click(); await page.waitForFunction(() => window.__notices.some(x => x.message.includes('could not open'))) })
  await check('Palette navigation and remount restore settings', async () => { await page.locator('#home').click(); await page.getByText('Home', { exact: true }).last().waitFor(); await page.locator('#palette').click(); await page.locator('iframe').waitFor(); assert.equal(await page.locator('iframe').getAttribute('src'), 'http://127.0.0.1:3000/office') })
  await check('Escape cancels editing', async () => { await edit('not saved'); await page.getByRole('textbox', { name: 'Studio URL' }).press('Escape'); assert.equal(await page.getByRole('textbox').count(), 0) })
  await check('Slow network shows help and eventually recovers', async () => { await page.route('http://slow.test/**', async route => { await new Promise(r => setTimeout(r, 9200)); await route.fulfill({ contentType: 'text/html', body: '<p>Delayed test fixture</p>' }) }); await edit('http://slow.test/office'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.includes('longer than expected'), { timeout: 15000 }); await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Frame loaded'), { timeout: 10000 }); await edit('http://127.0.0.1:3000/office'); await page.getByRole('button', { name: 'Save', exact: true }).click() })
  await check('Corrupt persisted settings recover safely', async () => { await page.evaluate(() => localStorage.setItem('studioUrl', 'javascript:alert(1)')); await page.reload(); await page.locator('#menu').click(); await page.locator('iframe').waitFor(); assert.equal(await page.locator('iframe').getAttribute('src'), 'http://127.0.0.1:3000/office') })
  await check('Narrow viewport keeps toolbar within bounds', async () => { await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await page.setViewportSize({ width: 1440, height: 1000 }) })
  await check('Embedded Studio connects to the real backend', async () => {
    const frame = page.frameLocator('iframe')
    await frame.locator('[title^="Runtime:"][title$="(connected)"]').waitFor({ timeout: 35000 })
    assert.match(await frame.locator('body').innerText(), /HERMES-AGENT • CONNECTED/i)
    assert.match(await frame.locator('body').innerText(), /\b\d+ (working|idle)\b/i)
  })
  await check('Pixel office canvas becomes visible', async () => {
    await page.frameLocator('iframe').locator('canvas').waitFor({ state: 'visible', timeout: 45000 })
  })
  await page.waitForTimeout(3000)
  await mkdir('qa', { recursive: true })
  await page.screenshot({ path: 'qa/office.png', fullPage: true })
  await check('No uncaught plugin exceptions', async () => assert.deepEqual(errors, []))
} finally {
  await mkdir('qa', { recursive: true })
  await writeFile('qa/results.json', JSON.stringify({ results, errors, scope: 'Real Chromium, SDK host test double, live Hermes3D iframe. Not the user Electron window.' }, null, 2))
  await browser.close(); await new Promise(r => server.close(r))
}
