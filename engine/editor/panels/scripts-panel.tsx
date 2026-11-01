'use client';
import { Fragment, useState } from 'react';
import { Code2, Copy, Download, FileCode2, FileUp, Languages, Link2, Play, Star, Trash2 } from 'lucide-react';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import { ServerIcon } from '@/engine/editor/code/icons/code-icons';
import { ContextDot, ContextIcon } from '@/engine/editor/code/ui/context-chip';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { NewScriptMenu } from '@/engine/editor/code/ui/new-script-menu';
import { useCodeSelector } from '@/engine/editor/code/ui/use-code-editor';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { removeLibraryAsset } from '@/engine/editor/operations/asset-library-operations';
import { allScriptActors, attachScriptToEntity, canCarryScript, duplicateScriptAsset, exportScriptAsset, importScripts, openScriptActor, openScriptAssetInEditor, runScript, scriptActorsFor, scriptAssetOf, setEntryScript, } from '@/engine/editor/operations/script-operations';
import { shallowEqual, useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { SCRIPT_CONTEXT_TONE, contextLabel, groupScriptsByContext } from '@/engine/scripting/script-sides';
import { GAME_SERVER_TARGET_LABEL, isAuthoritative } from '@/engine/scripting/scripting-settings';
import { ActionButton } from '@/engine/ui/action-button';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SearchField } from '@/engine/ui/search-field';
import { EMPTY_NOTE_CLASS, FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
function SectionTitle({ children, count }: {
    children: React.ReactNode;
    count: number;
}) {
    return (<h3 className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-3xs font-medium tracking-wider text-muted-foreground uppercase">
      {children}
      <span className="font-mono tracking-normal normal-case">{count}</span>
    </h3>);
}
function ScriptRow({ asset, selectedEntity }: {
    asset: LibraryAsset;
    selectedEntity: Entity | null;
}) {
    const session = useEditorSession();
    const details = asset.details.kind === 'script' ? asset.details : null;
    const tab = useCodeSelector((code) => {
        const open = code.tab(asset.id);
        return open ? { preview: open.preview, dirty: code.isDirty(open), active: code.activeId === asset.id, windowOpen: code.windowOpen } : null;
    }, shallowEqual);
    const isActive = tab !== null && tab.active && (session.workspace === 'code' || tab.windowOpen);
    const dirty = tab?.dirty ?? false;
    const isEntry = session.scene.scripting.entryScriptId === asset.id;
    const actors = scriptActorsFor(session, asset.id).length;
    const canAttach = selectedEntity !== null && canCarryScript(selectedEntity);
    if (!details)
        return null;
    return (<div role="button" tabIndex={0} onClick={() => void openScriptAssetInEditor(session, asset)} onDoubleClick={() => void openScriptAssetInEditor(session, asset, { pin: true })} onKeyDown={(event) => {
            if (event.key === 'Enter')
                void openScriptAssetInEditor(session, asset, { pin: true });
        }} title={`${asset.name} · ${scriptLanguage(details.language).label}${tab ? (dirty ? ' · aberto, com alterações não salvas' : ' · aberto') : ''}`} className={cn('group flex h-control cursor-default items-center gap-1.5 px-2 text-2xs select-none', FOCUS_RING_CLASS, isActive ? 'bg-primary/20 text-foreground' : tab ? 'bg-primary/8 text-foreground' : 'text-foreground/90 hover:bg-highlight')}>
      <LanguageTag language={details.language} silent/>
      <span className={cn('min-w-0 flex-1 truncate', tab?.preview && 'italic')}>{asset.name}</span>
      {dirty && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="Alterações não salvas"/>}
      {isEntry && <Star className="size-3 shrink-0 fill-current text-primary" aria-label="Script de entrada"/>}
      <ContextDot context={details.runContext}/>
      <span className="shrink-0 font-mono text-3xs text-muted-foreground/70 group-hover:hidden">
        {details.lines}L{actors > 0 && ` · ${actors}×`}
      </span>
      <span className="hidden shrink-0 items-center group-hover:flex">
        <IconButton label={canAttach ? `Anexar a ${selectedEntity.name}` : 'Selecione um ator na cena para anexar'} size="xs" disabled={!canAttach} onClick={(event) => {
            event.stopPropagation();
            if (selectedEntity)
                attachScriptToEntity(session, selectedEntity, asset.id);
        }}>
          <Link2 />
        </IconButton>
        <IconButton label="Executar" size="xs" onClick={(event) => {
            event.stopPropagation();
            void runScript(session, asset);
        }}>
          <Play />
        </IconButton>
        <IconButton label={isEntry ? 'Deixar de ser o script de entrada' : 'Tornar o script de entrada'} size="xs" active={isEntry} onClick={(event) => {
            event.stopPropagation();
            setEntryScript(session, isEntry ? null : asset.id);
        }}>
          <Star />
        </IconButton>
        <IconButton label="Duplicar" size="xs" onClick={(event) => {
            event.stopPropagation();
            void duplicateScriptAsset(session, asset);
        }}>
          <Copy />
        </IconButton>
        <IconButton label="Exportar arquivo" size="xs" onClick={(event) => {
            event.stopPropagation();
            void exportScriptAsset(session, asset);
        }}>
          <Download />
        </IconButton>
        <IconButton label="Excluir da biblioteca" size="xs" className="hover:text-destructive" onClick={(event) => {
            event.stopPropagation();
            removeLibraryAsset(session, asset);
        }}>
          <Trash2 />
        </IconButton>
      </span>
    </div>);
}
function ActorRow({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const asset = scriptAssetOf(session, entity);
    const language = asset?.details.kind === 'script' ? asset.details.language : null;
    const controlled = entity.parent;
    const controlledName = !controlled || controlled.parent === null ? 'Mundo' : controlled.name;
    const selected = session.isSelected(entity);
    const enabled = entity.script?.enabled ?? true;
    return (<div role="button" tabIndex={0} onClick={() => session.select(entity)} onDoubleClick={() => void openScriptActor(session, entity)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                void openScriptActor(session, entity);
        }} title={`${entity.name} controla ${controlledName}${enabled ? '' : ' · desativado'}`} className={cn('flex h-control cursor-default items-center gap-1.5 px-2 text-2xs select-none', FOCUS_RING_CLASS, selected ? 'bg-primary/20 text-foreground' : 'text-foreground/90 hover:bg-highlight', !enabled && 'opacity-50')}>
      <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
      <span className="min-w-0 flex-1 truncate">{entity.name}</span>
      {language ? <LanguageTag language={language} silent/> : <span className="font-mono text-3xs text-warning">vazio</span>}
      <span className="max-w-[40%] shrink-0 truncate font-mono text-3xs text-muted-foreground/70">→ {controlledName}</span>
    </div>);
}
export function ScriptsPanel() {
    const session = useSessionTopic('scene', 'selection', 'assets', 'workspace', 'playtest');
    const hint = useShortcutHint();
    const [query, setQuery] = useState('');
    const normalized = query.trim().toLowerCase();
    const scripts = session.library.byKind('script').filter((asset) => !normalized || asset.name.toLowerCase().includes(normalized));
    const actors = allScriptActors(session).filter((entity) => !normalized || entity.name.toLowerCase().includes(normalized));
    const selected = session.selectedEntity;
    const { baseLanguage, server } = session.scene.scripting;
    const base = baseLanguage ? scriptLanguage(baseLanguage) : null;
    const authoritative = isAuthoritative(session.scene.scripting);
    const groups = groupScriptsByContext(scripts);
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar className="gap-1 px-1.5">
        <SearchField placeholder="Filtrar scripts" value={query} onChange={setQuery}/>
        <NewScriptMenu />
        <IconButton label="Importar arquivos de código…" size="sm" onClick={() => void importScripts(session)}>
          <FileUp />
        </IconButton>
      </PanelToolbar>

      <button type="button" onClick={() => editorDialogs.open('baseLanguage')} title={base ? 'Trocar a linguagem base do jogo' : 'Escolher a linguagem base do jogo'} className={cn('flex h-7 shrink-0 items-center gap-1.5 border-b border-border px-2 text-2xs transition-colors hover:bg-highlight', FOCUS_RING_CLASS, base ? 'text-muted-foreground' : 'text-warning')}>
        <Languages className="size-3.5 shrink-0" aria-hidden/>
        {base ? (<>
            <span>Jogo em</span>
            <LanguageTag language={base.id} silent/>
            <span className="truncate text-foreground">{base.label}</span>
          </>) : (<span className="truncate">Escolha a linguagem base do jogo…</span>)}
      </button>

      <button type="button" onClick={() => editorDialogs.open('gameServer')} title={authoritative ? 'Servidor autoritativo: scripts de servidor rodam separados e o jogador nunca os recebe. Clique para configurar.' : 'Jogo só de cliente. Clique para ligar um servidor autoritativo (multijogador, anticheat).'} className={cn('flex h-7 shrink-0 items-center gap-1.5 border-b border-border px-2 text-2xs text-muted-foreground transition-colors hover:bg-highlight', FOCUS_RING_CLASS)}>
        <ServerIcon className={cn('size-3.5 shrink-0', authoritative && 'text-warning')} aria-hidden/>
        {authoritative ? (<>
            <span>Servidor autoritativo</span>
            <span className="truncate font-mono text-3xs text-muted-foreground/70">
              {server.tickRate} Hz · {server.maxPlayers} jog. · {GAME_SERVER_TARGET_LABEL[server.target]}
            </span>
          </>) : (<span className="truncate">Sem servidor: jogo só de cliente…</span>)}
      </button>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        <SectionTitle count={scripts.length}>Biblioteca</SectionTitle>
        {scripts.length === 0 ? (<p className={cn('mx-2 px-3 py-4 text-center text-2xs', EMPTY_NOTE_CLASS)}>{normalized ? 'Nenhum script corresponde ao filtro.' : 'Nenhum script ainda. Crie um pelo botão acima ou abra o editor de código.'}</p>) : groups.length > 1 ? (groups.map((group) => (<Fragment key={group.context}>
              <h4 className={cn('flex items-center gap-1.5 px-2 pt-1.5 pb-0.5 text-3xs font-medium', SCRIPT_CONTEXT_TONE[group.context])}>
                <ContextIcon context={group.context} className="size-3"/>
                {contextLabel(group.context)}
                <span className="font-mono text-muted-foreground">{group.assets.length}</span>
              </h4>
              {group.assets.map((asset) => (<ScriptRow key={asset.id} asset={asset} selectedEntity={selected}/>))}
            </Fragment>))) : (scripts.map((asset) => <ScriptRow key={asset.id} asset={asset} selectedEntity={selected}/>))}

        <SectionTitle count={actors.length}>Na cena</SectionTitle>
        {actors.length === 0 ? (<p className={cn('mx-2 px-3 py-4 text-center text-2xs', EMPTY_NOTE_CLASS)}>
            {normalized ? 'Nenhum ator de script corresponde ao filtro.' : 'Nenhum script anexado a um ator. Selecione um ator e use a seção Script do inspetor, ou o botão de anexar ao lado de cada script.'}
          </p>) : (actors.map((entity) => <ActorRow key={entity.id} entity={entity}/>))}
      </div>

      {session.workspace !== 'code' && (<div className="flex shrink-0 items-center border-t border-border px-2 py-1">
          <ActionButton icon={Code2} variant="primary" title={hint('Abre o editor de código no centro do editor', 'view.code')} onClick={() => session.setWorkspace('code')} className="h-6">
            Abrir editor de código
          </ActionButton>
        </div>)}
    </div>);
}
