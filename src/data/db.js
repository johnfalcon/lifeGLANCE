const DB_NAME    = 'lifeglance'
const DB_VERSION = 2          // v2: adds media object store
const STORE      = 'milestones'
const MEDIA      = 'media'

let _db = null

export function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result

      // v1 — milestones store (always ensure it exists)
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('date',     'date',     { unique: false })
        store.createIndex('category', 'category', { unique: false })
      }

      // v2 — dedicated blob store for audio attachments
      if (e.oldVersion < 2) {
        db.createObjectStore(MEDIA, { keyPath: 'id' })

        // Strip any legacy audio_uri base64 strings written by v1
        const s = e.target.transaction.objectStore(STORE)
        s.openCursor().onsuccess = ev => {
          const c = ev.target.result
          if (!c) return
          if ('audio_uri' in c.value) {
            const rec = { ...c.value }
            delete rec.audio_uri
            c.update(rec)
          }
          c.continue()
        }
      }
    }

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror   = (e) => reject(e.target.error)
  })
}

function tx(mode = 'readonly') {
  return _db.transaction(STORE, mode).objectStore(STORE)
}

function mediaTx(mode = 'readonly') {
  return _db.transaction(MEDIA, mode).objectStore(MEDIA)
}

// ── Milestones ───────────────────────────────────────────────────────────────

export function dbGetAll() {
  return new Promise((resolve, reject) => {
    const req = tx().getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export function dbAdd(item) {
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').add(item)
    req.onsuccess = () => resolve(item)
    req.onerror   = () => reject(req.error)
  })
}

export function dbPut(item) {
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').put(item)
    req.onsuccess = () => resolve(item)
    req.onerror   = () => reject(req.error)
  })
}

export function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Media (audio blobs) ──────────────────────────────────────────────────────

export function dbPutMedia(id, blob, mimeType) {
  return new Promise((resolve, reject) => {
    const req = mediaTx('readwrite').put({ id, blob, mimeType })
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// Returns { blob, mimeType } or null if no entry exists for that id.
export function dbGetMedia(id) {
  return new Promise((resolve, reject) => {
    const req = mediaTx().get(id)
    req.onsuccess = () => {
      const rec = req.result
      resolve(rec ? { blob: rec.blob, mimeType: rec.mimeType } : null)
    }
    req.onerror   = () => reject(req.error)
  })
}

// Wipes the entire media store (called on backup restore so orphans don't linger).
export function dbClearAllMedia() {
  return new Promise((resolve, reject) => {
    const req = mediaTx('readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
