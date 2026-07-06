import type { Person } from '@/types'

export function displayName(person: Person): string {
  const name = `${person.firstName} ${person.lastName}`.trim()
  return name || 'Unbenannt'
}

export function lifespanLabel(person: Person): string {
  const parts: string[] = []
  if (person.birthDate) parts.push(`* ${person.birthDate}`)
  if (person.deathDate) parts.push(`† ${person.deathDate}`)
  else if (isDeceased(person)) parts.push('†')
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

/** Known to have died — via the flag, a death date or a death place. */
export function isDeceased(person: Person): boolean {
  return person.deceased === true || Boolean(person.deathDate) || Boolean(person.deathPlace)
}

/**
 * Age in whole years — at death if a death date is set, otherwise today.
 * Returns null when the birth date can't be read, the person is known to have
 * died but without a usable death date, or the result is implausible.
 */
export function ageOf(person: Person, now: Date = new Date()): number | null {
  const b = parseDateParts(person.birthDate)
  if (!b) return null
  const d = parseDateParts(person.deathDate)
  if (!d && isDeceased(person)) return null
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

/**
 * Age as a display label. Children under one year are shown in months
 * (e.g. "7 Mon."), everyone else in years (e.g. "5 J.").
 */
export function ageLabel(person: Person, now: Date = new Date()): string | null {
  const age = ageOf(person, now)
  if (age === null) return null
  if (age >= 1) return `${age} J.`

  const b = parseDateParts(person.birthDate)
  if (!b) return null
  const d = parseDateParts(person.deathDate)
  const end = d ?? { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
  let months = (end.year - b.year) * 12 + ((end.month ?? 1) - (b.month ?? 1))
  if ((b.day ?? 1) > (end.day ?? 1)) months--
  if (months < 0) months = 0
  return `${months} Mon.`
}
