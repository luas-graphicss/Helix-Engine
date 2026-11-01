'use client';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SliderField } from '@/engine/ui/slider-field';
import { EffectSection, fNumber, meters, millimeters, percent, pixels, times } from './effect-section';
const distortion = (value: number) => (Math.abs(value) < 0.005 ? 'Nenhuma' : value < 0 ? `Barril ${Math.round(-value * 100)}%` : `Almofada ${Math.round(value * 100)}%`);
export function BloomSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { bloom } = post;
    const update = (patch: Partial<typeof bloom>) => session.updatePostEffect('bloom', patch);
    return (<EffectSection title="Bloom" enabled={bloom.enabled} active={post.enabled} onToggle={() => update({ enabled: !bloom.enabled })}>
      <SliderField label="Intensidade" value={bloom.intensity} min={0} max={2} step={0.01} format={percent} onChange={(value) => update({ intensity: value })}/>
      <SliderField label="Limiar" value={bloom.threshold} min={0} max={4} step={0.01} format={times} onChange={(value) => update({ threshold: value })}/>
      <SliderField label="Suavidade" value={bloom.softKnee} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ softKnee: value })}/>
      <SliderField label="Raio" value={bloom.radius} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ radius: value })}/>
    </EffectSection>);
}
export function DepthOfFieldSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { depthOfField } = post;
    const update = (patch: Partial<typeof depthOfField>) => session.updatePostEffect('depthOfField', patch);
    return (<EffectSection title="Profundidade de campo" enabled={depthOfField.enabled} active={post.enabled} onToggle={() => update({ enabled: !depthOfField.enabled })}>
      <SliderField label="Foco" value={depthOfField.focusDistance} min={0.5} max={200} step={0.1} scale="log" editable suffix=" m" format={meters} onChange={(value) => update({ focusDistance: Math.max(0.05, value) })}/>
      <SliderField label="Distância focal" value={depthOfField.focalLength} min={12} max={200} step={1} format={millimeters} onChange={(value) => update({ focalLength: value })}/>
      <SliderField label="Abertura" value={depthOfField.aperture} min={0.95} max={22} step={0.05} scale="log" format={fNumber} onChange={(value) => update({ aperture: value })}/>
      <SliderField label="Desfoque máx." value={depthOfField.maxBlur} min={2} max={32} step={1} format={pixels} onChange={(value) => update({ maxBlur: value })}/>
    </EffectSection>);
}
export function LensSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { chromaticAberration, lensDistortion } = post;
    return (<>
      <EffectSection title="Aberração cromática" enabled={chromaticAberration.enabled} active={post.enabled} onToggle={() => session.updatePostEffect('chromaticAberration', { enabled: !chromaticAberration.enabled })}>
        <SliderField label="Intensidade" value={chromaticAberration.intensity} min={0} max={1} step={0.01} format={percent} onChange={(value) => session.updatePostEffect('chromaticAberration', { intensity: value })}/>
      </EffectSection>
      <EffectSection title="Distorção de lente" enabled={lensDistortion.enabled} active={post.enabled} onToggle={() => session.updatePostEffect('lensDistortion', { enabled: !lensDistortion.enabled })}>
        <SliderField label="Curvatura" value={lensDistortion.intensity} min={-1} max={1} step={0.01} format={distortion} onChange={(value) => session.updatePostEffect('lensDistortion', { intensity: value })}/>
        <SliderField label="Escala" value={lensDistortion.scale} min={1} max={1.5} step={0.01} format={times} onChange={(value) => session.updatePostEffect('lensDistortion', { scale: value })}/>
      </EffectSection>
    </>);
}
export function VignetteSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { vignette } = post;
    const update = (patch: Partial<typeof vignette>) => session.updatePostEffect('vignette', patch);
    return (<EffectSection title="Vinheta" enabled={vignette.enabled} active={post.enabled} onToggle={() => update({ enabled: !vignette.enabled })}>
      <SliderField label="Intensidade" value={vignette.intensity} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ intensity: value })}/>
      <SliderField label="Suavidade" value={vignette.smoothness} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ smoothness: value })}/>
      <SliderField label="Redondeza" value={vignette.roundness} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ roundness: value })}/>
    </EffectSection>);
}
export function FilmGrainSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { filmGrain } = post;
    const update = (patch: Partial<typeof filmGrain>) => session.updatePostEffect('filmGrain', patch);
    return (<EffectSection title="Grão de filme" enabled={filmGrain.enabled} active={post.enabled} onToggle={() => update({ enabled: !filmGrain.enabled })}>
      <SliderField label="Intensidade" value={filmGrain.intensity} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ intensity: value })}/>
      <SliderField label="Tamanho" value={filmGrain.size} min={1} max={4} step={0.1} format={pixels} onChange={(value) => update({ size: value })}/>
      <SliderField label="Resposta à luz" value={filmGrain.luminanceResponse} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ luminanceResponse: value })}/>
    </EffectSection>);
}
export function SharpenSection() {
    const session = useEditorSession();
    const post = session.scene.postProcessing;
    const { sharpen } = post;
    const update = (patch: Partial<typeof sharpen>) => session.updatePostEffect('sharpen', patch);
    return (<EffectSection title="Nitidez" enabled={sharpen.enabled} active={post.enabled} onToggle={() => update({ enabled: !sharpen.enabled })}>
      <SliderField label="Intensidade" value={sharpen.intensity} min={0} max={1} step={0.01} format={percent} onChange={(value) => update({ intensity: value })}/>
    </EffectSection>);
}
