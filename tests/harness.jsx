import React from 'react'
import { createRoot } from 'react-dom/client'
import plugin from '../desktop/plugin.js'
window.__notices = []
window.__opened = []
const entries = []
const ctx = {
  registerMany(items) { entries.push(...items) },
  storage: {
    get(key) { if (window.__readFails) throw Error('read failed'); return localStorage.getItem(key) },
    set(key, value) { if (window.__saveFails) throw Error('save failed'); localStorage.setItem(key, value) }
  },
  os: { async openExternal(url) { window.__opened.push(url); return !window.__openFails } }
}
plugin.register(ctx)
const root = createRoot(document.getElementById('root'))
window.__navigate = (path) => {
  const page = entries.find(x => x.area === 'routes' && x.data.path === path)
  root.render(page ? page.render() : React.createElement('div', null, 'Home'))
}
const nav = entries.find(x => x.area === 'sidebar')
document.getElementById('menu').textContent = nav.data.label
document.getElementById('menu').onclick = () => window.__navigate(nav.data.path)
document.getElementById('palette').onclick = () => entries.find(x => x.area === 'palette').data.run()
document.getElementById('home').onclick = () => window.__navigate('/')
