import type { Person, Union } from '@/types'

export function parentUnionOf(
  unions: Record<string, Union>,
  personId: string,
): Union | undefined {
  return Object.values(unions).find((u) => u.childIds.includes(personId))
}

/** All ancestor IDs (parents, grandparents, …) across unions. */
export function ancestorIdsOf(unions: Record<string, Union>, personId: string): Set<string> {
  const result = new Set<string>()
  const stack = [personId]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const u of Object.values(unions)) {
      if (!u.childIds.includes(id)) continue
      for (const parentId of u.partnerIds) {
        if (!result.has(parentId)) {
          result.add(parentId)
          stack.push(parentId)
        }
      }
    }
  }
  return result
}

/** All descendant IDs (children, grandchildren, …) across unions. */
export function descendantIdsOf(unions: Record<string, Union>, personId: string): Set<string> {
  const result = new Set<string>()
  const stack = [personId]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const u of Object.values(unions)) {
      if (!u.partnerIds.includes(id)) continue
      for (const childId of u.childIds) {
        if (!result.has(childId)) {
          result.add(childId)
          stack.push(childId)
        }
      }
    }
  }
  return result
}

/**
 * The "lineage" of a person: themselves, all ancestors, all descendants
 * and their direct partners.
 */
export function lineageIdsOf(unions: Record<string, Union>, personId: string): Set<string> {
  const result = ancestorIdsOf(unions, personId)
  for (const id of descendantIdsOf(unions, personId)) result.add(id)
  result.add(personId)
  for (const u of Object.values(unions)) {
    if (u.partnerIds.includes(personId)) {
      for (const id of u.partnerIds) result.add(id)
    }
  }
  return result
}

/** Persons that can be linked as partner: everyone except self and existing partners. */
export function partnerCandidates(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
  personId: string,
): Person[] {
  const excluded = new Set([personId])
  for (const u of Object.values(unions)) {
    if (u.partnerIds.includes(personId)) {
      for (const id of u.partnerIds) excluded.add(id)
    }
  }
  return Object.values(persons).filter((p) => !excluded.has(p.id))
}

/**
 * Persons that can be linked as child of the given parents:
 * no one with existing parents, not the parents themselves, and no
 * ancestors of the parents (prevents cycles).
 */
export function childCandidates(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
  parentIds: string[],
): Person[] {
  const excluded = new Set(parentIds)
  for (const pid of parentIds) {
    for (const ancestorId of ancestorIdsOf(unions, pid)) excluded.add(ancestorId)
  }
  return Object.values(persons).filter(
    (p) => !excluded.has(p.id) && !parentUnionOf(unions, p.id),
  )
}

/**
 * Persons that can be linked as parent: not the person themselves,
 * no existing parents, and no descendants (prevents cycles).
 */
export function parentCandidates(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
  childId: string,
): Person[] {
  const excluded = new Set([childId])
  for (const id of parentUnionOf(unions, childId)?.partnerIds ?? []) excluded.add(id)
  for (const descendantId of descendantIdsOf(unions, childId)) excluded.add(descendantId)
  return Object.values(persons).filter((p) => !excluded.has(p.id))
}
