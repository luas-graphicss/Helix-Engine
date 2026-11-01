import type { GL } from './context';
import { ShaderCompileTracker } from './shader-compile-tracker';
type ShaderStage = 'vertex' | 'fragment' | 'link';
export class ShaderCompileError extends Error {
    constructor(readonly stage: ShaderStage, readonly log: string) {
        super(`Falha ao compilar shader (${stage}):\n${log}`);
        this.name = 'ShaderCompileError';
    }
}
type LinkState = 'queued' | 'issued' | 'linked' | 'failed';
export class ShaderProgram {
    private readonly tracker: ShaderCompileTracker;
    private glProgram: WebGLProgram | null = null;
    private vertex: WebGLShader | null = null;
    private fragment: WebGLShader | null = null;
    private state: LinkState = 'queued';
    private failure: ShaderCompileError | null = null;
    issuedAt = 0;
    private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
    private readonly attributes = new Map<string, number>();
    readonly sourceLength: number;
    constructor(private readonly gl: GL, private vertexSource: string, private fragmentSource: string) {
        this.sourceLength = vertexSource.length + fragmentSource.length;
        this.tracker = ShaderCompileTracker.for(gl);
        this.tracker.track(this);
    }
    get handle(): WebGLProgram | null {
        return this.glProgram;
    }
    issue(): void {
        if (this.state !== 'queued')
            return;
        const { gl } = this;
        const vertex = compileStage(gl, gl.VERTEX_SHADER, this.vertexSource);
        const fragment = compileStage(gl, gl.FRAGMENT_SHADER, this.fragmentSource);
        const program = gl.createProgram();
        if (!program) {
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
            throw this.fail(new ShaderCompileError('link', 'createProgram retornou null'));
        }
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        this.glProgram = program;
        this.vertex = vertex;
        this.fragment = fragment;
        this.issuedAt = performance.now();
        this.state = 'issued';
        this.vertexSource = this.fragmentSource = '';
    }
    get ready(): boolean {
        if (this.state === 'linked')
            return true;
        if (this.failure)
            throw this.failure;
        if (this.state === 'queued')
            this.tracker.issue(this);
        if (!this.tracker.likelyLinked(this))
            return false;
        this.tracker.confirm(this);
        return true;
    }
    use(): void {
        if (this.state !== 'linked')
            this.ensureLinked();
        this.gl.useProgram(this.glProgram);
    }
    uniform(name: string): WebGLUniformLocation | null {
        if (this.state !== 'linked')
            this.ensureLinked();
        let location = this.uniforms.get(name);
        if (location === undefined) {
            location = this.gl.getUniformLocation(this.glProgram!, name);
            this.uniforms.set(name, location);
        }
        return location;
    }
    attribute(name: string): number {
        if (this.state !== 'linked')
            this.ensureLinked();
        let location = this.attributes.get(name);
        if (location === undefined) {
            location = this.gl.getAttribLocation(this.glProgram!, name);
            this.attributes.set(name, location);
        }
        return location;
    }
    private ensureLinked(): void {
        if (this.failure)
            throw this.failure;
        if (this.state === 'queued')
            this.tracker.issue(this);
        this.tracker.confirm(this);
    }
    verifyLink(): number {
        if (this.state === 'linked')
            return 0;
        if (this.failure)
            throw this.failure;
        const { gl } = this;
        const program = this.glProgram;
        if (!program)
            throw this.fail(new ShaderCompileError('link', 'conferência de um programa que nunca foi emitido'));
        const started = performance.now();
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
        const blockedMs = performance.now() - started;
        if (!linked) {
            const error = this.describeFailure(program);
            this.releaseShaders();
            gl.deleteProgram(program);
            this.glProgram = null;
            throw this.fail(error);
        }
        this.releaseShaders();
        this.tracker.untrack(this);
        this.state = 'linked';
        return blockedMs;
    }
    private fail(error: ShaderCompileError): ShaderCompileError {
        this.failure = error;
        this.state = 'failed';
        this.tracker.untrack(this);
        return error;
    }
    private describeFailure(program: WebGLProgram): ShaderCompileError {
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
        const log = gl.getProgramInfoLog(program) ?? '';
        return new ShaderCompileError('link', log + linkLimitsHint(gl, log, this.vertex, this.fragment));
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
        if (this.glProgram)
            this.gl.deleteProgram(this.glProgram);
        this.glProgram = null;
        this.vertexSource = this.fragmentSource = '';
        this.failure = new ShaderCompileError('link', 'programa já descartado');
        this.state = 'failed';
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
const SAMPLER_DECLARATION = /uniform\s+(?:(?:highp|mediump|lowp)\s+)?[iu]?sampler(?:2D|3D|Cube|2DArray)(?:Shadow)?\s+\w+/g;
const VARYING_DECLARATION = /^\s*(?:(?:flat|smooth|centroid)\s+)*out\s+(?:(?:highp|mediump|lowp)\s+)?(?:[iu]?vec[234]|float|int|uint|mat[234](?:x[234])?)\s+\w+/gm;
function linkLimitsHint(gl: GL, log: string, vertex: WebGLShader | null, fragment: WebGLShader | null): string {
    const lower = log.toLowerCase();
    const hints: string[] = [];
    if (/texture image unit|sampler/.test(lower) && fragment) {
        const declared = (gl.getShaderSource(fragment) ?? '').replace(/\/\/[^\n]*/g, '').match(SAMPLER_DECLARATION)?.length ?? 0;
        hints.push(`MAX_TEXTURE_IMAGE_UNITS deste GPU = ${gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)}; o fragmento declara ${declared} samplers`);
    }
    if (/varying|packing/.test(lower) && vertex) {
        const declared = (gl.getShaderSource(vertex) ?? '').replace(/\/\/[^\n]*/g, '').match(VARYING_DECLARATION)?.length ?? 0;
        hints.push(`MAX_VARYING_VECTORS deste GPU = ${gl.getParameter(gl.MAX_VARYING_VECTORS)}; o vértice declara ${declared} saídas`);
    }
    return hints.length > 0 ? `\n[${hints.join('; ')}]` : '';
}
