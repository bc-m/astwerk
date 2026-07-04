export type Gender = 'm' | 'f' | 'd' | 'u'

export interface Person {
  id: string // UUID
  firstName: string
  lastName: string
  gender: Gender
  /** First name at birth, if different */
  birthFirstName?: string
  /** Last name at birth (birth name), if different */
  birthName?: string
  /** Sex at birth, if different */
  birthGender?: Gender
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  notes?: string
  /** Photo as data URL (downscaled on upload) */
  photo?: string
}

/**
 * A connection (partnership/marriage) between up to two persons,
 * with shared children. Single parents are modeled as a union
 * with one partner.
 */
export interface Union {
  id: string // UUID
  partnerIds: string[]
  childIds: string[]
}

export interface TreeFile {
  format: 'stammbaum'
  version: 1
  name: string
  persons: Person[]
  unions: Union[]
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  {value: 'f', label: 'weiblich'},
  {value: 'm', label: 'männlich'},
  {value: 'd', label: 'divers'},
  {value: 'u', label: 'unbekannt'},
]
