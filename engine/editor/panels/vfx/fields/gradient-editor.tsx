'use client';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Trash2, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { clamp } from '@/engine/core/math/scalar';
import { createGradient, fadeInOutGradient, gradientToCss, hexToRgb, rgbToHex, sampleGradient, solidGradient, type VfxGradient, type VfxRgb } from '@/engine/vfx/document/vfx-curves';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { GuiColorField } from '@/engine/editor/panels/gui/inspector/fields/gui-color-field';
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { IconButton } from '@/engine/ui/icon-button';
export type GradientEditorProps = {
    label: string;
    gradient: VfxGradient;
    className?: string;
    onChange: (gradient: VfxGradient) => void;
    onEnd: () => void;
};
type StopSelection = {
    kind: 'color' | 'alpha';
    index: number;
};
interface DragState {
    pointerId: number;
    selection: StopSelection;
    moved: boolean;
}
interface GradientPreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly build: (current: VfxGradient) => VfxGradient;
}
const WHITE: VfxRgb = [1, 1, 1];
function firstColor(gradient: VfxGradient): VfxRgb {
    return gradient.colors[0]?.color ?? WHITE;
}
const PRESETS: readonly GradientPreset[] = [
    { id: 'solid', label: 'Sólido', description: 'Uma cor, opaca do início ao fim', build: (current) => solidGradient(firstColor(current), 1) },
    { id: 'fade', label: 'Surge e some', description: 'Transparente nas pontas, cheia no meio: fumaça e poeira', build: (current) => fadeInOutGradient(firstColor(current), 1, 0.15, 0.6) },
    { id: 'fade-out', label: 'Só some', description: 'Nasce cheia e desaparece até o fim', build: (current) => createGradient([{ t: 0, color: firstColor(current) }], [{ t: 0, alpha: 1 }, { t: 1, alpha: 0 }]) },
    { id: 'flash', label: 'Clarão', description: 'Cheia no começo e some rápido: faíscas e impactos', build: (current) => createGradient([{ t: 0, color: firstColor(current) }], [{ t: 0, alpha: 1 }, { t: 0.2, alpha: 0.6 }, { t: 1, alpha: 0 }]) },
    { id: 'fire', label: 'Fogo', description: 'Branco, amarelo, laranja, vermelho e fuligem', build: () => createGradient([{ t: 0, color: [1, 0.98, 0.85] }, { t: 0.25, color: [1, 0.78, 0.2] }, { t: 0.55, color: [1, 0.35, 0.05] }, { t: 0.85, color: [0.35, 0.08, 0.02] }, { t: 1, color: [0.1, 0.1, 0.1] }], [{ t: 0, alpha: 1 }, { t: 0.7, alpha: 0.8 }, { t: 1, alpha: 0 }]) },
    { id: 'ember', label: 'Brasa', description: 'Amarelo quente esfriando até o vermelho escuro', build: () => createGradient([{ t: 0, color: [1, 0.9, 0.5] }, { t: 0.5, color: [1, 0.45, 0.1] }, { t: 1, color: [0.5, 0.05, 0] }], [{ t: 0, alpha: 1 }, { t: 0.8, alpha: 1 }, { t: 1, alpha: 0 }]) },
    { id: 'ice', label: 'Gelo', description: 'Branco para azul-claro, sumindo no fim', build: () => createGradient([{ t: 0, color: [1, 1, 1] }, { t: 0.6, color: [0.6, 0.85, 1] }, { t: 1, color: [0.3, 0.5, 1] }], [{ t: 0, alpha: 0 }, { t: 0.15, alpha: 1 }, { t: 1, alpha: 0 }]) },
    { id: 'toxic', label: 'Tóxico', description: 'Verde ácido para roxo', build: () => createGradient([{ t: 0, color: [0.7, 1, 0.2] }, { t: 0.5, color: [0.2, 0.9, 0.4] }, { t: 1, color: [0.5, 0.1, 0.8] }], [{ t: 0, alpha: 0 }, { t: 0.2, alpha: 1 }, { t: 1, alpha: 0 }]) },
    { id: 'rainbow', label: 'Arco-íris', description: 'Todas as cores em sequência', build: () => createGradient([{ t: 0, color: [1, 0.2, 0.2] }, { t: 0.2, color: [1, 0.8, 0.2] }, { t: 0.4, color: [0.3, 1, 0.3] }, { t: 0.6, color: [0.2, 0.8, 1] }, { t: 0.8, color: [0.4, 0.3, 1] }, { t: 1, color: [1, 0.3, 0.8] }], [{ t: 0, alpha: 1 }]) },
];
const CHECKER_STYLE = {
    backgroundImage: 'conic-gradient(var(--color-border-strong) 25%, transparent 0 50%, var(--color-border-strong) 0 75%, transparent 0)',
    backgroundSize: '8px 8px',
};
function sameSelection(a: StopSelection | null, b: StopSelection): boolean {
    return a !== null && a.kind === b.kind && a.index === b.index;
}
export function GradientEditor({ label, gradient, className, onChange, onEnd }: GradientEditorProps) {
    const [selected, setSelected] = useState<StopSelection | null>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const drag = useRef<DragState | null>(null);
    const toTime = (clientX: number): number => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0)
            return 0;
        return clamp((clientX - rect.left) / rect.width, 0, 1);
    };
    const replaceColors = (colors: VfxGradient['colors']) => onChange(createGradient(colors, gradient.alphas));
    const replaceAlphas = (alphas: VfxGradient['alphas']) => onChange(createGradient(gradient.colors, alphas));
    const moveStop = (selection: StopSelection, t: number): StopSelection => {
        if (selection.kind === 'color') {
            const colors = gradient.colors.map((stop, index) => (index === selection.index ? { ...stop, t } : stop));
            const sorted = [...colors].sort((a, b) => a.t - b.t);
            replaceColors(colors);
            return { kind: 'color', index: sorted.indexOf(colors[selection.index]) };
        }
        const alphas = gradient.alphas.map((stop, index) => (index === selection.index ? { ...stop, t } : stop));
        const sorted = [...alphas].sort((a, b) => a.t - b.t);
        replaceAlphas(alphas);
        return { kind: 'alpha', index: sorted.indexOf(alphas[selection.index]) };
    };
    const onStopPointerDown = (event: PointerEvent<HTMLButtonElement>, selection: StopSelection) => {
        if (event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelected(selection);
        drag.current = { pointerId: event.pointerId, selection, moved: false };
    };
    const onStopPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        state.moved = true;
        const t = Number(toTime(event.clientX).toFixed(3));
        const current = state.selection.kind === 'color' ? gradient.colors[state.selection.index] : gradient.alphas[state.selection.index];
        if (!current || Math.abs(current.t - t) < 1e-6)
            return;
        const next = moveStop(state.selection, t);
        if (!sameSelection(state.selection, next)) {
            state.selection = next;
            setSelected(next);
        }
    };
    const onStopPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        if (state.moved)
            onEnd();
    };
    const addStopAt = (clientX: number, clientY: number) => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect)
            return;
        const t = Number(toTime(clientX).toFixed(3));
        const sample = new Float32Array(4);
        sampleGradient(gradient, t, sample);
        const upperHalf = clientY - rect.top < rect.height / 2;
        if (upperHalf) {
            const alphas = [...gradient.alphas, { t, alpha: sample[3] }];
            replaceAlphas(alphas);
            setSelected({ kind: 'alpha', index: [...alphas].sort((a, b) => a.t - b.t).findIndex((stop) => stop.t === t) });
        }
        else {
            const colors = [...gradient.colors, { t, color: [sample[0], sample[1], sample[2]] as VfxRgb }];
            replaceColors(colors);
            setSelected({ kind: 'color', index: [...colors].sort((a, b) => a.t - b.t).findIndex((stop) => stop.t === t) });
        }
        onEnd();
    };
    const removeSelected = () => {
        if (!selected)
            return;
        if (selected.kind === 'color') {
            if (gradient.colors.length <= 1)
                return;
            replaceColors(gradient.colors.filter((_, index) => index !== selected.index));
        }
        else {
            if (gradient.alphas.length <= 1)
                return;
            replaceAlphas(gradient.alphas.filter((_, index) => index !== selected.index));
        }
        onEnd();
        setSelected(null);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
            event.preventDefault();
            removeSelected();
        }
    };
    const selectedColor = selected?.kind === 'color' ? gradient.colors[selected.index] : null;
    const selectedAlpha = selected?.kind === 'alpha' ? gradient.alphas[selected.index] : null;
    const removable = selected?.kind === 'color' ? gradient.colors.length > 1 : gradient.alphas.length > 1;
    return (<div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{label}</span>
        <span className="text-3xs text-muted-foreground">alfa em cima · cor embaixo</span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconButton label={`Gradientes prontos para ${label}`} size="sm"/>}>
            <WandSparkles />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-60`}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Gradientes prontos</DropdownMenuLabel>
              {PRESETS.map((preset) => (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} items-start gap-2`} onClick={() => (onChange(preset.build(gradient)), onEnd(), setSelected(null))}>
                  <span aria-hidden className="mt-0.5 h-3 w-8 shrink-0 rounded-xs border border-border" style={{ ...CHECKER_STYLE, backgroundImage: `${gradientToCss(preset.build(gradient))}, ${CHECKER_STYLE.backgroundImage}` }}/>
                  <span className="flex flex-col">
                    <span>{preset.label}</span>
                    <span className="text-3xs text-muted-foreground">{preset.description}</span>
                  </span>
                </DropdownMenuItem>))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col outline-none" tabIndex={0} onKeyDown={onKeyDown} aria-label={`Gradiente de ${label}: duplo clique na barra adiciona uma parada, arraste move, Delete remove`}>
        <div className="relative h-3">
          {gradient.alphas.map((stop, index) => {
            const selection: StopSelection = { kind: 'alpha', index };
            const active = sameSelection(selected, selection);
            return (<button key={`a-${index}-${gradient.alphas.length}`} type="button" aria-label={`Parada de alfa ${index + 1}: ${(stop.t * 100).toFixed(0)} %, ${(stop.alpha * 100).toFixed(0)} % opaca`} style={{ left: `${stop.t * 100}%` }} onPointerDown={(event) => onStopPointerDown(event, selection)} onPointerMove={onStopPointerMove} onPointerUp={onStopPointerUp} onPointerCancel={onStopPointerUp} className={cn('absolute bottom-0 size-3 -translate-x-1/2 cursor-grab touch-none [clip-path:polygon(50%_100%,0_0,100%_0)] active:cursor-grabbing', active ? 'bg-primary' : 'bg-foreground/70 hover:bg-primary')}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: `rgba(255,255,255,${1 - stop.alpha})`, opacity: 0.6 }}/>
              </button>);
        })}
        </div>
        <div ref={barRef} role="presentation" onDoubleClick={(event) => addStopAt(event.clientX, event.clientY)} onPointerDown={() => setSelected(null)} className="relative h-6 w-full overflow-hidden rounded-sm border border-border" style={CHECKER_STYLE}>
          <div aria-hidden className="absolute inset-0" style={{ background: gradientToCss(gradient) }}/>
        </div>
        <div className="relative h-3">
          {gradient.colors.map((stop, index) => {
            const selection: StopSelection = { kind: 'color', index };
            const active = sameSelection(selected, selection);
            return (<button key={`c-${index}-${gradient.colors.length}`} type="button" aria-label={`Parada de cor ${index + 1}: ${(stop.t * 100).toFixed(0)} %, ${rgbToHex(stop.color)}`} style={{ left: `${stop.t * 100}%`, backgroundColor: rgbToHex(stop.color) }} onPointerDown={(event) => onStopPointerDown(event, selection)} onPointerMove={onStopPointerMove} onPointerUp={onStopPointerUp} onPointerCancel={onStopPointerUp} className={cn('absolute top-0 size-3 -translate-x-1/2 cursor-grab touch-none [clip-path:polygon(50%_0,0_100%,100%_100%)] active:cursor-grabbing', active ? 'ring-2 ring-primary ring-inset' : 'ring-1 ring-foreground/60 ring-inset hover:ring-primary')}/>);
        })}
        </div>
      </div>
      {(selectedColor || selectedAlpha) && selected && (<div className="flex items-center gap-1">
          <span className="shrink-0 text-3xs text-muted-foreground">{selectedColor ? 'Cor' : 'Alfa'}</span>
          <GuiNumberField label="Posição da parada" value={(selectedColor?.t ?? selectedAlpha?.t ?? 0) * 100} min={0} max={100} step={1} precision={0} unit="%" className="max-w-20 flex-none" onChange={(percent) => {
                const next = moveStop(selected, percent / 100);
                if (!sameSelection(selected, next))
                    setSelected(next);
            }} onEnd={onEnd}/>
          {selectedColor && (<GuiColorField label="Cor da parada" color={rgbToHex(selectedColor.color)} inline onChange={(patch) => {
                    const rgb = patch.color ? hexToRgb(patch.color) : null;
                    if (rgb)
                        replaceColors(gradient.colors.map((stop, index) => (index === selected.index ? { ...stop, color: rgb } : stop)));
                }} onEnd={onEnd}/>)}
          {selectedAlpha && (<GuiNumberField label="Opacidade da parada" value={selectedAlpha.alpha * 100} min={0} max={100} step={1} precision={0} unit="α" className="max-w-20 flex-none" onChange={(percent) => replaceAlphas(gradient.alphas.map((stop, index) => (index === selected.index ? { ...stop, alpha: percent / 100 } : stop)))} onEnd={onEnd}/>)}
          <IconButton label="Remover parada (Delete)" size="sm" disabled={!removable} className="hover:text-destructive" onClick={removeSelected}>
            <Trash2 />
          </IconButton>
        </div>)}
    </div>);
}
