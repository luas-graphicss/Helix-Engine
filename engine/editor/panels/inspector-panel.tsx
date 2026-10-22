'use client';
import { Box, Sun, Camera, Folder, MousePointer2, RotateCcw, Locate, Copy, Trash2, Mountain, PersonStanding, Pickaxe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { ToggleField } from '@/engine/ui/toggle-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { SliderField } from '@/engine/ui/slider-field';
import { ColorField } from '@/engine/ui/color-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import { MATERIAL_TEXTURE_SLOTS, type AlphaMode } from '@/engine/core/scene/material';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { getTriangleCount, getVertexCount } from '@/engine/renderer/geometry/mesh-data';
import { deleteEntity, duplicateEntity, renameEntity, setEntityVisibility, setShadowFlag } from '@/engine/editor/operations/entity-operations';
import { resetTransform, setTransformComponent, type TransformField } from '@/engine/editor/operations/transform-operations';
import { setMaterialAlphaMode, setMaterialColor, setMaterialDoubleSided, setMaterialScalar, setMaterialTexture, } from '@/engine/editor/operations/material-operations';
import { setLightColor, setLightIntensity, setLightShadows } from '@/engine/editor/operations/light-operations';
import { loadTextureIntoSlot } from '@/engine/editor/operations/texture-operations';
import { TextureSlotRow } from './inspector/texture-slot-row';
import { RigidBodySection } from './inspector/rigid-body-section';
import { CsgSection } from './inspector/csg-section';
import { CharacterSection } from './inspector/character-section';
import { BoneSection, RigSection } from './inspector/rig-section';
import { LibraryMaterialSection, MaterialPickerButton, OwnMaterialRow } from './inspector/material-library-section';
import { formatNumber, ScalarField, Vector3Input } from './inspector/number-fields';
import { INSPECTOR_NAME_INPUT_ID } from '@/engine/editor/shortcuts/focus-targets';
const AXES = ['x', 'y', 'z'] as const;
const KIND_ICON: Record<EntityKind, LucideIcon> = { group: Folder, mesh: Box, light: Sun, camera: Camera, terrain: Mountain, character: PersonStanding };
const KIND_LABEL: Record<EntityKind, string> = { group: 'Grupo', mesh: 'Malha estática', light: 'Luz', camera: 'Câmera', terrain: 'Terreno', character: 'Personagem' };
const ALPHA_MODES: ReadonlyArray<{
    value: AlphaMode;
    label: string;
}> = [
    { value: 'opaque', label: 'Opaco' },
    { value: 'mask', label: 'Recorte' },
    { value: 'blend', label: 'Mistura' },
];
function Vector3Fields({ entity, field, suffix }: {
    entity: Entity;
    field: TransformField;
    suffix?: string;
}) {
    const session = useEditorState();
    return (<>
      <Vector3Input label={field} values={entity.transform[field]} suffix={suffix} onCommit={(axis, value) => setTransformComponent(session, entity, field, axis, value)}/>
      <IconButton label={`Redefinir ${field}`} size="sm" className="size-5 [&_svg]:size-3" onClick={() => resetTransform(session, entity, field)}>
        <RotateCcw />
      </IconButton>
    </>);
}
function EmptySelection() {
    return (<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <MousePointer2 className="size-5 opacity-60" aria-hidden/>
      <p className="text-2xs leading-relaxed text-pretty">Nenhum ator selecionado. Clique em um objeto no viewport ou na hierarquia.</p>
    </div>);
}
function MeshSection({ entity }: {
    entity: Entity;
}) {
    const mesh = entity.mesh;
    if (!mesh)
        return null;
    const bounds = getLocalBounds(mesh);
    const size = AXES.map((_, axis) => formatNumber(bounds.max[axis] - bounds.min[axis])).join(' × ');
    return (<CollapsibleSection title="Malha estática">
      <PropertyRow label="Malha">
        <FieldInput readOnly value={mesh.name} aria-label="Malha"/>
      </PropertyRow>
      <PropertyRow label="Vértices">
        <FieldInput readOnly value={getVertexCount(mesh).toLocaleString('pt-BR')} aria-label="Vértices"/>
      </PropertyRow>
      <PropertyRow label="Triângulos">
        <FieldInput readOnly value={getTriangleCount(mesh).toLocaleString('pt-BR')} aria-label="Triângulos"/>
      </PropertyRow>
      <PropertyRow label="Dimensões">
        <FieldInput readOnly value={size} aria-label="Dimensões locais"/>
      </PropertyRow>
    </CollapsibleSection>);
}
function MaterialSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const material = entity.material;
    if (!material)
        return null;
    const document = session.materials.forMaterial(material);
    if (document)
        return <LibraryMaterialSection entity={entity} document={document}/>;
    return (<CollapsibleSection title="Material" trailing={<MaterialPickerButton entity={entity}/>}>
      <OwnMaterialRow entity={entity}/>
      <PropertyRow label="Nome">
        <FieldInput readOnly value={material.name} aria-label="Nome do material"/>
      </PropertyRow>
      <ColorField label="Cor base" value={material.baseColor} onChange={(rgb) => setMaterialColor(session, entity, 'baseColor', rgb)}/>
      <SliderField label="Rugosidade" value={material.roughness} min={0} max={1} onChange={(value) => setMaterialScalar(session, entity, 'roughness', value)}/>
      <SliderField label="Metálico" value={material.metallic} min={0} max={1} onChange={(value) => setMaterialScalar(session, entity, 'metallic', value)}/>
      <ColorField label="Emissivo" value={material.emissive} onChange={(rgb) => setMaterialColor(session, entity, 'emissive', rgb)}/>
      <PropertyRow label="Intens. emissiva">
        <ScalarField label="Intensidade emissiva" value={material.emissiveIntensity} onCommit={(value) => setMaterialScalar(session, entity, 'emissiveIntensity', value)}/>
      </PropertyRow>
      <PropertyRow label="Modo alfa">
        <SegmentedControl label="Modo alfa" options={ALPHA_MODES} value={material.alphaMode} onChange={(mode) => setMaterialAlphaMode(session, entity, mode)}/>
      </PropertyRow>
      {material.alphaMode !== 'opaque' && (<SliderField label="Opacidade" value={material.opacity} min={0} max={1} onChange={(value) => setMaterialScalar(session, entity, 'opacity', value)}/>)}
      {material.alphaMode === 'mask' && (<SliderField label="Corte alfa" value={material.alphaCutoff} min={0} max={1} onChange={(value) => setMaterialScalar(session, entity, 'alphaCutoff', value)}/>)}
      <ToggleField label="Dupla face" on={material.doubleSided} onToggle={() => setMaterialDoubleSided(session, entity, !material.doubleSided)}/>
    </CollapsibleSection>);
}
function TexturesSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const material = entity.material;
    if (!material || material.libraryId)
        return null;
    const library = session.resources.byKind('texture').map((resource) => resource.texture);
    return (<CollapsibleSection title="Texturas">
      {MATERIAL_TEXTURE_SLOTS.map(({ slot, label }) => (<TextureSlotRow key={slot} label={label} texture={material[slot]} library={library} onLoadFile={(file) => void loadTextureIntoSlot(session, entity, slot, file)} onPick={(texture) => setMaterialTexture(session, entity, slot, texture)} onRemove={() => setMaterialTexture(session, entity, slot, null)}/>))}
      {material.normalMap && (<SliderField label="Escala normal" value={material.normalScale} min={0} max={4} onChange={(value) => setMaterialScalar(session, entity, 'normalScale', value)}/>)}
      {material.occlusionMap && (<SliderField label="Força oclusão" value={material.occlusionStrength} min={0} max={1} onChange={(value) => setMaterialScalar(session, entity, 'occlusionStrength', value)}/>)}
    </CollapsibleSection>);
}
function LightSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const light = entity.light;
    if (!light)
        return null;
    return (<CollapsibleSection title={light.type === 'directional' ? 'Luz direcional' : 'Luz ambiente'}>
      <PropertyRow label="Intensidade">
        <ScalarField label="Intensidade" value={light.intensity} onCommit={(value) => setLightIntensity(session, entity, value)}/>
      </PropertyRow>
      {light.type === 'directional' ? (<>
          <ColorField label="Cor" value={light.color} onChange={(rgb) => setLightColor(session, entity, 'color', rgb)}/>
          <ToggleField label="Projeta sombras" on={light.castShadows} onToggle={() => setLightShadows(session, entity, !light.castShadows)}/>
        </>) : (<>
          <ColorField label="Céu" value={light.skyColor} onChange={(rgb) => setLightColor(session, entity, 'skyColor', rgb)}/>
          <ColorField label="Chão" value={light.groundColor} onChange={(rgb) => setLightColor(session, entity, 'groundColor', rgb)}/>
        </>)}
    </CollapsibleSection>);
}
function TerrainSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const terrain = entity.terrain;
    if (!terrain)
        return null;
    const { minHeight, maxHeight } = terrain.tiles;
    return (<CollapsibleSection title="Terreno">
      <PropertyRow label="Tamanho">
        <FieldInput readOnly value={`${terrain.size} m · ${terrain.resolution}² vértices`} aria-label="Tamanho do terreno"/>
      </PropertyRow>
      <PropertyRow label="Alturas">
        <FieldInput readOnly value={`${formatNumber(minHeight)} a ${formatNumber(maxHeight)} m`} aria-label="Faixa de alturas"/>
      </PropertyRow>
      <PropertyRow label="Camadas">
        <FieldInput readOnly value={terrain.layers.map((layer) => layer.name).join(', ') || 'Nenhuma'} aria-label="Camadas"/>
      </PropertyRow>
      <ActionRow>
        <ActionButton icon={Pickaxe} variant="primary" onClick={() => session.setTool('terrain')}>
          Editar terreno (T)
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
export function InspectorPanel() {
    const session = useEditorState();
    const entity = session.selectedEntity;
    if (!entity)
        return <EmptySelection />;
    const Icon = KIND_ICON[entity.kind];
    return (<div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-muted-foreground">
          <Icon className="size-4" aria-hidden/>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <input key={`${entity.id}-${entity.name}`} id={INSPECTOR_NAME_INPUT_ID} defaultValue={entity.name} aria-label="Nome do ator" onBlur={(event) => renameEntity(session, entity, event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = entity.name;
                event.currentTarget.blur();
            }
        }} className="h-5 w-full min-w-0 bg-transparent text-xs font-semibold text-foreground outline-none"/>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {KIND_LABEL[entity.kind]} · ID {entity.id.toString(16).toUpperCase().padStart(4, '0')}
          </span>
        </div>
        <IconButton label="Enquadrar (F)" size="sm" onClick={() => session.focusEntity(entity)}>
          <Locate />
        </IconButton>
        <IconButton label="Duplicar (Ctrl+D)" size="sm" onClick={() => duplicateEntity(session, entity)}>
          <Copy />
        </IconButton>
        <IconButton label="Excluir (Del)" size="sm" className="hover:text-destructive" onClick={() => deleteEntity(session, entity)}>
          <Trash2 />
        </IconButton>
      </div>

      <div className="flex-1 overflow-auto">
        <CollapsibleSection title="Transformação" trailing={<IconButton label="Redefinir transformação" size="sm" className="size-5 [&_svg]:size-3" onClick={() => resetTransform(session, entity)}>
              <RotateCcw />
            </IconButton>}>
          <PropertyRow label="Posição">
            <Vector3Fields entity={entity} field="position"/>
          </PropertyRow>
          <PropertyRow label="Rotação">
            <Vector3Fields entity={entity} field="rotation" suffix="°"/>
          </PropertyRow>
          <PropertyRow label="Escala">
            <Vector3Fields entity={entity} field="scale"/>
          </PropertyRow>
        </CollapsibleSection>

        <CharacterSection entity={entity}/>
        <RigSection entity={entity}/>
        <BoneSection entity={entity}/>
        <TerrainSection entity={entity}/>
        <MeshSection entity={entity}/>
        <CsgSection entity={entity}/>
        <RigidBodySection entity={entity}/>
        <MaterialSection entity={entity}/>
        <TexturesSection entity={entity}/>
        <LightSection entity={entity}/>

        <CollapsibleSection title="Renderização">
          <ToggleField label="Visível" on={entity.visible} onToggle={() => setEntityVisibility(session, entity, !entity.visible)}/>
          {(entity.mesh || entity.terrain) && (<>
              <ToggleField label="Projeta sombras" on={entity.castShadows} onToggle={() => setShadowFlag(session, entity, 'castShadows', !entity.castShadows)}/>
              <ToggleField label="Recebe sombras" on={entity.receiveShadows} onToggle={() => setShadowFlag(session, entity, 'receiveShadows', !entity.receiveShadows)}/>
            </>)}
        </CollapsibleSection>
      </div>
    </div>);
}
