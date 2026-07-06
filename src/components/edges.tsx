import { createContext, useContext } from 'react'
import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react'
import { PERSON_W } from '@/lib/layout'

/**
 * Lets an edge open the "go to" menu on click. Provided by the canvas; the
 * edge renders a wide transparent hit path so the thin line is easy to hit,
 * independent of React Flow's selection settings.
 */
export const EdgeMenuContext = createContext<
  ((unionId: string, x: number, y: number) => void) | null
>(null)

/** Orthogonal path with rounded corners through the given points. */
function roundedOrthPath(pts: Array<[number, number]>, radius = 6): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const r1 = Math.min(radius, Math.hypot(x1 - x0, y1 - y0) / 2)
    const r2 = Math.min(radius, Math.hypot(x2 - x1, y2 - y1) / 2)
    const ax = x1 - Math.sign(x1 - x0) * r1
    const ay = y1 - Math.sign(y1 - y0) * r1
    const bx = x1 + Math.sign(x2 - x1) * r2
    const by = y1 + Math.sign(y2 - y1) * r2
    d += ` L ${ax} ${ay} Q ${x1} ${y1} ${bx} ${by}`
  }
  const [lx, ly] = pts[pts.length - 1]
  d += ` L ${lx} ${ly}`
  return d
}

/**
 * Step edge with a per-union fixed height for the horizontal segment
 * (data.midY). This gives each family its own "bus" so that lines of
 * different families on the same rank no longer merge into one
 * continuous line.
 */
export function ElbowEdge({ id, sourceX, sourceY, targetX, targetY, style, data }: EdgeProps) {
  const openMenu = useContext(EdgeMenuContext)
  const midY = data?.snapToTarget
    ? targetY
    : typeof data?.midY === 'number'
      ? data.midY
      : undefined

  let path: string
  let edgeStyle = style
  // Cross-generation edges (target not clearly below source, e.g. when
  // parents and partner are at different positions in the tree): angular
  // bypass route, dashed to mark it as a cross connection. The step
  // routing would otherwise run directly along the card edge.
  if (targetY < sourceY + 24) {
    const side = Math.sign(sourceX - targetX) || 1
    // Vertical channel in the gap next to the target card
    const channelX = targetX + side * (PERSON_W / 2 + 24)
    const firstY = typeof midY === 'number' && midY > sourceY + 4 ? midY : sourceY + 16
    const lastY = targetY - 16
    path = roundedOrthPath([
      [sourceX, sourceY],
      [sourceX, firstY],
      [channelX, firstY],
      [channelX, lastY],
      [targetX, lastY],
      [targetX, targetY],
    ])
    edgeStyle = { ...style, strokeDasharray: '6 4' }
  } else {
    // For childless unions the line runs exactly through the anchor point,
    // so no offset or stub is created
    ;[path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition: Position.Bottom,
      targetX,
      targetY,
      targetPosition: Position.Top,
      borderRadius: 6,
      centerY: midY,
      // No minimum distance before source/target, otherwise zigzag tails appear
      // when the bus is closer to the target than 20px
      offset: 0,
    })
  }

  const unionId = id.split(':')[0]
  return (
    <>
      <BaseEdge id={id} path={path} style={edgeStyle} />
      {openMenu && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={22}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onClick={(e) => {
            e.stopPropagation()
            openMenu(unionId, e.clientX, e.clientY)
          }}
        />
      )}
    </>
  )
}
