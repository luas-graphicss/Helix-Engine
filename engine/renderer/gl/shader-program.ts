import type { GL } from './context';
export class ShaderCompileError extends Error {
    constructor(stage: 'vertex' | 'fragment' | 'link', log: string) {
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
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? '';
        gl.deleteShader(shader);
        throw new ShaderCompileError(type === gl.VERTEX_SHADER ? 'vertex' : 'fragment', log);
    }
    return shader;
}
export class ShaderProgram {
    readonly program: WebGLProgram;
    private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
    private readonly attributes = new Map<string, number>();
    constructor(private readonly gl: GL, vertexSource: string, fragmentSource: string) {
        const vertex = compileStage(gl, gl.VERTEX_SHADER, vertexSource);
        const fragment = compileStage(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        if (!program)
            throw new ShaderCompileError('link', 'createProgram retornou null');
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program) ?? '';
            gl.deleteProgram(program);
            throw new ShaderCompileError('link', log);
        }
        this.program = program;
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
    attribute(name: string): number {
        let location = this.attributes.get(name);
        if (location === undefined) {
            location = this.gl.getAttribLocation(this.program, name);
            this.attributes.set(name, location);
        }
        return location;
    }
    dispose(): void {
        this.gl.deleteProgram(this.program);
    }
}
