'use client';
import { TONE_MAPPERS, type ToneMapper } from '@/engine/core/environment/post-process-settings';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ColorField } from '@/engine/ui/color-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { cn } from '@/lib/utils';
import { signedPercent, stops } from './effect-section';
export const TONE_MAPPER_LABELS: Record<ToneMapper, string> = {
    aces: 'ACES',
    agx: 'AgX',
    filmic: 'Fílmico (Hable)',
    neutral: 'Neutro (Khronos)',
    reinhard: 'Reinhard',
    none: 'Nenhum (corte)',
};
const TONE_MAPPER_OPTIONS = TONE_MAPPERS.map((value) => ({ value, label: TONE_MAPPER_LABELS[value] }));
const temperature = (value: number) => (Math.abs(value) < 0.005 ? 'Neutra' : value > 0 ? `Quente ${Math.round(value * 100)}%` : `Fria ${Math.round(-value * 100)}%`);
const tintLabel = (value: number) => (Math.abs(value) < 0.005 ? 'Neutro' : value > 0 ? `Magenta ${Math.round(value * 100)}%` : `Verde ${Math.round(-value * 100)}%`);
const balance = (value: number) => (Math.abs(value) < 0.005 ? 'Centro' : value > 0 ? `Sombras ${Math.round(value * 100)}%` : `Luzes ${Math.round(-value * 100)}%`);
export function ExposureSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { whiteBalance } = post;
    return (<CollapsibleSection title="Exposição e curva">
      <div className={cn('flex flex-col gap-0.5 transition-opacity', !post.enabled && 'opacity-50')}>
        <SliderField label="Exposição" value={post.exposure} min={-4} max={4} step={0.05} format={stops} onChange={(value) => session.updatePostProcess({ exposure: value })}/>
        <PropertyRow label="Tone mapping">
          <SelectField label="Curva de tone mapping" options={TONE_MAPPER_OPTIONS} value={post.toneMapper} onChange={(toneMapper) => session.updatePostProcess({ toneMapper })}/>
        </PropertyRow>
        <SliderField label="Temperatura" value={whiteBalance.temperature} min={-1} max={1} step={0.01} format={temperature} onChange={(value) => session.updatePostEffect('whiteBalance', { temperature: value })}/>
        <SliderField label="Matiz" value={whiteBalance.tint} min={-1} max={1} step={0.01} format={tintLabel} onChange={(value) => session.updatePostEffect('whiteBalance', { tint: value })}/>
      </div>
    </CollapsibleSection>);
}
export function GradingSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { grading } = post;
    const update = (patch: Partial<typeof grading>) => session.updatePostEffect('grading', patch);
    return (<CollapsibleSection title="Grading de cor">
      <div className={cn('flex flex-col gap-0.5 transition-opacity', !post.enabled && 'opacity-50')}>
        <SliderField label="Contraste" value={grading.contrast} min={-1} max={1} step={0.01} format={signedPercent} onChange={(value) => update({ contrast: value })}/>
        <SliderField label="Saturação" value={grading.saturation} min={-1} max={1} step={0.01} format={signedPercent} onChange={(value) => update({ saturation: value })}/>
        <SliderField label="Vibração" value={grading.vibrance} min={-1} max={1} step={0.01} format={signedPercent} onChange={(value) => update({ vibrance: value })}/>
        <SliderField label="Sombras" value={grading.shadows} min={-1} max={1} step={0.01} format={signedPercent} onChange={(value) => update({ shadows: value })}/>
        <SliderField label="Meios-tons" value={grading.midtones} min={-1} max={1} step={0.01} format={signedPercent} onChange={(value) => update({ midtones: value })}/>
        <SliderField label="Realces" value={grading.highlights} min={-1} max={1} step={0.01} format={signedPercent} onChange={(value) => update({ highlights: value })}/>
        <ColorField label="Tom das sombras" value={grading.shadowTint} onChange={(shadowTint) => update({ shadowTint })}/>
        <ColorField label="Tom dos realces" value={grading.highlightTint} onChange={(highlightTint) => update({ highlightTint })}/>
        <SliderField label="Equilíbrio" value={grading.toneBalance} min={-1} max={1} step={0.01} format={balance} onChange={(value) => update({ toneBalance: value })}/>
      </div>
    </CollapsibleSection>);
}
