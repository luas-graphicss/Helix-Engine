'use client';
import { BackIcon, EntryFlagIcon, ImportIcon, LanguageIcon, NewScriptIcon, ScriptFileIcon, TemplateIcon } from '../icons/code-icons';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { createScript, importScripts, openScriptAssetInEditor, scriptActorsFor, setBaseLanguage } from '@/engine/editor/operations/script-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_RUN_CONTEXT_LABEL } from '@/engine/scripting/script-document';
import { SCRIPT_COMPILER_STATUS_LABEL, baseLanguageCandidates, scriptLanguage, type ScriptLanguage } from '@/engine/scripting/script-languages';
import { SCRIPT_TEMPLATES, scriptTemplatesFor } from '@/engine/scripting/script-templates';
import { ActionButton } from '@/engine/ui/action-button';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { LanguageTag } from './language-tag';
const CARD_CLASS = 'group flex flex-col gap-2 rounded-sm border border-border bg-surface p-2 text-left transition-colors hover:border-primary/60 hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary';
function LanguageCard({ language, onPick }: {
    language: ScriptLanguage;
    onPick: () => void;
}) {
    return (<button type="button" onClick={onPick} className={cn(CARD_CLASS, language.recommended && 'border-primary/40')}>
      <span className="flex items-center gap-2">
        <LanguageTag language={language.id} size="sm" silent/>
        <span className="truncate text-2xs font-medium text-foreground">{language.label}</span>
        {language.recommended && <span className="ml-auto shrink-0 font-mono text-3xs tracking-wider text-primary uppercase">recomendada</span>}
      </span>
      <span className="line-clamp-3 text-3xs leading-relaxed text-muted-foreground">{language.description}</span>
      <span className="font-mono text-3xs text-muted-foreground">{SCRIPT_COMPILER_STATUS_LABEL[language.compiler]}</span>
    </button>);
}
function ScriptCard({ asset, onOpen }: {
    asset: LibraryAsset;
    onOpen: () => void;
}) {
    const session = useSessionTopic('scene', 'assets', 'workspace');
    const details = asset.details.kind === 'script' ? asset.details : null;
    const isEntry = session.scene.scripting.entryScriptId === asset.id;
    const actors = scriptActorsFor(session, asset.id).length;
    return (<button type="button" onClick={onOpen} className={CARD_CLASS}>
      <span className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xs bg-surface-sunken">
        {asset.thumbnail ? <ImageBlobThumbnail blob={asset.thumbnail.blob} alt=""/> : <ScriptFileIcon className="size-6 text-muted-foreground" aria-hidden/>}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          {details && <LanguageTag language={details.language} silent/>}
          <span className="truncate text-2xs font-medium text-foreground">{asset.name}</span>
          {isEntry && <EntryFlagIcon className="ml-auto size-3 shrink-0 fill-current text-primary" aria-label="Script de entrada"/>}
        </span>
        {details && (<span className="truncate font-mono text-3xs text-muted-foreground">
            {details.lines} {details.lines === 1 ? 'linha' : 'linhas'} · {SCRIPT_RUN_CONTEXT_LABEL[details.runContext].toLowerCase()}
            {actors > 0 && ` · ${actors} ${actors === 1 ? 'ator' : 'atores'}`}
          </span>)}
      </span>
    </button>);
}
function LanguageSection({ readOnly }: {
    readOnly: boolean;
}) {
    const session = useSessionTopic('scene', 'assets', 'workspace');
    const { baseLanguage } = session.scene.scripting;
    if (!baseLanguage && readOnly) {
        return (<section className="flex flex-col gap-3">
        <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Linguagem do jogo</h2>
        <p className={cn('px-4 py-4 text-center text-2xs', EMPTY_NOTE_CLASS)}>Este jogo ainda não tem linguagem base. Escolha-a no editor principal (menu Código ▸ Escolher a linguagem base) e volte a esta aba.</p>
      </section>);
    }
    if (!baseLanguage) {
        return (<section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Primeiro, a linguagem do jogo</h2>
          <button type="button" onClick={() => editorDialogs.open('baseLanguage')} className="text-2xs text-primary hover:underline">
            Ver todas as linguagens…
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
          {baseLanguageCandidates()
                .filter((language) => language.family === 'scripting')
                .map((language) => (<LanguageCard key={language.id} language={language} onPick={() => setBaseLanguage(session, language.id)}/>))}
        </div>
      </section>);
    }
    const language = scriptLanguage(baseLanguage);
    return (<section className="flex flex-col gap-3">
      <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Linguagem do jogo</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-surface p-3">
        <LanguageTag language={language.id} size="sm" silent/>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-2xs font-medium text-foreground">{language.label}</span>
          <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">
            {language.description} {SCRIPT_COMPILER_STATUS_LABEL[language.compiler]}.
          </span>
        </div>
        {!readOnly && (<ActionButton icon={LanguageIcon} onClick={() => editorDialogs.open('baseLanguage')} className="h-6 shrink-0">
            Trocar…
          </ActionButton>)}
      </div>
    </section>);
}
export function CodeEmptyState() {
    const session = useSessionTopic('scene', 'assets', 'workspace');
    const { standalone } = session.code;
    const { baseLanguage } = session.scene.scripting;
    const templates = baseLanguage ? scriptTemplatesFor(baseLanguage) : SCRIPT_TEMPLATES;
    const scripts = session.library.byKind('script');
    return (<div className="@container absolute inset-0 overflow-auto bg-surface-sunken">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 @2xl:gap-8 @2xl:px-8 @2xl:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-3xs tracking-wider text-primary uppercase">Editor de código</span>
            <h1 className="text-base font-semibold text-balance text-foreground @2xl:text-lg">Programe o jogo na linguagem que escolher: scripts controlam atores na hierarquia, como no Roblox Studio, e vivem na biblioteca como qualquer ativo.</h1>
            <p className="max-w-2xl text-2xs leading-relaxed text-pretty text-muted-foreground">
              Um jogo tem uma linguagem base, e todo script nasce nela. Cada script da biblioteca é um arquivo de código puro (abre em qualquer editor), pode controlar vários atores e roda onde declarar: compartilhado, só no cliente ou só no servidor. Para misturar linguagens, ligue a mesclagem em Helix ▸ Funcionalidades beta.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ActionButton icon={ImportIcon} onClick={() => void importScripts(session)}>
              Importar scripts…
            </ActionButton>
            {!standalone && (<ActionButton icon={BackIcon} onClick={() => session.setWorkspace('scene')}>
                Voltar à cena
              </ActionButton>)}
          </div>
        </header>

        <LanguageSection readOnly={standalone}/>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{baseLanguage ? `Começar com um modelo em ${scriptLanguage(baseLanguage).label}` : 'Começar com um modelo'}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
            {templates.map((template) => (<button key={template.id} type="button" onClick={() => void createScript(session, { templateId: template.id })} className={CARD_CLASS}>
                <span className="flex items-center gap-2">
                  {template.id === 'blank' ? <NewScriptIcon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden/> : <TemplateIcon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden/>}
                  <span className="truncate text-2xs font-medium text-foreground">{template.label}</span>
                  <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground">{SCRIPT_RUN_CONTEXT_LABEL[template.runContext].toLowerCase()}</span>
                </span>
                <span className="line-clamp-2 text-3xs leading-relaxed text-muted-foreground">{template.description}</span>
              </button>))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Scripts da biblioteca</h2>
          {scripts.length === 0 ? (<p className={cn('px-4 py-6 text-center text-2xs', EMPTY_NOTE_CLASS)}>Nenhum script guardado ainda. Crie um a partir de um modelo acima; ele é salvo na biblioteca e pode ser anexado a qualquer ator.</p>) : (<div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3">
              {scripts.map((asset) => (<ScriptCard key={asset.id} asset={asset} onOpen={() => void openScriptAssetInEditor(session, asset, { pin: true })}/>))}
            </div>)}
        </section>
      </div>
    </div>);
}
