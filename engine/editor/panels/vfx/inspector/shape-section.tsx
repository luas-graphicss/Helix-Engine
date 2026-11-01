'use client';
import { VFX_EMIT_FROM_LABEL, VFX_SHAPE_DESCRIPTION, VFX_SHAPE_KINDS, VFX_SHAPE_LABEL, type VfxEmitFrom, type VfxEmitter, type VfxShape, type VfxShapeKind } from '@/engine/vfx/document/vfx-document';
import { endVfxDocumentEdit, patchVfxEmitterPart, vfxMergeKey } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { NumberRow } from '../fields/number-row';
import { Vector3Field } from '../fields/vector3-field';
const SHAPE_OPTIONS = VFX_SHAPE_KINDS.map((value) => ({ value, label: VFX_SHAPE_LABEL[value] }));
const EMIT_FROM_BY_SHAPE: Record<VfxShapeKind, readonly VfxEmitFrom[]> = {
    point: [],
    sphere: ['volume', 'surface'],
    hemisphere: ['volume', 'surface'],
    cone: ['volume', 'surface'],
    box: ['volume', 'surface', 'edge'],
    circle: ['volume', 'edge'],
    edge: [],
};
const percent = (value: number) => `${Math.round(value * 100)} %`;
const degrees = (value: number) => `${Math.round(value)}°`;
export function ShapeSection({ emitter }: {
    emitter: VfxEmitter;
}) {
    const session = useEditorSession();
    const { shape } = emitter;
    const end = () => endVfxDocumentEdit(session);
    const patch = (patchValue: Partial<VfxShape>, label: string, field?: string) => patchVfxEmitterPart(session, emitter.id, 'shape', patchValue, label, field ? vfxMergeKey(emitter.id, 'shape', field) : undefined);
    const kind = shape.kind;
    const emitFromOptions = EMIT_FROM_BY_SHAPE[kind].map((value) => ({ value, label: VFX_EMIT_FROM_LABEL[value] }));
    const hasRadius = kind === 'sphere' || kind === 'hemisphere' || kind === 'cone' || kind === 'circle';
    const hasArc = kind === 'sphere' || kind === 'hemisphere' || kind === 'cone' || kind === 'circle';
    return (<>
      <CollapsibleSection title="Forma de emissão">
        <PropertyRow label="Forma" hint={VFX_SHAPE_DESCRIPTION[kind]}>
          <SelectField label="Forma de emissão" options={SHAPE_OPTIONS} value={kind} onChange={(next) => patch({ kind: next }, `Forma ${VFX_SHAPE_LABEL[next]}`)}/>
        </PropertyRow>
        {hasRadius && <NumberRow label="Raio" value={shape.radius} min={0} step={0.05} unit="m" onChange={(radius) => patch({ radius }, 'Raio da forma', 'radius')} onEnd={end}/>}
        {(kind === 'sphere' || kind === 'hemisphere' || kind === 'circle' || kind === 'cone') && (<SliderField label="Espessura" value={shape.thickness} min={0} max={1} format={percent} onChange={(thickness) => patch({ thickness }, 'Espessura da forma', 'thickness')}/>)}
        {kind === 'cone' && <SliderField label="Abertura" value={shape.angle} min={0} max={89} step={1} format={degrees} onChange={(angle) => patch({ angle }, 'Abertura do cone', 'angle')}/>}
        {(kind === 'cone' || kind === 'edge') && <NumberRow label="Comprimento" value={shape.length} min={0} step={0.1} unit="m" onChange={(length) => patch({ length }, 'Comprimento da forma', 'length')} onEnd={end}/>}
        {kind === 'box' && <Vector3Field label="Tamanho" value={shape.size} min={0} step={0.1} onChange={(size) => patch({ size }, 'Tamanho da caixa', 'size')} onEnd={end}/>}
        {hasArc && <SliderField label="Arco" value={shape.arc} min={0} max={360} step={1} format={degrees} onChange={(arc) => patch({ arc }, 'Arco da forma', 'arc')}/>}
        {emitFromOptions.length > 0 && (<PropertyRow label="Emitir de">
            <SegmentedControl label="Emitir de" options={emitFromOptions} value={emitFromOptions.some((option) => option.value === shape.emitFrom) ? shape.emitFrom : null} onChange={(emitFrom) => patch({ emitFrom }, `Emitir da ${VFX_EMIT_FROM_LABEL[emitFrom].toLowerCase()}`)}/>
          </PropertyRow>)}
      </CollapsibleSection>
      <CollapsibleSection title="Direção">
        <SliderField label="Aleatorizar" value={shape.randomizeDirection} min={0} max={1} format={percent} onChange={(randomizeDirection) => patch({ randomizeDirection }, 'Direção aleatória', 'randomizeDirection')}/>
        <SliderField label="Radial" value={shape.spherizeDirection} min={0} max={1} format={percent} onChange={(spherizeDirection) => patch({ spherizeDirection }, 'Direção radial', 'spherizeDirection')}/>
      </CollapsibleSection>
      <CollapsibleSection title="Posição da forma" defaultOpen={false}>
        <Vector3Field label="Deslocar" value={shape.offset} step={0.05} onChange={(offset) => patch({ offset }, 'Deslocamento da forma', 'offset')} onEnd={end}/>
        <Vector3Field label="Girar" value={shape.rotation} step={5} precision={0} onChange={(rotation) => patch({ rotation }, 'Rotação da forma', 'rotation')} onEnd={end}/>
        <Vector3Field label="Escalar" value={shape.scale} min={0} step={0.05} onChange={(scale) => patch({ scale }, 'Escala da forma', 'scale')} onEnd={end}/>
      </CollapsibleSection>
    </>);
}
