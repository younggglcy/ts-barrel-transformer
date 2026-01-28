# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build with tsdown
bun run test         # Run all tests
bun run test:watch   # Run tests in watch mode
bun run typecheck    # Type check without emitting
bun vitest run tests/transformer.test.ts  # Run a single test file
```

## Architecture

This is a barrel file tree-shaking optimizer for ts-loader, inspired by Next.js `optimizePackageImports`. It works in two phases:

### Phase 1: TypeScript Transformer (`src/transformer/`)
`createNamedImportTransformer` rewrites imports from configured packages:
```ts
import { Button } from 'antd'
// becomes
import { Button } from '__barrel_optimize__?names=Button!=!antd'
```

### Phase 2: Webpack Loader (`src/loader/`)
`barrelLoader` intercepts `__barrel_optimize__` requests, analyzes the barrel file, and generates optimized exports that only include requested names.

### Supporting Modules
- `src/analyzer/barrel-analyzer.ts` - Parses barrel files using TypeScript compiler API, extracts export maps and handles wildcard re-exports
- `src/utils/cache.ts` - In-memory cache for barrel analysis results
- `src/utils/resolve.ts` - Module path resolution utilities
