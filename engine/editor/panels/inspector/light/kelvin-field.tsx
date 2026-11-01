'use client';
import * as vec3 from '@/engine/core/math/vec3';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import { MAX_LIGHT_TEMPERATURE, MIN_LIGHT_TEMPERATURE, temperatureToLinearRgb } from '@/engine/core/scene/light';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { cn } from '@/lib/utils';
interface KelvinReference {
    readonly kelvin: number;
    readonly label: string;
}
const REFERENCES: readonly KelvinReference[] = [
    { kelvin: 1850, label: 'Vela' },
    { kelvin: 2700, label: 'Quente' },
    { kelvin: 4000, label: 'Neutra' },
    { kelvin: 5600, label: 'Dia' },
    { kelvin: 6500, label: 'Nublado' },
    { kelvin: 9000, label: 'Céu' },
];
const GRADIENT_STOPS = 12;
const STEP = 50;
const TRACK_GRADIENT = (() => {
    const color = vec3.create();
    const stops: string[] = [];
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
        const t = i / GRADIENT_STOPS;
        const kelvin = MIN_LIGHT_TEMPERATURE + (MAX_LIGHT_TEMPERATURE - MIN_LIGHT_TEMPERATURE) * t;
        stops.push(`${linearRgbToCss(temperatureToLinearRgb(color, kelvin))} ${(t * 100).toFixed(1)}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
})();
const TRACK_CLASS = 'h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-xs shadow-well outline-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:rounded-xs [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-xs [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-raised';
type KelvinFieldProps = {
    value: number;
    onChange: (kelvin: number) => void;
};
export function KelvinField({ value, onChange }: KelvinFieldProps) {
    const swatch = vec3.create();
    temperatureToLinearRgb(swatch, value);
    return (<>
      <PropertyRow label="Temperatura">
        <span className="size-6 shrink-0 rounded-sm border border-border shadow-well" style={{ backgroundColor: linearRgbToCss(swatch) }} aria-hidden/>
        <input type="range" min={MIN_LIGHT_TEMPERATURE} max={MAX_LIGHT_TEMPERATURE} step={STEP} value={value} aria-label="Temperatura de cor" aria-valuetext={`${value} K`} onChange={(event) => onChange(Number(event.currentTarget.value))} style={{ background: TRACK_GRADIENT }} className={TRACK_CLASS}/>
        <FieldInput key={value} defaultValue={`${value} K`} aria-label="Temperatura de cor (kelvin)" className="w-[4.5rem] flex-none" onBlur={(event) => {
            const parsed = Number.parseInt(event.currentTarget.value, 10);
            if (Number.isFinite(parsed))
                onChange(parsed);
        }} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
      </PropertyRow>
      <PropertyRow label="Referências">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {REFERENCES.map((reference) => {
            const active = value === reference.kelvin;
            return (<button key={reference.kelvin} type="button" aria-pressed={active} title={`${reference.kelvin} K`} onClick={() => onChange(reference.kelvin)} className={cn('h-5 rounded-sm border px-1.5 font-mono text-3xs transition-colors duration-100', active ? 'border-primary/60 bg-primary/15 text-primary shadow-well' : 'border-border bg-surface-raised text-muted-foreground shadow-bevel hover:bg-highlight hover:text-foreground')}>
                {reference.label}
              </button>);
        })}
        </div>
      </PropertyRow>
    </>);
}
