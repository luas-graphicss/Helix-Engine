'use client';
import { useRouter } from 'next/navigation';
import { Download, FilePlus2, FlaskConical, History, Info, Keyboard, LogOut, Package, Settings2, X } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { betaFeatures, useBetaFeaturesVersion } from '@/engine/settings/beta-features';
import { engineSettings, useEngineSettingsVersion } from '@/engine/settings/engine-settings-store';
import { editorDialogs } from '../dialogs/editor-dialogs';
import { closeProject, createProjectFromEditor } from '../operations/engine-operations';
import { exportOpenProject } from '../operations/project-operations';
import { useEditorSession } from '../session/editor-session-context';
import { MenuShortcut } from './menu-shortcut';
import { MENU_ITEM_CLASS } from './menu-styles';
import { RecentProjectsSubmenu } from './recent-projects-submenu';
function ItemCount({ count, label }: {
    count: number;
    label: string;
}) {
    if (count === 0)
        return null;
    return (<span className="ml-auto pl-3 font-mono text-3xs text-primary/80">
      {count} {label}
    </span>);
}
export function HelixMenuItems() {
    const session = useEditorSession();
    const router = useRouter();
    useBetaFeaturesVersion();
    useEngineSettingsVersion();
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void createProjectFromEditor(session, router)}>
          <FilePlus2 aria-hidden/>
          Novo jogo
          <MenuShortcut action="helix.newProject"/>
        </DropdownMenuItem>
        <RecentProjectsSubmenu />
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void closeProject(session, router)}>
          <X aria-hidden/>
          Fechar jogo
          <MenuShortcut action="helix.closeProject"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void exportOpenProject(session)}>
          <Download aria-hidden/>
          Baixar cópia do jogo (.helix)
          <MenuShortcut action="helix.download"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('build')}>
          <Package aria-hidden/>
          Compilar jogo para computador…
          <MenuShortcut action="helix.build"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('autosaves')}>
          <History aria-hidden/>
          Abrir salvamentos automáticos…
          <MenuShortcut action="helix.autosaves"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('shortcuts')}>
          <Keyboard aria-hidden/>
          Personalizar atalhos…
          <MenuShortcut action="helix.shortcuts"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('beta')}>
          <FlaskConical aria-hidden/>
          Funcionalidades beta…
          <ItemCount count={betaFeatures.enabledCount} label={betaFeatures.enabledCount === 1 ? 'ativa' : 'ativas'}/>
          <MenuShortcut action="helix.beta"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('settings')}>
          <Settings2 aria-hidden/>
          Configuração da Helix Engine…
          <ItemCount count={engineSettings.customizedCount} label={engineSettings.customizedCount === 1 ? 'alterada' : 'alteradas'}/>
          <MenuShortcut action="helix.settings"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('about')}>
          <Info aria-hidden/>
          Sobre a Helix Engine
          <MenuShortcut action="helix.about"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('exit')}>
          <LogOut aria-hidden/>
          Sair
          <MenuShortcut action="helix.exit"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
}
