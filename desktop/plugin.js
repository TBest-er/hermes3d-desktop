/**
 * Hermes3D desktop plugin — a sidebar row + ⌘K command that opens the
 * Hermes3D 3D office inside the Hermes Desktop app.
 *
 * The office itself is the Hermes3D Studio web app (a separate Next.js
 * server, by default http://127.0.0.1:3000). This plugin embeds it in a
 * full page. Change the URL in the page toolbar; it persists per profile.
 */

import { host, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useCallback, useEffect, useRef, useState } from 'react'

const ID = 'hermes3d'
const DEFAULT_URL = 'http://127.0.0.1:3000'
const STORAGE_KEY = 'studioUrl'

function Hermes3DPage() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const [nonce, setNonce] = useState(0)
  const frameRef = useRef(null)

  // Restore the saved URL once on mount.
  useEffect(() => {
    let alive = true
    ctx_storageGet().then((saved) => {
      if (alive && typeof saved === 'string' && saved) {
        setUrl(saved)
        setDraft(saved)
      } else if (alive) {
        setDraft(DEFAULT_URL)
      }
    })
    return () => { alive = false }
  }, [])

  // If the frame has not reported a load event shortly after (re)mounting,
  // the Studio server is probably not running (or not reachable from the
  // machine running the app) — show a hint instead of a blank pane.
  useEffect(() => {
    setLoaded(false)
    setUnreachable(false)
    const timer = setTimeout(() => {
      if (!loaded) setUnreachable(true)
    }, 8000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce])

  const save = useCallback(() => {
    const next = draft.trim()
    if (!/^https?:\/\//i.test(next)) {
      host.notify({ kind: 'error', message: 'Hermes3D: URL must start with http:// or https://' })
      return
    }
    ctx_storageSet(next)
    setUrl(next)
    setEditing(false)
    setNonce((n) => n + 1)
  }, [draft])

  const bar =
    jsxs('div', {
      className:
        'flex items-center gap-2 border-b border-(--ui-stroke-secondary) px-3 py-1.5 text-xs text-(--ui-text-secondary)',
      children: [
        jsx('span', { className: 'font-medium text-foreground', children: 'Hermes3D Studio' }),
        editing
          ? jsxs('span', {
              className: 'flex flex-1 items-center gap-1',
              children: [
                jsx('input', {
                  autoFocus: true,
                  className:
                    'flex-1 rounded border border-(--ui-stroke-secondary) bg-transparent px-1.5 py-0.5 text-xs outline-none focus:border-(--ui-accent)',
                  value: draft,
                  onChange: (e) => setDraft(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') setEditing(false)
                  }
                }),
                jsx('button', { className: linkCls, onClick: save, children: 'save' })
              ]
            })
          : jsxs('span', {
              className: 'flex flex-1 items-center gap-1 truncate',
              children: [
                jsx('span', { className: 'truncate', children: url }),
                jsx('button', {
                  className: linkCls,
                  onClick: () => {
                    setDraft(url)
                    setEditing(true)
                  },
                  children: 'change'
                })
              ]
            }),
        jsx('button', {
          className: linkCls,
          onClick: () => setNonce((n) => n + 1),
          children: 'reload'
        }),
        jsx('button', {
          className: linkCls,
          onClick: () => void ctxOpenExternal(url),
          children: 'open in browser'
        })
      ]
    })

  return jsxs('div', {
    className: 'flex h-full min-h-0 flex-col',
    children: [
      bar,
      unreachable && !loaded
        ? jsxs('div', {
            className: 'flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-(--ui-text-secondary)',
            children: [
              jsx('div', { className: 'font-medium text-foreground', children: 'Hermes3D Studio is not responding' }),
              jsx('div', { children: `Could not reach ${url}. Is the Studio server running on this machine?` }),
              jsx('pre', { className: 'rounded border border-(--ui-stroke-secondary) px-3 py-2 text-xs', children: 'cd hermes3d && npm run dev' }),
              jsx('button', {
                className: linkCls,
                onClick: () => {
                  setUnreachable(false)
                  setNonce((n) => n + 1)
                },
                children: 'retry'
              })
            ]
          })
        : null,
      jsx('iframe', {
        key: `${url}#${nonce}`,
        ref: frameRef,
        src: url,
        title: 'Hermes3D office',
        className: 'min-h-0 w-full flex-1 border-0',
        allow: 'clipboard-read; clipboard-write; autoplay',
        onLoad: () => {
          setLoaded(true)
          setUnreachable(false)
        }
      })
    ]
  })
}

const linkCls =
  'cursor-pointer text-(--ui-accent) hover:underline whitespace-nowrap'

// Small helpers around ctx doors captured at register() time.
let _ctx = null
function ctx_storageGet() {
  return Promise.resolve(_ctx ? _ctx.storage.get(STORAGE_KEY) : null).catch(() => null)
}
function ctx_storageSet(v) {
  if (_ctx) void _ctx.storage.set(STORAGE_KEY, v).catch(() => {})
}
function ctxOpenExternal(url) {
  if (_ctx && _ctx.os) void _ctx.os.openExternal(url)
  else host.notify({ kind: 'info', message: `Open manually: ${url}` })
}

export default {
  id: ID,
  name: 'Hermes3D',
  register(ctx) {
    _ctx = ctx

    ctx.registerMany([
      // Full page hosting the office.
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: '/hermes3d' },
        render: () => jsx(Hermes3DPage, {})
      },
      // The menu button: a sidebar nav row (below Artifacts).
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        data: { path: '/hermes3d', label: 'Hermes3D', codicon: 'rocket' }
      },
      // And the same action in the command palette.
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'hermes3d.open',
          label: 'Hermes3D: Open the 3D office',
          keywords: ['hermes3d', 'office', '3d', 'agents'],
          run: () => host.navigate('/hermes3d')
        }
      }
    ])
  }
}
