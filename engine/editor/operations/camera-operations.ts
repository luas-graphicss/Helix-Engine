import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { assignPostProcessSettings, createPostProcessSettings, postProcessSettingsEqual, type PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { cloneCameraSettings, createCameraSettings, MAX_CAMERA_OVERLAYS, normalizeCameraSettings, type CameraPostMode, type CameraSettings, type CameraTextureSettings, type CameraViewport } from '@/engine/camera/camera-settings';
import { clampRenderLayer, firstUnnamedRenderLayer, MAX_RENDER_LAYER_NAME_LENGTH, normalizeLayerMask, toggleMaskLayer } from '@/engine/camera/layers/render-layers';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
type CameraScalarKey = 'enabled' | 'projection' | 'fieldOfView' | 'orthographicSize' | 'near' | 'far' | 'role' | 'priority' | 'background' | 'target';
const SCALAR_LABEL: Record<CameraScalarKey, string> = {
    enabled: 'Ativar câmera',
    projection: 'Projeção da câmera',
    fieldOfView: 'Campo de visão',
    orthographicSize: 'Tamanho ortográfico',
    near: 'Plano próximo',
    far: 'Plano distante',
    role: 'Função da câmera',
    priority: 'Prioridade da câmera',
    background: 'Fundo da câmera',
    target: 'Destino da câmera',
};
const viewMatrix = mat4.create();
const worldMatrix = mat4.create();
const discardedScale = vec3.create();
function applyCamera(session: EditorSession, entity: Entity, label: string, next: CameraSettings | null, mergeKey?: string): void {
    session.history.execute(new SetValueCommand<CameraSettings | null>(label, (value) => {
        entity.camera = value;
    }, entity.camera, next, mergeKey));
}
function editCamera(session: EditorSession, entity: Entity, label: string, mergeKey: string, edit: (draft: CameraSettings) => void): void {
    const current = entity.camera;
    if (!current)
        return;
    const draft = cloneCameraSettings(current);
    edit(draft);
    applyCamera(session, entity, label, normalizeCameraSettings(draft), `camera:${entity.id}:${mergeKey}`);
}
export function placeAtEditorView(session: EditorSession, entity: Entity): void {
    const { camera } = session;
    mat4.lookAt(viewMatrix, camera.position, camera.target, camera.up);
    if (mat4.invert(worldMatrix, viewMatrix))
        mat4.decomposeTranslationRotationScale(entity.transform.position, entity.transform.rotation, discardedScale, worldMatrix);
    else
        vec3.copy(entity.transform.position, camera.position);
}
export function addCameraComponent(session: EditorSession, entity: Entity): void {
    if (!entity.camera)
        applyCamera(session, entity, 'Adicionar câmera', createCameraSettings());
}
export function removeCameraComponent(session: EditorSession, entity: Entity): void {
    if (entity.camera)
        applyCamera(session, entity, 'Remover câmera', null);
}
export function setCameraValue<K extends CameraScalarKey>(session: EditorSession, entity: Entity, key: K, value: CameraSettings[K]): void {
    if (entity.camera?.[key] === value)
        return;
    editCamera(session, entity, SCALAR_LABEL[key], key, (draft) => {
        draft[key] = value;
    });
}
export function setCameraViewport(session: EditorSession, entity: Entity, patch: Partial<CameraViewport>): void {
    editCamera(session, entity, 'Área da câmera na tela', 'viewport', (draft) => {
        Object.assign(draft.viewport, patch);
    });
}
export function setCameraTexture(session: EditorSession, entity: Entity, patch: Partial<CameraTextureSettings>): void {
    editCamera(session, entity, 'Textura da câmera', 'texture', (draft) => {
        Object.assign(draft.texture, patch);
    });
}
export function setCameraBackgroundColor(session: EditorSession, entity: Entity, color: Vec3): void {
    editCamera(session, entity, 'Cor de fundo da câmera', 'backgroundColor', (draft) => {
        vec3.copy(draft.backgroundColor, color);
    });
}
export function setCameraMask(session: EditorSession, entity: Entity, mask: number): void {
    editCamera(session, entity, 'Máscara de corte', 'mask', (draft) => {
        draft.cullingMask = normalizeLayerMask(mask);
    });
}
export function toggleCameraMaskLayer(session: EditorSession, entity: Entity, layer: number): void {
    const current = entity.camera;
    if (current)
        setCameraMask(session, entity, toggleMaskLayer(current.cullingMask, layer));
}
export function addCameraOverlay(session: EditorSession, base: Entity, overlay: Entity): void {
    const current = base.camera;
    if (!current || current.overlays.includes(overlay.id) || current.overlays.length >= MAX_CAMERA_OVERLAYS)
        return;
    editCamera(session, base, `Empilhar ${overlay.name}`, `stack:add:${overlay.id}`, (draft) => {
        draft.overlays.push(overlay.id);
    });
}
export function removeCameraOverlay(session: EditorSession, base: Entity, overlayId: number): void {
    if (!base.camera?.overlays.includes(overlayId))
        return;
    editCamera(session, base, 'Remover da pilha', `stack:remove:${overlayId}`, (draft) => {
        draft.overlays = draft.overlays.filter((id) => id !== overlayId);
    });
}
export function moveCameraOverlay(session: EditorSession, base: Entity, overlayId: number, offset: -1 | 1): void {
    const overlays = base.camera?.overlays ?? [];
    const from = overlays.indexOf(overlayId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= overlays.length)
        return;
    editCamera(session, base, 'Reordenar pilha', `stack:move:${overlayId}:${to}`, (draft) => {
        draft.overlays.splice(from, 1);
        draft.overlays.splice(to, 0, overlayId);
    });
}
export function setCameraPostMode(session: EditorSession, entity: Entity, mode: CameraPostMode): void {
    if (entity.camera?.postMode === mode)
        return;
    editCamera(session, entity, 'Pós-processamento da câmera', 'postMode', (draft) => {
        draft.postMode = mode;
        if (mode === 'custom' && postProcessSettingsEqual(draft.postProcessing, createPostProcessSettings()))
            assignPostProcessSettings(draft.postProcessing, session.scene.postProcessing);
    });
}
export function editCameraPost(session: EditorSession, entity: Entity, mergeKey: string, edit: (post: PostProcessSettings) => void): void {
    editCamera(session, entity, 'Pós-processamento da câmera', `post:${mergeKey}`, (draft) => {
        edit(draft.postProcessing);
    });
}
export function setEntityLayer(session: EditorSession, entity: Entity, layer: number): void {
    const next = clampRenderLayer(layer);
    if (next === entity.layer)
        return;
    session.history.execute(new SetValueCommand<number>('Camada do ator', (value) => {
        entity.layer = value;
    }, entity.layer, next));
}
function applyLayerNames(session: EditorSession, label: string, names: string[]): void {
    const { layers } = session.scene;
    session.history.execute(new SetValueCommand<string[]>(label, (value) => {
        layers.names = value;
    }, layers.names, names));
}
export function renameRenderLayer(session: EditorSession, layer: number, name: string): void {
    const { names } = session.scene.layers;
    const trimmed = name.trim().slice(0, MAX_RENDER_LAYER_NAME_LENGTH);
    if (trimmed === '' || trimmed === names[layer])
        return;
    applyLayerNames(session, 'Renomear camada', names.map((current, index) => (index === layer ? trimmed : current)));
}
export function addRenderLayer(session: EditorSession): number | null {
    const { layers } = session.scene;
    const layer = firstUnnamedRenderLayer(layers);
    if (layer === null)
        return null;
    applyLayerNames(session, 'Nova camada', layers.names.map((current, index) => (index === layer ? `Camada ${layer}` : current)));
    return layer;
}
