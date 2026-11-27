/**
 * @jest-environment node
 */
import { correctCountTime, isValidCountQty } from '@/lib/mobileCountRules'

describe('isValidCountQty', () => {
  it('accepts whole numbers, zero and up to 4 decimals', () => {
    for (const q of [0, 1, 17, 1.1, 0.1, 2.5, 12.3456, 999999.9999, 1_000_000]) {
      expect(isValidCountQty(q)).toBe(true)
    }
  })
  it('rejects negatives, too many decimals, too big, and non-numbers', () => {
    for (const q of [-1, 0.00001, 1.23456, 1_000_000.5, NaN, Infinity, '5', null, undefined]) {
      expect(isValidCountQty(q)).toBe(false)
    }
  })
})

describe('correctCountTime (phone clock protection)', () => {
  const sessionStart = new Date('2026-11-27T08:00:00.000Z')
  const serverNow = new Date('2026-11-27T10:00:00.000Z')

  it('keeps the time when the phone clock is right', () => {
    const r = correctCountTime('2026-11-27T09:00:00.000Z', serverNow, serverNow, sessionStart)
    expect(r?.toISOString()).toBe('2026-11-27T09:00:00.000Z')
  })

  it('shifts by the clock error when the phone is 3 hours behind', () => {
    const phoneNow = new Date('2026-11-27T07:00:00.000Z') // phone thinks it is 07:00
    const r = correctCountTime('2026-11-27T06:30:00.000Z', phoneNow, serverNow, sessionStart)
    expect(r?.toISOString()).toBe('2026-11-27T09:30:00.000Z')
  })

  it('never returns a time in the future', () => {
    const r = correctCountTime('2026-11-27T12:00:00.000Z', serverNow, serverNow, sessionStart)
    expect(r?.toISOString()).toBe(serverNow.toISOString())
  })

  it('never returns a time before the session started', () => {
    const r = correctCountTime('2026-11-26T12:00:00.000Z', serverNow, serverNow, sessionStart)
    expect(r?.toISOString()).toBe(sessionStart.toISOString())
  })

  it('returns null for an unreadable time', () => {
    expect(correctCountTime('not-a-date', serverNow, serverNow, sessionStart)).toBeNull()
  })
})
