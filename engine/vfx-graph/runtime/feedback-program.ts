import type { GL } from '@/engine/renderer/gl/context';
import { ShaderCompileError } from '@/engine/renderer/gl/shader-program';
const DISCARDED_FRAGMENT = `#version 300 es
precision lowp float;
out vec4 fragColor;
void main() {
    fragColor = vec4(0.0);
}
`;
function compileStage(gl: GL, type: number, source: string, stage: 'vertex' | 'fragment'): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader)
        throw new ShaderCompileError(stage, 'createShader retornou null');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new ShaderCompileError(stage, log);
}
function linkFeedbackProgram(gl: GL, vertexSource: string, varyings: readonly string[]): WebGLProgram {
    const vertex = compileStage(gl, gl.VERTEX_SHADER, vertexSource, 'vertex');
    const fragment = compileStage(gl, gl.FRAGMENT_SHADER, DISCARDED_FRAGMENT, 'fragment');
    const program = gl.createProgram();
    if (program) {
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.transformFeedbackVaryings(program, [...varyings], gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(program);
    }
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!program)
        throw new ShaderCompileError('link', 'createProgram retornou null');
    if (gl.getProgramParameter(program, gl.LINK_STATUS))
        return program;
    const log = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new ShaderCompileError('link', log);
}
export class FeedbackProgram {
    private readonly program: WebGLProgram;
    private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
    constructor(private readonly gl: GL, vertexSource: string, varyings: readonly string[]) {
        this.program = linkFeedbackProgram(gl, vertexSource, varyings);
    }
    use(): void {
        this.gl.useProgram(this.program);
    }
    uniform(name: string): WebGLUniformLocation | null {
        let location = this.uniforms.get(name);
        if (location === undefined) {
            location = this.gl.getUniformLocation(this.program, name);
            this.uniforms.set(name, location);
        }
        return location;
    }
    dispose(): void {
        this.gl.deleteProgram(this.program);
    }
}
