import { useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { FileTextIcon, ImageIcon, UsersIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { downloadDataUrl, slugify, timestampSuffix } from '@/lib/io'
import { useResolvedTheme } from '@/lib/theme'
import { ElbowEdge } from '@/components/edges'
import { PersonNode, UnionNode } from '@/components/nodes'
import { buildFlowGraph, type FlowNode } from '@/lib/layout'
import { createSampleTree } from '@/lib/sample'
import { useTreeStore } from '@/lib/store'

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
  const treeName = useTreeStore((s) => s.treeName)
  const resolvedTheme = useResolvedTheme()
  const { fitView, getNodes } = useReactFlow()

  const { nodes, edges } = useMemo(
    () => buildFlowGraph(persons, unions, selectedPersonId, focusLineageId),
    [persons, unions, selectedPersonId, focusLineageId],
  )

  const buildPngImage = async () => {
    const allNodes = getNodes()
    if (allNodes.length === 0) return null
    const bounds = getNodesBounds(allNodes)
    const width = Math.min(Math.max(Math.ceil(bounds.width) + 80, 640), 4096)
    const height = Math.min(Math.max(Math.ceil(bounds.height) + 80, 480), 4096)
    const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, 0.05)
    const el = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!el) return null
    const dataUrl = await toPng(el, {
      backgroundColor: resolvedTheme === 'dark' ? '#111111' : '#f5f5f5',
      width,
      height,
      pixelRatio: 2,
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

  return (
    <>
      {structureKey === 0 && <EmptyState />}
      <ReactFlow<FlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={resolvedTheme}
        onNodeClick={(_, node) => {
          if (node.type === 'person') selectPerson(node.id)
        }}
        onPaneClick={() => selectPerson(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        style={{ background: 'var(--canvas)' }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!h-28 !w-40" />
        <Panel position="top-right" className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void exportPng()}>
            <ImageIcon /> PNG
          </Button>
          <Button size="sm" variant="outline" onClick={() => void exportPdf()}>
            <FileTextIcon /> PDF
          </Button>
        </Panel>
      </ReactFlow>
    </>
  )
}

export function TreeCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
