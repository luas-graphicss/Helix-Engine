'use client';
import type { KeyboardEvent } from 'react';
import type { GuiDesigner } from '@/engine/editor/gui/gui-designer';
import type { GuiExpansion } from './use-gui-expansion';
import type { LayerRow } from './gui-layer-model';
interface GuiLayersKeyboardOptions {
    readonly designer: GuiDesigner;
    readonly rows: readonly LayerRow[];
    readonly expansion: GuiExpansion;
    readonly anchorId: string | null;
    readonly setAnchorId: (id: string | null) => void;
    readonly startRename: (id: string) => void;
}
export function useGuiLayersKeyboard({ designer, rows, expansion, anchorId, setAnchorId, startRename }: GuiLayersKeyboardOptions) {
    return (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget)
            return;
        const primaryId = designer.primaryId;
        const index = rows.findIndex((row) => row.node.id === primaryId);
        const row = index === -1 ? null : rows[index];
        const moveTo = (nextIndex: number) => {
            const target = rows[Math.max(0, Math.min(rows.length - 1, nextIndex))];
            if (!target)
                return;
            if (event.shiftKey) {
                const anchorIndex = rows.findIndex((candidate) => candidate.node.id === (anchorId ?? primaryId));
                const from = anchorIndex === -1 ? nextIndex : anchorIndex;
                const [start, end] = from <= nextIndex ? [from, nextIndex] : [nextIndex, from];
                designer.select(rows.slice(start, end + 1).map((candidate) => candidate.node.id), { primary: target.node.id });
            }
            else {
                designer.select([target.node.id]);
                setAnchorId(target.node.id);
            }
        };
        switch (event.key) {
            case 'ArrowDown':
                moveTo(index === -1 ? 0 : index + 1);
                break;
            case 'ArrowUp':
                moveTo(index === -1 ? rows.length - 1 : index - 1);
                break;
            case 'ArrowRight':
                if (!row)
                    return;
                if (row.node.children.length > 0 && !expansion.isExpanded(row.node.id))
                    expansion.setExpanded(row.node.id, true);
                else
                    moveTo(index + 1);
                break;
            case 'ArrowLeft':
                if (!row)
                    return;
                if (row.node.children.length > 0 && expansion.isExpanded(row.node.id))
                    expansion.setExpanded(row.node.id, false);
                else {
                    const parentIndex = rows.findIndex((candidate) => candidate.node.id === row.parent.id);
                    if (parentIndex !== -1)
                        moveTo(parentIndex);
                }
                break;
            case 'Home':
                moveTo(0);
                break;
            case 'End':
                moveTo(rows.length - 1);
                break;
            case 'F2':
                if (primaryId)
                    startRename(primaryId);
                break;
            default:
                return;
        }
        event.preventDefault();
    };
}
