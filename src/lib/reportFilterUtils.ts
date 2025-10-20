"use client"

/**
 * Utility helper to count how many filters are currently active.
 * Accepts an array of booleans or predicate functions.
 */
export function countActiveFilters(checks: Array<boolean | (() => boolean)>): number {
  return checks.reduce((total, check) => {
    const isActive = typeof check === "function" ? check() : check
    return total + (isActive ? 1 : 0)
  }, 0)
}
