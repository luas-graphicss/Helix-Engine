import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { CameraProjection, CameraSettings, CameraTextureContent } from '@/engine/camera/camera-settings';
import { assignPostProcessSettings, createPostProcessSettings, type PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { ALL_RENDER_LAYERS } from '@/engine/camera/layers/render-layers';
import type { CameraBackdrop, PerspectiveCamera } from './perspective-camera';
const FOCUS_DISTANCE = 10;
const MIN_AXIS_LENGTH = 1e-6;
const forward = vec3.create();
const disabledPost = new WeakMap<PerspectiveCamera, PostProcessSettings>();
export interface CameraOutput {
    backdrop: CameraBackdrop;
    content: CameraTextureContent;
}
export interface CameraViewState {
    projection: CameraProjection;
    fovDegrees: number;
    orthographicSize: number;
    near: number;
    far: number;
    layerMask: number;
    backdrop: CameraBackdrop;
    content: CameraTextureContent;
    postProcessing: PostProcessSettings | null;
    up: Vec3;
    backdropColor: Vec3;
}
export function aimCameraFromEntity(camera: PerspectiveCamera, entity: Entity): void {
    const m = entity.worldMatrix;
    vec3.set(camera.position, m[12], m[13], m[14]);
    vec3.set(forward, -m[8], -m[9], -m[10]);
    if (vec3.length(forward) < MIN_AXIS_LENGTH)
        vec3.set(forward, 0, 0, -1);
    vec3.normalize(forward, forward);
    vec3.scaleAndAdd(camera.target, camera.position, forward, FOCUS_DISTANCE);
    alignCameraUp(camera, entity);
}
export function alignCameraUp(camera: PerspectiveCamera, entity: Entity): void {
    const m = entity.worldMatrix;
    vec3.set(camera.up, m[4], m[5], m[6]);
    if (vec3.length(camera.up) < MIN_AXIS_LENGTH)
        vec3.set(camera.up, 0, 1, 0);
    vec3.normalize(camera.up, camera.up);
}
export function resetCameraOutput(camera: PerspectiveCamera): void {
    camera.projection = 'perspective';
    camera.layerMask = ALL_RENDER_LAYERS;
    camera.backdrop = 'scene';
    camera.content = 'color';
    camera.postProcessing = null;
    vec3.set(camera.up, 0, 1, 0);
}
export function applyCameraLens(camera: PerspectiveCamera, settings: CameraSettings): void {
    camera.projection = settings.projection;
    camera.fovDegrees = settings.fieldOfView;
    camera.orthographicSize = settings.orthographicSize;
    camera.near = settings.near;
    camera.far = settings.far;
}
function resolvePostProcessing(camera: PerspectiveCamera, settings: CameraSettings, scenePost: PostProcessSettings): PostProcessSettings | null {
    if (settings.postMode === 'scene')
        return null;
    if (settings.postMode === 'custom')
        return settings.postProcessing;
    let disabled = disabledPost.get(camera);
    if (!disabled) {
        disabled = createPostProcessSettings();
        disabledPost.set(camera, disabled);
    }
    assignPostProcessSettings(disabled, scenePost);
    disabled.enabled = false;
    return disabled;
}
export function applyCameraOutput(camera: PerspectiveCamera, settings: CameraSettings, scenePost: PostProcessSettings, output: CameraOutput): void {
    camera.layerMask = settings.cullingMask;
    camera.backdrop = output.backdrop;
    camera.content = output.content;
    vec3.copy(camera.backdropColor, settings.backgroundColor);
    camera.postProcessing = resolvePostProcessing(camera, settings, scenePost);
}
export function screenBackdrop(settings: CameraSettings, overlay: boolean): CameraBackdrop {
    if (overlay)
        return 'transparent';
    return settings.background === 'color' ? 'color' : 'scene';
}
export function captureCameraView(camera: PerspectiveCamera): CameraViewState {
    return {
        projection: camera.projection,
        fovDegrees: camera.fovDegrees,
        orthographicSize: camera.orthographicSize,
        near: camera.near,
        far: camera.far,
        layerMask: camera.layerMask,
        backdrop: camera.backdrop,
        content: camera.content,
        postProcessing: camera.postProcessing,
        up: vec3.copy(vec3.create(), camera.up),
        backdropColor: vec3.copy(vec3.create(), camera.backdropColor),
    };
}
export function restoreCameraView(camera: PerspectiveCamera, state: CameraViewState): void {
    camera.projection = state.projection;
    camera.fovDegrees = state.fovDegrees;
    camera.orthographicSize = state.orthographicSize;
    camera.near = state.near;
    camera.far = state.far;
    camera.layerMask = state.layerMask;
    camera.backdrop = state.backdrop;
    camera.content = state.content;
    camera.postProcessing = state.postProcessing;
    vec3.copy(camera.up, state.up);
    vec3.copy(camera.backdropColor, state.backdropColor);
}
