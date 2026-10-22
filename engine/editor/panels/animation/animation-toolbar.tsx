'use client';
import { Bone, ChevronDown, CircleDot, Download, Ellipsis, Flag, Magnet, Pause, Play, Repeat, Rows3, Save, SkipBack, SkipForward, Spline, StepBack, StepForward, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { ANIMATION_EXPORT_FORMATS } from '@/engine/core/animation/animation-io';
import { availableLimbs, LIMBS } from '@/engine/animation/ik/limb-chains';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { PLAYBACK_SPEEDS, rigDisplayName } from '@/engine/editor/animation/animation-editor';
import { formatSeconds } from '@/engine/editor/animation/ui/timeline-model';
import { useAnimationEditor, useAnimationTime } from '@/engine/editor/animation/ui/use-animation-editor';
import { exportAnimationDocument, saveAnimationEditorDocument } from '@/engine/editor/operations/animation-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
const MENU_FIELD_CLASS = 'grid grid-cols-[88px_minmax(0,1fr)_20px] items-center gap-2 text-2xs text-muted-foreground';
function parseNumber(raw: string): number | null {
    const value = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}
function CommitField({ label, value, min, step, onCommit }: {
    label: string;
    value: number;
    min?: number;
    step?: number;
    onCommit: (value: number) => void;
}) {
    return (<FieldInput key={value} type="number" min={min} step={step} defaultValue={value} aria-label={label} onBlur={(event) => {
            const parsed = parseNumber(event.currentTarget.value);
            if (parsed !== null && parsed !== value)
                onCommit(parsed);
        }} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = String(value);
                event.currentTarget.blur();
            }
        }}/>);
}
function FrameReadout() {
    const editor = useAnimationEditor();
    const time = useAnimationTime();
    const totalFrames = Math.round(editor.duration * editor.frameRate);
    const frame = Math.round(time * editor.frameRate);
    return (<div className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground" title="Quadro atual / total · tempo">
      <FieldInput key={frame} type="number" min={0} max={totalFrames} step={1} defaultValue={frame} aria-label="Quadro atual" className="w-12 flex-none" onBlur={(event) => {
            const parsed = parseNumber(event.currentTarget.value);
            if (parsed !== null)
                editor.setFrame(Math.round(parsed));
        }} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
      <span>/ {totalFrames}</span>
      <span className="hidden text-muted-foreground/60 lg:inline">{formatSeconds(time)}</span>
    </div>);
}
function PlayButton() {
    const editor = useAnimationEditor();
    useAnimationTime();
    return (<IconButton label={editor.playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'} size="sm" active={editor.playing} onClick={() => editor.togglePlay()}>
      {editor.playing ? <Pause /> : <Play />}
    </IconButton>);
}
export function AnimationToolbar() {
    const session = useEditorSession();
    const editor = useAnimationEditor();
    const { document, primary } = editor;
    if (!document)
        return null;
    const limbs = primary ? availableLimbs(primary.rig) : [];
    const activeIk = limbs.filter((limb) => editor.ik[limb]).length;
    return (<div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-surface px-1.5 [scrollbar-width:none]">
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <FieldInput key={document.name} defaultValue={document.name} aria-label="Nome da animação" className="w-36 flex-none" onBlur={(event) => editor.rename(event.currentTarget.value)} onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter')
                event.currentTarget.blur();
        }}/>
        {editor.dirty && <span className="size-1.5 shrink-0 rounded-full bg-warning" title="Alterações não salvas" aria-label="Alterações não salvas"/>}
        {primary && (<button type="button" title="Selecionar o ator" onClick={() => session.select(primary.entity.parent?.character ? primary.entity.parent : primary.entity)} className="hidden max-w-28 truncate rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-highlight hover:text-foreground md:inline">
            {rigDisplayName(primary.entity)}
          </button>)}
      </div>

      <ToolbarSeparator />

      <div className="flex shrink-0 items-center">
        <IconButton label="Ir ao início (Home)" size="sm" onClick={() => editor.goToStart()}>
          <SkipBack />
        </IconButton>
        <IconButton label="Quadro anterior (←)" size="sm" onClick={() => editor.stepFrames(-1)}>
          <StepBack />
        </IconButton>
        <PlayButton />
        <IconButton label="Próximo quadro (→)" size="sm" onClick={() => editor.stepFrames(1)}>
          <StepForward />
        </IconButton>
        <IconButton label="Ir ao fim (End)" size="sm" onClick={() => editor.goToEnd()}>
          <SkipForward />
        </IconButton>
      </div>

      <FrameReadout />

      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" aria-label="Velocidade de reprodução" title="Velocidade de reprodução" className="flex h-6 shrink-0 items-center gap-0.5 rounded-sm border border-border-strong px-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground"/>}>
          {editor.speed}×
          <ChevronDown className="size-3" aria-hidden/>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} min-w-28`}>
          <DropdownMenuGroup>
            {PLAYBACK_SPEEDS.map((speed) => (<DropdownMenuCheckboxItem key={speed} className={MENU_ITEM_CLASS} checked={editor.speed === speed} onCheckedChange={() => editor.setSpeed(speed)}>
                {speed}×
              </DropdownMenuCheckboxItem>))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <IconButton label={document.loop ? 'Em laço (clique para tocar uma vez)' : 'Tocar uma vez (clique para laço)'} size="sm" active={document.loop} onClick={() => editor.setLoop(!document.loop)}>
        <Repeat />
      </IconButton>

      <ToolbarSeparator />

      <IconButton label={editor.autoKey ? 'Gravação automática ligada: cada pose vira chave' : 'Gravação automática desligada: poses ficam pendentes até inserir chave (K)'} size="sm" active={editor.autoKey} onClick={() => editor.setAutoKey(!editor.autoKey)} className={cn(editor.autoKey && 'bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive')}>
        <CircleDot />
      </IconButton>
      <IconButton label={editor.snapToFrames ? 'Alinhar a quadros inteiros (ligado)' : 'Alinhar a quadros inteiros (desligado)'} size="sm" active={editor.snapToFrames} onClick={() => editor.setSnapToFrames(!editor.snapToFrames)}>
        <Magnet />
      </IconButton>

      <ToolbarSeparator />

      <div role="radiogroup" aria-label="Vista" className="flex shrink-0 items-center">
        <IconButton label="Dopesheet" size="sm" active={editor.view === 'dopesheet'} role="radio" aria-checked={editor.view === 'dopesheet'} onClick={() => editor.setView('dopesheet')}>
          <Rows3 />
        </IconButton>
        <IconButton label="Curvas" size="sm" active={editor.view === 'curves'} role="radio" aria-checked={editor.view === 'curves'} onClick={() => editor.setView('curves')}>
          <Spline />
        </IconButton>
      </div>

      <ToolbarSeparator />

      <IconButton label={editor.showSkeleton ? 'Ocultar esqueleto' : 'Mostrar esqueleto'} size="sm" active={editor.showSkeleton} onClick={() => editor.setShowSkeleton(!editor.showSkeleton)}>
        <Bone />
      </IconButton>

      {limbs.length > 0 && (<DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" aria-label="Membros com IK" title="Membros com IK: arraste mãos e pés no viewport" className={cn('flex h-6 shrink-0 items-center gap-0.5 rounded-sm border border-border-strong px-1.5 font-mono text-[10px] transition-colors hover:bg-highlight hover:text-foreground', activeIk > 0 ? 'text-foreground' : 'text-muted-foreground')}/>}>
            IK {activeIk}/{limbs.length}
            <ChevronDown className="size-3" aria-hidden/>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={MENU_CONTENT_CLASS}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Cinemática inversa</DropdownMenuLabel>
              {limbs.map((limb) => (<DropdownMenuCheckboxItem key={limb} className={MENU_ITEM_CLASS} checked={editor.ik[limb]} onCheckedChange={(checked) => editor.setIk(limb, checked)}>
                  {LIMBS[limb].label}
                </DropdownMenuCheckboxItem>))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={editor.xray} onCheckedChange={(checked) => editor.setXray(checked)}>
                Esqueleto através da malha
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>)}

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconButton label="Mais opções da animação" size="sm"/>}>
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`${MENU_CONTENT_CLASS} w-64`}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Documento</DropdownMenuLabel>
              <div className="flex flex-col gap-1 px-2 pt-1 pb-1.5">
                <label className={MENU_FIELD_CLASS}>
                  <span>Duração</span>
                  <CommitField label="Duração em segundos" value={Number(document.duration.toFixed(3))} min={0.05} step={0.1} onCommit={(value) => editor.setDuration(value)}/>
                  <span className="font-mono">s</span>
                </label>
                <label className={MENU_FIELD_CLASS}>
                  <span>Quadros/s</span>
                  <CommitField label="Quadros por segundo" value={editor.frameRate} min={1} step={1} onCommit={(value) => editor.setFrameRate(Math.round(value))}/>
                  <span className="font-mono">fps</span>
                </label>
                <label className={MENU_FIELD_CLASS}>
                  <span>Deslocamento</span>
                  <CommitField label="Velocidade de referência" value={Number(document.referenceSpeed.toFixed(2))} min={0} step={0.1} onCommit={(value) => editor.setReferenceSpeed(value)}/>
                  <span className="font-mono">m/s</span>
                </label>
              </div>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editor.stretch(0.5)}>
                Metade da duração (2× mais rápida)
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editor.stretch(2)}>
                Dobro da duração (2× mais lenta)
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editor.keyAllBones()}>
                <Bone aria-hidden/>
                Chave em todos os ossos
                <DropdownMenuShortcut className={MENU_SHORTCUT_CLASS}>Shift+K</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editor.addEvent('evento')}>
                <Flag aria-hidden/>
                Adicionar evento neste quadro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={MENU_LABEL_CLASS}>Exportar</DropdownMenuLabel>
              {ANIMATION_EXPORT_FORMATS.map((format) => (<DropdownMenuItem key={format.id} className={MENU_ITEM_CLASS} onClick={() => void exportAnimationDocument(session, document, format.id)}>
                  <Download aria-hidden/>
                  {format.label}
                </DropdownMenuItem>))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton label={editor.assetId ? 'Salvar na biblioteca (Ctrl+S)' : 'Guardar na biblioteca (Ctrl+S)'} size="sm" onClick={() => void saveAnimationEditorDocument(session)} className={cn(editor.dirty && 'text-foreground')}>
          <Save />
        </IconButton>
        <IconButton label="Fechar o editor de animação" size="sm" onClick={() => editor.close()}>
          <X />
        </IconButton>
      </div>
    </div>);
}
