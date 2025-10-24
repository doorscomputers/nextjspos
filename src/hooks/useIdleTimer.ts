import { useEffect, useState, useCallback, useRef } from 'react'

interface UseIdleTimerOptions {
  timeoutMinutes: number
  warningMinutes: number
  onIdle: () => void
  onActive: () => void
  onWarning: () => void
  enabled?: boolean
}

interface UseIdleTimerReturn {
  isIdle: boolean
  isWarning: boolean
  remainingTime: number
  reset: () => void
  pause: () => void
  resume: () => void
}

/**
 * Custom hook to detect user inactivity
 * Tracks mouse movements, keyboard events, clicks, and scrolls
 * Triggers warning before timeout and executes callback on timeout
 */
export function useIdleTimer({
  timeoutMinutes,
  warningMinutes,
  onIdle,
  onActive,
  onWarning,
  enabled = true
}: UseIdleTimerOptions): UseIdleTimerReturn {
  const [isIdle, setIsIdle] = useState(false)
  const [isWarning, setIsWarning] = useState(false)
  const [remainingTime, setRemainingTime] = useState(timeoutMinutes * 60)
  const [isPaused, setIsPaused] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const timeoutMs = timeoutMinutes * 60 * 1000
  const warningMs = warningMinutes * 60 * 1000
  const warningStartMs = timeoutMs - warningMs

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  /**
   * Start countdown interval to update remaining time
   */
  const startCountdown = useCallback(() => {
    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = Math.max(0, timeoutMs - elapsed)
      setRemainingTime(Math.floor(remaining / 1000))
    }, 1000)
  }, [timeoutMs])

  /**
   * Reset the idle timer
   */
  const reset = useCallback(() => {
    if (!enabled || isPaused) return

    clearTimers()
    lastActivityRef.current = Date.now()
    setIsIdle(false)
    setIsWarning(false)
    setRemainingTime(timeoutMinutes * 60)

    // Start countdown
    startCountdown()

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ WARNING: Inactivity detected! Showing warning modal...')
      setIsWarning(true)
      onWarning()
    }, warningStartMs)

    // Set idle timeout
    timeoutRef.current = setTimeout(() => {
      console.log('🚪 TIMEOUT: User idle too long. Logging out...')
      setIsIdle(true)
      setIsWarning(false)
      clearTimers()
      onIdle()
    }, timeoutMs)

    // Call onActive if coming from idle state
    if (isIdle) {
      onActive()
    }
  }, [
    enabled,
    isPaused,
    clearTimers,
    startCountdown,
    timeoutMinutes,
    warningStartMs,
    timeoutMs,
    onWarning,
    onIdle,
    onActive,
    isIdle
  ])

  /**
   * Pause the idle timer
   */
  const pause = useCallback(() => {
    setIsPaused(true)
    clearTimers()
  }, [clearTimers])

  /**
   * Resume the idle timer
   */
  const resume = useCallback(() => {
    setIsPaused(false)
    reset()
  }, [reset])

  /**
   * Handle user activity
   */
  const handleActivity = useCallback(() => {
    if (!enabled || isPaused) return

    // Throttle activity handler to avoid excessive resets
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current

    // Only reset if more than 1 second has passed since last activity
    if (timeSinceLastActivity > 1000) {
      reset()
    }
  }, [enabled, isPaused, reset])

  /**
   * Set up activity event listeners
   */
  useEffect(() => {
    if (!enabled) {
      console.log('⏸️ Idle timer DISABLED')
      clearTimers()
      return
    }

    console.log('▶️ Idle timer ENABLED:', {
      timeoutMinutes,
      warningMinutes,
      timeoutMs,
      warningStartMs
    })

    // Initial setup
    reset()

    // Events to track
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ]

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Cleanup
    return () => {
      clearTimers()
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [enabled, handleActivity, reset, clearTimers])

  /**
   * Handle timeout/warning changes
   */
  useEffect(() => {
    if (enabled && !isPaused && !isIdle) {
      reset()
    }
  }, [timeoutMinutes, warningMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isIdle,
    isWarning,
    remainingTime,
    reset,
    pause,
    resume
  }
}
