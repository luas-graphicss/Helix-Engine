'use client';
import type { Entity } from '@/engine/core/scene/entity';
import type { CameraPostMode, CameraSettings } from '@/engine/camera/camera-settings';
import { setCameraMask, setCameraPostMode, toggleCameraMaskLayer } from '@/engine/editor/operations/camera-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { CameraPostFields } from './camera-post-fields';
import { CullingMaskField } from './culling-mask-field';
const POST_MODE_OPTIONS: ReadonlyArray<{
    value: CameraPostMode;
    label: string;
}> = [
    { value: 'scene', label: 'Da cena' },
    { value: 'off', label: 'Desligado' },
    { value: 'custom', label: 'Próprio' },
];
export function CameraVisibilitySection({ entity, settings }: {
    entity: Entity;
    settings: CameraSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="Camadas e efeitos">
      <CullingMaskField mask={settings.cullingMask} layers={session.scene.layers} onToggle={(layer) => toggleCameraMaskLayer(session, entity, layer)} onSet={(mask) => setCameraMask(session, entity, mask)}/>
      <PropertyRow label="Pós-processamento" hint="Da cena segue o painel Pós-processamento; Próprio dá a esta câmera um perfil só dela">
        <SegmentedControl label="Pós-processamento" options={POST_MODE_OPTIONS} value={settings.postMode} onChange={(mode) => setCameraPostMode(session, entity, mode)}/>
      </PropertyRow>
      {settings.postMode === 'custom' && <CameraPostFields entity={entity} post={settings.postProcessing}/>}
    </CollapsibleSection>);
}
