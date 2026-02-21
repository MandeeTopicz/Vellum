/**
 * Template categories and catalog for the Templates modal.
 */
import type { CreateObjectInput } from '../services/objects'
import { DEFAULT_STICKY_SIZE } from '../types/objects'
import { STICKY_COLORS } from '../services/aiTools/shared'

/** Bbox for CreateObjectInput array (minX, minY, maxX, maxY, width, height). */
export interface CreateInputsBbox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/** Gets full bbox of CreateObjectInput array. */
export function getCreateInputsBbox(inputs: CreateObjectInput[]): CreateInputsBbox | null {
  if (inputs.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const input of inputs) {
    if (input.type === 'line') {
      minX = Math.min(minX, input.start.x, input.end.x)
      minY = Math.min(minY, input.start.y, input.end.y)
      maxX = Math.max(maxX, input.start.x, input.end.x)
      maxY = Math.max(maxY, input.start.y, input.end.y)
    } else if (input.type === 'pen') {
      for (const p of input.points) {
        minX = Math.min(minX, p[0])
        minY = Math.min(minY, p[1])
        maxX = Math.max(maxX, p[0])
        maxY = Math.max(maxY, p[1])
      }
    } else if ('position' in input) {
      const dims = 'dimensions' in input ? input.dimensions : undefined
      const w = dims?.width ?? 0
      const h = dims?.height ?? 0
      minX = Math.min(minX, input.position.x)
      minY = Math.min(minY, input.position.y)
      maxX = Math.max(maxX, input.position.x + w)
      maxY = Math.max(maxY, input.position.y + h)
    }
  }
  if (minX === Infinity || minY === Infinity) return null
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

/** Gets bbox min (top-left) of CreateObjectInput array. */
function getCreateInputsBboxMin(inputs: CreateObjectInput[]): { x: number; y: number } | null {
  if (inputs.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  for (const input of inputs) {
    if (input.type === 'line') {
      minX = Math.min(minX, input.start.x, input.end.x)
      minY = Math.min(minY, input.start.y, input.end.y)
    } else if (input.type === 'pen') {
      for (const p of input.points) {
        minX = Math.min(minX, p[0])
        minY = Math.min(minY, p[1])
      }
    } else if ('position' in input) {
      minX = Math.min(minX, input.position.x)
      minY = Math.min(minY, input.position.y)
    }
  }
  if (minX === Infinity || minY === Infinity) return null
  return { x: minX, y: minY }
}

/** Offsets a CreateObjectInput by (dx, dy). */
function offsetCreateInput(input: CreateObjectInput, dx: number, dy: number): CreateObjectInput {
  if (input.type === 'line') {
    return { ...input, start: { x: input.start.x + dx, y: input.start.y + dy }, end: { x: input.end.x + dx, y: input.end.y + dy } }
  }
  if (input.type === 'pen') {
    return { ...input, points: input.points.map((p) => [p[0] + dx, p[1] + dy] as [number, number]) }
  }
  if ('position' in input) {
    return { ...input, position: { x: input.position.x + dx, y: input.position.y + dy } }
  }
  return input
}

/**
 * Returns CreateObjectInput array with positions offset so bbox center lands at (cx, cy).
 */
export function centerCreateInputsAt(inputs: CreateObjectInput[], cx: number, cy: number): CreateObjectInput[] {
  const min = getCreateInputsBboxMin(inputs)
  if (!min || inputs.length === 0) return inputs
  let maxX = -Infinity
  let maxY = -Infinity
  for (const input of inputs) {
    if (input.type === 'line') {
      maxX = Math.max(maxX, input.start.x, input.end.x)
      maxY = Math.max(maxY, input.start.y, input.end.y)
    } else if (input.type === 'pen') {
      for (const p of input.points) {
        maxX = Math.max(maxX, p[0])
        maxY = Math.max(maxY, p[1])
      }
    } else if ('position' in input) {
      const dims = 'dimensions' in input ? input.dimensions : undefined
      const w = dims?.width ?? 0
      const h = dims?.height ?? 0
      maxX = Math.max(maxX, input.position.x + w)
      maxY = Math.max(maxY, input.position.y + h)
    }
  }
  const centerX = (min.x + maxX) / 2
  const centerY = (min.y + maxY) / 2
  const dx = cx - centerX
  const dy = cy - centerY
  return inputs.map((inp) => offsetCreateInput(inp, dx, dy))
}

export const TEMPLATE_CATEGORIES = [
  'Meetings & Workshops',
  'Project Management',
  'Product & Design',
  'Strategy & Planning',
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export interface TemplateDefinition {
  id: string
  title: string
  previewKind: 'kanban' | 'flow' | 'doc' | 'table' | 'timeline' | 'slides'
}

export const TEMPLATES_BY_CATEGORY: Record<string, TemplateDefinition[]> = {
  'Meetings & Workshops': [
    { id: 'swot', title: 'SWOT Analysis', previewKind: 'table' },
    { id: 'retrospective', title: 'Retrospective', previewKind: 'kanban' },
    { id: 'journeyMap', title: 'Journey Map', previewKind: 'timeline' },
    { id: 'icebreaker', title: 'Icebreaker', previewKind: 'table' },
    { id: 'standup', title: 'Standup', previewKind: 'timeline' },
    { id: 'retro-board', title: 'Retro Board', previewKind: 'kanban' },
  ],
  'Project Management': [
    { id: 'project-review', title: 'Project Review', previewKind: 'doc' },
    { id: 'weekly-okr', title: 'Weekly OKR', previewKind: 'kanban' },
    { id: 'sprint-backlog', title: 'Sprint Backlog', previewKind: 'doc' },
    { id: 'kanban-board', title: 'Kanban Board', previewKind: 'kanban' },
  ],
  'Product & Design': [
    { id: 'mind-map', title: 'Mind Map', previewKind: 'flow' },
    { id: 'brainstorm-grid', title: 'Brainstorm Grid', previewKind: 'table' },
    { id: 'wireframe', title: 'Wireframe', previewKind: 'doc' },
    { id: 'moodboard', title: 'Moodboard', previewKind: 'table' },
  ],
  'Strategy & Planning': [
    { id: 'eisenhower', title: 'Eisenhower Matrix', previewKind: 'flow' },
    { id: 'affinity', title: 'Affinity Diagram', previewKind: 'kanban' },
    { id: 'flowchart', title: 'Flowchart', previewKind: 'flow' },
    { id: 'slide-deck', title: 'Slide Deck', previewKind: 'slides' },
  ],
}

/**
 * Returns templates for a category.
 */
export function getTemplatesForCategory(category: string): TemplateDefinition[] {
  return TEMPLATES_BY_CATEGORY[category] ?? []
}

/** Format map: template key -> structure format for insertFormatsStructure fallback */
export const TEMPLATE_FORMAT_MAP: Record<string, string> = {
  'project-review': 'Doc',
  'weekly-okr': 'Kanban',
  icebreaker: 'Table',
  eisenhower: 'Flow Chart',
  standup: 'Timeline',
  'brainstorm-grid': 'Table',
  'mind-map': 'Flow Chart',
  affinity: 'Kanban',
  'kanban-board': 'Kanban',
  'sprint-backlog': 'Doc',
  'retro-board': 'Kanban',
  flowchart: 'Flow Chart',
  'slide-deck': 'Slides',
  wireframe: 'Doc',
  moodboard: 'Table',
}

const W = DEFAULT_STICKY_SIZE.width
const H = DEFAULT_STICKY_SIZE.height
const GAP = 24

/**
 * Builds a composed (pre-designed) template as CreateObjectInput[].
 * Returns [] for keys that should use format fallback.
 */
export function buildComposedTemplate(key: string): CreateObjectInput[] {
  const startX = 0
  const startY = 0

  switch (key) {
    case 'swot': {
      return [
        { type: 'sticky', position: { x: startX, y: startY }, dimensions: { width: W, height: H }, content: 'Strengths', fillColor: STICKY_COLORS.green ?? '#dcfce7', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + W + GAP, y: startY }, dimensions: { width: W, height: H }, content: 'Weaknesses', fillColor: STICKY_COLORS.red ?? '#fee2e2', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX, y: startY + H + GAP }, dimensions: { width: W, height: H }, content: 'Opportunities', fillColor: STICKY_COLORS.blue ?? '#dbeafe', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + W + GAP, y: startY + H + GAP }, dimensions: { width: W, height: H }, content: 'Threats', fillColor: STICKY_COLORS.orange ?? '#ffedd5', cornerRadius: 12 },
      ]
    }
    case 'retrospective': {
      const colW = W + GAP
      return [
        { type: 'sticky', position: { x: startX, y: startY }, dimensions: { width: W, height: H }, content: 'Went well', fillColor: STICKY_COLORS.green ?? '#dcfce7', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW, y: startY }, dimensions: { width: W, height: H }, content: "Didn't go well", fillColor: STICKY_COLORS.pink ?? '#fce7f3', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW * 2, y: startY }, dimensions: { width: W, height: H }, content: 'Ideas', fillColor: STICKY_COLORS.blue ?? '#dbeafe', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW * 3, y: startY }, dimensions: { width: W, height: H }, content: 'Action items', fillColor: STICKY_COLORS.orange ?? '#ffedd5', cornerRadius: 12 },
      ]
    }
    case 'journeyMap': {
      const items: CreateObjectInput[] = []
      for (let i = 0; i < 5; i++) {
        items.push({
          type: 'sticky',
          position: { x: startX + i * (W + GAP), y: startY },
          dimensions: { width: W, height: H },
          content: `Step ${i + 1}`,
          fillColor: STICKY_COLORS.yellow ?? '#fef08a',
          cornerRadius: 12,
        })
      }
      return items
    }
    case 'project-review': {
      const cx = 250
      const cy = 220
      const cw = 120
      const ch = 75
      const colW = 95
      const colH = 48
      const colGap = 8
      const headerH = 40
      const items: CreateObjectInput[] = []
      items.push({
        type: 'sticky',
        position: { x: cx - cw / 2, y: cy - ch / 2 },
        dimensions: { width: cw, height: ch },
        content: 'Project Review',
        fillColor: '#f3f4f6',
        cornerRadius: 12,
      })
      const sections: { label: string; x: number; y: number }[] = [
        { label: 'Initial', x: cx - colW / 2, y: 15 },
        { label: 'Assess', x: cx + 95, y: cy - headerH - colH - colGap / 2 },
        { label: 'Migrate', x: cx - colW / 2, y: cy + ch / 2 + 35 },
        { label: 'Operate & Improve', x: 25, y: cy - headerH - colH - colGap / 2 },
      ]
      for (const s of sections) {
        items.push({
          type: 'sticky',
          position: { x: s.x, y: s.y },
          dimensions: { width: colW, height: headerH },
          content: s.label,
          fillColor: '#ffffff',
          cornerRadius: 8,
        })
        items.push({
          type: 'sticky',
          position: { x: s.x, y: s.y + colH },
          dimensions: { width: colW, height: colH },
          content: '',
          fillColor: STICKY_COLORS.yellow ?? '#fef08a',
          cornerRadius: 8,
        })
        items.push({
          type: 'sticky',
          position: { x: s.x, y: s.y + colH * 2 + colGap },
          dimensions: { width: colW, height: colH },
          content: '',
          fillColor: STICKY_COLORS.blue ?? '#dbeafe',
          cornerRadius: 8,
        })
      }
      const centerLeft = cx - cw / 2
      const centerRight = cx + cw / 2
      const centerTop = cy - ch / 2
      const centerBottom = cy + ch / 2
      const assessLeft = cx + 95
      const migrTop = cy + ch / 2 + 35
      const operRight = 25 + colW
        items.push(
        { type: 'line', start: { x: cx, y: centerTop }, end: { x: cx, y: 15 + headerH + 4 }, strokeColor: '#64748b', strokeWidth: 2, connectionType: 'arrow-straight' },
        { type: 'line', start: { x: centerRight, y: cy }, end: { x: assessLeft - 6, y: cy }, strokeColor: '#64748b', strokeWidth: 2, connectionType: 'arrow-straight' },
        { type: 'line', start: { x: cx, y: centerBottom }, end: { x: cx, y: migrTop - 6 }, strokeColor: '#64748b', strokeWidth: 2, connectionType: 'arrow-straight' },
        { type: 'line', start: { x: centerLeft, y: cy }, end: { x: operRight + 6, y: cy }, strokeColor: '#64748b', strokeWidth: 2, connectionType: 'arrow-straight' }
      )
      return items
    }
    case 'retro-board': {
      const colW = W + GAP
      return [
        { type: 'sticky', position: { x: startX, y: startY }, dimensions: { width: W, height: H }, content: 'What went well?', fillColor: STICKY_COLORS.green ?? '#dcfce7', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW, y: startY }, dimensions: { width: W, height: H }, content: 'What needs improvement?', fillColor: STICKY_COLORS.pink ?? '#fce7f3', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW * 2, y: startY }, dimensions: { width: W, height: H }, content: 'Next Steps', fillColor: STICKY_COLORS.blue ?? '#dbeafe', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX, y: startY + H + GAP }, dimensions: { width: W, height: H }, content: '', fillColor: STICKY_COLORS.yellow ?? '#fef08a', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW, y: startY + H + GAP }, dimensions: { width: W, height: H }, content: '', fillColor: STICKY_COLORS.yellow ?? '#fef08a', cornerRadius: 12 },
        { type: 'sticky', position: { x: startX + colW * 2, y: startY + H + GAP }, dimensions: { width: W, height: H }, content: '', fillColor: STICKY_COLORS.yellow ?? '#fef08a', cornerRadius: 12 },
      ]
    }
    default:
      return []
  }
}

/** Preview scale for template thumbnails */
const PREVIEW_W = 36
const PREVIEW_H = 28
const PREVIEW_GAP = 8

/**
 * Returns CreateObjectInput[] for template preview thumbnails.
 * Reflects actual template content: words, colors, layout.
 * @param key - Template id
 * @returns Array of CreateObjectInput for rendering in thumbnail
 */
export function getTemplatePreviewObjects(key: string): CreateObjectInput[] {
  const pw = PREVIEW_W
  const ph = PREVIEW_H
  const g = PREVIEW_GAP

  const composed = buildComposedTemplate(key)
  if (composed.length > 0) {
    return scaleCreateInputs(composed, pw / W, ph / H)
  }

  switch (key) {
    case 'icebreaker':
      return [
        { type: 'sticky', position: { x: 0, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Name', fillColor: '#fef08a', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Answer', fillColor: '#dbeafe', cornerRadius: 4 },
      ]
    case 'standup':
      return [
        { type: 'sticky', position: { x: 0, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Mon', fillColor: '#fef08a', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Tue', fillColor: '#dbeafe', cornerRadius: 4 },
        { type: 'sticky', position: { x: (pw + g) * 2, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Wed', fillColor: '#dcfce7', cornerRadius: 4 },
        { type: 'line', start: { x: pw / 2, y: ph + 4 }, end: { x: (pw + g) * 2 + pw / 2, y: ph + 4 }, strokeColor: '#94a3b8', strokeWidth: 1 },
      ]
    case 'weekly-okr':
    case 'kanban-board':
    case 'affinity':
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw + 8, height: ph * 3 + 12 }, fillColor: '#f3f4f6', strokeColor: '#e5e7eb', cornerRadius: 6 },
        { type: 'rectangle', position: { x: pw + g + 4, y: 0 }, dimensions: { width: pw + 8, height: ph * 3 + 12 }, fillColor: '#f3f4f6', strokeColor: '#e5e7eb', cornerRadius: 6 },
        { type: 'rectangle', position: { x: (pw + g + 4) * 2, y: 0 }, dimensions: { width: pw + 8, height: ph * 3 + 12 }, fillColor: '#f3f4f6', strokeColor: '#e5e7eb', cornerRadius: 6 },
        { type: 'sticky', position: { x: 4, y: 4 }, dimensions: { width: pw, height: ph - 2 }, content: 'To Do', fillColor: '#fff', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g + 8, y: 4 }, dimensions: { width: pw, height: ph - 2 }, content: 'Progress', fillColor: '#fff', cornerRadius: 4 },
        { type: 'sticky', position: { x: (pw + g + 4) * 2 + 4, y: 4 }, dimensions: { width: pw, height: ph - 2 }, content: 'Done', fillColor: '#fff', cornerRadius: 4 },
        { type: 'sticky', position: { x: 4, y: ph + 8 }, dimensions: { width: pw, height: ph }, content: 'Task 1', fillColor: '#fef08a', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g + 8, y: ph + 8 }, dimensions: { width: pw, height: ph }, content: 'Task 2', fillColor: '#dbeafe', cornerRadius: 4 },
        { type: 'sticky', position: { x: (pw + g + 4) * 2 + 4, y: ph + 8 }, dimensions: { width: pw, height: ph }, content: 'Task 3', fillColor: '#dcfce7', cornerRadius: 4 },
      ]
    case 'sprint-backlog':
    case 'wireframe':
      return [
        { type: 'text', position: { x: 0, y: 0 }, dimensions: { width: pw * 4, height: ph * 2 }, content: 'Document\nAdd content...' },
        { type: 'rectangle', position: { x: 0, y: ph * 2 + g }, dimensions: { width: pw * 2, height: ph }, fillColor: '#f3f4f6', strokeColor: '#e5e7eb', cornerRadius: 4 },
      ]
    case 'eisenhower':
      return [
        { type: 'sticky', position: { x: 0, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Urgent', fillColor: '#fee2e2', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Important', fillColor: '#dcfce7', cornerRadius: 4 },
        { type: 'sticky', position: { x: 0, y: ph + g }, dimensions: { width: pw, height: ph }, content: 'Not Urgent', fillColor: '#dbeafe', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: ph + g }, dimensions: { width: pw, height: ph }, content: 'Delegate', fillColor: '#fef08a', cornerRadius: 4 },
      ]
    case 'mind-map':
    case 'flowchart':
      return [
        { type: 'sticky', position: { x: pw, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Start', fillColor: '#dcfce7', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw, y: ph + g }, dimensions: { width: pw, height: ph }, content: 'Process', fillColor: '#dbeafe', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw, y: (ph + g) * 2 }, dimensions: { width: pw, height: ph }, content: 'End', fillColor: '#fee2e2', cornerRadius: 4 },
        { type: 'line', start: { x: pw + pw / 2, y: ph }, end: { x: pw + pw / 2, y: ph + g }, strokeColor: '#64748b', strokeWidth: 1 },
        { type: 'line', start: { x: pw + pw / 2, y: ph + g + ph }, end: { x: pw + pw / 2, y: (ph + g) * 2 }, strokeColor: '#64748b', strokeWidth: 1 },
      ]
    case 'brainstorm-grid':
    case 'moodboard':
      return [
        { type: 'sticky', position: { x: 0, y: 0 }, dimensions: { width: pw, height: ph }, content: '1', fillColor: '#fef08a', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: 0 }, dimensions: { width: pw, height: ph }, content: '2', fillColor: '#dbeafe', cornerRadius: 4 },
        { type: 'sticky', position: { x: 0, y: ph + g }, dimensions: { width: pw, height: ph }, content: '3', fillColor: '#dcfce7', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: ph + g }, dimensions: { width: pw, height: ph }, content: '4', fillColor: '#fce7f3', cornerRadius: 4 },
      ]
    case 'slide-deck':
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw * 3, height: ph * 2 }, fillColor: '#f3f4f6', strokeColor: '#e5e7eb', cornerRadius: 4 },
        { type: 'text', position: { x: 8, y: 8 }, dimensions: { width: pw * 3 - 16, height: ph - 8 }, content: 'Slide 1' },
        { type: 'rectangle', position: { x: 0, y: ph * 2 + g }, dimensions: { width: pw * 3, height: ph * 2 }, fillColor: '#ffffff', strokeColor: '#e5e7eb', cornerRadius: 4 },
      ]
    default:
      return [
        { type: 'sticky', position: { x: 0, y: 0 }, dimensions: { width: pw * 2, height: ph * 2 }, content: key, fillColor: '#fef08a', cornerRadius: 6 },
      ]
  }
}

/** Scales CreateObjectInput positions and dimensions by factor. */
function scaleCreateInputs(inputs: CreateObjectInput[], sx: number, sy: number): CreateObjectInput[] {
  return inputs.map((inp) => {
    if (inp.type === 'line') {
      return {
        ...inp,
        start: { x: inp.start.x * sx, y: inp.start.y * sy },
        end: { x: inp.end.x * sx, y: inp.end.y * sy },
      }
    }
    if (inp.type === 'pen') {
      return { ...inp, points: inp.points.map(([x, y]) => [x * sx, y * sy] as [number, number]) }
    }
    if ('position' in inp) {
      const dims = 'dimensions' in inp ? inp.dimensions : undefined
      return {
        ...inp,
        position: { x: inp.position.x * sx, y: inp.position.y * sy },
        ...(dims && { dimensions: { width: dims.width * sx, height: dims.height * sy } }),
      }
    }
    return inp
  })
}
