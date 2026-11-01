'use client';
import { ChevronDown, Eye, Grid2x2, Lightbulb, Snowflake, Sparkles, Volume2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { debugViewNeedsMyriad, MYRIAD_DEBUG_VIEW_HINTS, MYRIAD_DEBUG_VIEW_LABELS, MYRIAD_DEBUG_VIEWS, type MyriadDebugView, } from '@/engine/renderer/myriad/runtime/myriad-settings';
import { LIGHT_HELPER_MODE_LABEL, LIGHT_HELPER_MODES, type LightHelperMode } from '@/engine/renderer/passes/light-helper-pass';
import { SOUND_HELPER_MODE_LABEL, SOUND_HELPER_MODES, type SoundHelperMode } from '@/engine/renderer/passes/sound-helper-pass';
import { VFX_HELPER_MODE_LABEL, VFX_HELPER_MODES, type VfxHelperMode } from '@/engine/renderer/passes/vfx-helper-pass';
const VISUALIZATIONS = MYRIAD_DEBUG_VIEWS.filter((view) => view !== 'none');
const LIGHT_HELPER_HINT: Record<LightHelperMode, string> = {
    all: 'Emissor de cada luz; a selecionada ganha também o envelope de alcance',
    selected: 'Só a luz selecionada é desenhada; as demais ficam invisíveis e não clicáveis',
    off: 'Nenhuma luz desenhada: o viewport mostra só o que o jogo mostra',
};
const SOUND_HELPER_HINT: Record<SoundHelperMode, string> = {
    all: 'Marcador de cada fonte (ondula enquanto toca) e o volume de cada zona; a seleção ganha alcances, cone e gatilho',
    selected: 'Só os atores de som selecionados são desenhados; os demais ficam invisíveis e não clicáveis',
    off: 'Nenhum som desenhado; o áudio continua tocando normalmente',
};
const VFX_HELPER_HINT: Record<VfxHelperMode, string> = {
    all: 'Marcador de cada efeito (pulsa enquanto toca); a seleção ganha as formas de emissão dos emissores',
    selected: 'Só os atores de efeito selecionados são desenhados; os demais ficam invisíveis e não clicáveis',
    off: 'Nenhum marcador desenhado; as partículas continuam aparecendo normalmente',
};
export function ViewModeMenu() {
    const session = useSessionTopic('view');
    const { myriad } = session.render;
    const current = myriad.debugView;
    const debugging = current !== 'none';
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Modo de visualização" title="Modo de visualização e marcadores do viewport" className={`flex h-control items-center gap-1.5 rounded-sm px-2 text-2xs font-medium transition-colors duration-100 hover:bg-highlight data-[popup-open]:bg-highlight ${debugging ? 'text-primary' : 'text-foreground/90'}`}/>}>
        <Eye className="size-3.5 text-muted-foreground" aria-hidden/>
        <span>{MYRIAD_DEBUG_VIEW_LABELS[current]}</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} w-72`}>
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => session.updateMyriad({ debugView: value as MyriadDebugView })}>
          <DropdownMenuGroup>
            <DropdownMenuRadioItem className={MENU_ITEM_CLASS} value="none">
              {MYRIAD_DEBUG_VIEW_LABELS.none}
            </DropdownMenuRadioItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Visualizações</DropdownMenuLabel>
            {VISUALIZATIONS.map((view) => (<DropdownMenuRadioItem key={view} className={`${MENU_ITEM_CLASS} items-start py-1.5`} value={view} disabled={!myriad.enabled && debugViewNeedsMyriad(view)}>
                <span className="flex flex-col gap-0.5">
                  <span>{MYRIAD_DEBUG_VIEW_LABELS[view]}</span>
                  <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{MYRIAD_DEBUG_VIEW_HINTS[view]}</span>
                </span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={session.render.lightHelpers} onValueChange={(value) => session.setLightHelpers(value as LightHelperMode)}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>
              <span className="flex items-center gap-1.5">
                <Lightbulb className="size-3" aria-hidden/>
                Luzes no viewport
              </span>
            </DropdownMenuLabel>
            {LIGHT_HELPER_MODES.map((mode) => (<DropdownMenuRadioItem key={mode} className={`${MENU_ITEM_CLASS} items-start py-1.5`} value={mode}>
                <span className="flex flex-col gap-0.5">
                  <span>{LIGHT_HELPER_MODE_LABEL[mode]}</span>
                  <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{LIGHT_HELPER_HINT[mode]}</span>
                </span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={session.render.soundHelpers} onValueChange={(value) => session.setSoundHelpers(value as SoundHelperMode)}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>
              <span className="flex items-center gap-1.5">
                <Volume2 className="size-3" aria-hidden/>
                Sons no viewport
              </span>
            </DropdownMenuLabel>
            {SOUND_HELPER_MODES.map((mode) => (<DropdownMenuRadioItem key={mode} className={`${MENU_ITEM_CLASS} items-start py-1.5`} value={mode}>
                <span className="flex flex-col gap-0.5">
                  <span>{SOUND_HELPER_MODE_LABEL[mode]}</span>
                  <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{SOUND_HELPER_HINT[mode]}</span>
                </span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={session.render.vfxHelpers} onValueChange={(value) => session.setVfxHelpers(value as VfxHelperMode)}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3" aria-hidden/>
                Efeitos no viewport
              </span>
            </DropdownMenuLabel>
            {VFX_HELPER_MODES.map((mode) => (<DropdownMenuRadioItem key={mode} className={`${MENU_ITEM_CLASS} items-start py-1.5`} value={mode}>
                <span className="flex flex-col gap-0.5">
                  <span>{VFX_HELPER_MODE_LABEL[mode]}</span>
                  <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{VFX_HELPER_HINT[mode]}</span>
                </span>
              </DropdownMenuRadioItem>))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={myriad.wireframe} onCheckedChange={() => session.updateMyriad({ wireframe: !myriad.wireframe })}>
            <Grid2x2 aria-hidden/>
            Arestas dos triângulos
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={myriad.freeze} disabled={!myriad.enabled} onCheckedChange={() => session.updateMyriad({ freeze: !myriad.freeze })}>
            <Snowflake aria-hidden/>
            Congelar seleção e culling
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
