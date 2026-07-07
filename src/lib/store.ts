import {create} from 'zustand'
import {persist} from 'zustand/middleware'
import {temporal} from 'zundo'
import {t} from '@/lib/i18n'
import type {Person, TreeFile, Union} from '@/types'
import {ancestorIdsOf, descendantIdsOf, parentUnionOf} from '@/lib/relations'

const newId = () => crypto.randomUUID()

const newPerson = (patch: Partial<Omit<Person, 'id'>> = {}): Person => ({
  id: newId(),
  firstName: '',
  lastName: '',
  gender: 'u',
  ...patch,
})

interface TreeState {
  treeName: string
  persons: Record<string, Person>
  unions: Record<string, Union>
  selectedPersonId: string | null
  /** Person to center the canvas view on (reset afterwards). */
  focusPersonId: string | null
  /** Active view: tree or list. */
  viewMode: 'tree' | 'list'
  /** Person whose lineage is highlighted (all others are dimmed). */
  focusLineageId: string | null
  /** Person whose ancestors-only view is shown (everyone else is hidden). */
  ancestorFocusId: string | null
  /** Color scheme: light, dark or system preference. */
  theme: 'light' | 'dark' | 'system'
  /** Counter: requests the canvas to fit the full view (only on load/import). */
  fitRequestCounter: number
  /** Image export request from the toolbar (canvas executes it). */
  imageExportFormat: 'png' | 'pdf'
  imageExportCounter: number

  setTreeName: (name: string) => void
  setViewMode: (mode: 'tree' | 'list') => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  /** Trigger image/PDF export; switches to tree view if needed. */
  requestImageExport: (format: 'png' | 'pdf') => void
  toggleFocusLineage: (id: string) => void
  /** Toggles the ancestors-only view for a person. */
  toggleAncestorFocus: (id: string) => void
  selectPerson: (id: string | null) => void
  /** Select and scroll into view in the tree. */
  focusPerson: (id: string) => void
  clearFocus: () => void
  addPerson: (patch?: Partial<Omit<Person, 'id'>>) => string
  updatePerson: (id: string, patch: Partial<Omit<Person, 'id'>>) => void
  deletePerson: (id: string) => void
  /** Creates a new person as partner (reuses an existing solo union if available). */
  addPartner: (personId: string) => string
  /** Creates a child in the given union; without unionId the person's first union is used or a new one is created. */
  addChild: (personId: string, unionId?: string) => string
  /** Creates two new parent persons if the person has no parents yet. */
  addParents: (childId: string) => void
  /** Adds a second, new parent to the existing parent union. */
  addParent: (childId: string) => void
  /** Links an existing person as partner. */
  linkPartner: (personId: string, otherId: string) => void
  /** Links an existing person as child (of the union or person). */
  linkChild: (personId: string, childId: string, unionId?: string) => void
  /** Links an existing person as parent. */
  linkParent: (childId: string, parentId: string) => void
  /** Removes a partner from a union without deleting the person. */
  unlinkPartner: (unionId: string, personId: string) => void
  /** Removes a child from a union without deleting the person. */
  unlinkChild: (unionId: string, childId: string) => void
  reset: () => void
  loadFile: (file: TreeFile) => void
  toFile: () => TreeFile
}

type TrackedState = Pick<TreeState, 'treeName' | 'persons' | 'unions'>

export const useTreeStore = create<TreeState>()(
  persist(
    temporal(
      (set, get) => ({
        treeName: t('io.defaultTreeName'),
        persons: {},
        unions: {},
        selectedPersonId: null,
        focusPersonId: null,
        viewMode: 'tree',
        focusLineageId: null,
        ancestorFocusId: null,
        theme: 'system',
        fitRequestCounter: 0,
        imageExportFormat: 'png',
        imageExportCounter: 0,

        setTreeName: (name) => set({treeName: name}),
        setViewMode: (mode) => set({viewMode: mode}),
        setTheme: (theme) => set({theme}),
        requestImageExport: (format) =>
          set((s) => ({
            viewMode: 'tree',
            imageExportFormat: format,
            imageExportCounter: s.imageExportCounter + 1,
          })),
        toggleFocusLineage: (id) =>
          set((s) => ({focusLineageId: s.focusLineageId === id ? null : id, ancestorFocusId: null})),
        toggleAncestorFocus: (id) =>
          set((s) => ({ancestorFocusId: s.ancestorFocusId === id ? null : id, focusLineageId: null})),
        selectPerson: (id) => set({selectedPersonId: id}),
        focusPerson: (id) => set({selectedPersonId: id, focusPersonId: id}),
        clearFocus: () => set({focusPersonId: null}),

        addPerson: (patch = {}) => {
          const person = newPerson(patch)
          set((s) => ({
            persons: {...s.persons, [person.id]: person},
            selectedPersonId: person.id,
            focusPersonId: person.id,
          }))
          return person.id
        },

        updatePerson: (id, patch) =>
          set((s) => {
            const person = s.persons[id]
            if (!person) return s
            return {persons: {...s.persons, [id]: {...person, ...patch}}}
          }),

        deletePerson: (id) =>
          set((s) => {
            const persons = {...s.persons}
            delete persons[id]
            const unions: Record<string, Union> = {}
            for (const u of Object.values(s.unions)) {
              const partnerIds = u.partnerIds.filter((p) => p !== id)
              const childIds = u.childIds.filter((c) => c !== id)
              // Unions with no partners or with only one partner and no children are meaningless
              if (partnerIds.length === 0) continue
              if (partnerIds.length === 1 && childIds.length === 0) continue
              unions[u.id] = {...u, partnerIds, childIds}
            }
            return {
              persons,
              unions,
              selectedPersonId: s.selectedPersonId === id ? null : s.selectedPersonId,
              focusLineageId: s.focusLineageId === id ? null : s.focusLineageId,
              ancestorFocusId: s.ancestorFocusId === id ? null : s.ancestorFocusId,
            }
          }),

        addPartner: (personId) => {
          const s = get()
          if (!s.persons[personId]) return ''
          const partner = newPerson()
          const solo = Object.values(s.unions).find(
            (u) => u.partnerIds.length === 1 && u.partnerIds[0] === personId,
          )
          set((state) => {
            const unions = {...state.unions}
            if (solo) {
              unions[solo.id] = {...solo, partnerIds: [...solo.partnerIds, partner.id]}
            } else {
              const union: Union = {id: newId(), partnerIds: [personId, partner.id], childIds: []}
              unions[union.id] = union
            }
            return {
              persons: {...state.persons, [partner.id]: partner},
              unions,
              selectedPersonId: partner.id,
              focusPersonId: partner.id,
            }
          })
          return partner.id
        },

        addChild: (personId, unionId) => {
          const s = get()
          const parent = s.persons[personId]
          if (!parent) return ''
          const child = newPerson({lastName: parent.lastName})
          const union = unionId
            ? s.unions[unionId]
            : Object.values(s.unions).find((u) => u.partnerIds.includes(personId))
          set((state) => {
            const unions = {...state.unions}
            if (union) {
              unions[union.id] = {...union, childIds: [...union.childIds, child.id]}
            } else {
              const created: Union = {id: newId(), partnerIds: [personId], childIds: [child.id]}
              unions[created.id] = created
            }
            return {
              persons: {...state.persons, [child.id]: child},
              unions,
              selectedPersonId: child.id,
              focusPersonId: child.id,
            }
          })
          return child.id
        },

        addParents: (childId) => {
          const s = get()
          const child = s.persons[childId]
          if (!child) return
          if (parentUnionOf(s.unions, childId)) return
          const father = newPerson({gender: 'm', lastName: child.lastName})
          const mother = newPerson({gender: 'f'})
          const union: Union = {
            id: newId(),
            partnerIds: [father.id, mother.id],
            childIds: [childId],
          }
          set((state) => ({
            persons: {...state.persons, [father.id]: father, [mother.id]: mother},
            unions: {...state.unions, [union.id]: union},
            selectedPersonId: father.id,
            focusPersonId: father.id,
          }))
        },

        addParent: (childId) => {
          const s = get()
          const union = parentUnionOf(s.unions, childId)
          if (!union || union.partnerIds.length >= 2) return
          const parent = newPerson()
          set((state) => ({
            persons: {...state.persons, [parent.id]: parent},
            unions: {
              ...state.unions,
              [union.id]: {...union, partnerIds: [...union.partnerIds, parent.id]},
            },
            selectedPersonId: parent.id,
            focusPersonId: parent.id,
          }))
        },

        linkPartner: (personId, otherId) => {
          const s = get()
          if (personId === otherId || !s.persons[personId] || !s.persons[otherId]) return
          const alreadyPartners = Object.values(s.unions).some(
            (u) => u.partnerIds.includes(personId) && u.partnerIds.includes(otherId),
          )
          if (alreadyPartners) return
          const solo = Object.values(s.unions).find(
            (u) =>
              u.partnerIds.length === 1 &&
              (u.partnerIds[0] === personId || u.partnerIds[0] === otherId),
          )
          set((state) => {
            const unions = {...state.unions}
            if (solo) {
              const missing = solo.partnerIds[0] === personId ? otherId : personId
              unions[solo.id] = {...solo, partnerIds: [...solo.partnerIds, missing]}
            } else {
              const union: Union = {id: newId(), partnerIds: [personId, otherId], childIds: []}
              unions[union.id] = union
            }
            return {unions}
          })
        },

        linkChild: (personId, childId, unionId) => {
          const s = get()
          if (personId === childId || !s.persons[personId] || !s.persons[childId]) return
          if (parentUnionOf(s.unions, childId)) return
          const union = unionId
            ? s.unions[unionId]
            : Object.values(s.unions).find((u) => u.partnerIds.includes(personId))
          const parentIds = union ? union.partnerIds : [personId]
          // Prevent cycles: the child must not be an ancestor of a parent
          for (const pid of parentIds) {
            if (pid === childId || ancestorIdsOf(s.unions, pid).has(childId)) return
          }
          set((state) => {
            const unions = {...state.unions}
            if (union) {
              unions[union.id] = {...union, childIds: [...union.childIds, childId]}
            } else {
              const created: Union = {id: newId(), partnerIds: [personId], childIds: [childId]}
              unions[created.id] = created
            }
            return {unions}
          })
        },

        linkParent: (childId, parentId) => {
          const s = get()
          if (childId === parentId || !s.persons[childId] || !s.persons[parentId]) return
          if (descendantIdsOf(s.unions, childId).has(parentId)) return
          const union = parentUnionOf(s.unions, childId)
          if (union && (union.partnerIds.length >= 2 || union.partnerIds.includes(parentId))) return
          set((state) => {
            const unions = {...state.unions}
            if (union) {
              unions[union.id] = {...union, partnerIds: [...union.partnerIds, parentId]}
            } else {
              const created: Union = {id: newId(), partnerIds: [parentId], childIds: [childId]}
              unions[created.id] = created
            }
            return {unions}
          })
        },

        unlinkPartner: (unionId, personId) =>
          set((s) => {
            const union = s.unions[unionId]
            if (!union || !union.partnerIds.includes(personId)) return s
            const partnerIds = union.partnerIds.filter((id) => id !== personId)
            const unions = {...s.unions}
            if (
              partnerIds.length === 0 ||
              (partnerIds.length === 1 && union.childIds.length === 0)
            ) {
              delete unions[unionId]
            } else {
              unions[unionId] = {...union, partnerIds}
            }
            return {unions}
          }),

        unlinkChild: (unionId, childId) =>
          set((s) => {
            const union = s.unions[unionId]
            if (!union || !union.childIds.includes(childId)) return s
            const childIds = union.childIds.filter((id) => id !== childId)
            const unions = {...s.unions}
            if (union.partnerIds.length === 1 && childIds.length === 0) {
              delete unions[unionId]
            } else {
              unions[unionId] = {...union, childIds}
            }
            return {unions}
          }),

        reset: () =>
          set({
            treeName: t('io.defaultTreeName'),
            persons: {},
            unions: {},
            selectedPersonId: null,
            focusLineageId: null,
            ancestorFocusId: null,
          }),

        loadFile: (file) =>
          set((s) => ({
            treeName: file.name,
            persons: Object.fromEntries(file.persons.map((p) => [p.id, p])),
            unions: Object.fromEntries(file.unions.map((u) => [u.id, u])),
            selectedPersonId: null,
            focusLineageId: null,
            ancestorFocusId: null,
            fitRequestCounter: s.fitRequestCounter + 1,
          })),

        toFile: () => {
          const s = get()
          return {
            format: 'stammbaum',
            version: 1,
            name: s.treeName,
            persons: Object.values(s.persons),
            unions: Object.values(s.unions),
          }
        },
      }),
      {
        limit: 100,
        partialize: (s): TrackedState => ({
          treeName: s.treeName,
          persons: s.persons,
          unions: s.unions,
        }),
        // Pure selection/focus changes don't create an undo step
        equality: (past, current) =>
          past.persons === current.persons &&
          past.unions === current.unions &&
          past.treeName === current.treeName,
        // Batch rapid successive changes (e.g. typing) into a single step
        handleSet: (handleSet) => {
          let lastSavedAt = 0
          return (state) => {
            const now = Date.now()
            if (now - lastSavedAt < 800) return
            lastSavedAt = now
            handleSet(state)
          }
        },
      },
    ),
    {
      name: 'stammbaum-editor',
      partialize: (s) => ({
        treeName: s.treeName,
        persons: s.persons,
        unions: s.unions,
        theme: s.theme,
      }),
    },
  ),
)

// Loading from localStorage should not create an undo step
useTreeStore.temporal.getState().clear()

export const undoTree = () => {
  useTreeStore.temporal.getState().undo()
  // Empty set call so the persist middleware saves the new state
  useTreeStore.setState({})
}

export const redoTree = () => {
  useTreeStore.temporal.getState().redo()
  useTreeStore.setState({})
}
