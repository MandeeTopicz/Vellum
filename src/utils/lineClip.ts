/**
 * Clips connector lines to rect edges so they only touch objects, never overlap.
 * Used for premade templates and AI-generated layouts.
 */

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Point {
  x: number
  y: number
}

/**
 * Intersect segment (p1, p2) with rect boundary. Returns points on the segment
 * that lie on the rect edge, with t in [0,1] (parametric from p1).
 */
function segmentRectIntersections(
  p1: Point,
  p2: Point,
  rect: Rect
): Array<{ point: Point; t: number }> {
  const result: Array<{ point: Point; t: number }> = []
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const eps = 1e-9

  const addIfValid = (t: number, x: number, y: number) => {
    if (t >= -eps && t <= 1 + eps) {
      const px = p1.x + t * dx
      const py = p1.y + t * dy
      if (Math.abs(px - x) < eps && Math.abs(py - y) < eps) {
        result.push({ point: { x: px, y: py }, t })
      }
    }
  }

  if (Math.abs(dy) > eps) {
    const tTop = (rect.top - p1.y) / dy
    const xTop = p1.x + tTop * dx
    if (xTop >= rect.left - eps && xTop <= rect.right + eps) addIfValid(tTop, xTop, rect.top)
    const tBottom = (rect.bottom - p1.y) / dy
    const xBottom = p1.x + tBottom * dx
    if (xBottom >= rect.left - eps && xBottom <= rect.right + eps) addIfValid(tBottom, xBottom, rect.bottom)
  }
  if (Math.abs(dx) > eps) {
    const tLeft = (rect.left - p1.x) / dx
    const yLeft = p1.y + tLeft * dy
    if (yLeft >= rect.top - eps && yLeft <= rect.bottom + eps) addIfValid(tLeft, rect.left, yLeft)
    const tRight = (rect.right - p1.x) / dx
    const yRight = p1.y + tRight * dy
    if (yRight >= rect.top - eps && yRight <= rect.bottom + eps) addIfValid(tRight, rect.right, yRight)
  }

  result.sort((a, b) => a.t - b.t)
  // Deduplicate corners (same t within epsilon)
  const out: Array<{ point: Point; t: number }> = []
  for (const r of result) {
    if (out.length === 0 || Math.abs(out[out.length - 1].t - r.t) > eps) out.push(r)
  }
  return out
}

/**
 * Clips a line segment so it only connects at the edges of two rects.
 * Start/end are typically centers; returned segment touches rect edges only.
 * @param start - Line start (e.g. center of "from" object)
 * @param end - Line end (e.g. center of "to" object)
 * @param rectFrom - Bounds of the "from" object
 * @param rectTo - Bounds of the "to" object
 */
export function clipLineToRectEdges(
  start: Point,
  end: Point,
  rectFrom: Rect,
  rectTo: Rect
): { start: Point; end: Point } {
  const fromPts = segmentRectIntersections(start, end, rectFrom)
  const toPts = segmentRectIntersections(start, end, rectTo)

  const exitCandidates = fromPts.filter((p) => p.t > 1e-9 && p.t <= 1)
  const entryCandidates = toPts.filter((p) => p.t >= 0 && p.t < 1 - 1e-9)

  let newStart = start
  let newEnd = end

  if (exitCandidates.length > 0) {
    const exitPoint = exitCandidates.reduce((a, b) => (a.t < b.t ? a : b))
    newStart = exitPoint.point
  }
  if (entryCandidates.length > 0) {
    const entryPoint = entryCandidates.reduce((a, b) => (a.t < b.t ? a : b))
    newEnd = entryPoint.point
  }

  if (exitCandidates.length > 0 && entryCandidates.length > 0) {
    const exitT = exitCandidates.reduce((a, b) => (a.t < b.t ? a : b)).t
    const entryT = entryCandidates.reduce((a, b) => (a.t < b.t ? a : b)).t
    if (exitT > entryT + 1e-9) {
      newStart = toPts.reduce((a, b) => (a.t < b.t ? a : b)).point
      newEnd = fromPts.reduce((a, b) => (a.t > b.t ? a : b)).point
    }
  }

  return { start: newStart, end: newEnd }
}

/** Rect from position + dimensions */
export function rectFromPosDims(x: number, y: number, w: number, h: number): Rect {
  return { left: x, top: y, right: x + w, bottom: y + h }
}
