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
  deathPlace?: string
  /** Known to have died, even when no date/place is recorded. */
  deceased?: boolean
  /** ISO 3166-1 alpha-2 country code of residence, e.g. "DE". */
  country?: string
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

/** Selectable gender values, in display order. Labels come from i18n (`gender.*`). */
export const GENDER_VALUES: Gender[] = ['f', 'm', 'd', 'u']

export interface CountryOption {
  code: string
  flag: string
}

/**
 * Countries offered for a person's residence, with their flag emoji.
 * Human-readable names are resolved per language via `countryLabel()` in i18n.
 */
export const COUNTRY_OPTIONS: CountryOption[] = [
  {code: 'DE', flag: '🇩🇪'},
  {code: 'AT', flag: '🇦🇹'},
  {code: 'CH', flag: '🇨🇭'},
  {code: 'DK', flag: '🇩🇰'},
  {code: 'SE', flag: '🇸🇪'},
  {code: 'NO', flag: '🇳🇴'},
  {code: 'NL', flag: '🇳🇱'},
  {code: 'PT', flag: '🇵🇹'},
  {code: 'ES', flag: '🇪🇸'},
  {code: 'FR', flag: '🇫🇷'},
  {code: 'IT', flag: '🇮🇹'},
  {code: 'GB', flag: '🇬🇧'},
  {code: 'US', flag: '🇺🇸'},
]

export const COUNTRY_FLAG: Record<string, string> = Object.fromEntries(
  COUNTRY_OPTIONS.map((c) => [c.code, c.flag]),
)
