import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
import type { PostProcessSettings } from '@/engine/core/environment/post-process-settings';
import type { CameraProjection, CameraTextureContent } from '@/engine/camera/camera-settings';
import { ALL_RENDER_LAYERS } from '@/engine/camera/layers/render-layers';
const MIN_FOCUS_DISTANCE = 1e-3;
export type CameraBackdrop = 'scene' | 'color' | 'transparent';
export class PerspectiveCamera {
    readonly position = vec3.create(0, 0, 5);
    readonly target = vec3.create(0, 0, 0);
    readonly up = vec3.create(0, 1, 0);
    fovDegrees = 60;
    near = 0.05;
    far = 500;
    aspect = 1;
    exposure = 1;
    projection: CameraProjection = 'perspective';
    orthographicSize = 5;
    layerMask = ALL_RENDER_LAYERS;
    backdrop: CameraBackdrop = 'scene';
    readonly backdropColor = vec3.create();
    content: CameraTextureContent = 'color';
    postProcessing: PostProcessSettings | null = null;
    readonly viewMatrix = mat4.create();
    readonly projectionMatrix = mat4.create();
    readonly viewProjectionMatrix = mat4.create();
    readonly inverseViewProjectionMatrix = mat4.create();
    invertible = true;
    get orthographic(): boolean {
        return this.projection === 'orthographic';
    }
    get tanHalfFov(): number {
        if (!this.orthographic)
            return Math.tan(degToRad(this.fovDegrees) * 0.5);
        return this.orthographicSize / Math.max(vec3.distance(this.position, this.target), MIN_FOCUS_DISTANCE);
    }
    halfHeightAt(distance: number): number {
        return this.orthographic ? this.orthographicSize : distance * Math.tan(degToRad(this.fovDegrees) * 0.5);
    }
    updateMatrices(): void {
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
        if (this.orthographic) {
            const halfHeight = this.orthographicSize;
            const halfWidth = halfHeight * this.aspect;
            mat4.ortho(this.projectionMatrix, -halfWidth, halfWidth, -halfHeight, halfHeight, this.near, this.far);
        }
        else {
            mat4.perspective(this.projectionMatrix, degToRad(this.fovDegrees), this.aspect, this.near, this.far);
        }
        mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
        this.invertible = mat4.invert(this.inverseViewProjectionMatrix, this.viewProjectionMatrix) !== null;
    }
}
