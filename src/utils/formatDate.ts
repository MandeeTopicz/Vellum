/**
 * Formats a date to MM/DD/YYYY.
 * @param date - The date to format (Date instance or timestamp in ms)
 * @returns The formatted date string (e.g. "02/16/2025")
 * @example
 * formatDate(new Date(2025, 1, 16)) // "02/16/2025"
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const year = d.getFullYear()
  return `${month}/${day}/${year}`
}
