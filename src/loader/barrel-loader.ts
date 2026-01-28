import fs from 'fs'
import path from 'path'
import type { LoaderContext } from 'webpack'
import { analyzeBarrelFile, type ExportMap } from '../analyzer/barrel-analyzer'
import { getCachedAnalysis, setCachedAnalysis } from '../utils/cache'
import { resolveModulePath } from '../utils/resolve'

export interface LoaderOptions {
  /** Names to extract from the barrel */
  names?: string[]
  /** Cache directory (unused, kept for API compatibility) */
  cacheDir?: string
}

const BARREL_OPTIMIZE_PREFIX = '__barrel_optimize__'

/**
 * Parses the barrel optimize query string.
 * Format: __barrel_optimize__?names=Button,Icon!=!my-lib
 */
function parseBarrelQuery(resourceQuery: string): { names: string[]; originalPath: string } | null {
  // resourceQuery includes the leading '?'
  if (!resourceQuery.startsWith('?')) return null

  const query = resourceQuery.slice(1)
  const match = query.match(/^names=([^!]+)!=!(.+)$/)
  if (!match) return null

  const names = match[1].split(',').filter(Boolean)
  const originalPath = match[2]

  return { names, originalPath }
}

/**
 * Analyzes a file with caching support.
 */
function analyzeWithCache(
  filePath: string,
  isWildcard = false
): ReturnType<typeof analyzeBarrelFile> | null {
  const cached = getCachedAnalysis(filePath)
  if (cached) return cached

  try {
    const source = fs.readFileSync(filePath, 'utf-8')
    const result = analyzeBarrelFile(source, filePath, isWildcard)
    setCachedAnalysis(filePath, result)
    return result
  } catch {
    return null
  }
}

/**
 * Recursively resolves wildcard exports and merges them into the export map.
 */
function resolveWildcardExports(
  wildcardPaths: string[],
  fromFile: string,
  visited = new Set<string>()
): ExportMap {
  const result: ExportMap = []

  for (const wildcardPath of wildcardPaths) {
    const resolvedPath = resolveModulePath(wildcardPath, fromFile)
    if (!resolvedPath || visited.has(resolvedPath)) continue

    visited.add(resolvedPath)

    const analysis = analyzeWithCache(resolvedPath, true)
    if (!analysis) continue

    // Add direct exports
    result.push(...analysis.exportMap)

    // Recursively resolve nested wildcards
    if (analysis.wildcardExports.length > 0) {
      const nestedExports = resolveWildcardExports(
        analysis.wildcardExports,
        resolvedPath,
        visited
      )
      result.push(...nestedExports)
    }
  }

  return result
}

/**
 * Generates the optimized export code for requested names.
 */
function generateOptimizedExports(
  exportMap: ExportMap,
  requestedNames: Set<string>,
  directives: string[]
): string {
  const lines: string[] = []

  // Add directives first
  for (const directive of directives) {
    lines.push(`"${directive}";`)
  }

  // Group exports by source path for cleaner output
  const exportsBySource = new Map<string, Array<{ exportedName: string; originalName: string }>>()

  for (const [exportedName, sourcePath, originalName] of exportMap) {
    if (!requestedNames.has(exportedName)) continue

    if (!exportsBySource.has(sourcePath)) {
      exportsBySource.set(sourcePath, [])
    }
    exportsBySource.get(sourcePath)!.push({ exportedName, originalName })
  }

  // Generate export statements
  for (const [sourcePath, exports] of exportsBySource) {
    const exportParts = exports.map(({ exportedName, originalName }) => {
      if (originalName === 'default') {
        return `default as ${exportedName}`
      }
      if (originalName === '*') {
        // Namespace export
        return `* as ${exportedName}`
      }
      if (originalName === exportedName) {
        return exportedName
      }
      return `${originalName} as ${exportedName}`
    })

    lines.push(`export { ${exportParts.join(', ')} } from '${sourcePath}';`)
  }

  return lines.join('\n')
}

/**
 * Webpack loader that intercepts __barrel_optimize__ requests
 * and generates optimized exports.
 */
export default function barrelLoader(
  this: LoaderContext<LoaderOptions>,
  source: string
): void {
  const callback = this.async()

  try {
    // Check if this is a barrel optimize request
    const resourcePath = this.resourcePath
    const resourceQuery = this.resourceQuery

    // Parse the query to get requested names
    const parsed = parseBarrelQuery(resourceQuery)

    if (!parsed) {
      // Not a barrel optimize request, pass through
      callback(null, source)
      return
    }

    const { names, originalPath } = parsed
    const requestedNames = new Set(names)

    // Analyze the barrel file
    const analysis = analyzeWithCache(resourcePath)

    if (!analysis) {
      // Failed to analyze, fall back to re-exporting everything
      callback(null, `export * from '${originalPath}';`)
      return
    }

    if (!analysis.isBarrel) {
      // Not a barrel file, re-export everything
      callback(null, `export * from '${originalPath}';`)
      return
    }

    // Build complete export map including wildcard exports
    let exportMap = [...analysis.exportMap]

    if (analysis.wildcardExports.length > 0) {
      const wildcardExports = resolveWildcardExports(
        analysis.wildcardExports,
        resourcePath
      )
      exportMap.push(...wildcardExports)
    }

    // Generate optimized exports
    const output = generateOptimizedExports(
      exportMap,
      requestedNames,
      analysis.directives
    )

    // If no exports were found for requested names, fall back
    if (!output.trim() || output === analysis.directives.map(d => `"${d}";`).join('\n')) {
      callback(null, `export * from '${originalPath}';`)
      return
    }

    callback(null, output)
  } catch (error) {
    callback(error as Error)
  }
}

/**
 * Pitch function to handle the barrel optimize prefix in the request.
 */
barrelLoader.pitch = function (
  this: LoaderContext<LoaderOptions>,
  remainingRequest: string
): string | undefined {
  // Check if this request starts with the barrel optimize prefix
  if (!remainingRequest.includes(BARREL_OPTIMIZE_PREFIX)) {
    return undefined
  }

  // Extract the query and original path
  const match = remainingRequest.match(
    /__barrel_optimize__\?names=([^!]+)!=!(.+)$/
  )

  if (!match) {
    return undefined
  }

  const names = match[1].split(',').filter(Boolean)
  const originalPath = match[2]

  // Resolve the original module path
  const resolved = this.resolve(this.context, originalPath, (err, result) => {
    if (err || !result) return

    // Add the resolved file as a dependency
    this.addDependency(result)
  })

  return undefined
}
