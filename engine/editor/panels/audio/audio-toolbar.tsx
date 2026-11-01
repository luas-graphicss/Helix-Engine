'use client';
import { AudioLines, ChevronDown, Download, Ellipsis, Expand, Globe, Headphones, Maximize2, Pause, Play, Repeat, RotateCcw, Save, ScanSearch, Scissors, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Square, StepBack, StepForward, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { AudioLibraryAsset } from '@/engine/assets/library/audio-asset';
import { AUDIO_CLIP_PRESETS } from '@/engine/audio/clip/audio-clip-presets';
import { formatClipTime } from '@/engine/audio/core/decibels';
import { WAV_BIT_DEPTHS } from '@/engine/audio/export/wav-encoder';
import { useAudioEditor, useAudioPosition } from '@/engine/editor/audio/ui/use-audio-editor';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { applyAudioPreset, bakeProcessedAudioToLibrary, exportProcessedAudio, NORMALIZE_TARGET_DB, normalizeAudioClip, patchAudioClip, reanalyzeAudioAsset, resetAudioClip, trimSilenceAudioClip, } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { useShortcutLabel } from '@/engine/editor/shortcuts/shortcut-bindings';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { TOOLBAR_CHIP_CLASS } from '@/engine/ui/surface-styles';
import { zoomAroundCursor, ZOOM_STEP_FACTOR } from './audio-zoom';
const STEP_SECONDS = 0.1;
function TimeReadout() {
    const editor = useAudioEditor();
    const position = useAudioPosition();
    const region = editor.region;
    const elapsed = region ? Math.max(0, position - region.start) : position;
    const total = region ? region.end - region.start : editor.duration;
    return (<output aria-live="off" title="Posição no clipe / duração do recorte" className="flex shrink-0 items-center gap-1 font-mono text-3xs tabular-nums text-muted-foreground">
      <span className="text-foreground">{formatClipTime(elapsed)}</span>
      <span>/ {formatClipTime(total)}</span>
    </output>);
}
function PlayButton() {
    const editor = useAudioEditor();
    const disabled = !editor.buffer;
    return (<IconButton label={editor.playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'} size="sm" active={editor.playing} disabled={disabled} onClick={() => editor.togglePlay()}>
      {editor.playing ? <Pause /> : <Play />}
    </IconButton>);
}
function Transport() {
    const editor = useAudioEditor();
    const disabled = !editor.buffer;
    return (<div className="flex shrink-0 items-center">
      <IconButton label="Ir ao início (Home)" size="sm" disabled={disabled} onClick={() => editor.goToStart()}>
        <SkipBack />
      </IconButton>
      <IconButton label="Recuar 0,1 s (←; Shift: 1 s)" size="sm" disabled={disabled} onClick={() => editor.stepSeconds(-STEP_SECONDS)}>
        <StepBack />
      </IconButton>
      <PlayButton />
      <IconButton label="Parar e voltar ao início" size="sm" disabled={disabled} onClick={() => editor.stop()}>
        <Square />
      </IconButton>
      <IconButton label="Avançar 0,1 s (→; Shift: 1 s)" size="sm" disabled={disabled} onClick={() => editor.stepSeconds(STEP_SECONDS)}>
        <StepForward />
      </IconButton>
      <IconButton label="Ir ao fim (End)" size="sm" disabled={disabled} onClick={() => editor.goToEnd()}>
        <SkipForward />
      </IconButton>
    </div>);
}
function PresetMenu({ asset }: {
    asset: AudioLibraryAsset;
}) {
    const session = useEditorSession();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Predefinições do clipe" title="Predefinições: pontos de partida para situações comuns de jogo" className={TOOLBAR_CHIP_CLASS}/>}>
        <Sparkles className="size-3" aria-hidden/>
        <span className="hidden @lg/panel:inline">Predefinições</span>
        <ChevronDown className="size-3" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} w-60`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Substitui a cadeia de efeitos</DropdownMenuLabel>
          {AUDIO_CLIP_PRESETS.map((preset) => (<DropdownMenuItem key={preset.id} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => applyAudioPreset(session, asset, preset.id)}>
              <span>{preset.label}</span>
              <span className="text-3xs text-muted-foreground">{preset.description}</span>
            </DropdownMenuItem>))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
function ClipMenu({ asset }: {
    asset: AudioLibraryAsset;
}) {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const undoKey = useShortcutLabel('edit.undo');
    const analyzed = asset.details.analysis !== null;
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<IconButton label="Mais opções do clipe" size="sm"/>}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-64`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Ajustes automáticos</DropdownMenuLabel>
          <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!analyzed} onClick={() => normalizeAudioClip(session, asset)}>
            <Volume2 aria-hidden/>
            Normalizar o pico para {NORMALIZE_TARGET_DB} dBFS
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={!analyzed} onClick={() => trimSilenceAudioClip(session, asset)}>
            <Scissors aria-hidden/>
            Recortar o silêncio das pontas
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Exportar como soa</DropdownMenuLabel>
          {WAV_BIT_DEPTHS.map((depth) => (<DropdownMenuItem key={depth.value} className={MENU_ITEM_CLASS} title={depth.description} onClick={() => void exportProcessedAudio(session, asset, depth.value)}>
              <Download aria-hidden/>
              {depth.label}
            </DropdownMenuItem>))}
          <DropdownMenuItem className={MENU_ITEM_CLASS} title="Renderiza recorte, fades, volume e efeitos num novo áudio da biblioteca, com clipe limpo" onClick={() => void bakeProcessedAudioToLibrary(session, asset)}>
            <Save aria-hidden/>
            Consolidar num novo ativo
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => void reanalyzeAudioAsset(session, asset)}>
            <ScanSearch aria-hidden/>
            Analisar novamente
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editor.zoomToRegion()}>
            <Maximize2 aria-hidden/>
            Zoom no recorte
          </DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => resetAudioClip(session, asset)}>
            <RotateCcw aria-hidden/>
            Restaurar o clipe padrão
            {undoKey && <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>{undoKey} desfaz</DropdownMenuShortcut>}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
function ViewSwitch() {
    const editor = useAudioEditor();
    return (<div role="radiogroup" aria-label="Vista" className="flex shrink-0 items-center">
      <IconButton label="Clipe" size="sm" active={editor.view === 'clip'} role="radio" aria-checked={editor.view === 'clip'} onClick={() => editor.setView('clip')}>
        <AudioLines />
      </IconButton>
      <IconButton label="Mesa de som" size="sm" active={editor.view === 'mixer'} role="radio" aria-checked={editor.view === 'mixer'} onClick={() => editor.setView('mixer')}>
        <SlidersHorizontal />
      </IconButton>
      <IconButton label="Cena: fontes e zonas no mundo" size="sm" active={editor.view === 'scene'} role="radio" aria-checked={editor.view === 'scene'} onClick={() => editor.setView('scene')}>
        <Globe />
      </IconButton>
    </div>);
}
export function AudioToolbar() {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const asset = editor.asset;
    const settings = editor.settings;
    const mixer = editor.view === 'mixer';
    const scene = editor.view === 'scene';
    const clipView = !mixer && !scene;
    const analysis = asset?.details.analysis ?? null;
    return (<div className="flex min-h-panelbar shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border bg-surface px-1.5 py-0.5">
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        {mixer ? (<span className="text-2xs font-medium text-foreground">Mesa de som</span>) : scene ? (<span className="text-2xs font-medium text-foreground">Áudio 3D da cena</span>) : (asset && (<>
              <span className="max-w-44 truncate text-2xs font-medium text-foreground" title={asset.name}>
                {asset.name}
              </span>
              {analysis && (<span className="hidden font-mono text-3xs text-muted-foreground @4xl/panel:inline" title="Canais e taxa de amostragem do arquivo">
                  {analysis.channels === 1 ? 'mono' : analysis.channels === 2 ? 'estéreo' : `${analysis.channels} canais`} · {(analysis.sampleRate / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kHz
                </span>)}
            </>))}
      </div>

      {asset && !scene && (<>
          <ToolbarSeparator />
          <Transport />
          <TimeReadout />
        </>)}

      {asset && settings && clipView && (<>
          <IconButton label={settings.loop ? 'Em laço (clique para tocar uma vez)' : 'Tocar uma vez (clique para laço)'} size="sm" active={settings.loop} onClick={() => patchAudioClip(session, asset, { loop: !settings.loop }, `${settings.loop ? 'Desligar' : 'Ligar'} laço de ${asset.name}`)}>
            <Repeat />
          </IconButton>
          <IconButton label={editor.bypass ? 'Ouvindo o original; clique para voltar aos ajustes (B)' : 'Ouvir o original, sem ajustes nem efeitos (B)'} size="sm" active={editor.bypass} onClick={() => editor.setBypass(!editor.bypass)} className={cn(editor.bypass && 'bg-warning/15 text-warning hover:bg-warning/20 hover:text-warning')}>
            <Headphones />
          </IconButton>

          <ToolbarSeparator />

          <div className="flex shrink-0 items-center">
            <IconButton label="Aproximar (+)" size="sm" disabled={editor.duration <= 0} onClick={() => zoomAroundCursor(editor, 1 / ZOOM_STEP_FACTOR)}>
              <ZoomIn />
            </IconButton>
            <IconButton label="Afastar (−)" size="sm" disabled={editor.zoom === null} onClick={() => zoomAroundCursor(editor, ZOOM_STEP_FACTOR)}>
              <ZoomOut />
            </IconButton>
            <IconButton label="Ver o arquivo inteiro (0)" size="sm" disabled={editor.zoom === null} onClick={() => editor.setZoom(null)}>
              <Expand />
            </IconButton>
          </div>

          <ToolbarSeparator />
          <PresetMenu asset={asset}/>
        </>)}

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <ViewSwitch />
        {asset && clipView && (<>
            <ClipMenu asset={asset}/>
            <IconButton label="Fechar o clipe" size="sm" onClick={() => editor.close()}>
              <X />
            </IconButton>
          </>)}
      </div>
    </div>);
}
