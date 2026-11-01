'use client';
import { ChevronDown, Copy, Download, Ellipsis, FolderOpen, Import, MapPinPlus, Pause, Play, Repeat, Save, Shapes, SkipBack, Square, StepForward, WandSparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { VFX_HELPER_MODE_LABEL, VFX_HELPER_MODES, type VfxHelperMode } from '@/engine/renderer/passes/vfx-helper-pass';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { renameLibraryAsset } from '@/engine/editor/operations/asset-library-operations';
import { ensureVfxStage, isVfxStageRunning, patchVfxDocument, restartVfxStage, stepVfxStage, stopVfxStage, toggleVfxStagePlayback } from '@/engine/editor/operations/vfx-document-operations';
import { closeVfxEditor, createVfxEffect, duplicateVfxAsset, exportVfxDocument, importVfxEffects, openVfxAssetInEditor, saveVfxEditorDocument } from '@/engine/editor/operations/vfx-operations';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { useVfxEditor, useVfxStage } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { formatVfxSeconds, VFX_FRAME_STEP } from '@/engine/editor/vfx/ui/vfx-stack-model';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { TOOLBAR_CHIP_CLASS } from '@/engine/ui/surface-styles';
import { VfxTemplateMenu } from './vfx-template-menu';
const CHIP_CLASS = TOOLBAR_CHIP_CLASS;
function LiveReadout() {
    const editor = useVfxEditor();
    const stage = useVfxStage();
    const { document } = editor;
    if (!document)
        return null;
    const instance = stage.instance;
    const time = instance?.time ?? 0;
    const alive = instance?.alive ?? 0;
    return (<div className="flex shrink-0 items-center gap-2 font-mono text-3xs tabular-nums text-muted-foreground" title="Instante no ciclo / duração · partículas vivas">
      <span className={cn(stage.running && 'text-foreground')}>
        {formatVfxSeconds(time)} <span className="text-muted-foreground/60">/ {formatVfxSeconds(document.duration)}</span>
      </span>
      <span className="hidden @lg/panel:inline">{alive.toLocaleString('pt-BR')} part.</span>
      {instance && instance.cycle > 0 && <span className="hidden text-muted-foreground/60 @4xl/panel:inline">ciclo {instance.cycle + 1}</span>}
    </div>);
}
function PlayButton() {
    const session = useEditorSession();
    useVfxStage();
    const running = isVfxStageRunning(session);
    return (<IconButton label={running ? 'Congelar (Espaço)' : 'Tocar (Espaço)'} size="sm" active={running} onClick={() => toggleVfxStagePlayback(session)}>
      {running ? <Pause /> : <Play />}
    </IconButton>);
}
function StageButton() {
    const session = useEditorSession();
    const stage = useVfxStage();
    if (!stage.entity) {
        return (<button type="button" title="Coloca um ator de efeito sobre o alvo da câmera para ver o efeito ao vivo" onClick={() => ensureVfxStage(session)} className={cn(CHIP_CLASS, 'text-warning hover:text-warning')}>
        <MapPinPlus className="size-3" aria-hidden/>
        <span className="hidden @2xl/panel:inline">Colocar na cena</span>
      </button>);
    }
    const entity = stage.entity;
    return (<button type="button" title="Ator-palco: clique para selecionar e enquadrar" onClick={() => {
            session.select(entity);
            session.focusEntity(entity);
        }} className="hidden max-w-28 truncate rounded-sm px-1 text-3xs text-muted-foreground hover:bg-highlight hover:text-foreground @2xl/panel:inline">
      {entity.name}
    </button>);
}
export function VfxToolbar() {
    const session = useSessionTopic('assets', 'scene', 'selection', 'view', 'playtest');
    const editor = useVfxEditor();
    const hint = useShortcutHint();
    const { document } = editor;
    if (!document)
        return null;
    const asset = editor.assetId ? session.library.get(editor.assetId) : null;
    const others = session.library.byKind('vfx').filter((candidate) => candidate.id !== editor.assetId);
    const rename = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === document.name)
            return;
        if (asset)
            renameLibraryAsset(session, asset, trimmed);
        else
            patchVfxDocument(session, { name: trimmed }, 'Renomear efeito');
    };
    return (<div className="flex min-h-panelbar shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border bg-surface px-1.5 py-0.5">
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <FieldInput key={`${editor.assetId}-${document.name}`} defaultValue={document.name} aria-label="Nome do efeito" className="w-36 flex-none" onBlur={(event) => rename(event.currentTarget.value)} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = document.name;
                event.currentTarget.blur();
            }
        }}/>
        {editor.dirty && <span className="size-1.5 shrink-0 rounded-full bg-warning" title="Alterações não salvas" aria-label="Alterações não salvas"/>}
        <StageButton />
      </div>

      <ToolbarSeparator />

      <div className="flex shrink-0 items-center">
        <IconButton label="Recomeçar do zero (Home)" size="sm" onClick={() => restartVfxStage(session)}>
          <SkipBack />
        </IconButton>
        <PlayButton />
        <IconButton label="Parar e limpar as partículas" size="sm" onClick={() => stopVfxStage(session)}>
          <Square />
        </IconButton>
        <IconButton label="Avançar um quadro (→)" size="sm" onClick={() => stepVfxStage(session, VFX_FRAME_STEP)}>
          <StepForward />
        </IconButton>
      </div>

      <LiveReadout />

      <IconButton label={document.loop ? 'Em laço (clique para tocar uma vez)' : 'Toca uma vez (clique para repetir)'} size="sm" active={document.loop} onClick={() => patchVfxDocument(session, { loop: !document.loop }, document.loop ? 'Efeito toca uma vez' : 'Efeito em laço')}>
        <Repeat />
      </IconButton>

      <ToolbarSeparator />

      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" aria-label="Guias dos emissores no viewport" title="Guias dos emissores no viewport" className={CHIP_CLASS}/>}>
          <Shapes className="size-3" aria-hidden/>
          <span className="hidden @4xl/panel:inline">{VFX_HELPER_MODE_LABEL[session.render.vfxHelpers]}</span>
          <ChevronDown className="size-3" aria-hidden/>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={MENU_CONTENT_CLASS}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Guias das formas</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={session.render.vfxHelpers} onValueChange={(value) => session.setVfxHelpers(value as VfxHelperMode)}>
              {VFX_HELPER_MODES.map((mode) => (<DropdownMenuRadioItem key={mode} value={mode} className={MENU_ITEM_CLASS}>
                  {VFX_HELPER_MODE_LABEL[mode]}
                </DropdownMenuRadioItem>))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <VfxTemplateMenu onPick={(templateId) => void createVfxEffect(session, templateId)} trigger={<IconButton label="Novo efeito a partir de um modelo" size="sm"/>}>
          <WandSparkles />
        </VfxTemplateMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconButton label="Mais opções do efeito" size="sm"/>}>
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-64`}>
            <DropdownMenuGroup>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => exportVfxDocument(document)}>
                <Download aria-hidden/>
                Exportar como .hxvfx
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void importVfxEffects(session)}>
                <Import aria-hidden/>
                Importar efeitos…
              </DropdownMenuItem>
              {asset && (<DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void duplicateVfxAsset(session, asset)}>
                  <Copy aria-hidden/>
                  Duplicar na biblioteca
                </DropdownMenuItem>)}
            </DropdownMenuGroup>
            {others.length > 0 && (<>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className={MENU_LABEL_CLASS}>Abrir outro efeito</DropdownMenuLabel>
                  {others.map((candidate) => (<DropdownMenuItem key={candidate.id} className={MENU_ITEM_CLASS} onClick={() => void openVfxAssetInEditor(session, candidate)}>
                      <FolderOpen aria-hidden/>
                      <span className="truncate">{candidate.name}</span>
                    </DropdownMenuItem>))}
                </DropdownMenuGroup>
              </>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton label={hint(asset ? 'Salvar na biblioteca' : 'Guardar na biblioteca', 'vfx.save')} size="sm" onClick={() => void saveVfxEditorDocument(session)} className={cn(editor.dirty && 'text-foreground')}>
          <Save />
        </IconButton>
        <IconButton label="Fechar o editor de efeitos" size="sm" onClick={() => void closeVfxEditor(session)}>
          <X />
        </IconButton>
      </div>
    </div>);
}
