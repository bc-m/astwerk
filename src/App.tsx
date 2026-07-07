import { useEffect } from 'react'
import { DetailPanel } from '@/components/DetailPanel'
import { ListView } from '@/components/ListView'
import { Toolbar } from '@/components/Toolbar'
import { TreeCanvas } from '@/components/TreeCanvas'
import { useLang } from '@/lib/i18n'
import { redoTree, undoTree, useTreeStore } from '@/lib/store'
import { useResolvedTheme } from '@/lib/theme'

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  )
}

export default function App() {
  const viewMode = useTreeStore((s) => s.viewMode)
  const resolvedTheme = useResolvedTheme()
  const lang = useLang()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      // Don't override native text undo in input fields
      if (isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redoTree()
        else undoTree()
      } else if (key === 'y') {
        e.preventDefault()
        redoTree()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Toolbar />
      <main className="flex min-h-0 flex-1">
        {/* Tree stays mounted so the camera position is preserved when switching views */}
        <div className={viewMode === 'tree' ? 'relative min-w-0 flex-1' : 'hidden'}>
          <TreeCanvas />
        </div>
        {viewMode === 'list' && (
          <div className="relative min-w-0 flex-1">
            <ListView />
          </div>
        )}
        <DetailPanel />
      </main>
    </div>
  )
}
