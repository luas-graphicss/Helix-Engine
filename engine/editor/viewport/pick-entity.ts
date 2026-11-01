import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { createRay, intersectRayAabb, transformRay, type Ray } from '@/engine/core/math/ray';
import { degToRad } from '@/engine/core/math/scalar';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { getLocalBounds } from '@/engine/renderer/geometry/bounds';
import { raycastMesh } from '@/engine/renderer/geometry/mesh-raycast';
import type { LightHelperMode } from '@/engine/renderer/passes/light-helper-pass';
import type { SoundHelperMode } from '@/engine/renderer/passes/sound-helper-pass';
import type { VfxHelperMode } from '@/engine/renderer/passes/vfx-helper-pass';
import type { TerrainHit } from '@/engine/terrain/core/terrain';
import { computeLocalRect, createLocalRect, createSurfaceFrame, intersectSurfaceFrame, resolveSurfaceFrame } from '@/engine/gui/world/gui-surface-frame';
const inverseWorld = mat4.create();
const surfaceRect = createLocalRect();
const surfaceFrame = createSurfaceFrame();
const worldRay = createRay();
const localRay = createRay();
const nearPoint = vec3.create();
const farPoint = vec3.create();
const toLight = vec3.create();
const terrainHit: TerrainHit = { distance: 0, point: vec3.create() };
const LIGHT_PICK_FRACTION = 0.014;
interface PickCandidate {
    entity: Entity;
    entry: number;
    exact: boolean;
}
const candidates: PickCandidate[] = [];
function unproject(out: vec3.Vec3, x: number, y: number, z: number, inverse: mat4.Mat4): void {
    const w = inverse[3] * x + inverse[7] * y + inverse[11] * z + inverse[15] || 1;
    out[0] = (inverse[0] * x + inverse[4] * y + inverse[8] * z + inverse[12]) / w;
    out[1] = (inverse[1] * x + inverse[5] * y + inverse[9] * z + inverse[13]) / w;
    out[2] = (inverse[2] * x + inverse[6] * y + inverse[10] * z + inverse[14]) / w;
}
export function buildPickRay(out: Ray, camera: PerspectiveCamera, u: number, v: number): Ray | null {
    if (!camera.invertible)
        return null;
    const inverse = camera.inverseViewProjectionMatrix;
    const ndcX = u * 2 - 1;
    const ndcY = 1 - v * 2;
    unproject(nearPoint, ndcX, ndcY, -1, inverse);
    unproject(farPoint, ndcX, ndcY, 1, inverse);
    vec3.copy(out.origin, nearPoint);
    vec3.subtract(out.direction, farPoint, nearPoint);
    vec3.normalize(out.direction, out.direction);
    return out;
}
function intersectLocalRay(entity: Entity): number | null {
    if (entity.terrain) {
        return entity.terrain.raycast(localRay.origin, localRay.direction, terrainHit) ? terrainHit.distance : null;
    }
    return entity.mesh ? intersectRayAabb(localRay, getLocalBounds(entity.mesh)) : null;
}
function intersectMarker(entity: Entity, camera: PerspectiveCamera): number | null {
    const m = entity.worldMatrix;
    vec3.set(toLight, m[12] - worldRay.origin[0], m[13] - worldRay.origin[1], m[14] - worldRay.origin[2]);
    const along = vec3.dot(toLight, worldRay.direction);
    if (along <= 0)
        return null;
    const radius = along * Math.tan(degToRad(camera.fovDegrees) * 0.5) * 2 * LIGHT_PICK_FRACTION;
    const perpendicular2 = vec3.dot(toLight, toLight) - along * along;
    return perpendicular2 <= radius * radius ? along : null;
}
function intersectSurface(entity: Entity, camera: PerspectiveCamera): number | null {
    const settings = entity.guiSurface;
    if (!settings)
        return null;
    computeLocalRect(surfaceRect, settings.mount, entity.mesh ? getLocalBounds(entity.mesh) : null);
    resolveSurfaceFrame(surfaceFrame, surfaceRect, settings.mount, entity.worldMatrix, camera);
    if (settings.cullDistance > 0 && surfaceFrame.distance > settings.cullDistance)
        return null;
    const hit = intersectSurfaceFrame(surfaceFrame, worldRay);
    if (!hit || (!hit.front && !settings.doubleSided))
        return null;
    return hit.distance;
}
interface PickHit {
    entity: Entity;
    distance: number;
}
export interface PickOptions {
    showCsgBrushes?: boolean;
    includeLocked?: boolean;
    lightHelpers?: LightHelperMode;
    soundHelpers?: SoundHelperMode;
    vfxHelpers?: VfxHelperMode;
    selection?: ReadonlySet<number> | null;
}
function isMarkerPickable(entity: Entity, mode: LightHelperMode | SoundHelperMode | VfxHelperMode | undefined, options: PickOptions): boolean {
    switch (mode ?? 'off') {
        case 'all':
            return true;
        case 'selected':
            return options.selection?.has(entity.id) ?? false;
        default:
            return false;
    }
}
function isSoundMarker(entity: Entity): boolean {
    return entity.kind === 'sound' && !entity.mesh && !entity.terrain;
}
function isVfxMarker(entity: Entity): boolean {
    return entity.kind === 'vfx' && !entity.mesh && !entity.terrain;
}
function isPickable(entity: Entity, options: PickOptions): boolean {
    if (entity.locked && !options.includeLocked)
        return false;
    if (entity.light)
        return isMarkerPickable(entity, options.lightHelpers, options);
    if (isSoundMarker(entity))
        return isMarkerPickable(entity, options.soundHelpers, options);
    if (isVfxMarker(entity))
        return isMarkerPickable(entity, options.vfxHelpers, options);
    if (entity.guiSurface)
        return true;
    if (!entity.mesh && !entity.terrain)
        return false;
    if (entity.csgBrush && (options.showCsgBrushes === false || !(entity.parent?.csg?.showBrushes ?? true)))
        return false;
    return true;
}
function closestHit(scene: Scene, camera: PerspectiveCamera, u: number, v: number, options: PickOptions): PickHit | null {
    if (!buildPickRay(worldRay, camera, u, v))
        return null;
    candidates.length = 0;
    scene.traverseVisible((entity) => {
        if (!isPickable(entity, options))
            return;
        if (entity.light || isSoundMarker(entity) || isVfxMarker(entity)) {
            const entry = intersectMarker(entity, camera);
            if (entry !== null)
                candidates.push({ entity, entry, exact: true });
            return;
        }
        if (entity.guiSurface) {
            const entry = intersectSurface(entity, camera);
            if (entry !== null)
                candidates.push({ entity, entry, exact: true });
            if (!entity.mesh && !entity.terrain)
                return;
        }
        if (!mat4.invert(inverseWorld, entity.worldMatrix))
            return;
        transformRay(localRay, worldRay, inverseWorld);
        const entry = intersectLocalRay(entity);
        if (entry === null)
            return;
        candidates.push({ entity, entry, exact: entity.terrain !== null || entity.skin !== null });
    });
    if (candidates.length === 0)
        return null;
    candidates.sort((a, b) => a.entry - b.entry);
    let closest: PickHit | null = null;
    for (const candidate of candidates) {
        if (closest && candidate.entry >= closest.distance)
            break;
        const { entity } = candidate;
        let distance: number | null = candidate.entry;
        if (!candidate.exact && entity.mesh) {
            mat4.invert(inverseWorld, entity.worldMatrix);
            transformRay(localRay, worldRay, inverseWorld);
            distance = raycastMesh(localRay, entity.mesh, closest?.distance ?? Infinity);
        }
        if (distance !== null && (!closest || distance < closest.distance))
            closest = { entity, distance };
    }
    candidates.length = 0;
    return closest;
}
export function pickEntity(scene: Scene, camera: PerspectiveCamera, u: number, v: number, options: PickOptions = {}): Entity | null {
    return closestHit(scene, camera, u, v, options)?.entity ?? null;
}
export function pickSurfacePoint(out: vec3.Vec3, scene: Scene, camera: PerspectiveCamera, u: number, v: number): vec3.Vec3 | null {
    const hit = closestHit(scene, camera, u, v, { includeLocked: true });
    if (hit)
        return vec3.scaleAndAdd(out, worldRay.origin, worldRay.direction, hit.distance);
    if (!buildPickRay(worldRay, camera, u, v))
        return null;
    const planeHeight = camera.target[1];
    if (Math.abs(worldRay.direction[1]) < 1e-6)
        return null;
    const distance = (planeHeight - worldRay.origin[1]) / worldRay.direction[1];
    if (distance <= 0)
        return null;
    return vec3.scaleAndAdd(out, worldRay.origin, worldRay.direction, distance);
}
