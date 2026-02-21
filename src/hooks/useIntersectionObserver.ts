/**
 * Triggers a callback when the observed element enters the viewport.
 * Used for lazy-loading board thumbnails on the dashboard.
 */
import { useEffect, useRef } from 'react'

/**
 * @param onVisible - Called when the element becomes visible
 * @param options - IntersectionObserver options
 * @returns Ref to attach to the observed element
 */
export function useIntersectionObserver(
  onVisible: () => void,
  options?: { rootMargin?: string; threshold?: number }
) {
  const ref = useRef<HTMLDivElement | null>(null)
  const triggeredRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || triggeredRef.current) return
        triggeredRef.current = true
        onVisible()
      },
      { rootMargin: '100px', threshold: 0.01, ...options }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onVisible, options?.rootMargin, options?.threshold])

  return ref
}
