'use client';
import { useMemo, useState, type DragEvent } from 'react';
import { GUI_ICON_SUGGESTIONS, guiIcons, iconLabel } from '@/engine/gui/icons/gui-icon-catalog';
import { setIconDragData } from '@/engine/editor/gui/ui/gui-drag';
import { IconGlyph } from '@/engine/editor/gui/ui/icon-glyph';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { addGuiElement, setGuiIcon } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SearchField } from '@/engine/ui/search-field';
import { cn } from '@/lib/utils';
import { PaletteNotice } from './palette-notice';
const RESULT_LIMIT = 240;
function IconTile({ name, active, enabled, onPick }: {
    name: string;
    active: boolean;
    enabled: boolean;
    onPick: () => void;
}) {
    const onDragStart = (event: DragEvent<HTMLButtonElement>) => {
        setIconDragData(event.dataTransfer, name);
        event.dataTransfer.setData('text/plain', name);
    };
    return (<button type="button" draggable={enabled} disabled={!enabled} onDragStart={onDragStart} onClick={onPick} title={iconLabel(name)} aria-label={iconLabel(name)} className={cn('flex size-9 items-center justify-center rounded-sm border border-transparent text-foreground/80 transition-colors', 'hover:border-primary/60 hover:bg-highlight hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', 'disabled:cursor-default disabled:opacity-40', active && 'border-primary/60 bg-primary/10 text-primary')}>
      <IconGlyph name={name} size={18}/>
    </button>);
}
export function IconPalette() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const [query, setQuery] = useState('');
    const ready = guiIcons.ready;
    const names = useMemo(() => {
        if (!ready)
            return [];
        return query.trim() ? guiIcons.search(query, RESULT_LIMIT) : GUI_ICON_SUGGESTIONS.filter((name) => guiIcons.has(name));
    }, [query, ready]);
    const targets = designer.selectedNodes.filter((node) => node.kind === 'icon' || node.kind === 'button');
    const currentName = targets.length === 1 ? (targets[0].kind === 'icon' ? targets[0].icon?.name : targets[0].control?.kind === 'button' ? targets[0].control.iconName : null) : null;
    const enabled = designer.isOpen && designer.mode === 'design';
    const pick = (name: string) => {
        if (targets.length > 0) {
            setGuiIcon(session, targets.map((node) => node.id), name);
            return;
        }
        const id = addGuiElement(session, 'icon', { name: iconLabel(name) });
        if (id)
            setGuiIcon(session, [id], name);
    };
    return (<div className="flex h-full min-h-0 flex-col">
      {!designer.isOpen && <PaletteNotice>Abra uma tela para usar os ícones: clique cria um elemento de ícone, arrasto solta onde quiser.</PaletteNotice>}
      {targets.length > 0 && enabled && (<PaletteNotice>
          Clique num ícone para aplicá-lo {targets.length === 1 ? `a ${targets[0].name}` : `aos ${targets.length} elementos selecionados`}.
        </PaletteNotice>)}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-1.5">
        <SearchField placeholder="Buscar ícone (ex.: heart, arrow right, shield)" value={query} onChange={setQuery} className="max-w-80 basis-40"/>
        <span className="shrink-0 font-mono text-3xs whitespace-nowrap text-muted-foreground">{ready ? `${query.trim() ? names.length : guiIcons.names().length} ícones` : 'carregando catálogo…'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!query.trim() && ready && <h3 className="px-1 pb-1.5 text-3xs font-medium tracking-wider text-muted-foreground uppercase">Sugestões para jogos · busque para ver o catálogo inteiro</h3>}
        <div className="flex flex-wrap gap-0.5">
          {names.map((name) => (<IconTile key={name} name={name} active={name === currentName} enabled={enabled} onPick={() => pick(name)}/>))}
        </div>
        {ready && names.length === 0 && <p className="px-1 py-6 text-center text-2xs text-muted-foreground">Nenhum ícone corresponde a “{query}”.</p>}
      </div>
    </div>);
}
