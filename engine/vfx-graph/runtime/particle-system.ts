import type { GL } from '@/engine/renderer/gl/context';
import { ShaderCompileError, ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { CompiledOutput, CompiledSystem } from '../compiler/effect-compiler';
import { FeedbackProgram } from './feedback-program';
import { ParticleBuffers } from './particle-buffers';
import { FEEDBACK_VARYINGS } from './particle-layout';
import { PopulationEstimate } from './population-estimate';
import { SpawnScheduler } from './spawn-scheduler';
import { bindEffectUniforms } from './uniform-binding';
export interface EffectFrame {
    readonly view: Float32Array;
    readonly projection: Float32Array;
}
interface Sprite {
    readonly program: ShaderProgram;
    failure: string | null;
}
const UINT32_RANGE = 0x100000000;
function spriteKey(output: CompiledOutput): string {
    return `${output.vertex}\n${output.fragment}`;
}
export function describeShaderFailure(cause: unknown): string {
    if (cause instanceof ShaderCompileError)
        return cause.log;
    return cause instanceof Error ? cause.message : String(cause);
}
export class ParticleSystem {
    private readonly buffers: ParticleBuffers;
    private readonly simulation: FeedbackProgram;
    private readonly scheduler: SpawnScheduler;
    private readonly population = new PopulationEstimate();
    private readonly sprites = new Map<string, Sprite>();
    private cursor = 0;
    private serial = 0;
    private time = 0;
    constructor(private readonly gl: GL, private compiled: CompiledSystem) {
        this.simulation = new FeedbackProgram(gl, compiled.simulation, FEEDBACK_VARYINGS);
        this.buffers = new ParticleBuffers(gl, compiled.capacity);
        this.scheduler = new SpawnScheduler(compiled.spawn);
        this.syncSprites();
    }
    get liveParticles(): number {
        return this.population.alive(this.time, this.compiled.maxLifetime, this.compiled.capacity);
    }
    get failure(): string | null {
        for (const sprite of this.sprites.values()) {
            if (sprite.failure)
                return sprite.failure;
        }
        return null;
    }
    canAdopt(compiled: CompiledSystem): boolean {
        return compiled.capacity === this.compiled.capacity && compiled.simulation === this.compiled.simulation;
    }
    adopt(compiled: CompiledSystem): void {
        this.compiled = compiled;
        this.scheduler.setPlan(compiled.spawn);
        this.syncSprites();
    }
    restart(): void {
        this.buffers.clear();
        this.scheduler.reset();
        this.population.reset();
        this.cursor = 0;
        this.time = 0;
    }
    simulate(delta: number): void {
        const { gl, compiled, simulation } = this;
        const spawnCount = Math.min(this.scheduler.advance(delta), compiled.capacity);
        this.time += delta;
        this.serial = (this.serial + 1) % UINT32_RANGE;
        simulation.use();
        gl.uniform1f(simulation.uniform('u_delta'), delta);
        gl.uniform1f(simulation.uniform('u_time'), this.time);
        gl.uniform1i(simulation.uniform('u_capacity'), compiled.capacity);
        gl.uniform1i(simulation.uniform('u_spawnStart'), this.cursor);
        gl.uniform1i(simulation.uniform('u_spawnCount'), spawnCount);
        gl.uniform1ui(simulation.uniform('u_spawnSerial'), this.serial);
        bindEffectUniforms(gl, simulation, compiled.uniforms);
        this.buffers.step();
        this.cursor = (this.cursor + spawnCount) % compiled.capacity;
        this.population.record(this.time, spawnCount);
    }
    draw(frame: EffectFrame): void {
        const { gl, compiled } = this;
        const count = this.liveParticles;
        if (count === 0)
            return;
        const first = (this.cursor - count + compiled.capacity) % compiled.capacity;
        for (const output of compiled.outputs) {
            const program = this.linkedProgram(output);
            if (!program)
                continue;
            gl.uniformMatrix4fv(program.uniform('u_view'), false, frame.view);
            gl.uniformMatrix4fv(program.uniform('u_projection'), false, frame.projection);
            gl.uniform1f(program.uniform('u_time'), this.time);
            bindEffectUniforms(gl, program, output.uniforms);
            gl.blendFunc(gl.ONE, output.blend === 'additive' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
            this.buffers.draw(first, count);
        }
    }
    dispose(): void {
        this.buffers.dispose();
        this.simulation.dispose();
        for (const sprite of this.sprites.values())
            sprite.program.dispose();
        this.sprites.clear();
    }
    private linkedProgram(output: CompiledOutput): ShaderProgram | null {
        const sprite = this.sprites.get(spriteKey(output));
        if (!sprite || sprite.failure)
            return null;
        try {
            sprite.program.use();
            return sprite.program;
        }
        catch (cause) {
            sprite.failure = describeShaderFailure(cause);
            return null;
        }
    }
    private syncSprites(): void {
        const wanted = new Map(this.compiled.outputs.map((output) => [spriteKey(output), output]));
        for (const [key, sprite] of this.sprites) {
            if (wanted.has(key))
                continue;
            sprite.program.dispose();
            this.sprites.delete(key);
        }
        for (const [key, output] of wanted) {
            if (!this.sprites.has(key))
                this.sprites.set(key, { program: new ShaderProgram(this.gl, output.vertex, output.fragment), failure: null });
        }
    }
}
