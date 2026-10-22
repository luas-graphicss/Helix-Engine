'use client';
import { useRef } from 'react';
import { Copy, Eraser, FolderOpen, Images, LoaderCircle, Mountain, Paintbrush, RotateCcw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as vec3 from '@/engine/core/math/vec3';
import type { AlphaMode } from '@/engine/core/scene/material';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ColorField } from '@/engine/ui/color-field';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { SliderField } from '@/engine/ui/slider-field';
import { TextureImageThumbnail } from '@/engine/ui/texture-image-thumbnail';
import { ToggleField } from '@/engine/ui/toggle-field';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { applyLibraryMaterialToEntity, describeApplyTarget, importPbrFiles, materialTargetKind } from '@/engine/editor/operations/material-library-operations';
import { isGeneratedMapKind, mapOrigin, MATERIAL_MAP_KINDS, resolveMap, type MaterialDocument, type MaterialMapInfo, } from '@/engine/materials/material-document';
import type { PipelineResolution } from '@/engine/materials/map-generation';
import { formatDensity, formatMass, massForMaterial, matchPhysicalPreset, PHYSICAL_PRESETS } from '@/engine/materials/physical-material';
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp';
const ALPHA_MODES: ReadonlyArray<{
    value: AlphaMode;
    label: string;
}> = [
    { value: 'opaque', label: 'Opaco' },
    { value: 'mask', label: 'Recorte' },
    { value: 'blend', label: 'Mistura' },
];
const RESOLUTIONS: ReadonlyArray<{
    value: PipelineResolution;
    label: string;
}> = [
    { value: 256, label: '256 px' },
    { value: 512, label: '512 px' },
    { value: 1024, label: '1024 px' },
    { value: 2048, label: '2048 px' },
];
const ORIGIN_LABEL = { source: 'arquivo', generated: 'gerado', none: '—' } as const;
const times = (value: number) => `${Number(value.toFixed(2))}×`;
const pixels = (value: number) => `${Math.round(value)} px`;
const unit = (value: number) => Number(value.toFixed(2)).toString();
type SectionProps = {
    document: MaterialDocument;
};
function MapRow({ document, info }: SectionProps & {
    info: MaterialMapInfo;
}) {
    const session = useEditorState();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const image = resolveMap(document, info.kind);
    const origin = mapOrigin(document, info.kind);
    const source = document.sources[info.kind];
    const generating = origin !== 'source' && isGeneratedMapKind(info.kind) && document.generating && document.pipeline[info.kind].enabled && document.sources.albedo !== null;
    return (<div className="flex h-8 items-center gap-2 px-2" title={info.hint}>
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
        {image ? <TextureImageThumbnail image={image} resolution={48}/> : <span aria-hidden className="size-2 rounded-full bg-border-strong"/>}
      </span>
      <span className="w-[4.5rem] shrink-0 text-2xs text-muted-foreground">{info.label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground" title={source?.fileName}>
        {generating ? (<span className="flex items-center gap-1 text-muted-foreground">
            <LoaderCircle className="size-3 animate-spin" aria-hidden/> gerando…
          </span>) : image ? (<>
            <span className={cn('rounded-xs px-1 text-[10px] uppercase', origin === 'generated' ? 'bg-primary/15 text-primary' : 'bg-surface-sunken text-muted-foreground')}>{ORIGIN_LABEL[origin]}</span>
            <span className="text-muted-foreground">{` ${image.width}×${image.height}`}</span>
          </>) : (<span className="text-muted-foreground">Nenhum</span>)}
      </span>
      <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGES} className="sr-only" tabIndex={-1} aria-label={`Arquivo para o mapa ${info.label}`} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file)
                void session.materials.setSourceFile(document, info.kind, file);
        }}/>
      <IconButton label={`Carregar ${info.label} de arquivo`} size="sm" className="size-5 [&_svg]:size-3" onClick={() => fileInputRef.current?.click()}>
        <FolderOpen />
      </IconButton>
      {source ? (<IconButton label={`Remover ${info.label}`} size="sm" className="size-5 [&_svg]:size-3" onClick={() => session.materials.clearSource(document, info.kind)}>
          <X />
        </IconButton>) : (<span className="size-5" aria-hidden/>)}
    </div>);
}
function MapsSection({ document }: SectionProps) {
    const session = useEditorState();
    const setInputRef = useRef<HTMLInputElement>(null);
    const hasSources = MATERIAL_MAP_KINDS.some(({ kind }) => document.sources[kind] !== null);
    return (<CollapsibleSection title="Mapas" trailing={<IconButton label="Importar conjunto PBR (várias imagens)" size="sm" className="size-5 [&_svg]:size-3" onClick={() => setInputRef.current?.click()}>
          <Images />
        </IconButton>}>
      <input ref={setInputRef} type="file" accept={ACCEPTED_IMAGES} multiple className="sr-only" tabIndex={-1} aria-label="Imagens do conjunto PBR" onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (files.length > 0)
                void importPbrFiles(session, files, document);
        }}/>
      {MATERIAL_MAP_KINDS.map((info) => (<MapRow key={info.kind} document={document} info={info}/>))}
      <p className="px-2 pt-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Mapas marcados como <span className="text-primary">gerado</span> vêm do pipeline a partir do albedo; carregue um arquivo no slot para substituí-los.
      </p>
      <ActionRow>
        <ActionButton icon={Images} variant="primary" onClick={() => setInputRef.current?.click()}>
          Importar conjunto PBR…
        </ActionButton>
        <ActionButton icon={Eraser} disabled={!hasSources} onClick={() => session.materials.clearAllSources(document)}>
          Limpar mapas
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
function PipelineGroup({ document, kind, title, children }: SectionProps & {
    kind: 'height' | 'normal' | 'roughness' | 'occlusion';
    title: string;
    children: React.ReactNode;
}) {
    const session = useEditorState();
    const overridden = document.sources[kind] !== null;
    const enabled = document.pipeline[kind].enabled;
    return (<div className="flex flex-col gap-0.5 border-t border-border/60 pt-1 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 px-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        <span className="flex-1">{title}</span>
        {overridden && <span className="font-normal normal-case tracking-normal">usando arquivo</span>}
      </div>
      {!overridden && (<ToggleField label="Gerar" on={enabled} onToggle={() => session.materials.updatePipeline(document, { [kind]: { enabled: !enabled } })}/>)}
      {!overridden && enabled && children}
    </div>);
}
function PipelineSection({ document }: SectionProps) {
    const session = useEditorState();
    const { pipeline } = document;
    const hasAlbedo = document.sources.albedo !== null;
    const update = session.materials.updatePipeline.bind(session.materials);
    return (<CollapsibleSection title="Pipeline do albedo" trailing={document.generating ? <LoaderCircle className="size-3 animate-spin text-primary" aria-label="Gerando mapas"/> : undefined}>
      {!hasAlbedo ? (<p className="px-2 py-1 text-[10px] leading-relaxed text-pretty text-muted-foreground">
          Carregue um albedo para derivar altura, normal, rugosidade e oclusão dele. Um único mapa de cor basta para montar o material PBR inteiro.
        </p>) : (<>
          <SelectField label="Resolução" options={RESOLUTIONS} value={pipeline.resolution} onChange={(resolution) => update(document, { resolution })}/>
          <PipelineGroup document={document} kind="height" title="Altura">
            <SliderField label="Desfoque" value={pipeline.height.blur} min={0} max={12} step={1} format={pixels} onChange={(blur) => update(document, { height: { blur } })}/>
            <SliderField label="Contraste" value={pipeline.height.contrast} min={0.5} max={3} format={times} onChange={(contrast) => update(document, { height: { contrast } })}/>
            <ToggleField label="Escuro = alto" on={pipeline.height.invert} onToggle={() => update(document, { height: { invert: !pipeline.height.invert } })}/>
          </PipelineGroup>
          <PipelineGroup document={document} kind="normal" title="Normal">
            <SliderField label="Intensidade" value={pipeline.normal.strength} min={0} max={5} format={times} onChange={(strength) => update(document, { normal: { strength } })}/>
            <ToggleField label="Verde invertido (DirectX)" on={pipeline.normal.flipY} onToggle={() => update(document, { normal: { flipY: !pipeline.normal.flipY } })}/>
          </PipelineGroup>
          <PipelineGroup document={document} kind="roughness" title="Rugosidade">
            <SliderField label="Mínimo" value={pipeline.roughness.min} min={0} max={1} format={unit} onChange={(min) => update(document, { roughness: { min } })}/>
            <SliderField label="Máximo" value={pipeline.roughness.max} min={0} max={1} format={unit} onChange={(max) => update(document, { roughness: { max } })}/>
            <SliderField label="Contraste" value={pipeline.roughness.contrast} min={0.5} max={3} format={times} onChange={(contrast) => update(document, { roughness: { contrast } })}/>
            <ToggleField label="Claro = liso" on={pipeline.roughness.invert} onToggle={() => update(document, { roughness: { invert: !pipeline.roughness.invert } })}/>
          </PipelineGroup>
          <PipelineGroup document={document} kind="occlusion" title="Oclusão">
            <SliderField label="Intensidade" value={pipeline.occlusion.strength} min={0} max={1} format={unit} onChange={(strength) => update(document, { occlusion: { strength } })}/>
            <SliderField label="Raio" value={pipeline.occlusion.radius} min={1} max={24} step={1} format={pixels} onChange={(radius) => update(document, { occlusion: { radius } })}/>
          </PipelineGroup>
        </>)}
    </CollapsibleSection>);
}
function SurfaceSection({ document }: SectionProps) {
    const session = useEditorState();
    const { material } = document;
    const edit = (mutate: (m: typeof material) => void) => session.materials.updateMaterial(document, mutate);
    const hasRoughnessMap = resolveMap(document, 'roughness') !== null;
    const hasMetallicMap = resolveMap(document, 'metallic') !== null;
    return (<CollapsibleSection title="Superfície">
      <ColorField label="Cor base" value={material.baseColor} onChange={(rgb) => edit((m) => vec3.copy(m.baseColor, rgb))}/>
      <SliderField label={hasRoughnessMap ? 'Rugosidade ×' : 'Rugosidade'} value={material.roughness} min={0} max={1} format={unit} onChange={(v) => edit((m) => (m.roughness = v))}/>
      <SliderField label={hasMetallicMap ? 'Metálico ×' : 'Metálico'} value={material.metallic} min={0} max={1} format={unit} onChange={(v) => edit((m) => (m.metallic = v))}/>
      {material.normalMap && <SliderField label="Relevo" value={material.normalScale} min={0} max={4} format={times} onChange={(v) => edit((m) => (m.normalScale = v))}/>}
      {material.occlusionMap && (<SliderField label="Oclusão" value={material.occlusionStrength} min={0} max={1} format={unit} onChange={(v) => edit((m) => (m.occlusionStrength = v))}/>)}
      <SliderField label="Repetição" value={material.uvTiling} min={0.1} max={32} scale="log" format={times} onChange={(v) => edit((m) => (m.uvTiling = v))}/>
      <ColorField label="Emissivo" value={material.emissive} onChange={(rgb) => edit((m) => vec3.copy(m.emissive, rgb))}/>
      <SliderField label="Intensidade" value={material.emissiveIntensity} min={0} max={20} format={times} onChange={(v) => edit((m) => (m.emissiveIntensity = v))}/>
      <SegmentedControl label="Modo alfa" options={ALPHA_MODES} value={material.alphaMode} onChange={(alphaMode) => edit((m) => (m.alphaMode = alphaMode))}/>
      {material.alphaMode !== 'opaque' && (<SliderField label="Opacidade" value={material.opacity} min={0} max={1} format={unit} onChange={(v) => edit((m) => (m.opacity = v))}/>)}
      {material.alphaMode === 'mask' && (<SliderField label="Corte alfa" value={material.alphaCutoff} min={0} max={1} format={unit} onChange={(v) => edit((m) => (m.alphaCutoff = v))}/>)}
      <ToggleField label="Dupla face" on={material.doubleSided} onToggle={() => edit((m) => (m.doubleSided = !m.doubleSided))}/>
    </CollapsibleSection>);
}
function PhysicsSection({ document }: SectionProps) {
    const session = useEditorState();
    const { physics } = document;
    const preset = matchPhysicalPreset(physics) ?? 'custom';
    const options = [...PHYSICAL_PRESETS.map(({ id, label }) => ({ value: id, label })), { value: 'custom', label: 'Personalizado' }];
    const entity = session.selectedEntity;
    const body = entity?.rigidBody ?? null;
    const update = (patch: Partial<typeof physics>) => session.materials.updatePhysics(document, patch);
    return (<CollapsibleSection title="Física">
      <SelectField label="Preset" options={options} value={preset} onChange={(id) => {
            const chosen = PHYSICAL_PRESETS.find((candidate) => candidate.id === id);
            if (chosen)
                update({ ...chosen.properties });
        }}/>
      <SliderField label="Densidade" value={physics.density} min={20} max={20000} scale="log" format={formatDensity} onChange={(density) => update({ density })}/>
      <SliderField label="Atrito" value={physics.friction} min={0} max={2} format={unit} onChange={(friction) => update({ friction })}/>
      <SliderField label="Restituição" value={physics.restitution} min={0} max={1} format={unit} onChange={(restitution) => update({ restitution })}/>
      <SliderField label="Arrasto" value={physics.linearDamping} min={0} max={5} format={unit} onChange={(linearDamping) => update({ linearDamping })}/>
      <PropertyRow label="Peso">
        <span className="font-mono text-2xs text-muted-foreground">
          {body && entity ? `${entity.name}: ${formatMass(massForMaterial(physics, body, entity.transform.scale))}` : `1 m³ = ${formatMass(physics.density)}`}
        </span>
      </PropertyRow>
      <p className="px-2 pt-0.5 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Ao aplicar o material a um ator com corpo rígido, a massa é recalculada pela densidade e pelo volume do colisor; atrito, restituição e arrasto entram junto.
      </p>
    </CollapsibleSection>);
}
type MaterialPropertiesProps = {
    document: MaterialDocument;
    onDuplicate: () => void;
    onRemove: () => void;
};
export function MaterialProperties({ document, onDuplicate, onRemove }: MaterialPropertiesProps) {
    const session = useEditorState();
    const entity = session.selectedEntity;
    const targetKind = materialTargetKind(entity);
    const alreadyApplied = targetKind === 'mesh' && entity?.material === document.material;
    return (<aside className="flex w-[22.5rem] shrink-0 flex-col border-l border-border">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MapsSection document={document}/>
        <PipelineSection document={document}/>
        <SurfaceSection document={document}/>
        <PhysicsSection document={document}/>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-surface p-2">
        <ActionButton icon={targetKind === 'terrain' ? Mountain : Paintbrush} variant="primary" disabled={!targetKind} onClick={() => entity && applyLibraryMaterialToEntity(session, entity, document)} title={targetKind ? undefined : 'Selecione um ator com malha ou um terreno no viewport'}>
          {alreadyApplied && entity ? `Reaplicar a ${entity.name}` : describeApplyTarget(entity)}
        </ActionButton>
        <ActionRow>
          <ActionButton icon={Copy} onClick={onDuplicate}>
            Duplicar
          </ActionButton>
          <ActionButton icon={RotateCcw} onClick={() => session.materials.reset(document)} title="Volta parâmetros, pipeline e física aos padrões; os mapas ficam">
            Redefinir
          </ActionButton>
          <ActionButton icon={Trash2} variant="danger" onClick={onRemove}>
            Excluir
          </ActionButton>
        </ActionRow>
      </div>
    </aside>);
}
