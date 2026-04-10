import React, {
  useRef, useState, useEffect, useCallback,
  useImperativeHandle, forwardRef,
} from 'react'
import { dateToX, getTimeRange, getTickMarks, assignLanes, getMsPerPx } from '../../utils/timeline'

const LANE_GAP = 72   // px per lane from axis

const Timeline = forwardRef(function Timeline({ milestones, zoom, onMilestoneClick }, ref) {
  const wrapRef  = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 340 })
  const [panMs, setPanMs] = useState(0)
  const drag = useRef({ active: false, startX: 0, startPan: 0 })

  useImperativeHandle(ref, () => ({ resetPan: () => setPanMs(0) }))

  // Measure container
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const { w, h } = size
  const axisY    = Math.round(h * 0.5)
  const today    = new Date()
  const centerMs = today.getTime() + panMs
  const { startMs, endMs } = getTimeRange(zoom, centerMs)
  const ticks    = getTickMarks(zoom, startMs, endMs, w)
  const todayX   = dateToX(today.getTime(), startMs, endMs, w)
  const withLanes = assignLanes(milestones)
  const msPerPx  = getMsPerPx(zoom, w)

  // ── Pan ─────────────────────────────────────────────────────────────────────
  const startDrag = useCallback((clientX) => {
    drag.current = { active: true, startX: clientX, startPan: panMs }
  }, [panMs])

  const moveDrag = useCallback((clientX) => {
    if (!drag.current.active) return
    const dx = clientX - drag.current.startX
    setPanMs(drag.current.startPan - dx * msPerPx)
  }, [msPerPx])

  const endDrag = useCallback(() => { drag.current.active = false }, [])

  const touchId = useRef(null)

  return (
    <div
      ref={wrapRef}
      className="timeline-svg-wrap"
      style={{ flex: 1 }}
      onMouseDown={e => startDrag(e.clientX)}
      onMouseMove={e => moveDrag(e.clientX)}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={e => {
        const t = e.touches[0]
        touchId.current = t.identifier
        startDrag(t.clientX)
      }}
      onTouchMove={e => {
        const t = [...e.touches].find(x => x.identifier === touchId.current)
        if (t) moveDrag(t.clientX)
      }}
      onTouchEnd={endDrag}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="tl-left" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0F1117" stopOpacity="1" />
            <stop offset="1" stopColor="#0F1117" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tl-right" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0F1117" stopOpacity="0" />
            <stop offset="1" stopColor="#0F1117" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.x} y1={axisY - (tick.major ? 7 : 3)}
              x2={tick.x} y2={axisY + (tick.major ? 7 : 3)}
              stroke={tick.major ? 'rgba(232,224,208,0.25)' : 'rgba(232,224,208,0.1)'}
              strokeWidth={1}
            />
            {tick.label && (
              <text
                x={tick.x} y={axisY + 20}
                textAnchor="middle"
                fill={tick.major ? 'rgba(232,224,208,0.35)' : 'rgba(232,224,208,0.18)'}
                fontSize={tick.major ? 11 : 9}
                fontFamily="'Courier Prime', monospace"
              >
                {tick.label}
              </text>
            )}
          </g>
        ))}

        {/* Axis line */}
        <line
          x1={0} y1={axisY} x2={w} y2={axisY}
          stroke="rgba(232,224,208,0.18)" strokeWidth={1}
        />

        {/* Today marker */}
        {todayX > -10 && todayX < w + 10 && (
          <g>
            <line
              x1={todayX} y1={22}
              x2={todayX} y2={h - 22}
              stroke="#C8A96E" strokeWidth={1.5}
              strokeDasharray="4 4" opacity={0.75}
            />
            <text
              x={todayX} y={16}
              textAnchor="middle"
              fill="#C8A96E" fontSize={9}
              fontFamily="'Courier Prime', monospace"
              opacity={0.75}
            >
              today
            </text>
          </g>
        )}

        {/* Milestone nodes */}
        {withLanes.map((m) => {
          const x = dateToX(new Date(m.date).getTime(), startMs, endMs, w)
          if (x < -30 || x > w + 30) return null

          const dir    = m.above ? -1 : 1
          const nodeY  = axisY + dir * LANE_GAP * (m.lane + 1)
          const labelY = m.above ? nodeY - 13 : nodeY + 19
          const isPast = new Date(m.date) < today
          const alpha  = isPast ? 0.65 : 1
          const label  = m.title.length > 20 ? m.title.slice(0, 20) + '…' : m.title

          return (
            <g
              key={m.id}
              onClick={() => onMilestoneClick(m)}
              style={{ cursor: 'pointer' }}
              opacity={alpha}
            >
              {/* Connector */}
              <line
                x1={x} y1={axisY + dir * 5}
                x2={x} y2={nodeY + (m.above ? 6 : -6)}
                stroke={m.color} strokeWidth={1} opacity={0.35}
              />
              {/* Node */}
              <circle
                cx={x} cy={nodeY} r={5.5}
                fill={m.color}
                style={{
                  filter: `drop-shadow(0 0 5px ${m.color}66)`,
                  transformOrigin: `${x}px ${nodeY}px`,
                  animation: 'milestone-appear 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                }}
              />
              {/* Label */}
              <text
                x={x} y={labelY}
                textAnchor="middle"
                fill="rgba(232,224,208,0.82)"
                fontSize={9.5}
                fontFamily="'Courier Prime', monospace"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Edge fades */}
        <rect x={0}    y={0} width={70} height={h} fill="url(#tl-left)"  pointerEvents="none" />
        <rect x={w-70} y={0} width={70} height={h} fill="url(#tl-right)" pointerEvents="none" />
      </svg>
    </div>
  )
})

export default Timeline
