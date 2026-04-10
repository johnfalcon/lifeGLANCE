import React from 'react'
import { relativeLabel } from '../../utils/dates'

export default function StatsPanel({ milestones }) {
  const now = new Date()

  const past   = milestones.filter(m => new Date(m.date) < now)
    .sort((a, b) => new Date(b.date) - new Date(a.date)) // most recent first
  const future = milestones.filter(m => new Date(m.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date)) // soonest first

  const nearest = past[0]
  const next    = future[0]

  return (
    <div className="stat-panels">
      {/* Left — past */}
      <div className="stat-panel">
        <div className="stat-panel-label">← past</div>
        <div className="stat-panel-count">
          {past.length} milestone{past.length !== 1 ? 's' : ''}
        </div>
        {nearest && (
          <div className="stat-panel-item" title={nearest.title}>
            {nearest.title.length > 18 ? nearest.title.slice(0, 18) + '…' : nearest.title}
            {' · '}
            {relativeLabel(nearest.date, nearest.date_precision)}
          </div>
        )}
      </div>

      {/* Right — future */}
      <div className="stat-panel stat-panel-right">
        <div className="stat-panel-label">future →</div>
        <div className="stat-panel-count">
          {future.length} milestone{future.length !== 1 ? 's' : ''}
        </div>
        {next && (
          <div className="stat-panel-item" title={next.title}>
            {next.title.length > 18 ? next.title.slice(0, 18) + '…' : next.title}
            {' · '}
            {relativeLabel(next.date, next.date_precision)}
          </div>
        )}
      </div>
    </div>
  )
}
