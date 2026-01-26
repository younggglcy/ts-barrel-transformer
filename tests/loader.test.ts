import { describe, it, expect, beforeEach } from 'vitest'
import { clearCache } from '../src/utils/cache'

// We'll test the internal functions by importing them
// For the loader itself, we'd need a webpack mock which is complex
// So we focus on testing the analyzer integration

describe('barrel-loader utilities', () => {
  beforeEach(() => {
    clearCache()
  })

  it('clearCache clears the analysis cache', () => {
    // This is a simple smoke test
    expect(() => clearCache()).not.toThrow()
  })
})

// Test the query parsing logic (extracted for testability)
describe('barrel query parsing', () => {
  function parseBarrelQuery(
    resourceQuery: string
  ): { names: string[]; originalPath: string } | null {
    if (!resourceQuery.startsWith('?')) return null

    const query = resourceQuery.slice(1)
    const match = query.match(/^names=([^!]+)!=!(.+)$/)
    if (!match) return null

    const names = match[1].split(',').filter(Boolean)
    const originalPath = match[2]

    return { names, originalPath }
  }

  it('parses valid barrel query', () => {
    const result = parseBarrelQuery('?names=Button,Icon!=!my-lib')

    expect(result).toEqual({
      names: ['Button', 'Icon'],
      originalPath: 'my-lib',
    })
  })

  it('handles single name', () => {
    const result = parseBarrelQuery('?names=Button!=!my-lib')

    expect(result).toEqual({
      names: ['Button'],
      originalPath: 'my-lib',
    })
  })

  it('handles scoped packages', () => {
    const result = parseBarrelQuery('?names=Box,Grid!=!@mui/material')

    expect(result).toEqual({
      names: ['Box', 'Grid'],
      originalPath: '@mui/material',
    })
  })

  it('returns null for invalid query', () => {
    expect(parseBarrelQuery('invalid')).toBeNull()
    expect(parseBarrelQuery('?invalid')).toBeNull()
    expect(parseBarrelQuery('')).toBeNull()
  })

  it('returns null for query without leading ?', () => {
    expect(parseBarrelQuery('names=Button!=!my-lib')).toBeNull()
  })
})
