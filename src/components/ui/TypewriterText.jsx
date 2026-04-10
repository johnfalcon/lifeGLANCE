import React from 'react'
import { useTypewriter } from '../../utils/typewriter'

/**
 * Renders text with a typewriter effect.
 * `showCursor` keeps the blinking cursor visible after typing completes.
 * `hideCursorWhenDone` hides the cursor once typing finishes.
 */
export default function TypewriterText({
  text,
  className,
  options      = {},
  showCursor   = true,
  hideCursorWhenDone = false,
  onDone,
}) {
  const { displayed, done } = useTypewriter(text, options)

  React.useEffect(() => {
    if (done && onDone) onDone()
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const cursorVisible = showCursor && !(hideCursorWhenDone && done)

  return (
    <span className={className}>
      {displayed}
      {cursorVisible && <span className="cursor" />}
    </span>
  )
}
