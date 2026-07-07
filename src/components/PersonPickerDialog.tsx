import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { displayName, lifespanLabel } from '@/lib/person'
import type { Person } from '@/types'

interface PersonPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  candidates: Person[]
  onPick: (personId: string) => void
}

export function PersonPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  candidates,
  onPick,
}: PersonPickerDialogProps) {
  const t = useT()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((p) => {
        if (!q) return true
        const haystack = `${p.firstName} ${p.lastName} ${p.birthName ?? ''}`.toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'de'))
  }, [candidates, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Input
          autoFocus
          placeholder={t('action.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="-mx-1 max-h-64 overflow-y-auto px-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('picker.empty')}
            </p>
          ) : (
            <div className="grid gap-0.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onPick(p.id)
                    onOpenChange(false)
                  }}
                  className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{displayName(p)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {lifespanLabel(p)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
