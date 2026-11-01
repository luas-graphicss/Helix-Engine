'use client';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Trash2, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { clamp } from '@/engine/core/math/scalar';
import { addCurveKey, bellCurve, constantCurve, curveRange, linearCurve, removeCurveKey, sampleCurve, setCurveKey, type VfxCurve, type VfxCurveInterpolation } from '@/engine/vfx/document/vfx-curves';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
export type CurveEditorProps = {
    label: string;
    curve: VfxCurve;
    suggestedMin?: number;
    suggestedMax?: number;
    unit?: string;
    compact?: boolean;
    className?: string;
    onChange: (curve: VfxCurve) => void;
    onEnd: () => void;
};
const SAMPLES = 64;
const INTERPOLATIONS: ReadonlyArray<{
    value: VfxCurveInterpolation;
    label: string;
}> = [
    { value: 'linear', label: 'Reta' },
    { value: 'smooth', label: 'Suave' },
    { value: 'step', label: 'Degrau' },
];
interface CurvePreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly build: (range: {
        min: number;
        max: number;
    }) => VfxCurve;
}
const PRESETS: readonly CurvePreset[] = [
    { id: 'constant', label: 'Constante', description: 'O mesmo valor do início ao fim', build: ({ max }) => constantCurve(max) },
    { id: 'rise', label: 'Subida', description: 'Do mínimo ao máximo em linha reta', build: ({ min, max }) => linearCurve(min, max) },
    { id: 'fall', label: 'Descida', description: 'Do máximo ao mínimo em linha reta', build: ({ min, max }) => linearCurve(max, min) },
    { id: 'bell', label: 'Sino', description: 'Sobe ao máximo no meio e volta', build: ({ min, max }) => bellCurve(min, max, 0.5) },
    { id: 'early', label: 'Pico cedo', description: 'Dispara no começo e decai devagar', build: ({ min, max }) => bellCurve(min, max, 0.15) },
    { id: 'late', label: 'Pico tarde', description: 'Cresce devagar e cai no fim', build: ({ min, max }) => bellCurve(min, max, 0.85) },
    { id: 'ease-out', label: 'Freada', description: 'Começa rápido e estabiliza', build: ({ min, max }) => ({ keys: [{ t: 0, v: max }, { t: 0.35, v: min + (max - min) * 0.25 }, { t: 1, v: min }], interpolation: 'smooth' }) },
    { id: 'pulse', label: 'Pulsos', description: 'Liga e desliga em degraus', build: ({ min, max }) => ({ keys: [{ t: 0, v: max }, { t: 0.25, v: min }, { t: 0.5, v: max }, { t: 0.75, v: min }], interpolation: 'step' }) },
];
interface DragState {
    pointerId: number;
    index: number;
    lo: number;
    hi: number;
    moved: boolean;
}
function verticalRange(curve: VfxCurve, suggestedMin: number, suggestedMax: number): {
    lo: number;
    hi: number;
} {
    const range = curveRange(curve);
    let lo = Math.min(suggestedMin, range.min);
    let hi = Math.max(suggestedMax, range.max);
    if (hi - lo < 1e-6) {
        lo -= 0.5;
        hi += 0.5;
    }
    const pad = (hi - lo) * 0.08;
    return { lo: lo - pad, hi: hi + pad };
}
function formatValue(value: number): string {
    return String(Number(value.toFixed(Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2)));
}
export function CurveEditor({ label, curve, suggestedMin = 0, suggestedMax = 1, unit, compact = false, className, onChange, onEnd }: CurveEditorProps) {
    const [selected, setSelected] = useState<number | null>(null);
    const areaRef = useRef<HTMLDivElement>(null);
    const drag = useRef<DragState | null>(null);
    const { lo, hi } = verticalRange(curve, suggestedMin, suggestedMax);
    const span = hi - lo;
    const height = compact ? 56 : 80;
    const toValue = (clientY: number, rangeLo: number, rangeHi: number): number => {
        const rect = areaRef.current?.getBoundingClientRect();
        if (!rect || rect.height <= 0)
            return 0;
        return rangeHi - ((clientY - rect.top) / rect.height) * (rangeHi - rangeLo);
    };
    const toTime = (clientX: number): number => {
        const rect = areaRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0)
            return 0;
        return clamp((clientX - rect.left) / rect.width, 0, 1);
    };
    const points = Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const t = i / SAMPLES;
        const v = sampleCurve(curve, t);
        return `${(t * 100).toFixed(2)},${(((hi - v) / span) * 100).toFixed(2)}`;
    });
    const path = `M${points.join(' L')}`;
    const zeroY = lo < 0 && hi > 0 ? ((hi - 0) / span) * 100 : null;
    const onKeyPointerDown = (event: PointerEvent<HTMLButtonElement>, index: number) => {
        if (event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelected(index);
        drag.current = { pointerId: event.pointerId, index, lo, hi, moved: false };
    };
    const onKeyPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        state.moved = true;
        const key = curve.keys[state.index];
        if (!key)
            return;
        const first = state.index === 0;
        const last = state.index === curve.keys.length - 1;
        const t = first ? 0 : last ? 1 : toTime(event.clientX);
        const v = Number(toValue(event.clientY, state.lo, state.hi).toFixed(3));
        if (Math.abs(t - key.t) < 1e-6 && Math.abs(v - key.v) < 1e-6)
            return;
        const next = setCurveKey(curve, state.index, { t, v });
        const movedIndex = next.keys.findIndex((candidate) => Math.abs(candidate.t - t) < 1e-9 && Math.abs(candidate.v - v) < 1e-9);
        if (movedIndex >= 0 && movedIndex !== state.index) {
            state.index = movedIndex;
            setSelected(movedIndex);
        }
        onChange(next);
    };
    const onKeyPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        if (state.moved)
            onEnd();
    };
    const addKeyAt = (clientX: number, clientY: number) => {
        const t = toTime(clientX);
        const v = Number(toValue(clientY, lo, hi).toFixed(3));
        const next = addCurveKey(curve, { t, v });
        onChange(next);
        onEnd();
        setSelected(next.keys.findIndex((candidate) => Math.abs(candidate.t - clamp(t, 0, 1)) < 1e-9 && Math.abs(candidate.v - v) < 1e-9));
    };
    const removeSelected = () => {
        if (selected === null || curve.keys.length <= 1)
            return;
        onChange(removeCurveKey(curve, selected));
        onEnd();
        setSelected(null);
    };
    const onAreaKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && selected !== null) {
            event.preventDefault();
            removeSelected();
        }
    };
    const selectedKey = selected !== null ? curve.keys[selected] : null;
    const range = curveRange(curve);
    const presetRange = { min: Math.min(suggestedMin, range.min), max: Math.max(range.max, range.min === range.max ? range.max : suggestedMax) };
    return (<div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="flex items-center gap-1">
        {!compact && <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{label}</span>}
        <SegmentedControl label={`Interpolação de ${label}`} options={INTERPOLATIONS} value={curve.interpolation} onChange={(interpolation) => (onChange({ ...curve, interpolation }), onEnd())}/>
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconButton label={`Formas prontas para ${label}`} size="sm"/>}>
            <WandSparkles />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-56`}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Formas na faixa atual</DropdownMenuLabel>
              {PRESETS.map((preset) => (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => (onChange(preset.build(presetRange)), onEnd(), setSelected(null))}>
                  <span>{preset.label}</span>
                  <span className="text-3xs text-muted-foreground">{preset.description}</span>
                </DropdownMenuItem>))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div ref={areaRef} role="application" aria-label={`Curva de ${label}: duplo clique adiciona uma chave, arraste move, Delete remove`} tabIndex={0} style={{ height }} onKeyDown={onAreaKeyDown} onDoubleClick={(event) => addKeyAt(event.clientX, event.clientY)} onPointerDown={() => setSelected(null)} className="relative w-full select-none overflow-visible rounded-sm border border-border bg-input outline-none focus-visible:border-primary/70">
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <line x1="25" y1="0" x2="25" y2="100" className="stroke-border" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
          <line x1="50" y1="0" x2="50" y2="100" className="stroke-border" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
          <line x1="75" y1="0" x2="75" y2="100" className="stroke-border" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
          {zeroY !== null && <line x1="0" y1={zeroY} x2="100" y2={zeroY} className="stroke-border-strong" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"/>}
          <path d={`${path} L100,100 L0,100 Z`} className="fill-primary/10"/>
          <path d={path} className="stroke-primary" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
        </svg>
        {curve.keys.map((key, index) => (<button key={`${index}-${curve.keys.length}`} type="button" aria-label={`Chave ${index + 1}: tempo ${(key.t * 100).toFixed(0)} %, valor ${formatValue(key.v)}`} style={{ left: `${key.t * 100}%`, top: `${((hi - key.v) / span) * 100}%` }} onPointerDown={(event) => onKeyPointerDown(event, index)} onPointerMove={onKeyPointerMove} onPointerUp={onKeyPointerUp} onPointerCancel={onKeyPointerUp} onDoubleClick={(event) => event.stopPropagation()} className={cn('absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 bg-surface touch-none active:cursor-grabbing', selected === index ? 'border-primary ring-2 ring-primary/40' : 'border-foreground/70 hover:border-primary')}/>))}
        <span className="pointer-events-none absolute top-0.5 left-1 font-mono text-[9px] text-muted-foreground">{formatValue(hi)}{unit ?? ''}</span>
        <span className="pointer-events-none absolute bottom-0.5 left-1 font-mono text-[9px] text-muted-foreground">{formatValue(lo)}{unit ?? ''}</span>
      </div>
      {selectedKey && (<div className="flex items-center gap-1">
          <span className="shrink-0 text-3xs text-muted-foreground">Chave</span>
          <GuiNumberField label="Tempo da chave" value={selectedKey.t * 100} min={0} max={100} step={1} precision={0} unit="%" disabled={selected === 0 || selected === curve.keys.length - 1} onChange={(percent) => {
                if (selected === null)
                    return;
                onChange(setCurveKey(curve, selected, { t: percent / 100, v: selectedKey.v }));
            }} onEnd={onEnd}/>
          <GuiNumberField label="Valor da chave" value={selectedKey.v} step={Math.max(0.01, span / 100)} precision={3} unit={unit} onChange={(value) => {
                if (selected === null)
                    return;
                onChange(setCurveKey(curve, selected, { t: selectedKey.t, v: value }));
            }} onEnd={onEnd}/>
          <IconButton label="Remover chave (Delete)" size="sm" disabled={curve.keys.length <= 1} className="hover:text-destructive" onClick={removeSelected}>
            <Trash2 />
          </IconButton>
        </div>)}
    </div>);
}
