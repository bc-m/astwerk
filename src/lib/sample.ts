import type { Person, TreeFile, Union } from '@/types'

/** Small sample family tree spanning three generations. */
export function createSampleTree(): TreeFile {
  const id = () => crypto.randomUUID()

  const wilhelm: Person = {
    id: id(),
    firstName: 'Wilhelm',
    lastName: 'Schmidt',
    gender: 'm',
    birthDate: '1928',
    deathDate: '2001',
    birthPlace: 'Hamburg',
  }
  const margarete: Person = {
    id: id(),
    firstName: 'Margarete',
    lastName: 'Schmidt',
    birthName: 'Weber',
    gender: 'f',
    birthDate: '1932',
    deathDate: '2015',
  }
  const hans: Person = {
    id: id(),
    firstName: 'Hans',
    lastName: 'Schmidt',
    gender: 'm',
    birthDate: '12.05.1955',
    birthPlace: 'Hamburg',
  }
  const ursula: Person = {
    id: id(),
    firstName: 'Ursula',
    lastName: 'Klein',
    birthName: 'Schmidt',
    gender: 'f',
    birthDate: '1958',
  }
  const renate: Person = {
    id: id(),
    firstName: 'Renate',
    lastName: 'Schmidt',
    birthName: 'Fischer',
    gender: 'f',
    birthDate: '1957',
  }
  const julia: Person = {
    id: id(),
    firstName: 'Julia',
    lastName: 'Schmidt',
    gender: 'f',
    birthDate: '03.09.1982',
  }
  const thomas: Person = {
    id: id(),
    firstName: 'Thomas',
    lastName: 'Schmidt',
    gender: 'm',
    birthDate: '21.01.1985',
  }

  const grosseltern: Union = {
    id: id(),
    partnerIds: [wilhelm.id, margarete.id],
    childIds: [hans.id, ursula.id],
  }
  const eltern: Union = {
    id: id(),
    partnerIds: [hans.id, renate.id],
    childIds: [julia.id, thomas.id],
  }

  return {
    format: 'stammbaum',
    version: 1,
    name: 'Familie Schmidt (Beispiel)',
    persons: [wilhelm, margarete, hans, ursula, renate, julia, thomas],
    unions: [grosseltern, eltern],
  }
}
