'use client';
import { ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS } from '@/engine/editor/menus/menu-styles';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { NewExtensionMenuItems } from './new-extension-menu-items';
import { ExtensionScriptRow } from './panel/extension-script-row';
import { TrustNotice } from './panel/trust-notice';
import { useExtensionHost } from './use-extension-host';
import { WorkflowList } from './workflows/workflow-list';
function NewExtensionMenu() {
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-2xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight data-[popup-open]:text-foreground [&_svg]:size-3.5"/>}>
        <Plus className="text-primary" aria-hidden/>
        Nova extensão
        <ChevronDown className="!size-3" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className={`${MENU_CONTENT_CLASS} w-72`}>
        <NewExtensionMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>);
}
export function ExtensionsPanel() {
    useSessionTopic('assets', 'scene');
    const host = useExtensionHost();
    const scripts = host.describeScripts();
    const blocked = !host.trusted && scripts.length > 0;
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar className="gap-1 px-1.5">
        <NewExtensionMenu />
        <span className="flex-1"/>
        <IconButton label="Recarregar todas as extensões" size="sm" disabled={scripts.length === 0 || blocked} onClick={() => host.reloadAll()}>
          <RefreshCw />
        </IconButton>
      </PanelToolbar>
      {blocked && <TrustNotice count={scripts.length} onTrust={() => host.grantTrust()}/>}
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {scripts.length === 0 ? (<p className={cn('m-2 px-3 py-4 text-center text-2xs', EMPTY_NOTE_CLASS)}>Nenhuma extensão neste projeto. Crie a primeira em Nova extensão.</p>) : (scripts.map((script) => <ExtensionScriptRow key={script.assetId} script={script}/>))}
      </div>
      <WorkflowList />
    </div>);
}
