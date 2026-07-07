import { create } from 'zustand'

export type Lang = 'en' | 'de'

const STORAGE_KEY = 'astwerk-lang'

/** Saved choice, else the browser's preference, else English. */
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'de') return saved
  } catch {
    // localStorage unavailable – fall through to navigator
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en'
}

type Dict = Record<string, string>

const en: Dict = {
  // Generic actions
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.close': 'Close',
  'action.link': 'Link',
  'action.remove': 'Remove',
  'action.search': 'Search…',

  // Person counts
  'person.count.one': '{count} person',
  'person.count.other': '{count} people',
  'person.unnamed': 'Unnamed',

  // Genders
  'gender.f': 'female',
  'gender.m': 'male',
  'gender.d': 'diverse',
  'gender.u': 'unknown',
  'gender.none': 'not specified',

  // Toolbar
  'toolbar.github': 'Astwerk on GitHub',
  'toolbar.treeName': 'Family tree name',
  'toolbar.view.tree': 'Tree',
  'toolbar.view.list': 'List',
  'toolbar.focus.clear': 'Clear focus',
  'toolbar.focus.label': 'Focus: {name}',
  'toolbar.theme.light': 'Light',
  'toolbar.theme.dark': 'Dark',
  'toolbar.theme.system': 'System',
  'toolbar.theme.aria': 'Colour scheme: {label}',
  'toolbar.theme.title': 'Colour scheme: {label} (click to switch)',
  'toolbar.undo': 'Undo',
  'toolbar.redo': 'Redo',
  'toolbar.person': 'Person',
  'toolbar.import': 'Import',
  'toolbar.export': 'Export',
  'toolbar.export.json': 'As JSON (.json)',
  'toolbar.export.gedcom': 'As GEDCOM (.ged)',
  'toolbar.export.png': 'As image (.png)',
  'toolbar.export.pdf': 'As PDF (.pdf)',
  'toolbar.export.jsonShort': 'Export JSON',
  'toolbar.export.gedcomShort': 'Export GEDCOM',
  'toolbar.export.pngShort': 'Export image (.png)',
  'toolbar.export.pdfShort': 'Export PDF',
  'toolbar.new': 'New',
  'toolbar.moreActions': 'More actions',
  'toolbar.lang': 'Language',
  'reset.title': 'Start a new family tree?',
  'reset.body': 'The current tree with {count} people will be discarded. Unexported data will be lost.',
  'reset.confirm': 'Discard and start over',
  'import.failed': 'Import failed.',

  // Detail panel
  'detail.empty': 'Select a person in the tree to edit their details.',
  'detail.editPerson': 'Edit person',
  'detail.photo': 'Photo',
  'detail.lineage.title': 'Highlight only this person’s lineage',
  'detail.focus': 'Focus',
  'detail.focus.clear': 'Clear focus',
  'detail.ancestors.title': 'Show only this person’s ancestors',
  'detail.ancestors': 'Ancestors',
  'detail.ancestors.off': 'Ancestors off',
  'field.firstName': 'First name',
  'field.lastName': 'Last name',
  'field.gender': 'Gender',
  'field.born': 'Born',
  'field.died': 'Died',
  'field.place': 'Place',
  'field.deceased': 'Deceased',
  'field.deceased.derived': '(from date/place)',
  'field.country': 'Country',
  'field.notes': 'Notes',
  'field.birthDate.placeholder': 'e.g. 12/03/1950',
  'field.deathDate.placeholder': 'e.g. 04/11/1975',
  'birth.section': 'At birth (if different)',
  'birth.gender': 'Sex at birth',
  'section.parents': 'Parents',
  'section.siblings': 'Siblings',
  'section.unions': 'Partnerships & children',
  'siblings.half': 'half',
  'unions.noPartner': 'No partner',
  'relation.unlinkParent': 'Unlink {name} as parent',
  'relation.unlinkPartner': 'Unlink {name} as partner',
  'relation.unlinkChild': 'Unlink {name} as child',
  'parents.unlink': 'Unlink from parents',
  'parents.add': 'Add parents',
  'parent.add': 'Add parent',
  'child.add': 'Add child',
  'partner.add': 'Add partner',
  'person.delete': 'Delete person',
  'delete.title': 'Delete {name}?',
  'delete.body':
    'The person is removed from the tree. Links to partners and children are dissolved.',
  'picker.partner.title': 'Link a person as partner',
  'picker.child.title': 'Link a person as child',
  'picker.child.description': 'Only people without existing parents can be selected.',
  'picker.parent.title': 'Link a person as parent',
  'picker.empty': 'No matching person found.',

  // List view
  'list.searchPlaceholder': 'Search people…',
  'list.col.name': 'Name',
  'list.col.born': 'Born',
  'list.col.died': 'Died',
  'list.col.age': 'Age',
  'list.col.birthplace': 'Birthplace',
  'list.showInTree': 'Show in tree',
  'list.showInTree.aria': 'Show {name} in tree',
  'list.deceased': 'deceased',
  'list.empty.none': 'No people yet.',
  'list.empty.noMatch': 'No people found.',

  // Person search
  'search.placeholder': 'Search person…',
  'search.aria': 'Search person',
  'search.noMatches': 'No matches.',

  // Canvas
  'empty.text': 'No people yet. Add the first person or take a look at the example.',
  'empty.addFirst': 'Add the first person',
  'empty.loadSample': 'Load example',
  'edgeMenu.goTo': 'Go to',
  'role.father': 'Father',
  'role.mother': 'Mother',
  'role.child': 'Child',

  // Person labels
  'label.bornPrefix': 'née',
  'label.years': '{n} y',
  'label.months': '{n} mo',

  // IO
  'io.defaultTreeName': 'My family tree',
  'io.importedTreeName': 'Imported family tree',
  'io.filenameFallback': 'family-tree',
  'io.error.invalidJson': 'The file does not contain valid JSON.',
  'io.error.unexpectedFormat': 'Unexpected file format.',
  'io.error.missingLists': 'The file is missing the "persons" and "unions" lists.',
  'io.error.unsupportedVersion': 'Unsupported file version: {version}',
  'io.error.noGedcom': 'The file contains no GEDCOM person records (INDI).',

  // Sample tree
  'sample.treeName': 'Schmidt Family (Example)',
}

const de: Dict = {
  'action.cancel': 'Abbrechen',
  'action.delete': 'Löschen',
  'action.close': 'Schließen',
  'action.link': 'Verknüpfen',
  'action.remove': 'Entfernen',
  'action.search': 'Suchen…',

  'person.count.one': '{count} Person',
  'person.count.other': '{count} Personen',
  'person.unnamed': 'Unbenannt',

  'gender.f': 'weiblich',
  'gender.m': 'männlich',
  'gender.d': 'divers',
  'gender.u': 'unbekannt',
  'gender.none': 'keine Angabe',

  'toolbar.github': 'Astwerk auf GitHub',
  'toolbar.treeName': 'Name des Stammbaums',
  'toolbar.view.tree': 'Baum',
  'toolbar.view.list': 'Liste',
  'toolbar.focus.clear': 'Fokus aufheben',
  'toolbar.focus.label': 'Fokus: {name}',
  'toolbar.theme.light': 'Hell',
  'toolbar.theme.dark': 'Dunkel',
  'toolbar.theme.system': 'System',
  'toolbar.theme.aria': 'Farbschema: {label}',
  'toolbar.theme.title': 'Farbschema: {label} (klicken zum Wechseln)',
  'toolbar.undo': 'Rückgängig',
  'toolbar.redo': 'Wiederholen',
  'toolbar.person': 'Person',
  'toolbar.import': 'Import',
  'toolbar.export': 'Export',
  'toolbar.export.json': 'Als JSON (.json)',
  'toolbar.export.gedcom': 'Als GEDCOM (.ged)',
  'toolbar.export.png': 'Als Bild (.png)',
  'toolbar.export.pdf': 'Als PDF (.pdf)',
  'toolbar.export.jsonShort': 'Export JSON',
  'toolbar.export.gedcomShort': 'Export GEDCOM',
  'toolbar.export.pngShort': 'Export Bild (.png)',
  'toolbar.export.pdfShort': 'Export PDF',
  'toolbar.new': 'Neu',
  'toolbar.moreActions': 'Weitere Aktionen',
  'toolbar.lang': 'Sprache',
  'reset.title': 'Neuen Stammbaum beginnen?',
  'reset.body':
    'Der aktuelle Stammbaum mit {count} Personen wird verworfen. Nicht exportierte Daten gehen verloren.',
  'reset.confirm': 'Verwerfen und neu beginnen',
  'import.failed': 'Import fehlgeschlagen.',

  'detail.empty': 'Wähle eine Person im Baum aus, um ihre Details zu bearbeiten.',
  'detail.editPerson': 'Person bearbeiten',
  'detail.photo': 'Foto',
  'detail.lineage.title': 'Nur die Laufbahn dieser Person hervorheben',
  'detail.focus': 'Fokus',
  'detail.focus.clear': 'Fokus aufheben',
  'detail.ancestors.title': 'Nur die Vorfahren dieser Person zeigen',
  'detail.ancestors': 'Ahnen',
  'detail.ancestors.off': 'Ahnen aus',
  'field.firstName': 'Vorname',
  'field.lastName': 'Nachname',
  'field.gender': 'Geschlecht',
  'field.born': 'Geboren',
  'field.died': 'Gestorben',
  'field.place': 'Ort',
  'field.deceased': 'Verstorben',
  'field.deceased.derived': '(aus Datum/Ort)',
  'field.country': 'Land',
  'field.notes': 'Notizen',
  'field.birthDate.placeholder': 'z. B. 12.03.1950',
  'field.deathDate.placeholder': 'z. B. 4.11.1975',
  'birth.section': 'Bei Geburt (falls abweichend)',
  'birth.gender': 'Geschlecht bei Geburt',
  'section.parents': 'Eltern',
  'section.siblings': 'Geschwister',
  'section.unions': 'Partnerschaften & Kinder',
  'siblings.half': 'halb',
  'unions.noPartner': 'Ohne Partner:in',
  'relation.unlinkParent': '{name} als Elternteil lösen',
  'relation.unlinkPartner': '{name} als Partner lösen',
  'relation.unlinkChild': '{name} als Kind lösen',
  'parents.unlink': 'Von Eltern lösen',
  'parents.add': 'Eltern hinzufügen',
  'parent.add': 'Elternteil hinzufügen',
  'child.add': 'Kind hinzufügen',
  'partner.add': 'Partner hinzufügen',
  'person.delete': 'Person löschen',
  'delete.title': '{name} löschen?',
  'delete.body':
    'Die Person wird aus dem Stammbaum entfernt. Verbindungen zu Partnern und Kindern werden gelöst.',
  'picker.partner.title': 'Person als Partner verknüpfen',
  'picker.child.title': 'Person als Kind verknüpfen',
  'picker.child.description': 'Nur Personen ohne bestehende Eltern sind wählbar.',
  'picker.parent.title': 'Person als Elternteil verknüpfen',
  'picker.empty': 'Keine passende Person gefunden.',

  'list.searchPlaceholder': 'Personen durchsuchen…',
  'list.col.name': 'Name',
  'list.col.born': 'Geboren',
  'list.col.died': 'Gestorben',
  'list.col.age': 'Alter',
  'list.col.birthplace': 'Geburtsort',
  'list.showInTree': 'Im Baum zeigen',
  'list.showInTree.aria': '{name} im Baum zeigen',
  'list.deceased': 'verstorben',
  'list.empty.none': 'Noch keine Personen vorhanden.',
  'list.empty.noMatch': 'Keine Personen gefunden.',

  'search.placeholder': 'Person suchen…',
  'search.aria': 'Person suchen',
  'search.noMatches': 'Keine Treffer.',

  'empty.text': 'Noch keine Personen vorhanden. Lege die erste Person an oder schau dir das Beispiel an.',
  'empty.addFirst': 'Erste Person anlegen',
  'empty.loadSample': 'Beispiel laden',
  'edgeMenu.goTo': 'Gehe zu',
  'role.father': 'Vater',
  'role.mother': 'Mutter',
  'role.child': 'Kind',

  'label.bornPrefix': 'geb.',
  'label.years': '{n} J.',
  'label.months': '{n} Mon.',

  'io.defaultTreeName': 'Mein Stammbaum',
  'io.importedTreeName': 'Importierter Stammbaum',
  'io.filenameFallback': 'stammbaum',
  'io.error.invalidJson': 'Die Datei enthält kein gültiges JSON.',
  'io.error.unexpectedFormat': 'Unerwartetes Dateiformat.',
  'io.error.missingLists': 'Der Datei fehlen die Listen "persons" und "unions".',
  'io.error.unsupportedVersion': 'Nicht unterstützte Dateiversion: {version}',
  'io.error.noGedcom': 'Die Datei enthält keine GEDCOM-Personendaten (INDI).',

  'sample.treeName': 'Familie Schmidt (Beispiel)',
}

const DICTS: Record<Lang, Dict> = { en, de }

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useI18n = create<I18nState>((set) => ({
  lang: detectLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore persistence failures (e.g. private mode)
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang
    set({ lang })
  },
}))

export function getLang(): Lang {
  return useI18n.getState().lang
}

function format(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] === undefined ? `{${key}}` : String(params[key]),
  )
}

export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const str = DICTS[lang][key] ?? en[key] ?? key
  return format(str, params)
}

/** Non-reactive translator, for module-level code and pure helpers. */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(getLang(), key, params)
}

/** Reactive translator hook – components re-render when the language changes. */
export function useT() {
  const lang = useI18n((s) => s.lang)
  return (key: string, params?: Record<string, string | number>) => translate(lang, key, params)
}

export function useLang(): Lang {
  return useI18n((s) => s.lang)
}

/** Localized country name from the platform's Intl data. */
export function countryLabel(code: string, lang: Lang = getLang()): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
