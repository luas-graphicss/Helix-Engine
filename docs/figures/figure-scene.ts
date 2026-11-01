import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { sunRotationFromDirection } from '@/engine/core/environment/celestial';
import { createAmbientLight, createDirectionalLight } from '@/engine/core/scene/light';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import { Scene } from '@/engine/core/scene/scene';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { GizmoRenderRequest } from '@/engine/renderer/passes/gizmo-pass';
export interface FigureScene {
    readonly id: string;
    readonly width: number;
    readonly height: number;
    readonly showGrid: boolean;
    build(camera: PerspectiveCamera): Scene;
    gizmo?(scene: Scene): GizmoRenderRequest;
}
export const FIGURE_COLORS = {
    amber: [0.92, 0.4, 0.07],
    blue: [0.2, 0.45, 0.85],
    slate: [0.58, 0.6, 0.66],
    graphite: [0.3, 0.31, 0.34],
    green: [0.4, 0.75, 0.32],
    red: [0.9, 0.31, 0.28],
} as const satisfies Record<string, readonly [
    number,
    number,
    number
]>;
export type FigureColor = keyof typeof FIGURE_COLORS;
export function figureMaterial(name: string, color: FigureColor | readonly [
    number,
    number,
    number
], options: Partial<Material> = {}): Material {
    const rgb = typeof color === 'string' ? FIGURE_COLORS[color] : color;
    return createMaterial({ name, baseColor: vec3.create(rgb[0], rgb[1], rgb[2]), roughness: 0.55, ...options });
}
export interface FigureSceneOptions {
    sky?: boolean;
    sunIntensity?: number;
    ambientIntensity?: number;
}
export function createFigureScene({ sky = false, sunIntensity = 2.6, ambientIntensity = 0.9 }: FigureSceneOptions = {}): Scene {
    const scene = new Scene('Figura');
    scene.sky.enabled = sky;
    const lighting = scene.createEntity({ name: 'Iluminação', kind: 'group' });
    const sun = scene.createEntity({ name: 'Sol', kind: 'light', light: createDirectionalLight({ intensity: sunIntensity }) }, lighting);
    sunRotationFromDirection(sun.transform.rotation, vec3.normalize(vec3.create(), vec3.create(0.55, 0.8, 0.45)));
    scene.createEntity({
        name: 'Ambiente',
        kind: 'light',
        light: createAmbientLight({ intensity: ambientIntensity, skyColor: vec3.create(0.62, 0.66, 0.74), groundColor: vec3.create(0.22, 0.22, 0.24) }),
    }, lighting);
    return scene;
}
export function lookAt(camera: PerspectiveCamera, position: Vec3 | readonly [
    number,
    number,
    number
], target: Vec3 | readonly [
    number,
    number,
    number
], fovDegrees = 38): void {
    vec3.set(camera.position, position[0], position[1], position[2]);
    vec3.set(camera.target, target[0], target[1], target[2]);
    camera.fovDegrees = fovDegrees;
}
