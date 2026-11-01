'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { GUI_ICON_SUGGESTIONS, guiIcons, iconLabel } from '@/engine/gui/icons/gui-icon-catalog';
import { IconGlyph } from '@/engine/editor/gui/ui/icon-glyph';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SearchField } from '@/engine/ui/search-field';
import { cn } from '@/lib/utils';
const RESULT_LIMIT = 96;
type GuiIconPickerProps = {
    label?: string;
    value: string | null;
    allowNone?: boolean;
    disabled?: boolean;
    onChange: (name: string | null) => void;
};
export function GuiIconPicker({ label = 'Ícone', value, allowNone, disabled, onChange }: GuiIconPickerProps) {
    useGuiDesigner();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ready = guiIcons.ready;
    const names = useMemo(() => {
        if (!ready || !open)
            return [];
        return query.trim() ? guiIcons.search(query, RESULT_LIMIT) : GUI_ICON_SUGGESTIONS.filter((name) => guiIcons.has(name)).slice(0, RESULT_LIMIT);
    }, [query, ready, open]);
    return (<>
      <PropertyRow label={label}>
        <button type="button" disabled={disabled} aria-expanded={open} onClick={() => setOpen((current) => !current)} className={cn('flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-border bg-input px-1.5 text-left text-2xs text-foreground', 'hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary disabled:cursor-default disabled:opacity-40')}>
          {value ? <IconGlyph name={value} size={14} className="shrink-0 text-foreground/80"/> : <span className="size-3.5 shrink-0 rounded-xs border border-border bg-surface-sunken shadow-well" aria-hidden/>}
          <span className="min-w-0 flex-1 truncate">{value ? iconLabel(value) : 'Nenhum'}</span>
          {open ? <ChevronUp className="size-3 shrink-0 text-muted-foreground" aria-hidden/> : <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden/>}
        </button>
        {allowNone && value && (<IconButton label="Remover ícone" size="sm" disabled={disabled} onClick={() => onChange(null)}>
            <X />
          </IconButton>)}
      </PropertyRow>
      {open && (<div className="mx-2 flex flex-col gap-1 rounded-sm border border-border bg-surface p-1.5">
          <SearchField placeholder="Buscar ícone" value={query} onChange={setQuery}/>
          <div className="flex max-h-40 flex-wrap gap-0.5 overflow-auto" role="listbox" aria-label="Catálogo de ícones">
            {names.map((name) => (<button key={name} type="button" role="option" aria-selected={name === value} title={iconLabel(name)} aria-label={iconLabel(name)} onClick={() => {
                    onChange(name);
                    setOpen(false);
                }} className={cn('flex size-7 items-center justify-center rounded-sm border border-transparent text-foreground/80 hover:border-primary/60 hover:bg-highlight hover:text-foreground', name === value && 'border-primary/60 bg-primary/10 text-primary')}>
                <IconGlyph name={name} size={15}/>
              </button>))}
          </div>
          {!ready && <p className="px-1 py-2 text-center text-2xs text-muted-foreground">Carregando catálogo…</p>}
          {ready && names.length === 0 && <p className="px-1 py-2 text-center text-2xs text-muted-foreground">Nenhum ícone corresponde a “{query}”.</p>}
        </div>)}
    </>);
}
