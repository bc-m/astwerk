import { useMemo, useState } from 'react'
import { NetworkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { ageLabel, ageOf, birthNameLabel, displayName, initials, isDeceased } from '@/lib/person'
import { useTreeStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Person } from '@/types'

function matches(person: Person, query: string): boolean {
  if (!query) return true
  const haystack = [
    person.firstName,
    person.lastName,
    person.birthFirstName ?? '',
    person.birthName ?? '',
    person.birthPlace ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function ListView() {
  const t = useT()
  const persons = useTreeStore((s) => s.persons)
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId)
  const selectPerson = useTreeStore((s) => s.selectPerson)
  const focusPerson = useTreeStore((s) => s.focusPerson)
  const setViewMode = useTreeStore((s) => s.setViewMode)
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(persons)
      .filter((p) => matches(p, q))
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName, 'de') ||
          a.firstName.localeCompare(b.firstName, 'de'),
      )
  }, [persons, query])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-card px-4 py-2.5">
        <Input
          placeholder={t('list.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 max-w-xs"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card text-left text-xs text-muted-foreground shadow-[0_1px_0_var(--color-border)]">
            <tr>
              <th className="px-4 py-2 font-medium">{t('list.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('list.col.born')}</th>
              <th className="px-4 py-2 font-medium">{t('list.col.died')}</th>
              <th className="px-4 py-2 font-medium">{t('list.col.age')}</th>
              <th className="px-4 py-2 font-medium">{t('list.col.birthplace')}</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const birthName = birthNameLabel(p)
              return (
                <tr
                  key={p.id}
                  onClick={() => selectPerson(p.id)}
                  className={cn(
                    'cursor-pointer border-t hover:bg-accent/50',
                    p.id === selectedPersonId && 'bg-accent',
                  )}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        {p.photo ? (
                          <img src={p.photo} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            {initials(p)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{displayName(p)}</div>
                        {birthName && (
                          <div className="truncate text-xs text-muted-foreground italic">
                            {birthName}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{p.birthDate}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{p.deathDate}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      {(ageOf(p) ?? 1) < 1 ? ageLabel(p) : (ageOf(p) ?? '')}
                      {isDeceased(p) && (
                        <span className="text-muted-foreground" title={t('list.deceased')}>
                          †
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">{p.birthPlace}</td>
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 text-muted-foreground"
                      aria-label={t('list.showInTree.aria', { name: displayName(p) })}
                      title={t('list.showInTree')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewMode('tree')
                        focusPerson(p.id)
                      }}
                    >
                      <NetworkIcon className="size-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {Object.keys(persons).length === 0
              ? t('list.empty.none')
              : t('list.empty.noMatch')}
          </p>
        )}
      </div>
    </div>
  )
}
