/** Hermes3D Desktop: a trusted Studio iframe, sidebar row and palette action. */
import { host, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useEffect, useState } from 'react'

const DEFAULT_URL = 'http://127.0.0.1:3000/office'
const STORAGE_KEY = 'studioUrl'
const linkStyle = { color: 'var(--ui-accent)', cursor: 'pointer', whiteSpace: 'nowrap' }

export function normalizeStudioUrl(value) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTP(S) Studio URL without credentials, query parameters or a fragment.')
  }
  if (url.pathname === '/') url.pathname = '/office'
  return url.href
}

function Hermes3DPage({ ctx }) {
  const [url, setUrl] = useState(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('loading')
  const [nonce, setNonce] = useState(0)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    let alive = true
    // Defer the storage call so both synchronous throws and Promise rejections are handled.
    Promise.resolve().then(() => ctx.storage.get(STORAGE_KEY)).then((saved) => {
      let restored = DEFAULT_URL
      if (saved) {
        try { restored = normalizeStudioUrl(saved) }
        catch { host.notify({ kind: 'error', message: 'Hermes3D: invalid saved URL; using the default.' }) }
      }
      if (alive) { setUrl(restored); setDraft(restored) }
    }).catch(() => {
      if (alive) {
        setUrl(DEFAULT_URL); setDraft(DEFAULT_URL)
        host.notify({ kind: 'error', message: 'Hermes3D: could not read saved settings; using the default.' })
      }
    })
    return () => { alive = false }
  }, [ctx])

  async function save() {
    if (saving) return
    let next
    try { next = normalizeStudioUrl(draft) }
    catch {
      host.notify({ kind: 'error', message: 'Hermes3D: enter a valid HTTP(S) URL without credentials, query parameters or a fragment.' })
      return
    }
    setSaving(true)
    try {
      await ctx.storage.set(STORAGE_KEY, next)
      setStatus('loading'); setUrl(next); setNonce(n => n + 1); setEditing(false)
    } catch {
      host.notify({ kind: 'error', message: 'Hermes3D: could not save the URL. Your current office is unchanged.' })
    } finally { setSaving(false) }
  }

  function reload() { setStatus('loading'); setNonce(n => n + 1) }
  async function openExternal() {
    try {
      if (!await ctx.os?.openExternal(url)) throw new Error('unavailable')
    } catch {
      host.notify({ kind: 'error', message: 'Hermes3D: could not open your browser. Copy the Studio URL from the toolbar.' })
    }
  }

  return jsxs('section', {
    'aria-label': 'Hermes3D Studio',
    style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
    children: [
      jsxs('div', {
        role: 'toolbar', 'aria-label': 'Studio controls',
        style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid var(--ui-stroke-secondary)' },
        children: [
          jsx('strong', { children: 'Hermes3D Studio' }),
          editing ? jsxs('form', {
            onSubmit: e => { e.preventDefault(); void save() },
            style: { display: 'flex', flex: '1 1 250px', gap: 8 },
            children: [
              jsx('input', {
                'aria-label': 'Studio URL', autoFocus: true, value: draft, disabled: saving,
                style: { minWidth: 0, flex: 1, color: 'inherit', background: 'transparent', border: '1px solid var(--ui-stroke-secondary)' },
                onChange: e => setDraft(e.target.value),
                onKeyDown: e => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false) } }
              }),
              jsx('button', { type: 'submit', disabled: saving, style: linkStyle, children: saving ? 'Saving…' : 'Save' }),
              jsx('button', { type: 'button', disabled: saving, style: linkStyle, onClick: () => setEditing(false), children: 'Cancel' })
            ]
          }) : jsxs('div', {
            style: { display: 'flex', flex: '1 1 200px', minWidth: 0, gap: 8 },
            children: [
              jsx('span', { title: url || '', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: url || 'Loading settings…' }),
              jsx('button', { style: linkStyle, disabled: !url, onClick: () => { setDraft(url); setEditing(true) }, children: 'Change URL' })
            ]
          }),
          jsx('button', { style: linkStyle, disabled: !url, onClick: reload, children: 'Reload' }),
          jsx('button', { style: linkStyle, disabled: !url, onClick: () => void openExternal(), children: 'Open in browser' }),
          jsx('button', { style: linkStyle, 'aria-expanded': help, onClick: () => setHelp(v => !v), children: 'Help' })
        ]
      }),
      jsx('div', { role: 'status', style: { padding: '4px 8px' }, children: status === 'loaded' ? 'Frame loaded — this does not verify the Studio gateway connection.' : status === 'slow' ? 'Studio is taking longer than expected. Check the server or use Help; loading can still finish.' : status === 'error' ? 'Studio could not be loaded. Check the URL and server, then Reload.' : 'Loading Studio…' }),
      help ? jsx('div', { style: { padding: 12 }, children: 'Run Hermes3D Studio separately and connect its Hermes backend. For remote gateways, localhost means the computer running Desktop, not the gateway. Embed only a Studio deployment you trust: this frame has scripts and storage access. The Studio must allow framing; open it in your browser to diagnose connection or framing errors.' }) : null,
      url ? jsx(OfficeFrame, { url, onStatus: setStatus }, `${url}:${nonce}`) : null
    ]
  })
}

function OfficeFrame({ url, onStatus }) {
  useEffect(() => {
    // Keep late loads possible; only mark still-loading frames slow, and clean up on unmount.
    const timer = setTimeout(() => onStatus(current => current === 'loading' ? 'slow' : current), 8000)
    return () => clearTimeout(timer)
  }, [onStatus])
  return jsx('iframe', {
    src: url, title: 'Hermes3D office', referrerPolicy: 'no-referrer',
    style: { minHeight: 0, width: '100%', flex: 1, border: 0 },
    allow: 'autoplay',
    onLoad: () => onStatus('loaded'), onError: () => onStatus('error')
  })
}

export default {
  id: 'hermes3d', name: 'Hermes3D',
  register(ctx) {
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: '/hermes3d' }, render: () => jsx(Hermes3DPage, { ctx }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: '/hermes3d', label: 'Hermes3D', codicon: 'rocket' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'hermes3d.open', label: 'Hermes3D: Open the 3D office', keywords: ['hermes3d', 'office', '3d', 'agents'], run: () => host.navigate('/hermes3d') } }
    ])
  }
}
