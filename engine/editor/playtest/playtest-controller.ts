import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { uniqueEntityName } from '@/engine/core/scene/entity-utils';
import { clamp } from '@/engine/core/math/scalar';
import { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import { PHYSICS_BACKEND_LABELS } from '@/engine/physics/world/physics-world';
import { detectPhysicsBackendCapabilities, resolvePhysicsBackend } from '@/engine/physics/worker/physics-capabilities';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { CharacterRuntime } from '@/engine/character/character-runtime';
import { createCharacterActor, defaultActorName, defaultSpawnPosition, findPossessableCharacter } from '@/engine/character/character-actor';
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
    physicsBudgetMs = Infinity;
    characters: CharacterRuntime | null = null;
    private readonly snapshots = new Map<Entity, TransformSnapshot>();
    private readonly cameraPosition = vec3.create();
    private readonly cameraTarget = vec3.create();
    transientCharacter: Entity | null = null;
    constructor(private readonly session: EditorSession) { }
    get isRunning(): boolean {
        return this.state !== 'stopped';
    }
    get isPossessing(): boolean {
        return this.isRunning && (this.characters?.isPossessing ?? false);
    }
    get pointerLocked(): boolean {
        return this.characters?.pointerLocked ?? false;
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
        const { physics, characters } = this;
        if (physics) {
            const { scripts } = this.session;
            const h = physics.world.fixedTimestep;
            scripts.beforePhysics(h, h);
            characters?.reconcile();
            if (scripts.switches.locomotion)
                characters?.applyInput();
            physics.stepOnce();
            characters?.present(h, 1);
            scripts.afterPhysics(h);
            this.elapsedSeconds += h;
        }
        this.session.notify();
    }
    setTimeScale(value: number): void {
        if (!Number.isFinite(value))
            return;
        this.timeScale = clamp(value, MIN_TIME_SCALE, MAX_TIME_SCALE);
        this.session.notify();
    }
    tick(deltaSeconds: number, elapsedSeconds: number): void {
        const { physics, characters } = this;
        if (this.state !== 'playing' || !physics)
            return;
        const scaled = deltaSeconds * this.timeScale;
        const { scripts, frameProfile } = this.session;
        frameProfile.begin('scripts');
        scripts.beforePhysics(scaled, deltaSeconds);
        frameProfile.end('scripts');
        characters?.reconcile();
        if (scripts.switches.locomotion)
            characters?.applyInput();
        physics.world.stepBudgetMs = this.physicsBudgetMs;
        frameProfile.begin('physics');
        const steps = physics.update(scaled, elapsedSeconds);
        frameProfile.end('physics');
        characters?.present(scaled, physics.world.interpolation);
        frameProfile.begin('scripts');
        scripts.afterPhysics(scaled);
        frameProfile.end('scripts');
        this.elapsedSeconds += physics.world.stats.simulatedSeconds;
    }
    syncPlayer(): void {
        if (!this.isRunning)
            return;
        const wanted = this.session.scene.player.enabled;
        if (wanted === (this.characters !== null))
            return;
        if (wanted)
            this.startCharacters();
        else
            this.stopCharacters();
        this.session.notify();
    }
    private begin(): void {
        const { session } = this;
        this.snapshots.clear();
        session.scene.traverse((entity) => this.snapshots.set(entity, snapshotTransform(entity)));
        vec3.copy(this.cameraPosition, session.camera.position);
        vec3.copy(this.cameraTarget, session.camera.target);
        this.elapsedSeconds = 0;
        session.audio.world.enterGame();
        session.guiWorld.reset();
        session.vfxWorld.reset();
        session.hud.start();
        const backend = resolvePhysicsBackend(engineSettings.get('simulation.physics.backend'), detectPhysicsBackendCapabilities());
        const physics = new PhysicsScene(session.scene, {
            onOutOfBounds: (entity) => session.log.warn('Física', `${entity.name} caiu abaixo do limite do mundo e foi desativado.`),
            onUnstable: (entity) => session.log.error('Física', `${entity.name} ficou instável; pose restaurada e corpo adormecido.`),
            onBackendFallback: (message) => session.log.warn('Física', `Worker de física indisponível (${message}) A simulação segue nesta thread.`),
            onRemoteFrame: () => session.notify(),
        }, { backend });
        physics.reconcile();
        this.physics = physics;
        session.log.info('Física', `Simulação iniciada com ${physics.world.bodies.length} corpos · ${PHYSICS_BACKEND_LABELS[physics.world.backend]}.`);
        this.startCharacters();
        void session.scripts.start('play');
    }
    private startCharacters(): void {
        const { session, physics } = this;
        if (!physics)
            return;
        if (!session.scene.player.enabled) {
            session.log.info('Personagem', 'Personagem do jogador desligado: nenhum personagem é criado ou possuído; os atores de personagem da cena ficam inertes.');
            return;
        }
        this.transientCharacter = this.spawnTransientCharacter();
        const characters = new CharacterRuntime(session.scene, physics, {
            canvas: session.viewportCanvas,
            camera: session.camera,
            onPointerLockChange: () => session.notify(),
        });
        this.characters = characters;
        const possessed = characters.possessed;
        if (possessed && characters.isPossessing) {
            session.log.info('Personagem', `${possessed.entity.name} possuído: WASD move, Shift corre, Espaço pula, C agacha; clique no viewport para capturar o mouse.`);
        }
    }
    private stopCharacters(): void {
        const restoreCamera = this.isPossessing;
        this.characters?.dispose();
        this.characters = null;
        this.removeTransientCharacter();
        if (restoreCamera) {
            vec3.copy(this.session.camera.position, this.cameraPosition);
            vec3.copy(this.session.camera.target, this.cameraTarget);
        }
    }
    private spawnTransientCharacter(): Entity | null {
        const { session } = this;
        const { scene } = session;
        const { player } = scene;
        if (!player.spawnIfMissing || findPossessableCharacter(scene))
            return null;
        const entity = createCharacterActor(scene, scene.root, {
            name: uniqueEntityName(scene, defaultActorName(player.character.model)),
            settings: player.character,
            onRigReady: () => session.notify(),
        });
        defaultSpawnPosition(scene, entity.transform.position);
        session.log.info('Personagem', `${entity.name} criado no ponto de início; ajuste-o na aba Personagem ou desligue "Criar no início" para simular sem ele.`);
        return entity;
    }
    private end(): void {
        this.session.scripts.stop();
        this.session.audio.world.exitGame();
        this.session.guiWorld.reset();
        this.session.vfxWorld.reset();
        this.session.hud.stop();
        this.stopCharacters();
        this.physics?.dispose();
        this.physics = null;
        for (const [entity, snapshot] of this.snapshots)
            applyTransformSnapshot(entity, snapshot);
        this.snapshots.clear();
    }
    private removeTransientCharacter(): void {
        const entity = this.transientCharacter;
        if (!entity)
            return;
        this.transientCharacter = null;
        const { session } = this;
        if (session.selectedEntity && entity.contains(session.selectedEntity))
            session.select(null);
        entity.parent?.remove(entity);
    }
}
