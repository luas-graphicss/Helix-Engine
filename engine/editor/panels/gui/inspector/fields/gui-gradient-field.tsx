'use client';
import { Plus, X } from 'lucide-react';
import type { GuiGradient, GuiGradientStop } from '@/engine/gui/document/gui-document';
import { ActionButton } from '@/engine/ui/action-button';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToggleField } from '@/engine/ui/toggle-field';
import { GuiColorField } from './gui-color-field';
import { GuiNumberField } from './gui-number-field';
type GuiGradientFieldProps = {
    label?: string;
    value: GuiGradient | null;
    baseColor: string;
    disabled?: boolean;
    onChange: (gradient: GuiGradient | null) => void;
    onEnd?: () => void;
};
const KIND_OPTIONS = [
    { value: 'linear', label: 'Linear' },
    { value: 'radial', label: 'Radial' },
] as const;
function hexWithAlpha(color: string, alpha: number): string {
    const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
    return `${color}${byte.toString(16).padStart(2, '0')}`;
}
export function gradientToCss(gradient: GuiGradient): string {
    const stops = [...gradient.stops]
        .sort((a, b) => a.offset - b.offset)
        .map((stop) => `${hexWithAlpha(stop.color, stop.alpha)} ${Math.round(stop.offset * 100)}%`)
        .join(', ');
    return gradient.kind === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${gradient.angle + 90}deg, ${stops})`;
}
function defaultGradient(baseColor: string): GuiGradient {
    return {
        kind: 'linear',
        angle: 90,
        stops: [
            { offset: 0, color: baseColor, alpha: 1 },
            { offset: 1, color: '#000000', alpha: 1 },
        ],
    };
}
function insertStop(stops: readonly GuiGradientStop[]): GuiGradientStop[] {
    const sorted = [...stops].sort((a, b) => a.offset - b.offset);
    let bestIndex = 0;
    let bestGap = -1;
    for (let index = 0; index < sorted.length - 1; index++) {
        const gap = sorted[index + 1].offset - sorted[index].offset;
        if (gap > bestGap) {
            bestGap = gap;
            bestIndex = index;
        }
    }
    const before = sorted[bestIndex] ?? { offset: 0, color: '#ffffff', alpha: 1 };
    const after = sorted[bestIndex + 1] ?? { offset: 1, color: before.color, alpha: before.alpha };
    const stop: GuiGradientStop = { offset: Number(((before.offset + after.offset) / 2).toFixed(3)), color: before.color, alpha: before.alpha };
    return [...stops, stop];
}
export function GuiGradientField({ label = 'Gradiente', value, baseColor, disabled, onChange, onEnd }: GuiGradientFieldProps) {
    const patch = (changes: Partial<GuiGradient>) => value && onChange({ ...value, ...changes });
    const patchStop = (index: number, changes: Partial<GuiGradientStop>) => value && patch({ stops: value.stops.map((stop, current) => (current === index ? { ...stop, ...changes } : stop)) });
    return (<>
      <ToggleField label={label} on={value !== null} onToggle={disabled ? undefined : () => onChange(value ? null : defaultGradient(baseColor))}/>
      {value && (<>
          <div className="px-2">
            <div aria-hidden className="h-3 rounded-sm border border-border" style={{ backgroundImage: gradientToCss(value) }}/>
          </div>
          <PropertyRow label="Tipo">
            <SegmentedControl label="Tipo do gradiente" options={KIND_OPTIONS} value={value.kind} onChange={(kind) => patch({ kind })}/>
          </PropertyRow>
          {value.kind === 'linear' && (<PropertyRow label="Ângulo">
              <GuiNumberField label="Ângulo do gradiente" unit="°" value={value.angle} step={1} precision={0} min={-360} max={360} disabled={disabled} onChange={(angle) => patch({ angle })} onEnd={onEnd}/>
            </PropertyRow>)}
          <div className="flex flex-col gap-1 px-2">
            {value.stops.map((stop, index) => (<div key={index} className="flex items-center gap-1">
                <GuiColorField inline label={`Parada ${index + 1}`} color={stop.color} alpha={stop.alpha} disabled={disabled} onChange={(changes) => patchStop(index, changes)} onEnd={onEnd}/>
                <GuiNumberField label={`Posição da parada ${index + 1}`} unit="%" value={stop.offset * 100} min={0} max={100} step={1} precision={0} disabled={disabled} className="max-w-16 flex-none" onChange={(percent) => patchStop(index, { offset: percent / 100 })} onEnd={onEnd}/>
                <IconButton label={`Remover parada ${index + 1}`} size="sm" disabled={disabled || value.stops.length <= 2} className="hover:text-destructive" onClick={() => patch({ stops: value.stops.filter((_, current) => current !== index) })}>
                  <X />
                </IconButton>
              </div>))}
            <ActionButton icon={Plus} disabled={disabled} onClick={() => patch({ stops: insertStop(value.stops) })}>
              Adicionar parada
            </ActionButton>
          </div>
        </>)}
    </>);
}
