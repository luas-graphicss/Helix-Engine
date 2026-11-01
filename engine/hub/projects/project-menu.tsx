'use client';
import { Copy, Download, FolderOpen, History, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import type { ProjectRecord } from '@/engine/project/project-record';
import { useHub } from '../hub-context';
interface ProjectMenuEntry {
    label: string;
    icon: LucideIcon;
    run(): void;
    destructive?: boolean;
}
function useProjectMenuEntries(record: ProjectRecord): ProjectMenuEntry[][] {
    const { actions, setDialog } = useHub();
    return [
        [
            { label: 'Abrir', icon: FolderOpen, run: () => actions.openProject(record) },
            { label: 'Renomear…', icon: Pencil, run: () => setDialog({ kind: 'rename', record }) },
            { label: 'Duplicar', icon: Copy, run: () => void actions.duplicate(record) },
        ],
        [
            { label: 'Exportar arquivo (.helix)', icon: Download, run: () => void actions.exportProject(record) },
            { label: 'Histórico de versões…', icon: History, run: () => setDialog({ kind: 'history', record }) },
        ],
        [{ label: 'Mover para a lixeira', icon: Trash2, run: () => void actions.moveToTrash(record), destructive: true }],
    ];
}
export function ProjectDropdownContent({ record }: {
    record: ProjectRecord;
}) {
    const groups = useProjectMenuEntries(record);
    return (<DropdownMenuContent align="end" sideOffset={4} className={MENU_CONTENT_CLASS}>
      {groups.map((group, index) => (<DropdownMenuGroup key={index}>
          {index > 0 && <DropdownMenuSeparator />}
          {group.map((entry) => (<DropdownMenuItem key={entry.label} className={MENU_ITEM_CLASS} variant={entry.destructive ? 'destructive' : 'default'} onClick={entry.run}>
              <entry.icon aria-hidden/>
              {entry.label}
            </DropdownMenuItem>))}
        </DropdownMenuGroup>))}
    </DropdownMenuContent>);
}
export function ProjectContextContent({ record }: {
    record: ProjectRecord;
}) {
    const groups = useProjectMenuEntries(record);
    return (<ContextMenuContent className={MENU_CONTENT_CLASS}>
      {groups.map((group, index) => (<ContextMenuGroup key={index}>
          {index > 0 && <ContextMenuSeparator />}
          {group.map((entry) => (<ContextMenuItem key={entry.label} className={MENU_ITEM_CLASS} variant={entry.destructive ? 'destructive' : 'default'} onClick={entry.run}>
              <entry.icon aria-hidden/>
              {entry.label}
            </ContextMenuItem>))}
        </ContextMenuGroup>))}
    </ContextMenuContent>);
}
