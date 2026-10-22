import type { Aabb } from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
export const MAX_SHADOW_CASCADES = 4;
const WORLD_UP = vec3.create(0, 1, 0);
const WORLD_FORWARD = vec3.create(0, 0, 1);
const SPLIT_LAMBDA = 0.8;
const RADIUS_PADDING = 1.04;
const MIN_SPLIT_NEAR = 0.3;
const MIN_SHADOW_FAR = 4;
const DEPTH_PADDING = 1;
const DEPTH_SLACK_FRACTION = 0.25;
const CLIP_TO_TEXTURE = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);
function boxCorner(out: Vec3, box: Aabb, index: number): Vec3 {
    out[0] = index & 1 ? box.max[0] : box.min[0];
    out[1] = index & 2 ? box.max[1] : box.min[1];
    out[2] = index & 4 ? box.max[2] : box.min[2];
    return out;
}
export class ShadowCascades {
    readonly viewProjection: Mat4[] = [];
    readonly shadowMatrices: Float32Array;
    readonly texelWorldSizes: Float32Array;
    readonly centers: Vec3[] = [];
    readonly radii: Float32Array;
    readonly desiredCenters: Vec3[] = [];
    readonly desiredRadii: Float32Array;
    readonly splits: Float64Array;
    private readonly cameraWorld = mat4.create();
    private readonly lightViews: Mat4[] = [];
    private readonly depthRanges: Float64Array;
    private readonly lightProjection = mat4.create();
    private readonly shadowMatrix = mat4.create();
    private readonly forward = vec3.create();
    private readonly eye = vec3.create();
    private readonly corner = vec3.create();
    private readonly lightSpaceCorner = vec3.create();
    constructor(readonly count: number, private readonly mapSize: number) {
        this.shadowMatrices = new Float32Array(count * 16);
        this.texelWorldSizes = new Float32Array(count);
        this.radii = new Float32Array(count);
        this.desiredRadii = new Float32Array(count);
        this.depthRanges = new Float64Array(count * 2);
        this.splits = new Float64Array(count + 1);
        for (let i = 0; i < count; i++) {
            this.viewProjection.push(mat4.create());
            this.lightViews.push(mat4.create());
            this.centers.push(vec3.create());
            this.desiredCenters.push(vec3.create());
        }
    }
    prepare(camera: PerspectiveCamera, casterBounds: Aabb, maxDistance: number): void {
        const shadowFar = this.computeShadowFar(camera, casterBounds, maxDistance);
        this.computeSplits(Math.min(Math.max(camera.near, MIN_SPLIT_NEAR), shadowFar * 0.5), shadowFar);
        mat4.invert(this.cameraWorld, camera.viewMatrix);
        vec3.set(this.forward, -this.cameraWorld[8], -this.cameraWorld[9], -this.cameraWorld[10]);
        vec3.normalize(this.forward, this.forward);
        const cornerSlope = Math.tan(degToRad(camera.fovDegrees) * 0.5) * Math.sqrt(1 + camera.aspect * camera.aspect);
        for (let i = 0; i < this.count; i++) {
            const near = this.splits[i];
            const far = this.splits[i + 1];
            const nearRadius = near * cornerSlope;
            const farRadius = far * cornerSlope;
            let centerDistance = (far * far + farRadius * farRadius - near * near - nearRadius * nearRadius) / (2 * (far - near));
            centerDistance = Math.min(Math.max(centerDistance, near), far);
            const radius = Math.max(Math.hypot(far - centerDistance, farRadius), Math.hypot(centerDistance - near, nearRadius)) * RADIUS_PADDING;
            vec3.scaleAndAdd(this.desiredCenters[i], camera.position, this.forward, centerDistance);
            this.desiredRadii[i] = radius;
        }
    }
    commit(index: number, lightDirection: Vec3, casterBounds: Aabb, radiusPadding: number): void {
        vec3.copy(this.centers[index], this.desiredCenters[index]);
        this.radii[index] = this.desiredRadii[index] * radiusPadding;
        this.fitCascade(index, lightDirection, casterBounds);
    }
    desiredFitsCommitted(index: number, marginTexels: number): boolean {
        const drift = vec3.distance(this.desiredCenters[index], this.centers[index]);
        return drift + this.desiredRadii[index] + marginTexels * this.texelWorldSizes[index] <= this.radii[index];
    }
    drift(index: number): number {
        return vec3.distance(this.desiredCenters[index], this.centers[index]);
    }
    depthRangeCovers(index: number, casterBounds: Aabb): boolean {
        const lightView = this.lightViews[index];
        const nearDepth = this.depthRanges[index * 2];
        const farDepth = this.depthRanges[index * 2 + 1];
        for (let i = 0; i < 8; i++) {
            boxCorner(this.corner, casterBounds, i);
            mat4.transformPoint(this.lightSpaceCorner, lightView, this.corner);
            const depth = -this.lightSpaceCorner[2];
            if (depth < nearDepth || depth > farDepth)
                return false;
        }
        return true;
    }
    private computeShadowFar(camera: PerspectiveCamera, casterBounds: Aabb, maxDistance: number): number {
        let farthest = 0;
        for (let i = 0; i < 8; i++) {
            boxCorner(this.corner, casterBounds, i);
            farthest = Math.max(farthest, vec3.distance(camera.position, this.corner));
        }
        return Math.max(Math.min(camera.far, maxDistance, farthest), MIN_SHADOW_FAR);
    }
    private computeSplits(near: number, far: number): void {
        const { splits, count } = this;
        splits[0] = near;
        splits[count] = far;
        for (let i = 1; i < count; i++) {
            const t = i / count;
            const logarithmic = near * Math.pow(far / near, t);
            const uniform = near + (far - near) * t;
            splits[i] = SPLIT_LAMBDA * logarithmic + (1 - SPLIT_LAMBDA) * uniform;
        }
    }
    private fitCascade(index: number, lightDirection: Vec3, casterBounds: Aabb): void {
        const center = this.centers[index];
        const radius = this.radii[index];
        this.texelWorldSizes[index] = (radius * 2) / this.mapSize;
        const up = Math.abs(lightDirection[1]) > 0.99 ? WORLD_FORWARD : WORLD_UP;
        vec3.scaleAndAdd(this.eye, center, lightDirection, radius);
        const lightView = this.lightViews[index];
        mat4.lookAt(lightView, this.eye, center, up);
        let nearDepth = 0;
        let farDepth = radius * 2;
        for (let i = 0; i < 8; i++) {
            boxCorner(this.corner, casterBounds, i);
            mat4.transformPoint(this.lightSpaceCorner, lightView, this.corner);
            const depth = -this.lightSpaceCorner[2];
            nearDepth = Math.min(nearDepth, depth);
            farDepth = Math.max(farDepth, depth);
        }
        const slack = DEPTH_PADDING + (farDepth - nearDepth) * DEPTH_SLACK_FRACTION;
        nearDepth -= slack;
        farDepth += slack;
        this.depthRanges[index * 2] = nearDepth;
        this.depthRanges[index * 2 + 1] = farDepth;
        mat4.ortho(this.lightProjection, -radius, radius, -radius, radius, nearDepth, farDepth);
        const viewProjection = this.viewProjection[index];
        mat4.multiply(viewProjection, this.lightProjection, lightView);
        this.snapToTexelGrid(viewProjection);
        mat4.multiply(this.shadowMatrix, CLIP_TO_TEXTURE, viewProjection);
        this.shadowMatrices.set(this.shadowMatrix, index * 16);
    }
    private snapToTexelGrid(viewProjection: Mat4): void {
        const halfSize = this.mapSize / 2;
        const texelX = viewProjection[12] * halfSize;
        const texelY = viewProjection[13] * halfSize;
        viewProjection[12] += (Math.round(texelX) - texelX) / halfSize;
        viewProjection[13] += (Math.round(texelY) - texelY) / halfSize;
    }
}
