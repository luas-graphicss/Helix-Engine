import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { GpuMesh } from '@/engine/renderer/gl/gpu-mesh';
import { GIZMO_VERTEX_SHADER, GIZMO_FRAGMENT_SHADER } from '@/engine/renderer/shaders/gizmo.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createGizmoGeometry } from '@/engine/renderer/geometry/gizmo-geometry';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { computeGizmoFrame, createGizmoFrame, type GizmoHandle, type GizmoMode, } from '@/engine/renderer/gizmo/gizmo-frame';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
export interface GizmoRenderRequest {
    mode: GizmoMode;
    worldMatrix: Mat4;
    localAxes: boolean;
    hovered: GizmoHandle | null;
    active: GizmoHandle | null;
}
type Rgb = readonly [
    number,
    number,
    number
];
const AXIS_COLOR: Record<'x' | 'y' | 'z', Rgb> = {
    x: [0.9, 0.31, 0.28],
    y: [0.47, 0.8, 0.3],
    z: [0.32, 0.56, 0.95],
};
const UNIFORM_COLOR: Rgb = [0.86, 0.87, 0.9];
const HIGHLIGHT_COLOR: Rgb = [1, 0.84, 0.25];
const PLANE_ALPHA = 0.5;
const INACTIVE_ALPHA = 0.22;
const HANDLES: Record<GizmoMode, readonly GizmoHandle[]> = {
    translate: ['x', 'y', 'z', 'xy', 'yz', 'xz'],
    rotate: ['x', 'y', 'z'],
    scale: ['x', 'y', 'z', 'uniform'],
};
const BASIS_X = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const BASIS_Y = new Float32Array([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
const BASIS_Z = new Float32Array([0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
const HANDLE_BASIS: Record<GizmoHandle, Mat4> = { x: BASIS_X, y: BASIS_Y, z: BASIS_Z, xy: BASIS_X, yz: BASIS_Y, xz: BASIS_Z, uniform: BASIS_X };
function colorOf(handle: GizmoHandle): Rgb {
    if (handle === 'uniform')
        return UNIFORM_COLOR;
    if (handle.length === 1)
        return AXIS_COLOR[handle as 'x' | 'y' | 'z'];
    const normal = ('xyz'.replace(handle[0], '').replace(handle[1], '')) as 'x' | 'y' | 'z';
    return AXIS_COLOR[normal];
}
export class GizmoPass {
    private readonly program: ShaderProgram;
    private readonly meshes: Record<'arrow' | 'scaleHandle' | 'plane' | 'ring' | 'center', GpuMesh>;
    private readonly frame = createGizmoFrame();
    private readonly model = mat4.create();
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, GIZMO_VERTEX_SHADER, GIZMO_FRAGMENT_SHADER);
        const geometry = createGizmoGeometry();
        const upload = (data: MeshData) => new GpuMesh(gl, data);
        this.meshes = {
            arrow: upload(geometry.arrow),
            scaleHandle: upload(geometry.scaleHandle),
            plane: upload(geometry.plane),
            ring: upload(geometry.ring),
            center: upload(geometry.center),
        };
    }
    render(request: GizmoRenderRequest, camera: PerspectiveCamera): number {
        if (!computeGizmoFrame(this.frame, request.worldMatrix, camera, request.localAxes))
            return 0;
        const { gl, program, frame } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
        gl.uniform3fv(program.uniform('u_origin'), frame.origin);
        const modelLocation = program.uniform('u_model');
        const colorLocation = program.uniform('u_color');
        const alphaLocation = program.uniform('u_alpha');
        const dimBackLocation = program.uniform('u_dimBack');
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        let drawCalls = 0;
        for (const handle of HANDLES[request.mode]) {
            const emphasized = handle === request.active || (request.active === null && handle === request.hovered);
            const color = emphasized ? HIGHLIGHT_COLOR : colorOf(handle);
            let alpha = handle.length === 2 ? PLANE_ALPHA : 1;
            if (request.active !== null && handle !== request.active)
                alpha = INACTIVE_ALPHA;
            if (emphasized)
                alpha = 1;
            mat4.multiply(this.model, frame.model, HANDLE_BASIS[handle]);
            gl.uniformMatrix4fv(modelLocation, false, this.model);
            gl.uniform3f(colorLocation, color[0], color[1], color[2]);
            gl.uniform1f(alphaLocation, alpha);
            gl.uniform1f(dimBackLocation, request.mode === 'rotate' ? 1 : 0);
            this.meshFor(request.mode, handle).draw();
            drawCalls++;
        }
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        return drawCalls;
    }
    private meshFor(mode: GizmoMode, handle: GizmoHandle): GpuMesh {
        if (handle === 'uniform')
            return this.meshes.center;
        if (handle.length === 2)
            return this.meshes.plane;
        if (mode === 'rotate')
            return this.meshes.ring;
        return mode === 'scale' ? this.meshes.scaleHandle : this.meshes.arrow;
    }
    dispose(): void {
        for (const mesh of Object.values(this.meshes))
            mesh.dispose();
        this.program.dispose();
    }
}
