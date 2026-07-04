import { useEffect, useState } from 'react'
import { useTreeStore } from '@/lib/store'

/** Resolves 'system' via prefers-color-scheme and reacts to changes. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useTreeStore((s) => s.theme)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}
