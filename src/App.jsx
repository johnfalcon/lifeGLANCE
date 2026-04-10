import React, { useState, useEffect } from 'react'
import Onboarding   from './components/onboarding/Onboarding'
import TimelineView from './components/timeline/TimelineView'
import { initDB, dbGetAll } from './data/db'

export default function App() {
  const [screen,     setScreen]     = useState('loading')  // loading | onboarding | timeline
  const [milestones, setMilestones] = useState([])

  useEffect(() => {
    initDB()
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

  if (screen === 'loading') {
    return (
      <div className="app-loading">
        <span className="cursor" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
      </div>
    )
  }

  if (screen === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <TimelineView
      milestones={milestones}
      setMilestones={setMilestones}
    />
  )
}
