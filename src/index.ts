// Transformer
export {
  createNamedImportTransformer,
  type TransformerConfig,
} from './transformer/named-import-transformer'

// Analyzer
export {
  analyzeBarrelFile,
  type BarrelAnalysisResult,
  type ExportMap,
  type ExportMapEntry,
} from './analyzer/barrel-analyzer'

// Loader
export { default as barrelLoader, type LoaderOptions } from './loader/barrel-loader'

// Utils
export { clearCache } from './utils/cache'

// Webpack rule helper
import type { RuleSetRule } from 'webpack'

export interface BarrelLoaderRuleOptions {
  cacheDir?: string
}

/**
 * Creates a webpack rule for the barrel loader.
 * This rule intercepts __barrel_optimize__ requests.
 */
export function createBarrelLoaderRule(
  options?: BarrelLoaderRuleOptions
): RuleSetRule {
  return {
    test: /__barrel_optimize__/,
    use: {
      loader: require.resolve('./loader/barrel-loader'),
      options: options ?? {},
    },
  }
}
