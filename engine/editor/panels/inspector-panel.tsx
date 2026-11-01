'use client';
import { Box, Sun, Camera, FileCode2, Folder, LayoutTemplate, MousePointer2, Locate, Copy, Trash2, Mountain, PersonStanding, Pickaxe, Sparkles, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { ToggleField } from '@/engine/ui/toggle-field';
import { PropertyRow } from '@/engine/ui/property-row';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SliderField } from '@/engine/ui/slider-field';
import { ColorField } from '@/engine/ui/color-field';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import { MATERIAL_TEXTURE_SLOTS, type AlphaMode } from '@/engine/core/scene/material';
import { GUI_SURFACE_CONTENT_LABEL } from '@/engine/gui/world/gui-surface-settings';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { getTriangleCount, getVertexCount } from '@/engine/renderer/geometry/mesh-data';
import { deleteEntity, duplicateEntity, renameEntity, setEntityVisibility, setShadowFlag } from '@/engine/editor/operations/entity-operations';
import { setMaterialAlphaMode, setMaterialColor, setMaterialDoubleSided, setMaterialScalar, setMaterialTexture, } from '@/engine/editor/operations/material-operations';
import { loadTextureIntoSlot } from '@/engine/editor/operations/texture-operations';
import { TextureSlotRow } from './inspector/texture-slot-row';
import { LightSection } from './inspector/light-section';
import { RigidBodySection } from './inspector/rigid-body-section';
import { CsgSection } from './inspector/csg-section';
import { CharacterSection } from './inspector/character-section';
import { AudioSourceSection } from './inspector/audio-source-section';
import { AudioZoneSection } from './inspector/audio-zone-section';
import { AudioAttachSection } from './inspector/audio-attach-section';
import { GuiSurfaceSection } from './inspector/gui-surface-section';
import { GuiAttachSection } from './inspector/gui-attach-section';
import { VfxSection } from './inspector/vfx-section';
import { VfxAttachSection } from './inspector/vfx-attach-section';
import { ScriptAttachSection, ScriptSection } from './inspector/script-section';
import { BoneSection, RigSection } from './inspector/rig-section';
import { LibraryMaterialSection, MaterialPickerButton, OwnMaterialRow } from './inspector/material-library-section';
import { TransformSection } from './inspector/transform-section';
import { formatNumber, ScalarField } from './inspector/number-fields';
import { INSPECTOR_NAME_INPUT_ID } from '@/engine/editor/shortcuts/focus-targets';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
const AXES = ['x', 'y', 'z'] as const;
const KIND_ICON: Record<EntityKind, LucideIcon> = { group: Folder, mesh: Box, light: Sun, camera: Camera, terrain: Mountain, character: PersonStanding, sound: Volume2, gui: LayoutTemplate, vfx: Sparkles, script: FileCode2 };
const KIND_LABEL: Record<EntityKind, string> = { group: 'Grupo', mesh: 'Malha estática', light: 'Luz', camera: 'Câmera', terrain: 'Terreno', character: 'Personagem', sound: 'Som', gui: 'Interface no mundo', vfx: 'Efeito visual', script: 'Script' };
function kindLabel(entity: Entity): string {
    if (entity.kind === 'gui' && entity.guiSurface)
        return `Interface · ${GUI_SURFACE_CONTENT_LABEL[entity.guiSurface.content.kind].toLowerCase()}`;
    if (entity.kind === 'script')
        return 'Script';
    if (entity.kind !== 'sound')
        return KIND_LABEL[entity.kind];
    if (entity.audioSource && entity.audioZone)
        return 'Fonte de som + zona';
    return entity.audioZone ? 'Zona acústica' : 'Fonte de som';
}
const ALPHA_MODES: ReadonlyArray<{
    value: AlphaMode;
    label: string;
}> = [
    { value: 'opaque', label: 'Opaco' },
    { value: 'mask', label: 'Recorte' },
    { value: 'blend', label: 'Mistura' },
];
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
    const session = useEditorSession();
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
    const session = useEditorSession();
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
function TerrainSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
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
    const session = useSessionTopic('scene', 'selection', 'resources', 'assets', 'playtest', 'view');
    const hint = useShortcutHint();
    const entity = session.selectedEntity;
    if (!entity)
        return <EmptySelection />;
    const Icon = KIND_ICON[entity.kind];
    const kind = kindLabel(entity);
    return (<div className="flex h-full flex-col">
      
      <PanelToolbar className="gap-1.5 pl-2">
        <Icon className="size-3.5 shrink-0 text-primary" aria-hidden/>
        <input key={`${entity.id}-${entity.name}`} id={INSPECTOR_NAME_INPUT_ID} defaultValue={entity.name} aria-label="Nome do ator" title="Nome do ator (F2 para editar)" onBlur={(event) => renameEntity(session, entity, event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = entity.name;
                event.currentTarget.blur();
            }
        }} className="h-full min-w-20 flex-1 rounded-xs bg-transparent px-1 text-2xs font-semibold text-foreground outline-none hover:bg-highlight focus-visible:bg-surface-sunken focus-visible:shadow-focus"/>
        <span className="max-w-[40%] shrink truncate font-mono text-3xs text-muted-foreground" title={kind}>
          {kind}
        </span>
        <IconButton label="Enquadrar (F)" size="sm" onClick={() => session.focusEntity(entity)}>
          <Locate />
        </IconButton>
        <IconButton label={hint('Duplicar', 'edit.duplicate')} size="sm" onClick={() => duplicateEntity(session, entity)}>
          <Copy />
        </IconButton>
        <IconButton label="Excluir (Del)" size="sm" className="hover:text-destructive" onClick={() => deleteEntity(session, entity)}>
          <Trash2 />
        </IconButton>
      </PanelToolbar>

      <div className="flex-1 overflow-auto">
        <ScriptSection entity={entity}/>
        {entity.kind !== 'script' && <TransformSection entity={entity}/>}

        <GuiSurfaceSection entity={entity}/>
        <VfxSection entity={entity}/>
        <AudioSourceSection entity={entity}/>
        <AudioZoneSection entity={entity}/>
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
        <GuiAttachSection entity={entity}/>
        <VfxAttachSection entity={entity}/>
        <AudioAttachSection entity={entity}/>
        <ScriptAttachSection entity={entity}/>

        {entity.kind !== 'script' && (<CollapsibleSection title="Renderização">
          <ToggleField label="Visível" on={entity.visible} onToggle={() => setEntityVisibility(session, entity, !entity.visible)}/>
          {(entity.mesh || entity.terrain) && (<>
              <ToggleField label="Projeta sombras" on={entity.castShadows} onToggle={() => setShadowFlag(session, entity, 'castShadows', !entity.castShadows)}/>
              <ToggleField label="Recebe sombras" on={entity.receiveShadows} onToggle={() => setShadowFlag(session, entity, 'receiveShadows', !entity.receiveShadows)}/>
            </>)}
        </CollapsibleSection>)}
      </div>
    </div>);
}
