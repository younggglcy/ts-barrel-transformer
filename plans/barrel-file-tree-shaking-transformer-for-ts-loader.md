# Barrel File Tree-Shaking Transformer for ts-loader

## Overview

Implement a barrel file optimization solution for webpack/rspack that works with ts-loader's `getCustomTransformers` configuration. This enables tree-shaking for packages that use barrel files (index.ts re-exports) as entry points.

## Architecture

The solution consists of two main components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Compilation Pipeline                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. TypeScript Transformer (ts-loader getCustomTransformers)         │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │  import { Button, Icon } from 'my-lib'                   │    │
│     │                    ↓                                      │    │
│     │  import { Button, Icon } from                            │    │
│     │    '__barrel_optimize__?names=Button,Icon!=!my-lib'      │    │
│     └──────────────────────────────────────────────────────────┘    │
│                                                                      │
│  2. Webpack Loader (barrel-loader)                                   │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │  Intercepts __barrel_optimize__ requests                 │    │
│     │  Analyzes barrel file structure                          │    │
│     │  Outputs only needed exports                             │    │
│     └──────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component 1: TypeScript Transformer

### File: `src/transformer/named-import-transformer.ts`

**Purpose**: Transform named imports from configured packages to include barrel optimization metadata.

**Input/Output Example**:
```typescript
// Before
import { Button, Icon, Text } from 'my-lib'

// After
import { Button, Icon, Text } from '__barrel_optimize__?names=Button,Icon,Text!=!my-lib'
```

**Key Logic**:
1. Visit all `ImportDeclaration` nodes
2. Check if import source matches configured packages
3. Skip if import has default or namespace specifiers
4. Collect named import identifiers (handle aliases: `import { A as B }` → extract "A")
5. Rewrite import source with `__barrel_optimize__?names=...!=!...` format

**API**:
```typescript
interface TransformerConfig {
  packages: string[]  // Package names to optimize
}

function createNamedImportTransformer(
  config: TransformerConfig
): ts.TransformerFactory<ts.SourceFile>
```

## Component 2: Barrel Analyzer

### File: `src/analyzer/barrel-analyzer.ts`

**Purpose**: Analyze a file to determine if it's a barrel file and extract export mappings.

**Barrel File Criteria**:
- Contains only import/export declarations
- May contain string literal directives ("use client", "use server")
- No local variable/function/class declarations
- No side effects

**Export Map Format**:
```typescript
type ExportMap = Array<[exportedName: string, sourcePath: string, originalName: string]>
// Example: [["Button", "./button", "Button"], ["Icon", "./icon", "default"]]
```

**Key Logic**:
1. **Pass 1**: Build local identifier map for re-export resolution
   - `import { foo } from './a'; export { foo }` → map "foo" to ("./a", "foo")
2. **Pass 2**: Analyze exports and build export map
   - Named exports with source: `export { a } from './a'`
   - Named exports without source (re-exports): `export { foo }`
   - Namespace exports: `export * as ns from './ns'`
   - Wildcard exports: `export * from './utils'`

**API**:
```typescript
interface BarrelAnalysisResult {
  isBarrel: boolean
  exportMap: ExportMap
  wildcardExports: string[]
  directives: string[]  // "use client", "use server"
}

function analyzeBarrelFile(
  source: string,
  filename: string,
  isWildcard?: boolean
): BarrelAnalysisResult
```

## Component 3: Webpack Loader

### File: `src/loader/barrel-loader.ts`

**Purpose**: Intercept `__barrel_optimize__` requests and generate optimized exports.

**Key Logic**:
1. Parse `names` from query string
2. Analyze target file using barrel analyzer
3. **Non-barrel file**: Output `export * from '<original-file>'`
4. **Barrel file**:
   - Build export map from analysis
   - Filter to only requested names
   - Generate targeted re-exports
5. **Wildcard exports**: Recursively analyze and merge export maps

**Caching Strategy**:
- In-memory cache for barrel analysis results
- Key: absolute file path
- Assumption: package files don't change during build

**API**:
```typescript
interface LoaderOptions {
  names: string[]
  cacheDir?: string
}

// Webpack loader function
export default function barrelLoader(this: LoaderContext, source: string): void
```

## Component 4: Main Entry Point

### File: `src/index.ts`

**Purpose**: Export the transformer factory and loader for easy integration.

**API**:
```typescript
// For ts-loader getCustomTransformers
export { createNamedImportTransformer } from './transformer/named-import-transformer'
export type { TransformerConfig } from './transformer/named-import-transformer'

// For webpack loader configuration
export { default as barrelLoader } from './loader/barrel-loader'
export type { LoaderOptions } from './loader/barrel-loader'

// Utility for webpack config
export function createBarrelLoaderRule(options?: { cacheDir?: string }): webpack.RuleSetRule
```

## Usage Example

### webpack.config.js
```javascript
const { createBarrelLoaderRule } = require('ts-barrel-transformer')

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            getCustomTransformers: () => ({
              before: [
                require('ts-barrel-transformer').createNamedImportTransformer({
                  packages: ['antd', '@mui/material', 'lodash-es']
                })
              ]
            })
          }
        }
      },
      // Barrel optimization loader rule
      createBarrelLoaderRule()
    ]
  }
}
```

## Project Structure

```
ts-barrel-transformer/
├── src/
│   ├── index.ts                              # Main entry point
│   ├── transformer/
│   │   └── named-import-transformer.ts       # TypeScript transformer
│   ├── analyzer/
│   │   └── barrel-analyzer.ts                # Barrel file analyzer
│   ├── loader/
│   │   └── barrel-loader.ts                  # Webpack loader
│   └── utils/
│       ├── cache.ts                          # Caching utilities
│       └── resolve.ts                        # Module resolution utilities
├── tests/
│   ├── transformer.test.ts
│   ├── analyzer.test.ts
│   └── loader.test.ts
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

## Implementation Steps

### Step 1: Project Setup
- [ ] Initialize package.json with dependencies
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Set up build scripts

### Step 2: TypeScript Transformer
- [ ] Implement `createNamedImportTransformer`
- [ ] Handle named imports extraction
- [ ] Handle import aliases
- [ ] Skip default/namespace imports
- [ ] Rewrite import source

### Step 3: Barrel Analyzer
- [ ] Implement AST parsing (using TypeScript compiler API)
- [ ] Implement local identifier mapping (Pass 1)
- [ ] Implement export analysis (Pass 2)
- [ ] Handle all export types (named, namespace, wildcard)
- [ ] Detect barrel file criteria

### Step 4: Webpack Loader
- [ ] Implement loader entry point
- [ ] Parse query parameters
- [ ] Integrate barrel analyzer
- [ ] Implement caching
- [ ] Generate optimized exports
- [ ] Handle recursive wildcard exports

### Step 5: Integration & Testing
- [ ] Create integration tests with webpack
- [ ] Test with real-world packages (antd, lodash-es)
- [ ] Performance benchmarking
- [ ] Documentation

## Dependencies

```json
{
  "dependencies": {
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "webpack": "^5.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0",
    "ts-loader": "^9.0.0"
  }
}
```

## Design Decisions

1. **React Directives**: Support `"use client"` and `"use server"` directives - they will be preserved and propagated through barrel chains
2. **AST Parsing**: Use TypeScript compiler API directly (no ts-morph dependency)
3. **Package Name**: `ts-barrel-transformer`

## Key Differences from Next.js Implementation

| Aspect | Next.js | This Implementation |
|--------|---------|---------------------|
| Transform Runtime | SWC (Rust) | TypeScript Compiler API |
| Integration | Built into Next.js | Standalone package |
| Loader | next-barrel-loader | barrel-loader |
| Config | optimizePackageImports | TransformerConfig.packages |
| Directives | Supported | Supported |

## Verification Plan

1. **Unit Tests**:
   - Transformer correctly rewrites imports
   - Analyzer correctly identifies barrel files
   - Analyzer correctly extracts export maps
   - Loader generates correct output

2. **Integration Tests**:
   - Full webpack build with ts-loader
   - Verify tree-shaking works (bundle size reduction)
   - Test with real packages (antd, lodash-es)

3. **Manual Testing**:
   - Create example project
   - Compare bundle sizes before/after
   - Verify runtime behavior unchanged
