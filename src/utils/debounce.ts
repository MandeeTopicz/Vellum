/**
 * Creates a debounced function that delays invocation until after `ms` milliseconds
 * have elapsed since the last call.
 * @param fn - Function to debounce
 * @param ms - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = null
      fn(...args)
    }, ms)
  }
}
