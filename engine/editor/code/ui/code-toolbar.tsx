'use client';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { closeCodeWorkspace, compileProject, exportScriptDocument, importScripts, runActiveScript, saveActiveScript, saveAllScripts, setEntryScript, setScriptRunContext, stopScript } from '@/engine/editor/operations/script-operations';
import { shallowEqual, useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { SCRIPT_RUN_CONTEXT_DESCRIPTION, SCRIPT_RUN_CONTEXT_LABEL, SCRIPT_RUN_CONTEXTS, type ScriptRunContext } from '@/engine/scripting/script-document';
import { isShaderLanguage, scriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { cn } from '@/lib/utils';
import type { CodeEditor } from '../code-editor';
import { BuildIcon, CloseIcon, EntryFlagIcon, ExportIcon, FindIcon, ImportIcon, LanguageIcon, ReplaceIcon, RunIcon, SaveAllIcon, SaveIcon, StopIcon } from '../icons/code-icons';
import { CodePresentationMenu, CodeViewOptionsMenu } from './code-view-menu';
import { LanguageTag } from './language-tag';
import { NewScriptMenu } from './new-script-menu';
import { useCodeActions, useCodeSelector } from './use-code-editor';
const RUN_CONTEXT_OPTIONS = SCRIPT_RUN_CONTEXTS.map((context) => ({ value: context, label: SCRIPT_RUN_CONTEXT_LABEL[context] }));
function BaseLanguageChip({ readOnly }: {
    readOnly: boolean;
}) {
    const session = useSessionTopic('scene', 'assets');
    const { baseLanguage } = session.scene.scripting;
    const language = baseLanguage ? scriptLanguage(baseLanguage) : null;
    return (<button type="button" disabled={readOnly} onClick={() => editorDialogs.open('baseLanguage')} title={readOnly
            ? language
                ? `Linguagem base do jogo: ${language.label}. Para trocar, use o editor principal.`
                : 'Escolha a linguagem base no editor principal'
            : language
                ? `Linguagem base do jogo: ${language.label}. Clique para trocar.`
                : 'Escolha a linguagem base do jogo: todo script nasce nela'} className={cn('flex h-6 max-w-48 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-2xs transition-colors hover:bg-highlight disabled:pointer-events-none [&_svg]:size-3.5', FOCUS_RING_CLASS, language ? 'border-border text-foreground' : 'border-warning/60 text-warning hover:text-warning')}>
      <LanguageIcon aria-hidden className={language ? 'text-muted-foreground' : ''}/>
      {language ? (<>
          <LanguageTag language={language.id} silent/>
          <span className="truncate">{language.label}</span>
        </>) : (<span className="truncate">Escolher linguagem…</span>)}
    </button>);
}
type CodeToolbarProps = {
    compact?: boolean;
};
interface ToolbarView {
    active: {
        assetId: string;
        language: ScriptLanguageId;
        runContext: ScriptRunContext;
    } | null;
    dirty: boolean;
    anyDirty: boolean;
    standalone: boolean;
    findOpen: boolean;
    findReplace: boolean;
}
function selectToolbarView(code: CodeEditor): ToolbarView {
    const tab = code.activeTab;
    return {
        active: tab ? { assetId: tab.assetId, language: tab.document.language, runContext: tab.document.runContext } : null,
        dirty: tab ? code.isDirty(tab) : false,
        anyDirty: code.anyDirty,
        standalone: code.standalone,
        findOpen: code.find.open,
        findReplace: code.find.replace,
    };
}
function sameToolbarView(previous: ToolbarView, next: ToolbarView): boolean {
    return shallowEqual(previous.active, next.active) && shallowEqual({ ...previous, active: null }, { ...next, active: null });
}
export function CodeToolbar({ compact = false }: CodeToolbarProps) {
    const session = useEditorSession();
    const state = useSessionTopic('scene', 'assets');
    const code = useCodeActions();
    const view = useCodeSelector(selectToolbarView, sameToolbarView);
    const hint = useShortcutHint();
    const { active, dirty, anyDirty, standalone } = view;
    const isEntry = active ? session.scene.scripting.entryScriptId === active.assetId : false;
    const shader = active ? isShaderLanguage(active.language) : false;
    const { scripts } = state;
    const starting = scripts.starting;
    const toolRunning = scripts.running && scripts.mode === 'editor';
    const playing = state.playtest.state === 'playing' && scripts.running && scripts.mode === 'play';
    return (<div className="flex min-h-toolbar shrink-0 flex-wrap items-center gap-x-0.5 gap-y-0.5 border-b border-border bg-surface bg-linear-to-b from-bevel to-transparent px-1.5 py-0.5 shadow-bevel">
      <BaseLanguageChip readOnly={standalone}/>
      <NewScriptMenu />

      <ToolbarSeparator />

      <IconButton label={hint('Salvar o script', 'code.save')} size="md" disabled={!dirty} onClick={() => void saveActiveScript(session)}>
        <SaveIcon />
      </IconButton>
      <IconButton label={hint('Salvar todos', 'code.saveAll')} size="md" disabled={!anyDirty} onClick={() => void saveAllScripts(session)}>
        <SaveAllIcon />
      </IconButton>
      <IconButton label={shader ? 'Shaders não executam: compile-os ou use a pré-visualização na barra do shader' : hint(playing ? 'Recarregar o script no jogo em execução' : 'Executar o script', 'code.run')} size="md" disabled={!active || starting || shader} className="[&_svg]:text-axis-y disabled:[&_svg]:text-muted-foreground" onClick={() => void runActiveScript(session)}>
        <RunIcon />
      </IconButton>
      {toolRunning && (<IconButton label="Parar o script em execução" size="md" className="[&_svg]:text-destructive" onClick={() => stopScript(session)}>
          <StopIcon />
        </IconButton>)}
      <IconButton label={hint('Compilar o projeto', 'code.compile')} size="md" onClick={() => void compileProject(session)}>
        <BuildIcon />
      </IconButton>

      <ToolbarSeparator />

      <IconButton label={hint('Buscar', 'code.find')} size="md" active={view.findOpen && !view.findReplace} disabled={!active} onClick={() => code.openFind({ replace: false })}>
        <FindIcon />
      </IconButton>
      <IconButton label={hint('Buscar e substituir', 'code.replace')} size="md" active={view.findOpen && view.findReplace} disabled={!active} onClick={() => code.openFind({ replace: true })}>
        <ReplaceIcon />
      </IconButton>

      {active && !shader && (<>
          <ToolbarSeparator />
          <div className="w-44 shrink-0" title={SCRIPT_RUN_CONTEXT_DESCRIPTION[active.runContext]}>
            <SegmentedControl label="Onde o script roda" options={RUN_CONTEXT_OPTIONS} value={active.runContext} onChange={(context) => setScriptRunContext(session, active.assetId, context)}/>
          </div>
          {!standalone && (<IconButton label={isEntry ? 'Script de entrada do jogo (clique para desmarcar)' : 'Tornar este o script de entrada do jogo'} size="md" active={isEntry} onClick={() => setEntryScript(session, isEntry ? null : active.assetId)}>
              <EntryFlagIcon className={cn(isEntry && 'fill-current')}/>
            </IconButton>)}
        </>)}

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {!compact && (<>
            <IconButton label="Importar scripts…" size="md" onClick={() => void importScripts(session)}>
              <ImportIcon />
            </IconButton>
            <IconButton label="Exportar o script como arquivo" size="md" disabled={!active} onClick={() => {
                const document = code.activeTab?.document;
                if (document)
                    exportScriptDocument(document);
            }}>
              <ExportIcon />
            </IconButton>
            <ToolbarSeparator />
          </>)}
        <CodeViewOptionsMenu />
        {!standalone && <CodePresentationMenu compact={compact}/>}
        {!compact && !standalone && (<>
            <ToolbarSeparator />
            <IconButton label="Fechar o editor e voltar à cena (salva o pendente)" size="md" onClick={() => void closeCodeWorkspace(session)}>
              <CloseIcon />
            </IconButton>
          </>)}
      </div>
    </div>);
}
