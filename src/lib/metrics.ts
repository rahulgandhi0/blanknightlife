import { featureFlags } from '@/lib/feature-flags'

export const nowMs = () => Date.now()

export const logMetric = (event: string, data: Record<string, unknown>) => {
  if (!featureFlags.metrics) return
  console.info(`[metrics] ${event}`, data)
}
