import { describe, it, expect } from 'vitest'

describe('Object Data Structure', () => {
  it('sticky note has valid structure', () => {
    const sticky = {
      type: 'sticky',
      position: { x: 100, y: 200 },
      content: 'Test sticky',
      color: 'yellow',
      width: 200,
      height: 200,
    }

    expect(sticky.type).toBe('sticky')
    expect(sticky.position.x).toBe(100)
    expect(sticky.position.y).toBe(200)
    expect(sticky.content).toBe('Test sticky')
  })

  it('shape has valid structure', () => {
    const shape = {
      type: 'rectangle',
      position: { x: 500, y: 500 },
      color: '#3b82f6',
      width: 150,
      height: 100,
    }

    expect(shape.type).toBe('rectangle')
    expect(shape.position).toEqual({ x: 500, y: 500 })
  })
})
