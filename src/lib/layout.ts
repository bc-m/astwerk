import type {Edge, Node} from '@xyflow/react'
import {lineageIdsOf} from '@/lib/relations'
import type {Person, Union} from '@/types'

export const PERSON_W = 200
export const PERSON_H = 88
const UNION_SIZE = 16

/** Gap between sibling blocks. */
const H_GAP = 36
/** Gap between partners of a couple. */
const COUPLE_GAP = 8
/** Gap between independent subtrees. */
const COMPONENT_GAP = 120
/** Width a fully empty vertical strip is trimmed to when collapsing it. */
const DEAD_COLUMN_GAP = 120
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

const PARTNER_EDGE_STYLE = {stroke: 'var(--color-rose-400)', strokeWidth: 1.5}
const CHILD_EDGE_STYLE = {stroke: 'var(--color-slate-400)', strokeWidth: 1.5}

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
    active.push({to: span.to, level})
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

    // Lay out each child subtree, then pack them with contour nesting: a
    // narrow branch slides into the empty space above or below a wider
    // neighbour instead of reserving its full width at every generation.
    // Only the generations two subtrees share can collide, so the block stays
    // no wider than it has to be while parents remain centered over children.
    const HALF = PERSON_W / 2
    const childIds: string[] = []
    const rightContour = new Map<number, number>() // rightmost occupied edge per gen
    let packedLeft = Infinity
    let packedRight = -Infinity
    for (const u of rowUnions) {
      for (const cid of u.childIds) {
        if (!persons[cid] || placed.has(cid)) continue
        const res = layoutBlock(cid, 0)
        const minAt = new Map<number, number>()
        const maxAt = new Map<number, number>()
        for (const id of res.ids) {
          const p = placed.get(id)!
          minAt.set(p.gen, Math.min(minAt.get(p.gen) ?? Infinity, p.x))
          maxAt.set(p.gen, Math.max(maxAt.get(p.gen) ?? -Infinity, p.x))
        }
        // Smallest rightward shift that clears the accumulated right contour
        // by H_GAP on every generation this subtree occupies.
        let shift = -Infinity
        for (const [gen, mn] of minAt) {
          const edge = rightContour.get(gen)
          if (edge !== undefined) shift = Math.max(shift, edge + H_GAP - (mn - HALF))
        }
        if (shift === -Infinity) shift = 0
        for (const id of res.ids) {
          const p = placed.get(id)!
          placed.set(id, {...p, x: p.x + shift})
        }
        for (const [gen, mx] of maxAt) {
          const edge = mx + shift + HALF
          rightContour.set(gen, Math.max(rightContour.get(gen) ?? -Infinity, edge))
          packedRight = Math.max(packedRight, edge)
        }
        for (const mn of minAt.values()) packedLeft = Math.min(packedLeft, mn + shift - HALF)
        childIds.push(...res.ids)
      }
    }
    // Normalise so the packed children block starts at `left`.
    if (childIds.length > 0 && packedLeft !== left) {
      const dx = left - packedLeft
      for (const id of childIds) {
        const p = placed.get(id)!
        placed.set(id, {...p, x: p.x + dx})
      }
    }
    const childrenWidth = childIds.length > 0 ? packedRight - packedLeft : 0

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
        placed.set(cid, {...pos, x: pos.x + dx})
      }
    }
    ids.push(...childIds)
    return {width, ids}
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
  centerInmarriedParents(persons, placed, unionList, unionsByChild, genOf)
  removeDeadColumns(placed)

  return {placed}
}

/**
 * Pool-adjacent-violators: the nearest non-decreasing sequence to `a`
 * (least-squares). Used to resolve minimum-gap constraints between blocks.
 */
function isotonic(a: number[]): number[] {
  const blocks: { sum: number; count: number; val: number }[] = []
  for (const x of a) {
    const b = {sum: x, count: 1, val: x}
    while (blocks.length > 0 && blocks[blocks.length - 1].val > b.val) {
      const prev = blocks.pop()!
      b.sum += prev.sum
      b.count += prev.count
      b.val = b.sum / b.count
    }
    blocks.push(b)
  }
  const out: number[] = []
  for (const b of blocks) for (let k = 0; k < b.count; k++) out.push(b.val)
  return out
}

/**
 * Centres competing in-married parent couples over their shared child couple.
 *
 * When both partners of a couple married in with recorded parents, only one
 * parent couple can sit directly above the pair — the packer shoves the other
 * off to the side, so the parent row leans one way (see the Helms/Harms case).
 * This pass detects couples with a parent couple on *both* sides and spreads
 * those parent couples symmetrically over the child pair, each centred over the
 * child it belongs to. A lone parent couple (only one side has parents) is left
 * as the packer placed it — centred over the couple already.
 *
 * Only parent couples whose members have no recorded parents of their own are
 * moved (nothing has to be dragged along above them), and only when the shift
 * leaves them clear of every other box on their generation — otherwise they
 * stay put ("when there's space").
 */
function centerInmarriedParents(
  persons: Record<string, Person>,
  placed: Map<string, PlacedPos>,
  unionList: Union[],
  unionsByChild: Map<string, Union[]>,
  genOf: Map<string, number>,
): void {
  const HALF = PERSON_W / 2
  const hasParents = (id: string) => (unionsByChild.get(id)?.length ?? 0) > 0
  const rootIds = [...placed.keys()].filter((id) => persons[id] && !hasParents(id))
  const rootSet = new Set(rootIds)

  // Union-find over root persons joined by a shared union (their marriage
  // chain), so each couple / multi-marriage row moves as one rigid unit.
  const uf = new Map(rootIds.map((id) => [id, id]))
  const find = (x: string): string => {
    while (uf.get(x) !== x) {
      uf.set(x, uf.get(uf.get(x)!)!)
      x = uf.get(x)!
    }
    return x
  }
  for (const u of unionList) {
    const rp = u.partnerIds.filter((id) => rootSet.has(id))
    for (let i = 1; i < rp.length; i++) uf.set(find(rp[0]), find(rp[i]))
  }

  // The root-group holding a person's (root) parents, or null.
  const parentGroupOf = (id: string): string | null => {
    for (const u of unionsByChild.get(id) ?? []) {
      const rp = u.partnerIds.find((pid) => rootSet.has(pid))
      if (rp) return find(rp)
    }
    return null
  }
  // A parent group only participates when it competes for the space above a
  // child couple with another parent group on the couple's other side. Each
  // group is centred over the specific child it connects to in that couple
  // (not the average of all its children — a child elsewhere must not pull it).
  const targetChildren = new Map<string, Set<string>>()
  for (const u of unionList) {
    const partners = u.partnerIds.filter((id) => persons[id])
    if (partners.length < 2) continue
    const groups = partners.map((id) => [id, parentGroupOf(id)] as const)
    const roots = new Set(groups.map(([, g]) => g).filter((g): g is string => !!g))
    if (roots.size < 2) continue
    for (const [child, g] of groups) {
      if (!g) continue
      const set = targetChildren.get(g) ?? new Set<string>()
      set.add(child)
      targetChildren.set(g, set)
    }
  }
  if (targetChildren.size === 0) return

  const groupMembers = new Map<string, string[]>()
  for (const id of rootIds) {
    const r = find(id)
    if (!targetChildren.has(r)) continue
    const arr = groupMembers.get(r) ?? []
    arr.push(id)
    groupMembers.set(r, arr)
  }

  interface Group {
    members: string[]
    center: number
    half: number
    desired: number
  }

  const byGen = new Map<number, Group[]>()
  for (const [root, members] of groupMembers) {
    const xs = members.map((id) => placed.get(id)!.x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const childXs = [...targetChildren.get(root)!].map((id) => placed.get(id)!.x)
    const desired = (Math.min(...childXs) + Math.max(...childXs)) / 2
    const gen = genOf.get(members[0]) ?? 0
    const arr = byGen.get(gen) ?? []
    arr.push({members, center: (minX + maxX) / 2, half: (maxX - minX) / 2 + HALF, desired})
    byGen.set(gen, arr)
  }

  for (const [gen, groups] of byGen) {
    if (groups.every((g) => Math.abs(g.desired - g.center) < 1)) continue
    groups.sort((a, b) => a.desired - b.desired)
    const n = groups.length
    // Convert the min-gap constraints into a plain monotonicity constraint by
    // subtracting the cumulative required separation, then project.
    const sep = new Array(n).fill(0)
    for (let i = 1; i < n; i++)
      sep[i] = sep[i - 1] + groups[i - 1].half + COMPACT_GAP + groups[i].half
    const q = isotonic(groups.map((g, i) => g.desired - sep[i]))
    const shifts = groups.map((g, i) => q[i] + sep[i] - g.center)

    // "When there's space": only apply if no moved couple ends up overlapping
    // another box on this generation.
    const groupIds = new Set(groups.flatMap((g) => g.members))
    const others = [...placed.entries()].filter(
      ([id]) => persons[id] && genOf.get(id) === gen && !groupIds.has(id),
    )
    const clear = groups.every((g, i) => {
      const c = g.center + shifts[i]
      const lo = c - g.half
      const hi = c + g.half
      return others.every(([, p]) => hi + COMPACT_GAP <= p.x - HALF || p.x + HALF <= lo - COMPACT_GAP)
    })
    if (!clear) continue

    groups.forEach((g, i) => {
      if (Math.abs(shifts[i]) < 0.5) return
      for (const id of g.members) {
        const p = placed.get(id)!
        placed.set(id, {...p, x: p.x + shifts[i]})
      }
    })
  }
}

/**
 * Collapses vertical strips of the canvas that hold no box on any generation.
 * Such a column is only crossed by horizontal edges, so everything to its
 * right can slide left with no risk of overlap — this closes the wide empty
 * bands that appear between loosely connected branches. Each remaining gap
 * between clusters is trimmed to DEAD_COLUMN_GAP.
 */
function removeDeadColumns(placed: Map<string, PlacedPos>): void {
  if (placed.size === 0) return
  const HALF = PERSON_W / 2
  const boxes = [...placed.values()].map((p) => [p.x - HALF, p.x + HALF] as [number, number])
  boxes.sort((a, b) => a[0] - b[0])
  // Merge the occupied x-intervals across all generations.
  const merged: [number, number][] = [[...boxes[0]]]
  for (const [lo, hi] of boxes.slice(1)) {
    const last = merged[merged.length - 1]
    if (lo <= last[1] + 0.5) last[1] = Math.max(last[1], hi)
    else merged.push([lo, hi])
  }
  // Each gap wider than the target becomes a leftward shift for everything
  // beyond it.
  const cuts: { pos: number; amount: number }[] = []
  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i][0] - merged[i - 1][1]
    if (gap > DEAD_COLUMN_GAP + 0.5) cuts.push({pos: merged[i][0], amount: gap - DEAD_COLUMN_GAP})
  }
  if (cuts.length === 0) return
  for (const [id, p] of placed) {
    let shift = 0
    for (const c of cuts) if (c.pos <= p.x - HALF + 0.5) shift += c.amount
    if (shift !== 0) placed.set(id, {...p, x: p.x - shift})
  }
}

/**
 * Gap kept between a nestled block and its neighbours on a shared rank.
 * Roughly one box wide so separate couples read as visually distinct.
 */
const COMPACT_GAP = 32

interface CompactGroup {
  members: Set<string>
  /** Per generation: [min center x, max center x] of the group's persons. */
  gens: Map<number, [number, number]>
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
    for (const id of ids) {
      const pos = placed.get(id)!
      const span = gens.get(pos.gen)
      if (span) {
        span[0] = Math.min(span[0], pos.x)
        span[1] = Math.max(span[1], pos.x)
      } else {
        gens.set(pos.gen, [pos.x, pos.x])
      }
      groupOf.set(id, gi)
    }
    groups.push({members: new Set(ids), gens, size: ids.length})
  }

  // For each group, the persons it connects to outside itself. A cross-group
  // union pulls both ways: the parent couple toward its child, and the child's
  // subtree toward its parents. Positions are read live while packing (below),
  // so a couple still finds its child after that child's block has moved.
  const targetIds: string[][] = groups.map(() => [])
  for (const u of unionList) {
    const owners = new Set(u.partnerIds.filter((id) => groupOf.has(id)).map((id) => groupOf.get(id)!))
    const owner = owners.size === 1 ? [...owners][0] : null
    if (owner === null) continue
    for (const cid of u.childIds) {
      const cg = groupOf.get(cid)
      if (cg === undefined || cg === owner) continue
      targetIds[owner].push(cid)
      for (const pid of u.partnerIds) if (groupOf.get(pid) === owner) targetIds[cg].push(pid)
    }
  }

  // The largest group anchors the canvas and never moves.
  let anchor = 0
  for (let i = 1; i < groups.length; i++) if (groups[i].size > groups[anchor].size) anchor = i

  const memberList = groups.map((g) => [...g.members])
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length
  // Live geometry (centre and per-generation span) from current positions.
  const geomOf = (gi: number) => {
    const gens = new Map<number, [number, number]>()
    let sum = 0
    for (const id of memberList[gi]) {
      const p = placed.get(id)!
      sum += p.x
      const span = gens.get(p.gen)
      if (span) {
        span[0] = Math.min(span[0], p.x)
        span[1] = Math.max(span[1], p.x)
      } else gens.set(p.gen, [p.x, p.x])
    }
    return {center: sum / memberList[gi].length, gens}
  }

  // Barycentre of a group's cross-block connections (live positions).
  const baryOf = (gi: number): number => {
    const xs = targetIds[gi]
      .map((id) => placed.get(id)?.x)
      .filter((v): v is number => v !== undefined)
    return xs.length ? avg(xs) : geomOf(gi).center
  }

  // A few passes let a couple settle next to its child even when that child
  // only reached its final spot in an earlier pass (targets are re-read live).
  for (let pass = 0; pass < 3; pass++) {
    const occupancy = new Map<number, [number, number][]>()
    const occupy = (gens: Map<number, [number, number]>, shift: number) => {
      for (const [gen, [lo, hi]] of gens) {
        const list = occupancy.get(gen) ?? []
        list.push([lo + shift - HALF, hi + shift + HALF])
        occupancy.set(gen, list)
      }
    }
    // Place the anchor first, then the rest left-to-right in the order their
    // relatives sit (by connection barycentre). Sorting by barycentre — rather
    // than keeping the initial left-right order — lets two blocks swap sides so
    // their connection lines no longer cross.
    const passOrder = groups
      .map((_, i) => i)
      .sort((a, b) => (a === anchor ? -1 : b === anchor ? 1 : baryOf(a) - baryOf(b)))
    for (const [rank, gi] of passOrder.entries()) {
      const {center, gens} = geomOf(gi)
      if (rank === 0) {
        occupy(gens, 0) // anchor stays put
        continue
      }
      const xs = targetIds[gi]
        .map((id) => placed.get(id)?.x)
        .filter((v): v is number => v !== undefined)
      const wanted = xs.length ? avg(xs) - center : 0
      // Forbidden shift intervals: any shift that would overlap an occupied
      // span on a generation this group spans.
      const forbidden: [number, number][] = []
      for (const [gen, [lo, hi]] of gens) {
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
        if (blocker) shift = wanted - blocker[0] <= blocker[1] - wanted ? blocker[0] : blocker[1]
      }
      if (shift !== 0)
        for (const id of memberList[gi]) {
          const p = placed.get(id)!
          placed.set(id, {...p, x: p.x + shift})
        }
      occupy(gens, shift)
    }
  }
}

/**
 * Ancestor chart layout: the focus person sits at the bottom centre and the
 * tree fans upward — narrow at the bottom, wider toward the older generations.
 * Each couple is kept tight (partners side by side) and centred over their
 * child; when their own ancestry is wide, the parents' fans are spread into
 * separate slots above and reached by horizontal bus lanes rather than pulling
 * the couple apart. `persons` is expected to already be reduced to the focus
 * person and their ancestors.
 */
function computeAncestorPositions(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
  rootId: string,
): { placed: Map<string, PlacedPos> } {
  const placed = new Map<string, PlacedPos>()
  const unionList = Object.values(unions)
  const parentsOf = (id: string) => {
    const pu = unionList.find((u) => u.childIds.includes(id) && u.partnerIds.some((p) => persons[p]))
    return pu ? pu.partnerIds.filter((p) => persons[p]) : []
  }

  // Width a person's ancestor fan needs: the wider of their parents' tight
  // couple and the sum of the parents' own fans. Memoised, cycle-guarded.
  const fanCache = new Map<string, number>()
  const computing = new Set<string>()
  const fanWidth = (id: string): number => {
    const cached = fanCache.get(id)
    if (cached !== undefined) return cached
    if (computing.has(id)) return PERSON_W
    computing.add(id)
    const parents = parentsOf(id)
    let width = PERSON_W
    if (parents.length > 0) {
      const coupleW = parents.length * PERSON_W + (parents.length - 1) * COUPLE_GAP
      const fansW =
        parents.reduce((s, p) => s + fanWidth(p), 0) + (parents.length - 1) * H_GAP
      width = Math.max(coupleW, fansW)
    }
    computing.delete(id)
    fanCache.set(id, width)
    return width
  }

  const placed_ = new Set<string>()
  const place = (id: string, boxX: number, regionCenter: number, depth: number) => {
    if (placed_.has(id)) return // pedigree collapse / cycle guard
    placed_.add(id)
    placed.set(id, {x: boxX, gen: -depth})
    const parents = parentsOf(id).filter((p) => !placed_.has(p))
    if (parents.length === 0) return
    const coupleW = parents.length * PERSON_W + (parents.length - 1) * COUPLE_GAP
    const fans = parents.map(fanWidth)
    const fansW = fans.reduce((s, w) => s + w, 0) + (parents.length - 1) * H_GAP
    const coupleLeft = regionCenter - coupleW / 2 // couple stays tight, centred on the child
    let fanCur = regionCenter - fansW / 2 // fans spread symmetrically above
    parents.forEach((p, i) => {
      const px = coupleLeft + i * (PERSON_W + COUPLE_GAP) + PERSON_W / 2
      const slotCenter = fanCur + fans[i] / 2
      fanCur += fans[i] + H_GAP
      place(p, px, slotCenter, depth + 1)
    })
  }
  if (persons[rootId]) place(rootId, 0, 0, 0)
  return {placed}
}

export function buildFlowGraph(
  persons: Record<string, Person>,
  unions: Record<string, Union>,
  selectedPersonId: string | null,
  focusLineageId: string | null = null,
  ancestorRootId: string | null = null,
): { nodes: FlowNode[]; edges: Edge[] } {
  // Focus mode: everything outside the lineage is dimmed
  const lineage =
    focusLineageId && persons[focusLineageId] ? lineageIdsOf(unions, focusLineageId) : null

  const unionList = Object.values(unions)
  const {placed} =
    ancestorRootId && persons[ancestorRootId]
      ? computeAncestorPositions(persons, unions, ancestorRootId)
      : computePositions(persons, unions)

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
    unionPoint.set(u.id, {x, y: gen * GEN_V + UNION_OFFSET_Y})
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
      position: {x: pos.x - PERSON_W / 2, y: pos.gen * GEN_V - PERSON_H / 2},
      width: PERSON_W,
      height: PERSON_H,
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
      position: {x: point.x - UNION_SIZE / 2, y: point.y - UNION_SIZE / 2},
      width: UNION_SIZE,
      height: UNION_SIZE,
      data: {showDot: hasChildren, dimmed: !unionActive},
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
        data: hasChildren ? {midY: partnerBusY} : {snapToTarget: true},
        style: active ? PARTNER_EDGE_STYLE : {...PARTNER_EDGE_STYLE, opacity: DIMMED_OPACITY},
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
        data: {midY: childBusY},
        style: active ? CHILD_EDGE_STYLE : {...CHILD_EDGE_STYLE, opacity: DIMMED_OPACITY},
      })
    }
  }

  return {nodes, edges}
}
