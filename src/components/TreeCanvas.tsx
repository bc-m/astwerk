import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  useViewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { NetworkIcon, UsersIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { downloadDataUrl, slugify, timestampSuffix } from '@/lib/io'
import { useResolvedTheme } from '@/lib/theme'
import { EdgeMenuContext, ElbowEdge } from '@/components/edges'
import { PersonNode, UnionNode } from '@/components/nodes'
import { buildFlowGraph, PERSON_H, PERSON_W, type FlowNode } from '@/lib/layout'
import { displayName } from '@/lib/person'
import { ancestorIdsOf } from '@/lib/relations'
import { createSampleTree } from '@/lib/sample'
import { useTreeStore } from '@/lib/store'
import type { Person, Union } from '@/types'

/** Popover opened by clicking an edge or union dot: jump to a related person. */
type EdgeMenu = { x: number; y: number; unionId: string }

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/**
 * Stable minimap: a fixed overview of the whole tree (React Flow's built-in
 * minimap folds the viewport into its bounds, so it drifts and shrinks the
 * tree when panning or zooming out). The current viewport is drawn as a frame,
 * hidden once the whole tree fits on screen. Click to recentre the canvas.
 */
function TreeMiniMap({
  nodes,
  bounds,
  viewport,
  width,
  height,
  dark,
  hideFrame,
  onJump,
}: {
  nodes: FlowNode[]
  bounds: Bounds
  viewport: { x: number; y: number; zoom: number }
  width: number
  height: number
  dark: boolean
  hideFrame: boolean
  onJump: (x: number, y: number) => void
}) {
  const bw = bounds.maxX - bounds.minX
  const bh = bounds.maxY - bounds.minY
  const padX = bw * 0.04 + 60
  const padY = bh * 0.04 + 60
  const vbX = bounds.minX - padX
  const vbY = bounds.minY - padY
  const vbW = bw + 2 * padX
  const vbH = bh + 2 * padY
  const vpLeft = -viewport.x / viewport.zoom
  const vpTop = -viewport.y / viewport.zoom
  const vpW = width / viewport.zoom
  const vpH = height / viewport.zoom

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = Math.min(rect.width / vbW, rect.height / vbH)
    const offX = (rect.width - vbW * scale) / 2
    const offY = (rect.height - vbH * scale) / 2
    onJump(vbX + (e.clientX - rect.left - offX) / scale, vbY + (e.clientY - rect.top - offY) / scale)
  }

  return (
    <div className="h-28 w-40 overflow-hidden rounded-md border bg-card/90 shadow-sm">
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full cursor-pointer"
        onClick={handleClick}
      >
        {nodes.map((n) =>
          n.type === 'person' ? (
            <rect
              key={n.id}
              x={n.position.x}
              y={n.position.y}
              width={n.width ?? 0}
              height={n.height ?? 0}
              rx={8}
              fill="#94a3b8"
            />
          ) : null,
        )}
        {!hideFrame && width > 0 && (
          <rect
            x={vpLeft}
            y={vpTop}
            width={vpW}
            height={vpH}
            fill="none"
            stroke={dark ? '#ffffff' : '#000000'}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  )
}

const nodeTypes = { person: PersonNode, union: UnionNode }
const edgeTypes = { elbow: ElbowEdge }

function EmptyState() {
  const addPerson = useTreeStore((s) => s.addPerson)
  const loadFile = useTreeStore((s) => s.loadFile)
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <Card className="w-80">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine Personen vorhanden. Lege die erste Person an oder schau dir das Beispiel an.
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={() => addPerson()}>
              <UsersIcon /> Erste Person anlegen
            </Button>
            <Button variant="outline" onClick={() => loadFile(createSampleTree())}>
              <SparklesIcon /> Beispiel laden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Canvas() {
  const persons = useTreeStore((s) => s.persons)
  const unions = useTreeStore((s) => s.unions)
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId)
  const selectPerson = useTreeStore((s) => s.selectPerson)
  const focusPersonId = useTreeStore((s) => s.focusPersonId)
  const clearFocus = useTreeStore((s) => s.clearFocus)
  const focusLineageId = useTreeStore((s) => s.focusLineageId)
  const ancestorFocusId = useTreeStore((s) => s.ancestorFocusId)
  const toggleAncestorFocus = useTreeStore((s) => s.toggleAncestorFocus)
  const treeName = useTreeStore((s) => s.treeName)
  const resolvedTheme = useResolvedTheme()
  const { fitView, getNodes, getNode, getViewport, setCenter } = useReactFlow()
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenu | null>(null)

  const goToPerson = (personId: string) => {
    const node = getNode(personId)
    if (node) {
      const { zoom } = getViewport()
      void setCenter(node.position.x + PERSON_W / 2, node.position.y + PERSON_H / 2, {
        zoom,
        duration: 500,
      })
    }
    selectPerson(personId)
    setEdgeMenu(null)
  }

  const openEdgeMenu = useCallback(
    (unionId: string, x: number, y: number) => setEdgeMenu({ x, y, unionId }),
    [],
  )

  const { nodes, edges } = useMemo(() => {
    // Ancestor focus: reduce the tree to the person and their ancestors only,
    // hiding partners, siblings and descendants.
    if (ancestorFocusId && persons[ancestorFocusId]) {
      const keep = ancestorIdsOf(unions, ancestorFocusId)
      keep.add(ancestorFocusId)
      const filteredPersons: Record<string, Person> = {}
      for (const id of keep) if (persons[id]) filteredPersons[id] = persons[id]
      // Keep only the unions that connect parents to a person in the pedigree,
      // so no lines are drawn to hidden partners or descendants.
      const filteredUnions: Record<string, Union> = {}
      for (const u of Object.values(unions)) {
        if (u.childIds.some((c) => keep.has(c))) filteredUnions[u.id] = u
      }
      return buildFlowGraph(filteredPersons, filteredUnions, selectedPersonId, null, ancestorFocusId)
    }
    return buildFlowGraph(persons, unions, selectedPersonId, focusLineageId)
  }, [persons, unions, selectedPersonId, focusLineageId, ancestorFocusId])

  const treeBounds = useMemo(() => {
    if (nodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + (n.width ?? 0))
      maxY = Math.max(maxY, n.position.y + (n.height ?? 0))
    }
    return { minX, minY, maxX, maxY }
  }, [nodes])

  // Limit how far the canvas can be panned: the tree bounds plus a margin, so
  // you can't drift off into empty space far from the tree.
  const translateExtent = useMemo(() => {
    if (!treeBounds) return undefined
    const margin = 1500
    return [
      [treeBounds.minX - margin, treeBounds.minY - margin],
      [treeBounds.maxX + margin, treeBounds.maxY + margin],
    ] as [[number, number], [number, number]]
  }, [treeBounds])

  // Whether the whole tree currently fits in the viewport — then the minimap
  // viewport frame is hidden (it would just wrap the entire map).
  const viewport = useViewport()
  const rfWidth = useStore((s) => s.width)
  const rfHeight = useStore((s) => s.height)
  const wholeTreeVisible = useMemo(() => {
    if (!treeBounds || !rfWidth || !rfHeight) return false
    const { x, y, zoom } = viewport
    const left = -x / zoom
    const top = -y / zoom
    const right = (rfWidth - x) / zoom
    const bottom = (rfHeight - y) / zoom
    return (
      left <= treeBounds.minX &&
      top <= treeBounds.minY &&
      right >= treeBounds.maxX &&
      bottom >= treeBounds.maxY
    )
  }, [viewport, rfWidth, rfHeight, treeBounds])

  // Reframe the canvas when entering or leaving the ancestor-only view.
  const prevAncestor = useRef(ancestorFocusId)
  useEffect(() => {
    if (prevAncestor.current === ancestorFocusId) return
    prevAncestor.current = ancestorFocusId
    const frame = requestAnimationFrame(() => void fitView({ padding: 0.15, duration: 300 }))
    return () => cancelAnimationFrame(frame)
  }, [ancestorFocusId, fitView])

  const buildPngImage = async () => {
    const allNodes = getNodes()
    if (allNodes.length === 0) return null
    const bounds = getNodesBounds(allNodes)
    // Render close to native size so text stays sharp; only scale down when a
    // side would exceed the CSS cap. Then pick the highest pixel ratio that
    // keeps the raster within the browser's canvas limits.
    const MAX_SIDE = 8192
    const MAX_RASTER = 15000
    const rawW = Math.max(Math.ceil(bounds.width) + 80, 640)
    const rawH = Math.max(Math.ceil(bounds.height) + 80, 480)
    const fit = Math.min(1, MAX_SIDE / Math.max(rawW, rawH))
    const width = Math.round(rawW * fit)
    const height = Math.round(rawH * fit)
    // maxZoom 1: never upscale a small tree, just render it crisp at 1×.
    const viewport = getViewportForBounds(bounds, width, height, 0.1, 1, 0.02)
    const pixelRatio = Math.max(1, Math.min(2, MAX_RASTER / Math.max(width, height)))
    const el = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!el) return null
    const dataUrl = await toPng(el, {
      backgroundColor: resolvedTheme === 'dark' ? '#111111' : '#f5f5f5',
      width,
      height,
      pixelRatio,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    })
    return { dataUrl, width, height }
  }

  const exportPng = async () => {
    const image = await buildPngImage()
    if (!image) return
    downloadDataUrl(`${slugify(treeName) || 'stammbaum'}_${timestampSuffix()}.png`, image.dataUrl)
  }

  const exportPdf = async () => {
    const image = await buildPngImage()
    if (!image) return
    const { jsPDF } = await import('jspdf')
    // Page size exactly cropped to the image (pt = px * 0.75)
    const pageW = image.width * 0.75
    const pageH = image.height * 0.75
    const pdf = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [pageW, pageH],
    })
    pdf.addImage(image.dataUrl, 'PNG', 0, 0, pageW, pageH)
    pdf.save(`${slugify(treeName) || 'stammbaum'}_${timestampSuffix()}.pdf`)
  }

  // Execute export requests from the toolbar (after switching to tree view)
  const imageExportCounter = useTreeStore((s) => s.imageExportCounter)
  useEffect(() => {
    if (imageExportCounter === 0) return
    const format = useTreeStore.getState().imageExportFormat
    const timer = setTimeout(() => {
      void (format === 'pdf' ? exportPdf() : exportPng())
    }, 150)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageExportCounter])

  const structureKey = Object.keys(persons).length + Object.keys(unions).length
  // Fit full view only on explicit request (import/load sample) —
  // otherwise the camera stays where the user left it
  const fitRequest = useTreeStore((s) => s.fitRequestCounter)
  useEffect(() => {
    if (fitRequest === 0) return
    const frame = requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300 }))
    return () => cancelAnimationFrame(frame)
  }, [fitRequest, fitView])

  // Scroll persons selected via the panel into view
  useEffect(() => {
    if (!focusPersonId) return
    const timer = setTimeout(() => {
      void fitView({ nodes: [{ id: focusPersonId }], duration: 400, maxZoom: 1 })
      clearFocus()
    }, 80)
    return () => clearTimeout(timer)
  }, [focusPersonId, fitView, clearFocus])

  const menuUnion = edgeMenu ? unions[edgeMenu.unionId] : undefined
  const menuItem = (id: string, role: string | null) => (
    <button
      key={id}
      type="button"
      disabled={id === selectedPersonId}
      onClick={() => goToPerson(id)}
      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {role && <span className="shrink-0 text-xs text-muted-foreground">{role}</span>}
      <span className="truncate">{displayName(persons[id])}</span>
    </button>
  )

  return (
    <EdgeMenuContext.Provider value={openEdgeMenu}>
      {structureKey === 0 && <EmptyState />}
      <ReactFlow<FlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={resolvedTheme}
        onNodeClick={(event, node) => {
          if (node.type === 'person') selectPerson(node.id)
          else if (node.type === 'union')
            setEdgeMenu({ x: event.clientX, y: event.clientY, unionId: node.id })
        }}
        onPaneClick={() => {
          selectPerson(null)
          setEdgeMenu(null)
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        translateExtent={translateExtent}
        minZoom={0.1}
        style={{ background: 'var(--canvas)' }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
        <Controls showInteractive={false} />
        {treeBounds && (
          <Panel position="bottom-right">
            <TreeMiniMap
              nodes={nodes}
              bounds={treeBounds}
              viewport={viewport}
              width={rfWidth}
              height={rfHeight}
              dark={resolvedTheme === 'dark'}
              hideFrame={wholeTreeVisible}
              onJump={(x, y) => void setCenter(x, y, { zoom: viewport.zoom, duration: 300 })}
            />
          </Panel>
        )}
        {ancestorFocusId && (
          <Panel position="top-right" className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => toggleAncestorFocus(ancestorFocusId)}>
              <NetworkIcon /> Ahnen aus
            </Button>
          </Panel>
        )}
      </ReactFlow>
      {edgeMenu && menuUnion && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEdgeMenu(null)} />
          <div
            className="fixed z-50 min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{
              left: Math.min(edgeMenu.x, window.innerWidth - 232),
              top: Math.min(edgeMenu.y, window.innerHeight - 240),
            }}
          >
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Gehe zu</div>
            {menuUnion.partnerIds
              .filter((id) => persons[id])
              .map((id) =>
                menuItem(
                  id,
                  persons[id].gender === 'm'
                    ? 'Vater'
                    : persons[id].gender === 'f'
                      ? 'Mutter'
                      : null,
                ),
              )}
            {menuUnion.partnerIds.some((id) => persons[id]) &&
              menuUnion.childIds.some((id) => persons[id]) && (
                <div className="my-1 h-px bg-border" />
              )}
            {menuUnion.childIds.filter((id) => persons[id]).map((id) => menuItem(id, 'Kind'))}
          </div>
        </>
      )}
    </EdgeMenuContext.Provider>
  )
}

export function TreeCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
