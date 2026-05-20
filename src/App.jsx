import React, { useState, useEffect } from 'react'
import Onboarding   from './components/onboarding/Onboarding'
import TimelineView from './components/timeline/TimelineView'
import { initDB, dbGetAll, dbPutMedia } from './data/db'
import { applyBackup, buildBackup } from './data/backup'
import {
  isSyncEnabled,
  setStateBuilder,
  schedulePushState,
  pullState,
  listRemoteMedia,
  fetchRemoteMedia,
} from './data/syncClient'

// On boot, if local IndexedDB is empty, hydrate from the sync server (disaster
// recovery after a cache wipe). If local has data, leave it alone but push it
// to the server so the backup stays current. Audio/video blobs are reconciled
// separately: anything the server has that local doesn't gets fetched.
async function hydrateFromServer() {
  if (!isSyncEnabled()) return { restored: false }
  const local = await dbGetAll()
  if (local.length > 0) {
    // Local has data — trust it. A push happens on the next user write; we also
    // fire a one-off push here so the server picks up anything written while
    // it was unreachable.
    schedulePushState()
    return { restored: false }
  }

  const remote = await pullState()
  if (!remote) return { restored: false }
  const milestones = Array.isArray(remote) ? remote : (remote.milestones ?? [])
  const chapters   = (!Array.isArray(remote) && Array.isArray(remote.chapters)) ? remote.chapters : []
  if (milestones.length === 0 && chapters.length === 0) {
    return { restored: false }   // empty backup; treat as no backup
  }

  try {
    await applyBackup(remote)
  } catch (err) {
    console.warn('[sync] applyBackup failed:', err.message)
    return { restored: false }
  }

  // Pull any audio/video blobs the server has that we don't.
  try {
    const items = await listRemoteMedia()
    for (const item of items) {
      // Skip photo blobs — those came back via the JSON payload.
      if (item.id.endsWith('-photo')) continue
      const result = await fetchRemoteMedia(item.id)
      if (!result) continue
      // Use the underlying IndexedDB put directly to avoid the syncClient
      // bouncing this blob back to the server.
      await dbPutMedia(item.id, result.blob, result.mimeType)
    }
  } catch (err) {
    console.warn('[sync] media reconciliation failed:', err.message)
  }

  return { restored: true }
}

export default function App() {
  const [screen,      setScreen]      = useState('loading')  // loading | onboarding | timeline
  const [milestones,  setMilestones]  = useState([])
  const [portraitWarn, setPortraitWarn] = useState(
    () => window.matchMedia('(orientation: portrait) and (max-width: 1024px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 1024px)')
    const handler = (e) => setPortraitWarn(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    // Register the state builder once so writes can serialize current IndexedDB
    // contents on demand without circular imports.
    setStateBuilder(buildBackup)

    initDB()
      .then(() => {
        if (import.meta.env.DEV) import('./data/devtools').then(m => m.registerDevtools())
        navigator.storage?.persist?.()
        return hydrateFromServer()
      })
      .then(() => dbGetAll())
      .then((all) => {
        setMilestones(all)
        setScreen(all.length === 0 ? 'onboarding' : 'timeline')
      })
      .catch((err) => {
        console.error('DB init failed:', err)
        setScreen('onboarding')
      })
  }, [])

  function handleOnboardingComplete(initial) {
    setMilestones(initial)
    setScreen('timeline')
  }

  const content = screen === 'loading' ? (
    <div className="app-loading">
      <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
    </div>
  ) : screen === 'onboarding' ? (
    <Onboarding onComplete={handleOnboardingComplete} />
  ) : (
    <TimelineView milestones={milestones} setMilestones={setMilestones} />
  )

  return (
    <>
      {content}
      {portraitWarn && (
        <div className="portrait-overlay">
          <div className="logo">
            <span className="logo-life">life</span>
            <span className="logo-glance">GLANCE</span>
          </div>
          <div className="portrait-rotate-icon">↺</div>
          <div className="portrait-message">
            please rotate your device<br />
            for the best experience
          </div>
        </div>
      )}
    </>
  )
}
