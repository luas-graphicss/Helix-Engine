'use client';
import type { KeyboardEvent } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Expansion } from './use-expansion';
interface TreeKeyboardOptions {
    session: EditorSession;
    rows: readonly Entity[];
    expansion: Expansion;
    anchorId: number | null;
    setAnchorId: (id: number | null) => void;
    startRename: (entity: Entity) => void;
}
export function useTreeKeyboard({ session, rows, expansion, anchorId, setAnchorId, startRename }: TreeKeyboardOptions) {
    const selectRow = (index: number, extend: boolean) => {
        const target = rows[Math.max(0, Math.min(index, rows.length - 1))];
        if (!target)
            return;
        if (extend) {
            const anchor = rows.findIndex((row) => row.id === (anchorId ?? session.selectedId));
            const from = anchor === -1 ? index : anchor;
            const [start, end] = from <= index ? [from, index] : [index, from];
            session.setSelection(rows.slice(start, end + 1), target);
            return;
        }
        session.select(target);
        setAnchorId(target.id);
    };
    return (event: KeyboardEvent<HTMLElement>) => {
        if (event.target instanceof HTMLInputElement)
            return;
        const selected = session.selectedEntity;
        const index = selected ? rows.indexOf(selected) : -1;
        switch (event.key) {
            case 'ArrowDown':
                selectRow(index + 1, event.shiftKey);
                break;
            case 'ArrowUp':
                selectRow(index <= 0 ? 0 : index - 1, event.shiftKey);
                break;
            case 'Home':
                selectRow(0, event.shiftKey);
                break;
            case 'End':
                selectRow(rows.length - 1, event.shiftKey);
                break;
            case 'ArrowRight':
                if (!selected)
                    return;
                if (selected.children.length > 0 && !expansion.isExpanded(selected))
                    expansion.setExpanded(selected, true);
                else if (selected.children.length > 0)
                    selectRow(index + 1, false);
                break;
            case 'ArrowLeft':
                if (!selected)
                    return;
                if (selected.children.length > 0 && expansion.isExpanded(selected))
                    expansion.setExpanded(selected, false);
                else if (selected.parent?.parent)
                    selectRow(rows.indexOf(selected.parent), false);
                break;
            case 'Enter':
                if (selected)
                    session.focusEntity(selected);
                break;
            case 'F2':
                if (selected)
                    startRename(selected);
                break;
            default:
                return;
        }
        event.preventDefault();
    };
}
