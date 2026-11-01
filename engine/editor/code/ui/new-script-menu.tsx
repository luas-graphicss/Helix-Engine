'use client';
import type { ReactElement, ReactNode } from 'react';
import { BetaIcon, ChevronDownIcon, LanguageIcon, PlusIcon, ResourceIcon, TemplateIcon } from '../icons/code-icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { createScript, mixLanguagesEnabled } from '@/engine/editor/operations/script-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { ASSET_LANGUAGE_FAMILIES, SCRIPT_FAMILIES, SCRIPT_FAMILY_LABEL, languagesByFamily, scriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { SCRIPT_TEMPLATES, scriptTemplatesFor } from '@/engine/scripting/script-templates';
import { useBetaFeaturesVersion } from '@/engine/settings/beta-features';
import { cn } from '@/lib/utils';
import { ContextChip } from './context-chip';
import { LanguageTag } from './language-tag';
type NewScriptMenuProps = {
    attachTo?: Entity | null;
    trigger?: ReactElement;
    triggerContent?: ReactNode;
    align?: 'start' | 'end';
};
function defaultTemplateFor(language: ScriptLanguageId) {
    const templates = scriptTemplatesFor(language);
    return (templates.find((template) => template.id === 'actor') ?? templates.find((template) => template.families.length > 0) ?? templates[0]).id;
}
export function NewScriptMenu({ attachTo, trigger, triggerContent, align = 'start' }: NewScriptMenuProps) {
    const session = useSessionTopic('scene', 'assets');
    useBetaFeaturesVersion();
    const mixLanguages = mixLanguagesEnabled();
    const { baseLanguage } = session.scene.scripting;
    const templates = baseLanguage ? scriptTemplatesFor(baseLanguage) : SCRIPT_TEMPLATES;
    const base = baseLanguage ? scriptLanguage(baseLanguage) : null;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={trigger ?? (<button type="button" className={cn('inline-flex h-7 items-center gap-1 rounded-sm px-1.5 text-2xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight data-[popup-open]:text-foreground [&_svg]:size-3.5')}/>)}>
        {triggerContent ?? (<>
            <PlusIcon className="text-primary" aria-hidden/>
            Novo script
            <ChevronDownIcon className="!size-3" aria-hidden/>
          </>)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={4} className={`${MENU_CONTENT_CLASS} w-72`}>
        {base ? (<DropdownMenuGroup>
            <DropdownMenuLabel className={`${MENU_LABEL_CLASS} flex items-center gap-1.5`}>
              Em {base.label}
              <LanguageTag language={base.id} silent/>
            </DropdownMenuLabel>
            {templates.map((template) => (<DropdownMenuItem key={template.id} className={`${MENU_ITEM_CLASS} items-start`} onClick={() => void createScript(session, { templateId: template.id, attachTo })}>
                <TemplateIcon aria-hidden className="mt-0.5"/>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate">{template.label}</span>
                    <ContextChip context={template.runContext} quiet/>
                  </span>
                  <span className="text-3xs leading-relaxed text-muted-foreground">{template.description}</span>
                </span>
              </DropdownMenuItem>))}
          </DropdownMenuGroup>) : (<DropdownMenuGroup>
            <DropdownMenuItem className={`${MENU_ITEM_CLASS} items-start`} disabled={session.code.standalone} onClick={() => editorDialogs.open('baseLanguage')}>
              <LanguageIcon aria-hidden className="mt-0.5 !text-primary"/>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{session.code.standalone ? 'Sem linguagem base' : 'Escolher a linguagem base…'}</span>
                <span className="text-3xs leading-relaxed text-muted-foreground">{session.code.standalone ? 'Escolha-a no editor principal (menu Código) e volte a esta aba.' : 'Todo script do jogo nasce nela. A escolha é desfazível e pode mudar depois.'}</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>)}
        {base && !mixLanguages && (<>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
                  <ResourceIcon aria-hidden/>
                  Recurso: shader, interface, dados
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} max-h-[70vh] w-64 overflow-y-auto`}>
                  {ASSET_LANGUAGE_FAMILIES.map((family) => (<DropdownMenuGroup key={family}>
                      <DropdownMenuLabel className={MENU_LABEL_CLASS}>{SCRIPT_FAMILY_LABEL[family]}</DropdownMenuLabel>
                      {languagesByFamily(family).map((language) => (<DropdownMenuItem key={language.id} className={MENU_ITEM_CLASS} onClick={() => void createScript(session, { language: language.id, templateId: defaultTemplateFor(language.id), attachTo })}>
                          <LanguageTag language={language.id} silent/>
                          {language.label}
                        </DropdownMenuItem>))}
                    </DropdownMenuGroup>))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </>)}
        {mixLanguages && (<>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
                  <BetaIcon aria-hidden/>
                  Em outra linguagem (beta)
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} max-h-[70vh] w-64 overflow-y-auto`}>
                  {SCRIPT_FAMILIES.map((family) => (<DropdownMenuGroup key={family}>
                      <DropdownMenuLabel className={MENU_LABEL_CLASS}>{SCRIPT_FAMILY_LABEL[family]}</DropdownMenuLabel>
                      {languagesByFamily(family).map((language) => (<DropdownMenuItem key={language.id} className={MENU_ITEM_CLASS} disabled={language.id === baseLanguage} onClick={() => void createScript(session, { language: language.id, templateId: defaultTemplateFor(language.id), attachTo })}>
                          <LanguageTag language={language.id} silent/>
                          {language.label}
                        </DropdownMenuItem>))}
                    </DropdownMenuGroup>))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </>)}
      </DropdownMenuContent>
    </DropdownMenu>);
}
