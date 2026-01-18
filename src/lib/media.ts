import { logMetric, nowMs } from '@/lib/metrics'

type SupabaseClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        fileBody: ArrayBuffer | Blob | Buffer,
        options?: { contentType?: string; upsert?: boolean }
      ) => Promise<{ data: { path: string } | null; error: { message: string } | null }>
      getPublicUrl: (path: string) => { data: { publicUrl: string } }
    }
  }
}

const resolveExtension = (contentType: string) => {
  const lower = contentType.toLowerCase()
  if (lower.includes('png')) return 'png'
  if (lower.includes('mp4')) return 'mp4'
  if (lower.includes('quicktime') || lower.includes('mov')) return 'mov'
  return 'jpg'
}

export async function uploadMediaToStorage(
  supabase: SupabaseClient,
  mediaUrl: string,
  postId: string,
  index: number,
  bucket = 'posters'
): Promise<string | null> {
  const startedAt = nowMs()
  try {
    const response = await fetch(mediaUrl)
    if (!response.ok) {
      console.error(`Failed to download media: ${mediaUrl}, status: ${response.status}`)
      logMetric('media_upload_failed_download', { postId, index, status: response.status })
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const extension = resolveExtension(contentType)
    const fileName = `${postId}_${index}.${extension}`

    console.log(`Uploading ${fileName} to Supabase Storage (${buffer.length} bytes)`)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      })

    if (error || !data) {
      console.error('Supabase storage error:', error?.message || 'unknown error')
      logMetric('media_upload_failed_storage', { postId, index, error: error?.message || 'unknown' })
      return null
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    logMetric('media_upload_success', {
      postId,
      index,
      bytes: buffer.length,
      duration_ms: nowMs() - startedAt,
    })
    return urlData.publicUrl
  } catch (error) {
    console.error('Media upload error:', error)
    logMetric('media_upload_error', { postId, index, error: String(error) })
    return null
  }
}
