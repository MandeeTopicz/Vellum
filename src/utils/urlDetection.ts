/**
 * URL detection utilities for link paste and embed creation.
 * Determines object type (image, embed, link-card) from pasted or dropped URLs.
 */

/** Image file extensions (with optional query string) */
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i

export function isImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return IMAGE_EXT_RE.test(u.pathname)
  } catch {
    return IMAGE_EXT_RE.test(url)
  }
}

export function isGoogleDoc(url: string): boolean {
  return url.includes('docs.google.com') || url.includes('drive.google.com')
}

export function isYouTube(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be')
}

/** Extract YouTube video ID from watch or short URL. */
function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

/** Convert YouTube watch URL to embed URL. */
export function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeVideoId(url)
  if (!id) return null
  return `https://www.youtube.com/embed/${id}`
}

/** Get embed URL for supported services. Returns null if not embeddable. */
export function getEmbedUrl(url: string, embedType: 'youtube' | 'google-doc'): string | null {
  if (embedType === 'youtube') return getYouTubeEmbedUrl(url)
  if (embedType === 'google-doc') {
    // Google Docs/Drive: use embed or preview URL
    if (url.includes('/document/')) return url.replace('/edit', '/preview')
    if (url.includes('/file/')) return url
    return url
  }
  return null
}
