import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  FilePlus2Icon,
  FocusIcon,
  LanguagesIcon,
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
import { useI18n, useT } from '@/lib/i18n'
import { downloadGedcomFile, downloadTreeFile, parseTreeFile } from '@/lib/io'
import { displayName } from '@/lib/person'
import { redoTree, undoTree, useTreeStore } from '@/lib/store'

export function Toolbar() {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)
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
      setImportError(err instanceof Error ? err.message : t('import.failed'))
    }
  }

  const themeLabel =
    theme === 'light'
      ? t('toolbar.theme.light')
      : theme === 'dark'
        ? t('toolbar.theme.dark')
        : t('toolbar.theme.system')
  const ThemeIcon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon
  const cycleTheme = () =>
    setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')
  const toggleLang = () => setLang(lang === 'de' ? 'en' : 'de')

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-3 py-2.5 sm:px-4">
      <a
        href="https://github.com/bc-m/astwerk"
        target="_blank"
        rel="noreferrer noopener"
        title={t('toolbar.github')}
        className="flex items-center gap-2 hover:opacity-80"
      >
        <TreeDeciduousIcon className="size-5 text-emerald-600" />
        <h1 className="hidden text-sm font-semibold whitespace-nowrap sm:block">Astwerk</h1>
      </a>
      <Separator orientation="vertical" className="!h-5 hidden sm:block" />
      <Input
        value={treeName}
        onChange={(e) => setTreeName(e.target.value)}
        aria-label={t('toolbar.treeName')}
        className="h-8 grow basis-40 sm:w-56 sm:grow-0 sm:basis-auto"
      />
      <span className="hidden text-xs text-muted-foreground whitespace-nowrap sm:inline">
        {t(personCount === 1 ? 'person.count.one' : 'person.count.other', { count: personCount })}
      </span>
      <div className="flex items-center rounded-lg border p-0.5">
        <Button
          size="sm"
          variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-xs"
          onClick={() => setViewMode('tree')}
        >
          <NetworkIcon /> {t('toolbar.view.tree')}
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-xs"
          onClick={() => setViewMode('list')}
        >
          <ListIcon /> {t('toolbar.view.list')}
        </Button>
      </div>
      <PersonSearch />
      {focusLineageId && focusedPerson && (
        <Button
          size="sm"
          variant="secondary"
          className="h-6 max-w-56 px-2 text-xs"
          title={t('toolbar.focus.clear')}
          onClick={() => toggleFocusLineage(focusLineageId)}
        >
          <FocusIcon />{' '}
          <span className="truncate">{t('toolbar.focus.label', { name: displayName(focusedPerson) })}</span>
          <XIcon />
        </Button>
      )}

      <div className="flex items-center gap-2 sm:ml-auto">
        {importError && <span className="max-w-72 truncate text-xs text-destructive">{importError}</span>}
        <Button
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
          aria-label={t('toolbar.theme.aria', { label: themeLabel })}
          title={t('toolbar.theme.title', { label: themeLabel })}
          onClick={cycleTheme}
        >
          <ThemeIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
          aria-label={t('toolbar.lang')}
          title={t('toolbar.lang')}
          onClick={toggleLang}
        >
          <LanguagesIcon /> <span className="text-xs font-medium uppercase">{lang}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
          aria-label={t('toolbar.undo')}
          disabled={!canUndo}
          onClick={undoTree}
        >
          <Undo2Icon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
          aria-label={t('toolbar.redo')}
          disabled={!canRedo}
          onClick={redoTree}
        >
          <Redo2Icon />
        </Button>
        <Separator orientation="vertical" className="!h-5 hidden sm:block" />
        <Button size="sm" onClick={() => addPerson()}>
          <UserPlusIcon /> {t('toolbar.person')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="hidden sm:inline-flex"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon /> {t('toolbar.import')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={personCount === 0}
            render={
              <Button size="sm" variant="outline" className="hidden sm:inline-flex">
                <DownloadIcon /> {t('toolbar.export')}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => downloadTreeFile(toFile())}>
              {t('toolbar.export.json')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadGedcomFile(toFile())}>
              {t('toolbar.export.gedcom')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => requestImageExport('png')}>
              {t('toolbar.export.png')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => requestImageExport('pdf')}>
              {t('toolbar.export.pdf')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
          onClick={() => (personCount === 0 ? reset() : setResetOpen(true))}
        >
          <FilePlus2Icon /> {t('toolbar.new')}
        </Button>

        {/* Mobile: all secondary actions in one overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant="ghost"
                className="sm:hidden"
                aria-label={t('toolbar.moreActions')}
              >
                <EllipsisVerticalIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem disabled={!canUndo} onClick={undoTree}>
              <Undo2Icon /> {t('toolbar.undo')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canRedo} onClick={redoTree}>
              <Redo2Icon /> {t('toolbar.redo')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={cycleTheme}>
              <ThemeIcon /> {t('toolbar.theme.aria', { label: themeLabel })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleLang}>
              <LanguagesIcon /> {t('toolbar.lang')}: {lang.toUpperCase()}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              <UploadIcon /> {t('toolbar.import')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={personCount === 0} onClick={() => downloadTreeFile(toFile())}>
              <DownloadIcon /> {t('toolbar.export.jsonShort')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={personCount === 0}
              onClick={() => downloadGedcomFile(toFile())}
            >
              <DownloadIcon /> {t('toolbar.export.gedcomShort')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={personCount === 0}
              onClick={() => requestImageExport('png')}
            >
              <DownloadIcon /> {t('toolbar.export.pngShort')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={personCount === 0}
              onClick={() => requestImageExport('pdf')}
            >
              <DownloadIcon /> {t('toolbar.export.pdfShort')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => (personCount === 0 ? reset() : setResetOpen(true))}>
              <FilePlus2Icon /> {t('toolbar.new')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <AlertDialogTitle>{t('reset.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reset.body', { count: personCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('action.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                reset()
                setResetOpen(false)
              }}
            >
              {t('reset.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
