'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, CopyPlus, FlipHorizontal2 } from 'lucide-react';
import { PropertyRow } from '@/engine/ui/property-row';
import { IconButton } from '@/engine/ui/icon-button';
import { FieldInput } from '@/engine/ui/field-input';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import type { Entity } from '@/engine/core/scene/entity';
import { brushesOf } from '@/engine/geometry/csg/csg-roles';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { MAX_BRUSH_REPEAT, mirrorBrush, moveBrush, repeatBrush } from '@/engine/editor/operations/csg-operations';
import { AXIS_LABEL, brushExtentAlong, type Axis } from '@/engine/editor/csg/brush-placement';
import { formatNumber, parseNumber } from '../number-fields';
const AXIS_OPTIONS: ReadonlyArray<{
    value: Axis;
    label: string;
}> = [
    { value: 0, label: 'X' },
    { value: 1, label: 'Y' },
    { value: 2, label: 'Z' },
];
function OrderRow({ brush, target }: {
    brush: Entity;
    target: Entity;
}) {
    const session = useEditorState();
    const brushes = brushesOf(target);
    const index = brushes.indexOf(brush);
    return (<PropertyRow label="Ordem">
      <FieldInput readOnly value={`${index + 1} de ${brushes.length}`} aria-label="Posição na ordem das operações"/>
      <IconButton label="Aplicar antes" size="sm" className="size-5 [&_svg]:size-3" disabled={index <= 0} onClick={() => moveBrush(session, brush, -1)}>
        <ChevronUp />
      </IconButton>
      <IconButton label="Aplicar depois" size="sm" className="size-5 [&_svg]:size-3" disabled={index >= brushes.length - 1} onClick={() => moveBrush(session, brush, 1)}>
        <ChevronDown />
      </IconButton>
    </PropertyRow>);
}
function MirrorRow({ brush }: {
    brush: Entity;
}) {
    const session = useEditorState();
    return (<PropertyRow label="Espelhar">
      <div className="flex flex-1 items-center gap-1">
        {AXIS_OPTIONS.map(({ value, label }) => (<button key={label} type="button" title={`Cópia espelhada pelo plano do alvo perpendicular a ${label}`} onClick={() => mirrorBrush(session, brush, value)} className="flex h-6 flex-1 items-center justify-center gap-1 rounded-sm border border-border font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-highlight hover:text-foreground">
            <FlipHorizontal2 className="size-3" aria-hidden/>
            {label}
          </button>))}
      </div>
    </PropertyRow>);
}
function RepeatRows({ brush }: {
    brush: Entity;
}) {
    const session = useEditorState();
    const [count, setCount] = useState(2);
    const [axis, setAxis] = useState<Axis>(0);
    const [spacing, setSpacing] = useState<number | null>(null);
    const effectiveSpacing = spacing ?? brushExtentAlong(brush, axis) * 2;
    return (<>
      <PropertyRow label="Repetir">
        <SegmentedControl label="Eixo da repetição" options={AXIS_OPTIONS} value={axis} onChange={setAxis}/>
      </PropertyRow>
      <PropertyRow label="Cópias · passo">
        <FieldInput key={`count-${count}`} defaultValue={String(count)} aria-label="Número de cópias" title={`Até ${MAX_BRUSH_REPEAT} cópias`} onBlur={(event) => {
            const value = Math.round(parseNumber(event.currentTarget.value));
            if (Number.isFinite(value))
                setCount(Math.min(Math.max(value, 1), MAX_BRUSH_REPEAT));
        }} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}/>
        <FieldInput key={`spacing-${effectiveSpacing}`} defaultValue={`${formatNumber(effectiveSpacing)} m`} aria-label={`Espaçamento em ${AXIS_LABEL[axis]}`} onBlur={(event) => {
            const value = parseNumber(event.currentTarget.value);
            setSpacing(Number.isFinite(value) && value > 0 ? value : null);
        }} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}/>
        <IconButton label={`Criar ${count} cópias em ${AXIS_LABEL[axis]}`} size="sm" className="size-5 [&_svg]:size-3" onClick={() => repeatBrush(session, brush, { count, axis, spacing: effectiveSpacing })}>
          <CopyPlus />
        </IconButton>
      </PropertyRow>
    </>);
}
export function BrushTools({ brush, target }: {
    brush: Entity;
    target: Entity;
}) {
    return (<>
      <OrderRow brush={brush} target={target}/>
      <MirrorRow brush={brush}/>
      <RepeatRows brush={brush}/>
    </>);
}
