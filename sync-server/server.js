import { createServer } from 'node:http'
import { mkdir, rename, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'

const DATA_DIR   = process.env.DATA_DIR   || '/data'
const MEDIA_DIR  = join(DATA_DIR, 'media')
const STATE_FILE = join(DATA_DIR, 'state.json')
const STATE_BAK  = join(DATA_DIR, 'state.json.bak')
const PORT       = Number(process.env.PORT || 8079)
const MAX_STATE_BYTES = Number(process.env.MAX_STATE_BYTES || 100 * 1024 * 1024)  // 100MB
const MAX_BLOB_BYTES  = Number(process.env.MAX_BLOB_BYTES  || 500 * 1024 * 1024)  // 500MB

await mkdir(MEDIA_DIR, { recursive: true })

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Mime-Type',
  'Access-Control-Max-Age':       '86400',
}

function send(res, status, body, extraHeaders = {}) {
  const headers = { ...CORS_HEADERS, ...extraHeaders }
  if (body == null) {
    res.writeHead(status, headers)
    res.end()
    return
  }
  if (Buffer.isBuffer(body)) {
    res.writeHead(status, headers)
    res.end(body)
    return
  }
  if (typeof body === 'object') {
    const json = JSON.stringify(body)
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json), ...headers })
    res.end(json)
    return
  }
  res.writeHead(status, headers)
  res.end(String(body))
}

async function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let received = 0
    req.on('data', chunk => {
      received += chunk.length
      if (received > limit) {
        req.destroy()
        reject(new Error(`Body exceeds ${limit} bytes`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function atomicWrite(target, data) {
  const tmp = `${target}.${randomUUID()}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, target)
}

function safeMediaId(raw) {
  // Allow only [A-Za-z0-9_.-], 1..128 chars.
  // Prevents path traversal and weird filenames.
  if (typeof raw !== 'string') return null
  if (raw.length < 1 || raw.length > 128) return null
  if (!/^[A-Za-z0-9._-]+$/.test(raw)) return null
  if (raw === '.' || raw === '..') return null
  return raw
}

async function exists(path) {
  try { await stat(path); return true } catch { return false }
}

async function handleGetState(req, res) {
  try {
    const buf = await readFile(STATE_FILE)
    const st  = await stat(STATE_FILE)
    send(res, 200, buf, {
      'Content-Type':  'application/json; charset=utf-8',
      'Last-Modified': st.mtime.toUTCString(),
    })
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, { error: 'no state' })
    console.error('GET /state failed:', err)
    send(res, 500, { error: 'read failed' })
  }
}

async function handlePutState(req, res) {
  try {
    const body = await readBody(req, MAX_STATE_BYTES)
    // Validate it's parseable JSON before writing — protects against bad clients
    // wiping a good backup with corrupt content.
    try { JSON.parse(body.toString('utf-8')) }
    catch { return send(res, 400, { error: 'invalid JSON' }) }
    // Rotate existing state to .bak (best-effort)
    if (await exists(STATE_FILE)) {
      try { await rename(STATE_FILE, STATE_BAK) } catch (e) { console.warn('bak rotate failed:', e.message) }
    }
    await atomicWrite(STATE_FILE, body)
    const st = await stat(STATE_FILE)
    send(res, 200, { ok: true, bytes: body.length, mtime: st.mtime.toISOString() })
  } catch (err) {
    console.error('PUT /state failed:', err)
    send(res, 500, { error: err.message })
  }
}

async function handleListMedia(req, res) {
  try {
    const names = await readdir(MEDIA_DIR)
    const ids = new Set()
    for (const n of names) {
      if (n.endsWith('.bin')) ids.add(n.slice(0, -4))
    }
    const items = []
    for (const id of ids) {
      const binPath  = join(MEDIA_DIR, `${id}.bin`)
      const metaPath = join(MEDIA_DIR, `${id}.meta.json`)
      let size = 0, mtime = null, mimeType = 'application/octet-stream'
      try { const st = await stat(binPath); size = st.size; mtime = st.mtime.toISOString() } catch {}
      try { const meta = JSON.parse(await readFile(metaPath, 'utf-8')); mimeType = meta.mimeType || mimeType } catch {}
      items.push({ id, size, mtime, mimeType })
    }
    send(res, 200, { items })
  } catch (err) {
    console.error('GET /media failed:', err)
    send(res, 500, { error: err.message })
  }
}

async function handleGetMedia(req, res, id) {
  const binPath  = join(MEDIA_DIR, `${id}.bin`)
  const metaPath = join(MEDIA_DIR, `${id}.meta.json`)
  try {
    const st = await stat(binPath)
    let mimeType = 'application/octet-stream'
    try { const meta = JSON.parse(await readFile(metaPath, 'utf-8')); mimeType = meta.mimeType || mimeType } catch {}
    res.writeHead(200, {
      ...CORS_HEADERS,
      'Content-Type':   mimeType,
      'Content-Length': st.size,
      'X-Mime-Type':    mimeType,
      'Last-Modified':  st.mtime.toUTCString(),
    })
    createReadStream(binPath).pipe(res)
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, { error: 'no blob' })
    console.error('GET /media/:id failed:', err)
    send(res, 500, { error: err.message })
  }
}

async function handlePutMedia(req, res, id) {
  try {
    const body = await readBody(req, MAX_BLOB_BYTES)
    const mimeType = req.headers['x-mime-type'] || req.headers['content-type'] || 'application/octet-stream'
    const binPath  = join(MEDIA_DIR, `${id}.bin`)
    const metaPath = join(MEDIA_DIR, `${id}.meta.json`)
    await atomicWrite(binPath,  body)
    await atomicWrite(metaPath, JSON.stringify({ mimeType, bytes: body.length, savedAt: new Date().toISOString() }))
    send(res, 200, { ok: true, bytes: body.length, mimeType })
  } catch (err) {
    console.error('PUT /media/:id failed:', err)
    send(res, 500, { error: err.message })
  }
}

async function handleDeleteMedia(req, res, id) {
  const binPath  = join(MEDIA_DIR, `${id}.bin`)
  const metaPath = join(MEDIA_DIR, `${id}.meta.json`)
  try { await unlink(binPath)  } catch (err) { if (err.code !== 'ENOENT') return send(res, 500, { error: err.message }) }
  try { await unlink(metaPath) } catch {}
  send(res, 200, { ok: true })
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, null)
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const path = url.pathname

    if (path === '/healthz') return send(res, 200, { ok: true })

    if (path === '/state') {
      if (req.method === 'GET') return handleGetState(req, res)
      if (req.method === 'PUT') return handlePutState(req, res)
      return send(res, 405, { error: 'method not allowed' })
    }

    if (path === '/media') {
      if (req.method === 'GET') return handleListMedia(req, res)
      return send(res, 405, { error: 'method not allowed' })
    }

    const mediaMatch = path.match(/^\/media\/([^/]+)$/)
    if (mediaMatch) {
      const id = safeMediaId(decodeURIComponent(mediaMatch[1]))
      if (!id) return send(res, 400, { error: 'invalid media id' })
      if (req.method === 'GET')    return handleGetMedia(req, res, id)
      if (req.method === 'PUT')    return handlePutMedia(req, res, id)
      if (req.method === 'DELETE') return handleDeleteMedia(req, res, id)
      return send(res, 405, { error: 'method not allowed' })
    }

    send(res, 404, { error: 'not found' })
  } catch (err) {
    console.error('handler error:', err)
    send(res, 500, { error: err.message })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`lifeglance-sync listening on :${PORT}, data dir ${DATA_DIR}`)
})
