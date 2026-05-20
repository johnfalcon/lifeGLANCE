import { dbGetAllChapters, dbGetChapter, dbAddChapter, dbPutChapter, dbDeleteChapter } from './db'
import { uid } from './milestones'
import { schedulePushState } from './syncClient'

// Valid color values are the same hex strings used for milestone categories and
// the settings palette (COLOR_PALETTE in SettingsModal).  No runtime validation
// here — the caller is responsible for passing a valid palette color.

export function buildChapter({
  title,
  start,
  end = null,
  color,
  description               = '',
  defaultMemberVisibility   = 'shown',
  parentChapterId           = null,
}) {
  const now = new Date().toISOString()
  return {
    id:                     uid(),
    title:                  title.trim(),
    start:                  start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
    end:                    end === null ? null : (end instanceof Date ? end.toISOString() : new Date(end).toISOString()),
    color,
    description,
    defaultMemberVisibility,
    parentChapterId,
    milestoneIds:           [],
    created_at:             now,
    updated_at:             now,
  }
}

export async function createChapter(data) {
  const chapter = buildChapter(data)
  await dbAddChapter(chapter)
  schedulePushState()
  return chapter
}

export async function getChapter(id) {
  return dbGetChapter(id)
}

export async function listChapters() {
  return dbGetAllChapters()
}

export async function updateChapter(id, updates, existing) {
  const chapter = {
    ...existing,
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  }
  await dbPutChapter(chapter)
  schedulePushState()
  return chapter
}

export async function deleteChapter(id) {
  await dbDeleteChapter(id)
  schedulePushState()
}

// Adds milestoneId to chapter.milestoneIds; no-op if already present.
export async function addMilestoneToChapter(chapterId, milestoneId) {
  const chapter = await dbGetChapter(chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  if (chapter.milestoneIds.includes(milestoneId)) return chapter
  const updated = {
    ...chapter,
    milestoneIds: [...chapter.milestoneIds, milestoneId],
    updated_at:   new Date().toISOString(),
  }
  await dbPutChapter(updated)
  schedulePushState()
  return updated
}

// Removes milestoneId from chapter.milestoneIds; no-op if not present.
export async function removeMilestoneFromChapter(chapterId, milestoneId) {
  const chapter = await dbGetChapter(chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  const updated = {
    ...chapter,
    milestoneIds: chapter.milestoneIds.filter(id => id !== milestoneId),
    updated_at:   new Date().toISOString(),
  }
  await dbPutChapter(updated)
  schedulePushState()
  return updated
}

// Returns the milestoneIds array for a chapter.
export async function getMilestonesInChapter(chapterId) {
  const chapter = await dbGetChapter(chapterId)
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`)
  return chapter.milestoneIds
}

// Returns all chapters that contain the given milestoneId.
export async function getChaptersForMilestone(milestoneId) {
  const chapters = await dbGetAllChapters()
  return chapters.filter(chapter => chapter.milestoneIds.includes(milestoneId))
}

// Replaces all chapter records with the supplied array (used by backup restore).
// Intentionally does NOT trigger schedulePushState — boot-time hydration calls
// this with state fetched from the server, so re-pushing would be a no-op cycle.
export async function restoreChapters(items) {
  const existing = await dbGetAllChapters()
  for (const chapter of existing) await dbDeleteChapter(chapter.id)
  for (const chapter of items)    await dbPutChapter(chapter)
  return items
}
