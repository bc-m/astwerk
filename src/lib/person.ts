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
