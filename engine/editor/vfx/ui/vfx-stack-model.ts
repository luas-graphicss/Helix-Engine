import { niceStep } from '@/engine/editor/animation/ui/timeline-draw';
import type { VfxBurst, VfxDocument, VfxEmitter, VfxModule } from '@/engine/vfx/document/vfx-document';
import type { VfxRgb } from '@/engine/vfx/document/vfx-curves';
export const VFX_ROW_HEIGHT = 22;
export const VFX_RULER_HEIGHT = 22;
export const VFX_FRAME_STEP = 1 / 60;
const TIME_PAD_LEFT = 8;
const TIME_PAD_RIGHT = 12;
const MAX_BURST_MARKS = 48;
export interface VfxEmitterRow {
    readonly kind: 'emitter';
    readonly id: string;
    readonly emitter: VfxEmitter;
    readonly index: number;
    readonly collapsed: boolean;
    readonly selected: boolean;
}
export interface VfxModuleRow {
    readonly kind: 'module';
    readonly id: string;
    readonly emitter: VfxEmitter;
    readonly module: VfxModule;
    readonly index: number;
    readonly selected: boolean;
}
export type VfxStackRow = VfxEmitterRow | VfxModuleRow;
export function buildVfxStackRows(document: VfxDocument, collapsed: ReadonlySet<string>, selectedEmitterId: string | null, selectedModuleId: string | null): VfxStackRow[] {
    const rows: VfxStackRow[] = [];
    document.emitters.forEach((emitter, index) => {
        const isCollapsed = collapsed.has(emitter.id);
        rows.push({ kind: 'emitter', id: emitter.id, emitter, index, collapsed: isCollapsed, selected: emitter.id === selectedEmitterId && selectedModuleId === null });
        if (isCollapsed)
            return;
        emitter.modules.forEach((module, moduleIndex) => {
            rows.push({ kind: 'module', id: module.id, emitter, module, index: moduleIndex, selected: emitter.id === selectedEmitterId && module.id === selectedModuleId });
        });
    });
    return rows;
}
export function vfxTimeSpan(width: number): number {
    return Math.max(1, width - TIME_PAD_LEFT - TIME_PAD_RIGHT);
}
export function vfxTimeToX(time: number, duration: number, width: number): number {
    return TIME_PAD_LEFT + (duration > 0 ? time / duration : 0) * vfxTimeSpan(width);
}
export function vfxXToTime(x: number, duration: number, width: number): number {
    return ((x - TIME_PAD_LEFT) / vfxTimeSpan(width)) * duration;
}
export interface VfxRulerTick {
    readonly time: number;
    readonly major: boolean;
}
export function vfxRulerTicks(duration: number, width: number): VfxRulerTick[] {
    if (!(duration > 0))
        return [];
    const span = vfxTimeSpan(width);
    const major = niceStep(duration, Math.max(1, Math.floor(span / 72)));
    const mantissa = major / 10 ** Math.floor(Math.log10(major));
    const minor = major / (Math.abs(mantissa - 2) < 1e-9 ? 4 : 5);
    const step = (minor / duration) * span >= 6 ? minor : major;
    const ticks: VfxRulerTick[] = [];
    const count = Math.floor(duration / step + 1e-6);
    for (let i = 0; i <= count; i++) {
        const time = i * step;
        const ratio = time / major;
        ticks.push({ time, major: Math.abs(ratio - Math.round(ratio)) < 1e-6 });
    }
    return ticks;
}
export function formatVfxSeconds(time: number): string {
    return `${time.toFixed(2)} s`;
}
export interface VfxEmitterWindow {
    readonly start: number;
    readonly end: number;
}
export function emitterWindow(emitter: VfxEmitter, document: VfxDocument): VfxEmitterWindow {
    const start = Math.min(emitter.delay, document.duration);
    const end = emitter.duration > 0 ? Math.min(start + emitter.duration, document.duration) : document.duration;
    return { start, end: Math.max(start, end) };
}
export function burstTimes(burst: VfxBurst, window: VfxEmitterWindow): number[] {
    const times: number[] = [];
    const repeats = burst.cycles <= 0 ? MAX_BURST_MARKS : Math.min(burst.cycles, MAX_BURST_MARKS);
    for (let i = 0; i < repeats; i++) {
        const time = window.start + burst.time + i * burst.interval;
        if (time > window.end + 1e-6)
            break;
        times.push(time);
        if (burst.interval <= 0)
            break;
    }
    return times;
}
export function tintToCss(tint: VfxRgb, alpha = 1): string {
    return `rgba(${Math.round(tint[0] * 255)}, ${Math.round(tint[1] * 255)}, ${Math.round(tint[2] * 255)}, ${alpha})`;
}
