import { Handle, Position, type NodeProps } from '@xyflow/react'
import { COUNTRY_BY_CODE, type Gender } from '@/types'
import type { PersonFlowNode, UnionFlowNode } from '@/lib/layout'
import { ageOf, birthNameLabel, displayName, lifespanLabel } from '@/lib/person'
import { cn } from '@/lib/utils'

const GENDER_ACCENT: Record<Gender, string> = {
  m: 'border-l-sky-500',
  f: 'border-l-rose-500',
  d: 'border-l-violet-500',
  u: 'border-l-slate-400',
}

const hiddenHandle = { opacity: 0, width: 4, height: 4, minWidth: 0, minHeight: 0 }

export function PersonNode({ data }: NodeProps<PersonFlowNode>) {
  const { person, selected, dimmed } = data
  const dates = lifespanLabel(person)
  const birthName = birthNameLabel(person)
  const age = ageOf(person)
  const country = person.country ? COUNTRY_BY_CODE[person.country] : undefined
  return (
    <div
      data-dimmed={dimmed || undefined}
      className={cn(
        'relative flex h-[88px] w-[200px] cursor-pointer items-center gap-2.5 rounded-lg border border-l-4 bg-card px-3 shadow-sm transition-opacity transition-shadow hover:shadow-md',
        GENDER_ACCENT[person.gender],
        selected && 'ring-2 ring-ring',
        dimmed && 'opacity-20',
      )}
    >
      {country && (
        <span
          className="pointer-events-none absolute top-1.5 right-2 text-sm leading-none"
          title={country.label}
        >
          {country.flag}
        </span>
      )}
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      {person.photo && (
        <img
          src={person.photo}
          alt=""
          className="size-11 shrink-0 rounded-full object-cover"
          draggable={false}
        />
      )}
      <div className="flex min-w-0 flex-col justify-center">
        <div className="truncate text-sm font-semibold">{displayName(person)}</div>
        {birthName && (
          <div className="truncate text-xs text-muted-foreground italic">{birthName}</div>
        )}
        {(dates || age !== null) && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {dates}
            {dates && age !== null ? ' · ' : ''}
            {age !== null ? `${age} J.` : ''}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
    </div>
  )
}

export function UnionNode({ data }: NodeProps<UnionFlowNode>) {
  // Without children no "dot" — the node remains as an invisible
  // anchor point for the partner line
  const showDot = data.showDot === true
  return (
    <div
      className={cn(
        'size-4 rounded-full',
        showDot && 'border-2 border-rose-400 bg-background',
        data.dimmed === true && 'opacity-20',
      )}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
    </div>
  )
}
