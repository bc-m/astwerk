import type { Edge, Node } from '@xyflow/react'
import { lineageIdsOf } from '@/lib/relations'
import type { Person, Union } from '@/types'

export const PERSON_W = 200
export const PERSON_H = 88
const UNION_SIZE = 16

/** Gap between sibling blocks. */
const H_GAP = 36
/** Gap between partners of a couple. */
const COUPLE_GAP = 36
/** Gap between independent subtrees. */
const COMPONENT_GAP = 120
/** Vertical distance between generations (center to center). */
const GEN_V = 216
/** The union dot sits halfway between generations. */
const UNION_OFFSET_Y = 108

/** Distance of the horizontal edge bus from the union. */
const BUS_BASE_GAP = 12
/** Additional offset per collision level. */
const STAGGER_STEP = 10
/** More levels don't safely fit in the rank gap. */
const MAX_LEVEL = 3
/** Safety margin for the overlap test: also separates nearly touching buses. */
const SPAN_PADDING = 40

export type PersonFlowNode = Node<
  { person: Person; selected: boolean; dimmed: boolean },
  'person'
>
export type UnionFlowNode = Node<Record<string, unknown>, 'union'>
export type FlowNode = PersonFlowNode | UnionFlowNode

const DIMMED_OPACITY = 0.18

const PARTNER_EDGE_STYLE = { stroke: 'var(--color-rose-400)', strokeWidth: 1.5 }
const CHILD_EDGE_STYLE = { stroke: 'var(--color-slate-400)', strokeWidth: 1.5 }

interface BusSpan {
  unionId: string
  from: number
  to: number
}

/**
 * Assigns collision levels per rank: buses that overlap horizontally
 * get different levels; all others stay at level 0.
 */
function assignLevels(spans: BusSpan[]): Map<string, number> {
  const sorted = [...spans].sort((a, b) => a.from - b.from)
  const levels = new Map<string, number>()
  const active: { to: number; level: number }[] = []
  for (const span of sorted) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].to + SPAN_PADDING < span.from) active.splice(i, 1)
    }
    const used = new Set(active.map((a) => a.level))
    let level = 0
    while (used.has(level)) level++
    level = Math.min(level, MAX_LEVEL)
    levels.set(span.unionId, level)
    active.push({ to: span.to, level })
  }
  return levels
}

interface PlacedPos {
  x: number
  gen: number
}

/**
 * Custom genealogical layout instead of a generic layered layout:
 * family blocks are packed recursively, so partners always stand
 * directly side by side, parents centered above their children. With
 * multiple marriages the person sits between their partners. If someone
 * marries into the tree whose parents are also recorded, the couple stays
 * together and the parent connection is drawn as a longer edge.
 */
function computePositions(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
): { placed: Map<string, PlacedPos> } {
  const personList = Object.values(persons)
  const unionList = Object.values(unions)

  const unionsByPartner = new Map<string, Union[]>()
  const unionsByChild = new Map<string, Union[]>()
  for (const u of unionList) {
    for (const pid of u.partnerIds) {
      if (!persons[pid]) continue
      const arr = unionsByPartner.get(pid) ?? []
      arr.push(u)
      unionsByPartner.set(pid, arr)
    }
    for (const cid of u.childIds) {
      if (!persons[cid]) continue
      const arr = unionsByChild.get(cid) ?? []
      arr.push(u)
      unionsByChild.set(cid, arr)
    }
  }

  // Phase 1: Determine generations globally (partners equal, children +1),
  // so parents always stand above their children — even when someone
  // marries in at another position in the tree
  const genOf = new Map<string, number>()
  for (const start of personList) {
    if (genOf.has(start.id)) continue
    genOf.set(start.id, 0)
    const component: string[] = [start.id]
    const queue: string[] = [start.id]
    while (queue.length > 0) {
      const id = queue.shift()!
      const g = genOf.get(id)!
      const visit = (other: string, gen: number) => {
        if (!persons[other] || genOf.has(other)) return
        genOf.set(other, gen)
        component.push(other)
        queue.push(other)
      }
      for (const u of unionsByPartner.get(id) ?? []) {
        for (const q of u.partnerIds) visit(q, g)
        for (const c of u.childIds) visit(c, g + 1)
      }
      for (const u of unionsByChild.get(id) ?? []) {
        for (const q of u.partnerIds) visit(q, g - 1)
        for (const c of u.childIds) visit(c, g)
      }
    }
    const min = Math.min(...component.map((id) => genOf.get(id)!))
    if (min !== 0) {
      for (const id of component) genOf.set(id, genOf.get(id)! - min)
    }
  }

  const placed = new Map<string, PlacedPos>()
  const ownedUnions = new Set<string>()

  function layoutBlock(pid: string, left: number): { width: number; ids: string[] } {
    const ids: string[] = []

    // Build marriage chain: partners line up, including across
    // multiple marriages (e.g. [1st wife, husband, 2nd wife])
    const row: string[] = [pid]
    const rowUnions: Union[] = []
    const extend = (direction: 'left' | 'right') => {
      let current = direction === 'right' ? row[row.length - 1] : row[0]
      let guard = 0
      while (guard++ < 12) {
        const nextUnion = (unionsByPartner.get(current) ?? []).find(
          (u) => !ownedUnions.has(u.id),
        )
        if (!nextUnion) break
        ownedUnions.add(nextUnion.id)
        rowUnions.push(nextUnion)
        const other = nextUnion.partnerIds.find((x) => x !== current)
        if (!other || !persons[other] || placed.has(other) || row.includes(other)) break
        if (direction === 'right') row.push(other)
        else row.unshift(other)
        current = other
      }
    }
    extend('right')
    extend('left')

    // Children of all unions in the chain first (determines block width)
    let childCursor = left
    const childIds: string[] = []
    for (const u of rowUnions) {
      for (const cid of u.childIds) {
        if (!persons[cid] || placed.has(cid)) continue
        if (childCursor > left) childCursor += H_GAP
        const res = layoutBlock(cid, childCursor)
        childCursor += res.width
        childIds.push(...res.ids)
      }
    }
    const childrenWidth = Math.max(0, childCursor - left)

    const rowWidth = row.length * PERSON_W + (row.length - 1) * COUPLE_GAP
    const width = Math.max(rowWidth, childrenWidth, PERSON_W)
    const rowLeft = left + (width - rowWidth) / 2
    row.forEach((rp, i) => {
      placed.set(rp, {
        x: rowLeft + i * (PERSON_W + COUPLE_GAP) + PERSON_W / 2,
        gen: genOf.get(rp) ?? 0,
      })
      ids.push(rp)
    })
    if (childrenWidth > 0 && width > childrenWidth) {
      const dx = (width - childrenWidth) / 2
      for (const cid of childIds) {
        const pos = placed.get(cid)!
        placed.set(cid, { ...pos, x: pos.x + dx })
      }
    }
    ids.push(...childIds)
    return { width, ids }
  }

  let cursor = 0
  // Every top-level layoutBlock call produces one independently placed
  // block; the shrinker below moves these as rigid units to remove the
  // dead space that the sequential cursor leaves behind.
  const blocks: string[][] = []
  // 2) Roots: persons without parents, topmost generations first —
  //    this way spouses are "picked up" by their already-placed families
  //    instead of forming their own root
  const roots = personList
    .filter((p) => !unionsByChild.has(p.id))
    .sort((a, b) => (genOf.get(a.id) ?? 0) - (genOf.get(b.id) ?? 0))
  for (const p of roots) {
    if (placed.has(p.id)) continue
    const res = layoutBlock(p.id, cursor)
    cursor += res.width + COMPONENT_GAP
    blocks.push(res.ids)
  }
  // 3) Children of unions whose partners were both placed elsewhere
  for (const u of unionList) {
    for (const cid of u.childIds) {
      if (!persons[cid] || placed.has(cid)) continue
      const res = layoutBlock(cid, cursor)
      cursor += res.width + COMPONENT_GAP
      blocks.push(res.ids)
    }
  }
  // 4) Safety net for everything else
  for (const p of personList) {
    if (placed.has(p.id)) continue
    const res = layoutBlock(p.id, cursor)
    cursor += res.width + COMPONENT_GAP
    blocks.push(res.ids)
  }

  compactBlocks(blocks, placed, unionList)

  return { placed }
}

/** Gap kept between a nestled block and its neighbours on a shared rank. */
const COMPACT_GAP = 40

interface CompactGroup {
  members: Set<string>
  /** Per generation: [min center x, max center x] of the group's persons. */
  gens: Map<number, [number, number]>
  center: number
  /** Desired center x — above the children living outside this group. */
  ideal: number | null
  size: number
}

/**
 * Removes the horizontal dead space that the sequential block placement
 * leaves behind (e.g. in-married ancestors flung far to the side).
 *
 * Each top-level block is a rigid unit — its internal geometry (couples side
 * by side, children centered) is never touched. Blocks joined by a couple are
 * merged so partners never drift apart. The largest group anchors the canvas;
 * every other group is then dropped into the free slot nearest to its ideal
 * position — the average x of the relatives it connects to across the block
 * boundary — searching both left and right on every generation it occupies.
 * The pull is two-way: an in-married parent couple is drawn down toward its
 * child, and a descendant subtree is drawn up toward its parents, so both
 * nestle beside the existing family instead of being pushed off to the side.
 */
function compactBlocks(
  blocks: string[][],
  placed: Map<string, PlacedPos>,
  unionList: Union[],
): void {
  if (blocks.length <= 1) return
  const HALF = PERSON_W / 2

  // Merge blocks that are joined by a couple (a union with both partners
  // placed in different blocks) so they move together and stay adjacent.
  const parent = blocks.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const blockOf = new Map<string, number>()
  blocks.forEach((ids, i) => ids.forEach((id) => blockOf.set(id, i)))
  for (const u of unionList) {
    const bs = u.partnerIds.filter((id) => blockOf.has(id)).map((id) => blockOf.get(id)!)
    for (let k = 1; k < bs.length; k++) parent[find(bs[0])] = find(bs[k])
  }

  const byRoot = new Map<number, string[]>()
  blocks.forEach((ids, i) => {
    const root = find(i)
    const arr = byRoot.get(root) ?? []
    arr.push(...ids)
    byRoot.set(root, arr)
  })

  const groups: CompactGroup[] = []
  const groupOf = new Map<string, number>()
  for (const ids of byRoot.values()) {
    const gi = groups.length
    const gens = new Map<number, [number, number]>()
    let sum = 0
    for (const id of ids) {
      const pos = placed.get(id)!
      sum += pos.x
      const span = gens.get(pos.gen)
      if (span) {
        span[0] = Math.min(span[0], pos.x)
        span[1] = Math.max(span[1], pos.x)
      } else {
        gens.set(pos.gen, [pos.x, pos.x])
      }
      groupOf.set(id, gi)
    }
    groups.push({ members: new Set(ids), gens, center: sum / ids.length, ideal: null, size: ids.length })
  }

  // Ideal position: the average x of everything this group connects to
  // outside itself. A cross-group union pulls in both directions — the parent
  // couple toward its child, and the child's subtree toward its parents — so
  // both in-married ancestors and descendant subtrees close the gap.
  const targets: number[][] = groups.map(() => [])
  for (const u of unionList) {
    const partnerXs = u.partnerIds.map((id) => placed.get(id)?.x).filter((v): v is number => v !== undefined)
    if (partnerXs.length === 0) continue
    const unionX = (Math.min(...partnerXs) + Math.max(...partnerXs)) / 2
    const owners = new Set(u.partnerIds.filter((id) => groupOf.has(id)).map((id) => groupOf.get(id)!))
    const owner = owners.size === 1 ? [...owners][0] : null
    for (const cid of u.childIds) {
      const pos = placed.get(cid)
      const cg = groupOf.get(cid)
      if (pos === undefined || cg === undefined) continue
      if (owner !== null && cg !== owner) {
        targets[owner].push(pos.x) // parents pulled toward their child
        targets[cg].push(unionX) // child's subtree pulled toward its parents
      }
    }
  }
  groups.forEach((g, i) => {
    const xs = targets[i]
    if (xs.length > 0) g.ideal = xs.reduce((a, b) => a + b, 0) / xs.length
  })

  // The largest group anchors the canvas and is placed first. The rest follow
  // top generation first: the upper ranks are sparsely filled, so ancestor
  // couples claim their slot above their child there before the denser lower
  // blocks move in. Larger blocks win ties.
  const minGen = groups.map((g) => Math.min(...g.gens.keys()))
  let anchor = 0
  for (let i = 1; i < groups.length; i++) if (groups[i].size > groups[anchor].size) anchor = i
  const order = groups.map((_, i) => i)
  order.sort((a, b) => {
    if (a === anchor) return -1
    if (b === anchor) return 1
    return minGen[a] - minGen[b] || groups[b].size - groups[a].size
  })
  const occupancy = new Map<number, [number, number][]>()
  const occupy = (g: CompactGroup, shift: number) => {
    for (const [gen, [lo, hi]] of g.gens) {
      const list = occupancy.get(gen) ?? []
      list.push([lo + shift - HALF, hi + shift + HALF])
      occupancy.set(gen, list)
    }
  }

  order.forEach((gi, rank) => {
    const g = groups[gi]
    if (rank === 0) {
      occupy(g, 0) // anchor stays put
      return
    }
    // Desired shift: toward the ideal (above outside children), else stay.
    const wanted = g.ideal === null ? 0 : g.ideal - g.center
    // Collect forbidden shift intervals from every occupied span the group
    // would overlap on any generation it spans.
    const forbidden: [number, number][] = []
    for (const [gen, [lo, hi]] of g.gens) {
      for (const [oLo, oHi] of occupancy.get(gen) ?? []) {
        const a = oLo - COMPACT_GAP - hi - HALF
        const b = oHi + COMPACT_GAP - lo + HALF
        if (a < b) forbidden.push([a, b])
      }
    }
    let shift = wanted
    if (forbidden.length > 0) {
      forbidden.sort((x, y) => x[0] - y[0])
      const merged: [number, number][] = [[...forbidden[0]]]
      for (let i = 1; i < forbidden.length; i++) {
        const last = merged[merged.length - 1]
        if (forbidden[i][0] <= last[1]) last[1] = Math.max(last[1], forbidden[i][1])
        else merged.push([...forbidden[i]])
      }
      const blocker = merged.find(([a, b]) => wanted > a && wanted < b)
      if (blocker) {
        // Snap to whichever free edge of the blocking interval is closer.
        shift = wanted - blocker[0] <= blocker[1] - wanted ? blocker[0] : blocker[1]
      }
    }
    if (shift !== 0) {
      for (const id of g.members) {
        const pos = placed.get(id)!
        placed.set(id, { ...pos, x: pos.x + shift })
      }
    }
    occupy(g, shift)
  })
}

export function buildFlowGraph(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
  selectedPersonId: string | null,
  focusLineageId: string | null = null,
): { nodes: FlowNode[]; edges: Edge[] } {
  // Focus mode: everything outside the lineage is dimmed
  const lineage =
    focusLineageId && persons[focusLineageId] ? lineageIdsOf(unions, focusLineageId) : null

  const unionList = Object.values(unions)
  const { placed } = computePositions(persons, unions)

  // Union dots: centered between partners, at half height to the next generation
  const unionPoint = new Map<string, { x: number; y: number }>()
  for (const u of unionList) {
    const partnerPos = u.partnerIds
      .map((id) => placed.get(id))
      .filter((p): p is PlacedPos => Boolean(p))
    if (partnerPos.length === 0) continue
    const xs = partnerPos.map((p) => p.x)
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    const gen = Math.max(...partnerPos.map((p) => p.gen))
    unionPoint.set(u.id, { x, y: gen * GEN_V + UNION_OFFSET_Y })
  }

  // Determine collision levels for the horizontal buses, grouped per rank
  const partnerSpans = new Map<number, BusSpan[]>()
  const childSpans = new Map<number, BusSpan[]>()
  for (const u of unionList) {
    const point = unionPoint.get(u.id)
    if (!point) continue
    const partnerXs = u.partnerIds
      .filter((id) => placed.has(id))
      .map((id) => placed.get(id)!.x)
    // Childless unions always snap to anchor height and don't need a level
    if (partnerXs.length > 0 && u.childIds.some((id) => persons[id])) {
      const key = Math.round(point.y - UNION_SIZE / 2)
      const list = partnerSpans.get(key) ?? []
      list.push({
        unionId: u.id,
        from: Math.min(point.x, ...partnerXs),
        to: Math.max(point.x, ...partnerXs),
      })
      partnerSpans.set(key, list)
    }
    const childXs = u.childIds.filter((id) => placed.has(id)).map((id) => placed.get(id)!.x)
    if (childXs.length > 0) {
      const key = Math.round(point.y + UNION_SIZE / 2)
      const list = childSpans.get(key) ?? []
      list.push({
        unionId: u.id,
        from: Math.min(point.x, ...childXs),
        to: Math.max(point.x, ...childXs),
      })
      childSpans.set(key, list)
    }
  }
  const partnerLevels = new Map<string, number>()
  for (const spans of partnerSpans.values()) {
    for (const [id, level] of assignLevels(spans)) partnerLevels.set(id, level)
  }
  const childLevels = new Map<string, number>()
  for (const spans of childSpans.values()) {
    for (const [id, level] of assignLevels(spans)) childLevels.set(id, level)
  }

  const nodes: FlowNode[] = []
  for (const p of Object.values(persons)) {
    const pos = placed.get(p.id)
    if (!pos) continue
    nodes.push({
      id: p.id,
      type: 'person',
      position: { x: pos.x - PERSON_W / 2, y: pos.gen * GEN_V - PERSON_H / 2 },
      data: {
        person: p,
        selected: p.id === selectedPersonId,
        dimmed: lineage ? !lineage.has(p.id) : false,
      },
    })
  }

  const edges: Edge[] = []
  for (const u of unionList) {
    const point = unionPoint.get(u.id)
    if (!point) continue
    const hasChildren = u.childIds.some((id) => persons[id])
    // A union belongs to the lineage if it connects lineage members
    const unionActive =
      !lineage ||
      (u.partnerIds.some((id) => lineage.has(id)) &&
        (u.childIds.some((id) => lineage.has(id)) ||
          (focusLineageId !== null && u.partnerIds.includes(focusLineageId))))
    nodes.push({
      id: u.id,
      type: 'union',
      position: { x: point.x - UNION_SIZE / 2, y: point.y - UNION_SIZE / 2 },
      data: { showDot: hasChildren, dimmed: !unionActive },
    })
    // Without a dot the partner line runs directly through the (invisible) anchor point
    const partnerBusY =
      point.y -
      UNION_SIZE / 2 -
      (hasChildren ? BUS_BASE_GAP : 0) -
      (partnerLevels.get(u.id) ?? 0) * STAGGER_STEP
    const childBusY =
      point.y + UNION_SIZE / 2 + BUS_BASE_GAP + (childLevels.get(u.id) ?? 0) * STAGGER_STEP
    for (const pid of u.partnerIds) {
      if (!persons[pid]) continue
      const active = unionActive && (!lineage || lineage.has(pid))
      edges.push({
        id: `${u.id}:p:${pid}`,
        source: pid,
        target: u.id,
        type: 'elbow',
        data: hasChildren ? { midY: partnerBusY } : { snapToTarget: true },
        style: active ? PARTNER_EDGE_STYLE : { ...PARTNER_EDGE_STYLE, opacity: DIMMED_OPACITY },
      })
    }
    for (const cid of u.childIds) {
      if (!persons[cid]) continue
      const active = unionActive && (!lineage || lineage.has(cid))
      edges.push({
        id: `${u.id}:c:${cid}`,
        source: u.id,
        target: cid,
        type: 'elbow',
        data: { midY: childBusY },
        style: active ? CHILD_EDGE_STYLE : { ...CHILD_EDGE_STYLE, opacity: DIMMED_OPACITY },
      })
    }
  }

  return { nodes, edges }
}
