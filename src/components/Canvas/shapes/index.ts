/**
 * Barrel export for all shape components.
 * Used by ObjectLayer to render board objects.
 */
export * from './shared'

// Shape components
export { RectangleShape } from './RectangleShape'
export { FrameShape } from './FrameShape'
export { CircleShape } from './CircleShape'
export { StickyShape } from './StickyShape'
export { TriangleShape } from './TriangleShape'
export { PolygonShape } from './PolygonShape'
export { StarShape } from './StarShape'
export { ArrowShape } from './ArrowShape'
export { PlusShape } from './PlusShape'
export { ParallelogramShape } from './ParallelogramShape'
export { CylinderShape } from './CylinderShape'
export { TabShape } from './TabShape'
export { TrapezoidShape } from './TrapezoidShape'
export { CircleCrossShape } from './CircleCrossShape'
export { LineShape } from './LineShape'
export { TextShape } from './TextShape'
export {
  PenShape,
  PenStrokePreview,
  ActiveStrokeLine,
  type CurrentPenStroke,
  type ActiveStrokeLineProps,
} from './PenShape'
export { EmojiShape } from './EmojiShape'
export { ImageShape } from './ImageShape'
export { DocumentShape } from './DocumentShape'
export { EmbedShape } from './EmbedShape'
export { LinkCardShape } from './LinkCardShape'
export { ArrowPreview } from './ArrowPreview'
export { ConnectorPreview } from './ConnectorPreview'
