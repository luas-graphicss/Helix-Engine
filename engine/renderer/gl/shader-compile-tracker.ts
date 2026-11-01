import { WebGLContextLostError, type GL } from './context';
import type { ShaderProgram } from './shader-program';
const MIN_WAIT_MS = 16;
const MAX_WAIT_MS = 4000;
const PARALLEL_STALL_MS = 8000;
const RATE_SMOOTHING = 0.5;
const NEGLIGIBLE_BLOCK_MS = 8;
const OVERSHOOT_SHRINK = 0.8;
export class ShaderCompileTracker {
    private static readonly byContext = new WeakMap<GL, ShaderCompileTracker>();
    readonly parallel: KHR_parallel_shader_compile | null;
    private readonly queued: ShaderProgram[] = [];
    private readonly inFlight = new Set<ShaderProgram>();
    private msPerChar = 0;
    static for(gl: GL): ShaderCompileTracker {
        let tracker = ShaderCompileTracker.byContext.get(gl);
        if (!tracker) {
            tracker = new ShaderCompileTracker(gl);
            ShaderCompileTracker.byContext.set(gl, tracker);
        }
        return tracker;
    }
    private constructor(private readonly gl: GL) {
        this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    }
    get pendingCount(): number {
        return this.queued.length + this.inFlight.size;
    }
    track(program: ShaderProgram): void {
        this.queued.push(program);
    }
    untrack(program: ShaderProgram): void {
        const index = this.queued.indexOf(program);
        if (index >= 0)
            this.queued.splice(index, 1);
        this.inFlight.delete(program);
    }
    issue(program: ShaderProgram): void {
        const index = this.queued.indexOf(program);
        if (index >= 0)
            this.queued.splice(index, 1);
        program.issue();
        this.inFlight.add(program);
    }
    likelyLinked(program: ShaderProgram): boolean {
        const { parallel } = this;
        const waitedMs = performance.now() - program.issuedAt;
        if (parallel)
            return waitedMs >= PARALLEL_STALL_MS || (this.gl.getProgramParameter(program.handle!, parallel.COMPLETION_STATUS_KHR) as boolean) === true;
        return waitedMs >= this.expectedLinkMs(program);
    }
    confirm(program: ShaderProgram): void {
        if (this.parallel) {
            program.verifyLink();
            return;
        }
        const waitedMs = performance.now() - program.issuedAt;
        const expectedMs = this.expectedLinkMs(program);
        const blockedMs = program.verifyLink();
        const observedMs = blockedMs > NEGLIGIBLE_BLOCK_MS ? waitedMs + blockedMs : expectedMs * OVERSHOOT_SHRINK;
        const observedRate = observedMs / Math.max(1, program.sourceLength);
        this.msPerChar = this.msPerChar === 0 ? observedRate : this.msPerChar + (observedRate - this.msPerChar) * RATE_SMOOTHING;
    }
    poll(): number {
        if (this.pendingCount > 0 && this.gl.isContextLost())
            throw new WebGLContextLostError();
        if (this.parallel) {
            while (this.queued.length > 0)
                this.issue(this.queued[0]);
            for (const program of [...this.inFlight])
                void program.ready;
            return this.pendingCount;
        }
        const [current] = this.inFlight;
        if (current) {
            if (!this.likelyLinked(current))
                return this.pendingCount;
            this.confirm(current);
        }
        if (this.queued.length > 0)
            this.issue(this.queued[0]);
        return this.pendingCount;
    }
    private expectedLinkMs(program: ShaderProgram): number {
        return Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, this.msPerChar * program.sourceLength));
    }
}
