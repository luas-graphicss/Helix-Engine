'use client';
import { Camera } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addCameraComponent } from '@/engine/editor/operations/camera-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { CAMERA_HINT_CLASS } from './camera-field-styles';
import { CameraLensSection } from './camera-lens-section';
import { CameraOutputSection } from './camera-output-section';
import { CameraStackSection } from './camera-stack-section';
import { CameraVisibilitySection } from './camera-visibility-section';
export function CameraSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const settings = entity.camera;
    if (settings) {
        return (<>
          <CameraLensSection entity={entity} settings={settings}/>
          <CameraOutputSection entity={entity} settings={settings}/>
          <CameraStackSection entity={entity} settings={settings}/>
          <CameraVisibilitySection entity={entity} settings={settings}/>
        </>);
    }
    if (entity.kind !== 'camera')
        return null;
    return (<CollapsibleSection title="Câmera">
      <p className={CAMERA_HINT_CLASS}>
        Este ator só guarda uma pose. Com o componente de câmera ele passa a desenhar a cena: na tela, numa pilha ou numa textura.
      </p>
      <ActionRow>
        <ActionButton icon={Camera} variant="primary" onClick={() => addCameraComponent(session, entity)}>
          Adicionar componente de câmera
        </ActionButton>
      </ActionRow>
    </CollapsibleSection>);
}
