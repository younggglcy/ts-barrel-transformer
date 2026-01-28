import ts from 'typescript'

export interface TransformerConfig {
  /** Package names to optimize (e.g., ['antd', '@mui/material', 'lodash-es']) */
  packages: string[]
}

/**
 * Creates a TypeScript transformer that rewrites named imports from configured packages
 * to include barrel optimization metadata.
 *
 * @example
 * // Before
 * import { Button, Icon } from 'my-lib'
 *
 * // After
 * import { Button, Icon } from '__barrel_optimize__?names=Button,Icon!=!my-lib'
 */
export function createNamedImportTransformer(
  config: TransformerConfig
): ts.TransformerFactory<ts.SourceFile> {
  const packageSet = new Set(config.packages)

  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      const visitor = (node: ts.Node): ts.Node => {
        if (!ts.isImportDeclaration(node)) {
          return ts.visitEachChild(node, visitor, context)
        }

        // Get the module specifier (import source)
        const moduleSpecifier = node.moduleSpecifier
        if (!ts.isStringLiteral(moduleSpecifier)) {
          return node
        }

        const importSource = moduleSpecifier.text

        // Check if this package should be optimized
        if (!packageSet.has(importSource)) {
          return node
        }

        // Get import clause
        const importClause = node.importClause
        if (!importClause) {
          // Side-effect import: import 'my-lib'
          return node
        }

        // Skip if has default import: import Default from 'my-lib'
        // Skip if has namespace import: import * as lib from 'my-lib'
        if (importClause.name || importClause.namedBindings?.kind === ts.SyntaxKind.NamespaceImport) {
          return node
        }

        // Must have named bindings
        const namedBindings = importClause.namedBindings
        if (!namedBindings || !ts.isNamedImports(namedBindings)) {
          return node
        }

        // Collect named import identifiers
        // Handle aliases: import { A as B } -> extract "A" (the original name)
        const names: string[] = []
        for (const element of namedBindings.elements) {
          // propertyName is the original name (if aliased), name is the local binding
          const originalName = element.propertyName
            ? element.propertyName.text
            : element.name.text
          names.push(originalName)
        }

        if (names.length === 0) {
          return node
        }

        // Create new module specifier with barrel optimization format
        // Format: __barrel_optimize__?names=Button,Icon!=!my-lib
        const optimizedSource = `__barrel_optimize__?names=${names.join(',')}!=!${importSource}`

        // Create new import declaration with rewritten source
        return context.factory.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          context.factory.createStringLiteral(optimizedSource),
          node.attributes
        )
      }

      return ts.visitNode(sourceFile, visitor) as ts.SourceFile
    }
  }
}
