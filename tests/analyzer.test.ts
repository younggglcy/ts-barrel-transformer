import { describe, it, expect } from 'vitest'
import { analyzeBarrelFile } from '../src/analyzer/barrel-analyzer'

describe('analyzeBarrelFile', () => {
  describe('barrel detection', () => {
    it('identifies a simple barrel file', () => {
      const code = `
export { Button } from './button'
export { Icon } from './icon'
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.isBarrel).toBe(true)
      expect(result.exportMap).toHaveLength(2)
    })

    it('identifies non-barrel file with local declarations', () => {
      const code = `
export { Button } from './button'
const x = 1
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.isBarrel).toBe(false)
    })

    it('identifies non-barrel file with function declarations', () => {
      const code = `
export function foo() {}
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.isBarrel).toBe(false)
    })
  })

  describe('directives', () => {
    it('extracts "use client" directive', () => {
      const code = `
"use client"
export { Button } from './button'
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.isBarrel).toBe(true)
      expect(result.directives).toContain('use client')
    })

    it('extracts "use server" directive', () => {
      const code = `
"use server"
export { action } from './action'
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.directives).toContain('use server')
    })
  })

  describe('export map', () => {
    it('extracts named exports with source', () => {
      const code = `export { Button, Icon } from './components'`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.exportMap).toEqual([
        ['Button', './components', 'Button'],
        ['Icon', './components', 'Icon'],
      ])
    })

    it('handles aliased exports', () => {
      const code = `export { Button as Btn } from './button'`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.exportMap).toEqual([['Btn', './button', 'Button']])
    })

    it('handles re-exports from local imports', () => {
      const code = `
import { foo } from './a'
export { foo }
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.exportMap).toEqual([['foo', './a', 'foo']])
    })

    it('handles default import re-export', () => {
      const code = `
import Button from './button'
export { Button }
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.exportMap).toEqual([['Button', './button', 'default']])
    })

    it('handles namespace re-export', () => {
      const code = `export * as utils from './utils'`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.exportMap).toEqual([['utils', './utils', '*']])
    })
  })

  describe('wildcard exports', () => {
    it('extracts wildcard exports', () => {
      const code = `
export * from './utils'
export * from './helpers'
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.wildcardExports).toEqual(['./utils', './helpers'])
    })

    it('handles mixed exports and wildcards', () => {
      const code = `
export { Button } from './button'
export * from './utils'
`
      const result = analyzeBarrelFile(code, 'index.ts')

      expect(result.exportMap).toHaveLength(1)
      expect(result.wildcardExports).toEqual(['./utils'])
    })
  })
})