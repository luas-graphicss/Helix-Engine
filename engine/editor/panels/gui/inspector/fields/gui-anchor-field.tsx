'use client';
import type { GuiPoint } from '@/engine/gui/document/gui-document';
import { GUI_ANCHOR_PRESETS, type GuiAnchorPreset } from '@/engine/editor/gui/gui-geometry';
import { cn } from '@/lib/utils';
type GuiAnchorFieldProps = {
    anchor: GuiPoint;
    presetId: string | null;
    disabled?: boolean;
    onChange: (preset: GuiAnchorPreset) => void;
};
export function GuiAnchorField({ anchor, presetId, disabled, onChange }: GuiAnchorFieldProps) {
    const custom = presetId === null;
    return (<div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Ponto de ancoragem" className="relative grid size-14 shrink-0 grid-cols-3 grid-rows-3 rounded-sm border border-border bg-input p-1">
        {GUI_ANCHOR_PRESETS.map((preset) => {
            const selected = preset.id === presetId;
            return (<button key={preset.id} type="button" role="radio" aria-checked={selected} aria-label={preset.label} title={preset.label} disabled={disabled} onClick={() => onChange(preset)} className="group flex items-center justify-center rounded-xs outline-none hover:bg-highlight focus-visible:bg-highlight disabled:cursor-default">
              <span aria-hidden className={cn('size-1.5 rounded-full transition-colors', selected ? 'bg-primary ring-2 ring-primary/30' : 'bg-foreground-muted/60 group-hover:bg-foreground')}/>
            </button>);
        })}
        {custom && (<span aria-hidden className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-primary/40" style={{ left: `${4 + anchor.x * 48}px`, top: `${4 + anchor.y * 48}px` }}/>)}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 text-2xs">
        <span className="truncate text-foreground">{custom ? 'Personalizada' : GUI_ANCHOR_PRESETS.find((preset) => preset.id === presetId)?.label}</span>
        <span className="font-mono text-3xs text-muted-foreground tabular-nums">
          {Math.round(anchor.x * 100)} % · {Math.round(anchor.y * 100)} %
        </span>
      </div>
    </div>);
}
