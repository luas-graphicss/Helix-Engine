'use client';
import type { ReactNode } from 'react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
type EffectSectionProps = {
    title: string;
    enabled: boolean;
    active: boolean;
    onToggle: () => void;
    children: ReactNode;
};
export function EffectSection({ title, enabled, active, onToggle, children }: EffectSectionProps) {
    return (<CollapsibleSection title={title} defaultOpen={enabled} trailing={<ToggleSwitch label={`${title} ativo`} on={enabled} onToggle={onToggle}/>}>
      <div className={cn('flex flex-col gap-0.5 transition-opacity', (!enabled || !active) && 'opacity-50')}>{children}</div>
    </CollapsibleSection>);
}
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
export const stops = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)} EV`;
export const pixels = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)} px`;
export const millimeters = (value: number) => `${Math.round(value)} mm`;
export const fNumber = (value: number) => `f/${value.toFixed(1)}`;
export const meters = (value: number) => `${value.toFixed(value < 10 ? 1 : 0)} m`;
export const times = (value: number) => `${value.toFixed(2)}×`;
