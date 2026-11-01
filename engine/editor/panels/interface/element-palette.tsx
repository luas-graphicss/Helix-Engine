'use client';
import type { DragEvent } from 'react';
import { GUI_ELEMENT_DESCRIPTIONS, GUI_ELEMENT_LABELS, type GuiElementKind } from '@/engine/gui/document/gui-document';
import { GUI_ELEMENT_ICONS } from '@/engine/editor/gui/ui/gui-element-icons';
import { setElementDragData } from '@/engine/editor/gui/ui/gui-drag';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { addGuiElement } from '@/engine/editor/operations/gui-element-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint, useShortcutLabel } from '@/engine/editor/shortcuts/shortcut-bindings';
import { guiToolAction } from '@/engine/editor/shortcuts/tool-actions';
import { cn } from '@/lib/utils';
import { PaletteNotice } from './palette-notice';
interface ElementGroup {
    readonly title: string;
    readonly kinds: readonly GuiElementKind[];
}
const GROUPS: readonly ElementGroup[] = [
    { title: 'Estrutura', kinds: ['frame', 'scroll', 'divider'] },
    { title: 'Conteúdo', kinds: ['text', 'image', 'icon', 'progress'] },
    { title: 'Controles', kinds: ['button', 'toggle', 'slider', 'input'] },
];
function ElementTile({ kind, onAdd }: {
    kind: GuiElementKind;
    onAdd: () => void;
}) {
    const designer = useGuiDesigner();
    const toolKey = useShortcutLabel(guiToolAction(kind));
    const Icon = GUI_ELEMENT_ICONS[kind];
    const enabled = designer.isOpen && designer.mode === 'design';
    const onDragStart = (event: DragEvent<HTMLButtonElement>) => {
        setElementDragData(event.dataTransfer, kind);
        event.dataTransfer.setData('text/plain', GUI_ELEMENT_LABELS[kind]);
    };
    return (<button type="button" draggable={enabled} disabled={!enabled} onDragStart={onDragStart} onClick={onAdd} title={`${GUI_ELEMENT_DESCRIPTIONS[kind]} Clique para adicionar no centro ou arraste para a tela${toolKey ? ` (${toolKey} desenha)` : ''}.`} className={cn('group flex h-16 min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-sm border border-border bg-surface px-1.5 text-muted-foreground transition-colors', 'hover:border-primary/60 hover:bg-highlight hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', 'disabled:cursor-default disabled:opacity-40', designer.tool === kind && 'border-primary/60 bg-primary/10 text-primary')}>
      <Icon className="size-5 shrink-0 transition-colors group-hover:text-primary" aria-hidden/>
      <span className="flex max-w-full min-w-0 items-center gap-1 text-2xs leading-none">
        <span className="truncate">{GUI_ELEMENT_LABELS[kind]}</span>
        {toolKey && <kbd className="shrink-0 rounded-xs border border-border-strong px-1 font-mono text-[9px] text-muted-foreground/80">{toolKey}</kbd>}
      </span>
    </button>);
}
export function ElementPalette() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const hint = useShortcutHint();
    const add = (kind: GuiElementKind) => {
        const id = addGuiElement(session, kind);
        if (id && kind === 'text')
            designer.beginTextEdit(id);
    };
    return (<div className="flex h-full min-h-0 flex-col">
      {!designer.isOpen && <PaletteNotice>Abra ou crie uma tela para adicionar elementos. Na aba Telas há modelos prontos para começar.</PaletteNotice>}
      {designer.isOpen && designer.mode === 'preview' && <PaletteNotice>A tela está em teste: volte ao modo {hint('Design', 'gui.togglePreview')} para editar.</PaletteNotice>}
      
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-x-6 gap-y-4 overflow-auto p-3">
        {GROUPS.map((group) => (<section key={group.title} className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
            <h3 className="truncate text-3xs font-medium tracking-wider text-muted-foreground uppercase">{group.title}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
              {group.kinds.map((kind) => (<ElementTile key={kind} kind={kind} onAdd={() => add(kind)}/>))}
            </div>
          </section>))}
      </div>
    </div>);
}
