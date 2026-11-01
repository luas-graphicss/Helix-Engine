'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { renameEntity } from '@/engine/editor/operations/entity-operations';
export function RenameInput({ entity, onDone }: {
    entity: Entity;
    onDone: () => void;
}) {
    const session = useEditorSession();
    return (<input autoFocus defaultValue={entity.name} aria-label="Novo nome" onFocus={(event) => event.currentTarget.select()} onBlur={(event) => {
            renameEntity(session, entity, event.currentTarget.value);
            onDone();
        }} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = entity.name;
                event.currentTarget.blur();
            }
        }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} className="h-5 min-w-0 flex-1 rounded-xs border border-primary/70 bg-input px-1 text-2xs text-foreground shadow-well outline-none"/>);
}
