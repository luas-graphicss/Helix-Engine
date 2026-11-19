import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { assignPostProcessSettings, createPostProcessSettings, type PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { ALL_RENDER_LAYERS, normalizeLayerMask } from './layers/render-layers';
export type CameraProjection = 'perspective' | 'orthographic';
export type CameraRole = 'base' | 'overlay';
export type CameraBackground = 'sky' | 'color';
export type CameraTarget = 'screen' | 'texture';
export type CameraTextureContent = 'color' | 'depth';
export type CameraPostMode = 'scene' | 'off' | 'custom';
export interface CameraViewport {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface CameraTextureSettings {
    width: number;
    height: number;
    content: CameraTextureContent;
    frameRate: number;
}
export interface CameraSettings {
    enabled: boolean;
    projection: CameraProjection;
    fieldOfView: number;
    orthographicSize: number;
    near: number;
    far: number;
    role: CameraRole;
    overlays: number[];
    priority: number;
    viewport: CameraViewport;
    background: CameraBackground;
    backgroundColor: Vec3;
    cullingMask: number;
    target: CameraTarget;
    texture: CameraTextureSettings;
    postMode: CameraPostMode;
    postProcessing: PostProcessSettings;
}
export const MIN_FIELD_OF_VIEW = 1;
export const MAX_FIELD_OF_VIEW = 170;
export const MIN_ORTHOGRAPHIC_SIZE = 0.01;
export const MAX_ORTHOGRAPHIC_SIZE = 5000;
export const MIN_NEAR_PLANE = 0.001;
export const MIN_CLIP_RANGE = 0.01;
export const MAX_FAR_PLANE = 100000;
export const MIN_CAMERA_PRIORITY = -100;
export const MAX_CAMERA_PRIORITY = 100;
export const MIN_VIEWPORT_SPAN = 0.02;
export const MIN_TEXTURE_SIDE = 16;
export const MAX_TEXTURE_SIDE = 2048;
export const MAX_TEXTURE_FRAME_RATE = 60;
export const MAX_CAMERA_OVERLAYS = 4;
const DEFAULT_FIELD_OF_VIEW = 60;
const DEFAULT_ORTHOGRAPHIC_SIZE = 5;
const DEFAULT_NEAR_PLANE = 0.05;
const DEFAULT_FAR_PLANE = 500;
const DEFAULT_TEXTURE_SIDE = 512;
const DEFAULT_TEXTURE_FRAME_RATE = 30;
const PROJECTIONS: readonly CameraProjection[] = ['perspective', 'orthographic'];
const ROLES: readonly CameraRole[] = ['base', 'overlay'];
const BACKGROUNDS: readonly CameraBackground[] = ['sky', 'color'];
const TARGETS: readonly CameraTarget[] = ['screen', 'texture'];
const TEXTURE_CONTENTS: readonly CameraTextureContent[] = ['color', 'depth'];
const POST_MODES: readonly CameraPostMode[] = ['scene', 'off', 'custom'];
function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(value, max)) : fallback;
}
function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return options.includes(value as T) ? (value as T) : fallback;
}
export function createFullViewport(): CameraViewport {
    return { x: 0, y: 0, width: 1, height: 1 };
}
export function isFullViewport(viewport: CameraViewport): boolean {
    return viewport.x <= 0 && viewport.y <= 0 && viewport.width >= 1 && viewport.height >= 1;
}
export function normalizeCameraViewport(viewport: CameraViewport): CameraViewport {
    const width = clamp(viewport.width, MIN_VIEWPORT_SPAN, 1, 1);
    const height = clamp(viewport.height, MIN_VIEWPORT_SPAN, 1, 1);
    return { x: clamp(viewport.x, 0, 1 - width, 0), y: clamp(viewport.y, 0, 1 - height, 0), width, height };
}
function createTextureSettings(): CameraTextureSettings {
    return { width: DEFAULT_TEXTURE_SIDE, height: DEFAULT_TEXTURE_SIDE, content: 'color', frameRate: DEFAULT_TEXTURE_FRAME_RATE };
}
export function createCameraSettings(): CameraSettings {
    return {
        enabled: true,
        projection: 'perspective',
        fieldOfView: DEFAULT_FIELD_OF_VIEW,
        orthographicSize: DEFAULT_ORTHOGRAPHIC_SIZE,
        near: DEFAULT_NEAR_PLANE,
        far: DEFAULT_FAR_PLANE,
        role: 'base',
        overlays: [],
        priority: 0,
        viewport: createFullViewport(),
        background: 'sky',
        backgroundColor: vec3.create(0.02, 0.022, 0.027),
        cullingMask: ALL_RENDER_LAYERS,
        target: 'screen',
        texture: createTextureSettings(),
        postMode: 'scene',
        postProcessing: createPostProcessSettings(),
    };
}
export function cloneCameraSettings(settings: CameraSettings): CameraSettings {
    const postProcessing = createPostProcessSettings();
    assignPostProcessSettings(postProcessing, settings.postProcessing);
    return {
        ...settings,
        overlays: [...settings.overlays],
        viewport: { ...settings.viewport },
        backgroundColor: vec3.copy(vec3.create(), settings.backgroundColor),
        texture: { ...settings.texture },
        postProcessing,
    };
}
function normalizeOverlays(overlays: unknown): number[] {
    if (!Array.isArray(overlays))
        return [];
    const unique: number[] = [];
    for (const id of overlays as unknown[]) {
        if (typeof id === 'number' && Number.isInteger(id) && id > 0 && !unique.includes(id))
            unique.push(id);
    }
    return unique.slice(0, MAX_CAMERA_OVERLAYS);
}
export function normalizeCameraSettings(settings: CameraSettings): CameraSettings {
    const near = clamp(settings.near, MIN_NEAR_PLANE, MAX_FAR_PLANE - MIN_CLIP_RANGE, DEFAULT_NEAR_PLANE);
    const role = oneOf(settings.role, ROLES, 'base');
    const texture = settings.texture ?? createTextureSettings();
    const color = settings.backgroundColor;
    return {
        enabled: settings.enabled !== false,
        projection: oneOf(settings.projection, PROJECTIONS, 'perspective'),
        fieldOfView: clamp(settings.fieldOfView, MIN_FIELD_OF_VIEW, MAX_FIELD_OF_VIEW, DEFAULT_FIELD_OF_VIEW),
        orthographicSize: clamp(settings.orthographicSize, MIN_ORTHOGRAPHIC_SIZE, MAX_ORTHOGRAPHIC_SIZE, DEFAULT_ORTHOGRAPHIC_SIZE),
        near,
        far: clamp(settings.far, near + MIN_CLIP_RANGE, MAX_FAR_PLANE, Math.max(DEFAULT_FAR_PLANE, near + MIN_CLIP_RANGE)),
        role,
        overlays: role === 'base' ? normalizeOverlays(settings.overlays) : [],
        priority: Math.round(clamp(settings.priority, MIN_CAMERA_PRIORITY, MAX_CAMERA_PRIORITY, 0)),
        viewport: normalizeCameraViewport(settings.viewport ?? createFullViewport()),
        background: oneOf(settings.background, BACKGROUNDS, 'sky'),
        backgroundColor: vec3.create(clamp(color?.[0], 0, 1, 0), clamp(color?.[1], 0, 1, 0), clamp(color?.[2], 0, 1, 0)),
        cullingMask: normalizeLayerMask(settings.cullingMask),
        target: role === 'base' ? oneOf(settings.target, TARGETS, 'screen') : 'screen',
        texture: {
            width: Math.round(clamp(texture.width, MIN_TEXTURE_SIDE, MAX_TEXTURE_SIDE, DEFAULT_TEXTURE_SIDE)),
            height: Math.round(clamp(texture.height, MIN_TEXTURE_SIDE, MAX_TEXTURE_SIDE, DEFAULT_TEXTURE_SIDE)),
            content: oneOf(texture.content, TEXTURE_CONTENTS, 'color'),
            frameRate: Math.round(clamp(texture.frameRate, 0, MAX_TEXTURE_FRAME_RATE, DEFAULT_TEXTURE_FRAME_RATE)),
        },
        postMode: oneOf(settings.postMode, POST_MODES, 'scene'),
        postProcessing: settings.postProcessing ?? createPostProcessSettings(),
    };
}
