/**
 * Template categories and catalog for the Templates modal.
 */
import type { CreateObjectInput } from '../services/objects'
import { isNestableType } from './frames'
import { DEFAULT_STICKY_SIZE, DEFAULT_TEXT_STYLE } from '../types/objects'
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
    { id: 'retrospective', title: 'Sprint Retrospective Template', previewKind: 'kanban' },
    { id: 'journeyMap', title: 'Journey Map', previewKind: 'timeline' },
    { id: 'standup', title: 'Daily Stand-up Meeting', previewKind: 'timeline' },
    { id: 'retro-board', title: 'Retro Board', previewKind: 'kanban' },
  ],
  'Project Management': [
    { id: 'project-review', title: 'Project Review Template', previewKind: 'doc' },
    { id: 'weekly-okr', title: 'Weekly OKR', previewKind: 'kanban' },
    { id: 'sprint-backlog', title: 'Project Budget Breakdown', previewKind: 'doc' },
    { id: 'kanban-board', title: 'Kanban Board', previewKind: 'kanban' },
  ],
  'Product & Design': [
    { id: 'mind-map', title: 'Mind Map', previewKind: 'flow' },
  ],
  'Strategy & Planning': [
    { id: 'flowchart', title: 'Flow Chart', previewKind: 'flow' },
  ],
}

/**
 * Returns templates for a category.
 */
export function getTemplatesForCategory(category: string): TemplateDefinition[] {
  return TEMPLATES_BY_CATEGORY[category] ?? []
}

/** Template key -> display title for frame */
export const TEMPLATE_TITLES: Record<string, string> = {
  swot: 'SWOT Analysis',
  retrospective: 'Sprint Retrospective Template',
  journeyMap: 'Journey Map',
  'project-review': 'Project Review Template',
  'retro-board': 'Retro Board',
  'kanban-board': 'Kanban Board',
  'weekly-okr': 'Weekly OKR Performance Review',
  flowchart: 'Flow Chart',
  standup: 'Daily Stand-up Meeting',
  'sprint-backlog': 'Project Budget Breakdown',
}

const FRAME_PADDING = 24

/**
 * Wraps composed template elements in a frame. Returns frame input and child inputs
 * with parentId and local coords so the template moves as one unit.
 * @param inputs - CreateObjectInput[] from buildComposedTemplate
 * @param _templateTitle - Unused; frame titles are omitted
 * @param framePadding - Optional padding override (default FRAME_PADDING)
 */
export function wrapComposedTemplateInFrame(
  inputs: CreateObjectInput[],
  _templateTitle?: string,
  framePadding?: number
): { frameInput: CreateObjectInput; childInputs: CreateObjectInput[] } {
  const padding = framePadding ?? FRAME_PADDING
  const bbox = getCreateInputsBbox(inputs)
  if (!bbox || inputs.length === 0) {
    const fallbackFrame: CreateObjectInput = {
      type: 'frame',
      position: { x: 0, y: 0 },
      dimensions: { width: 400, height: 300 },
    }
    return { frameInput: fallbackFrame, childInputs: [] }
  }

  const frameX = bbox.minX - padding
  const frameY = bbox.minY - padding
  const frameW = bbox.width + padding * 2
  const frameH = bbox.height + padding * 2

  const frameInput: CreateObjectInput = {
    type: 'frame',
    position: { x: frameX, y: frameY },
    dimensions: { width: frameW, height: frameH },
  }

  const childInputs: CreateObjectInput[] = []
  for (const inp of inputs) {
    if (inp.type === 'line' || inp.type === 'pen') {
      childInputs.push({ ...inp })
    } else if ('position' in inp && isNestableType(inp.type)) {
      const localX = inp.position.x - frameX
      const localY = inp.position.y - frameY
      childInputs.push({
        ...inp,
        position: { x: localX, y: localY },
        localX,
        localY,
      } as CreateObjectInput & { localX: number; localY: number })
    } else {
      childInputs.push(inp)
    }
  }
  return { frameInput, childInputs }
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
}

/** Approximate dimensions for format templates (not composed) for collision-aware placement */
const FORMAT_TEMPLATE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  Kanban: { width: 1100, height: 450 },
  'Flow Chart': { width: 450, height: 450 },
  'Mind Map': { width: 500, height: 400 },
  Timeline: { width: 600, height: 200 },
  Doc: { width: 400, height: 200 },
  Table: { width: 320, height: 220 },
  Slides: { width: 400, height: 400 },
}

/**
 * Returns approximate dimensions for a format kind (e.g. 'Kanban', 'Flow Chart').
 * @param formatKind - Format kind from insertFormatsStructure
 */
export function getFormatPlacementDimensions(formatKind: string): { width: number; height: number } {
  return FORMAT_TEMPLATE_DIMENSIONS[formatKind] ?? { width: 400, height: 300 }
}

/**
 * Returns the approximate width and height of a template for collision-aware placement.
 * @param templateKey - Template id (e.g. 'kanban-board', 'swot')
 * @returns Dimensions in canvas units
 */
export function getTemplatePlacementDimensions(templateKey: string): { width: number; height: number } {
  const composed = buildComposedTemplate(templateKey)
  if (composed.length > 0) {
    const framePadding = templateKey === 'swot' ? 48 : 24
    const { frameInput } = wrapComposedTemplateInFrame(composed, undefined, framePadding)
    const dims = 'dimensions' in frameInput ? frameInput.dimensions : { width: 400, height: 300 }
    return dims
  }
  const format = TEMPLATE_FORMAT_MAP[templateKey]
  return getFormatPlacementDimensions(format ?? 'Doc')
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
      const SLIDE_W = 800
      const SLIDE_H = 900
      const GAP_Q = 10
      const PAD = 24
      const quadW = (SLIDE_W - PAD * 2 - GAP_Q) / 2
      const quadH = (SLIDE_H - 120 - PAD * 2 - GAP_Q) / 2
      const HEADER_H = 44
      const BODY_STYLE = { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#4b5563' }
      const quadrants: Array<{
        x: number
        y: number
        headerBg: string
        bodyBg: string
        headerLabel: string
        bodyText: string
      }> = [
        {
          x: startX + PAD,
          y: startY + 100,
          headerBg: '#4DC8C8',
          bodyBg: '#E8F8F8',
          headerLabel: 'Strengths',
          bodyText: 'Things that benefit a product (e.g design, brand awareness, etc.)',
        },
        {
          x: startX + PAD + quadW + GAP_Q,
          y: startY + 100,
          headerBg: '#F5A623',
          bodyBg: '#FDF8E8',
          headerLabel: 'Weaknesses',
          bodyText: 'Things that harm your competitors (e.g. outdated UI or lack of must-have features)',
        },
        {
          x: startX + PAD,
          y: startY + 100 + quadH + GAP_Q,
          headerBg: '#4DC8C8',
          bodyBg: '#E8F8F8',
          headerLabel: 'Opportunities',
          bodyText: "Situations that can improve a competitor's positioning (e.g. expansion into adjacent markets or niches)",
        },
        {
          x: startX + PAD + quadW + GAP_Q,
          y: startY + 100 + quadH + GAP_Q,
          headerBg: '#F47C7C',
          bodyBg: '#FDE8E8',
          headerLabel: 'Threats',
          bodyText: 'Things or situations that can damage their competitiveness.',
        },
      ]

      const items: CreateObjectInput[] = []

      items.push({
        type: 'rectangle',
        position: { x: startX, y: startY },
        dimensions: { width: SLIDE_W, height: SLIDE_H },
        fillColor: '#FFFFFF',
      })

      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + PAD },
        dimensions: { width: SLIDE_W - PAD * 2, height: 56 },
        content: 'SWOT Analysis',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 32, bold: true, fontColor: '#1A2535', textAlign: 'center' },
      })

      for (const q of quadrants) {
        items.push({
          type: 'rectangle',
          position: { x: q.x, y: q.y },
          dimensions: { width: quadW, height: quadH },
          fillColor: q.bodyBg,
          cornerRadius: 12,
        })
        items.push({
          type: 'rectangle',
          position: { x: q.x, y: q.y },
          dimensions: { width: quadW, height: HEADER_H },
          fillColor: q.headerBg,
          cornerRadius: 0,
        })
        items.push({
          type: 'text',
          position: { x: q.x + 14, y: q.y + 10 },
          dimensions: { width: quadW - 28, height: HEADER_H - 20 },
          content: q.headerLabel,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 14, bold: true, fontColor: '#ffffff', textAlign: 'left' },
        })
        items.push({
          type: 'text',
          position: { x: q.x + 14, y: q.y + HEADER_H + 14 },
          dimensions: { width: quadW - 28, height: quadH - HEADER_H - 28 },
          content: q.bodyText,
          textStyle: BODY_STYLE,
        })
      }

      return items
    }
    case 'retrospective': {
      const SLIDE_W = 1200
      const SLIDE_H = 675
      const PAD = 24
      const DARK_BG = '#1A2535'
      const LIKED_HEADER = '#E8523A'
      const LIKED_BODY = '#fde8e6'
      const LEARNED_HEADER = '#8B9E3A'
      const LEARNED_BODY = '#e8f0c8'
      const LACKED_HEADER = '#D4A017'
      const LACKED_BODY = '#fef3c7'
      const LONGED_HEADER = '#3A9E8B'
      const LONGED_BODY = '#ccf0eb'
      const CARD_TEXT = 'Insert your desired text here.'
      const CARD_TEXT_STYLE = { ...DEFAULT_TEXT_STYLE, fontSize: 11, fontColor: '#6b7280' }
      const SUBTITLE_STYLE = { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#ffffff', italic: true }

      const items: CreateObjectInput[] = []

      // Dark background
      items.push({
        type: 'rectangle',
        position: { x: startX, y: startY },
        dimensions: { width: SLIDE_W, height: SLIDE_H },
        fillColor: DARK_BG,
      })

      // Title: "Sprint Retrospective Template" — white, regular weight, top left
      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + PAD },
        dimensions: { width: 600, height: 44 },
        content: 'Sprint Retrospective Template',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 28, bold: false, fontColor: '#f1f5f9' },
      })

      // Metadata row (below title): 4 fields — left pair (Team + empty), right pair (Date + empty)
      const metaY = startY + 80
      const metaH = 36
      const pairGap = 16
      const halfW = SLIDE_W / 2 - PAD - pairGap / 2
      const field1W = Math.floor(halfW * 0.35)
      const field2W = halfW - field1W + 1
      const field3W = Math.floor(halfW * 0.35)
      const field4W = halfW - field3W + 1
      const leftPairX = startX + PAD
      const rightPairX = startX + SLIDE_W / 2 + pairGap / 2

      items.push({
        type: 'sticky',
        position: { x: leftPairX, y: metaY },
        dimensions: { width: field1W, height: metaH },
        content: 'Team',
        fillColor: LIKED_HEADER,
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, fontColor: '#ffffff' },
        cornerRadius: 8,
      })
      items.push({
        type: 'sticky',
        position: { x: leftPairX + field1W - 1, y: metaY },
        dimensions: { width: field2W, height: metaH },
        content: '',
        fillColor: '#f8fafc',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#64748b' },
        cornerRadius: 8,
      })
      items.push({
        type: 'sticky',
        position: { x: rightPairX, y: metaY },
        dimensions: { width: field3W, height: metaH },
        content: 'Date: MM/DD/YY',
        fillColor: LEARNED_HEADER,
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, fontColor: '#ffffff' },
        cornerRadius: 8,
      })
      items.push({
        type: 'sticky',
        position: { x: rightPairX + field3W - 1, y: metaY },
        dimensions: { width: field4W, height: metaH },
        content: '',
        fillColor: '#f8fafc',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#64748b' },
        cornerRadius: 8,
      })

      // 4 columns: Liked, Learned, Lacked, Longed for
      const colCount = 4
      const colGap = 4
      const colW = (SLIDE_W - PAD * 2 - colGap * 3) / colCount
      const headerH = 40
      const colsY = startY + 132
      const colsH = SLIDE_H - colsY - PAD

      const cols: Array<{ header: string; headerBg: string; bodyBg: string; subtitle: string }> = [
        { header: 'Liked', headerBg: LIKED_HEADER, bodyBg: LIKED_BODY, subtitle: 'What did the team like?' },
        { header: 'Learned', headerBg: LEARNED_HEADER, bodyBg: LEARNED_BODY, subtitle: 'What did the team learn?' },
        { header: 'Lacked', headerBg: LACKED_HEADER, bodyBg: LACKED_BODY, subtitle: 'What did the team lack?' },
        { header: 'Longed for', headerBg: LONGED_HEADER, bodyBg: LONGED_BODY, subtitle: 'What did the team long for?' },
      ]

      const cardW = 140
      const cardH = 90
      const bodyTop = colsY + headerH
      const bodyH = colsH - headerH

      for (let c = 0; c < colCount; c++) {
        const cx = startX + PAD + c * (colW + colGap)
        const col = cols[c]
        // Column header
        items.push({
          type: 'sticky',
          position: { x: cx, y: colsY },
          dimensions: { width: colW, height: headerH },
          content: col.header,
          fillColor: col.headerBg,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 14, bold: true, fontColor: '#ffffff', textAlign: 'center' },
          cornerRadius: 8,
        })
        // Column body background (rounded bottom corners)
        items.push({
          type: 'rectangle',
          position: { x: cx, y: bodyTop },
          dimensions: { width: colW, height: bodyH },
          fillColor: col.bodyBg,
          cornerRadius: 8,
        })
        // Subtitle
        items.push({
          type: 'text',
          position: { x: cx + 12, y: bodyTop + 12 },
          dimensions: { width: colW - 24, height: 20 },
          content: col.subtitle,
          textStyle: SUBTITLE_STYLE,
        })
        // 3 staggered cards per column: top left, middle right, bottom left (slight rotation -6 to +6)
        const cardOffsets: Array<{ x: number; y: number; rot: number }> = [
          { x: 12, y: 44, rot: -4 },
          { x: colW - cardW - 20, y: bodyH / 2 - cardH / 2 - 10, rot: 5 },
          { x: 12, y: bodyH - cardH - 20, rot: -3 },
        ]
        for (let i = 0; i < 3; i++) {
          const off = cardOffsets[i]
          const cardX = cx + off.x
          const cardY = bodyTop + off.y
          items.push({
            type: 'rectangle',
            position: { x: cardX, y: cardY },
            dimensions: { width: cardW, height: cardH },
            fillColor: '#ffffff',
            strokeColor: '#94a3b8',
            strokeWidth: 1,
            strokeStyle: 'dashed',
            cornerRadius: 6,
            rotation: off.rot,
          } as CreateObjectInput)
          items.push({
            type: 'text',
            position: { x: cardX + 10, y: cardY + 12 },
            dimensions: { width: cardW - 20, height: cardH - 24 },
            content: CARD_TEXT,
            textStyle: CARD_TEXT_STYLE,
            rotation: off.rot,
          } as CreateObjectInput)
        }
      }

      return items
    }
    case 'standup': {
      const SLIDE_W = 1200
      const SLIDE_H = 675
      const PAD = 24
      const DARK_BG = '#2C3E50'
      const BORDER = 1
      const BORDER_COLOR = '#6b7280'
      const PLACEHOLDER = 'Type your text here..'
      const PLACEHOLDER_STYLE = { ...DEFAULT_TEXT_STYLE, fontSize: 11, fontColor: '#6b7280', italic: true }
      const CELL_PAD = 8
      const items: CreateObjectInput[] = []

      const labelColW = 80
      const contentColCount = 3
      const headerH = 44
      const sectionRowCount = 3
      const rowH = 72
      const sectionH = headerH + sectionRowCount * rowH
      const contentTotalW = SLIDE_W - PAD * 2 - labelColW - BORDER * 4
      const contentColW = Math.floor(contentTotalW / contentColCount)

      const tableX = startX + PAD
      const tableY = startY + 80

      items.push({
        type: 'rectangle',
        position: { x: startX, y: startY },
        dimensions: { width: SLIDE_W, height: SLIDE_H },
        fillColor: DARK_BG,
      })

      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + PAD },
        dimensions: { width: 600, height: 48 },
        content: 'Daily Stand-up Meeting Template',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 28, bold: false, fontColor: '#f1f5f9' },
      })

      const sections: Array<{
        labelBg: string
        labelText: string
        sectionBg: string
      }> = [
        {
          labelBg: '#4A90D9',
          labelText: 'What did you do yesterday?',
          sectionBg: '#D6E8F7',
        },
        {
          labelBg: '#5CB85C',
          labelText: 'What will you work on today?',
          sectionBg: '#D5F0D5',
        },
        {
          labelBg: '#F0AD4E',
          labelText: 'Any blockers?',
          sectionBg: '#FDF3CD',
        },
      ]

      let y = tableY

      for (let c = 0; c < contentColCount; c++) {
        const hx = tableX + labelColW + BORDER + c * (contentColW + BORDER)
        items.push({
          type: 'sticky',
          position: { x: hx, y },
          dimensions: { width: contentColW, height: headerH },
          content: '<Name Here>',
          fillColor: '#f8fafc',
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 14, fontColor: '#1a1a1a', textAlign: 'center' },
          cornerRadius: 0,
        })
      }
      y += headerH + BORDER

      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s]
        const labelCellH = sectionH - BORDER

        items.push({
          type: 'sticky',
          position: { x: tableX, y },
          dimensions: { width: labelColW, height: labelCellH },
          content: sec.labelText,
          fillColor: sec.labelBg,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 13, bold: true, fontColor: '#ffffff' },
          cornerRadius: 0,
          rotation: -90,
        } as CreateObjectInput)

        for (let r = 0; r < sectionRowCount; r++) {
          for (let c = 0; c < contentColCount; c++) {
            const cx = tableX + labelColW + BORDER + c * (contentColW + BORDER)
            const cy = y + r * (rowH + BORDER) + BORDER
            const cellW = contentColW - BORDER
            const cellH = rowH - BORDER
            const boxW = cellW - CELL_PAD * 2
            const boxH = cellH - CELL_PAD * 2
            const boxX = cx + CELL_PAD + BORDER / 2
            const boxY = cy + CELL_PAD

            items.push({
              type: 'rectangle',
              position: { x: cx, y: cy },
              dimensions: { width: cellW, height: cellH },
              fillColor: sec.sectionBg,
              strokeColor: BORDER_COLOR,
              strokeWidth: BORDER,
              cornerRadius: 0,
            })
            items.push({
              type: 'rectangle',
              position: { x: boxX, y: boxY },
              dimensions: { width: boxW, height: boxH },
              fillColor: '#ffffff',
              strokeColor: '#d1d5db',
              strokeWidth: 1,
              cornerRadius: 4,
            })
            items.push({
              type: 'text',
              position: { x: boxX + 8, y: boxY + 8 },
              dimensions: { width: boxW - 16, height: boxH - 16 },
              content: PLACEHOLDER,
              textStyle: PLACEHOLDER_STYLE,
            })
          }
        }
        y += sectionH
      }

      return items
    }
    case 'journeyMap': {
      const steps = 5
      const gap = 200
      const checkpointW = 120
      const checkpointH = 50
      const lineYOffset = 24
      const dotSize = 12
      const contentH = 90
      const contentGap = 16
      const items: CreateObjectInput[] = []
      for (let i = 0; i < steps; i++) {
        const x = startX + i * gap
        items.push({
          type: 'sticky',
          position: { x, y: startY },
          dimensions: { width: checkpointW, height: checkpointH },
          content: `Step ${i + 1}`,
          fillColor: STICKY_COLORS.yellow ?? '#fef08a',
          cornerRadius: 12,
        })
        items.push({
          type: 'sticky',
          position: { x, y: startY + checkpointH + lineYOffset + dotSize + contentGap },
          dimensions: { width: checkpointW, height: contentH },
          content: '',
          fillColor: STICKY_COLORS.blue ?? '#dbeafe',
          cornerRadius: 8,
        })
      }
      const lineY = startY + checkpointH + lineYOffset
      const firstX = startX + checkpointW / 2
      const lastX = startX + (steps - 1) * gap + checkpointW / 2
      items.push({
        type: 'line',
        start: { x: firstX, y: lineY },
        end: { x: lastX, y: lineY },
        strokeColor: '#94a3b8',
        strokeWidth: 2,
      })
      for (let i = 0; i < steps; i++) {
        const centerX = startX + i * gap + checkpointW / 2
        items.push({
          type: 'circle',
          position: { x: centerX - dotSize / 2, y: lineY - dotSize / 2 },
          dimensions: { width: dotSize, height: dotSize },
          fillColor: '#64748b',
          strokeColor: '#475569',
        })
      }
      return items
    }
    case 'project-review': {
      const SLIDE_W = 1200
      const PAD = 24
      const TABLE_W = SLIDE_W - PAD * 2
      const ROW_H = 52
      const BORDER = 1
      const PLACEHOLDER = 'This is a sample text. You simply add your own text and description here'
      const PLACEHOLDER_STYLE = { ...DEFAULT_TEXT_STYLE, fontSize: 11, fontColor: '#6b7280' }
      const col1W = Math.floor(TABLE_W * 0.25)
      const col2W = Math.floor(TABLE_W * 0.30)
      const col3W = Math.floor(TABLE_W * 0.22)
      const col4W = TABLE_W - col1W - col2W - col3W - BORDER * 3
      const tableY = startY + 100
      const items: CreateObjectInput[] = []

      // Title: "Project Review" — large, light weight, dark navy
      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + PAD },
        dimensions: { width: 500, height: 48 },
        content: 'Project Review',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 36, bold: false, fontColor: '#1A2535' },
      })
      // Subtitle: "Enter your subhead line here"
      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + 62 },
        dimensions: { width: 500, height: 24 },
        content: 'Enter your subhead line here',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 16, bold: false, fontColor: '#6b7280' },
      })

      const rows: Array<{
        label: string
        labelBg: string
        labelContent: string
        col2Bg: string
        col3Bg: string
        col4Bg: string
        col2Content: string
        col3Content: string
        col4Content: string
      }> = [
        {
          label: 'Project Title',
          labelBg: '#3ABFAA',
          labelContent: '✏️ Project Title',
          col2Bg: '#3ABFAA',
          col3Bg: '#4A4A4A',
          col4Bg: '#4A4A4A',
          col2Content: 'Project Title Here',
          col3Content: 'Date',
          col4Content: 'MM/DD/YY',
        },
        {
          label: 'Client / Organization Details',
          labelBg: '#E8873A',
          labelContent: '👤 Client / Organization Details',
          col2Bg: '#ffffff',
          col3Bg: '#ffffff',
          col4Bg: '#ffffff',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
        {
          label: 'Introduction / Overview',
          labelBg: '#E8B83A',
          labelContent: '📋 Introduction / Overview',
          col2Bg: '#F5F5F5',
          col3Bg: '#F5F5F5',
          col4Bg: '#F5F5F5',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
        {
          label: 'Project Objective',
          labelBg: '#D94F3A',
          labelContent: '🎯 Project Objective',
          col2Bg: '#ffffff',
          col3Bg: '#ffffff',
          col4Bg: '#ffffff',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
        {
          label: 'Project Scope',
          labelBg: '#3A6E8B',
          labelContent: '⊙ Project Scope',
          col2Bg: '#F5F5F5',
          col3Bg: '#F5F5F5',
          col4Bg: '#F5F5F5',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
        {
          label: 'Target Audience',
          labelBg: '#6B6B6B',
          labelContent: '👥 Target Audience',
          col2Bg: '#ffffff',
          col3Bg: '#ffffff',
          col4Bg: '#ffffff',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
        {
          label: 'Success Factor',
          labelBg: '#7A6A3A',
          labelContent: '🏆 Success Factor',
          col2Bg: '#F5F5F5',
          col3Bg: '#F5F5F5',
          col4Bg: '#F5F5F5',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
        {
          label: 'Budget Details',
          labelBg: '#3A3A3A',
          labelContent: '🧮 Budget Details',
          col2Bg: '#ffffff',
          col3Bg: '#ffffff',
          col4Bg: '#ffffff',
          col2Content: PLACEHOLDER,
          col3Content: PLACEHOLDER,
          col4Content: PLACEHOLDER,
        },
      ]

      const cell = (
        x: number,
        y: number,
        w: number,
        h: number,
        content: string,
        bg: string,
        options?: { header?: boolean; center?: boolean }
      ): CreateObjectInput =>
        options?.header
          ? ({
              type: 'sticky',
              position: { x, y },
              dimensions: { width: w - BORDER, height: h - BORDER },
              content,
              fillColor: bg,
              textStyle: {
                ...DEFAULT_TEXT_STYLE,
                fontSize: 12,
                bold: true,
                fontColor: '#ffffff',
                textAlign: options.center ? 'center' : 'left',
              },
              cornerRadius: 0,
            } as CreateObjectInput)
          : ({
              type: 'sticky',
              position: { x, y },
              dimensions: { width: w - BORDER, height: h - BORDER },
              content,
              fillColor: bg,
              textStyle: PLACEHOLDER_STYLE,
              cornerRadius: 0,
            } as CreateObjectInput)

      let x = startX + PAD
      for (let r = 0; r < 8; r++) {
        const row = rows[r]
        const y = tableY + r * ROW_H
        const isHeader = r === 0
        items.push(cell(x, y, col1W, ROW_H, row.labelContent, row.labelBg, { header: true }))
        x += col1W + BORDER
        items.push(
          cell(x, y, col2W, ROW_H, row.col2Content, row.col2Bg, {
            header: isHeader,
            center: isHeader,
          })
        )
        x += col2W + BORDER
        items.push(
          cell(x, y, col3W, ROW_H, row.col3Content, row.col3Bg, {
            header: isHeader,
            center: isHeader,
          })
        )
        x += col3W + BORDER
        items.push(
          cell(x, y, col4W, ROW_H, row.col4Content, row.col4Bg, {
            header: isHeader,
            center: isHeader,
          })
        )
        x = startX + PAD
      }

      return items
    }
    case 'sprint-backlog': {
      const SLIDE_H = 675
      const PAD = 48
      const CARD_W = 140
      const CARD_H = 100
      const HEADER_H = 56
      const ARROW_COLOR = '#6b7280'
      const ORIGIN_R = 48
      const CARD_GAP = 20
      const ROW_GAP = 50

      const originCenterX = startX + PAD + ORIGIN_R
      const originCenterY = startY + SLIDE_H / 2
      const cardsStartX = originCenterX + ORIGIN_R + 50

      const row1Y = startY + PAD + 90
      const row2Y = row1Y + CARD_H + ROW_GAP
      const row3Y = row2Y + CARD_H + ROW_GAP

      const phaseColor = {
        design: '#3ABFBF',
        programming: '#1A73E8',
        testing: '#4CAF50',
      } as const
      const taskColor = '#5B9BD5'

      const makePhaseCard = (
        x: number,
        y: number,
        headerColor: string,
        title: string,
        icon: string,
        hours: string,
        cost: string
      ): CreateObjectInput[] => {
        const items: CreateObjectInput[] = []
        items.push({
          type: 'rectangle',
          position: { x, y },
          dimensions: { width: CARD_W, height: CARD_H },
          fillColor: '#ffffff',
          strokeColor: '#e5e7eb',
          strokeWidth: 1,
          cornerRadius: 8,
        })
        items.push({
          type: 'rectangle',
          position: { x: x + 1, y: y + 1 },
          dimensions: { width: CARD_W - 2, height: HEADER_H },
          fillColor: headerColor,
          strokeColor: 'transparent',
          cornerRadius: 7,
        })
        items.push({
          type: 'text',
          position: { x: x + 8, y: y + 4 },
          dimensions: { width: CARD_W - 16, height: 48 },
          content: `${icon}\n${title}`,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 11, bold: true, fontColor: '#ffffff', textAlign: 'center' },
        })
        items.push({
          type: 'text',
          position: { x: x + 8, y: y + HEADER_H + 8 },
          dimensions: { width: CARD_W - 16, height: 18 },
          content: hours,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#374151', textAlign: 'center' },
        })
        items.push({
          type: 'line',
          start: { x: x + 16, y: y + HEADER_H + 26 },
          end: { x: x + CARD_W - 16, y: y + HEADER_H + 26 },
          strokeColor: '#e5e7eb',
          strokeWidth: 1,
        })
        items.push({
          type: 'text',
          position: { x: x + 8, y: y + HEADER_H + 28 },
          dimensions: { width: CARD_W - 16, height: 20 },
          content: cost,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#374151', textAlign: 'center' },
        })
        return items
      }

      const makeTaskCard = (
        x: number,
        y: number,
        title: string,
        desc: string,
        hours: string,
        cost: string
      ): CreateObjectInput[] => {
        const items: CreateObjectInput[] = []
        items.push({
          type: 'rectangle',
          position: { x, y },
          dimensions: { width: CARD_W, height: CARD_H },
          fillColor: '#ffffff',
          strokeColor: '#e5e7eb',
          strokeWidth: 1,
          cornerRadius: 8,
        })
        items.push({
          type: 'rectangle',
          position: { x: x + 1, y: y + 1 },
          dimensions: { width: CARD_W - 2, height: HEADER_H },
          fillColor: taskColor,
          strokeColor: 'transparent',
          cornerRadius: 7,
        })
        items.push({
          type: 'text',
          position: { x: x + 8, y: y + 6 },
          dimensions: { width: CARD_W - 16, height: 44 },
          content: `${title}\n${desc}`,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 10, bold: true, fontColor: '#ffffff', textAlign: 'center' },
        })
        items.push({
          type: 'text',
          position: { x: x + 8, y: y + HEADER_H + 8 },
          dimensions: { width: CARD_W - 16, height: 18 },
          content: hours,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#374151', textAlign: 'center' },
        })
        items.push({
          type: 'line',
          start: { x: x + 16, y: y + HEADER_H + 26 },
          end: { x: x + CARD_W - 16, y: y + HEADER_H + 26 },
          strokeColor: '#e5e7eb',
          strokeWidth: 1,
        })
        items.push({
          type: 'text',
          position: { x: x + 8, y: y + HEADER_H + 28 },
          dimensions: { width: CARD_W - 16, height: 20 },
          content: cost,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, fontColor: '#374151', textAlign: 'center' },
        })
        return items
      }

      const arrow = (sx: number, sy: number, ex: number, ey: number, curved = false) =>
        items.push({
          type: 'line',
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          strokeColor: ARROW_COLOR,
          strokeWidth: 2,
          connectionType: curved ? 'arrow-curved' : 'arrow-straight',
        })

      const items: CreateObjectInput[] = []

      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + 24 },
        dimensions: { width: 500, height: 44 },
        content: 'Project Budget Breakdown',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 28, fontColor: '#1a1a2e' },
      })

      items.push({
        type: 'circle',
        position: { x: startX + PAD, y: originCenterY - ORIGIN_R },
        dimensions: { width: ORIGIN_R * 2, height: ORIGIN_R * 2 },
        fillColor: '#F5A623',
        strokeColor: 'transparent',
      })
      items.push({
        type: 'text',
        position: { x: startX + PAD + 8, y: originCenterY - ORIGIN_R + 24 },
        dimensions: { width: ORIGIN_R * 2 - 16, height: ORIGIN_R * 2 - 16 },
        content: 'Project\nSummary',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, bold: true, fontColor: '#ffffff', textAlign: 'center' },
      })

      let cx = cardsStartX
      const phase1X = cx
      items.push(...makePhaseCard(cx, row1Y, phaseColor.design, 'Design Phase', '💻', '150 Hours', '$ 4,000'))
      cx += CARD_W + CARD_GAP
      const task1_1X = cx
      items.push(...makeTaskCard(cx, row1Y, 'Design Task 01', 'Brief description of the task 01', '75 Hours', '$ 2,000'))
      cx += CARD_W + CARD_GAP
      items.push(...makeTaskCard(cx, row1Y, 'Design Task 02', 'Brief description of the task 02', '75 Hours', '$ 2,000'))

      cx = cardsStartX
      const phase2X = cx
      items.push(...makePhaseCard(cx, row2Y, phaseColor.programming, 'Programming Phase', '💻', '100 Hours', '$ 4,000'))
      cx += CARD_W + CARD_GAP
      const task2_1X = cx
      items.push(...makeTaskCard(cx, row2Y, 'Programming Task 01', 'Brief description of the task 01', '50 Hours', '$ 3,000'))
      cx += CARD_W + CARD_GAP
      items.push(...makeTaskCard(cx, row2Y, 'Programming Task 02', 'Brief description of the task 02', '50 Hours', '$ 1,000'))

      cx = cardsStartX
      const phase3X = cx
      items.push(...makePhaseCard(cx, row3Y, phaseColor.testing, 'Testing Phase', '🔍', '150 Hours', '$ 4,000'))
      cx += CARD_W + CARD_GAP
      const task3_1X = cx
      items.push(...makeTaskCard(cx, row3Y, 'Testing Task 01', 'Brief description of the task 01', '75 Hours', '$ 2,000'))
      cx += CARD_W + CARD_GAP
      items.push(...makeTaskCard(cx, row3Y, 'Testing Task 02', 'Brief description of the task 02', '75 Hours', '$ 2,000'))

      arrow(originCenterX + ORIGIN_R, originCenterY - 20, phase1X - 10, row1Y + CARD_H / 2, true)
      arrow(originCenterX + ORIGIN_R, originCenterY, phase2X - 10, row2Y + CARD_H / 2, true)
      arrow(originCenterX + ORIGIN_R, originCenterY + 20, phase3X - 10, row3Y + CARD_H / 2, true)

      arrow(phase1X + CARD_W, row1Y + CARD_H / 2, task1_1X - 10, row1Y + CARD_H / 2)
      arrow(task1_1X + CARD_W, row1Y + CARD_H / 2, task1_1X + CARD_W + CARD_GAP - 10, row1Y + CARD_H / 2)

      arrow(phase2X + CARD_W, row2Y + CARD_H / 2, task2_1X - 10, row2Y + CARD_H / 2)
      arrow(task2_1X + CARD_W, row2Y + CARD_H / 2, task2_1X + CARD_W + CARD_GAP - 10, row2Y + CARD_H / 2)

      arrow(phase3X + CARD_W, row3Y + CARD_H / 2, task3_1X - 10, row3Y + CARD_H / 2)
      arrow(task3_1X + CARD_W, row3Y + CARD_H / 2, task3_1X + CARD_W + CARD_GAP - 10, row3Y + CARD_H / 2)

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
    case 'kanban-board': {
      const SLIDE_W = 1200
      const SLIDE_H = 675
      const HEADER_H = 36
      const CARD_BODY = 'Lorem ipsum dolor sit ipsum adipiscing elit, sed diam.'
      const items: CreateObjectInput[] = []

      // Title: KANBAN BOARD TEMPLATE - top left, vertically aligned with badge group
      items.push({
        type: 'text',
        position: { x: startX + 24, y: startY + 10 },
        dimensions: { width: 500, height: 48 },
        content: 'KANBAN BOARD TEMPLATE',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 32, bold: true, fontColor: '#0f172a' },
      })

      // Team badges - top right, 2x3 grid. Row 1 vertically aligned with TEAM pill; Row 2 below with small gap.
      const badgeW = 72
      const badgeH = 28
      const badgeGap = 8
      const badgeRowGap = 6
      const teamStartX = SLIDE_W - 24 - (badgeW * 3 + badgeGap * 2)
      const teamStartY = startY + 6
      const teamColors = ['#e5e7eb', '#9B59B6', '#E74C3C', '#E67E22', '#e5e7eb', '#e5e7eb'] as const
      const teamTextColors = ['#374151', '#ffffff', '#ffffff', '#ffffff', '#374151', '#374151'] as const
      items.push({
        type: 'sticky',
        position: { x: teamStartX - 60, y: teamStartY },
        dimensions: { width: 56, height: badgeH },
        content: 'TEAM',
        fillColor: '#0f172a',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 11, bold: true, fontColor: '#ffffff' },
        cornerRadius: 14,
      })
      for (let i = 0; i < 6; i++) {
        const col = i % 3
        const row = Math.floor(i / 3)
        items.push({
          type: 'sticky',
          position: {
            x: teamStartX + col * (badgeW + badgeGap),
            y: teamStartY + row * (badgeH + badgeRowGap),
          },
          dimensions: { width: badgeW, height: badgeH },
          content: `Name ${i + 1}`,
          fillColor: teamColors[i],
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 10, fontColor: teamTextColors[i] },
          cornerRadius: 14,
        })
      }

      // 5 columns - equal width (start below full header: title + TEAM pill + 2 badge rows)
      const colCount = 5
      const colW = (SLIDE_W - 48) / colCount
      const colsY = startY + 96
      const colsH = SLIDE_H - colsY - 24
      const colHeaders = [
        { title: 'BACKLOG', bg: '#1ABC9C', textColor: '#ffffff' },
        { title: 'TO DO', bg: '#F1C40F', textColor: '#1a1a1a' },
        { title: 'IN PROGRESS', bg: '#f3f4f6', textColor: '#1a1a1a' },
        { title: 'TESTING', bg: '#AED6F1', textColor: '#1a1a1a' },
        { title: 'COMPLETE', bg: '#e5e7eb', textColor: '#1a1a1a' },
      ] as const
      const colBgs = ['#ffffff', '#fffbeb', '#ffffff', '#ebf5fb', '#ffffff'] as const
      const dividerColor = '#e5e7eb'

      for (let c = 0; c < colCount; c++) {
        const cx = startX + 24 + c * colW
        // Column background
        items.push({
          type: 'rectangle',
          position: { x: cx, y: colsY + HEADER_H },
          dimensions: { width: colW - 1, height: colsH - HEADER_H },
          fillColor: colBgs[c],
          strokeColor: dividerColor,
          strokeWidth: c < colCount - 1 ? 1 : 0,
        })
        // Column header
        items.push({
          type: 'sticky',
          position: { x: cx, y: colsY },
          dimensions: { width: colW - 1, height: HEADER_H },
          content: colHeaders[c].title,
          fillColor: colHeaders[c].bg,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, bold: true, fontColor: colHeaders[c].textColor },
          cornerRadius: 0,
        })
      }

      // Cards with slight rotation and offsets
      const cardW = 180
      const cardH = 100
      const baseCard = (x: number, y: number, title: string, body: string, fill: string, rot: number) =>
        ({
          type: 'sticky',
          position: { x, y },
          dimensions: { width: cardW, height: cardH },
          content: `📌 ${title}\n${body}`,
          fillColor: fill,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 11, fontColor: '#1a1a1a' },
          cornerRadius: 8,
          rotation: rot,
        }) as CreateObjectInput
      const card = (cx: number, cy: number, title: string, fill: string, rot: number) =>
        baseCard(cx, cy, title, CARD_BODY, fill, rot)

      // Col 0 BACKLOG: 2 cards - yellow (-5°), green (+6°)
      const c0x = startX + 24 + 12
      items.push(card(c0x, colsY + HEADER_H + 20, 'TASK 07', '#fef08a', -5))
      items.push(card(c0x + 8, colsY + HEADER_H + 140, 'TASK 05', '#bbf7d0', 6))

      // Col 1 TO DO: 3 cards - light green, yellow, light yellow
      const c1x = startX + 24 + colW + 12
      items.push(card(c1x, colsY + HEADER_H + 16, 'TASK 01', '#dcfce7', -4))
      items.push(card(c1x + 10, colsY + HEADER_H + 126, 'TASK 03', '#fef08a', 5))
      items.push(card(c1x + 4, colsY + HEADER_H + 236, 'TASK 04', '#fef9c3', -3))

      // Col 2 IN PROGRESS: 2 cards - blue, light blue
      const c2x = startX + 24 + colW * 2 + 12
      items.push(card(c2x, colsY + HEADER_H + 20, 'TASK 06', '#bfdbfe', -6))
      items.push(card(c2x + 6, colsY + HEADER_H + 130, 'TASK 02', '#e0e7ff', 4))

      // Col 3 TESTING: 3 cards - orange, green, yellow
      const c3x = startX + 24 + colW * 3 + 12
      items.push(card(c3x, colsY + HEADER_H + 18, 'TASK 06', '#fed7aa', -5))
      items.push(card(c3x + 14, colsY + HEADER_H + 118, 'TASK 02', '#bbf7d0', 6))
      items.push(card(c3x + 8, colsY + HEADER_H + 218, 'TASK 03', '#fef08a', -3))

      // Col 4 COMPLETE: 1 card - pink/salmon
      const c4x = startX + 24 + colW * 4 + 12
      items.push(card(c4x, colsY + HEADER_H + 24, 'TASK 06', '#fecaca', -4))

      return items
    }
    case 'weekly-okr': {
      const TEAL_HEADER = '#2ABFBF'
      const DARK_TEAL = '#1A3C5E'
      const EVAL_GOLD = '#F5A623'
      const LIGHT_GRAY = '#f5f5f5'
      const tableX = startX
      const tableY = startY + 60
      const tableW = 800
      const colW = [50, 50, 115, 115, 115, 115, 226] as const
      const headerH = 44
      const labelH = 36
      const rowH = 46
      const items: CreateObjectInput[] = []
      items.push({
        type: 'text',
        position: { x: tableX + 20, y: startY + 16 },
        dimensions: { width: tableW - 40, height: 40 },
        content: 'Weekly OKR Performance Review',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 24, bold: true, fontColor: '#1a1a1a' },
      })
      let x = tableX
      items.push({
        type: 'sticky',
        position: { x, y: tableY },
        dimensions: { width: tableW, height: headerH },
        content: '📓 Key Activities',
        fillColor: TEAL_HEADER,
        textStyle: { ...DEFAULT_TEXT_STYLE, fontColor: '#ffffff', fontSize: 14 },
        cornerRadius: 0,
      })
      const labelY = tableY + headerH
      const colLabels = ['', 'Start', 'Week 01', 'Week 02', 'Week 03', 'Week 04', 'Evaluation']
      const labelColors = [DARK_TEAL, DARK_TEAL, DARK_TEAL, DARK_TEAL, DARK_TEAL, DARK_TEAL, EVAL_GOLD]
      x = tableX
      for (let c = 0; c < 7; c++) {
        items.push({
          type: 'sticky',
          position: { x, y: labelY },
          dimensions: { width: colW[c], height: labelH },
          content: colLabels[c] || (c === 0 ? 'Objective' : ''),
          fillColor: labelColors[c],
          textStyle: { ...DEFAULT_TEXT_STYLE, fontColor: '#ffffff', fontSize: 11, bold: true },
          cornerRadius: 0,
        })
        x += colW[c]
      }
      const dataY0 = labelY + labelH
      const objColH = 8 * rowH
      items.push({
        type: 'rectangle',
        position: { x: tableX, y: dataY0 },
        dimensions: { width: colW[0], height: objColH },
        fillColor: DARK_TEAL,
        strokeColor: '#e0e0e0',
        strokeWidth: 1,
      })
      items.push({
        type: 'text',
        position: { x: tableX + 8, y: dataY0 + objColH / 2 - 60 },
        dimensions: { width: objColH - 16, height: 120 },
        content: 'Add Objective Here',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontColor: '#ffffff', fontSize: 11 },
        rotation: -90,
      } as CreateObjectInput)
      items.push({
        type: 'emoji',
        position: { x: tableX + colW[0] / 2 - 10, y: dataY0 + objColH - 28 },
        emoji: '🎯',
        fontSize: 18,
      })
      const evalText = 'This slide is 100% editable. Adjust it as per your requirements and catches your viewers consideration.'
      for (let r = 0; r < 8; r++) {
        const rowY = dataY0 + r * rowH
        const rowBg = r % 2 === 0 ? '#ffffff' : LIGHT_GRAY
        x = tableX + colW[0]
        items.push({
          type: 'sticky',
          position: { x, y: rowY },
          dimensions: { width: colW[1], height: rowH },
          content: 'Add Text Here',
          fillColor: DARK_TEAL,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontColor: '#ffffff', fontSize: 10 },
          cornerRadius: 0,
          rotation: -90,
        } as CreateObjectInput)
        x += colW[1]
        for (let c = 2; c < 6; c++) {
          items.push({
            type: 'sticky',
            position: { x, y: rowY },
            dimensions: { width: colW[c], height: rowH },
            content: 'Add Text Here',
            fillColor: rowBg,
            textStyle: { ...DEFAULT_TEXT_STYLE, fontColor: '#4a4a4a', fontSize: 11 },
            cornerRadius: 0,
          })
          x += colW[c]
        }
        items.push({
          type: 'sticky',
          position: { x, y: rowY },
          dimensions: { width: colW[6], height: rowH },
          content: evalText,
          fillColor: rowBg,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontColor: '#4a4a4a', fontSize: 10, italic: true, textAlign: 'right' },
          cornerRadius: 0,
        })
      }
      return items
    }
    case 'mind-map': {
      const SLIDE_W = 1200
      const SLIDE_H = 675
      const centerX = startX + SLIDE_W / 2
      const centerY = startY + SLIDE_H / 2
      const CENTER_D = 130
      const BRANCH_D = 85
      const BRANCH_R = 200
      const LEAF_W = 120
      const LEAF_H = 30
      const LEAF_GAP = 7
      const LINE_COLOR = '#AAAAAA'
      const LEAF_TEXT = 'Simple Text'
      const items: CreateObjectInput[] = []

      const branchColors = [
        '#F5C518', // 1 top center - golden yellow
        '#E91E8C', // 2 top left - hot pink
        '#9E9E9E', // 3 left - gray
        '#9C27B0', // 4 bottom left - purple
        '#F44336', // 5 bottom center - coral
        '#F44336', // 6 bottom right - coral
        '#2196F3', // 7 right - sky blue
        '#4CAF50', // 8 top right - green
      ] as const
      const angles = [-Math.PI / 2, -3 * Math.PI / 4, Math.PI, (3 * Math.PI) / 4, Math.PI / 2, Math.PI / 4, 0, -Math.PI / 4]

      items.push({
        type: 'rectangle',
        position: { x: startX, y: startY },
        dimensions: { width: SLIDE_W, height: SLIDE_H },
        fillColor: '#FFFFFF',
      })

      // Center node - large circle, dark charcoal
      items.push({
        type: 'circle',
        position: { x: centerX - CENTER_D / 2, y: centerY - CENTER_D / 2 },
        dimensions: { width: CENTER_D, height: CENTER_D },
        fillColor: '#2C2C2C',
      })
      items.push({
        type: 'text',
        position: { x: centerX - 60, y: centerY - 28 },
        dimensions: { width: 120, height: 24 },
        content: 'Mind Map',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 18, bold: true, fontColor: '#ffffff', textAlign: 'center' },
      })
      items.push({
        type: 'text',
        position: { x: centerX - 40, y: centerY - 2 },
        dimensions: { width: 80, height: 18 },
        content: 'Diagrams',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 12, bold: false, fontColor: '#ffffff', textAlign: 'center' },
      })

      const branchCenters: { x: number; y: number; color: string }[] = []
      for (let i = 0; i < 8; i++) {
        const bx = centerX + BRANCH_R * Math.cos(angles[i])
        const by = centerY + BRANCH_R * Math.sin(angles[i])
        branchCenters.push({ x: bx, y: by, color: branchColors[i] })
        items.push({
          type: 'circle',
          position: { x: bx - BRANCH_D / 2, y: by - BRANCH_D / 2 },
          dimensions: { width: BRANCH_D, height: BRANCH_D },
          fillColor: branchColors[i],
        })
        items.push({
          type: 'text',
          position: { x: bx - 40, y: by - 10 },
          dimensions: { width: 80, height: 20 },
          content: LEAF_TEXT,
          textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 11, bold: true, fontColor: '#ffffff', textAlign: 'center' },
        })
      }

      // Connectors: center to branches
      const centerR = CENTER_D / 2
      const branchR = BRANCH_D / 2
      for (let i = 0; i < 8; i++) {
        const b = branchCenters[i]
        const dx = b.x - centerX
        const dy = b.y - centerY
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const sx = centerX + ux * centerR
        const sy = centerY + uy * centerR
        const ex = b.x - ux * branchR
        const ey = b.y - uy * branchR
        items.push({
          type: 'line',
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          strokeColor: LINE_COLOR,
          strokeWidth: 2,
        })
      }

      const leafStackHeight = LEAF_H * 3 + LEAF_GAP * 2
      const hasLeavesLeft = [false, true, false, true, false, false, false, false]
      const hasLeavesRight = [false, false, false, false, false, true, false, true]

      const leafConnectorOffset = 20
      for (let i = 0; i < 8; i++) {
        const b = branchCenters[i]
        if (hasLeavesLeft[i]) {
          const leafStartX = b.x - branchR - 15 - LEAF_W
          const leafStartY = b.y - leafStackHeight / 2
          for (let j = 0; j < 3; j++) {
            const ly = leafStartY + j * (LEAF_H + LEAF_GAP)
            items.push({
              type: 'sticky',
              position: { x: leafStartX, y: ly },
              dimensions: { width: LEAF_W, height: LEAF_H },
              content: LEAF_TEXT,
              fillColor: b.color,
              textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 10, bold: true, fontColor: '#ffffff', textAlign: 'center' },
              cornerRadius: LEAF_H / 2,
            })
            const leafCx = leafStartX + LEAF_W
            const leafCy = ly + LEAF_H / 2
            const connEndY = b.y + (j - 1) * leafConnectorOffset
            items.push({
              type: 'line',
              start: { x: leafCx, y: leafCy },
              end: { x: b.x - branchR, y: connEndY },
              strokeColor: LINE_COLOR,
              strokeWidth: 2,
            })
          }
        }
        if (hasLeavesRight[i]) {
          const leafStartX = b.x + branchR + 15
          const leafStartY = b.y - leafStackHeight / 2
          for (let j = 0; j < 3; j++) {
            const ly = leafStartY + j * (LEAF_H + LEAF_GAP)
            items.push({
              type: 'sticky',
              position: { x: leafStartX, y: ly },
              dimensions: { width: LEAF_W, height: LEAF_H },
              content: LEAF_TEXT,
              fillColor: b.color,
              textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 10, bold: true, fontColor: '#ffffff', textAlign: 'center' },
              cornerRadius: LEAF_H / 2,
            })
            const leafCx = leafStartX
            const leafCy = ly + LEAF_H / 2
            const connEndY = b.y + (j - 1) * leafConnectorOffset
            items.push({
              type: 'line',
              start: { x: leafCx, y: leafCy },
              end: { x: b.x + branchR, y: connEndY },
              strokeColor: LINE_COLOR,
              strokeWidth: 2,
            })
          }
        }
      }

      return items
    }
    case 'flowchart': {
      const SLIDE_W = 1200
      const SLIDE_H = 675
      const PAD = 24
      const PLACEHOLDER = 'Placeholder text'
      const NODE_TEXT_STYLE = { ...DEFAULT_TEXT_STYLE, fontSize: 12, bold: true, fontColor: '#ffffff', textAlign: 'center' as const }
      const ARROW_COLOR = '#555555'
      const items: CreateObjectInput[] = []
      const centerX = startX + SLIDE_W / 2
      const rowGap = 48
      const pillW = 200
      const pillH = 44
      const pinkRectW = 130
      const pinkRectH = 44
      const diamondSize = 72
      const tealRectW = 110
      const tealRectH = 40
      const blueRectW = 110
      const blueRectH = 40
      const purpleRectW = 120
      const purpleRectH = 44
      const branchOffset = 260

      const leftCenterX = centerX - branchOffset
      const rightCenterX = centerX + branchOffset

      // White background
      items.push({
        type: 'rectangle',
        position: { x: startX, y: startY },
        dimensions: { width: SLIDE_W, height: SLIDE_H },
        fillColor: '#FFFFFF',
      })

      // Header: Flow Chart + subtitle
      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + PAD },
        dimensions: { width: 400, height: 48 },
        content: 'Flow Chart',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 36, bold: false, fontColor: '#1A2535' },
      })
      items.push({
        type: 'text',
        position: { x: startX + PAD, y: startY + 64 },
        dimensions: { width: 500, height: 24 },
        content: 'Type The Subtitle Of Your Great Here',
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 16, bold: false, fontColor: '#6b7280' },
      })

      const flowTopY = startY + 100
      const row1Y = flowTopY
      const row2Y = flowTopY + pillH + rowGap
      const row3Y = row2Y + pinkRectH + rowGap
      const midRow3Y = row3Y + diamondSize / 2 - tealRectH / 2
      const row4Y = row3Y + diamondSize + rowGap
      const row5Y = row4Y + purpleRectH + rowGap

      // ROW 1: Yellow pill (top center)
      const topX = centerX - pillW / 2
      items.push({
        type: 'sticky',
        position: { x: topX, y: row1Y },
        dimensions: { width: pillW, height: pillH },
        content: PLACEHOLDER,
        fillColor: '#F5A623',
        textStyle: NODE_TEXT_STYLE,
        cornerRadius: pillH / 2,
      })

      // ROW 2: Two pink rounded rectangles
      const l1X = leftCenterX - pinkRectW / 2
      const r1X = rightCenterX - pinkRectW / 2
      items.push({
        type: 'sticky',
        position: { x: l1X, y: row2Y },
        dimensions: { width: pinkRectW, height: pinkRectH },
        content: PLACEHOLDER,
        fillColor: '#E91E8C',
        textStyle: NODE_TEXT_STYLE,
        cornerRadius: 12,
      })
      items.push({
        type: 'sticky',
        position: { x: r1X, y: row2Y },
        dimensions: { width: pinkRectW, height: pinkRectH },
        content: PLACEHOLDER,
        fillColor: '#E91E8C',
        textStyle: NODE_TEXT_STYLE,
        cornerRadius: 12,
      })

      // ROW 3: Two green diamonds, each with teal rect left and blue rect right
      const l2X = leftCenterX - diamondSize / 2
      const r2X = rightCenterX - diamondSize / 2
      const tealGap = 35
      const blueGap = 35
      const l3X = l2X - tealRectW - tealGap
      const l4X = l2X + diamondSize + blueGap
      const r3X = r2X - tealRectW - tealGap
      const r4X = r2X + diamondSize + blueGap

      items.push({
        type: 'diamond',
        position: { x: l2X, y: row3Y },
        dimensions: { width: diamondSize, height: diamondSize },
        fillColor: '#4CAF50',
      })
      items.push({
        type: 'text',
        position: { x: l2X + 8, y: row3Y + 20 },
        dimensions: { width: diamondSize - 16, height: diamondSize - 40 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })
      items.push({
        type: 'diamond',
        position: { x: r2X, y: row3Y },
        dimensions: { width: diamondSize, height: diamondSize },
        fillColor: '#4CAF50',
      })
      items.push({
        type: 'text',
        position: { x: r2X + 8, y: row3Y + 20 },
        dimensions: { width: diamondSize - 16, height: diamondSize - 40 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })

      items.push({
        type: 'rectangle',
        position: { x: l3X, y: midRow3Y },
        dimensions: { width: tealRectW, height: tealRectH },
        fillColor: '#3ABFBF',
        cornerRadius: 6,
      })
      items.push({
        type: 'text',
        position: { x: l3X + 6, y: midRow3Y + 8 },
        dimensions: { width: tealRectW - 12, height: tealRectH - 16 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })
      items.push({
        type: 'rectangle',
        position: { x: l4X, y: midRow3Y },
        dimensions: { width: blueRectW, height: blueRectH },
        fillColor: '#5B9BD5',
        cornerRadius: 6,
      })
      items.push({
        type: 'text',
        position: { x: l4X + 6, y: midRow3Y + 8 },
        dimensions: { width: blueRectW - 12, height: blueRectH - 16 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })
      items.push({
        type: 'rectangle',
        position: { x: r3X, y: midRow3Y },
        dimensions: { width: tealRectW, height: tealRectH },
        fillColor: '#3ABFBF',
        cornerRadius: 6,
      })
      items.push({
        type: 'text',
        position: { x: r3X + 6, y: midRow3Y + 8 },
        dimensions: { width: tealRectW - 12, height: tealRectH - 16 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })
      items.push({
        type: 'rectangle',
        position: { x: r4X, y: midRow3Y },
        dimensions: { width: blueRectW, height: blueRectH },
        fillColor: '#5B9BD5',
        cornerRadius: 6,
      })
      items.push({
        type: 'text',
        position: { x: r4X + 6, y: midRow3Y + 8 },
        dimensions: { width: blueRectW - 12, height: blueRectH - 16 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })

      // ROW 4: Two purple merge rectangles
      const l5X = leftCenterX - purpleRectW / 2
      const r5X = rightCenterX - purpleRectW / 2
      items.push({
        type: 'rectangle',
        position: { x: l5X, y: row4Y },
        dimensions: { width: purpleRectW, height: purpleRectH },
        fillColor: '#7B68C8',
        cornerRadius: 8,
      })
      items.push({
        type: 'text',
        position: { x: l5X + 6, y: row4Y + 10 },
        dimensions: { width: purpleRectW - 12, height: purpleRectH - 20 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })
      items.push({
        type: 'rectangle',
        position: { x: r5X, y: row4Y },
        dimensions: { width: purpleRectW, height: purpleRectH },
        fillColor: '#7B68C8',
        cornerRadius: 8,
      })
      items.push({
        type: 'text',
        position: { x: r5X + 6, y: row4Y + 10 },
        dimensions: { width: purpleRectW - 12, height: purpleRectH - 20 },
        content: PLACEHOLDER,
        textStyle: NODE_TEXT_STYLE,
      })

      // ROW 5: Bottom purple pill
      const bottomX = centerX - pillW / 2
      items.push({
        type: 'sticky',
        position: { x: bottomX, y: row5Y },
        dimensions: { width: pillW, height: pillH },
        content: PLACEHOLDER,
        fillColor: '#7B68C8',
        textStyle: NODE_TEXT_STYLE,
        cornerRadius: pillH / 2,
      })

      // Arrows
      const arrow = (sx: number, sy: number, ex: number, ey: number) =>
        items.push({
          type: 'line',
          start: { x: sx, y: sy },
          end: { x: ex, y: ey },
          strokeColor: ARROW_COLOR,
          strokeWidth: 2,
          connectionType: 'arrow-straight',
        })

      const topCenterY = row1Y + pillH / 2
      const l1CenterX = l1X + pinkRectW / 2
      const r1CenterX = r1X + pinkRectW / 2
      const l2CenterX = l2X + diamondSize / 2
      const r2CenterX = r2X + diamondSize / 2
      const l5CenterX = l5X + purpleRectW / 2
      const r5CenterX = r5X + purpleRectW / 2
      const bottomCenterY = row5Y + pillH / 2

      // Top pill -> left and right pink rects
      arrow(centerX - 40, topCenterY, l1CenterX, row2Y)
      arrow(centerX + 40, topCenterY, r1CenterX, row2Y)
      // Pink rects -> diamonds
      arrow(l1CenterX, row2Y + pinkRectH, l2CenterX, row3Y)
      arrow(r1CenterX, row2Y + pinkRectH, r2CenterX, row3Y)
      // Diamonds -> teal (left) and blue (right) rects
      arrow(l2X, row3Y + diamondSize / 2, l3X + tealRectW, midRow3Y + tealRectH / 2)
      arrow(l2X + diamondSize, row3Y + diamondSize / 2, l4X, midRow3Y + blueRectH / 2)
      arrow(r2X, row3Y + diamondSize / 2, r3X + tealRectW, midRow3Y + tealRectH / 2)
      arrow(r2X + diamondSize, row3Y + diamondSize / 2, r4X, midRow3Y + blueRectH / 2)
      // Teal and blue rects -> purple merge rects
      arrow(l3X + tealRectW / 2, midRow3Y + tealRectH, l5CenterX, row4Y)
      arrow(l4X + blueRectW / 2, midRow3Y + blueRectH, l5CenterX, row4Y)
      arrow(r3X + tealRectW / 2, midRow3Y + tealRectH, r5CenterX, row4Y)
      arrow(r4X + blueRectW / 2, midRow3Y + blueRectH, r5CenterX, row4Y)
      // Purple merge rects -> bottom pill
      arrow(l5CenterX, row4Y + purpleRectH, centerX - 40, bottomCenterY)
      arrow(r5CenterX, row4Y + purpleRectH, centerX + 40, bottomCenterY)

      return items
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
 * Uses real composed template content when available for layout-accurate thumbnails.
 * @param key - Template id
 * @returns Array of CreateObjectInput for rendering in thumbnail
 */
export function getTemplatePreviewObjects(key: string): CreateObjectInput[] {
  const pw = PREVIEW_W
  const ph = PREVIEW_H
  const g = PREVIEW_GAP

  const composed = buildComposedTemplate(key)
  if (composed.length > 0) {
    return composed
  }

  switch (key) {
    case 'retrospective':
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw * 4, height: ph * 3 }, fillColor: '#1A2535' },
        { type: 'text', position: { x: 2, y: 2 }, dimensions: { width: pw * 2 - 4, height: ph - 4 }, content: 'Sprint Retro', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 8, fontColor: '#f1f5f9' } },
        { type: 'sticky', position: { x: 2, y: ph }, dimensions: { width: pw - 2, height: ph - 4 }, content: 'Team', fillColor: '#E8523A', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 7, fontColor: '#fff' }, cornerRadius: 4 },
        { type: 'rectangle', position: { x: 0, y: ph * 2 }, dimensions: { width: pw, height: ph }, fillColor: '#E8523A' },
        { type: 'rectangle', position: { x: pw + 2, y: ph * 2 }, dimensions: { width: pw, height: ph }, fillColor: '#8B9E3A' },
        { type: 'rectangle', position: { x: (pw + 2) * 2, y: ph * 2 }, dimensions: { width: pw, height: ph }, fillColor: '#D4A017' },
        { type: 'rectangle', position: { x: (pw + 2) * 3, y: ph * 2 }, dimensions: { width: pw, height: ph }, fillColor: '#3A9E8B' },
      ]
    case 'weekly-okr':
      return [
        { type: 'text', position: { x: 2, y: 0 }, dimensions: { width: pw * 3 - 4, height: ph - 4 }, content: 'Weekly OKR', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 10, bold: true } },
        { type: 'rectangle', position: { x: 0, y: ph }, dimensions: { width: pw * 3, height: ph * 2 }, fillColor: '#2ABFBF', strokeColor: '#e0e0e0' },
        { type: 'rectangle', position: { x: 0, y: ph + ph * 2 }, dimensions: { width: pw, height: ph * 2 }, fillColor: '#1A3C5E', strokeColor: '#e0e0e0' },
        { type: 'rectangle', position: { x: pw, y: ph + ph * 2 }, dimensions: { width: pw * 2 - 2, height: ph * 2 }, fillColor: '#f5f5f5', strokeColor: '#e0e0e0' },
        { type: 'rectangle', position: { x: pw * 2, y: ph + ph * 2 }, dimensions: { width: pw, height: ph * 2 }, fillColor: '#F5A623', strokeColor: '#e0e0e0' },
      ]
    case 'icebreaker':
      return [
        { type: 'sticky', position: { x: 0, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Name', fillColor: '#fef08a', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + g, y: 0 }, dimensions: { width: pw, height: ph }, content: 'Answer', fillColor: '#dbeafe', cornerRadius: 4 },
      ]
    case 'standup':
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw * 4, height: ph * 3 }, fillColor: '#2C3E50' },
        { type: 'text', position: { x: 2, y: 2 }, dimensions: { width: pw * 2 - 4, height: ph - 4 }, content: 'Daily Stand-up', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 8, fontColor: '#f1f5f9' } },
        { type: 'rectangle', position: { x: 2, y: ph }, dimensions: { width: 8, height: ph * 2 - 4 }, fillColor: '#4A90D9' },
        { type: 'rectangle', position: { x: 12, y: ph }, dimensions: { width: pw - 4, height: ph - 4 }, fillColor: '#D6E8F7', strokeColor: '#6b7280', strokeWidth: 1 },
        { type: 'rectangle', position: { x: 2, y: ph * 2 }, dimensions: { width: 8, height: ph - 4 }, fillColor: '#5CB85C' },
        { type: 'rectangle', position: { x: 2, y: ph * 2.5 }, dimensions: { width: 8, height: ph - 4 }, fillColor: '#F0AD4E' },
      ]
    case 'kanban-board':
      return [
        { type: 'text', position: { x: 2, y: 0 }, dimensions: { width: pw * 2 - 4, height: ph - 4 }, content: 'KANBAN', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 8, bold: true } },
        { type: 'rectangle', position: { x: 0, y: ph }, dimensions: { width: pw, height: ph * 2 }, fillColor: '#1ABC9C', strokeColor: '#e0e0e0' },
        { type: 'rectangle', position: { x: pw + 2, y: ph }, dimensions: { width: pw, height: ph * 2 }, fillColor: '#F1C40F', strokeColor: '#e0e0e0' },
        { type: 'rectangle', position: { x: (pw + 2) * 2, y: ph }, dimensions: { width: pw, height: ph * 2 }, fillColor: '#f3f4f6', strokeColor: '#e0e0e0' },
        { type: 'sticky', position: { x: 2, y: ph + 4 }, dimensions: { width: pw - 4, height: ph - 6 }, content: 'TASK', fillColor: '#fef08a', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw + 6, y: ph + 4 }, dimensions: { width: pw - 4, height: ph - 6 }, content: 'TASK', fillColor: '#dcfce7', cornerRadius: 4 },
      ]
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
    case 'project-review':
      return [
        { type: 'text', position: { x: 2, y: 2 }, dimensions: { width: pw * 2 - 4, height: ph - 4 }, content: 'Project Review', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 8, fontColor: '#1A2535' } },
        { type: 'sticky', position: { x: 0, y: ph }, dimensions: { width: pw, height: ph - 2 }, content: '✏️ Project', fillColor: '#3ABFAA', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 6, fontColor: '#fff', bold: true }, cornerRadius: 0 },
        { type: 'sticky', position: { x: pw + 2, y: ph }, dimensions: { width: pw - 2, height: ph - 2 }, content: 'Client', fillColor: '#E8873A', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 6, fontColor: '#fff', bold: true }, cornerRadius: 0 },
        { type: 'sticky', position: { x: (pw + 2) * 2, y: ph }, dimensions: { width: pw - 2, height: ph - 2 }, content: 'Scope', fillColor: '#3A6E8B', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 6, fontColor: '#fff', bold: true }, cornerRadius: 0 },
      ]
    case 'sprint-backlog':
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw * 4, height: ph * 3 }, fillColor: '#FFFFFF' },
        { type: 'text', position: { x: 2, y: 2 }, dimensions: { width: pw * 2, height: ph - 4 }, content: 'Project Budget', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 8, fontColor: '#1a1a2e' } },
        { type: 'circle', position: { x: 2, y: ph - 6 }, dimensions: { width: 10, height: 10 }, fillColor: '#F5A623' },
        { type: 'rectangle', position: { x: pw, y: ph }, dimensions: { width: pw * 0.8, height: ph - 2 }, fillColor: '#3ABFBF', cornerRadius: 4 },
        { type: 'rectangle', position: { x: pw * 1.9, y: ph }, dimensions: { width: pw * 0.8, height: ph - 2 }, fillColor: '#5B9BD5', cornerRadius: 4 },
        { type: 'rectangle', position: { x: pw, y: ph * 2 }, dimensions: { width: pw * 0.8, height: ph - 2 }, fillColor: '#1A73E8', cornerRadius: 4 },
        { type: 'rectangle', position: { x: pw * 1.9, y: ph * 2 }, dimensions: { width: pw * 0.8, height: ph - 2 }, fillColor: '#5B9BD5', cornerRadius: 4 },
        { type: 'rectangle', position: { x: pw, y: ph * 2.9 }, dimensions: { width: pw * 0.8, height: ph - 2 }, fillColor: '#4CAF50', cornerRadius: 4 },
        { type: 'rectangle', position: { x: pw * 1.9, y: ph * 2.9 }, dimensions: { width: pw * 0.8, height: ph - 2 }, fillColor: '#5B9BD5', cornerRadius: 4 },
      ]
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
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw * 4, height: ph * 3 }, fillColor: '#FFFFFF' },
        { type: 'circle', position: { x: pw * 2 - 8, y: ph * 1.5 - 8 }, dimensions: { width: 16, height: 16 }, fillColor: '#2C2C2C' },
        { type: 'circle', position: { x: pw * 2 - 6, y: ph - 4 }, dimensions: { width: 12, height: 12 }, fillColor: '#F5C518' },
        { type: 'circle', position: { x: pw - 4, y: ph - 4 }, dimensions: { width: 12, height: 12 }, fillColor: '#E91E8C' },
        { type: 'circle', position: { x: pw * 2 - 6, y: ph * 2 - 4 }, dimensions: { width: 12, height: 12 }, fillColor: '#F44336' },
        { type: 'circle', position: { x: pw * 3 - 4, y: ph - 4 }, dimensions: { width: 12, height: 12 }, fillColor: '#4CAF50' },
        { type: 'line', start: { x: pw * 2, y: ph * 1.5 }, end: { x: pw * 2, y: ph }, strokeColor: '#AAAAAA', strokeWidth: 1 },
        { type: 'line', start: { x: pw * 2, y: ph * 1.5 }, end: { x: pw, y: ph }, strokeColor: '#AAAAAA', strokeWidth: 1 },
      ]
    case 'flowchart':
      return [
        { type: 'rectangle', position: { x: 0, y: 0 }, dimensions: { width: pw * 4, height: ph * 3 }, fillColor: '#FFFFFF' },
        { type: 'text', position: { x: 2, y: 2 }, dimensions: { width: pw * 2 - 4, height: ph - 4 }, content: 'Flow Chart', textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 8, fontColor: '#1A2535' } },
        { type: 'sticky', position: { x: pw * 2 - 10, y: ph - 2 }, dimensions: { width: 20, height: 8 }, content: '', fillColor: '#F5A623', cornerRadius: 4 },
        { type: 'sticky', position: { x: pw * 0.5, y: ph + 6 }, dimensions: { width: 14, height: 8 }, content: '', fillColor: '#E91E8C', cornerRadius: 2 },
        { type: 'sticky', position: { x: pw * 2.8, y: ph + 6 }, dimensions: { width: 14, height: 8 }, content: '', fillColor: '#E91E8C', cornerRadius: 2 },
        { type: 'diamond', position: { x: pw * 0.5, y: ph * 1.5 }, dimensions: { width: 12, height: 12 }, fillColor: '#4CAF50' },
        { type: 'diamond', position: { x: pw * 2.9, y: ph * 1.5 }, dimensions: { width: 12, height: 12 }, fillColor: '#4CAF50' },
        { type: 'rectangle', position: { x: pw * 0.2, y: ph * 1.8 }, dimensions: { width: 10, height: 6 }, fillColor: '#3ABFBF', cornerRadius: 2 },
        { type: 'rectangle', position: { x: pw * 0.9, y: ph * 1.8 }, dimensions: { width: 10, height: 6 }, fillColor: '#5B9BD5', cornerRadius: 2 },
        { type: 'rectangle', position: { x: pw * 2.6, y: ph * 1.8 }, dimensions: { width: 10, height: 6 }, fillColor: '#3ABFBF', cornerRadius: 2 },
        { type: 'rectangle', position: { x: pw * 3.3, y: ph * 1.8 }, dimensions: { width: 10, height: 6 }, fillColor: '#5B9BD5', cornerRadius: 2 },
        { type: 'rectangle', position: { x: pw * 0.8, y: ph * 2.3 }, dimensions: { width: 12, height: 6 }, fillColor: '#7B68C8', cornerRadius: 2 },
        { type: 'rectangle', position: { x: pw * 2.7, y: ph * 2.3 }, dimensions: { width: 12, height: 6 }, fillColor: '#7B68C8', cornerRadius: 2 },
        { type: 'sticky', position: { x: pw * 2 - 10, y: ph * 2.7 }, dimensions: { width: 20, height: 8 }, content: '', fillColor: '#7B68C8', cornerRadius: 4 },
      ]
    case 'brainstorm-grid':
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
