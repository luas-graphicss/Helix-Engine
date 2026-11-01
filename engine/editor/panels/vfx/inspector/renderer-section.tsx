'use client';
import { createFlipbook, VFX_BLEND_DESCRIPTION, VFX_BLEND_LABEL, VFX_BLEND_MODES, VFX_LIGHTING_LABEL, VFX_RENDER_MODE_LABEL, VFX_RENDER_MODES, VFX_SORT_LABEL, type VfxEmitter, type VfxFlipbook, type VfxLighting, type VfxRenderer, type VfxSortMode, } from '@/engine/vfx/document/vfx-document';
import { vfxTextureLabel } from '@/engine/vfx/textures/vfx-texture-catalog';
import { endVfxDocumentEdit, patchVfxEmitterPart, vfxMergeKey } from '@/engine/editor/operations/vfx-document-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { ToggleField, ToggleSwitch } from '@/engine/ui/toggle-field';
import { NumberRow } from '../fields/number-row';
import { TexturePicker } from '../fields/texture-picker';
const MODE_OPTIONS = VFX_RENDER_MODES.map((value) => ({ value, label: VFX_RENDER_MODE_LABEL[value] }));
const BLEND_OPTIONS = VFX_BLEND_MODES.map((value) => ({ value, label: VFX_BLEND_LABEL[value] }));
const SORT_OPTIONS = (Object.keys(VFX_SORT_LABEL) as VfxSortMode[]).map((value) => ({ value, label: VFX_SORT_LABEL[value] }));
const LIGHTING_OPTIONS: ReadonlyArray<{
    value: VfxLighting;
    label: string;
}> = [
    { value: 'unlit', label: 'Emissiva' },
    { value: 'lit', label: 'Iluminada' },
];
const meters = (value: number) => (value <= 0 ? 'desligado' : `${Number(value.toFixed(2))} m`);
const times = (value: number) => `${Number(value.toFixed(2))}×`;
export function RendererSection({ emitter }: {
    emitter: VfxEmitter;
}) {
    const session = useEditorSession();
    const { renderer } = emitter;
    const end = () => endVfxDocumentEdit(session);
    const patch = (patchValue: Partial<VfxRenderer>, label: string, field?: string) => patchVfxEmitterPart(session, emitter.id, 'renderer', patchValue, label, field ? vfxMergeKey(emitter.id, 'renderer', field) : undefined);
    const patchFlipbook = (patchValue: Partial<VfxFlipbook>, label: string, field: string) => {
        if (!renderer.flipbook)
            return;
        patch({ flipbook: { ...renderer.flipbook, ...patchValue } }, label, field);
    };
    const textureName = vfxTextureLabel(renderer.texture, (assetId) => session.library.get(assetId)?.name ?? null);
    return (<>
      <CollapsibleSection title="Placa e mistura">
        <PropertyRow label="Orientação">
          <SelectField label="Orientação da placa" options={MODE_OPTIONS} value={renderer.mode} onChange={(mode) => patch({ mode }, `Placa ${VFX_RENDER_MODE_LABEL[mode].toLowerCase()}`)}/>
        </PropertyRow>
        {renderer.mode === 'stretched' && (<>
            <NumberRow label="Esticar" value={renderer.stretch} min={0} max={5} step={0.05} unit="×v" onChange={(stretch) => patch({ stretch }, 'Esticamento pela velocidade', 'stretch')} onEnd={end}/>
            <NumberRow label="Mínimo" value={renderer.stretchMinimum} min={0} max={20} step={0.1} unit="×" onChange={(stretchMinimum) => patch({ stretchMinimum }, 'Comprimento mínimo', 'stretchMinimum')} onEnd={end}/>
          </>)}
        <PropertyRow label="Mistura" hint={VFX_BLEND_DESCRIPTION[renderer.blend]}>
          <SelectField label="Modo de mistura" options={BLEND_OPTIONS} value={renderer.blend} onChange={(blend) => patch({ blend }, `Mistura ${VFX_BLEND_LABEL[blend].toLowerCase()}`)}/>
        </PropertyRow>
        <SliderField label="Intensidade" value={renderer.intensity} min={0} max={8} step={0.05} format={times} onChange={(intensity) => patch({ intensity }, 'Intensidade HDR', 'intensity')}/>
        <PropertyRow label="Iluminação">
          <SegmentedControl label="Iluminação" options={LIGHTING_OPTIONS} value={renderer.lighting} onChange={(lighting) => patch({ lighting }, VFX_LIGHTING_LABEL[lighting])}/>
        </PropertyRow>
        <PropertyRow label="Ordenação">
          <SelectField label="Ordenação das partículas" options={SORT_OPTIONS} value={renderer.sort} onChange={(sort) => patch({ sort }, VFX_SORT_LABEL[sort])}/>
        </PropertyRow>
      </CollapsibleSection>
      <CollapsibleSection title={`Sprite · ${textureName}`}>
        <TexturePicker value={renderer.texture} onChange={(texture) => patch({ texture }, 'Sprite do emissor')}/>
        <SliderField label="Corte alfa" value={renderer.alphaCutoff} min={0} max={1} format={(value) => (value <= 0 ? 'desligado' : `${Math.round(value * 100)} %`)} onChange={(alphaCutoff) => patch({ alphaCutoff }, 'Corte de alfa', 'alphaCutoff')}/>
        <PropertyRow label="Pivô">
          <GuiNumberField label="Pivô horizontal" value={renderer.pivot[0]} min={-1} max={2} step={0.05} unit="X" onChange={(x) => patch({ pivot: [x, renderer.pivot[1]] }, 'Pivô da placa', 'pivot')} onEnd={end}/>
          <GuiNumberField label="Pivô vertical" value={renderer.pivot[1]} min={-1} max={2} step={0.05} unit="Y" onChange={(y) => patch({ pivot: [renderer.pivot[0], y] }, 'Pivô da placa', 'pivot')} onEnd={end}/>
        </PropertyRow>
      </CollapsibleSection>
      <CollapsibleSection title="Folha de quadros" defaultOpen={renderer.flipbook !== null} trailing={<ToggleSwitch label="Usar folha de quadros" on={renderer.flipbook !== null} onToggle={() => patch({ flipbook: renderer.flipbook ? null : createFlipbook() }, renderer.flipbook ? 'Sem folha de quadros' : 'Com folha de quadros')}/>}>
        {renderer.flipbook ? (<>
            <PropertyRow label="Grade">
              <GuiNumberField label="Colunas" value={renderer.flipbook.columns} min={1} max={16} step={1} precision={0} unit="col" onChange={(columns) => patchFlipbook({ columns }, 'Colunas da folha', 'columns')} onEnd={end}/>
              <GuiNumberField label="Linhas" value={renderer.flipbook.rows} min={1} max={16} step={1} precision={0} unit="lin" onChange={(rows) => patchFlipbook({ rows }, 'Linhas da folha', 'rows')} onEnd={end}/>
            </PropertyRow>
            <NumberRow label="Quadros/s" value={renderer.flipbook.fps} min={0} max={120} step={1} precision={0} unit="fps" onChange={(fps) => patchFlipbook({ fps }, 'Quadros por segundo', 'fps')} onEnd={end} trailing={<span className="shrink-0 text-3xs text-muted-foreground">{renderer.flipbook.fps <= 0 ? 'ao longo da vida' : ''}</span>}/>
            <ToggleField label="Repetir folha" on={renderer.flipbook.loop} onToggle={() => patchFlipbook({ loop: !renderer.flipbook?.loop }, 'Laço da folha', 'loop')}/>
            <ToggleField label="Quadro inicial sorteado" on={renderer.flipbook.randomStart} onToggle={() => patchFlipbook({ randomStart: !renderer.flipbook?.randomStart }, 'Quadro inicial da folha', 'randomStart')}/>
          </>) : null}
      </CollapsibleSection>
      <CollapsibleSection title="Profundidade" defaultOpen={false}>
        <SliderField label="Suavidade" value={renderer.softness} min={0} max={3} step={0.05} format={meters} onChange={(softness) => patch({ softness }, 'Suavidade com a geometria', 'softness')}/>
        <SliderField label="Sumir perto" value={renderer.fadeNearCamera} min={0} max={5} step={0.05} format={meters} onChange={(fadeNearCamera) => patch({ fadeNearCamera }, 'Sumir perto da câmera', 'fadeNearCamera')}/>
      </CollapsibleSection>
    </>);
}
