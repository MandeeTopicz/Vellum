/**
 * Measures text dimensions using offscreen canvas for auto-sizing text boxes.
 * @param text - The text to measure
 * @param fontSize - Font size in pixels
 * @param fontFamily - Font family string (e.g. 'Inter, system-ui, sans-serif')
 * @param maxWidth - Max width before wrapping (default 600)
 * @returns Width and height needed to fit the text (with padding)
 */
export function measureTextDimensions(
  text: string,
  fontSize: number,
  fontFamily: string = 'Inter, system-ui, sans-serif',
  maxWidth: number = 600
): { width: number; height: number } {
  const PADDING = 16
  const MIN_WIDTH = 100
  const MIN_HEIGHT = 40

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: Math.max(MIN_WIDTH, 200), height: Math.max(MIN_HEIGHT, 40) }

  const fontStyle = `${fontSize}px ${fontFamily}`
  ctx.font = fontStyle

  const paragraphs = text.split(/\n/)
  const lines: string[] = []

  paragraphs.forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean)
    let currentLine = ''
    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    })
    if (currentLine) lines.push(currentLine)
  })

  if (lines.length === 0) lines.push('')

  const lineHeight = fontSize * 1.4
  const longestLine = lines.reduce(
    (a, b) => (ctx.measureText(a).width > ctx.measureText(b).width ? a : b),
    ''
  )
  const textWidth = ctx.measureText(longestLine).width
  const width = Math.max(MIN_WIDTH, Math.min(maxWidth, textWidth + PADDING * 2))
  const height = Math.max(MIN_HEIGHT, lines.length * lineHeight + PADDING * 2)

  return { width, height }
}
