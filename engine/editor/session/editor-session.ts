import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { OrbitController } from '@/engine/renderer/camera/orbit-controller';
import { createFrameStats, type FrameStats } from '@/engine/renderer/renderer';
import type { CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import * as vec3 from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import { degToRad } from '@/engine/core/math/scalar';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import type { CloudSettings, SkySettings } from '@/engine/core/environment/sky-settings';
import { advanceSkyCycle, syncSunLightToSky, wrapTimeOfDay } from '@/engine/core/environment/sky-cycle';
import { History } from '@/engine/editor/history/history';
import type { GizmoHandle, GizmoMode } from '@/engine/renderer/gizmo/gizmo-frame';
import { PlaytestController } from '@/engine/editor/playtest/playtest-controller';
import { TerrainEditor } from '@/engine/editor/terrain/terrain-editor';
import { createPhysicsSettings, PHYSICS_QUALITY_PRESETS, type PhysicsQuality, type PhysicsSettings, } from '@/engine/physics/world/physics-settings';
import { EditorLog } from './editor-log';
import { AssetLibrary } from './asset-library';
import { createDefaultScene } from './default-scene';
import { createRenderSettings, type RenderSettings } from './render-settings';
export type TransformTool = 'select' | 'translate' | 'rotate' | 'scale' | 'terrain';
export type TransformSpace = 'global' | 'local';
export interface GizmoInteraction {
    hovered: GizmoHandle | null;
    active: GizmoHandle | null;
}
export interface SnapSettings {
    enabled: boolean;
    translate: number;
    rotate: number;
    scale: number;
}
export interface ViewportStats extends FrameStats {
    fps: number;
}
type Listener = () => void;
const focusCenter = vec3.create();
const focusBounds = aabb.create();
export class EditorSession {
    readonly scene: Scene;
    readonly camera = new PerspectiveCamera();
    readonly orbit: OrbitController;
    readonly history = new History(() => this.notify());
    readonly log = new EditorLog(() => this.notify());
    readonly assets = new AssetLibrary(() => this.notify());
    readonly playtest = new PlaytestController(this);
    readonly terrain = new TerrainEditor(this);
    selectedId: number | null = null;
    clipboard: Entity | null = null;
    showGrid = true;
    shadowsEnabled = true;
    tool: TransformTool = 'select';
    space: TransformSpace = 'global';
    readonly snap: SnapSettings = { enabled: false, translate: 0.5, rotate: 15, scale: 0.1 };
    readonly gizmo: GizmoInteraction = { hovered: null, active: null };
    readonly stats: ViewportStats = { ...createFrameStats(), fps: 0 };
    readonly render: RenderSettings = createRenderSettings();
    private version = 0;
    private readonly listeners = new Set<Listener>();
    constructor(scene?: Scene) {
        this.scene = scene ?? createDefaultScene(this.terrain.materials);
        this.orbit = new OrbitController(this.camera);
        const cube = this.findByName('Cubo');
        this.selectedId = cube?.id ?? null;
        this.log.info('Núcleo', 'Helix Engine inicializada.');
        this.log.info('Cena', `${this.scene.root.name} aberta (${this.countEntities()} atores).`);
    }
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    getVersion = (): number => this.version;
    notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    select(entity: Entity | null): void {
        const nextId = entity?.id ?? null;
        if (nextId === this.selectedId)
            return;
        this.selectedId = nextId;
        this.notify();
    }
    get selectedEntity(): Entity | null {
        if (this.selectedId === null)
            return null;
        const entity = this.findById(this.selectedId);
        if (!entity)
            this.selectedId = null;
        return entity;
    }
    toggleGrid(): void {
        this.showGrid = !this.showGrid;
        this.notify();
    }
    toggleShadows(): void {
        this.shadowsEnabled = !this.shadowsEnabled;
        this.notify();
    }
    toggleFrustumCulling(): void {
        this.updateCulling({ frustumCulling: !this.render.culling.frustumCulling });
    }
    updateCulling(patch: Partial<CullingOptions>): void {
        Object.assign(this.render.culling, patch);
        this.notify();
    }
    updateLod(patch: Partial<LodSettings>): void {
        Object.assign(this.render.lod, patch);
        this.notify();
    }
    toggleSky(): void {
        this.updateSky({ enabled: !this.scene.sky.enabled });
    }
    updateSky(patch: Partial<Omit<SkySettings, 'clouds'>>): void {
        const { sky } = this.scene;
        if (patch.timeOfDay !== undefined)
            patch = { ...patch, timeOfDay: wrapTimeOfDay(patch.timeOfDay) };
        Object.assign(sky, patch);
        if (patch.timeOfDay !== undefined || patch.latitude !== undefined || patch.sunAzimuth !== undefined) {
            syncSunLightToSky(this.scene);
        }
        this.notify();
    }
    updateClouds(patch: Partial<CloudSettings>): void {
        Object.assign(this.scene.sky.clouds, patch);
        this.notify();
    }
    tick(deltaSeconds: number): void {
        if (advanceSkyCycle(this.scene.sky, deltaSeconds))
            syncSunLightToSky(this.scene);
        this.playtest.tick(deltaSeconds);
        this.terrain.tick(deltaSeconds);
    }
    updatePhysics(patch: Partial<PhysicsSettings>): void {
        const { physics } = this.scene;
        const { gravity, ...scalars } = patch;
        Object.assign(physics, scalars);
        if (gravity)
            vec3.copy(physics.gravity, gravity);
        this.notify();
    }
    setGravityComponent(axis: 0 | 1 | 2, value: number): void {
        if (!Number.isFinite(value))
            return;
        this.scene.physics.gravity[axis] = value;
        this.notify();
    }
    applyPhysicsQuality(quality: PhysicsQuality): void {
        this.updatePhysics(PHYSICS_QUALITY_PRESETS[quality]);
    }
    resetPhysicsSettings(): void {
        this.updatePhysics(createPhysicsSettings());
        this.log.info('Física', 'Parâmetros do mundo restaurados ao padrão.');
    }
    setTool(tool: TransformTool): void {
        if (this.tool === tool)
            return;
        if (this.tool === 'terrain') {
            this.terrain.endStroke();
            this.terrain.clearHover();
        }
        this.tool = tool;
        this.gizmo.hovered = null;
        this.notify();
    }
    get gizmoMode(): GizmoMode | null {
        return this.tool === 'select' || this.tool === 'terrain' ? null : this.tool;
    }
    get gizmoUsesLocalAxes(): boolean {
        return this.space === 'local' || this.tool === 'scale';
    }
    setSpace(space: TransformSpace): void {
        if (this.space === space)
            return;
        this.space = space;
        this.notify();
    }
    toggleSpace(): void {
        this.setSpace(this.space === 'global' ? 'local' : 'global');
    }
    updateSnap(patch: Partial<SnapSettings>): void {
        Object.assign(this.snap, patch);
        this.notify();
    }
    toggleSnap(): void {
        this.updateSnap({ enabled: !this.snap.enabled });
    }
    focusEntity(entity: Entity): void {
        this.scene.updateWorldMatrices();
        computeWorldBounds(this.scene, entity, focusBounds);
        if (aabb.isEmpty(focusBounds)) {
            vec3.set(focusCenter, entity.worldMatrix[12], entity.worldMatrix[13], entity.worldMatrix[14]);
            this.orbit.focus(focusCenter, 4);
        }
        else {
            aabb.center(focusCenter, focusBounds);
            const radius = Math.max(aabb.halfDiagonal(focusBounds), 0.25);
            const distance = (radius / Math.sin(degToRad(this.camera.fovDegrees) / 2)) * 1.1;
            this.orbit.focus(focusCenter, distance);
        }
        this.notify();
    }
    focusSelected(): void {
        const entity = this.selectedEntity;
        if (entity)
            this.focusEntity(entity);
    }
    updateStats(frame: FrameStats, fps: number): void {
        Object.assign(this.stats, frame);
        this.stats.fps = fps;
        this.notify();
    }
    findById(id: number): Entity | null {
        let found: Entity | null = null;
        this.scene.traverse((entity) => {
            if (entity.id === id)
                found = entity;
        });
        return found;
    }
    findByName(name: string): Entity | null {
        let found: Entity | null = null;
        this.scene.traverse((entity) => {
            if (entity.name === name)
                found = entity;
        });
        return found;
    }
    countEntities(): number {
        let total = -1;
        this.scene.traverse(() => total++);
        return total;
    }
}
