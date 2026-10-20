import type { Entity } from '@/engine/core/scene/entity';
import { clamp } from '@/engine/core/math/scalar';
import { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { applyTransformSnapshot, snapshotTransform, type TransformSnapshot } from '@/engine/editor/operations/transform-operations';
export type PlaytestState = 'stopped' | 'playing' | 'paused';
export const MIN_TIME_SCALE = 0.1;
export const MAX_TIME_SCALE = 3;
export class PlaytestController {
    state: PlaytestState = 'stopped';
    timeScale = 1;
    elapsedSeconds = 0;
    physics: PhysicsScene | null = null;
    private readonly snapshots = new Map<Entity, TransformSnapshot>();
    constructor(private readonly session: EditorSession) { }
    get isRunning(): boolean {
        return this.state !== 'stopped';
    }
    play(): void {
        if (this.state === 'playing')
            return;
        if (this.state === 'stopped')
            this.begin();
        this.state = 'playing';
        this.session.notify();
    }
    pause(): void {
        if (this.state !== 'playing')
            return;
        this.state = 'paused';
        this.session.notify();
    }
    togglePlayPause(): void {
        if (this.state === 'playing')
            this.pause();
        else
            this.play();
    }
    stop(): void {
        if (this.state === 'stopped')
            return;
        this.end();
        this.state = 'stopped';
        this.session.log.info('Física', `Simulação encerrada após ${this.elapsedSeconds.toFixed(1)} s; cena restaurada.`);
        this.session.notify();
    }
    stepOnce(): void {
        if (this.state === 'stopped')
            this.begin();
        this.state = 'paused';
        const physics = this.physics;
        if (physics) {
            physics.stepOnce();
            this.elapsedSeconds += physics.world.fixedTimestep;
        }
        this.session.notify();
    }
    setTimeScale(value: number): void {
        if (!Number.isFinite(value))
            return;
        this.timeScale = clamp(value, MIN_TIME_SCALE, MAX_TIME_SCALE);
        this.session.notify();
    }
    tick(deltaSeconds: number): void {
        const physics = this.physics;
        if (this.state !== 'playing' || !physics)
            return;
        const scaled = deltaSeconds * this.timeScale;
        const steps = physics.update(scaled);
        this.elapsedSeconds += steps * physics.world.fixedTimestep;
    }
    private begin(): void {
        const { session } = this;
        this.snapshots.clear();
        session.scene.traverse((entity) => this.snapshots.set(entity, snapshotTransform(entity)));
        this.elapsedSeconds = 0;
        this.physics = new PhysicsScene(session.scene, {
            onOutOfBounds: (entity) => session.log.warn('Física', `${entity.name} caiu abaixo do limite do mundo e foi desativado.`),
            onUnstable: (entity) => session.log.error('Física', `${entity.name} ficou instável; pose restaurada e corpo adormecido.`),
        });
        this.physics.reconcile();
        session.log.info('Física', `Simulação iniciada com ${this.physics.world.bodies.length} corpos.`);
    }
    private end(): void {
        this.physics?.dispose();
        this.physics = null;
        for (const [entity, snapshot] of this.snapshots)
            applyTransformSnapshot(entity, snapshot);
        this.snapshots.clear();
    }
}
