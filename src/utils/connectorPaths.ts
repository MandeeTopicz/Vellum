/**
 * Connector path utilities — strict fixed rules, no conditional logic based on distance or angle.
 * Each type has an isolated path function. Only magnitude scales with distance, never direction or bend type.
 */

/** Straight line: [x1, y1, x2, y2] */
export function pathStraight(x1: number, y1: number, x2: number, y2: number): number[] {
  return [x1, y1, x2, y2]
}

/**
 * Right Angle: always one 90° turn at horizontal midpoint.
 * Path: start -> (midX, y1) -> (midX, y2) -> end
 * Fixed rule — never adapt turn point based on angle or dimensions.
 */
export function pathRightAngle(x1: number, y1: number, x2: number, y2: number): number[] {
  const midX = (x1 + x2) / 2
  return [x1, y1, midX, y1, midX, y2, x2, y2]
}

/**
 * Curved: quadratic Bezier with control point offset.
 * Fixed proportion of distance — 30% — never flip or straighten.
 * Y-down: right of (dx,dy) = (dy,-dx), left = (-dy,dx).
 */
const CURVE_PROPORTION = 0.3

/** Clockwise: control point always bows to the RIGHT of line direction */
export function pathCurvedClockwise(x1: number, y1: number, x2: number, y2: number): number[] {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const offset = CURVE_PROPORTION * len
  const rx = (dy / len) * offset
  const ry = (-dx / len) * offset
  const cx = midX + rx
  const cy = midY + ry
  return [x1, y1, cx, cy, x2, y2]
}

/** Counter-clockwise: control point always bows to the LEFT of line direction */
export function pathCurvedCounterClockwise(x1: number, y1: number, x2: number, y2: number): number[] {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const offset = CURVE_PROPORTION * len
  const lx = (-dy / len) * offset
  const ly = (dx / len) * offset
  const cx = midX + lx
  const cy = midY + ly
  return [x1, y1, cx, cy, x2, y2]
}

export type ConnectionType =
  | 'line'
  | 'arrow-straight'
  | 'arrow-double'
  | 'arrow-elbow-bidirectional'
  | 'arrow-curved'
  | 'arrow-curved-cw'

/**
 * Get path points for a connection type. Returns flat array [x1,y1,x2,y2,...].
 * Straight types use 4 values; right-angle uses 8; curved uses 6.
 */
export function getConnectorPath(
  type: ConnectionType,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number[] {
  switch (type) {
    case 'line':
    case 'arrow-straight':
    case 'arrow-double':
      return pathStraight(x1, y1, x2, y2)
    case 'arrow-elbow-bidirectional':
      return pathRightAngle(x1, y1, x2, y2)
    case 'arrow-curved-cw':
      return pathCurvedClockwise(x1, y1, x2, y2)
    case 'arrow-curved':
      return pathCurvedCounterClockwise(x1, y1, x2, y2)
    default:
      return pathStraight(x1, y1, x2, y2)
  }
}

/** Whether path has curve (needs tension for Konva Line/Arrow) */
export function isCurvedPath(type: ConnectionType): boolean {
  return type === 'arrow-curved' || type === 'arrow-curved-cw'
}

/** Whether to show arrow at start */
export function pointerAtBeginning(type: ConnectionType): boolean {
  return type === 'arrow-double' || type === 'arrow-elbow-bidirectional'
}

/** Whether to show arrow at end */
export function pointerAtEnd(type: ConnectionType): boolean {
  return type !== 'line'
}
