/**
 * COORDINATE SYSTEM GUARD RAILS
 * =============================
 *
 * SINGLE SOURCE OF TRUTH: Canvas coordinates (x, y) are stored everywhere.
 * - Firestore: canvas coordinates only
 * - Konva render: canvas coordinates (viewport Group applies transform)
 * - Conversion happens ONCE at creation time
 *
 * COORDINATE SPACES:
 * - Stage: stage.getPointerPosition() - pixels relative to stage container
 * - Canvas: infinite canvas space - stored in Firestore, used for render
 * - Viewport: stage offset (x,y) and scale
 */

export interface Viewport {
  x: number
  y: number
  scale: number
}

/**
 * Convert stage coordinates to canvas coordinates.
 * Use this ONCE when placing objects (click handler).
 *
 * Formula: canvas = (stage - viewport.offset) / viewport.scale
 */
export function stageToCanvas(
  stageX: number,
  stageY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (stageX - viewport.x) / viewport.scale,
    y: (stageY - viewport.y) / viewport.scale,
  }
}

/**
 * Convert canvas coordinates to stage coordinates.
 * Use for overlay placement (e.g. text editor, comment modal) when converting
 * stored canvas position to screen/stage pixels.
 *
 * Formula: stage = canvas * scale + viewport.offset
 */
export function canvasToStage(canvasX: number, canvasY: number, viewport: Viewport): { x: number; y: number } {
  return {
    x: viewport.x + canvasX * viewport.scale,
    y: viewport.y + canvasY * viewport.scale,
  }
}
