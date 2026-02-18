# Coordinate System Guard Rails

## Single Source of Truth

**Canvas coordinates (x, y) are the ONLY stored coordinates.**

- Firestore: canvas coordinates only
- Konva render: canvas coordinates (viewport Group applies transform)
- Conversion happens **ONCE** at creation/click time

## Coordinate Spaces

| Space | Description | Example |
|-------|-------------|---------|
| **Stage** | `stage.getPointerPosition()` – pixels relative to stage container | Click at (500, 300) |
| **Canvas** | Infinite canvas space – stored in Firestore, used for render | Object at (1200, 800) |
| **Viewport** | Stage offset (x, y) and scale | Pan/zoom state |

## Conversion Formulas

### Stage → Canvas (use ONCE at object creation)

```javascript
canvasX = (stageX - viewport.x) / viewport.scale
canvasY = (stageY - viewport.y) / viewport.scale
```

Implemented in: `utils/coordinates.ts` → `stageToCanvas()`

### Canvas → Stage (use for overlay placement only)

```javascript
stageX = viewport.x + canvasX * viewport.scale
stageY = viewport.y + canvasY * viewport.scale
```

Implemented in: `utils/coordinates.ts` → `canvasToStage()`

For **position: fixed** overlays (viewport coordinates), add container offset:

```javascript
viewportX = containerRect.left + stageX
viewportY = containerRect.top + stageY
```

## Object Placement Flow

1. **Click** → InfiniteCanvas `handleClick` gets `stage.getPointerPosition()`
2. **Convert** → `stageToCanvas(pos.x, pos.y, viewport)` → canvas coords
3. **Pass** → `onBackgroundClick({ x: canvasX, y: canvasY, clientX, clientY })`
4. **Store** → BoardPage creates object with `position: { x: canvasX, y: canvasY }` (with type-specific offsets)
5. **Render** → ObjectLayer uses stored `position` directly (no conversion)
6. **Overlay** → When editing, convert canvas → stage (or viewport) for overlay placement only

## Object Type Offsets (canvas units)

All offsets are in canvas space (they scale with zoom):

| Type | Center offset | Dimensions |
|------|---------------|------------|
| Sticky | (-100, -100) | 200×200 |
| Rectangle | (-75, -50) | 150×100 |
| Circle | (-50, -50) | 100×100 |
| Triangle | (-50, -40) | 100×80 |
| Line | (-50, 0) to (+50, 0) | — |
| Emoji | (-16, -16) | 32×32 |
| Text | (0, 0) | 200×40 |
| Comment | (0, 0) | — |

## Common Mistakes (Avoid)

- ❌ Convert screen → canvas → screen → canvas (multiple conversions)
- ✅ Convert screen → canvas ONCE at creation

- ❌ Store screen coordinates anywhere
- ✅ Only store canvas coordinates

- ❌ Recompute position after creation
- ✅ Use stored position directly for rendering

- ❌ Apply viewport transform to stored coordinates
- ✅ Konva viewport Group handles transform automatically

## Files Using Coordinate Conversion

| File | Usage |
|------|-------|
| `InfiniteCanvas.tsx` | `stageToCanvas` at click, passes to `onBackgroundClick` |
| `BoardPage.tsx` | Receives canvas coords, creates objects, uses `canvasToStage` for text overlay |
| `ObjectLayer.tsx` | `stageToCanvas` for drag end (absolute position → canvas) |
| `CommentModal.tsx` | `canvasToStage` + container offset for fixed overlay |
| `StickyTextEditor.tsx` | `canvasToStage` for absolute overlay (within container) |
| `TextOverlayTextarea.tsx` | Uses screenX/screenY from parent (clientX/clientY or canvasToStage+offset) |
