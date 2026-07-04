# Astwerk

A browser-based family tree editor. Runs entirely client-side – no servers, no accounts.

**Stack:** Vite · React · TypeScript · Tailwind CSS · shadcn/ui (Base UI) · React Flow (@xyflow/react) · Zustand

## Features

- Create, edit and delete persons (name, gender, birth/death dates, birthplace, notes)
- Birth identity recorded separately: first name, last name and sex at birth
- Photo per person (downscaled on upload and stored as a data URL)
- Relations: partners, children, parents – modeled as persons + unions (partnerships)
- Link existing persons as partner/child/parent (search dialog, with cycle checks)
- Unlink relations without deleting persons
- Undo/redo (⌘Z / ⇧⌘Z or Ctrl+Z / Ctrl+Y, up to 100 steps)
- Custom genealogical layout: couples always side by side, parents centered above
  their children, multiple marriages as a chain; childless couples without a union dot
- Person search in the toolbar (jumps to the person in the tree)
- Siblings and half-siblings in the detail panel
- Cross-generation connections drawn as dashed routes
- List view with search as an alternative to the tree (toolbar toggle)
- Focus mode: highlight a person's lineage (ancestors, descendants, partners), everything else dims
- Image and PDF export of the tree (canvas buttons or export menu) with timestamped
  filenames (`name_YYYYMMDD_hhmmss.png/.pdf`)
- Dark mode (light / dark / system, toolbar toggle)
- Export as JSON or GEDCOM 5.5.1 (timestamped filenames), import of JSON and GEDCOM files
- Autosave to the browser's localStorage
- All entities use UUIDs (`crypto.randomUUID()`)

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## File format

```jsonc
{
  "format": "stammbaum",
  "version": 1,
  "name": "My family tree",
  "persons": [
    { "id": "<uuid>", "firstName": "…", "lastName": "…", "gender": "m|f|d|u", "birthDate": "…", "deathDate": "…" }
  ],
  "unions": [
    { "id": "<uuid>", "partnerIds": ["<uuid>"], "childIds": ["<uuid>"] }
  ]
}
```

A *union* is a partnership/marriage (1–2 partners) with shared children; single parents
are unions with one partner.

### GEDCOM

Export/import as GEDCOM 5.5.1 (`src/lib/gedcom.ts`): names (including a second `NAME`
with `TYPE birth` for the birth name), `SEX` (non-binary as `X`), birth/death with date
conversion (`12.05.1955` ↔ `12 MAY 1955`, free text as a date phrase in parentheses),
place, notes (`CONT`/`CONC`) and families (`FAM`/`HUSB`/`WIFE`/`CHIL`). Sex at birth
travels in the custom tag `_BSEX`. Photos are only included in the JSON format.
