import ts from 'typescript'

/**
 * Export map entry: [exportedName, sourcePath, originalName]
 * Example: ["Button", "./button", "Button"] or ["Icon", "./icon", "default"]
 */
export type ExportMapEntry = [exportedName: string, sourcePath: string, originalName: string]
export type ExportMap = ExportMapEntry[]

export interface BarrelAnalysisResult {
  /** Whether the file is a barrel file (only imports/exports, no side effects) */
  isBarrel: boolean
  /** Map of exported names to their source paths and original names */
  exportMap: ExportMap
  /** Paths of wildcard exports (export * from './utils') */
  wildcardExports: string[]
  /** Directives like "use client", "use server" */
  directives: string[]
}

/**
 * Analyzes a file to determine if it's a barrel file and extracts export mappings.
 *
 * Barrel file criteria:
 * - Contains only import/export declarations
 * - May contain string literal directives ("use client", "use server")
 * - No local variable/function/class declarations
 * - No side effects
 */
export function analyzeBarrelFile(
  source: string,
  filename: string,
  isWildcard = false
): BarrelAnalysisResult {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  const result: BarrelAnalysisResult = {
    isBarrel: true,
    exportMap: [],
    wildcardExports: [],
    directives: [],
  }

  // Pass 1: Build local identifier map for re-export resolution
  // Maps local identifier to [sourcePath, originalName]
  const localIdentifierMap = new Map<string, [string, string]>()

  for (const statement of sourceFile.statements) {
    // Check for directives (string literal expression statements)
    if (ts.isExpressionStatement(statement)) {
      if (ts.isStringLiteral(statement.expression)) {
        const text = statement.expression.text
        if (text === 'use client' || text === 'use server') {
          result.directives.push(text)
          continue
        }
      }
      // Non-directive expression statement = not a barrel
      result.isBarrel = false
      continue
    }

    // Import declarations - build local identifier map
    if (ts.isImportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier
      if (!ts.isStringLiteral(moduleSpecifier)) continue

      const sourcePath = moduleSpecifier.text
      const importClause = statement.importClause
      if (!importClause) continue

      // Default import: import foo from './a' -> map "foo" to ("./a", "default")
      if (importClause.name) {
        localIdentifierMap.set(importClause.name.text, [sourcePath, 'default'])
      }

      // Named imports: import { foo, bar as baz } from './a'
      if (importClause.namedBindings) {
        if (ts.isNamedImports(importClause.namedBindings)) {
          for (const element of importClause.namedBindings.elements) {
            const localName = element.name.text
            const originalName = element.propertyName?.text ?? localName
            localIdentifierMap.set(localName, [sourcePath, originalName])
          }
        }
        // Namespace import: import * as ns from './a' -> map "ns" to ("./a", "*")
        else if (ts.isNamespaceImport(importClause.namedBindings)) {
          localIdentifierMap.set(importClause.namedBindings.name.text, [sourcePath, '*'])
        }
      }
      continue
    }

    // Export declarations - will process in Pass 2
    if (ts.isExportDeclaration(statement)) {
      continue
    }

    // Export assignment: export = something (not a barrel pattern)
    if (ts.isExportAssignment(statement)) {
      result.isBarrel = false
      continue
    }

    // Any other statement type means this is not a barrel file
    result.isBarrel = false
  }

  // Pass 2: Analyze exports and build export map
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue

    const moduleSpecifier = statement.moduleSpecifier
    const exportClause = statement.exportClause

    // Case 1: export * from './utils' (wildcard re-export)
    if (!exportClause && moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
      result.wildcardExports.push(moduleSpecifier.text)
      continue
    }

    // Case 2: export * as ns from './ns' (namespace re-export)
    if (exportClause && ts.isNamespaceExport(exportClause)) {
      if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
        result.exportMap.push([exportClause.name.text, moduleSpecifier.text, '*'])
      }
      continue
    }

    // Case 3: Named exports
    if (exportClause && ts.isNamedExports(exportClause)) {
      for (const element of exportClause.elements) {
        const exportedName = element.name.text
        // propertyName is the original name if aliased: export { foo as bar }
        const localName = element.propertyName?.text ?? exportedName

        // Case 3a: export { a, b } from './source' (direct re-export)
        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
          result.exportMap.push([exportedName, moduleSpecifier.text, localName])
          continue
        }

        // Case 3b: export { foo } (re-export from local import)
        const localMapping = localIdentifierMap.get(localName)
        if (localMapping) {
          const [sourcePath, originalName] = localMapping
          result.exportMap.push([exportedName, sourcePath, originalName])
        }
        // If no local mapping found, it might be a local declaration export
        // which means this isn't a pure barrel file
      }
    }
  }

  // For wildcard analysis, we don't require it to be a barrel
  if (isWildcard) {
    result.isBarrel = true
  }

  return result
}