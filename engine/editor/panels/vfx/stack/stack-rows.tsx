'use client';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vfxModuleInfo } from '@/engine/vfx/document/vfx-document';
import { renameVfxEmitter, toggleVfxEmitter, toggleVfxModule } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useVfxEditor } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { tintToCss, VFX_ROW_HEIGHT, type VfxEmitterRow, type VfxModuleRow, type VfxStackRow } from '@/engine/editor/vfx/ui/vfx-stack-model';
import { CheckBox } from '@/engine/ui/check-box';
export type DropPosition = 'before' | 'after';
export interface StackDrag {
    readonly row: VfxStackRow;
    readonly target: {
        readonly rowId: string;
        readonly position: DropPosition;
    } | null;
}
export interface StackDragHandlers {
    readonly onDragStart: (row: VfxStackRow) => void;
    readonly onDragOver: (row: VfxStackRow, position: DropPosition) => void;
    readonly onDrop: (row: VfxStackRow, position: DropPosition) => void;
    readonly onDragEnd: () => void;
}
interface RowProps<R extends VfxStackRow> {
    row: R;
    drag: StackDrag | null;
    handlers: StackDragHandlers;
}
const MODULE_INDENT_PX = 22;
export function canDropOn(dragging: VfxStackRow, target: VfxStackRow): boolean {
    if (dragging.id === target.id || dragging.kind !== target.kind)
        return false;
    return dragging.kind === 'emitter' || dragging.emitter.id === target.emitter.id;
}
function dropPositionOf(event: DragEvent<HTMLElement>): DropPosition {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
}
type ShellProps = RowProps<VfxStackRow> & {
    selected: boolean;
    dimmed: boolean;
    indent: number;
    title: string;
    onSelect: () => void;
    onDoubleClick?: () => void;
    children: ReactNode;
};
function StackRowShell({ row, drag, handlers, selected, dimmed, indent, title, onSelect, onDoubleClick, children }: ShellProps) {
    const dragging = drag?.row.id === row.id;
    const target = drag?.target?.rowId === row.id ? drag.target.position : null;
    return (<div role="button" tabIndex={-1} aria-pressed={selected} title={title} draggable onClick={onSelect} onContextMenu={onSelect} onDoubleClick={onDoubleClick} onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', row.id);
            handlers.onDragStart(row);
        }} onDragOver={(event) => {
            if (!drag || !canDropOn(drag.row, row))
                return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            handlers.onDragOver(row, dropPositionOf(event));
        }} onDrop={(event) => {
            if (!drag || !canDropOn(drag.row, row))
                return;
            event.preventDefault();
            handlers.onDrop(row, dropPositionOf(event));
        }} onDragEnd={handlers.onDragEnd} className={cn('relative flex w-full min-w-0 cursor-default items-center gap-1 border-b border-border-strong/60 pr-1.5 text-2xs select-none', selected ? 'bg-primary/15 text-primary' : 'text-foreground/85 hover:bg-highlight hover:text-foreground', dimmed && !selected && 'text-muted-foreground', dragging && 'opacity-40')} style={{ height: VFX_ROW_HEIGHT, paddingLeft: indent }}>
      {children}
      {target && <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 h-0.5 bg-primary', target === 'before' ? 'top-0' : 'bottom-0')}/>}
    </div>);
}
function RenameField({ value, onCommit, onCancel }: {
    value: string;
    onCommit: (name: string) => void;
    onCancel: () => void;
}) {
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.key === 'Enter')
            event.currentTarget.blur();
        if (event.key === 'Escape') {
            event.currentTarget.value = value;
            onCancel();
        }
    };
    return (<input autoFocus defaultValue={value} aria-label="Nome do emissor" onFocus={(event) => event.currentTarget.select()} onBlur={(event) => onCommit(event.currentTarget.value)} onKeyDown={onKeyDown} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} className="h-[18px] min-w-0 flex-1 rounded-xs border border-primary/60 bg-input px-1 text-2xs text-foreground outline-none"/>);
}
function StopClicks({ children }: {
    children: ReactNode;
}) {
    return (<span className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      {children}
    </span>);
}
type EmitterRowProps = RowProps<VfxEmitterRow> & {
    renaming: boolean;
    onRename: (id: string | null) => void;
    onToggleCollapsed: (id: string) => void;
};
export function EmitterRowView({ row, drag, handlers, renaming, onRename, onToggleCollapsed }: EmitterRowProps) {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const { emitter } = row;
    const hasModules = emitter.modules.length > 0;
    const commitRename = (name: string) => {
        onRename(null);
        renameVfxEmitter(session, emitter.id, name);
    };
    return (<StackRowShell row={row} drag={drag} handlers={handlers} selected={row.selected} dimmed={!emitter.enabled} indent={4} title={emitter.name} onSelect={() => editor.selectEmitter(emitter.id)} onDoubleClick={() => onRename(emitter.id)}>
      {hasModules ? (<button type="button" aria-label={row.collapsed ? `Expandir ${emitter.name}` : `Recolher ${emitter.name}`} aria-expanded={!row.collapsed} onClick={(event) => {
                event.stopPropagation();
                onToggleCollapsed(emitter.id);
            }} className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-highlight hover:text-foreground">
          {row.collapsed ? <ChevronRight className="size-3" aria-hidden/> : <ChevronDown className="size-3" aria-hidden/>}
        </button>) : (<span className="size-4 shrink-0" aria-hidden/>)}
      <span aria-hidden className="size-2 shrink-0 rounded-full ring-1 ring-black/30" style={{ backgroundColor: tintToCss(emitter.tint, emitter.enabled ? 1 : 0.35) }}/>
      {renaming ? (<RenameField value={emitter.name} onCommit={commitRename} onCancel={() => onRename(null)}/>) : (<span className={cn('min-w-0 flex-1 truncate font-medium', !emitter.enabled && 'line-through decoration-muted-foreground/60')}>{emitter.name}</span>)}
      {hasModules && !renaming && <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/70">{emitter.modules.length}</span>}
      <StopClicks>
        <CheckBox checked={emitter.enabled} label={emitter.enabled ? `Desligar ${emitter.name}` : `Ligar ${emitter.name}`} onChange={() => toggleVfxEmitter(session, emitter.id)}/>
      </StopClicks>
    </StackRowShell>);
}
export function ModuleRowView({ row, drag, handlers }: RowProps<VfxModuleRow>) {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const { emitter, module } = row;
    const info = vfxModuleInfo(module.kind);
    return (<StackRowShell row={row} drag={drag} handlers={handlers} selected={row.selected} dimmed={!(emitter.enabled && module.enabled)} indent={MODULE_INDENT_PX} title={info.description} onSelect={() => editor.selectModule(emitter.id, module.id)}>
      <span aria-hidden className="h-3 w-px shrink-0 bg-border-strong"/>
      <span className={cn('min-w-0 flex-1 truncate', !module.enabled && 'line-through decoration-muted-foreground/60')}>{info.label}</span>
      <StopClicks>
        <CheckBox checked={module.enabled} label={module.enabled ? `Desligar ${info.label}` : `Ligar ${info.label}`} onChange={() => toggleVfxModule(session, emitter.id, module.id)} className="size-3"/>
      </StopClicks>
    </StackRowShell>);
}
