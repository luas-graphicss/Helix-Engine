'use client';
import { ArrowLeft, Code2, FileCode2, FileUp, FlaskConical, FolderOpen, Hammer, Languages, Play, Plus, Save, SaveAll, Star, Terminal, X } from 'lucide-react';
import { DropdownMenuCheckboxItem, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, } from '@/components/ui/dropdown-menu';
import { CODE_PRESENTATION_HINT, CODE_PRESENTATION_LABEL, CODE_PRESENTATIONS, type CodePresentation } from '@/engine/editor/code/code-editor';
import { CODE_PRESENTATION_ICON } from '@/engine/editor/code/ui/code-view-menu';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { useCodeEditor } from '@/engine/editor/code/ui/use-code-editor';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { closeCodeWorkspace, compileProject, createScript, importScripts, mixLanguagesEnabled, openScriptAssetInEditor, revealCodeEditor, runActiveScript, saveActiveScript, saveAllScripts, setEntryScript, } from '@/engine/editor/operations/script-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_FAMILIES, SCRIPT_FAMILY_LABEL, languagesByFamily, scriptLanguage } from '@/engine/scripting/script-languages';
import { SCRIPT_TEMPLATES, scriptTemplatesFor } from '@/engine/scripting/script-templates';
import { useBetaFeaturesVersion } from '@/engine/settings/beta-features';
import { MenuShortcut } from './menu-shortcut';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from './menu-styles';
const NO_ENTRY = '';
export function CodeMenuItems() {
    const session = useSessionTopic('scene', 'assets', 'workspace');
    const code = useCodeEditor();
    useBetaFeaturesVersion();
    const mixLanguages = mixLanguagesEnabled();
    const scripts = session.library.byKind('script');
    const { baseLanguage, entryScriptId } = session.scene.scripting;
    const templates = baseLanguage ? scriptTemplatesFor(baseLanguage) : SCRIPT_TEMPLATES;
    const active = code.activeTab;
    const coding = session.workspace === 'code';
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
            <Plus aria-hidden/>
            Novo script
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={MENU_CONTENT_CLASS}>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>{baseLanguage ? `Em ${scriptLanguage(baseLanguage).label}` : 'A partir de um modelo'}</DropdownMenuLabel>
            {templates.map((template) => (<DropdownMenuItem key={template.id} className={MENU_ITEM_CLASS} onClick={() => void createScript(session, { templateId: template.id })}>
                <FileCode2 aria-hidden/>
                {template.label}
              </DropdownMenuItem>))}
            {mixLanguages && (<>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
                    <FlaskConical aria-hidden/>
                    Em outra linguagem (beta)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} max-h-[70vh] overflow-y-auto`}>
                    {SCRIPT_FAMILIES.map((family) => (<DropdownMenuGroup key={family}>
                        <DropdownMenuLabel className={MENU_LABEL_CLASS}>{SCRIPT_FAMILY_LABEL[family]}</DropdownMenuLabel>
                        {languagesByFamily(family).map((language) => (<DropdownMenuItem key={language.id} className={MENU_ITEM_CLASS} disabled={language.id === baseLanguage} onClick={() => void createScript(session, { language: language.id })}>
                            <LanguageTag language={language.id} silent/>
                            {language.label}
                          </DropdownMenuItem>))}
                      </DropdownMenuGroup>))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS} disabled={scripts.length === 0}>
            <FolderOpen aria-hidden/>
            Abrir script da biblioteca
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} max-h-[70vh] overflow-y-auto`}>
            {scripts.map((asset) => (<DropdownMenuItem key={asset.id} className={MENU_ITEM_CLASS} onClick={() => void openScriptAssetInEditor(session, asset, { pin: true })}>
                {asset.details.kind === 'script' ? <LanguageTag language={asset.details.language} silent/> : <FileCode2 aria-hidden/>}
                {asset.name}
                {code.tab(asset.id) && <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>aberto</DropdownMenuShortcut>}
              </DropdownMenuItem>))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void importScripts(session)}>
          <FileUp aria-hidden/>
          Importar arquivos de código…
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!active || !code.isDirty(active)} onClick={() => void saveActiveScript(session)}>
          <Save aria-hidden/>
          Salvar o script
          <MenuShortcut action="code.save"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!code.anyDirty} onClick={() => void saveAllScripts(session)}>
          <SaveAll aria-hidden/>
          Salvar todos
          <MenuShortcut action="code.saveAll"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!active} onClick={() => void runActiveScript(session)}>
          <Play aria-hidden/>
          Executar o script
          <MenuShortcut action="code.run"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void compileProject(session)}>
          <Hammer aria-hidden/>
          Compilar o projeto
          <MenuShortcut action="code.compile"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('baseLanguage')}>
          <Languages aria-hidden/>
          {baseLanguage ? `Linguagem base: ${scriptLanguage(baseLanguage).label}…` : 'Escolher a linguagem base…'}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS} disabled={scripts.length === 0}>
            <Star aria-hidden/>
            Script de entrada
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} max-h-[70vh] overflow-y-auto`}>
            <DropdownMenuRadioGroup value={entryScriptId ?? NO_ENTRY} onValueChange={(value) => setEntryScript(session, value === NO_ENTRY ? null : value)}>
              <DropdownMenuRadioItem className={MENU_ITEM_CLASS} value={NO_ENTRY}>
                Pela ordem da hierarquia
              </DropdownMenuRadioItem>
              {scripts.map((asset) => (<DropdownMenuRadioItem key={asset.id} className={MENU_ITEM_CLASS} value={asset.id}>
                  {asset.name}
                </DropdownMenuRadioItem>))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={code.commandBarVisible} onCheckedChange={(checked) => code.setCommandBarVisible(checked)}>
          <Terminal aria-hidden/>
          Barra de comando
          <MenuShortcut action="code.toggleCommandBar"/>
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
            <Code2 aria-hidden/>
            Mostrar o editor em
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} w-72`}>
            <DropdownMenuRadioGroup value={code.presentation} onValueChange={(value) => revealCodeEditor(session, value as CodePresentation)}>
              {CODE_PRESENTATIONS.map((presentation) => {
            const Icon = CODE_PRESENTATION_ICON[presentation];
            return (<DropdownMenuRadioItem key={presentation} className={`${MENU_ITEM_CLASS} items-start`} value={presentation}>
                    <Icon aria-hidden className="mt-0.5"/>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span>{CODE_PRESENTATION_LABEL[presentation]}</span>
                      <span className="text-3xs leading-relaxed text-muted-foreground">{CODE_PRESENTATION_HINT[presentation]}</span>
                    </span>
                  </DropdownMenuRadioItem>);
        })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {coding ? (<>
            <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!code.isOpen} onClick={() => void closeCodeWorkspace(session)}>
              <X aria-hidden/>
              Fechar o editor (salva o pendente)
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => session.setWorkspace('scene')}>
              <ArrowLeft aria-hidden/>
              Voltar à cena 3D
              <MenuShortcut action="view.code"/>
            </DropdownMenuItem>
          </>) : (<DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => revealCodeEditor(session)}>
            <Code2 aria-hidden/>
            Abrir o editor de código
            <MenuShortcut action="view.code"/>
          </DropdownMenuItem>)}
      </DropdownMenuGroup>
    </>);
}
