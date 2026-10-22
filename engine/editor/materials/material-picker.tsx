'use client';
import type { ReactElement, ReactNode } from 'react';
import { Check, LoaderCircle, Palette, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import type { MaterialDocument } from '@/engine/materials/material-document';
import { openMaterialEditor } from './material-editor-requests';
import { materialCaption, MaterialSwatch } from './material-swatch';
type MaterialPickerOptions = {
    appliedId?: string | null;
    onPick: (document: MaterialDocument) => void;
};
const LIST_CLASS = 'max-h-80 overflow-y-auto';
function MaterialRow({ document, applied }: {
    document: MaterialDocument;
    applied: boolean;
}) {
    return (<>
      <MaterialSwatch document={document} className="size-5" resolution={40}/>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', applied && 'font-medium')}>{document.name}</span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{materialCaption(document)}</span>
      </span>
      {applied && <Check className="ml-auto text-primary!" aria-label="Em uso"/>}
    </>);
}
function useMaterialPicker() {
    const session = useEditorState();
    const library = session.materials;
    const createAndEdit = () => openMaterialEditor({ materialId: library.create().id });
    return { documents: library.all, loading: library.status === 'loading', createAndEdit, openEditor: () => openMaterialEditor() };
}
type MaterialPickerMenuProps = MaterialPickerOptions & {
    trigger: ReactElement;
    children?: ReactNode;
    align?: 'start' | 'end' | 'center';
};
export function MaterialPickerMenu({ trigger, children, appliedId = null, onPick, align = 'end' }: MaterialPickerMenuProps) {
    const { documents, loading, createAndEdit, openEditor } = useMaterialPicker();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn(MENU_CONTENT_CLASS, 'min-w-64')}>
        <DropdownMenuGroup className={LIST_CLASS}>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Biblioteca de materiais</DropdownMenuLabel>
          {loading && (<DropdownMenuItem className={MENU_ITEM_CLASS} disabled>
              <LoaderCircle className="animate-spin" aria-hidden/> Carregando…
            </DropdownMenuItem>)}
          {!loading && documents.length === 0 && (<DropdownMenuItem className={MENU_ITEM_CLASS} disabled>
              Nenhum material salvo ainda
            </DropdownMenuItem>)}
          {documents.map((document) => (<DropdownMenuItem key={document.id} className={MENU_ITEM_CLASS} onClick={() => onPick(document)}>
              <MaterialRow document={document} applied={document.id === appliedId}/>
            </DropdownMenuItem>))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={createAndEdit}>
            <Plus aria-hidden/>
            Novo material…
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={openEditor}>
            <Palette aria-hidden/>
            Abrir editor de materiais
            <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>M</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
type MaterialPickerSubmenuProps = MaterialPickerOptions & {
    label: string;
    icon: ReactElement;
};
export function MaterialPickerSubmenu({ label, icon, appliedId = null, onPick }: MaterialPickerSubmenuProps) {
    const { documents, loading, createAndEdit, openEditor } = useMaterialPicker();
    return (<ContextMenuSub>
      <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
        {icon}
        {label}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={cn(MENU_CONTENT_CLASS, 'min-w-64')}>
        <ContextMenuGroup className={LIST_CLASS}>
          <ContextMenuLabel className={MENU_LABEL_CLASS}>Biblioteca de materiais</ContextMenuLabel>
          {loading && (<ContextMenuItem className={MENU_ITEM_CLASS} disabled>
              <LoaderCircle className="animate-spin" aria-hidden/> Carregando…
            </ContextMenuItem>)}
          {!loading && documents.length === 0 && (<ContextMenuItem className={MENU_ITEM_CLASS} disabled>
              Nenhum material salvo ainda
            </ContextMenuItem>)}
          {documents.map((document) => (<ContextMenuItem key={document.id} className={MENU_ITEM_CLASS} onClick={() => onPick(document)}>
              <MaterialRow document={document} applied={document.id === appliedId}/>
            </ContextMenuItem>))}
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={createAndEdit}>
            <Plus aria-hidden/>
            Novo material…
          </ContextMenuItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} onClick={openEditor}>
            <Palette aria-hidden/>
            Abrir editor de materiais
            <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>M</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>);
}
