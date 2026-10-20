'use client';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FieldInput } from '@/engine/ui/field-input';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import type { SnapSettings } from '@/engine/editor/session/editor-session';
import { MENU_CONTENT_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
const STEPS: ReadonlyArray<{
    key: keyof Omit<SnapSettings, 'enabled'>;
    label: string;
    unit: string;
}> = [
    { key: 'translate', label: 'Mover', unit: 'u' },
    { key: 'rotate', label: 'Rotacionar', unit: '°' },
    { key: 'scale', label: 'Escalar', unit: '×' },
];
export function SnapSettingsMenu() {
    const session = useEditorState();
    const { snap } = session;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Incrementos de alinhamento" title="Incrementos de alinhamento" className="ml-0.5 flex h-6 items-center gap-1 rounded-sm border border-border-strong px-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground"/>}>
        <span>{snap.translate}u</span>
        <span className="text-muted-foreground/60">·</span>
        <span>{snap.rotate}°</span>
        <ChevronDown className="size-3" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} w-56`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Incrementos de alinhamento</DropdownMenuLabel>
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
