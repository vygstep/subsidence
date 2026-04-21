import { describe, it, expect } from 'vitest'

// Binary search functions copied from DataTrack.tsx for testing
function lowerBound(values: Float32Array, target: number): number {
  let left = 0
  let right = values.length

  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (values[middle] < target) {
      left = middle + 1
    } else {
      right = middle
    }
  }

  return left
}

function upperBound(values: Float32Array, target: number): number {
  let left = 0
  let right = values.length

  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (values[middle] <= target) {
      left = middle + 1
    } else {
      right = middle
    }
  }

  return left
}

describe('Curve Clipping - Binary Search Bounds', () => {
  describe('lowerBound', () => {
    it('should find lower bound for value in middle of array', () => {
      const depths = new Float32Array([0, 100, 200, 300, 400, 500])
      const bound = lowerBound(depths, 250)
      expect(bound).toBe(3) // index where depth >= 250
    })

    it('should return 0 for value less than all elements', () => {
      const depths = new Float32Array([100, 200, 300])
      const bound = lowerBound(depths, 50)
      expect(bound).toBe(0)
    })

    it('should return length for value greater than all elements', () => {
      const depths = new Float32Array([100, 200, 300])
      const bound = lowerBound(depths, 400)
      expect(bound).toBe(3)
    })

    it('should find exact match', () => {
      const depths = new Float32Array([0, 100, 200, 300])
      const bound = lowerBound(depths, 200)
      expect(bound).toBe(2)
    })

    it('should handle empty array', () => {
      const depths = new Float32Array([])
      const bound = lowerBound(depths, 100)
      expect(bound).toBe(0)
    })

    it('should handle single element array', () => {
      const depths = new Float32Array([100])
      expect(lowerBound(depths, 50)).toBe(0)
      expect(lowerBound(depths, 100)).toBe(0)
      expect(lowerBound(depths, 150)).toBe(1)
    })
  })

  describe('upperBound', () => {
    it('should find upper bound for value in middle of array', () => {
      const depths = new Float32Array([0, 100, 200, 300, 400, 500])
      const bound = upperBound(depths, 250)
      expect(bound).toBe(3) // index after last depth <= 250
    })

    it('should return 0 for value less than all elements', () => {
      const depths = new Float32Array([100, 200, 300])
      const bound = upperBound(depths, 50)
      expect(bound).toBe(0)
    })

    it('should return length for value greater than or equal to all elements', () => {
      const depths = new Float32Array([100, 200, 300])
      const bound = upperBound(depths, 300)
      expect(bound).toBe(3)
    })

    it('should handle duplicates (returns past last occurrence)', () => {
      const depths = new Float32Array([100, 200, 200, 200, 300])
      const bound = upperBound(depths, 200)
      expect(bound).toBe(4) // past last 200
    })
  })

  describe('Clipping with buffer', () => {
    it('should clip curve with 10% buffer correctly', () => {
      const depths = new Float32Array([0, 100, 200, 300, 400, 500])
      const visibleMin = 150
      const visibleMax = 350
      const span = visibleMax - visibleMin
      const buffer = span * 0.1 // 10% = 20

      const windowMin = visibleMin - buffer // 130
      const windowMax = visibleMax + buffer // 370

      const startIdx = Math.max(0, lowerBound(depths, windowMin) - 1)
      const endIdx = Math.min(depths.length, upperBound(depths, windowMax) + 1)

      expect(startIdx).toBe(1) // index 1 (depth 100) is the first point in buffer window
      expect(endIdx).toBe(5) // index 5 (depth 500) is outside buffer but +1 clamp stops at 5
    })

    it('should handle edge case where visible range is at curve edges', () => {
      const depths = new Float32Array([0, 100, 200, 300, 400, 500])
      const visibleMin = 0
      const visibleMax = 500
      const span = visibleMax - visibleMin
      const buffer = span * 0.1 // 50

      const windowMin = visibleMin - buffer // -50
      const windowMax = visibleMax + buffer // 550

      const startIdx = Math.max(0, lowerBound(depths, windowMin) - 1)
      const endIdx = Math.min(depths.length, upperBound(depths, windowMax) + 1)

      expect(startIdx).toBe(0)
      expect(endIdx).toBe(6)
    })

    it('should clip tight visible range within curve', () => {
      const depths = new Float32Array([0, 100, 200, 300, 400, 500])
      const visibleMin = 200
      const visibleMax = 300
      const span = visibleMax - visibleMin
      const buffer = span * 0.1 // 10

      const windowMin = visibleMin - buffer // 190
      const windowMax = visibleMax + buffer // 310

      const startIdx = Math.max(0, lowerBound(depths, windowMin) - 1)
      const endIdx = Math.min(depths.length, upperBound(depths, windowMax) + 1)

      // Should include 200, 300 and some buffer
      expect(startIdx).toBeLessThanOrEqual(2) // around index 2 (200)
      expect(endIdx).toBeGreaterThanOrEqual(4) // around index 4 (400)
    })
  })

  describe('Performance characteristics', () => {
    it('should handle large arrays efficiently', () => {
      const size = 100000
      const depths = new Float32Array(
        Array.from({ length: size }, (_, i) => i),
      )

      const start = performance.now()
      const result = lowerBound(depths, 50000)
      const end = performance.now()

      expect(result).toBe(50000)
      expect(end - start).toBeLessThan(10) // should be fast (O(log n))
    })
  })
})
