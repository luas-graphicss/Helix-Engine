'use client';
import { BookmarkPlus, Library, Palette, Unlink } from 'lucide-react';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { MaterialPickerMenu } from '@/engine/editor/materials/material-picker';
import { openMaterialEditor } from '@/engine/editor/materials/material-editor-requests';
import { materialCaption, MaterialSwatch } from '@/engine/editor/materials/material-swatch';
import { applyLibraryMaterial, countMaterialUsers, detachLibraryMaterial, saveEntityMaterialToLibrary, } from '@/engine/editor/operations/material-library-operations';
import type { MaterialDocument } from '@/engine/materials/material-document';
import { formatDensity, formatMass, massForMaterial, matchPhysicalPreset, PHYSICAL_PRESETS } from '@/engine/materials/physical-material';
const ALPHA_LABEL = { opaque: 'Opaco', mask: 'Recorte', blend: 'Mistura' } as const;
export function MaterialPickerButton({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    const applied = session.materials.forMaterial(entity.material);
    return (<MaterialPickerMenu appliedId={applied?.id ?? null} onPick={(document) => applyLibraryMaterial(session, entity, document)} trigger={<IconButton label="Aplicar material da biblioteca" size="sm" className="size-5 [&_svg]:size-3"/>}>
      <Library />
    </MaterialPickerMenu>);
}
export function OwnMaterialRow({ entity }: {
    entity: Entity;
}) {
    const session = useEditorState();
    return (<div className="flex flex-col gap-1 px-2 pb-1">
      <p className="text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Material próprio deste ator: os ajustes abaixo valem só para ele. Salve na biblioteca para reutilizá-lo em outros atores e no terreno.
      </p>
      <ActionRow>
        <ActionButton icon={BookmarkPlus} onClick={() => saveEntityMaterialToLibrary(session, entity)}>
          Salvar na biblioteca
        </ActionButton>
      </ActionRow>
    </div>);
}
type LibraryMaterialSectionProps = {
    entity: Entity;
    document: MaterialDocument;
};
export function LibraryMaterialSection({ entity, document }: LibraryMaterialSectionProps) {
    const session = useEditorState();
    const { material, physics } = document;
    const users = countMaterialUsers(session, document);
    const presetId = matchPhysicalPreset(physics);
    const presetLabel = PHYSICAL_PRESETS.find((preset) => preset.id === presetId)?.label ?? 'Personalizado';
    const body = entity.rigidBody;
    const unit = (value: number) => Number(value.toFixed(2)).toString();
    return (<CollapsibleSection title="Material" trailing={<MaterialPickerButton entity={entity}/>}>
      <button type="button" onClick={() => openMaterialEditor({ materialId: document.id })} title="Abrir no editor de materiais" className="mx-2 flex items-center gap-2 rounded-sm border border-border bg-surface-sunken/40 p-1.5 text-left transition-colors hover:border-primary/50 hover:bg-highlight">
        <MaterialSwatch document={document} className="size-9"/>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-2xs font-medium text-foreground">{document.name}</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {materialCaption(document)} · {users === 1 ? 'só este ator' : `${users} atores`}
          </span>
        </span>
        <Palette className="size-3.5 shrink-0 text-primary" aria-hidden/>
      </button>

      <PropertyRow label="Superfície">
        <FieldInput readOnly value={`Rugosidade ${unit(material.roughness)} · Metálico ${unit(material.metallic)} · ${ALPHA_LABEL[material.alphaMode]}`} aria-label="Resumo da superfície"/>
      </PropertyRow>
      <PropertyRow label="Física">
        <FieldInput readOnly value={body ? `${presetLabel} · ${formatMass(massForMaterial(physics, body, entity.transform.scale))}` : `${presetLabel} · ${formatDensity(physics.density)}`} title={body ? 'Massa que o material dá ao colisor deste ator' : 'Densidade do material; a massa é calculada quando o ator ganha um corpo rígido'} aria-label="Resumo da física do material"/>
      </PropertyRow>

      <p className="px-2 pt-0.5 text-[10px] leading-relaxed text-pretty text-muted-foreground">
        Editar o material altera todos os atores que o usam. Para ajustar só este ator, torne-o único.
      </p>
      <ActionRow>
        <ActionButton icon={Palette} variant="primary" onClick={() => openMaterialEditor({ materialId: document.id })}>
          Editar material
        </ActionButton>
        <ActionButton icon={Unlink} onClick={() => detachLibraryMaterial(session, entity)} title="Cria uma cópia local do material só para este ator">
          Tornar único
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
