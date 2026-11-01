'use client';
import { FileCode2, Link2, PenLine, Play, Plus, Power, Star, Unlink } from 'lucide-react';
import { ContextMenuCheckboxItem, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { attachScriptToEntity, canCarryScript, createScript, detachScript, openScriptActor, runScript, scriptAssetOf, setEntryScript, setScriptEnabled } from '@/engine/editor/operations/script-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_TEMPLATES, scriptTemplatesFor } from '@/engine/scripting/script-templates';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './menu-styles';
type ScriptContextActionsProps = {
    selection: readonly Entity[];
};
export function ScriptContextActions({ selection }: ScriptContextActionsProps) {
    const session = useSessionTopic('scene', 'assets');
    const scriptActors = selection.filter((entity) => entity.kind === 'script');
    const single = selection.length === 1 ? selection[0] : null;
    const singleScript = single && single.kind === 'script' ? single : null;
    const attachable = single && canCarryScript(single) ? single : null;
    if (scriptActors.length === 0 && !attachable)
        return null;
    const asset = singleScript ? scriptAssetOf(session, singleScript) : null;
    const allEnabled = scriptActors.length > 0 && scriptActors.every((entity) => entity.script?.enabled);
    const isEntry = asset !== null && session.scene.scripting.entryScriptId === asset.id;
    const plural = scriptActors.length > 1 ? ` (${scriptActors.length})` : '';
    const library = session.library.byKind('script');
    const { baseLanguage } = session.scene.scripting;
    const templates = baseLanguage ? scriptTemplatesFor(baseLanguage) : SCRIPT_TEMPLATES;
    return (<>
      {scriptActors.length > 0 && (<ContextMenuGroup>
          {singleScript && (<ContextMenuItem className={MENU_ITEM_CLASS} disabled={!asset} onClick={() => void openScriptActor(session, singleScript)}>
              <PenLine aria-hidden/>
              Abrir o código
            </ContextMenuItem>)}
          {asset && (<>
              <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => void runScript(session, asset)}>
                <Play aria-hidden/>
                Executar o script
              </ContextMenuItem>
              <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={isEntry} onCheckedChange={(checked) => setEntryScript(session, checked ? asset.id : null)}>
                <Star aria-hidden/>
                Script de entrada do jogo
              </ContextMenuCheckboxItem>
            </>)}
          <ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={allEnabled} onCheckedChange={(checked) => scriptActors.forEach((entity) => setScriptEnabled(session, entity, checked))}>
            <Power aria-hidden/>
            Script ativado{plural}
          </ContextMenuCheckboxItem>
          <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => scriptActors.forEach((entity) => detachScript(session, entity))}>
            <Unlink aria-hidden/>
            Remover do ator{plural} (o código fica na biblioteca)
          </ContextMenuItem>
        </ContextMenuGroup>)}
      {attachable && (<ContextMenuGroup>
          {library.length > 0 && (<ContextMenuSub>
              <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
                <Link2 aria-hidden/>
                Anexar script
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} max-h-[60vh] overflow-y-auto`}>
                {library.map((script) => (<ContextMenuItem key={script.id} className={MENU_ITEM_CLASS} onClick={() => attachScriptToEntity(session, attachable, script.id)}>
                    {script.details.kind === 'script' ? <LanguageTag language={script.details.language} silent/> : <FileCode2 aria-hidden/>}
                    {script.name}
                  </ContextMenuItem>))}
              </ContextMenuSubContent>
            </ContextMenuSub>)}
          <ContextMenuSub>
            <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
              <Plus aria-hidden/>
              Anexar script novo
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-64`}>
              {templates.map((template) => (<ContextMenuItem key={template.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => void createScript(session, { templateId: template.id, attachTo: attachable })}>
                  <span>{template.label}</span>
                  <span className="text-3xs text-muted-foreground">{template.description}</span>
                </ContextMenuItem>))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>)}
      <ContextMenuSeparator />
    </>);
}
