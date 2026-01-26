import path from 'path'
import fs from 'fs'

/**
 * Resolves a module specifier to an absolute file path.
 * Handles relative paths and tries common extensions.
 */
export function resolveModulePath(
  specifier: string,
  fromFile: string,
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
): string | null {
  const dir = path.dirname(fromFile)

  // Handle relative paths
  if (specifier.startsWith('.')) {
    const basePath = path.resolve(dir, specifier)

    // Try exact path first
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return basePath
    }

    // Try with extensions
    for (const ext of extensions) {
      const withExt = basePath + ext
      if (fs.existsSync(withExt)) {
        return withExt
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = path.join(basePath, `index${ext}`)
      if (fs.existsSync(indexPath)) {
        return indexPath
      }
    }
  }

  return null
}
