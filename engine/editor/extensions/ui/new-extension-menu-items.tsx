'use client';
import { FileCode2, FilePlus2 } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { EXECUTABLE_LANGUAGES } from '@/engine/scripting/compiler/script-compiler';
import { addExtensionScript, isExtensionScript } from '../host/extension-scripts';
import { createExtension } from '../templates/create-extension';
import { EXTENSION_TEMPLATES } from '../templates/extension-templates';
export function NewExtensionMenuItems() {
    const session = useSessionTopic('assets', 'scene');
    const candidates = session.library.byKind('script').filter((asset) => asset.details.kind === 'script' && EXECUTABLE_LANGUAGES.includes(asset.details.language) && !isExtensionScript(session, asset.id));
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuLabel className={MENU_LABEL_CLASS}>A partir de um modelo</DropdownMenuLabel>
        {EXTENSION_TEMPLATES.map((template) => (<DropdownMenuItem key={template.id} className={`${MENU_ITEM_CLASS} items-start`} onClick={() => void createExtension(session, template)}>
            <FilePlus2 aria-hidden className="mt-0.5"/>
            <span className="flex min-w-0 flex-col">
              <span>{template.label}</span>
              <span className="text-3xs text-pretty text-muted-foreground">{template.description}</span>
            </span>
          </DropdownMenuItem>))}
      </DropdownMenuGroup>
      {candidates.length > 0 && (<>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Usar um script da biblioteca</DropdownMenuLabel>
            {candidates.map((asset) => (<DropdownMenuItem key={asset.id} className={MENU_ITEM_CLASS} onClick={() => addExtensionScript(session, asset)}>
                <FileCode2 aria-hidden/>
                <span className="min-w-0 truncate">{asset.name}</span>
              </DropdownMenuItem>))}
          </DropdownMenuGroup>
        </>)}
    </>);
}
