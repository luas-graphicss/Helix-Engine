'use client';
import { hexToLinearRgb, linearRgbToCss, linearRgbToHex } from '@/engine/core/color/srgb';
import * as vec3 from '@/engine/core/math/vec3';
import { GRADIENT_STOP_FLOATS, GRADIENT_STOPS } from '@/engine/vfx-graph/blocks/block-definition';
import { PropertyRow } from '@/engine/ui/property-row';
import { ClampedNumberField } from './clamped-number-field';
type GradientParamEditorProps = {
    label: string;
    stops: readonly number[];
    onChange: (stops: readonly number[]) => void;
};
interface GradientStop {
    readonly position: number;
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;
}
const PERCENT = 100;
const CAPTION_CLASS = 'min-w-0 flex-1 truncate text-3xs text-muted-foreground';
function readStops(floats: readonly number[]): GradientStop[] {
    const stops: GradientStop[] = [];
    for (let index = 0; index < GRADIENT_STOPS; index++) {
        const [position = 0, red = 0, green = 0, blue = 0, alpha = 1] = floats.slice(index * GRADIENT_STOP_FLOATS, (index + 1) * GRADIENT_STOP_FLOATS);
        stops.push({ position, red, green, blue, alpha });
    }
    return stops;
}
function writeStops(stops: readonly GradientStop[]): number[] {
    return stops.flatMap((stop) => [stop.position, stop.red, stop.green, stop.blue, stop.alpha]);
}
function stopRgb(stop: GradientStop): vec3.Vec3 {
    return vec3.create(stop.red, stop.green, stop.blue);
}
function stopCss(stop: GradientStop): string {
    return `color-mix(in srgb, ${linearRgbToCss(stopRgb(stop))} ${stop.alpha * PERCENT}%, transparent) ${stop.position * PERCENT}%`;
}
function StopRow({ name, stop, minPosition, maxPosition, onChange }: {
    name: string;
    stop: GradientStop;
    minPosition: number;
    maxPosition: number;
    onChange: (patch: Partial<GradientStop>) => void;
}) {
    const rgb = stopRgb(stop);
    return (<PropertyRow label={name}>
      <span className="relative size-control shrink-0 overflow-hidden rounded-sm border border-border focus-within:border-primary" style={{ backgroundColor: linearRgbToCss(rgb) }}>
        <input type="color" value={linearRgbToHex(rgb)} aria-label={`${name}: cor`} onChange={(event) => {
            const picked = hexToLinearRgb(vec3.create(), event.currentTarget.value);
            onChange({ red: picked[0], green: picked[1], blue: picked[2] });
        }} className="absolute inset-0 size-full cursor-pointer opacity-0"/>
      </span>
      <ClampedNumberField label={`${name}: posição`} value={stop.position * PERCENT} min={minPosition * PERCENT} max={maxPosition * PERCENT} suffix="%" onCommit={(percent) => onChange({ position: percent / PERCENT })}/>
      <ClampedNumberField label={`${name}: opacidade`} value={stop.alpha * PERCENT} min={0} max={PERCENT} suffix="%" onCommit={(percent) => onChange({ alpha: percent / PERCENT })}/>
    </PropertyRow>);
}
export function GradientParamEditor({ label, stops, onChange }: GradientParamEditorProps) {
    const parsed = readStops(stops);
    const patchStop = (index: number, patch: Partial<GradientStop>) => onChange(writeStops(parsed.map((stop, position) => (position === index ? { ...stop, ...patch } : stop))));
    return (<>
      <PropertyRow label={label}>
        <span aria-hidden className="h-control min-w-0 flex-1 rounded-sm border border-border" style={{ backgroundImage: `linear-gradient(to right, ${parsed.map(stopCss).join(', ')})` }}/>
      </PropertyRow>
      <PropertyRow label="">
        <span aria-hidden className="size-control shrink-0"/>
        <span className={CAPTION_CLASS}>Posição</span>
        <span className={CAPTION_CLASS}>Opacidade</span>
      </PropertyRow>
      {parsed.map((stop, index) => <StopRow key={index} name={`Parada ${index + 1}`} stop={stop} minPosition={parsed[index - 1]?.position ?? 0} maxPosition={parsed[index + 1]?.position ?? 1} onChange={(patch) => patchStop(index, patch)}/>)}
    </>);
}
