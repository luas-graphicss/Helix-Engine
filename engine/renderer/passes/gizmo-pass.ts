import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { GpuMesh } from '@/engine/renderer/gl/gpu-mesh';
import { GIZMO_VERTEX_SHADER, GIZMO_FRAGMENT_SHADER } from '@/engine/renderer/shaders/gizmo.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createGizmoMeshes } from '@/engine/renderer/geometry/gizmo-geometry';
import type { GizmoDrawList, GizmoShape } from '@/engine/renderer/gizmo/gizmo-draw-list';
export type GizmoRenderRequest = GizmoDrawList;
export class GizmoPass {
    private readonly program: ShaderProgram;
    private readonly meshes: Record<GizmoShape, GpuMesh>;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, GIZMO_VERTEX_SHADER, GIZMO_FRAGMENT_SHADER);
        const data = createGizmoMeshes();
        this.meshes = {
            shaft: new GpuMesh(gl, data.shaft),
            cone: new GpuMesh(gl, data.cone),
            cube: new GpuMesh(gl, data.cube),
            quad: new GpuMesh(gl, data.quad),
            ring: new GpuMesh(gl, data.ring),
            arc: new GpuMesh(gl, data.arc),
            disc: new GpuMesh(gl, data.disc),
        };
    }
    render(request: GizmoRenderRequest, camera: PerspectiveCamera): number {
        if (request.count === 0)
            return 0;
        const { gl, program } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
        gl.uniform3fv(program.uniform('u_origin'), request.origin);
        const modelLocation = program.uniform('u_model');
        const colorLocation = program.uniform('u_color');
        const alphaLocation = program.uniform('u_alpha');
        const dimBackLocation = program.uniform('u_dimBack');
        const sweepLocation = program.uniform('u_sweep');
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        for (let index = 0; index < request.count; index++) {
            const item = request.at(index);
            gl.uniformMatrix4fv(modelLocation, false, item.model);
            gl.uniform3fv(colorLocation, item.color);
            gl.uniform1f(alphaLocation, item.alpha);
            gl.uniform1f(dimBackLocation, item.dimBack ? 1 : 0);
            gl.uniform1f(sweepLocation, item.sweep);
            this.meshes[item.shape].draw();
        }
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        return request.count;
    }
    dispose(): void {
        for (const mesh of Object.values(this.meshes))
            mesh.dispose();
        this.program.dispose();
    }
}
