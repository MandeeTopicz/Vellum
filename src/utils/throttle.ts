/**
 * Creates a throttled function that runs at most once per `ms` milliseconds.
 * Uses leading edge: executes immediately on first call, then ignores until `ms` has passed.
 * @param fn - Function to throttle
 * @param ms - Minimum milliseconds between invocations
 * @returns Throttled function
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    }
  }
}
