'use client';
import { Pencil, Save } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { editorDialogs } from '../dialogs/editor-dialogs';
import { saveProjectNow } from '../operations/project-operations';
import { useSessionTopic } from '../session/editor-session-context';
import { MenuShortcut } from './menu-shortcut';
import { MENU_ITEM_CLASS } from './menu-styles';
export function ProjectMenuItems() {
    const session = useSessionTopic('project');
    const { state } = session.autosave;
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={state === 'saving'} onClick={() => void saveProjectNow(session)}>
          <Save aria-hidden/>
          {state === 'dirty' || state === 'error' ? 'Salvar agora' : 'Salvar'}
          <MenuShortcut action="file.save"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('renameProject')}>
          <Pencil aria-hidden/>
          Renomear jogo…
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>);
}
