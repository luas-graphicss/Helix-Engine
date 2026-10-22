import type { GL } from './context';
import type { ShaderProgram } from './shader-program';
export class ShaderCompileTracker {
    private static readonly byContext = new WeakMap<GL, ShaderCompileTracker>();
    readonly parallel: KHR_parallel_shader_compile | null;
    private readonly pending = new Set<ShaderProgram>();
    static for(gl: GL): ShaderCompileTracker {
        let tracker = ShaderCompileTracker.byContext.get(gl);
        if (!tracker) {
            tracker = new ShaderCompileTracker(gl);
            ShaderCompileTracker.byContext.set(gl, tracker);
        }
        return tracker;
    }
    private constructor(gl: GL) {
        this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    }
    get pendingCount(): number {
        return this.pending.size;
    }
    track(program: ShaderProgram): void {
        this.pending.add(program);
    }
    untrack(program: ShaderProgram): void {
        this.pending.delete(program);
    }
    poll(): number {
        let pending = 0;
        for (const program of [...this.pending])
            if (!program.ready)
                pending++;
        return pending;
    }
}
