'use client';
import { useId, type KeyboardEvent } from 'react';
import { formatNumber, parseNumber, ScalarField, Vector3Input, type Axis } from '@/engine/editor/panels/inspector/number-fields';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { FOCUS_RING_CLASS, WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import type { GuiNumberNode, GuiSelectNode, GuiTextNode, GuiVector, GuiVectorNode } from '../../gui/gui-node';
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.key !== 'Enter')
        return;
    event.preventDefault();
    event.currentTarget.blur();
}
function withAxis(vector: GuiVector, axis: Axis, value: number): GuiVector {
    const next: [number, number, number] = [vector[0], vector[1], vector[2]];
    next[axis] = value;
    return next;
}
export function GuiNumberField({ node, onChange }: {
    node: GuiNumberNode;
    onChange: (value: number) => void;
}) {
    const shown = parseNumber(formatNumber(node.value));
    return (<PropertyRow label={node.label}>
      {node.disabled ? (<FieldInput readOnly value={formatNumber(node.value)} aria-label={node.label}/>) : (<ScalarField label={node.label} value={node.value} onCommit={(value) => {
                if (Number.isFinite(value) && value !== shown)
                    onChange(value);
            }}/>)}
    </PropertyRow>);
}
export function GuiTextField({ node, onChange }: {
    node: GuiTextNode;
    onChange: (value: string) => void;
}) {
    const id = useId();
    const commit = (text: string) => {
        if (text !== node.value)
            onChange(text);
    };
    if (!node.multiline)
        return (<PropertyRow label={node.label}>
          <FieldInput key={node.value} defaultValue={node.value} placeholder={node.placeholder} disabled={node.disabled} aria-label={node.label} onBlur={(event) => commit(event.currentTarget.value)} onKeyDown={blurOnEnter}/>
        </PropertyRow>);
    return (<div className="flex flex-col gap-1 px-2 py-1">
      <label htmlFor={id} className="text-2xs text-muted-foreground">
        {node.label}
      </label>
      <textarea id={id} key={node.value} defaultValue={node.value} placeholder={node.placeholder} disabled={node.disabled} rows={4} onBlur={(event) => commit(event.currentTarget.value)} className={cn('min-h-16 resize-y rounded-sm px-1.5 py-1 font-mono text-2xs leading-relaxed text-foreground outline-none disabled:opacity-50', WELL_CLASS, FOCUS_RING_CLASS)}/>
    </div>);
}
export function GuiSelectField({ node, onChange }: {
    node: GuiSelectNode;
    onChange: (value: string) => void;
}) {
    return (<PropertyRow label={node.label}>
      <SelectField label={node.label} options={node.options} value={node.value} disabled={node.disabled} onChange={onChange}/>
    </PropertyRow>);
}
export function GuiVectorField({ node, onChange }: {
    node: GuiVectorNode;
    onChange: (value: GuiVector) => void;
}) {
    return (<PropertyRow label={node.label}>
      {node.disabled ? (<FieldInput readOnly value={node.value.map((component) => formatNumber(component)).join(' · ')} aria-label={node.label}/>) : (<Vector3Input label={node.label} values={node.value} onCommit={(axis, value) => onChange(withAxis(node.value, axis, value))}/>)}
    </PropertyRow>);
}
