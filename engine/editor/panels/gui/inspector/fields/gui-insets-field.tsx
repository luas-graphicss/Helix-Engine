'use client';
import { useState } from 'react';
import { Link2, Unlink2 } from 'lucide-react';
import type { GuiInsets } from '@/engine/gui/document/gui-document';
import { IconButton } from '@/engine/ui/icon-button';
import { GuiNumberField } from './gui-number-field';
export type Quad = readonly [
    number,
    number,
    number,
    number
];
type QuadSlot = {
    readonly unit: string;
    readonly label: string;
};
type GuiQuadFieldProps = {
    label: string;
    values: Quad;
    slots: readonly [
        QuadSlot,
        QuadSlot,
        QuadSlot,
        QuadSlot
    ];
    min?: number;
    disabled?: boolean;
    onChange: (values: Quad) => void;
    onEnd?: () => void;
};
const SIDE_SLOTS: GuiQuadFieldProps['slots'] = [
    { unit: '↑', label: 'superior' },
    { unit: '→', label: 'direita' },
    { unit: '↓', label: 'inferior' },
    { unit: '←', label: 'esquerda' },
];
export const CORNER_SLOTS: GuiQuadFieldProps['slots'] = [
    { unit: '◜', label: 'superior esquerdo' },
    { unit: '◝', label: 'superior direito' },
    { unit: '◟', label: 'inferior direito' },
    { unit: '◞', label: 'inferior esquerdo' },
];
function allEqual(values: Quad): boolean {
    return values[0] === values[1] && values[1] === values[2] && values[2] === values[3];
}
export function GuiQuadField({ label, values, slots, min = 0, disabled, onChange, onEnd }: GuiQuadFieldProps) {
    const [linked, setLinked] = useState(() => allEqual(values));
    const setSlot = (index: number, next: number) => {
        if (linked)
            onChange([next, next, next, next]);
        else
            onChange(values.map((value, current) => (current === index ? next : value)) as unknown as Quad);
    };
    return (<div className="grid min-h-7 grid-cols-[88px_minmax(0,1fr)] items-start gap-2 px-2 py-0.5">
      <div className="flex h-control min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-2xs text-muted-foreground" title={label}>
          {label}
        </span>
        <IconButton label={linked ? 'Valores ligados: editar separadamente' : 'Valores separados: editar juntos'} size="sm" active={linked} disabled={disabled} onClick={() => setLinked((current) => !current)}>
          {linked ? <Link2 /> : <Unlink2 />}
        </IconButton>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {slots.map((slot, index) => (<GuiNumberField key={slot.label} label={`${label} ${slot.label}`} unit={slot.unit} value={values[index]} min={min} step={1} precision={1} disabled={disabled} onChange={(next) => setSlot(index, next)} onEnd={onEnd}/>))}
      </div>
    </div>);
}
type GuiInsetsFieldProps = {
    label: string;
    value: GuiInsets;
    min?: number;
    disabled?: boolean;
    onChange: (insets: GuiInsets) => void;
    onEnd?: () => void;
};
export function GuiInsetsField({ label, value, min, disabled, onChange, onEnd }: GuiInsetsFieldProps) {
    return (<GuiQuadField label={label} values={[value.top, value.right, value.bottom, value.left]} slots={SIDE_SLOTS} min={min} disabled={disabled} onChange={([top, right, bottom, left]) => onChange({ top, right, bottom, left })} onEnd={onEnd}/>);
}
