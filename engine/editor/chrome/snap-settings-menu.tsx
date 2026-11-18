'use client';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FieldInput } from '@/engine/ui/field-input';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { isSnapTarget, type SnapTarget } from '@/engine/editor/transform/transform-settings';
type SnapStepKey = 'translate' | 'rotate' | 'scale';
const TARGETS: ReadonlyArray<{
    value: SnapTarget;
    label: string;
    hint: string;
}> = [
    { value: 'increment', label: 'Incremento', hint: 'Passos contados a partir de onde o arrasto começou' },
    { value: 'grid', label: 'Grade', hint: 'Posições do mundo em múltiplos do passo de mover' },
    { value: 'vertex', label: 'Vértice', hint: 'O pivô encaixa no vértice sob o cursor; com Mover, arraste um vértice da própria seleção' },
    { value: 'surface', label: 'Superfície', hint: 'O centro do gizmo de mover apoia a seleção na superfície sob o cursor' },
];
const STEPS: ReadonlyArray<{
    key: SnapStepKey;
    label: string;
    unit: string;
}> = [
    { key: 'translate', label: 'Mover', unit: 'u' },
    { key: 'rotate', label: 'Rotacionar', unit: '°' },
    { key: 'scale', label: 'Escalar', unit: '×' },
];
const MENU_TITLE = 'Alvo e incrementos do encaixe';
export function SnapSettingsMenu() {
    const session = useSessionTopic('tool');
    const { snap } = session;
    const targetLabel = TARGETS.find((target) => target.value === snap.target)?.label ?? snap.target;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label={MENU_TITLE} title={MENU_TITLE} className="ml-0.5 flex h-control items-center gap-1 rounded-sm border border-border bg-surface-sunken px-1.5 font-mono text-3xs text-muted-foreground shadow-well transition-colors duration-100 hover:border-border-strong hover:text-foreground data-[popup-open]:border-primary/60 data-[popup-open]:text-foreground"/>}>
        <span className="text-foreground/90">{targetLabel}</span>
        <span className="text-muted-foreground/60">·</span>
        <span>{snap.translate}u</span>
        <span className="text-muted-foreground/60">·</span>
        <span>{snap.rotate}°</span>
        <ChevronDown className="size-3" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} w-56`}>
        <DropdownMenuRadioGroup value={snap.target} onValueChange={(value) => {
            if (isSnapTarget(value))
                session.updateSnap({ target: value });
        }}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Encaixar em</DropdownMenuLabel>
            {TARGETS.map((target) => (<DropdownMenuRadioItem key={target.value} className={MENU_ITEM_CLASS} value={target.value} title={target.hint}>
                {target.label}
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Incrementos</DropdownMenuLabel>
          <div className="flex flex-col gap-1 px-2 pt-1 pb-1.5">
            {STEPS.map((step) => (<label key={step.key} className="grid grid-cols-[72px_minmax(0,1fr)_16px] items-center gap-2 text-2xs text-muted-foreground">
                <span>{step.label}</span>
                <FieldInput key={`${step.key}-${snap[step.key]}`} type="number" min={0.001} step={step.key === 'rotate' ? 1 : 0.05} defaultValue={snap[step.key]} aria-label={`Incremento de ${step.label.toLowerCase()}`} onBlur={(event) => {
                const value = Number.parseFloat(event.currentTarget.value.replace(',', '.'));
                if (Number.isFinite(value) && value > 0)
                    session.updateSnap({ [step.key]: value });
            }} onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter')
                    event.currentTarget.blur();
            }}/>
                <span className="font-mono">{step.unit}</span>
              </label>))}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
