import { useMemo, useRef, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { displayName, lifespanLabel } from '@/lib/person'
import { useTreeStore } from '@/lib/store'

export function PersonSearch() {
  const t = useT()
  const persons = useTreeStore((s) => s.persons)
  const focusPerson = useTreeStore((s) => s.focusPerson)
  const setViewMode = useTreeStore((s) => s.setViewMode)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return Object.values(persons)
      .filter((p) =>
        `${p.firstName} ${p.lastName} ${p.birthFirstName ?? ''} ${p.birthName ?? ''}`
          .toLowerCase()
          .includes(q),
      )
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'de'))
      .slice(0, 8)
  }, [persons, query])

  const pick = (id: string) => {
    setViewMode('tree')
    focusPerson(id)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <div className="relative grow basis-44 sm:grow-0 sm:basis-auto">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.aria')}
        className="h-8 w-full pl-7 sm:w-44"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length > 0) pick(results[0].id)
          if (e.key === 'Escape') setQuery('')
        }}
      />
      {query.trim() !== '' && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border bg-popover p-1 shadow-md">
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('search.noMatches')}</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(p.id)
                }}
                className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">{displayName(p)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{lifespanLabel(p)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
