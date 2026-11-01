import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Aabb } from '@/engine/core/math/aabb';
import type { Ray } from '@/engine/core/math/ray';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { SURFACE_MAX_TEXTURE_SIDE, SURFACE_MIN_TEXTURE_SIDE, type GuiSurfaceFace, type GuiSurfaceMount } from './gui-surface-settings';
export interface GuiSurfaceLocalRect {
    readonly center: Vec3;
    readonly right: Vec3;
    readonly up: Vec3;
    readonly normal: Vec3;
    width: number;
    height: number;
}
export interface GuiSurfaceFrame {
    readonly center: Vec3;
    readonly right: Vec3;
    readonly up: Vec3;
    readonly normal: Vec3;
    width: number;
    height: number;
    distance: number;
}
export interface GuiSurfaceRayHit {
    readonly distance: number;
    readonly u: number;
    readonly v: number;
    readonly front: boolean;
}
const CONSTANT_SIZE_REFERENCE_DISTANCE = 10;
const WORLD_UP = vec3.create(0, 1, 0);
const UNIT_HALF = 0.5;
const scratchA = vec3.create();
const scratchB = vec3.create();
const scratchC = vec3.create();
const rotation = mat4.create();
export function createLocalRect(): GuiSurfaceLocalRect {
    return { center: vec3.create(), right: vec3.create(1, 0, 0), up: vec3.create(0, 1, 0), normal: vec3.create(0, 0, 1), width: 1, height: 1 };
}
export function createSurfaceFrame(): GuiSurfaceFrame {
    return { center: vec3.create(), right: vec3.create(1, 0, 0), up: vec3.create(0, 1, 0), normal: vec3.create(0, 0, 1), width: 1, height: 1, distance: 0 };
}
const FACE_AXES: Record<GuiSurfaceFace, {
    readonly right: readonly [
        number,
        number,
        number
    ];
    readonly up: readonly [
        number,
        number,
        number
    ];
    readonly normal: readonly [
        number,
        number,
        number
    ];
}> = {
    front: { right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] },
    back: { right: [-1, 0, 0], up: [0, 1, 0], normal: [0, 0, -1] },
    right: { right: [0, 0, -1], up: [0, 1, 0], normal: [1, 0, 0] },
    left: { right: [0, 0, 1], up: [0, 1, 0], normal: [-1, 0, 0] },
    top: { right: [1, 0, 0], up: [0, 0, -1], normal: [0, 1, 0] },
    bottom: { right: [1, 0, 0], up: [0, 0, 1], normal: [0, -1, 0] },
};
function boxExtent(bounds: Aabb | null, axis: number): {
    min: number;
    max: number;
} {
    if (!bounds)
        return { min: -UNIT_HALF, max: UNIT_HALF };
    return { min: bounds.min[axis], max: bounds.max[axis] };
}
function axisExtent(bounds: Aabb | null, direction: readonly [
    number,
    number,
    number
]): number {
    for (let axis = 0; axis < 3; axis++) {
        if (direction[axis] !== 0) {
            const { min, max } = boxExtent(bounds, axis);
            return max - min;
        }
    }
    return 1;
}
export function computeLocalRect(out: GuiSurfaceLocalRect, mount: GuiSurfaceMount, bounds: Aabb | null): GuiSurfaceLocalRect {
    switch (mount.kind) {
        case 'face': {
            const axes = FACE_AXES[mount.face];
            vec3.set(out.right, axes.right[0], axes.right[1], axes.right[2]);
            vec3.set(out.up, axes.up[0], axes.up[1], axes.up[2]);
            vec3.set(out.normal, axes.normal[0], axes.normal[1], axes.normal[2]);
            for (let axis = 0; axis < 3; axis++) {
                const { min, max } = boxExtent(bounds, axis);
                const n = axes.normal[axis];
                out.center[axis] = n > 0 ? max + mount.offset : n < 0 ? min - mount.offset : (min + max) * 0.5;
            }
            const scale = Math.max(0, 1 - 2 * mount.inset);
            out.width = axisExtent(bounds, axes.right) * scale;
            out.height = axisExtent(bounds, axes.up) * scale;
            return out;
        }
        case 'panel': {
            mat4.fromRotationDegrees(rotation, mount.rotation);
            vec3.copy(out.center, mount.position);
            mat4.transformDirection(out.right, rotation, vec3.set(scratchA, 1, 0, 0));
            mat4.transformDirection(out.up, rotation, vec3.set(scratchA, 0, 1, 0));
            mat4.transformDirection(out.normal, rotation, vec3.set(scratchA, 0, 0, 1));
            out.width = mount.width;
            out.height = mount.height;
            return out;
        }
        case 'billboard':
            vec3.copy(out.center, mount.offset);
            vec3.set(out.right, 1, 0, 0);
            vec3.set(out.up, 0, 1, 0);
            vec3.set(out.normal, 0, 0, 1);
            out.width = mount.width;
            out.height = mount.height;
            return out;
    }
}
function aimBillboard(out: GuiSurfaceFrame, camera: PerspectiveCamera, lockY: boolean): void {
    if (lockY) {
        vec3.subtract(out.normal, camera.position, out.center);
        out.normal[1] = 0;
        if (vec3.length(out.normal) < 1e-6)
            vec3.set(out.normal, 0, 0, 1);
        vec3.normalize(out.normal, out.normal);
        vec3.cross(out.right, WORLD_UP, out.normal);
        vec3.normalize(out.right, out.right);
        vec3.copy(out.up, WORLD_UP);
        return;
    }
    const view = camera.viewMatrix;
    vec3.set(out.right, view[0], view[4], view[8]);
    vec3.set(out.up, view[1], view[5], view[9]);
    vec3.set(out.normal, view[2], view[6], view[10]);
}
export function resolveSurfaceFrame(out: GuiSurfaceFrame, local: GuiSurfaceLocalRect, mount: GuiSurfaceMount, worldMatrix: Mat4, camera: PerspectiveCamera): GuiSurfaceFrame {
    mat4.transformPoint(out.center, worldMatrix, local.center);
    out.distance = vec3.distance(camera.position, out.center);
    if (mount.kind === 'billboard') {
        aimBillboard(out, camera, mount.lockY);
        const scale = mount.constantSize ? out.distance / CONSTANT_SIZE_REFERENCE_DISTANCE : 1;
        out.width = local.width * scale;
        out.height = local.height * scale;
        return out;
    }
    mat4.transformDirection(scratchA, worldMatrix, local.right);
    mat4.transformDirection(scratchB, worldMatrix, local.up);
    out.width = local.width * vec3.length(scratchA);
    out.height = local.height * vec3.length(scratchB);
    vec3.normalize(out.right, scratchA);
    vec3.normalize(out.up, scratchB);
    vec3.cross(out.normal, out.right, out.up);
    vec3.normalize(out.normal, out.normal);
    return out;
}
export function surfaceModelMatrix(out: Mat4, frame: GuiSurfaceFrame): Mat4 {
    const { right, up, normal, center, width, height } = frame;
    out[0] = right[0] * width;
    out[1] = right[1] * width;
    out[2] = right[2] * width;
    out[3] = 0;
    out[4] = up[0] * height;
    out[5] = up[1] * height;
    out[6] = up[2] * height;
    out[7] = 0;
    out[8] = normal[0];
    out[9] = normal[1];
    out[10] = normal[2];
    out[11] = 0;
    out[12] = center[0];
    out[13] = center[1];
    out[14] = center[2];
    out[15] = 1;
    return out;
}
export function intersectSurfaceFrame(frame: GuiSurfaceFrame, ray: Ray): GuiSurfaceRayHit | null {
    const denominator = vec3.dot(ray.direction, frame.normal);
    if (Math.abs(denominator) < 1e-8)
        return null;
    vec3.subtract(scratchA, frame.center, ray.origin);
    const distance = vec3.dot(scratchA, frame.normal) / denominator;
    if (distance <= 0)
        return null;
    vec3.scaleAndAdd(scratchB, ray.origin, ray.direction, distance);
    vec3.subtract(scratchB, scratchB, frame.center);
    const u = vec3.dot(scratchB, frame.right) / frame.width + 0.5;
    const v = 0.5 - vec3.dot(scratchB, frame.up) / frame.height;
    if (u < 0 || u > 1 || v < 0 || v > 1)
        return null;
    return { distance, u, v, front: denominator < 0 };
}
export function nearestBoundsFace(localPoint: Vec3, bounds: Aabb | null): GuiSurfaceFace {
    let best: GuiSurfaceFace = 'front';
    let bestDistance = Infinity;
    for (const face of Object.keys(FACE_AXES) as GuiSurfaceFace[]) {
        const { normal } = FACE_AXES[face];
        for (let axis = 0; axis < 3; axis++) {
            if (normal[axis] === 0)
                continue;
            const { min, max } = boxExtent(bounds, axis);
            const extent = Math.max(max - min, 1e-6);
            const distance = Math.abs(localPoint[axis] - (normal[axis] > 0 ? max : min)) / extent;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = face;
            }
        }
    }
    return best;
}
export function faceTowardCamera(worldMatrix: Mat4, bounds: Aabb | null, camera: PerspectiveCamera): GuiSurfaceFace {
    const center = vec3.set(scratchB, 0, 0, 0);
    if (bounds) {
        vec3.set(center, (bounds.min[0] + bounds.max[0]) * 0.5, (bounds.min[1] + bounds.max[1]) * 0.5, (bounds.min[2] + bounds.max[2]) * 0.5);
    }
    mat4.transformPoint(center, worldMatrix, center);
    const toCamera = vec3.subtract(scratchC, camera.position, center);
    vec3.normalize(toCamera, toCamera);
    let best: GuiSurfaceFace = 'front';
    let bestDot = -Infinity;
    for (const face of Object.keys(FACE_AXES) as GuiSurfaceFace[]) {
        const { normal } = FACE_AXES[face];
        mat4.transformDirection(scratchA, worldMatrix, vec3.set(scratchA, normal[0], normal[1], normal[2]));
        vec3.normalize(scratchA, scratchA);
        const alignment = vec3.dot(scratchA, toCamera);
        if (alignment > bestDot) {
            bestDot = alignment;
            best = face;
        }
    }
    return best;
}
export function surfaceTextureSize(width: number, height: number, pixelsPerMeter: number): {
    width: number;
    height: number;
} {
    const longest = Math.max(width, height, 1e-6);
    const scale = Math.min(pixelsPerMeter, SURFACE_MAX_TEXTURE_SIDE / longest);
    return {
        width: Math.max(SURFACE_MIN_TEXTURE_SIDE, Math.round(width * scale)),
        height: Math.max(SURFACE_MIN_TEXTURE_SIDE, Math.round(height * scale)),
    };
}
