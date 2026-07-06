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

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  {value: 'f', label: 'weiblich'},
  {value: 'm', label: 'männlich'},
  {value: 'd', label: 'divers'},
  {value: 'u', label: 'unbekannt'},
]

export interface CountryOption {
  code: string
  label: string
  flag: string
}

/** Countries offered for a person's residence, with their flag emoji. */
export const COUNTRY_OPTIONS: CountryOption[] = [
  {code: 'DE', label: 'Deutschland', flag: '🇩🇪'},
  {code: 'AT', label: 'Österreich', flag: '🇦🇹'},
  {code: 'CH', label: 'Schweiz', flag: '🇨🇭'},
  {code: 'DK', label: 'Dänemark', flag: '🇩🇰'},
  {code: 'SE', label: 'Schweden', flag: '🇸🇪'},
  {code: 'NO', label: 'Norwegen', flag: '🇳🇴'},
  {code: 'NL', label: 'Niederlande', flag: '🇳🇱'},
  {code: 'PT', label: 'Portugal', flag: '🇵🇹'},
  {code: 'ES', label: 'Spanien', flag: '🇪🇸'},
  {code: 'FR', label: 'Frankreich', flag: '🇫🇷'},
  {code: 'IT', label: 'Italien', flag: '🇮🇹'},
  {code: 'GB', label: 'Vereinigtes Königreich', flag: '🇬🇧'},
  {code: 'US', label: 'USA', flag: '🇺🇸'},
]

export const COUNTRY_BY_CODE: Record<string, CountryOption> = Object.fromEntries(
  COUNTRY_OPTIONS.map((c) => [c.code, c]),
)
