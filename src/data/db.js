const DB_NAME    = 'lifeglance'
const DB_VERSION = 1
const STORE      = 'milestones'

let _db = null

export function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('date',     'date',     { unique: false })
        store.createIndex('category', 'category', { unique: false })
      }
    }

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror   = (e) => reject(e.target.error)
  })
}

function tx(mode = 'readonly') {
  return _db.transaction(STORE, mode).objectStore(STORE)
}

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
