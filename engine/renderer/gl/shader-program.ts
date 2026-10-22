import type { GL } from './context';
import { ShaderCompileTracker } from './shader-compile-tracker';
type ShaderStage = 'vertex' | 'fragment' | 'link';
export class ShaderCompileError extends Error {
    constructor(stage: ShaderStage, log: string) {
        super(`Falha ao compilar shader (${stage}):\n${log}`);
        this.name = 'ShaderCompileError';
    }
}
function compileStage(gl: GL, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader)
        throw new ShaderCompileError(type === gl.VERTEX_SHADER ? 'vertex' : 'fragment', 'createShader retornou null');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}
export class ShaderProgram {
    readonly program: WebGLProgram;
    private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
    private readonly attributes = new Map<string, number>();
    private readonly tracker: ShaderCompileTracker;
    private vertex: WebGLShader | null;
    private fragment: WebGLShader | null;
    private linked = false;
    constructor(private readonly gl: GL, vertexSource: string, fragmentSource: string) {
        this.tracker = ShaderCompileTracker.for(gl);
        const vertex = compileStage(gl, gl.VERTEX_SHADER, vertexSource);
        const fragment = compileStage(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        if (!program) {
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
            throw new ShaderCompileError('link', 'createProgram retornou null');
        }
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        this.program = program;
        this.vertex = vertex;
        this.fragment = fragment;
        if (this.tracker.parallel)
            this.tracker.track(this);
        else
            this.verifyLink();
    }
    get ready(): boolean {
        if (this.linked)
            return true;
        const { parallel } = this.tracker;
        if (parallel && !this.gl.getProgramParameter(this.program, parallel.COMPLETION_STATUS_KHR))
            return false;
        this.verifyLink();
        return true;
    }
    use(): void {
        if (!this.linked)
            this.verifyLink();
        this.gl.useProgram(this.program);
    }
    uniform(name: string): WebGLUniformLocation | null {
        if (!this.linked)
            this.verifyLink();
        let location = this.uniforms.get(name);
        if (location === undefined) {
            location = this.gl.getUniformLocation(this.program, name);
            this.uniforms.set(name, location);
        }
        return location;
    }
    attribute(name: string): number {
        if (!this.linked)
            this.verifyLink();
        let location = this.attributes.get(name);
        if (location === undefined) {
            location = this.gl.getAttribLocation(this.program, name);
            this.attributes.set(name, location);
        }
        return location;
    }
    private verifyLink(): void {
        const { gl, program } = this;
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
        if (!linked) {
            const error = this.describeFailure();
            this.releaseShaders();
            this.tracker.untrack(this);
            gl.deleteProgram(program);
            throw error;
        }
        this.releaseShaders();
        this.tracker.untrack(this);
        this.linked = true;
    }
    private describeFailure(): ShaderCompileError {
        const { gl } = this;
        const stages: [
            WebGLShader | null,
            ShaderStage
        ][] = [
            [this.vertex, 'vertex'],
            [this.fragment, 'fragment'],
        ];
        for (const [shader, stage] of stages) {
            if (shader && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                return new ShaderCompileError(stage, gl.getShaderInfoLog(shader) ?? '');
            }
        }
        return new ShaderCompileError('link', gl.getProgramInfoLog(this.program) ?? '');
    }
    private releaseShaders(): void {
        const { gl } = this;
        if (this.vertex)
            gl.deleteShader(this.vertex);
        if (this.fragment)
            gl.deleteShader(this.fragment);
        this.vertex = null;
        this.fragment = null;
    }
    dispose(): void {
        this.releaseShaders();
        this.tracker.untrack(this);
        this.gl.deleteProgram(this.program);
    }
}
