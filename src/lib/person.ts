import type { Person } from '@/types'

export function displayName(person: Person): string {
  const name = `${person.firstName} ${person.lastName}`.trim()
  return name || 'Unbenannt'
}

export function lifespanLabel(person: Person): string {
  const parts: string[] = []
  if (person.birthDate) parts.push(`* ${person.birthDate}`)
  if (person.deathDate) parts.push(`† ${person.deathDate}`)
  return parts.join('  ')
}

/** "née first-name last-name", if a birth name is recorded. */
export function birthNameLabel(person: Person): string | null {
  const parts = [person.birthFirstName, person.birthName].filter(Boolean)
  if (parts.length === 0) return null
  return `geb. ${parts.join(' ')}`
}

export function initials(person: Person): string {
  const chars = [person.firstName[0], person.lastName[0]].filter(Boolean)
  return chars.join('').toUpperCase() || '?'
}

/** Extracts day/month/year from a free-text date like "12.03.1950" or "1950". */
function parseDateParts(s?: string): { year: number; month?: number; day?: number } | null {
  if (!s) return null
  const dmy = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{3,4})/)
  if (dmy) return { day: +dmy[1], month: +dmy[2], year: +dmy[3] }
  const my = s.match(/(\d{1,2})\.\s*(\d{3,4})/)
  if (my) return { month: +my[1], year: +my[2] }
  const y = s.match(/\d{3,4}/)
  if (y) return { year: +y[0] }
  return null
}

/**
 * Age in whole years — at death if a death date is set, otherwise today.
 * Returns null when the birth date can't be read or the result is implausible
 * (e.g. born long ago with no recorded death, so "age today" would be absurd).
 */
export function ageOf(person: Person, now: Date = new Date()): number | null {
  const b = parseDateParts(person.birthDate)
  if (!b) return null
  const d = parseDateParts(person.deathDate)
  const end = d ?? { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
  let age = end.year - b.year
  if (
    b.month &&
    end.month &&
    (end.month < b.month || (end.month === b.month && (b.day ?? 1) > (end.day ?? 1)))
  ) {
    age--
  }
  if (age < 0 || age > 130) return null
  if (!d && age > 120) return null
  return age
}
