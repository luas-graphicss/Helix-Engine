'use client';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { convertScalar, scalarCurve, scalarRandom, scalarRandomCurve, VFX_SCALAR_KIND_LABEL, type VfxScalar, type VfxScalarKind } from '@/engine/vfx/document/vfx-curves';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { CurveEditor } from './curve-editor';
export type ScalarFieldProps = {
    label: string;
    value: VfxScalar;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    timeAxis: 'life' | 'emitter';
    onChange: (value: VfxScalar) => void;
    onEnd: () => void;
};
const KINDS: readonly VfxScalarKind[] = ['constant', 'random', 'curve', 'randomCurve'];
const KIND_DESCRIPTION: Record<VfxScalarKind, string> = {
    constant: 'O mesmo valor para toda partícula',
    random: 'Cada partícula sorteia um valor entre dois',
    curve: 'O valor segue uma curva no tempo',
    randomCurve: 'Cada partícula sorteia uma posição fixa entre duas curvas',
};
const TIME_AXIS_HINT: Record<ScalarFieldProps['timeAxis'], string> = {
    life: 'Eixo da curva: vida da partícula (0 nasce, 1 morre). Valor final = curva × escala.',
    emitter: 'Eixo da curva: ciclo do emissor (0 começa, 1 termina). Valor final = curva × escala.',
};
export function ScalarField({ label, value, unit, min, max, step = 0.1, precision = 2, timeAxis, onChange, onEnd }: ScalarFieldProps) {
    const numberProps = { min, max, step, precision, unit, onEnd };
    return (<div className="flex flex-col gap-1 px-2 py-0.5">
      <div className="grid min-h-row grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-2xs text-muted-foreground" title={value.kind === 'curve' || value.kind === 'randomCurve' ? TIME_AXIS_HINT[timeAxis] : label}>
          {label}
        </span>
        <div className="flex min-w-0 items-center gap-1">
          {value.kind === 'constant' && <GuiNumberField label={label} value={value.value} {...numberProps} onChange={(next) => onChange({ ...value, value: next })}/>}
          {value.kind === 'random' && (<>
              <GuiNumberField label={`${label} (mínimo)`} value={value.min} {...numberProps} onChange={(next) => onChange(scalarRandom(next, Math.max(next, value.max)))}/>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden/>
              <GuiNumberField label={`${label} (máximo)`} value={value.max} {...numberProps} onChange={(next) => onChange(scalarRandom(Math.min(next, value.min), next))}/>
            </>)}
          {(value.kind === 'curve' || value.kind === 'randomCurve') && (<>
              <span className="shrink-0 text-3xs text-muted-foreground">× escala</span>
              <GuiNumberField label={`${label} (escala da curva)`} value={value.scale} step={step} precision={precision} unit={unit} onEnd={onEnd} onChange={(scale) => onChange({ ...value, scale })}/>
            </>)}
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" aria-label={`Modo de ${label}: ${VFX_SCALAR_KIND_LABEL[value.kind]}`} title={KIND_DESCRIPTION[value.kind]} className="flex h-control shrink-0 items-center gap-0.5 rounded-sm border border-border px-1 text-3xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground"/>}>
              {value.kind === 'constant' ? 'Fixo' : value.kind === 'random' ? 'Aleatório' : value.kind === 'curve' ? 'Curva' : '2 curvas'}
              <ChevronDown className="size-3" aria-hidden/>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-60`}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className={MENU_LABEL_CLASS}>Como o valor é definido</DropdownMenuLabel>
                {KINDS.map((kind) => (<DropdownMenuItem key={kind} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => (onChange(convertScalar(value, kind)), onEnd())}>
                    <span>{VFX_SCALAR_KIND_LABEL[kind]}</span>
                    <span className="text-3xs text-muted-foreground">{KIND_DESCRIPTION[kind]}</span>
                  </DropdownMenuItem>))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {value.kind === 'curve' && <CurveEditor label={label} curve={value.curve} unit="" onChange={(curve) => onChange(scalarCurve(curve, value.scale))} onEnd={onEnd}/>}
      {value.kind === 'randomCurve' && (<div className="grid grid-cols-2 gap-2">
          <CurveEditor label={`${label} (mínimo)`} curve={value.min} compact onChange={(curve) => onChange(scalarRandomCurve(curve, value.max, value.scale))} onEnd={onEnd}/>
          <CurveEditor label={`${label} (máximo)`} curve={value.max} compact onChange={(curve) => onChange(scalarRandomCurve(value.min, curve, value.scale))} onEnd={onEnd}/>
        </div>)}
    </div>);
}
