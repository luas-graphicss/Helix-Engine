'use client';
import type { UDim } from '@/engine/gui/document/gui-document';
import { PropertyRow } from '@/engine/ui/property-row';
import { GuiNumberField } from './gui-number-field';
type GuiUDimFieldProps = {
    label: string;
    axis: 'x' | 'y';
    value: UDim;
    disabled?: boolean;
    onChange: (part: keyof UDim, value: number) => void;
    onEnd?: () => void;
};
export function GuiUDimField({ label, axis, value, disabled, onChange, onEnd }: GuiUDimFieldProps) {
    return (<PropertyRow label={label}>
      <GuiNumberField label={`${label} proporcional`} axis={axis} unit="%" value={value.scale * 100} step={1} precision={2} disabled={disabled} onChange={(percent) => onChange('scale', percent / 100)} onEnd={onEnd}/>
      <GuiNumberField label={`${label} em pixels`} unit="px" value={value.offset} step={1} precision={1} disabled={disabled} onChange={(offset) => onChange('offset', offset)} onEnd={onEnd}/>
    </PropertyRow>);
}
