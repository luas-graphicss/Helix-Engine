'use client';
import { Aperture, Columns2, Power } from 'lucide-react';
import { matchPostProcessPreset, type PostProcessEffectKey, type PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { ExposureSection, GradingSection, TONE_MAPPER_LABELS } from './postprocess/color-sections';
import { BloomSection, DepthOfFieldSection, FilmGrainSection, LensSection, SharpenSection, VignetteSection } from './postprocess/effect-sections';
import { PresetGrid } from './postprocess/preset-grid';
const TOGGLEABLE_EFFECTS: readonly Exclude<PostProcessEffectKey, 'whiteBalance' | 'grading'>[] = [
    'bloom',
    'depthOfField',
    'vignette',
    'chromaticAberration',
    'filmGrain',
    'lensDistortion',
    'sharpen',
];
function countActiveEffects(post: PostProcessSettings): number {
    return TOGGLEABLE_EFFECTS.reduce((count, key) => count + (post[key].enabled ? 1 : 0), 0);
}
const splitLabel = (value: number) => `${Math.round(value * 100)}% da largura`;
export function PostProcessPanel() {
    const session = useSessionTopic('scene', 'view');
    const post = session.scene.postProcessing;
    const compare = session.render.postCompare;
    const activePreset = matchPostProcessPreset(post);
    const activeEffects = countActiveEffects(post);
    const subtitle = post.enabled
        ? `${TONE_MAPPER_LABELS[post.toneMapper]} · ${activeEffects === 1 ? '1 efeito' : `${activeEffects} efeitos`}`
        : 'Desligado · ACES de referência';
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <Aperture className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-semibold text-foreground">Pós-processamento</span>
          <span className="truncate font-mono text-3xs text-muted-foreground">{subtitle}</span>
        </div>
        <IconButton label={compare.enabled ? 'Fechar comparação lado a lado' : 'Comparar com e sem efeitos'} size="sm" active={compare.enabled} onClick={() => session.updatePostCompare({ enabled: !compare.enabled })}>
          <Columns2 />
        </IconButton>
        <IconButton label={post.enabled ? 'Desligar pós-processamento' : 'Ligar pós-processamento'} size="sm" active={post.enabled} onClick={() => session.updatePostProcess({ enabled: !post.enabled })}>
          <Power />
        </IconButton>
      </div>

      <div className="flex-1 overflow-auto">
        <CollapsibleSection title="Presets">
          <PresetGrid activeId={activePreset} onApply={(presetId) => session.applyPostProcessPreset(presetId)}/>
          {!activePreset && <p className="px-2 pt-1 text-3xs text-muted-foreground">Configuração personalizada: escolha um preset para partir dele.</p>}
        </CollapsibleSection>

        <CollapsibleSection title="Comparação A/B" defaultOpen={compare.enabled}>
          <ToggleField label="Dividir viewport" on={compare.enabled} onToggle={() => session.updatePostCompare({ enabled: !compare.enabled })}/>
          <SliderField label="Divisão" value={compare.split} min={0} max={1} step={0.01} disabled={!compare.enabled} format={splitLabel} onChange={(value) => session.updatePostCompare({ split: value })}/>
          <p className="px-2 pt-0.5 text-3xs leading-snug text-muted-foreground">À esquerda da linha a cena sai como o renderer a entrega, só com ACES e exposição neutra.</p>
        </CollapsibleSection>

        <ExposureSection />
        <GradingSection />
        <BloomSection />
        <DepthOfFieldSection />
        <VignetteSection />
        <LensSection />
        <FilmGrainSection />
        <SharpenSection />
      </div>
    </div>);
}
