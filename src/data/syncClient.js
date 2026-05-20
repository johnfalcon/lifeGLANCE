// Client for the lifeglance-sync sidecar. Sync URL is baked at build time via
// VITE_SYNC_URL. If unset, all calls become no-ops so the app still works
// standalone in dev.

const BASE = (import.meta.env.VITE_SYNC_URL || '').replace(/\/+$/, '')
const ENABLED = !!BASE

const DEBOUNCE_MS = 1500
let pushTimer  = null
let pushBuilder = null   // async () => state object — set by the caller
let pendingPush = false
let inFlightPush = false

export function isSyncEnabled() {
  return ENABLED
}

// Wire up the builder once, from App.jsx, so this module doesn't import the
// IndexedDB layer directly (which would tangle the dep graph).
export function setStateBuilder(buildFn) {
  pushBuilder = buildFn
}

async function postState() {
  if (!ENABLED || !pushBuilder) return
  if (inFlightPush) { pendingPush = true; return }
  inFlightPush = true
  try {
    const state = await pushBuilder()
    const body  = JSON.stringify(state)
    const res = await fetch(`${BASE}/state`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) console.warn('[sync] PUT /state failed:', res.status, await res.text().catch(() => ''))
  } catch (err) {
    console.warn('[sync] PUT /state error:', err.message)
  } finally {
    inFlightPush = false
    if (pendingPush) {
      pendingPush = false
      // Coalesce one follow-up push.
      schedulePushState()
    }
  }
}

export function schedulePushState() {
  if (!ENABLED) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { pushTimer = null; postState() }, DEBOUNCE_MS)
}

// Force-flush any pending push (e.g. on tab close).
export function flushPushState() {
  if (!ENABLED) return Promise.resolve()
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null }
  return postState()
}

export async function pullState() {
  if (!ENABLED) return null
  try {
    const res = await fetch(`${BASE}/state`, { method: 'GET' })
    if (res.status === 404) return null
    if (!res.ok) {
      console.warn('[sync] GET /state failed:', res.status)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn('[sync] GET /state error:', err.message)
    return null
  }
}

export async function pushMedia(id, blob, mimeType) {
  if (!ENABLED) return
  try {
    const res = await fetch(`${BASE}/media/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'X-Mime-Type': mimeType || blob.type || 'application/octet-stream' },
      body:    blob,
    })
    if (!res.ok) console.warn('[sync] PUT /media failed:', id, res.status)
  } catch (err) {
    console.warn('[sync] PUT /media error:', id, err.message)
  }
}

export async function deleteMediaRemote(id) {
  if (!ENABLED) return
  try {
    await fetch(`${BASE}/media/${encodeURIComponent(id)}`, { method: 'DELETE' })
  } catch (err) {
    console.warn('[sync] DELETE /media error:', id, err.message)
  }
}

export async function listRemoteMedia() {
  if (!ENABLED) return []
  try {
    const res = await fetch(`${BASE}/media`, { method: 'GET' })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.items) ? json.items : []
  } catch (err) {
    console.warn('[sync] GET /media error:', err.message)
    return []
  }
}

export async function fetchRemoteMedia(id) {
  if (!ENABLED) return null
  try {
    const res = await fetch(`${BASE}/media/${encodeURIComponent(id)}`, { method: 'GET' })
    if (!res.ok) return null
    const blob = await res.blob()
    const mimeType = res.headers.get('X-Mime-Type') || res.headers.get('Content-Type') || blob.type || 'application/octet-stream'
    return { blob, mimeType }
  } catch (err) {
    console.warn('[sync] fetch media error:', id, err.message)
    return null
  }
}

// Best-effort flush when the tab unloads.
if (ENABLED && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
      // Fire-and-forget; the browser may abort this.
      postState()
    }
  })
}
