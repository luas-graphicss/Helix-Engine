import type { GL } from '@/engine/renderer/gl/context';
import type { CompiledEffect } from '../compiler/effect-compiler';
import { describeShaderFailure, ParticleSystem, type EffectFrame } from './particle-system';
export class EffectInstance {
    private systems = new Map<string, ParticleSystem>();
    private buildFailure: string | null = null;
    constructor(private readonly gl: GL) { }
    get error(): string | null {
        if (this.buildFailure)
            return this.buildFailure;
        for (const system of this.systems.values()) {
            if (system.failure)
                return system.failure;
        }
        return null;
    }
    get liveParticles(): number {
        let total = 0;
        for (const system of this.systems.values())
            total += system.liveParticles;
        return total;
    }
    apply(compiled: CompiledEffect): void {
        const next = new Map<string, ParticleSystem>();
        this.buildFailure = null;
        for (const system of compiled.systems) {
            const existing = this.systems.get(system.id);
            if (existing?.canAdopt(system)) {
                existing.adopt(system);
                next.set(system.id, existing);
                this.systems.delete(system.id);
                continue;
            }
            try {
                next.set(system.id, new ParticleSystem(this.gl, system));
            }
            catch (cause) {
                this.buildFailure = describeShaderFailure(cause);
            }
        }
        for (const stale of this.systems.values())
            stale.dispose();
        this.systems = next;
    }
    restart(): void {
        for (const system of this.systems.values())
            system.restart();
    }
    simulate(delta: number): void {
        for (const system of this.systems.values())
            system.simulate(delta);
    }
    draw(frame: EffectFrame): void {
        const { gl } = this;
        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        for (const system of this.systems.values())
            system.draw(frame);
        gl.disable(gl.BLEND);
    }
    dispose(): void {
        for (const system of this.systems.values())
            system.dispose();
        this.systems.clear();
    }
}
