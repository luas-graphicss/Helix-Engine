'use client';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { hexToLinearRgb, linearRgbToCss, linearRgbToHex } from '@/engine/core/color/srgb';
import { PropertyRow } from './property-row';
import { FieldInput } from './field-input';
type ColorFieldProps = {
    label: string;
    value: Vec3;
    onChange?: (linearRgb: Vec3) => void;
};
export function ColorField({ label, value, onChange }: ColorFieldProps) {
    const hex = linearRgbToHex(value);
    const commitHex = (text: string) => onChange?.(hexToLinearRgb(vec3.create(), text));
    return (<PropertyRow label={label}>
      <span className="relative size-6 shrink-0 overflow-hidden rounded-sm border border-border" style={{ backgroundColor: linearRgbToCss(value) }}>
        <input type="color" value={hex} disabled={!onChange} aria-label={`${label} (seletor)`} onChange={(event) => commitHex(event.currentTarget.value)} className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"/>
      </span>
      <FieldInput key={hex} defaultValue={hex.toUpperCase()} readOnly={!onChange} aria-label={`${label} (hexadecimal)`} onBlur={(event) => {
            if (/^#?[0-9a-f]{6}$/i.test(event.currentTarget.value.trim()))
                commitHex(event.currentTarget.value);
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
    </PropertyRow>);
}
