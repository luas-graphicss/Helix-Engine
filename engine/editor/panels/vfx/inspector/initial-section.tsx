'use client';
import type { VfxEmitter, VfxInitial } from '@/engine/vfx/document/vfx-document';
import { endVfxDocumentEdit, patchVfxEmitterPart, vfxMergeKey } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { SliderField } from '@/engine/ui/slider-field';
import { ColorValueField } from '../fields/color-value-field';
import { NumberRow } from '../fields/number-row';
import { ScalarField } from '../fields/scalar-field';
const percent = (value: number) => `${Math.round(value * 100)} %`;
export function InitialSection({ emitter }: {
    emitter: VfxEmitter;
}) {
    const session = useEditorSession();
    const { initial } = emitter;
    const end = () => endVfxDocumentEdit(session);
    const patch = (patchValue: Partial<VfxInitial>, label: string, field: string) => patchVfxEmitterPart(session, emitter.id, 'initial', patchValue, label, vfxMergeKey(emitter.id, 'initial', field));
    return (<>
      <CollapsibleSection title="Valores iniciais">
        <ScalarField label="Vida" value={initial.lifetime} unit="s" min={0.01} step={0.1} timeAxis="emitter" onChange={(lifetime) => patch({ lifetime }, 'Vida inicial', 'lifetime')} onEnd={end}/>
        <ScalarField label="Velocidade" value={initial.speed} unit="m/s" step={0.1} timeAxis="emitter" onChange={(speed) => patch({ speed }, 'Velocidade inicial', 'speed')} onEnd={end}/>
        <ScalarField label="Tamanho" value={initial.size} unit="m" min={0} step={0.02} precision={3} timeAxis="emitter" onChange={(size) => patch({ size }, 'Tamanho inicial', 'size')} onEnd={end}/>
        <NumberRow label="Proporção" value={initial.aspect} min={0.05} max={20} step={0.05} unit="w/h" onChange={(aspect) => patch({ aspect }, 'Proporção da partícula', 'aspect')} onEnd={end}/>
        <ScalarField label="Rotação" value={initial.rotation} unit="°" step={5} precision={0} timeAxis="emitter" onChange={(rotation) => patch({ rotation }, 'Rotação inicial', 'rotation')} onEnd={end}/>
        <ScalarField label="Giro" value={initial.angularVelocity} unit="°/s" step={5} precision={0} timeAxis="emitter" onChange={(angularVelocity) => patch({ angularVelocity }, 'Giro inicial', 'angularVelocity')} onEnd={end}/>
        <SliderField label="Herdar veloc." value={initial.inheritVelocity} min={0} max={1} format={percent} onChange={(inheritVelocity) => patch({ inheritVelocity }, 'Herança de velocidade', 'inheritVelocity')}/>
      </CollapsibleSection>
      <CollapsibleSection title="Cor inicial">
        <ColorValueField label="Cor" value={initial.color} onChange={(color) => patch({ color }, 'Cor inicial', 'color')} onEnd={end}/>
      </CollapsibleSection>
    </>);
}
