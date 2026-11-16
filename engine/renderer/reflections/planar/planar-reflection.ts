import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VisibleSet } from '@/engine/renderer/culling/visible-set';
import type { ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { GL } from '@/engine/renderer/gl/context';
import { SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import { MirrorCamera } from './mirror-camera';
import { MirrorSelector } from './mirror-selector';
type HdrColor = readonly [
    number,
    number,
    number
];
export class PlanarReflection {
    readonly camera = new MirrorCamera(true);
    readonly backdropCamera = new MirrorCamera(false);
    readonly target: SceneRenderTarget;
    readonly viewPlane = new Float32Array(4);
    rendered = false;
    private readonly selector = new MirrorSelector();
    private readonly viewNormal = vec3.create();
    private readonly viewPoint = vec3.create();
    constructor(private readonly gl: GL, format: ColorFormat) {
        this.target = new SceneRenderTarget(gl, format);
    }
    get color(): WebGLTexture {
        return this.target.color;
    }
    beginFrame(): void {
        this.rendered = false;
    }
    aim(visible: VisibleSet, camera: PerspectiveCamera): boolean {
        const { selector, viewNormal, viewPoint, viewPlane } = this;
        if (!selector.select(visible.meshes, camera))
            return false;
        const { plane } = selector;
        this.camera.reflect(camera, plane);
        this.backdropCamera.reflect(camera, plane);
        if (!this.camera.invertible || !this.backdropCamera.invertible)
            return false;
        mat4.transformDirection(viewNormal, camera.viewMatrix, plane.normal);
        vec3.scale(viewPoint, plane.normal, plane.offset);
        mat4.transformPoint(viewPoint, camera.viewMatrix, viewPoint);
        viewPlane[0] = viewNormal[0];
        viewPlane[1] = viewNormal[1];
        viewPlane[2] = viewNormal[2];
        viewPlane[3] = -vec3.dot(viewNormal, viewPoint);
        return true;
    }
    beginView(width: number, height: number, clearColor: HdrColor, encodedRange: number, clearsColor: boolean): MirrorCamera {
        const { target } = this;
        target.resize(width, height);
        target.bind();
        target.clear(clearColor, encodedRange, clearsColor);
        return this.camera;
    }
    bindView(): void {
        this.target.bind();
    }
    endView(): void {
        const { gl } = this;
        this.rendered = true;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dispose(): void {
        this.target.dispose();
    }
}
