export const PALETTE_AREA = 'palette'
export const ROUTES_AREA = 'routes'
export const SIDEBAR_NAV_AREA = 'sidebar'
export const host = {
  notify: (notice) => window.__notices.push(notice),
  navigate: (path) => window.__navigate(path)
}
