'use client';
import { AppWindow, ExternalLink, FileCode2, PanelsTopLeft, PenLine, Play, Plus, Star, Trash2 } from 'lucide-react';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import { StatusChip } from '@/engine/editor/audio/ui/source-status';
import { CODE_PRESENTATION_HINT, CODE_PRESENTATION_LABEL, type CodePresentation } from '@/engine/editor/code/code-editor';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { useCodeSelector } from '@/engine/editor/code/ui/use-code-editor';
import { attachScriptToEntity, canCarryScript, createScript, defaultScriptAssetId, detachScript, openScriptAssetInEditor, runScript, scriptActorsFor, scriptAssetOf, setEntryScript, setScriptAsset, setScriptEnabled, } from '@/engine/editor/operations/script-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_RUN_CONTEXT_DESCRIPTION, SCRIPT_RUN_CONTEXT_LABEL } from '@/engine/scripting/script-document';
import { SCRIPT_COMPILER_STATUS_LABEL, scriptLanguage } from '@/engine/scripting/script-languages';
import { SCRIPT_TEMPLATES, scriptTemplatesFor, type ScriptTemplateId } from '@/engine/scripting/script-templates';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { AudioPresetsMenu } from './audio/audio-presets-menu';
const NONE = '';
const PRESENTATION_ICON: Record<CodePresentation, typeof AppWindow> = { workspace: PanelsTopLeft, window: AppWindow, tab: ExternalLink };
function Hint({ children }: {
    children: React.ReactNode;
}) {
    return <p className="px-2 py-0.5 text-3xs leading-relaxed text-pretty text-muted-foreground">{children}</p>;
}
function templatePresets(session: ReturnType<typeof useEditorSession>) {
    const base = session.scene.scripting.baseLanguage;
    const templates = base ? scriptTemplatesFor(base) : SCRIPT_TEMPLATES;
    return templates.map(({ id, label, description }) => ({ id, label, description }));
}
function ScriptPicker({ entity, asset }: {
    entity: Entity;
    asset: LibraryAsset | null;
}) {
    const session = useEditorSession();
    const scripts = session.library.byKind('script');
    const assetId = entity.script?.assetId ?? null;
    const missing = assetId !== null && asset === null;
    const openState = useCodeSelector((code) => {
        const tab = asset ? code.tab(asset.id) : null;
        return tab ? (code.isDirty(tab) ? 'dirty' : 'open') : 'closed';
    });
    const open = openState !== 'closed';
    const options = [
        { value: NONE, label: missing ? 'Script removido da biblioteca' : scripts.length === 0 ? 'Nenhum (crie um script abaixo)' : '— nenhum —' },
        ...scripts.map((script) => ({ value: script.id, label: script.details.kind === 'script' ? `${script.name} · ${scriptLanguage(script.details.language).tag}` : script.name })),
    ];
    return (<>
      <PropertyRow label="Script">
        <SelectField label="Script da biblioteca" options={options} value={asset?.id ?? NONE} onChange={(value) => setScriptAsset(session, entity, value === NONE ? null : value)}/>
        {asset && (<IconButton label={openState === 'dirty' ? 'Aberto no editor, com alterações não salvas' : open ? 'Aberto no editor de código' : 'Abrir no editor de código'} size="sm" active={open} onClick={() => void openScriptAssetInEditor(session, asset, { pin: true })}>
            <PenLine />
          </IconButton>)}
      </PropertyRow>
      {scripts.length === 0 && (<ActionRow>
          <ActionButton icon={Plus} variant="primary" title="Cria um script de ator na linguagem base do jogo e o aponta para este ator" onClick={() => void createScript(session, { templateId: 'actor', attachTo: null }).then((created) => created && setScriptAsset(session, entity, created.id))}>
            Criar script…
          </ActionButton>
          <AudioPresetsMenu title="Modelos de script" label="Modelos" presets={templatePresets(session)} onPick={(templateId) => void createScript(session, { templateId: templateId as ScriptTemplateId, attachTo: null }).then((created) => created && setScriptAsset(session, entity, created.id))}/>
        </ActionRow>)}
    </>);
}
function ScriptFacts({ asset }: {
    asset: LibraryAsset;
}) {
    const session = useEditorSession();
    const details = asset.details.kind === 'script' ? asset.details : null;
    if (!details)
        return null;
    const language = scriptLanguage(details.language);
    const isEntry = session.scene.scripting.entryScriptId === asset.id;
    const users = scriptActorsFor(session, asset.id).length;
    return (<>
      <PropertyRow label="Linguagem">
        <span className="flex h-control min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <LanguageTag language={details.language} size="sm" silent/>
          <span className="truncate text-2xs text-foreground">{language.label}</span>
          <StatusChip tone={language.compiler === 'ready' ? 'ok' : language.compiler === 'beta' ? 'info' : 'muted'} className="ml-auto h-4.5">
            {SCRIPT_COMPILER_STATUS_LABEL[language.compiler]}
          </StatusChip>
        </span>
      </PropertyRow>
      <PropertyRow label="Roda em">
        <FieldInput readOnly value={SCRIPT_RUN_CONTEXT_LABEL[details.runContext]} aria-label="Contexto de execução" title={SCRIPT_RUN_CONTEXT_DESCRIPTION[details.runContext]}/>
      </PropertyRow>
      <PropertyRow label="Tamanho">
        <FieldInput readOnly value={`${details.lines.toLocaleString('pt-BR')} ${details.lines === 1 ? 'linha' : 'linhas'} · ${users} ${users === 1 ? 'ator' : 'atores'}`} aria-label="Tamanho do script e atores que o usam"/>
      </PropertyRow>
      <PropertyRow label="Entrada">
        <span className="flex h-control min-w-0 flex-1 items-center gap-1.5">
          <StatusChip tone={isEntry ? 'info' : 'muted'}>{isEntry ? 'Script de entrada' : 'Pela hierarquia'}</StatusChip>
          <IconButton label={isEntry ? 'Deixar de ser o script de entrada' : 'Tornar este o script de entrada do jogo'} size="sm" active={isEntry} onClick={() => setEntryScript(session, isEntry ? null : asset.id)}>
            <Star />
          </IconButton>
        </span>
      </PropertyRow>
    </>);
}
function OpenInMenu({ asset }: {
    asset: LibraryAsset;
}) {
    const session = useEditorSession();
    const presets = (['workspace', 'window', 'tab'] as const).map((presentation) => ({ id: presentation, label: CODE_PRESENTATION_LABEL[presentation], description: CODE_PRESENTATION_HINT[presentation] }));
    return <AudioPresetsMenu title="Abrir o editor de código em" label="Abrir em…" presets={presets} onPick={(presentation) => void openScriptAssetInEditor(session, asset, { pin: true, presentation: presentation as CodePresentation })}/>;
}
export function ScriptSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const settings = entity.script;
    if (!settings)
        return null;
    const asset = scriptAssetOf(session, entity);
    const controlled = entity.parent;
    const controlledName = !controlled || controlled.parent === null ? 'Mundo' : controlled.name;
    const Icon = PRESENTATION_ICON[session.code.presentation];
    return (<CollapsibleSection title="Script" trailing={<IconButton label="Remover o script do ator (o código fica na biblioteca)" size="xs" className="hover:text-destructive" onClick={() => detachScript(session, entity)}>
          <Trash2 />
        </IconButton>}>
      <ScriptPicker entity={entity} asset={asset}/>
      <PropertyRow label="Controla">
        <FieldInput readOnly value={controlledName} aria-label="Ator controlado por este script" title="O script roda ligado ao ator pai na hierarquia; arraste-o para outro ator para trocar"/>
      </PropertyRow>
      <ToggleField label="Ativado" on={settings.enabled} onToggle={() => setScriptEnabled(session, entity, !settings.enabled)}/>
      {asset && <ScriptFacts asset={asset}/>}
      <ActionRow>
        <ActionButton icon={Icon} variant="primary" disabled={!asset} title={asset ? `Abre ${asset.name} na ${CODE_PRESENTATION_LABEL[session.code.presentation].toLowerCase()}` : 'Escolha um script primeiro'} onClick={() => asset && void openScriptAssetInEditor(session, asset, { pin: true })}>
          Editar código
        </ActionButton>
        {asset && <OpenInMenu asset={asset}/>}
        <ActionButton icon={Play} disabled={!asset || !settings.enabled} title="Executa o script agora (salva antes, se houver alterações)" onClick={() => asset && void runScript(session, asset)}>
          Executar
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
function AttachedScripts({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const scripts = entity.children.filter((child) => child.kind === 'script');
    if (scripts.length === 0)
        return null;
    return (<div className="flex flex-col gap-0.5 px-2 py-0.5">
      {scripts.map((child) => {
            const asset = scriptAssetOf(session, child);
            const language = asset?.details.kind === 'script' ? asset.details.language : null;
            return (<div key={child.id} className="flex h-control items-center gap-1.5 rounded-xs px-1 hover:bg-highlight">
            <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
            <button type="button" className="min-w-0 flex-1 truncate text-left text-2xs text-foreground" title="Selecionar o ator de script" onClick={() => session.select(child)}>
              {child.name}
            </button>
            {language && <LanguageTag language={language}/>}
            {!child.script?.enabled && <StatusChip tone="muted" className="h-4">desligado</StatusChip>}
            <IconButton label="Abrir no editor de código" size="xs" disabled={!asset} onClick={() => asset && void openScriptAssetInEditor(session, asset, { pin: true })}>
              <PenLine />
            </IconButton>
          </div>);
        })}
    </div>);
}
export function ScriptAttachSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    if (!canCarryScript(entity))
        return null;
    const scripts = session.library.byKind('script');
    const attached = entity.children.some((child) => child.kind === 'script');
    const defaultAsset = defaultScriptAssetId(session);
    return (<CollapsibleSection title={attached ? 'Scripts' : 'Script'} defaultOpen={attached}>
      <AttachedScripts entity={entity}/>
      <ActionRow>
        <ActionButton icon={FileCode2} variant="primary" title={scripts.length > 0 ? 'Anexa um script da biblioteca a este ator (troque-o depois na seção Script do ator de script)' : 'Cria um script de ator na linguagem base do jogo, já anexado a este ator'} onClick={() => {
            if (scripts.length > 0)
                attachScriptToEntity(session, entity, defaultAsset);
            else
                void createScript(session, { templateId: 'actor', attachTo: entity });
        }}>
          {scripts.length > 0 ? (attached ? 'Anexar outro' : 'Anexar script') : 'Criar script'}
        </ActionButton>
        <AudioPresetsMenu title="Novo script a partir de um modelo" label="Novo…" presets={templatePresets(session)} onPick={(templateId) => void createScript(session, { templateId: templateId as ScriptTemplateId, attachTo: entity })}/>
      </ActionRow>
    </CollapsibleSection>);
}
