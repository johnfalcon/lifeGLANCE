import React, { useState } from 'react'
import Step1Welcome   from './Step1Welcome'
import Step2Past      from './Step2Past'
import Step3Future    from './Step3Future'
import Step4Reveal    from './Step4Reveal'
import TimelinePreview from './TimelinePreview'
import { addMilestone } from '../../data/milestones'

export default function Onboarding({ onComplete }) {
  const [step, setStep]               = useState(1)
  const [pastMilestone, setPast]      = useState(null)
  const [futureMilestone, setFuture]  = useState(null)

  async function handlePast(data) {
    const m = await addMilestone(data)
    setPast(m)
    setStep(3)
  }

  async function handleFuture(data) {
    const m = await addMilestone(data)
    setFuture(m)
    setStep(4)
  }

  function finish() {
    onComplete([pastMilestone, futureMilestone].filter(Boolean))
  }

  const previewMilestones = [pastMilestone, futureMilestone].filter(Boolean)

  return (
    <div className="onboarding">
      {step === 1 && <Step1Welcome onBegin={() => setStep(2)} onSkip={finish} />}
      {step === 2 && <Step2Past    onSubmit={handlePast}    onSkip={finish} />}
      {step === 3 && <Step3Future  onSubmit={handleFuture}  onSkip={finish} pastMilestone={pastMilestone} />}
      {step === 4 && <Step4Reveal  onComplete={finish} pastMilestone={pastMilestone} futureMilestone={futureMilestone} />}

      {/* Timeline preview strip appears from step 2 onwards */}
      {step >= 2 && <TimelinePreview milestones={previewMilestones} />}
    </div>
  )
}
