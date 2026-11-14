import { Import, Minus, Pencil, Plus, Redo2, Undo2, type LucideIcon } from 'lucide-react';
import type { ActivityKind } from '@/engine/editor/activity/activity-entry';
export interface ActivityKindMeta {
    readonly icon: LucideIcon;
    readonly label: string;
    readonly groupLabel: string;
    readonly className: string;
}
export const ACTIVITY_KINDS: readonly ActivityKind[] = ['insert', 'import', 'remove', 'edit', 'undo', 'redo'];
export const ACTIVITY_KIND_META: Record<ActivityKind, ActivityKindMeta> = {
    insert: { icon: Plus, label: 'Inserção', groupLabel: 'Inserções', className: 'text-success' },
    import: { icon: Import, label: 'Importação', groupLabel: 'Importações', className: 'text-primary' },
    remove: { icon: Minus, label: 'Exclusão', groupLabel: 'Exclusões', className: 'text-destructive' },
    edit: { icon: Pencil, label: 'Edição', groupLabel: 'Edições', className: 'text-muted-foreground' },
    undo: { icon: Undo2, label: 'Desfazer', groupLabel: 'Desfazer', className: 'text-warning' },
    redo: { icon: Redo2, label: 'Refazer', groupLabel: 'Refazer', className: 'text-warning' },
};
