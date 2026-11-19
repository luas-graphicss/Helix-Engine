'use client';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { firstUnnamedRenderLayer, MAX_RENDER_LAYER_NAME_LENGTH, namedRenderLayers, renderLayerName } from '@/engine/camera/layers/render-layers';
import { addRenderLayer, renameRenderLayer, setEntityLayer } from '@/engine/editor/operations/camera-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
export function LayerField({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const [renaming, setRenaming] = useState(false);
    const { layers } = session.scene;
    const listed = namedRenderLayers(layers);
    if (!listed.includes(entity.layer))
        listed.push(entity.layer);
    const options = listed.map((layer) => ({ value: layer, label: renderLayerName(layers, layer) }));
    const currentName = renderLayerName(layers, entity.layer);
    return (<PropertyRow label="Camada" hint="Cada câmera escolhe, na máscara de corte, quais camadas desenha">
      {renaming ? (<FieldInput autoFocus defaultValue={currentName} maxLength={MAX_RENDER_LAYER_NAME_LENGTH} aria-label="Nome da camada" onBlur={(event) => {
            renameRenderLayer(session, entity.layer, event.currentTarget.value);
            setRenaming(false);
        }} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
                return;
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                event.currentTarget.value = currentName;
                event.currentTarget.blur();
            }
        }}/>) : (<SelectField label="Camada de renderização" options={options} value={entity.layer} onChange={(layer) => setEntityLayer(session, entity, layer)}/>)}
      <IconButton label="Renomear esta camada" size="sm" active={renaming} onClick={() => setRenaming(true)}>
        <Pencil />
      </IconButton>
      <IconButton label="Criar camada e mover o ator para ela" size="sm" disabled={firstUnnamedRenderLayer(layers) === null} onClick={() => {
            const layer = addRenderLayer(session);
            if (layer !== null)
                setEntityLayer(session, entity, layer);
        }}>
        <Plus />
      </IconButton>
    </PropertyRow>);
}
