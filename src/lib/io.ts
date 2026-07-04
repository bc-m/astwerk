import { exportGedcom } from '@/lib/gedcom'
import type { Gender, Person, TreeFile, Union } from '@/types'

const GENDERS: Gender[] = ['m', 'f', 'd', 'u']

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)

const gender = (v: unknown): Gender | undefined =>
  GENDERS.includes(v as Gender) ? (v as Gender) : undefined

export function parseTreeFile(text: string): TreeFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Unerwartetes Dateiformat.')
  }
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.persons) || !Array.isArray(obj.unions)) {
    throw new Error('Der Datei fehlen die Listen "persons" und "unions".')
  }
  if (obj.version !== undefined && obj.version !== 1) {
    throw new Error(`Nicht unterstützte Dateiversion: ${String(obj.version)}`)
  }

  const persons: Person[] = []
  for (const entry of obj.persons) {
    if (typeof entry !== 'object' || entry === null) continue
    const p = entry as Record<string, unknown>
    const id = str(p.id)
    if (!id) continue
    persons.push({
      id,
      firstName: str(p.firstName) ?? '',
      lastName: str(p.lastName) ?? '',
      gender: gender(p.gender) ?? 'u',
      birthFirstName: str(p.birthFirstName),
      birthName: str(p.birthName),
      birthGender: gender(p.birthGender),
      birthDate: str(p.birthDate),
      birthPlace: str(p.birthPlace),
      deathDate: str(p.deathDate),
      notes: str(p.notes),
      photo: str(p.photo),
    })
  }

  const knownIds = new Set(persons.map((p) => p.id))
  const unions: Union[] = []
  for (const entry of obj.unions) {
    if (typeof entry !== 'object' || entry === null) continue
    const u = entry as Record<string, unknown>
    const id = str(u.id)
    if (!id) continue
    const partnerIds = (Array.isArray(u.partnerIds) ? u.partnerIds : [])
      .filter((v): v is string => typeof v === 'string' && knownIds.has(v))
    const childIds = (Array.isArray(u.childIds) ? u.childIds : [])
      .filter((v): v is string => typeof v === 'string' && knownIds.has(v))
    if (partnerIds.length === 0 && childIds.length === 0) continue
    unions.push({ id, partnerIds, childIds })
  }

  return {
    format: 'stammbaum',
    version: 1,
    name: str(obj.name) ?? 'Importierter Stammbaum',
    persons,
    unions,
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadTreeFile(file: TreeFile) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  triggerDownload(`${slugify(file.name) || 'stammbaum'}_${timestampSuffix()}.json`, blob)
}

export function downloadGedcomFile(file: TreeFile) {
  const blob = new Blob([exportGedcom(file)], { type: 'text/plain;charset=utf-8' })
  triggerDownload(`${slugify(file.name) || 'stammbaum'}_${timestampSuffix()}.ged`, blob)
}

/** Timestamp for filenames in YYYYMMDD_hhmmss format. */
export function timestampSuffix(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  )
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
