'use client';
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Plus } from 'lucide-react';
import { SearchField } from '@/engine/ui/search-field';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { addFolder } from '@/engine/editor/operations/entity-operations';
import { AddEntityMenu } from '@/engine/editor/menus/add-entity-menu';
type HierarchyToolbarProps = {
    query: string;
    onQueryChange: (query: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onFolderCreated: (id: number) => void;
};
const ADD_BUTTON_CLASS = `inline-flex size-control shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight data-[popup-open]:text-foreground [&_svg]:size-3.5 ${FOCUS_RING_CLASS}`;
export function HierarchyToolbar({ query, onQueryChange, onExpandAll, onCollapseAll, onFolderCreated }: HierarchyToolbarProps) {
    const session = useEditorSession();
    const hint = useShortcutHint();
    return (<PanelToolbar>
      <AddEntityMenu trigger={<button type="button" aria-label="Adicionar ator" title="Adicionar ator" className={ADD_BUTTON_CLASS}/>}>
        <Plus />
      </AddEntityMenu>
      <IconButton label={hint('Nova pasta', 'edit.newFolder')} size="sm" onClick={() => onFolderCreated(addFolder(session).id)}>
        <FolderPlus />
      </IconButton>
      <SearchField placeholder="Filtrar atores" value={query} onChange={onQueryChange}/>
      <IconButton label="Expandir tudo" size="sm" onClick={onExpandAll}>
        <ChevronsUpDown />
      </IconButton>
      <IconButton label="Recolher tudo" size="sm" onClick={onCollapseAll}>
        <ChevronsDownUp />
      </IconButton>
    </PanelToolbar>);
}
