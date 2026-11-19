import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { collectSceneColliders } from '@/engine/cloth/collision/scene-colliders';
import { ClothInstance } from './cloth-instance';
import { restMeshOf } from './cloth-rest-meshes';
interface ClothSystemStats {
    instances: number;
    particles: number;
    constraints: number;
    stepMilliseconds: number;
}
export const CLOTH_STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_ADVANCE = 3;
const STEP_ROUNDING = 1e-6;
export class ClothSystem {
    readonly stats: ClothSystemStats = { instances: 0, particles: 0, constraints: 0, stepMilliseconds: 0 };
    private readonly instances = new Map<Entity, ClothInstance>();
    private readonly visited = new Set<Entity>();
    private pendingSeconds = 0;
    private simulatedSeconds = 0;
    get active(): boolean {
        return this.instances.size > 0;
    }
    instanceOf(entity: Entity): ClothInstance | null {
        return this.instances.get(entity) ?? null;
    }
    advance(scene: Scene, deltaSeconds: number): void {
        scene.updateWorldMatrices();
        this.reconcile(scene);
        if (this.instances.size === 0) {
            this.pendingSeconds = 0;
            return;
        }
        this.pendingSeconds = Math.min(this.pendingSeconds + deltaSeconds, MAX_STEPS_PER_ADVANCE * CLOTH_STEP_SECONDS);
        const steps = Math.floor(this.pendingSeconds / CLOTH_STEP_SECONDS + STEP_ROUNDING);
        if (steps === 0)
            return;
        this.pendingSeconds = Math.max(this.pendingSeconds - steps * CLOTH_STEP_SECONDS, 0);
        const startedAt = performance.now();
        const colliders = collectSceneColliders(scene);
        for (let step = 0; step < steps; step++) {
            for (const instance of this.instances.values())
                instance.step(CLOTH_STEP_SECONDS, { gravity: scene.physics.gravity, colliders, time: this.simulatedSeconds });
            this.simulatedSeconds += CLOTH_STEP_SECONDS;
        }
        for (const instance of this.instances.values())
            instance.writeMesh();
        this.stats.stepMilliseconds = performance.now() - startedAt;
    }
    reset(): void {
        for (const instance of this.instances.values())
            instance.dispose();
        this.instances.clear();
        this.pendingSeconds = 0;
        this.simulatedSeconds = 0;
        this.measure();
    }
    private reconcile(scene: Scene): void {
        const { instances, visited } = this;
        visited.clear();
        scene.traverse((entity) => {
            const settings = entity.cloth;
            const mesh = entity.mesh;
            if (!settings || !mesh || entity.skin)
                return;
            visited.add(entity);
            const current = instances.get(entity);
            if (current?.mesh === mesh) {
                if (current.settings !== settings)
                    current.applySettings(settings);
                return;
            }
            instances.set(entity, new ClothInstance(entity, restMeshOf(mesh), settings));
        });
        for (const [entity, instance] of instances) {
            if (visited.has(entity))
                continue;
            instance.dispose();
            instances.delete(entity);
        }
        this.measure();
    }
    private measure(): void {
        const { stats } = this;
        stats.instances = this.instances.size;
        stats.particles = 0;
        stats.constraints = 0;
        for (const instance of this.instances.values()) {
            stats.particles += instance.particleCount;
            stats.constraints += instance.constraintCount;
        }
        if (stats.instances === 0)
            stats.stepMilliseconds = 0;
    }
}
