import { useRef, useState } from 'react'
import {
  BabyIcon,
  CameraIcon,
  FocusIcon,
  HeartIcon,
  Link2Icon,
  Link2OffIcon,
  NetworkIcon,
  Trash2Icon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { PersonPickerDialog } from '@/components/PersonPickerDialog'
import { fileToResizedDataUrl } from '@/lib/image'
import { displayName, initials } from '@/lib/person'
import {
  childCandidates,
  parentCandidates,
  parentUnionOf,
  partnerCandidates,
} from '@/lib/relations'
import { useTreeStore } from '@/lib/store'
import { COUNTRY_OPTIONS, GENDER_OPTIONS, type Gender, type Person } from '@/types'

type PickerMode =
  | { kind: 'partner' }
  | { kind: 'child'; unionId?: string }
  | { kind: 'parent' }

const BIRTH_GENDER_OPTIONS = [{ value: 'none', label: 'keine Angabe' }, ...GENDER_OPTIONS]

const COUNTRY_SELECT_ITEMS = [
  { value: 'none', label: 'keine Angabe' },
  ...COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: `${c.flag} ${c.label}` })),
]

function PersonLink({ person }: { person: Person }) {
  const focusPerson = useTreeStore((s) => s.focusPerson)
  return (
    <button
      type="button"
      onClick={() => focusPerson(person.id)}
      className="block max-w-full truncate text-left text-sm text-foreground hover:underline"
    >
      {displayName(person)}
    </button>
  )
}

function RelationRow({
  person,
  unlinkLabel,
  onUnlink,
}: {
  person: Person
  unlinkLabel: string
  onUnlink: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <PersonLink person={person} />
      <Button
        variant="ghost"
        size="sm"
        className="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
        aria-label={unlinkLabel}
        title={unlinkLabel}
        onClick={onUnlink}
      >
        <Link2OffIcon className="size-3.5" />
      </Button>
    </div>
  )
}

export function DetailPanel() {
  const persons = useTreeStore((s) => s.persons)
  const unions = useTreeStore((s) => s.unions)
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId)
  const updatePerson = useTreeStore((s) => s.updatePerson)
  const deletePerson = useTreeStore((s) => s.deletePerson)
  const addPartner = useTreeStore((s) => s.addPartner)
  const addChild = useTreeStore((s) => s.addChild)
  const addParents = useTreeStore((s) => s.addParents)
  const addParent = useTreeStore((s) => s.addParent)
  const linkPartner = useTreeStore((s) => s.linkPartner)
  const linkChild = useTreeStore((s) => s.linkChild)
  const linkParent = useTreeStore((s) => s.linkParent)
  const unlinkPartner = useTreeStore((s) => s.unlinkPartner)
  const unlinkChild = useTreeStore((s) => s.unlinkChild)
  const focusLineageId = useTreeStore((s) => s.focusLineageId)
  const toggleFocusLineage = useTreeStore((s) => s.toggleFocusLineage)
  const ancestorFocusId = useTreeStore((s) => s.ancestorFocusId)
  const toggleAncestorFocus = useTreeStore((s) => s.toggleAncestorFocus)
  const selectPerson = useTreeStore((s) => s.selectPerson)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [picker, setPicker] = useState<PickerMode | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const person = selectedPersonId ? persons[selectedPersonId] : undefined

  if (!person) {
    // On mobile the panel is a drawer that only opens for a selected person,
    // so the placeholder is shown on wider screens only.
    return (
      <aside className="hidden w-80 shrink-0 items-center justify-center border-l bg-card p-6 md:flex">
        <p className="text-center text-sm text-muted-foreground">
          Wähle eine Person im Baum aus, um ihre Details zu bearbeiten.
        </p>
      </aside>
    )
  }

  const patch = (p: Partial<Omit<Person, 'id'>>) => updatePerson(person.id, p)
  const ownUnions = Object.values(unions).filter((u) => u.partnerIds.includes(person.id))
  const parentUnion = parentUnionOf(unions, person.id)
  const parents = (parentUnion?.partnerIds ?? [])
    .map((id) => persons[id])
    .filter((p): p is Person => Boolean(p))
  const siblings = (parentUnion?.childIds ?? [])
    .filter((id) => id !== person.id)
    .map((id) => persons[id])
    .filter((p): p is Person => Boolean(p))
  // Half-siblings: children from other unions of the person's parents
  const halfSiblings: Person[] = []
  if (parentUnion) {
    const seen = new Set([person.id, ...parentUnion.childIds])
    for (const parentId of parentUnion.partnerIds) {
      for (const u of Object.values(unions)) {
        if (u.id === parentUnion.id || !u.partnerIds.includes(parentId)) continue
        for (const cid of u.childIds) {
          if (seen.has(cid)) continue
          seen.add(cid)
          const p = persons[cid]
          if (p) halfSiblings.push(p)
        }
      }
    }
  }

  const handlePhotoFile = async (file: File) => {
    try {
      patch({ photo: await fileToResizedDataUrl(file) })
    } catch (err) {
      console.error('Failed to process photo', err)
    }
  }

  const pickerConfig = (() => {
    if (!picker) return null
    switch (picker.kind) {
      case 'partner':
        return {
          title: 'Person als Partner verknüpfen',
          candidates: partnerCandidates(persons, unions, person.id),
          onPick: (id: string) => linkPartner(person.id, id),
        }
      case 'child': {
        const union = picker.unionId ? unions[picker.unionId] : undefined
        return {
          title: 'Person als Kind verknüpfen',
          description: 'Nur Personen ohne bestehende Eltern sind wählbar.',
          candidates: childCandidates(persons, unions, union?.partnerIds ?? [person.id]),
          onPick: (id: string) => linkChild(person.id, id, picker.unionId),
        }
      }
      case 'parent':
        return {
          title: 'Person als Elternteil verknüpfen',
          candidates: parentCandidates(persons, unions, person.id),
          onPick: (id: string) => linkParent(person.id, id),
        }
    }
  })()

  return (
    <>
      {/* Mobile: dim the canvas behind the drawer; tap to close */}
      <div
        className="fixed inset-0 z-30 bg-black/40 md:hidden"
        onClick={() => selectPerson(null)}
      />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l bg-card shadow-xl md:static md:z-auto md:w-80 md:shrink-0 md:max-w-none md:shadow-none">
        <div className="flex items-center justify-between border-b p-2 md:hidden">
          <span className="px-2 text-sm font-medium">Person bearbeiten</span>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label="Schließen"
            onClick={() => selectPerson(null)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {person.photo ? (
                <img src={person.photo} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  {initials(person)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">{displayName(person)}</h2>
              <div className="mt-1 flex flex-wrap gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => photoRef.current?.click()}
                >
                  <CameraIcon /> Foto
                </Button>
                {person.photo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => patch({ photo: undefined })}
                  >
                    Entfernen
                  </Button>
                )}
                <Button
                  variant={focusLineageId === person.id ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  title="Nur die Laufbahn dieser Person hervorheben"
                  onClick={() => toggleFocusLineage(person.id)}
                >
                  <FocusIcon /> {focusLineageId === person.id ? 'Fokus aufheben' : 'Fokus'}
                </Button>
                <Button
                  variant={ancestorFocusId === person.id ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  title="Nur die Vorfahren dieser Person zeigen"
                  onClick={() => toggleAncestorFocus(person.id)}
                >
                  <NetworkIcon /> {ancestorFocusId === person.id ? 'Ahnen aus' : 'Ahnen'}
                </Button>
              </div>
            </div>
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handlePhotoFile(file)
              e.target.value = ''
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-first">Vorname</Label>
              <Input
                id="pf-first"
                value={person.firstName}
                onChange={(e) => patch({ firstName: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-last">Nachname</Label>
              <Input
                id="pf-last"
                value={person.lastName}
                onChange={(e) => patch({ lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Geschlecht</Label>
            <Select
              items={GENDER_OPTIONS}
              value={person.gender}
              onValueChange={(value) => patch({ gender: value as Gender })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pf-birth">Geboren</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="pf-birth"
                placeholder="z. B. 12.03.1950"
                value={person.birthDate ?? ''}
                onChange={(e) => patch({ birthDate: e.target.value || undefined })}
              />
              <Input
                id="pf-birthplace"
                placeholder="Ort"
                value={person.birthPlace ?? ''}
                onChange={(e) => patch({ birthPlace: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pf-death">Gestorben</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="pf-death"
                placeholder="z. B. 4.11.1975"
                value={person.deathDate ?? ''}
                onChange={(e) => patch({ deathDate: e.target.value || undefined })}
              />
              <Input
                id="pf-deathplace"
                placeholder="Ort"
                value={person.deathPlace ?? ''}
                onChange={(e) => patch({ deathPlace: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Land</Label>
            <Select
              items={COUNTRY_SELECT_ITEMS}
              value={person.country ?? 'none'}
              onValueChange={(value) =>
                patch({ country: value && value !== 'none' ? value : undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_SELECT_ITEMS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <section className="grid gap-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              Bei Geburt (falls abweichend)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pf-birthfirst">Vorname</Label>
                <Input
                  id="pf-birthfirst"
                  value={person.birthFirstName ?? ''}
                  onChange={(e) => patch({ birthFirstName: e.target.value || undefined })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pf-birthname">Nachname</Label>
                <Input
                  id="pf-birthname"
                  value={person.birthName ?? ''}
                  onChange={(e) => patch({ birthName: e.target.value || undefined })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Geschlecht bei Geburt</Label>
              <Select
                items={BIRTH_GENDER_OPTIONS}
                value={person.birthGender ?? 'none'}
                onValueChange={(value) =>
                  patch({ birthGender: value === 'none' ? undefined : (value as Gender) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BIRTH_GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <div className="grid gap-1.5">
            <Label htmlFor="pf-notes">Notizen</Label>
            <Textarea
              id="pf-notes"
              rows={3}
              value={person.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
            />
          </div>

          <Separator />

          <section className="grid gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UsersIcon className="size-3.5" /> Eltern
            </h3>
            {parents.length > 0 && parentUnion && (
              <div className="grid gap-1">
                {parents.map((p) => (
                  <RelationRow
                    key={p.id}
                    person={p}
                    unlinkLabel={`${displayName(p)} als Elternteil lösen`}
                    onUnlink={() => unlinkPartner(parentUnion.id, p.id)}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-muted-foreground"
                  onClick={() => unlinkChild(parentUnion.id, person.id)}
                >
                  <Link2OffIcon /> Von Eltern lösen
                </Button>
              </div>
            )}
            {parents.length < 2 && (
              <div className="flex flex-wrap gap-2">
                {parents.length === 0 ? (
                  <Button variant="outline" size="sm" onClick={() => addParents(person.id)}>
                    <UserPlusIcon /> Eltern hinzufügen
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => addParent(person.id)}>
                    <UserPlusIcon /> Elternteil hinzufügen
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setPicker({ kind: 'parent' })}>
                  <Link2Icon /> Verknüpfen
                </Button>
              </div>
            )}
          </section>

          {(siblings.length > 0 || halfSiblings.length > 0) && (
            <section className="grid gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UsersIcon className="size-3.5" /> Geschwister
              </h3>
              <div className="grid gap-1">
                {siblings.map((s) => (
                  <PersonLink key={s.id} person={s} />
                ))}
                {halfSiblings.map((s) => (
                  <div key={s.id} className="flex items-baseline justify-between gap-2">
                    <PersonLink person={s} />
                    <span className="shrink-0 text-xs text-muted-foreground italic">halb</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <HeartIcon className="size-3.5" /> Partnerschaften &amp; Kinder
            </h3>
            {ownUnions.map((union) => {
              const partners = union.partnerIds
                .filter((id) => id !== person.id)
                .map((id) => persons[id])
                .filter((p): p is Person => Boolean(p))
              const children = union.childIds
                .map((id) => persons[id])
                .filter((p): p is Person => Boolean(p))
              return (
                <div key={union.id} className="grid gap-1.5 rounded-lg border p-2.5">
                  {partners.length > 0 ? (
                    partners.map((p) => (
                      <RelationRow
                        key={p.id}
                        person={p}
                        unlinkLabel={`${displayName(p)} als Partner lösen`}
                        onUnlink={() => unlinkPartner(union.id, p.id)}
                      />
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Ohne Partner:in</span>
                  )}
                  {children.length > 0 && (
                    <div className="grid gap-1 border-l-2 pl-2.5">
                      {children.map((c) => (
                        <RelationRow
                          key={c.id}
                          person={c}
                          unlinkLabel={`${displayName(c)} als Kind lösen`}
                          onUnlink={() => unlinkChild(union.id, c.id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addChild(person.id, union.id)}
                    >
                      <BabyIcon /> Kind hinzufügen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPicker({ kind: 'child', unionId: union.id })}
                    >
                      <Link2Icon /> Verknüpfen
                    </Button>
                  </div>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => addPartner(person.id)}>
                <UserPlusIcon /> Partner hinzufügen
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPicker({ kind: 'partner' })}>
                <Link2Icon /> Verknüpfen
              </Button>
            </div>
            {ownUnions.length === 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => addChild(person.id)}>
                  <BabyIcon /> Kind hinzufügen
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPicker({ kind: 'child' })}>
                  <Link2Icon /> Verknüpfen
                </Button>
              </div>
            )}
          </section>

          <Separator />

          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon /> Person löschen
          </Button>
        </div>
      </ScrollArea>

      {pickerConfig && (
        <PersonPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setPicker(null)
          }}
          title={pickerConfig.title}
          description={'description' in pickerConfig ? pickerConfig.description : undefined}
          candidates={pickerConfig.candidates}
          onPick={pickerConfig.onPick}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{displayName(person)} löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Person wird aus dem Stammbaum entfernt. Verbindungen zu Partnern und Kindern
              werden gelöst.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deletePerson(person.id)
                setDeleteOpen(false)
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </aside>
    </>
  )
}
