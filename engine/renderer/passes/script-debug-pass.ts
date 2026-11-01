import type { GL } from '@/engine/renderer/gl/context';
import { LineBatch } from '@/engine/renderer/gl/line-batch';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { LINE_HELPER_FRAGMENT_SHADER, LINE_HELPER_VERTEX_SHADER } from '@/engine/renderer/shaders/line-helper.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { ScriptDebugLine } from '@/engine/renderer/script-hooks';
const OCCLUDED_ALPHA = 0.22;
export class ScriptDebugPass {
    private readonly program: ShaderProgram;
    private readonly lines: LineBatch;
    constructor(private readonly gl: GL) {
        this.program = new ShaderProgram(gl, LINE_HELPER_VERTEX_SHADER, LINE_HELPER_FRAGMENT_SHADER);
        this.lines = new LineBatch(gl);
    }
    render(segments: readonly ScriptDebugLine[], camera: PerspectiveCamera): number {
        if (segments.length === 0 || !this.program.ready)
            return 0;
        const { lines } = this;
        lines.begin();
        for (const segment of segments)
            lines.segment(segment.a, segment.b, segment.color, segment.alpha);
        if (lines.vertexCount === 0)
            return 0;
        lines.upload();
        const { gl, program } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(program.uniform('u_alphaScale'), 1);
        lines.draw();
        gl.depthFunc(gl.GREATER);
        gl.uniform1f(program.uniform('u_alphaScale'), OCCLUDED_ALPHA);
        lines.draw();
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        return 2;
    }
    dispose(): void {
        this.program.dispose();
        this.lines.dispose();
    }
}
