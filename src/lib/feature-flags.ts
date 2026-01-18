type FlagName =
  | 'FEATURE_METRICS'
  | 'FEATURE_UPLOAD_ON_APPROVE'
  | 'FEATURE_ASYNC_APIFY'
  | 'FEATURE_CAPTION_CACHE'

const parseEnvFlag = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) return defaultValue
  const normalized = value.toLowerCase().trim()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

const envFlag = (name: FlagName, defaultValue: boolean) =>
  parseEnvFlag(process.env[name], defaultValue)

export const featureFlags = {
  metrics: envFlag('FEATURE_METRICS', true),
  uploadOnApprove: envFlag('FEATURE_UPLOAD_ON_APPROVE', true),
  asyncApify: envFlag('FEATURE_ASYNC_APIFY', true),
  captionCache: envFlag('FEATURE_CAPTION_CACHE', true),
}
