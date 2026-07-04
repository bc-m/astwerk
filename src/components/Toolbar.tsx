import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import {
  DownloadIcon,
  FilePlus2Icon,
  FocusIcon,
  ListIcon,
  MonitorIcon,
  MoonIcon,
  NetworkIcon,
  Redo2Icon,
  SunIcon,
  TreeDeciduousIcon,
  Undo2Icon,
  UploadIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { PersonSearch } from '@/components/PersonSearch'
import { parseGedcom } from '@/lib/gedcom'
import { downloadGedcomFile, downloadTreeFile, parseTreeFile } from '@/lib/io'
import { displayName } from '@/lib/person'
import { redoTree, undoTree, useTreeStore } from '@/lib/store'

export function Toolbar() {
  const treeName = useTreeStore((s) => s.treeName)
  const setTreeName = useTreeStore((s) => s.setTreeName)
  const personCount = useTreeStore((s) => Object.keys(s.persons).length)
  const addPerson = useTreeStore((s) => s.addPerson)
  const loadFile = useTreeStore((s) => s.loadFile)
  const toFile = useTreeStore((s) => s.toFile)
  const reset = useTreeStore((s) => s.reset)
  const viewMode = useTreeStore((s) => s.viewMode)
  const setViewMode = useTreeStore((s) => s.setViewMode)
  const focusLineageId = useTreeStore((s) => s.focusLineageId)
  const toggleFocusLineage = useTreeStore((s) => s.toggleFocusLineage)
  const focusedPerson = useTreeStore((s) =>
    s.focusLineageId ? s.persons[s.focusLineageId] : undefined,
  )
  const theme = useTreeStore((s) => s.theme)
  const setTheme = useTreeStore((s) => s.setTheme)
  const requestImageExport = useTreeStore((s) => s.requestImageExport)

  const canUndo = useStore(useTreeStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useTreeStore.temporal, (s) => s.futureStates.length > 0)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    if (!importError) return
    const t = setTimeout(() => setImportError(null), 8000)
    return () => clearTimeout(t)
  }, [importError])

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const isGedcom = /\.ged$/i.test(file.name) || text.trimStart().startsWith('0 HEAD')
      loadFile(isGedcom ? parseGedcom(text, baseName) : parseTreeFile(text))
      setImportError(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import fehlgeschlagen.')
    }
  }

  return (
    <header className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
      <a
        href="https://github.com/bc-m/astwerk"
        target="_blank"
        rel="noreferrer noopener"
        title="Astwerk auf GitHub"
        className="flex items-center gap-2 hover:opacity-80"
      >
        <TreeDeciduousIcon className="size-5 text-emerald-600" />
        <h1 className="text-sm font-semibold whitespace-nowrap">Astwerk</h1>
      </a>
      <Separator orientation="vertical" className="!h-5" />
      <Input
        value={treeName}
        onChange={(e) => setTreeName(e.target.value)}
        aria-label="Name des Stammbaums"
        className="h-8 w-56"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {personCount} {personCount === 1 ? 'Person' : 'Personen'}
      </span>
      <div className="flex items-center rounded-lg border p-0.5">
        <Button
          size="sm"
          variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-xs"
          onClick={() => setViewMode('tree')}
        >
          <NetworkIcon /> Baum
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-xs"
          onClick={() => setViewMode('list')}
        >
          <ListIcon /> Liste
        </Button>
      </div>
      <PersonSearch />
      {focusLineageId && focusedPerson && (
        <Button
          size="sm"
          variant="secondary"
          className="h-6 max-w-56 px-2 text-xs"
          title="Fokus aufheben"
          onClick={() => toggleFocusLineage(focusLineageId)}
        >
          <FocusIcon /> <span className="truncate">Fokus: {displayName(focusedPerson)}</span>
          <XIcon />
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {importError && <span className="max-w-72 truncate text-xs text-destructive">{importError}</span>}
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Farbschema: ${theme === 'light' ? 'Hell' : theme === 'dark' ? 'Dunkel' : 'System'}`}
          title={`Farbschema: ${theme === 'light' ? 'Hell' : theme === 'dark' ? 'Dunkel' : 'System'} (klicken zum Wechseln)`}
          onClick={() =>
            setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')
          }
        >
          {theme === 'light' ? <SunIcon /> : theme === 'dark' ? <MoonIcon /> : <MonitorIcon />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Rückgängig"
          disabled={!canUndo}
          onClick={undoTree}
        >
          <Undo2Icon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Wiederholen"
          disabled={!canRedo}
          onClick={redoTree}
        >
          <Redo2Icon />
        </Button>
        <Separator orientation="vertical" className="!h-5" />
        <Button size="sm" onClick={() => addPerson()}>
          <UserPlusIcon /> Person
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> Import
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={personCount === 0}
            render={
              <Button size="sm" variant="outline">
                <DownloadIcon /> Export
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadTreeFile(toFile())}>
              Als JSON (.json)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadGedcomFile(toFile())}>
              Als GEDCOM (.ged)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => requestImageExport('png')}>
              Als Bild (.png)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => requestImageExport('pdf')}>
              Als PDF (.pdf)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (personCount === 0 ? reset() : setResetOpen(true))}
        >
          <FilePlus2Icon /> Neu
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,.ged,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImportFile(file)
          e.target.value = ''
        }}
      />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Neuen Stammbaum beginnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der aktuelle Stammbaum mit {personCount} Personen wird verworfen. Nicht exportierte
              Daten gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                reset()
                setResetOpen(false)
              }}
            >
              Verwerfen und neu beginnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
