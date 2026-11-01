import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { OrbitController } from '@/engine/renderer/camera/orbit-controller';
import { createFrameStats, type FrameStats, type Renderer } from '@/engine/renderer/renderer';
import type { FrameGovernor } from '@/engine/renderer/quality/frame-governor';
import { FrameProfile } from '@/engine/renderer/stats/frame-profile';
import type { FrameClock } from '@/engine/core/time/frame-clock';
import type { CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import type { MyriadSettings } from '@/engine/renderer/myriad/runtime/myriad-settings';
import type { LightHelperMode } from '@/engine/renderer/passes/light-helper-pass';
import type { SoundHelperMode } from '@/engine/renderer/passes/sound-helper-pass';
import * as vec3 from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import { degToRad } from '@/engine/core/math/scalar';
import { computeWorldBounds } from '@/engine/renderer/geometry/bounds';
import type { CloudSettings, SkySettings } from '@/engine/core/environment/sky-settings';
import { advanceSkyCycle, syncSunLightToSky, wrapTimeOfDay } from '@/engine/core/environment/sky-cycle';
import { assignPostProcessSettings, findPostProcessPreset, type PostProcessEffectKey, type PostProcessSettings, } from '@/engine/core/environment/post-process-settings';
import { History } from '@/engine/editor/history/history';
import type { GizmoHandle, GizmoMode } from '@/engine/renderer/gizmo/gizmo-frame';
import { PlaytestController } from '@/engine/editor/playtest/playtest-controller';
import { TerrainEditor } from '@/engine/editor/terrain/terrain-editor';
import { AnimationEditor } from '@/engine/editor/animation/animation-editor';
import { AudioEditor } from '@/engine/editor/audio/audio-editor';
import { GuiDesigner } from '@/engine/editor/gui/gui-designer';
import { GuiWorldHost } from '@/engine/editor/gui/gui-world-host';
import { VfxEditor } from '@/engine/editor/vfx/vfx-editor';
import { VfxWorldHost } from '@/engine/editor/vfx/vfx-world-host';
import { CodeEditor } from '@/engine/editor/code/code-editor';
import { ShaderPreview } from '@/engine/editor/code/shader-preview';
import { ScriptRuntime } from '@/engine/scripting/runtime/script-runtime';
import { syncCodeEditorWithLibrary } from '@/engine/editor/operations/script-operations';
import { syncVfxEditorWithLibrary } from '@/engine/editor/operations/vfx-operations';
import type { VfxHelperMode } from '@/engine/renderer/passes/vfx-helper-pass';
import { PlaytestHud } from '@/engine/editor/playtest/playtest-hud';
import { syncGuiDesignerWithLibrary } from '@/engine/editor/operations/gui-operations';
import type { TransformSnapshot } from '@/engine/editor/operations/transform-operations';
import { ViewportColorPicker } from '@/engine/editor/viewport/viewport-color-picker';
import { createPhysicsSettings, PHYSICS_QUALITY_PRESETS, type PhysicsQuality, type PhysicsSettings, } from '@/engine/physics/world/physics-settings';
import type { MaterialLibrary } from '@/engine/materials/material-library';
import type { AssetLibrary } from '@/engine/assets/library/asset-library';
import { CsgSystem } from '@/engine/geometry/csg/csg-system';
import { syncTerrainMaterialFromDocument } from '@/engine/editor/operations/material-library-operations';
import { setGhostOpacity } from '@/engine/editor/csg/brush-ghost-materials';
import { ViewportCapture } from '@/engine/editor/viewport/viewport-capture';
import { ViewportGovernor } from '@/engine/editor/viewport/viewport-governor';
import { projectRecordOf, type ProjectContext } from '@/engine/project/project-context';
import { ProjectAutosave } from '@/engine/project/project-autosave';
import { DEFAULT_PROJECT_NAME, normalizeProjectName } from '@/engine/project/project-record';
import { EditorLog } from './editor-log';
import { SceneResources } from './scene-resources';
import { createRenderSettings, type PostCompareSettings, type RenderSettings } from './render-settings';
import { createCsgPreferences, type CsgPreferences } from './csg-preferences';
import { IMAGE_TOPICS, type NotifyOptions, type SessionTopic } from './session-topics';
export type { NotifyOptions, SessionTopic } from './session-topics';
export type TransformTool = 'select' | 'translate' | 'rotate' | 'scale' | 'terrain';
export type TransformSpace = 'global' | 'local';
export type EditorWorkspace = 'scene' | 'gui' | 'code';
export interface GizmoInteraction {
    hovered: GizmoHandle | null;
    active: GizmoHandle | null;
}
export type TransformInterceptor = (entity: Entity, before: TransformSnapshot, after: TransformSnapshot) => boolean;
export interface SnapSettings {
    enabled: boolean;
    translate: number;
    rotate: number;
    scale: number;
}
export interface ViewportStats extends FrameStats {
    fps: number;
    idle: boolean;
}
type Listener = () => void;
const focusCenter = vec3.create();
const focusBounds = aabb.create();
const HISTORY_ONLY: readonly SessionTopic[] = ['history'];
const SCENE_ONLY: readonly SessionTopic[] = ['scene'];
const PLAY_UI_INTERVAL_MS = 100;
export interface EditorSessionOptions {
    scene: Scene;
    project: ProjectContext;
}
export class EditorSession {
    readonly scene: Scene;
    readonly project: ProjectContext;
    readonly camera = new PerspectiveCamera();
    readonly orbit: OrbitController;
    readonly history = new History((command) => {
        const scope = command?.scope ?? 'scene';
        this.emit(scope === 'history' ? HISTORY_ONLY : [scope, 'history'], command?.image ?? IMAGE_TOPICS.has(scope));
    }, {
        isDragging: () => this.pointerDragging,
        onLiveChange: (command) => {
            if (command.image ?? IMAGE_TOPICS.has(command.scope ?? 'scene')) {
                this.sceneVersion++;
                this.selectedCache = null;
            }
            this.notifyLiveEdit();
        },
    });
    readonly log = new EditorLog(() => this.notify('log'));
    readonly resources = new SceneResources(() => this.notify('resources'));
    readonly materials: MaterialLibrary;
    readonly library: AssetLibrary;
    readonly autosave: ProjectAutosave;
    readonly capture = new ViewportCapture();
    readonly viewportGovernor = new ViewportGovernor();
    readonly playtest = new PlaytestController(this);
    readonly terrain = new TerrainEditor(this);
    readonly animation = new AnimationEditor(this);
    readonly audio = new AudioEditor(this);
    readonly gui = new GuiDesigner(this);
    readonly guiWorld = new GuiWorldHost(this);
    readonly vfx = new VfxEditor(this);
    readonly vfxWorld = new VfxWorldHost(this);
    readonly hud = new PlaytestHud(this);
    readonly code = new CodeEditor(this);
    readonly scripts = new ScriptRuntime(this);
    readonly shaderPreview = new ShaderPreview(this);
    workspace: EditorWorkspace = 'scene';
    readonly transformInterceptors = new Set<TransformInterceptor>();
    readonly colorPicker = new ViewportColorPicker(() => this.notify('view'));
    readonly csg = new CsgSystem();
    readonly csgPreferences: CsgPreferences = createCsgPreferences();
    selectedId: number | null = null;
    readonly selectedIds = new Set<number>();
    clipboard: Entity[] = [];
    viewportCanvas: HTMLCanvasElement | null = null;
    viewportRenderer: Renderer | null = null;
    frameGovernor: FrameGovernor | null = null;
    frameClock: FrameClock | null = null;
    readonly frameProfile = new FrameProfile();
    skyDrivesSun = true;
    viewportReady = false;
    showGrid = false;
    shadowsEnabled = true;
    tool: TransformTool = 'select';
    space: TransformSpace = 'global';
    focusPadding = 1.1;
    readonly snap: SnapSettings = { enabled: false, translate: 0.5, rotate: 15, scale: 0.1 };
    readonly gizmo: GizmoInteraction = { hovered: null, active: null };
    readonly stats: ViewportStats = { ...createFrameStats(), fps: 0, idle: false };
    readonly render: RenderSettings = createRenderSettings();
    private version = 0;
    private readonly listeners = new Set<Listener>();
    private sceneVersion = 0;
    private readonly topicListeners = new Map<SessionTopic, Set<Listener>>();
    private readonly topicVersions = new Map<SessionTopic, number>();
    private statsVersion = 0;
    private readonly statsListeners = new Set<Listener>();
    private liveEditVersion = 0;
    private readonly liveEditListeners = new Set<Listener>();
    private liveEditFrame = 0;
    private pointerDragging = false;
    private selectedCache: Entity | null = null;
    private readonly disposers: Array<() => void> = [];
    constructor(options: EditorSessionOptions) {
        this.scene = options.scene;
        this.project = options.project;
        this.materials = options.project.materials;
        this.library = options.project.library;
        this.autosave = new ProjectAutosave(this);
        this.orbit = new OrbitController(this.camera);
        this.log.info('Editor', 'Editor pronto.');
        this.csg.onRebuilt(() => this.notify('scene'));
        this.subscribeTopic(['selection', 'scene'], () => this.animation.syncSelection());
        this.subscribeTopic(['assets', 'scene'], () => this.audio.syncWithLibrary());
        this.subscribeTopic('assets', () => syncGuiDesignerWithLibrary(this));
        this.subscribeTopic(['assets', 'scene'], () => syncVfxEditorWithLibrary(this));
        this.subscribeTopic('assets', () => syncCodeEditorWithLibrary(this));
        this.subscribeTopic(['assets', 'scene', 'playtest'], () => this.shaderPreview.sync());
        this.audio.applyMixer();
        this.disposers.push(this.materials.addSyncListener((document) => syncTerrainMaterialFromDocument(this, document)));
        this.disposers.push(this.project.registry.subscribe(() => this.notify('project')));
        if (typeof window !== 'undefined') {
            const flushLibraries = () => {
                this.materials.flush();
                this.library.flush();
            };
            window.addEventListener('pagehide', flushLibraries);
            this.disposers.push(() => window.removeEventListener('pagehide', flushLibraries));
            this.trackPointerDrags();
        }
    }
    private trackPointerDrags(): void {
        const begin = (event: PointerEvent) => {
            if (!event.isPrimary || event.target === this.viewportCanvas)
                return;
            this.pointerDragging = true;
            this.viewportGovernor.setPointerHeld(true);
        };
        const end = () => {
            this.viewportGovernor.setPointerHeld(false);
            if (!this.pointerDragging && !this.history.liveEditPending)
                return;
            this.pointerDragging = false;
            this.history.endLive();
        };
        window.addEventListener('pointerdown', begin, { capture: true, passive: true });
        window.addEventListener('pointerup', end, { capture: true, passive: true });
        window.addEventListener('pointercancel', end, { capture: true, passive: true });
        window.addEventListener('blur', end);
        this.disposers.push(() => {
            window.removeEventListener('pointerdown', begin, { capture: true });
            window.removeEventListener('pointerup', end, { capture: true });
            window.removeEventListener('pointercancel', end, { capture: true });
            window.removeEventListener('blur', end);
        });
    }
    get projectName(): string {
        return projectRecordOf(this.project)?.name ?? DEFAULT_PROJECT_NAME;
    }
    onDispose(dispose: () => void): void {
        this.disposers.push(dispose);
    }
    renameProject(name: string): void {
        const current = this.projectName;
        const next = normalizeProjectName(name);
        if (next === current)
            return;
        void this.project.registry.rename(this.project.id, next).then(() => this.log.info('Projeto', `Projeto renomeado para "${next}".`), () => this.log.error('Projeto', this.project.registry.error ?? 'Não foi possível renomear o projeto.'));
    }
    async dispose(): Promise<void> {
        this.scripts.stop();
        this.shaderPreview.stop();
        this.autosave.stop();
        if (this.autosave.dirty)
            await this.autosave.saveNow();
        this.materials.flush();
        this.library.flush();
        for (const dispose of this.disposers.splice(0))
            dispose();
        this.listeners.clear();
        this.topicListeners.clear();
        this.statsListeners.clear();
        this.liveEditListeners.clear();
        if (this.liveEditFrame !== 0)
            cancelAnimationFrame(this.liveEditFrame);
        await this.project.database.close();
    }
    attachViewport(canvas: HTMLCanvasElement | null): void {
        this.viewportCanvas = canvas;
        this.scripts.attachViewport(canvas);
    }
    markViewportReady(): void {
        if (this.viewportReady)
            return;
        this.viewportReady = true;
        this.notify('view');
    }
    setWorkspace(workspace: EditorWorkspace): void {
        if (this.workspace === workspace)
            return;
        if (this.code.standalone && workspace !== 'code')
            return;
        this.workspace = workspace;
        this.notify('workspace');
    }
    toggleWorkspace(): void {
        this.setWorkspace(this.workspace === 'gui' ? 'scene' : 'gui');
    }
    toggleCodeWorkspace(): void {
        this.setWorkspace(this.workspace === 'code' ? 'scene' : 'code');
    }
    private inTick = false;
    private readonly deferredTopics = new Set<SessionTopic>();
    private lastDeferredFlushAt = 0;
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    subscribeTopic(topics: SessionTopic | readonly SessionTopic[], listener: Listener): () => void {
        const list: readonly SessionTopic[] = typeof topics === 'string' ? [topics] : topics;
        for (const topic of list) {
            let set = this.topicListeners.get(topic);
            if (!set)
                this.topicListeners.set(topic, (set = new Set()));
            set.add(listener);
        }
        return () => {
            for (const topic of list)
                this.topicListeners.get(topic)?.delete(listener);
        };
    }
    getVersion = (): number => this.version;
    getSceneVersion = (): number => this.sceneVersion;
    getTopicVersion(topics: readonly SessionTopic[]): number {
        let total = 0;
        for (const topic of topics)
            total += this.topicVersions.get(topic) ?? 0;
        return total;
    }
    notify(topic: SessionTopic = 'scene', options?: NotifyOptions): void {
        this.emit(topic === 'scene' ? SCENE_ONLY : [topic], options?.image ?? IMAGE_TOPICS.has(topic));
    }
    private emit(topics: readonly SessionTopic[], image: boolean): void {
        this.version++;
        if (image) {
            this.sceneVersion++;
            this.selectedCache = null;
        }
        for (const topic of topics)
            this.topicVersions.set(topic, (this.topicVersions.get(topic) ?? 0) + 1);
        if (this.inTick && this.playtest.state === 'playing' && !topics.includes('playtest')) {
            for (const topic of topics)
                this.deferredTopics.add(topic);
            return;
        }
        if (this.deferredTopics.size > 0)
            this.flushDeferredNotifications(true);
        this.fire(topics);
    }
    private flushDeferredNotifications(force = false): void {
        if (this.deferredTopics.size === 0)
            return;
        const now = performance.now();
        if (!force && now - this.lastDeferredFlushAt < PLAY_UI_INTERVAL_MS)
            return;
        this.lastDeferredFlushAt = now;
        const topics = Array.from(this.deferredTopics);
        this.deferredTopics.clear();
        this.fire(topics);
    }
    private fire(topics: readonly SessionTopic[]): void {
        if (topics.length === 1) {
            const listeners = this.topicListeners.get(topics[0]);
            if (listeners)
                for (const listener of listeners)
                    listener();
        }
        else {
            const fired = new Set<Listener>();
            for (const topic of topics) {
                const listeners = this.topicListeners.get(topic);
                if (!listeners)
                    continue;
                for (const listener of listeners) {
                    if (fired.has(listener))
                        continue;
                    fired.add(listener);
                    listener();
                }
            }
        }
        for (const listener of this.listeners)
            listener();
    }
    subscribeStats = (listener: Listener): (() => void) => {
        this.statsListeners.add(listener);
        return () => this.statsListeners.delete(listener);
    };
    getStatsVersion = (): number => this.statsVersion;
    private notifyStats(): void {
        this.statsVersion++;
        for (const listener of this.statsListeners)
            listener();
    }
    subscribeLiveEdit = (listener: Listener): (() => void) => {
        this.liveEditListeners.add(listener);
        return () => this.liveEditListeners.delete(listener);
    };
    getLiveEditVersion = (): number => this.liveEditVersion;
    notifyLiveEdit(): void {
        if (this.liveEditFrame !== 0)
            return;
        this.liveEditFrame = requestAnimationFrame(() => {
            this.liveEditFrame = 0;
            this.liveEditVersion++;
            for (const listener of this.liveEditListeners)
                listener();
        });
    }
    select(entity: Entity | null): void {
        const nextId = entity?.id ?? null;
        if (nextId === this.selectedId && this.selectedIds.size === (nextId === null ? 0 : 1))
            return;
        this.selectedIds.clear();
        if (nextId !== null)
            this.selectedIds.add(nextId);
        this.selectedId = nextId;
        this.notify('selection');
        this.selectedCache = entity;
    }
    setSelection(entities: readonly Entity[], primary: Entity | null = entities[entities.length - 1] ?? null): void {
        this.selectedIds.clear();
        for (const entity of entities) {
            if (entity.parent)
                this.selectedIds.add(entity.id);
        }
        if (primary && !this.selectedIds.has(primary.id))
            primary = entities.find((entity) => this.selectedIds.has(entity.id)) ?? null;
        this.selectedId = primary?.id ?? null;
        this.notify('selection');
        this.selectedCache = primary;
    }
    toggleSelection(entity: Entity): void {
        if (!entity.parent)
            return;
        if (this.selectedIds.has(entity.id)) {
            this.selectedIds.delete(entity.id);
            if (this.selectedId === entity.id) {
                let last: number | null = null;
                for (const id of this.selectedIds)
                    last = id;
                this.selectedId = last;
            }
            this.notify('selection');
            return;
        }
        this.selectedIds.add(entity.id);
        this.selectedId = entity.id;
        this.notify('selection');
        this.selectedCache = entity;
    }
    selectAll(): void {
        const all: Entity[] = [];
        this.scene.traverse((entity) => {
            if (entity.parent)
                all.push(entity);
        });
        this.setSelection(all, all[0] ?? null);
    }
    isSelected(entity: Entity): boolean {
        return this.selectedIds.has(entity.id);
    }
    get selectedEntity(): Entity | null {
        if (this.selectedId === null)
            return null;
        const cached = this.selectedCache;
        if (cached && cached.id === this.selectedId && this.isAttached(cached))
            return cached;
        const entity = this.findById(this.selectedId);
        if (!entity) {
            this.selectedIds.delete(this.selectedId);
            this.selectedId = null;
        }
        this.selectedCache = entity;
        return entity;
    }
    selectedEntities(): Entity[] {
        if (this.selectedIds.size === 0)
            return [];
        const { scene } = this;
        const found: Entity[] = [];
        let missing: number[] | null = null;
        for (const id of this.selectedIds) {
            const entity = scene.findById(id);
            if (entity && entity.parent)
                found.push(entity);
            else
                (missing ??= []).push(id);
        }
        if (found.length > 1)
            found.sort((a, b) => scene.traversalOrder(a) - scene.traversalOrder(b));
        if (missing) {
            for (const id of missing)
                this.selectedIds.delete(id);
            if (this.selectedId !== null && !this.selectedIds.has(this.selectedId))
                this.selectedId = found[found.length - 1]?.id ?? null;
        }
        return found;
    }
    selectionRoots(): Entity[] {
        const selected = this.selectedEntities();
        return selected.filter((entity) => {
            for (let current = entity.parent; current; current = current.parent) {
                if (this.selectedIds.has(current.id))
                    return false;
            }
            return true;
        });
    }
    toggleGrid(): void {
        this.showGrid = !this.showGrid;
        this.notify('view');
    }
    toggleShadows(): void {
        this.shadowsEnabled = !this.shadowsEnabled;
        this.notify('view');
    }
    toggleFrustumCulling(): void {
        this.updateCulling({ frustumCulling: !this.render.culling.frustumCulling });
    }
    updateCulling(patch: Partial<CullingOptions>): void {
        Object.assign(this.render.culling, patch);
        this.notify('view');
    }
    updateLod(patch: Partial<LodSettings>): void {
        Object.assign(this.render.lod, patch);
        this.notify('view');
    }
    updateMyriad(patch: Partial<MyriadSettings>): void {
        Object.assign(this.render.myriad, patch);
        this.notify('view');
    }
    toggleTerrainMaterialCache(): void {
        this.render.terrain.materialCache = !this.render.terrain.materialCache;
        this.notify('view');
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
    updatePostProcess(patch: Partial<Pick<PostProcessSettings, 'enabled' | 'exposure' | 'toneMapper'>>): void {
        Object.assign(this.scene.postProcessing, patch);
        this.notify();
    }
    updatePostEffect<K extends PostProcessEffectKey>(effect: K, patch: Partial<PostProcessSettings[K]>): void {
        const target = this.scene.postProcessing[effect] as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(patch)) {
            const current = target[key];
            if (current instanceof Float32Array && value instanceof Float32Array)
                vec3.copy(current, value);
            else
                target[key] = value;
        }
        this.notify();
    }
    applyPostProcessPreset(presetId: string): void {
        const preset = findPostProcessPreset(presetId);
        if (!preset)
            return;
        assignPostProcessSettings(this.scene.postProcessing, preset.create());
        this.notify();
    }
    updatePostCompare(patch: Partial<PostCompareSettings>): void {
        Object.assign(this.render.postCompare, patch);
        this.notify('view');
    }
    setGpuProfiling(enabled: boolean): void {
        this.render.profileGpu = enabled;
    }
    setRenderOnDemand(enabled: boolean): void {
        if (this.render.renderOnDemand === enabled)
            return;
        this.render.renderOnDemand = enabled;
        this.notify('view');
    }
    tick(deltaSeconds: number, elapsedSeconds: number): boolean {
        this.inTick = true;
        this.frameProfile.begin('sync');
        try {
            const cycleAdvanced = advanceSkyCycle(this.scene.sky, deltaSeconds);
            if (cycleAdvanced && this.skyDrivesSun)
                syncSunLightToSky(this.scene);
            this.csg.update(this.scene, { deferHeavy: this.csgPreferences.deferHeavyWhileDragging && this.gizmo.active !== null });
            this.playtest.tick(deltaSeconds, elapsedSeconds);
            this.scripts.tickTool(deltaSeconds);
            this.terrain.tick(deltaSeconds);
            this.animation.tick(deltaSeconds);
            this.audio.world.tick(deltaSeconds);
            const soundAnimating = this.audio.world.animating && this.render.soundHelpers !== 'off' && this.playtest.state !== 'playing';
            const guiAnimating = this.guiWorld.tick(deltaSeconds, elapsedSeconds);
            const vfxAnimating = this.vfxWorld.tick(deltaSeconds);
            const hudAnimating = this.hud.tick(deltaSeconds);
            return cycleAdvanced || this.playtest.state === 'playing' || this.scripts.running || this.terrain.isStroking || this.animation.playing || soundAnimating || guiAnimating || vfxAnimating || hudAnimating;
        }
        finally {
            this.inTick = false;
            this.flushDeferredNotifications(this.playtest.state !== 'playing');
            this.frameProfile.end('sync');
        }
    }
    togglePerfHud(): void {
        this.render.perfHud = !this.render.perfHud;
        this.notify('view');
    }
    toggleCsgBrushes(): void {
        this.render.showCsgBrushes = !this.render.showCsgBrushes;
        this.notify('view');
    }
    setLightHelpers(mode: LightHelperMode): void {
        if (this.render.lightHelpers === mode)
            return;
        this.render.lightHelpers = mode;
        this.notify('view');
    }
    setSoundHelpers(mode: SoundHelperMode): void {
        if (this.render.soundHelpers === mode)
            return;
        this.render.soundHelpers = mode;
        this.notify('view');
    }
    setVfxHelpers(mode: VfxHelperMode): void {
        if (this.render.vfxHelpers === mode)
            return;
        this.render.vfxHelpers = mode;
        this.notify('view');
    }
    setSoloLight(id: number | null): void {
        if (this.render.soloLightId === id)
            return;
        this.render.soloLightId = id;
        this.notify('view');
    }
    updateCsgPreferences(patch: Partial<CsgPreferences>): void {
        Object.assign(this.csgPreferences, patch);
        if (patch.ghostOpacity !== undefined)
            setGhostOpacity(this.csgPreferences.ghostOpacity);
        this.notify('view');
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
        this.notify('tool');
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
        this.notify('tool');
    }
    toggleSpace(): void {
        this.setSpace(this.space === 'global' ? 'local' : 'global');
    }
    updateSnap(patch: Partial<SnapSettings>): void {
        Object.assign(this.snap, patch);
        this.notify('tool');
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
            const distance = (radius / Math.sin(degToRad(this.camera.fovDegrees) / 2)) * this.focusPadding;
            this.orbit.focus(focusCenter, distance);
        }
        this.notify('view');
    }
    focusSelected(): void {
        const entity = this.selectedEntity;
        if (entity)
            this.focusEntity(entity);
    }
    updateStats(frame: FrameStats, fps: number, idle: boolean): void {
        Object.assign(this.stats, frame);
        this.stats.fps = fps;
        this.stats.idle = idle;
        this.notifyStats();
    }
    private isAttached(entity: Entity): boolean {
        let current: Entity | null = entity;
        while (current.parent)
            current = current.parent;
        return current === this.scene.root;
    }
    findById(id: number): Entity | null {
        return this.scene.findById(id);
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
        return this.scene.entityCount;
    }
}
