import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { createNamedImportTransformer } from '../src/transformer/named-import-transformer'

function transform(code: string, packages: string[]): string {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  const transformer = createNamedImportTransformer({ packages })
  const result = ts.transform(sourceFile, [transformer])
  const printer = ts.createPrinter()
  const output = printer.printFile(result.transformed[0])
  result.dispose()

  return output.trim()
}

describe('createNamedImportTransformer', () => {
  it('transforms named imports from configured packages', () => {
    const code = `import { Button, Icon } from 'my-lib'`
    const result = transform(code, ['my-lib'])

    expect(result).toContain('__barrel_optimize__')
    expect(result).toContain('names=Button,Icon')
    expect(result).toContain('!=!my-lib')
  })

  it('handles import aliases correctly', () => {
    const code = `import { Button as Btn, Icon as Ico } from 'my-lib'`
    const result = transform(code, ['my-lib'])

    // Should extract original names (Button, Icon), not aliases
    expect(result).toContain('names=Button,Icon')
  })

  it('skips packages not in config', () => {
    const code = `import { useState } from 'react'`
    const result = transform(code, ['my-lib'])

    expect(result).not.toContain('__barrel_optimize__')
    expect(result).toContain(`from 'react'`)
  })

  it('skips default imports', () => {
    const code = `import MyLib from 'my-lib'`
    const result = transform(code, ['my-lib'])

    expect(result).not.toContain('__barrel_optimize__')
  })

  it('skips namespace imports', () => {
    const code = `import * as MyLib from 'my-lib'`
    const result = transform(code, ['my-lib'])

    expect(result).not.toContain('__barrel_optimize__')
  })

  it('skips mixed default and named imports', () => {
    const code = `import MyLib, { Button } from 'my-lib'`
    const result = transform(code, ['my-lib'])

    // Should skip because it has a default import
    expect(result).not.toContain('__barrel_optimize__')
  })

  it('handles multiple configured packages', () => {
    const code1 = `import { Button } from 'antd'`
    const code2 = `import { Box } from '@mui/material'`

    const result1 = transform(code1, ['antd', '@mui/material'])
    const result2 = transform(code2, ['antd', '@mui/material'])

    expect(result1).toContain('__barrel_optimize__')
    expect(result1).toContain('!=!antd')
    expect(result2).toContain('__barrel_optimize__')
    expect(result2).toContain('!=!@mui/material')
  })

  it('handles single named import', () => {
    const code = `import { Button } from 'my-lib'`
    const result = transform(code, ['my-lib'])

    expect(result).toContain('names=Button')
  })

  it('preserves other statements', () => {
    const code = `
import { Button } from 'my-lib'
const x = 1
export { x }
`
    const result = transform(code, ['my-lib'])

    expect(result).toContain('__barrel_optimize__')
    expect(result).toContain('const x = 1')
    expect(result).toContain('export { x }')
  })
})
