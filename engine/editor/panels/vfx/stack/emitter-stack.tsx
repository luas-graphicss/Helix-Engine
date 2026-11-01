'use client';
import { useState, type RefObject, type UIEvent } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { VFX_MAX_EMITTERS } from '@/engine/vfx/document/vfx-document';
import { addVfxEmitter, moveVfxEmitter, moveVfxModule } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useVfxEditor } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { VFX_ROW_HEIGHT, VFX_RULER_HEIGHT, type VfxStackRow } from '@/engine/editor/vfx/ui/vfx-stack-model';
import { IconButton } from '@/engine/ui/icon-button';
import { StackContextMenu } from './stack-context-menu';
import { EmitterRowView, ModuleRowView, type StackDrag, type StackDragHandlers } from './stack-rows';
type EmitterStackProps = {
    rows: readonly VfxStackRow[];
    scrollRef: RefObject<HTMLDivElement | null>;
    onScroll: (event: UIEvent<HTMLDivElement>) => void;
    onToggleCollapsed: (emitterId: string) => void;
};
function dropIndex(from: number, targetIndex: number, position: 'before' | 'after'): number {
    const to = position === 'before' ? targetIndex : targetIndex + 1;
    return from < to ? to - 1 : to;
}
export function EmitterStack({ rows, scrollRef, onScroll, onToggleCollapsed }: EmitterStackProps) {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const [drag, setDrag] = useState<StackDrag | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const { document } = editor;
    const handlers: StackDragHandlers = {
        onDragStart: (row) => setDrag({ row, target: null }),
        onDragOver: (row, position) => {
            setDrag((current) => (current && (current.target?.rowId !== row.id || current.target.position !== position) ? { ...current, target: { rowId: row.id, position } } : current));
        },
        onDrop: (target, position) => {
            const row = drag?.row;
            setDrag(null);
            if (!row)
                return;
            if (row.kind === 'emitter' && target.kind === 'emitter')
                moveVfxEmitter(session, row.id, dropIndex(row.index, target.index, position));
            else if (row.kind === 'module' && target.kind === 'module' && row.emitter.id === target.emitter.id)
                moveVfxModule(session, row.emitter.id, row.id, dropIndex(row.index, target.index, position));
        },
        onDragEnd: () => setDrag(null),
    };
    if (!document)
        return null;
    const full = document.emitters.length >= VFX_MAX_EMITTERS;
    const effectActive = editor.section === 'effect';
    return (<div className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border pr-0.5 pl-1" style={{ height: VFX_RULER_HEIGHT }}>
        <button type="button" title="Ajustes do efeito inteiro" aria-pressed={effectActive} onClick={() => editor.selectEmitter(null)} className={cn('flex h-[18px] min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1 text-2xs font-semibold transition-colors', effectActive ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-highlight')}>
          <Sparkles className="size-3.5 shrink-0" aria-hidden/>
          <span className="truncate">{document.name}</span>
        </button>
        <IconButton label={full ? `Máximo de ${VFX_MAX_EMITTERS} emissores` : 'Adicionar emissor'} size="sm" disabled={full} onClick={() => addVfxEmitter(session)}>
          <Plus />
        </IconButton>
      </div>

      <ContextMenu>
        <ContextMenuTrigger render={<div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]"/>}>
          {rows.map((row) => row.kind === 'emitter' ? (<EmitterRowView key={row.id} row={row} drag={drag} handlers={handlers} renaming={renamingId === row.id} onRename={setRenamingId} onToggleCollapsed={onToggleCollapsed}/>) : (<ModuleRowView key={row.id} row={row} drag={drag} handlers={handlers}/>))}
          <button type="button" disabled={full} onClick={() => addVfxEmitter(session)} className="flex w-full items-center gap-1.5 px-2 text-3xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground disabled:pointer-events-none disabled:opacity-40" style={{ height: VFX_ROW_HEIGHT }}>
            <Plus className="size-3" aria-hidden/>
            {rows.length === 0 ? 'Adicionar o primeiro emissor' : 'Adicionar emissor'}
          </button>
        </ContextMenuTrigger>
        <StackContextMenu onRename={setRenamingId}/>
      </ContextMenu>
    </div>);
}
