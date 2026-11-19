import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { degToRad } from '@/engine/core/math/scalar';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { reflectDirection, reflectPoint, type MirrorPlane } from './mirror-plane';
const CLIP_BIAS = 0.02;
export class MirrorCamera extends PerspectiveCamera {
    private readonly clipNormal = vec3.create();
    private readonly clipPoint = vec3.create();
    private plane: MirrorPlane | null = null;
    constructor(private readonly clipsBehind: boolean) {
        super();
    }
    reflect(source: PerspectiveCamera, plane: MirrorPlane): void {
        reflectPoint(this.position, plane, source.position);
        reflectPoint(this.target, plane, source.target);
        reflectDirection(this.up, plane, source.up);
        this.fovDegrees = source.fovDegrees;
        this.aspect = source.aspect;
        this.near = source.near;
        this.far = source.far;
        this.exposure = source.exposure;
        this.plane = plane;
        this.updateMatrices();
    }
    override updateMatrices(): void {
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
        mat4.perspective(this.projectionMatrix, degToRad(this.fovDegrees), this.aspect, this.near, this.far);
        const clipped = this.plane === null || !this.clipsBehind || this.clipBehind(this.plane);
        mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
        this.invertible = mat4.invert(this.inverseViewProjectionMatrix, this.viewProjectionMatrix) !== null && clipped;
    }
    private clipBehind(plane: MirrorPlane): boolean {
        const { projectionMatrix: m, clipNormal, clipPoint } = this;
        mat4.transformDirection(clipNormal, this.viewMatrix, plane.normal);
        vec3.scale(clipPoint, plane.normal, plane.offset + CLIP_BIAS);
        mat4.transformPoint(clipPoint, this.viewMatrix, clipPoint);
        const cx = clipNormal[0];
        const cy = clipNormal[1];
        const cz = clipNormal[2];
        const cw = -vec3.dot(clipNormal, clipPoint);
        const cornerX = (Math.sign(cx) + m[8]) / m[0];
        const cornerY = (Math.sign(cy) + m[9]) / m[5];
        const cornerW = (1 + m[10]) / m[14];
        const reach = cx * cornerX + cy * cornerY - cz + cw * cornerW;
        if (cw >= 0 || reach <= 0)
            return false;
        const scale = 2 / reach;
        m[2] = cx * scale;
        m[6] = cy * scale;
        m[10] = cz * scale + 1;
        m[14] = cw * scale;
        return true;
    }
}
