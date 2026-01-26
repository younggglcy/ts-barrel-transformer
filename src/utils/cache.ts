import type { BarrelAnalysisResult } from '../analyzer/barrel-analyzer'

/**
 * In-memory cache for barrel analysis results.
 * Key: absolute file path
 * Assumption: package files don't change during build
 */
const analysisCache = new Map<string, BarrelAnalysisResult>()

export function getCachedAnalysis(filePath: string): BarrelAnalysisResult | undefined {
  return analysisCache.get(filePath)
}

export function setCachedAnalysis(filePath: string, result: BarrelAnalysisResult): void {
  analysisCache.set(filePath, result)
}

export function clearCache(): void {
  analysisCache.clear()
}
