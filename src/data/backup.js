// Shared backup serialization / restore.
//
// The on-disk format is `{ milestones, photos, chapters }`:
//   - milestones: array of milestone records (everything except has_photo/media flags
//     that will be repopulated by the restore step)
//   - photos:     map of milestoneId -> data URI (base64)
//   - chapters:   array of chapter records
//
// Audio/video blobs are NOT in this payload; those are mirrored to the sync
// server as separate binary blobs and reconciled by App.jsx on boot.

import { dbGetAll, dbGetPhoto, dbPutPhoto, dbPut } from './db'
import { listChapters, restoreChapters } from './chapters'
import { restoreMilestones } from './milestones'

// Builds the full state payload from current IndexedDB contents.
export async function buildBackup() {
  const milestones = await dbGetAll()
  const photos = {}
  for (const m of milestones) {
    if (!m.has_photo) continue
    try {
      const result = await dbGetPhoto(m.id)
      if (!result) continue
      const buf = await result.blob.arrayBuffer()
      const b64 = btoa([...new Uint8Array(buf)].map(b => String.fromCharCode(b)).join(''))
      photos[m.id] = `data:${result.mimeType};base64,${b64}`
    } catch { /* skip unreadable photo */ }
  }
  const chapters = await listChapters()
  return { milestones, photos, chapters }
}

// Applies a parsed backup payload to IndexedDB. Returns { milestones, chapters }
// in their restored form so callers can update React state.
//
// Throws on the pre-rename `eras` format (unrecoverable).
export async function applyBackup(parsed) {
  if (!Array.isArray(parsed) && Array.isArray(parsed.eras) && !Array.isArray(parsed.chapters)) {
    throw new Error('This backup was created before the Chapters rename and cannot be imported. Please regenerate the backup from the app.')
  }

  const items    = Array.isArray(parsed) ? parsed : (parsed.milestones ?? parsed)
  const photos   = (!Array.isArray(parsed) && parsed.photos) ? parsed.photos : {}
  const chapters = (!Array.isArray(parsed) && Array.isArray(parsed.chapters)) ? parsed.chapters : []

  const restored = await restoreMilestones(items)
  await restoreChapters(chapters)

  for (const m of restored) {
    const dataUri = photos[m.id]
    if (!dataUri) continue
    try {
      const [header, b64] = dataUri.split(',')
      const mimeType = header.match(/:(.*?);/)[1]
      const raw      = atob(b64)
      const arr      = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
      const blob = new Blob([arr], { type: mimeType })
      await dbPutPhoto(m.id, blob, mimeType)
      m.has_photo = true
    } catch { /* malformed data-URI — skip */ }
  }

  for (const m of restored) {
    if (m.has_photo) await dbPut(m)
  }

  return { milestones: restored, chapters }
}
