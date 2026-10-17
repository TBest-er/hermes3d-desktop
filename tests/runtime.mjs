import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = new Set(), sockets = []
page.on('console', message => { if (message.type() === 'error') errors.add(message.text().replace(/token=[^&\s]+/g, 'token=REDACTED')) })
page.on('pageerror', error => errors.add(error.message))
page.on('websocket', socket => { if (socket.url().includes('/api/gateway/ws')) socket.on('socketerror', error => sockets.push(error)) })
try {
  await page.addInitScript(() => localStorage.setItem('hermes3d:onboarding:completed', 'true'))
  await page.goto('http://127.0.0.1:3000/office')
  await page.waitForTimeout(35000)
  const connected = await page.locator('[title]').evaluateAll(nodes => nodes.some(n => /^Runtime:.*\(connected\)$/.test(n.title)))
  const text = await page.locator('body').innerText()
  const result = { connected, consoleErrors: [...errors], socketErrors: sockets, timedOut: text.includes('Timed out connecting'), scope: 'Isolated Chromium, live Studio and live backend; no chat or agent writes.' }
  await mkdir('qa', { recursive: true })
  await writeFile('qa/runtime-results.json', JSON.stringify(result, null, 2))
  await page.screenshot({ path: 'qa/runtime.png' })
  console.log(JSON.stringify(result, null, 2))
  if (!connected || errors.size) process.exitCode = 1
} finally { await browser.close() }
