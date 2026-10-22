'use client';
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Plus } from 'lucide-react';
import { SearchField } from '@/engine/ui/search-field';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { addFolder } from '@/engine/editor/operations/entity-operations';
import { AddEntityMenu } from '@/engine/editor/menus/add-entity-menu';
type HierarchyToolbarProps = {
    query: string;
    onQueryChange: (query: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onFolderCreated: (id: number) => void;
};
const TOOL_BUTTON_CLASS = 'inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3.5';
export function HierarchyToolbar({ query, onQueryChange, onExpandAll, onCollapseAll, onFolderCreated }: HierarchyToolbarProps) {
    const session = useEditorState();
    return (<div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
      <AddEntityMenu trigger={<button type="button" aria-label="Adicionar ator" title="Adicionar ator" className={TOOL_BUTTON_CLASS}/>}>
        <Plus />
      </AddEntityMenu>
      <IconButton label="Nova pasta (Ctrl+Shift+N)" size="sm" className="size-6 [&_svg]:size-3.5" onClick={() => onFolderCreated(addFolder(session).id)}>
        <FolderPlus />
      </IconButton>
      <SearchField placeholder="Filtrar atores" value={query} onChange={onQueryChange}/>
      <IconButton label="Expandir tudo" size="sm" className="size-6 [&_svg]:size-3.5" onClick={onExpandAll}>
        <ChevronsUpDown />
      </IconButton>
      <IconButton label="Recolher tudo" size="sm" className="size-6 [&_svg]:size-3.5" onClick={onCollapseAll}>
        <ChevronsDownUp />
      </IconButton>
    </div>);
}
