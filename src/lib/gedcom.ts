import type { Gender, Person, TreeFile, Union } from '@/types'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const SEX_EXPORT: Record<Gender, string> = { m: 'M', f: 'F', d: 'X', u: 'U' }

function sexImport(value: string): Gender {
  switch (value.trim().toUpperCase()) {
    case 'M':
      return 'm'
    case 'F':
      return 'f'
    case 'X':
      return 'd'
    default:
      return 'u'
  }
}

/** "12.05.1955" -> "12 MAY 1955", "1955" -> "1955", free text -> "(free text)" (GEDCOM date phrase). */
function toGedcomDate(value: string): string {
  const dmy = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{3,4})$/)
  if (dmy && Number(dmy[2]) >= 1 && Number(dmy[2]) <= 12) {
    return `${Number(dmy[1])} ${MONTHS[Number(dmy[2]) - 1]} ${dmy[3]}`
  }
  const my = value.match(/^(\d{1,2})\.(\d{3,4})$/)
  if (my && Number(my[1]) >= 1 && Number(my[1]) <= 12) {
    return `${MONTHS[Number(my[1]) - 1]} ${my[2]}`
  }
  if (/^\d{3,4}$/.test(value)) return value
  return `(${value})`
}

function fromGedcomDate(value: string): string {
  const phrase = value.match(/^\((.*)\)$/)
  if (phrase) return phrase[1]
  const dmy = value.match(/^(\d{1,2}) ([A-Z]{3}) (\d{3,4})$/i)
  if (dmy) {
    const month = MONTHS.indexOf(dmy[2].toUpperCase())
    if (month >= 0) {
      return `${dmy[1].padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${dmy[3]}`
    }
  }
  const my = value.match(/^([A-Z]{3}) (\d{3,4})$/i)
  if (my) {
    const month = MONTHS.indexOf(my[1].toUpperCase())
    if (month >= 0) return `${String(month + 1).padStart(2, '0')}.${my[2]}`
  }
  return value
}

function nameLine(given: string, surname: string): string {
  return `${given} /${surname}/`.trim()
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportGedcom(tree: TreeFile): string {
  const lines: string[] = [
    '0 HEAD',
    '1 SOUR StammbaumEditor',
    '2 NAME Stammbaum-Editor',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
  ]
  const indiRef = new Map(tree.persons.map((p, i) => [p.id, `@I${i + 1}@`]))
  const famRef = new Map(tree.unions.map((u, i) => [u.id, `@F${i + 1}@`]))
  const byId = new Map(tree.persons.map((p) => [p.id, p]))
  const esc = (s: string) => s.replace(/@/g, '@@')

  const pushNote = (text: string) => {
    text.split('\n').forEach((line, i) => {
      const chunks = esc(line).match(/.{1,200}/g) ?? ['']
      chunks.forEach((chunk, j) => {
        if (i === 0 && j === 0) lines.push(`1 NOTE ${chunk}`.trimEnd())
        else if (j === 0) lines.push(`2 CONT ${chunk}`.trimEnd())
        else lines.push(`2 CONC ${chunk}`.trimEnd())
      })
    })
  }

  for (const p of tree.persons) {
    lines.push(`0 ${indiRef.get(p.id)} INDI`)
    if (p.firstName || p.lastName) {
      lines.push(`1 NAME ${nameLine(p.firstName, p.lastName)}`)
      if (p.firstName) lines.push(`2 GIVN ${p.firstName}`)
      if (p.lastName) lines.push(`2 SURN ${p.lastName}`)
    }
    if (p.birthFirstName || p.birthName) {
      lines.push(`1 NAME ${nameLine(p.birthFirstName || p.firstName, p.birthName || p.lastName)}`)
      lines.push('2 TYPE birth')
    }
    lines.push(`1 SEX ${SEX_EXPORT[p.gender]}`)
    // Custom tag, since GEDCOM has no concept of sex at birth
    if (p.birthGender) lines.push(`1 _BSEX ${SEX_EXPORT[p.birthGender]}`)
    // Custom tag for the country of residence (its flag is shown in the app)
    if (p.country) lines.push(`1 _CTRY ${p.country}`)
    if (p.birthDate || p.birthPlace) {
      lines.push('1 BIRT')
      if (p.birthDate) lines.push(`2 DATE ${toGedcomDate(p.birthDate)}`)
      if (p.birthPlace) lines.push(`2 PLAC ${p.birthPlace}`)
    }
    if (p.deathDate || p.deathPlace) {
      lines.push('1 DEAT')
      if (p.deathDate) lines.push(`2 DATE ${toGedcomDate(p.deathDate)}`)
      if (p.deathPlace) lines.push(`2 PLAC ${p.deathPlace}`)
    } else if (p.deceased) {
      // Died, but no date/place known — GEDCOM's "event occurred" marker.
      lines.push('1 DEAT Y')
    }
    if (p.notes) pushNote(p.notes)
    for (const u of tree.unions) {
      if (u.partnerIds.includes(p.id)) lines.push(`1 FAMS ${famRef.get(u.id)}`)
      if (u.childIds.includes(p.id)) lines.push(`1 FAMC ${famRef.get(u.id)}`)
    }
  }

  for (const u of tree.unions) {
    lines.push(`0 ${famRef.get(u.id)} FAM`)
    const partners = u.partnerIds
      .map((id) => byId.get(id))
      .filter((p): p is Person => Boolean(p))
    let husb = partners.find((p) => p.gender === 'm')
    let wife = partners.find((p) => p.gender === 'f' && p !== husb)
    for (const p of partners) {
      if (p === husb || p === wife) continue
      if (!husb) husb = p
      else if (!wife) wife = p
    }
    if (husb) lines.push(`1 HUSB ${indiRef.get(husb.id)}`)
    if (wife) lines.push(`1 WIFE ${indiRef.get(wife.id)}`)
    for (const childId of u.childIds) {
      const ref = indiRef.get(childId)
      if (ref) lines.push(`1 CHIL ${ref}`)
    }
  }

  lines.push('0 TRLR')
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

interface GLine {
  level: number
  xref?: string
  tag: string
  value: string
  children: GLine[]
}

function parseGedcomLines(text: string): GLine[] {
  const roots: GLine[] = []
  const stack: GLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '')
    if (!line.trim()) continue
    const m = line.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/)
    if (!m) continue
    const node: GLine = {
      level: Number(m[1]),
      xref: m[2],
      tag: m[3].toUpperCase(),
      value: m[4] ?? '',
      children: [],
    }
    if (node.level === 0) {
      roots.push(node)
      stack.length = 0
      stack[0] = node
    } else {
      const parent = stack[node.level - 1]
      if (!parent) continue
      parent.children.push(node)
      stack.length = node.level
      stack[node.level] = node
    }
  }
  return roots
}

const findChild = (node: GLine, tag: string) => node.children.find((c) => c.tag === tag)

/** Collect value including CONT/CONC continuation lines. */
function collectText(node: GLine): string {
  let out = node.value
  for (const c of node.children) {
    if (c.tag === 'CONT') out += '\n' + c.value
    else if (c.tag === 'CONC') out += c.value
  }
  return out.replace(/@@/g, '@')
}

function parseNameValue(value: string): { given: string; surname: string } {
  const m = value.match(/^([^/]*?)\s*\/([^/]*)\/\s*(.*)$/)
  if (m) return { given: m[1].trim(), surname: m[2].trim() }
  return { given: value.trim(), surname: '' }
}

export function parseGedcom(text: string, fallbackName: string): TreeFile {
  const roots = parseGedcomLines(text)
  const indiRecords = roots.filter((r) => r.tag === 'INDI')
  if (indiRecords.length === 0) {
    throw new Error('Die Datei enthält keine GEDCOM-Personendaten (INDI).')
  }

  // Standalone NOTE records for references like "1 NOTE @N1@"
  const noteRecords = new Map<string, string>()
  for (const r of roots) {
    if (r.tag === 'NOTE' && r.xref) noteRecords.set(r.xref, collectText(r))
  }

  const idMap = new Map<string, string>()
  const persons: Person[] = []
  for (const r of indiRecords) {
    const id = crypto.randomUUID()
    if (r.xref) idMap.set(r.xref, id)

    const names = r.children.filter((c) => c.tag === 'NAME')
    let firstName = ''
    let lastName = ''
    let birthFirstName: string | undefined
    let birthName: string | undefined
    if (names.length > 0) {
      const primary = names[0]
      const parsed = parseNameValue(primary.value)
      firstName = findChild(primary, 'GIVN')?.value.trim() || parsed.given
      lastName = findChild(primary, 'SURN')?.value.trim() || parsed.surname
      for (const extra of names.slice(1)) {
        const type = findChild(extra, 'TYPE')?.value.trim().toLowerCase()
        if (type === 'birth' || type === 'maiden') {
          const parsedExtra = parseNameValue(extra.value)
          const given = findChild(extra, 'GIVN')?.value.trim() || parsedExtra.given
          const surname = findChild(extra, 'SURN')?.value.trim() || parsedExtra.surname
          if (given && given !== firstName) birthFirstName = given
          if (surname && surname !== lastName) birthName = surname
        }
      }
    }

    const birt = findChild(r, 'BIRT')
    const deat = findChild(r, 'DEAT')
    const bsex = findChild(r, '_BSEX')?.value
    const noteParts: string[] = []
    for (const c of r.children) {
      if (c.tag !== 'NOTE') continue
      const ref = c.value.trim().match(/^@[^@]+@$/)
      const text = ref ? noteRecords.get(c.value.trim()) : collectText(c)
      if (text) noteParts.push(text)
    }

    const birthDateRaw = birt && findChild(birt, 'DATE')?.value.trim()
    const deathDateRaw = deat && findChild(deat, 'DATE')?.value.trim()
    persons.push({
      id,
      firstName,
      lastName,
      gender: sexImport(findChild(r, 'SEX')?.value ?? ''),
      birthFirstName,
      birthName,
      birthGender: bsex ? sexImport(bsex) : undefined,
      birthDate: birthDateRaw ? fromGedcomDate(birthDateRaw) : undefined,
      birthPlace: birt ? findChild(birt, 'PLAC')?.value.trim() || undefined : undefined,
      deathDate: deathDateRaw ? fromGedcomDate(deathDateRaw) : undefined,
      deathPlace: deat ? findChild(deat, 'PLAC')?.value.trim() || undefined : undefined,
      // A DEAT with no date/place still means the person died.
      deceased: deat && !deathDateRaw && !findChild(deat, 'PLAC') ? true : undefined,
      country: findChild(r, '_CTRY')?.value.trim() || undefined,
      notes: noteParts.length > 0 ? noteParts.join('\n\n') : undefined,
    })
  }

  const unions: Union[] = []
  for (const r of roots.filter((root) => root.tag === 'FAM')) {
    const partnerIds = [
      ...new Set(
        r.children
          .filter((c) => c.tag === 'HUSB' || c.tag === 'WIFE')
          .map((c) => idMap.get(c.value.trim()))
          .filter((v): v is string => Boolean(v)),
      ),
    ]
    const childIds = [
      ...new Set(
        r.children
          .filter((c) => c.tag === 'CHIL')
          .map((c) => idMap.get(c.value.trim()))
          .filter((v): v is string => Boolean(v)),
      ),
    ]
    if (partnerIds.length === 0) continue
    unions.push({ id: crypto.randomUUID(), partnerIds, childIds })
  }

  return {
    format: 'stammbaum',
    version: 1,
    name: fallbackName || 'Importierter Stammbaum',
    persons,
    unions,
  }
}
