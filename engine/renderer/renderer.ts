import { createContext, syncCanvasSize, type GL } from './gl/context';
import { detectCapabilities, type GlCapabilities, type GpuTier } from './gl/capabilities';
import { renderProfileForTier, type RenderProfile } from './quality/render-profile';
import { FullscreenTriangle } from './gl/fullscreen-triangle';
import { GpuMeshCache } from './gl/gpu-mesh-cache';
import { GpuTextureCache } from './gl/gpu-texture-cache';
import { GpuSkinCache } from './gl/gpu-skin-cache';
import { InstanceBuffer } from './gl/instance-buffer';
import { GpuTimer } from './gl/gpu-timer';
import { SceneRenderTarget } from './gl/scene-render-target';
import { ShaderCompileTracker } from './gl/shader-compile-tracker';
import { FRAME_STAGES, StageAverages, stageIndex, type FrameStage } from './stats/frame-stages';
import { GridPass } from './passes/grid-pass';
import { GizmoPass, type GizmoRenderRequest } from './passes/gizmo-pass';
import { SkeletonPass, type SkeletonOverlayRequest } from './passes/skeleton-pass';
import { MeshPass } from './passes/mesh-pass';
import { ShadowPass, type ShadowMeshResolver } from './passes/shadow-pass';
import { ShadowMaskPass } from './passes/shadow-mask-pass';
import { PostPass } from './passes/post-pass';
import { TerrainPass, type TerrainBrushOverlay } from './passes/terrain-pass';
import { GrassPass } from './passes/grass-pass';
import { WaterPass } from './passes/water-pass';
import { MESH_INSTANCE_LAYOUT } from './batching/mesh-batcher';
import { VisibleSet, type CullingOptions } from './culling/visible-set';
import { LodSystem } from './lod/lod-system';
import { MAX_LOD_LEVELS } from './lod/lod-chain';
import type { LodSettings } from './lod/lod-selector';
import { createMyriadFrameStats, MyriadSystem, type MyriadFrameStats } from './myriad/myriad-system';
import type { MyriadSettings } from './myriad/runtime/myriad-settings';
import { TerrainGpuCache } from './terrain/terrain-gpu-cache';
import { TerrainMaterialCache } from './terrain/terrain-material-cache';
import { TerrainPatchGeometry } from './terrain/terrain-patch-geometry';
import { TerrainShadowRenderer } from './terrain/terrain-shadow-renderer';
import { TILE_LEVELS } from '@/engine/terrain/chunks/terrain-tiles';
import { collectFrameLighting, createFrameLighting } from './lighting/frame-lighting';
import { fogDensityForSky } from './lighting/scene-lighting-uniforms';
import { hdrShaderDefines, SkySystem } from './sky/sky-system';
import type { PerspectiveCamera } from './camera/perspective-camera';
import type { Scene } from '@/engine/core/scene/scene';
export interface RenderOptions {
    showGrid: boolean;
    shadows: boolean;
    selection: ReadonlySet<number> | null;
    showCsgBrushes: boolean;
    gizmo: GizmoRenderRequest | null;
    skeletons: SkeletonOverlayRequest | null;
    terrainBrush: TerrainBrushOverlay | null;
    elapsedSeconds: number;
    deltaSeconds: number;
    culling: CullingOptions;
    lod: LodSettings;
    myriad: MyriadSettings;
    terrainMaterialCache: boolean;
}
export interface FrameStats {
    drawCalls: number;
    triangles: number;
    myriad: MyriadFrameStats;
    width: number;
    height: number;
    pixelRatio: number;
    gpuName: string;
    gpuTier: GpuTier;
    softwareRenderer: boolean;
    shadersPending: number;
    shadersTotal: number;
    cloudWidth: number;
    cloudHeight: number;
    cpuMs: number;
    cpuStageMs: Float32Array;
    gpuStageMs: Float32Array | null;
    gpuMs: number;
    meshCandidates: number;
    meshesVisible: number;
    frustumCulled: number;
    sizeCulled: number;
    chunks: number;
    chunksCulled: number;
    instances: number;
    batches: number;
    shadowDrawCalls: number;
    shadowTriangles: number;
    lodPerLevel: number[];
    lodPending: number;
    terrainTiles: number;
    terrainTilesDrawn: number;
    terrainDrawCalls: number;
    terrainTriangles: number;
    terrainPerLevel: number[];
    terrainCacheBaked: number;
    terrainCachePending: number;
    terrainCacheLevels: number;
    terrainCacheMemoryBytes: number;
    grassBlades: number;
    grassChunks: number;
    grassPending: number;
    grassDrawCalls: number;
    grassInteractors: number;
    waterDrawCalls: number;
    waterTriangles: number;
}
export function createFrameStats(): FrameStats {
    return {
        myriad: createMyriadFrameStats(),
        lodPerLevel: new Array<number>(MAX_LOD_LEVELS).fill(0),
        lodPending: 0,
        terrainTiles: 0,
        terrainTilesDrawn: 0,
        terrainDrawCalls: 0,
        terrainTriangles: 0,
        terrainPerLevel: new Array<number>(TILE_LEVELS).fill(0),
        terrainCacheBaked: 0,
        terrainCachePending: 0,
        terrainCacheLevels: 0,
        terrainCacheMemoryBytes: 0,
        grassBlades: 0,
        grassChunks: 0,
        grassPending: 0,
        grassDrawCalls: 0,
        grassInteractors: 0,
        waterDrawCalls: 0,
        waterTriangles: 0,
        drawCalls: 0,
        triangles: 0,
        width: 0,
        height: 0,
        pixelRatio: 1,
        gpuName: '',
        gpuTier: 'mid',
        softwareRenderer: false,
        shadersPending: 0,
        shadersTotal: 0,
        cloudWidth: 0,
        cloudHeight: 0,
        cpuMs: 0,
        cpuStageMs: new Float32Array(FRAME_STAGES.length),
        gpuStageMs: null,
        gpuMs: 0,
        meshCandidates: 0,
        meshesVisible: 0,
        frustumCulled: 0,
        sizeCulled: 0,
        chunks: 0,
        chunksCulled: 0,
        instances: 0,
        batches: 0,
        shadowDrawCalls: 0,
        shadowTriangles: 0,
    };
}
const CLEAR_COLOR: [
    number,
    number,
    number,
    number
] = [0.118, 0.122, 0.133, 1];
export class Renderer {
    readonly gl: GL;
    readonly capabilities: GlCapabilities;
    readonly profile: RenderProfile;
    readonly stats = createFrameStats();
    readonly textures: GpuTextureCache;
    private readonly triangle: FullscreenTriangle;
    private readonly meshes: GpuMeshCache;
    private readonly skins: GpuSkinCache;
    private readonly meshInstances: InstanceBuffer;
    private readonly visible = new VisibleSet();
    private readonly lod = new LodSystem();
    private readonly myriad: MyriadSystem;
    private readonly shadowMeshResolver: ShadowMeshResolver;
    private readonly terrainPatch: TerrainPatchGeometry;
    private readonly terrainGpu: TerrainGpuCache;
    private readonly terrainCache: TerrainMaterialCache;
    private readonly terrainShadows: TerrainShadowRenderer;
    private readonly shadowPass: ShadowPass;
    private readonly shadowMaskPass: ShadowMaskPass;
    private readonly terrainPass: TerrainPass;
    private readonly grassPass: GrassPass;
    private readonly waterPass: WaterPass;
    private readonly meshPass: MeshPass;
    private readonly gridPass: GridPass;
    private readonly gizmoPass: GizmoPass;
    private readonly skeletonPass: SkeletonPass;
    private readonly postPass: PostPass;
    private readonly sceneTarget: SceneRenderTarget;
    private readonly sky: SkySystem;
    private readonly lighting = createFrameLighting();
    private readonly gpuTimer: GpuTimer;
    private readonly cpuStages = new StageAverages();
    private readonly shaders: ShaderCompileTracker;
    private shadersReady: boolean;
    constructor(readonly canvas: HTMLCanvasElement) {
        this.gl = createContext(canvas);
        this.shaders = ShaderCompileTracker.for(this.gl);
        this.capabilities = detectCapabilities(this.gl);
        this.profile = renderProfileForTier(this.capabilities.tier);
        this.stats.gpuName = this.capabilities.renderer;
        this.stats.gpuTier = this.capabilities.tier;
        this.stats.softwareRenderer = this.capabilities.software;
        const defines = hdrShaderDefines(this.capabilities);
        this.gpuTimer = new GpuTimer(this.gl);
        this.stats.gpuStageMs = this.gpuTimer.available ? this.gpuTimer.averages.ms : null;
        this.stats.cpuStageMs = this.cpuStages.ms;
        this.triangle = new FullscreenTriangle(this.gl);
        this.meshes = new GpuMeshCache(this.gl);
        this.skins = new GpuSkinCache(this.gl);
        this.textures = new GpuTextureCache(this.gl);
        this.meshInstances = new InstanceBuffer(this.gl, MESH_INSTANCE_LAYOUT);
        this.terrainPatch = new TerrainPatchGeometry(this.gl);
        this.terrainGpu = new TerrainGpuCache(this.gl);
        this.terrainCache = new TerrainMaterialCache(this.gl, this.triangle, this.terrainGpu, this.profile);
        this.terrainPass = new TerrainPass(this.gl, this.terrainPatch, this.terrainGpu, this.terrainCache, defines);
        this.terrainShadows = new TerrainShadowRenderer(this.gl, this.terrainPatch, this.terrainGpu, this.terrainPass.selector);
        this.shadowPass = new ShadowPass(this.gl, this.meshes, this.skins, this.terrainShadows, this.profile);
        this.shadowMeshResolver = this.lod.createShadowResolver(this.shadowPass.binding);
        this.sceneTarget = new SceneRenderTarget(this.gl);
        this.shadowMaskPass = new ShadowMaskPass(this.gl, this.triangle);
        this.postPass = new PostPass(this.gl, this.triangle, this.profile);
        this.grassPass = new GrassPass(this.gl, this.triangle, this.capabilities.floatColorTargets ? 'rgba16f' : 'rgba8', defines);
        this.waterPass = new WaterPass(this.gl, this.terrainGpu, defines);
        this.meshPass = new MeshPass(this.gl, this.meshes, this.textures, this.skins, defines);
        this.myriad = new MyriadSystem(this.gl, this.triangle, this.textures, defines);
        this.stats.myriad = this.myriad.stats;
        this.gridPass = new GridPass(this.gl, this.triangle);
        this.gizmoPass = new GizmoPass(this.gl);
        this.skeletonPass = new SkeletonPass(this.gl);
        this.sky = new SkySystem(this.gl, this.capabilities, this.triangle, this.profile);
        this.stats.shadersTotal = this.shaders.pendingCount;
        this.stats.shadersPending = this.stats.shadersTotal;
        this.shadersReady = this.stats.shadersTotal === 0;
        const { gl } = this;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
    }
    render(scene: Scene, camera: PerspectiveCamera, options: RenderOptions): void {
        const started = performance.now();
        const { gl, canvas, lighting, visible } = this;
        syncCanvasSize(canvas);
        if (!this.shadersReady) {
            const pending = this.shaders.poll();
            this.stats.shadersPending = pending;
            if (pending > 0) {
                this.renderWarmup(started);
                return;
            }
            this.shadersReady = true;
        }
        const { gpuTimer, cpuStages } = this;
        let stageStart = started;
        camera.aspect = canvas.width / canvas.height;
        camera.updateMatrices();
        scene.updateWorldMatrices();
        collectFrameLighting(scene, lighting);
        visible.collect(scene, camera, canvas.height, options.culling, options.showCsgBrushes);
        this.lod.beginFrame(options.lod);
        this.myriad.beginFrame(options.myriad, this.profile.myriadActivationTriangles);
        this.myriad.collect({ visible, camera, frustum: options.culling.frustumCulling ? visible.frustum : null, selection: options.selection });
        stageStart = this.endCpuStage('cull', stageStart);
        gpuTimer.begin('sky');
        const skyFrame = this.sky.update(scene.sky, lighting, camera, canvas.width, canvas.height, options.deltaSeconds);
        stageStart = this.endCpuStage('sky', stageStart);
        gpuTimer.begin('shadows');
        if (options.shadows && lighting.hasSun && lighting.sunCastShadows) {
            this.shadowPass.render({
                casters: visible.casters,
                terrainCasters: visible.terrainCasters,
                camera,
                lightDirection: skyFrame.shadowCasterDirection,
                resolveMesh: this.shadowMeshResolver,
                lod: options.lod,
                virtualGeometry: this.myriad,
            });
        }
        else {
            this.shadowPass.skip();
        }
        this.grassPass.updateTrample(scene, options.deltaSeconds);
        stageStart = this.endCpuStage('shadows', stageStart);
        const { sceneTarget } = this;
        sceneTarget.resize(canvas.width, canvas.height);
        sceneTarget.bind();
        gl.clearColor(...CLEAR_COLOR);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const frustum = options.culling.frustumCulling ? visible.frustum : null;
        const surfaceInput = {
            camera,
            lighting,
            shadowMask: this.shadowMaskPass.binding,
            sky: this.sky.binding,
            fogDensity: fogDensityForSky(scene.sky.enabled, scene.sky.haze),
            selection: options.selection,
        };
        const terrainInput = { ...surfaceInput, brush: options.terrainBrush, frustum, pixelScale: visible.pixelScale, lod: options.lod };
        gpuTimer.begin('prepass');
        this.meshPass.prepare(visible, surfaceInput, this.meshInstances, this.lod.resolveMesh);
        this.meshPass.renderDepth();
        this.terrainPass.prepare(visible.terrains, terrainInput);
        this.terrainPass.renderDepth(terrainInput);
        stageStart = this.endCpuStage('prepass', stageStart);
        gpuTimer.begin('virtual');
        this.myriad.renderVisibility(camera, sceneTarget.depth, canvas.width, canvas.height);
        sceneTarget.bind();
        stageStart = this.endCpuStage('virtual', stageStart);
        gpuTimer.begin('mask');
        let drawCalls = 0;
        const shadowBinding = this.shadowPass.binding;
        const skyBinding = this.sky.binding;
        if ((shadowBinding.active || skyBinding.cloudShadow.enabled) && camera.invertible) {
            drawCalls += this.shadowMaskPass.render({ camera, depth: sceneTarget.depth, shadow: shadowBinding, sky: skyBinding, lightDirection: skyFrame.shadowCasterDirection }, canvas.width, canvas.height);
            sceneTarget.bind();
        }
        else {
            this.shadowMaskPass.skip();
        }
        stageStart = this.endCpuStage('mask', stageStart);
        gpuTimer.begin('meshes');
        drawCalls += this.myriad.resolve(surfaceInput);
        this.meshPass.renderOpaque();
        stageStart = this.endCpuStage('meshes', stageStart);
        gpuTimer.begin('terrain');
        this.terrainCache.update(visible.terrains, camera.position, visible.pixelScale, options.terrainMaterialCache);
        sceneTarget.bind();
        this.terrainPass.render(terrainInput);
        this.grassPass.render(visible.terrains, { ...surfaceInput, frustum, pixelScale: visible.pixelScale, elapsedSeconds: options.elapsedSeconds });
        stageStart = this.endCpuStage('terrain', stageStart);
        gpuTimer.begin('overlay');
        drawCalls += this.sky.renderBackground(camera, canvas.width, canvas.height, options.elapsedSeconds);
        this.waterPass.render(visible.terrains, { ...surfaceInput, frustum, elapsedSeconds: options.elapsedSeconds, width: canvas.width, height: canvas.height });
        this.terrainGpu.endFrame();
        this.terrainCache.endFrame();
        if (meshesOn)
            this.meshPass.renderTransparent();
        scripts?.beforePass('guiSurface');
        if (guiOn)
            this.guiSurfacePass.renderTransparent(surfaceInput);
        if (scripts) {
            scripts.afterPass('guiSurface');
            sceneTarget.bind();
        }
        scripts?.beforePass('vfx');
        if (passOn('vfx')) {
            this.vfxPass.prepare(options.vfx ?? NO_VFX, camera, frustum);
            this.vfxPass.render({ ...surfaceInput, frustum, sceneTarget });
        }
        else {
            this.vfxPass.prepare(NO_VFX, camera, frustum);
        }
        if (scripts) {
            scripts.afterPass('vfx');
            sceneTarget.bind();
        }
        this.reflections.captureHistory(sceneTarget, camera);
        drawCalls += this.sky.stats.drawCalls + this.shadowPass.stats.drawCalls + this.terrainPass.stats.drawCalls + this.meshPass.stats.drawCalls;
        drawCalls += this.grassPass.stats.drawCalls + this.waterPass.stats.drawCalls + this.vfxPass.stats.drawCalls + this.reflections.stats.drawCalls;
        stageStart = this.endCpuStage('overlay', stageStart);
        if (warming && this.pauseWarmup('overlay', started))
            return;
        gpuTimer.begin('post');
        scripts?.beforePass('post');
        const scenePost = passOn('post') ? scene.postProcessing : { ...scene.postProcessing, enabled: false };
        const postSettings = options.editorLite || quality.postLite ? editorLitePost(this.litePost, scenePost) : scenePost;
        this.effectivePost = postSettings;
        this.postPass.resolve(sceneTarget, {
            camera,
            settings: postSettings,
            elapsedSeconds: options.elapsedSeconds,
            compareSplit: options.postCompareSplit ?? null,
        });
        const customPost = scripts && passOn('post') ? scripts.customPost : NO_CUSTOM_POST;
        if (customPost.length > 0) {
            this.customPost.render(customPost, this.postPass.overlayTarget, sceneTarget.depth, this.shaderInputs);
            drawCalls += this.customPost.stats.drawCalls;
            this.postPass.bindOverlayTarget();
        }
        else {
            this.customPost.settled = true;
        }
        if (scripts) {
            scripts.frame.hdr = false;
            scripts.afterPass('post');
            this.postPass.bindOverlayTarget();
        }
        stageStart = this.endCpuStage('post', stageStart);
        if (warming && this.pauseWarmup('post', started))
            return;
        gpuTimer.begin('editor');
        scripts?.beforePass('overlays');
        if (passOn('overlays')) {
            if (options.showGrid) {
                this.gridPass.render(camera);
                drawCalls++;
            }
            if (guiOn)
                this.guiSurfacePass.renderOverlay(camera);
            drawCalls += this.guiSurfacePass.stats.drawCalls;
            if (options.lightHelpers)
                drawCalls += this.lightHelperPass.render(scene, camera, options.lightHelpers);
            if (options.soundHelpers)
                drawCalls += this.soundHelperPass.render(scene, camera, options.soundHelpers);
            if (options.vfxHelpers)
                drawCalls += this.vfxHelperPass.render(scene, camera, options.vfxHelpers);
            if (options.skeletons && options.skeletons.rigs.length > 0)
                drawCalls += this.skeletonPass.render(options.skeletons, camera);
            if (options.gizmo)
                drawCalls += this.gizmoPass.render(options.gizmo, camera);
            drawCalls += this.myriad.renderDebugOverlay(camera, width, height);
        }
        if (scripts) {
            drawCalls += this.scriptDebugPass.render(scripts.debugLines, camera);
            scripts.afterPass('overlays');
            this.postPass.bindOverlayTarget();
        }
        stageStart = this.endCpuStage('editor', stageStart);
        if (warming && this.pauseWarmup('editor', started))
            return;
        gpuTimer.begin('final');
        const capture = options.capture ?? false;
        this.postPass.compose(postSettings, width, height, canvas.width, canvas.height, capture);
        this.frameCaptured = capture;
        drawCalls += this.postPass.stats.drawCalls;
        scripts?.after();
        this.endCpuStage('final', stageStart);
        if (warming)
            this.pauseWarmup('final', started);
        gpuTimer.endFrame();
        this.skins.endFrame();
        this.customPrograms.endFrame();
        this.publishStats(drawCalls, skyFrame.cloudsEnabled, started);
        const historyStale = this.reflections.stats.screenTraced && this.viewChangedLastFrame;
        const sceneSettled = !resized && !rescaled && !cameraMoved && !historyStale && this.frameSettled();
        this.viewChangedLastFrame = resized || rescaled || cameraMoved;
        this.lastSceneAnimating = !sceneSettled;
        this.stats.settled = sceneSettled && !this.reflections.capturing;
        this.stats.transient = resized || rescaled || this.didTransientWork();
    }
    private renderProbeFace(scene: Scene, camera: PerspectiveCamera, options: RenderOptions, skyFrame: SkyFrame, passes: ProbePasses): number {
        const { reflections, probeVisible, lighting } = this;
        const { probe } = reflections;
        const size = probe.size;
        const skyOn = skyFrame.enabled && passes.sky;
        const faceCamera = probe.beginFace(camera, skyOn ? null : SCENE_CLEAR_HDR, HDR_RANGE_SCENE);
        if (!faceCamera.invertible) {
            reflections.endProbeFace();
            return 0;
        }
        probeVisible.collect(scene, faceCamera, size, options.culling, false);
        const frustum = options.culling.frustumCulling ? probeVisible.frustum : null;
        const input = {
            camera: faceCamera,
            lighting,
            shadowMask: this.probeShadowMask.binding,
            shadow: this.shadowPass.binding,
            sky: this.sky.binding,
            localLights: this.probeLocalLightsBinding(),
            reflections: reflections.binding,
            fogDensity: fogDensityForSky(scene.sky.enabled, scene.sky.haze),
            selection: null,
        };
        const terrainInput = { ...input, brush: null, frustum, pixelScale: probeVisible.pixelScale, lod: options.lod };
        let drawCalls = 0;
        if (passes.meshes)
            this.meshPass.prepare(probeVisible, input, this.meshInstances, this.lod.resolveMesh);
        if (passes.terrain)
            this.terrainPass.prepare(probeVisible.terrains, terrainInput);
        if (passes.meshes)
            this.meshPass.renderDepth();
        if (passes.terrain)
            this.terrainPass.renderDepth(terrainInput);
        const shadowBinding = this.shadowPass.binding;
        const skyBinding = this.sky.binding;
        if (shadowBinding.active || skyBinding.cloudShadow.enabled) {
            drawCalls += this.probeShadowMask.render({ camera: faceCamera, depth: probe.depth, shadow: shadowBinding, sky: skyBinding, lightDirection: skyFrame.shadowCasterDirection }, size, size);
            probe.bindFace();
        }
        else {
            this.probeShadowMask.skip();
        }
        if (passes.meshes) {
            this.meshPass.renderOpaque();
            drawCalls += this.meshPass.stats.drawCalls;
        }
        if (passes.terrain) {
            this.terrainPass.render(terrainInput);
            drawCalls += this.terrainPass.stats.drawCalls;
        }
        if (skyOn)
            drawCalls += this.sky.renderProbeBackground(faceCamera, size, options.elapsedSeconds);
        reflections.endProbeFace();
        return drawCalls;
    }
    private probeLocalLightsBinding(): LocalLightsBinding {
        const data = this.localLights.binding;
        let binding = this.probeLocalLights;
        if (!binding) {
            binding = { data: { ...data, count: 0 }, shadow: this.localShadowPass.binding };
            this.probeLocalLights = binding;
        }
        binding.data.texture = data.texture;
        return binding;
    }
    private didTransientWork(): boolean {
        if (this.textures.stats.uploads > 0 || this.terrainGpu.stats.uploads > 0)
            return true;
        return this.grassPass.stats.pending > 0;
    }
    private pauseWarmup(stage: FrameStage, started: number): boolean {
        const index = stageIndex(stage);
        if (index < this.warmupStage)
            return false;
        if (stage === 'clouds' && this.sky.cloudsCompiling) {
            this.abandonFrame(stage, started);
            return true;
        }
        this.warmupStage = index + 1;
        this.stats.warmupStage = this.warmupStage;
        if (this.warmupStage >= FRAME_STAGES.length)
            return false;
        this.gl.finish();
        if (performance.now() - started < WARMUP_FRAME_BUDGET_MS)
            return false;
        this.abandonFrame(stage, started);
        return true;
    }
    private abandonFrame(stage: FrameStage, started: number): void {
        const { gl, stats } = this;
        this.gpuTimer.endFrame();
        this.skins.endFrame();
        if (stageIndex(stage) < stageIndex('overlay')) {
            this.terrainGpu.endFrame();
            this.terrainCache.endFrame();
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        stats.cpuMs = performance.now() - started;
        stats.settled = false;
        stats.transient = true;
    }
    private frameSettled(): boolean {
        if (!this.frameComplete)
            return false;
        if (this.visible.stats.boundsChanged > 0)
            return false;
        if (this.lod.stats.pending > 0)
            return false;
        if (this.shadowPass.stats.staticCascadesRendered > 0)
            return false;
        if (this.shadowPass.stats.cascadesPending > 0)
            return false;
        if (this.localShadowPass.stats.facesRendered > 0)
            return false;
        if (this.grassPass.stats.animated)
            return false;
        if (this.waterPass.stats.drawCalls > 0)
            return false;
        if (this.vfxPass.stats.particles > 0)
            return false;
        if (this.localLights.stats.animated > 0)
            return false;
        if (!this.sky.settled)
            return false;
        if (this.meshPass.stats.animatedShaders > 0 || !this.customPost.settled || this.customPrograms.pending > 0)
            return false;
        return this.effectivePost ? this.postPass.settled(this.effectivePost) : false;
    }
    get frameComplete(): boolean {
        if (!this.ready)
            return false;
        if (this.textures.stats.uploads > 0 || this.textures.stats.pending > 0)
            return false;
        if (this.terrainGpu.stats.uploads > 0 || this.terrainGpu.stats.pending > 0)
            return false;
        const myriad = this.myriad.stats;
        if (myriad.active && (myriad.buildPending > 0 || myriad.building !== '' || myriad.waiting > 0))
            return false;
        if (this.localShadowPass.stats.facesPostponed > 0)
            return false;
        const terrainCache = this.terrainCache.stats;
        if (terrainCache.baked > 0 || terrainCache.pending > 0)
            return false;
        return this.grassPass.stats.pending === 0;
    }
    inputsChanged(camera: PerspectiveCamera): boolean {
        if (this.canvasSize.resized)
            return true;
        const { canvas } = this;
        camera.aspect = canvas.width / canvas.height;
        camera.updateMatrices();
        return !this.cameraSnapshot.matches(0, camera.viewProjectionMatrix);
    }
    private renderWarmup(started: number): void {
        const { gl, canvas, stats } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(...CLEAR_COLOR);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        stats.width = canvas.width;
        stats.height = canvas.height;
        stats.pixelRatio = this.canvasSize.pixelRatio;
        stats.cpuMs = performance.now() - started;
        stats.settled = false;
        stats.transient = true;
    }
    private fillShaderInputs(camera: PerspectiveCamera, options: RenderOptions, width: number, height: number): void {
        const inputs = this.shaderInputs;
        inputs.time = options.elapsedSeconds;
        inputs.delta = options.deltaSeconds;
        inputs.width = width;
        inputs.height = height;
        inputs.near = camera.near;
        inputs.far = camera.far;
        inputs.view.set(camera.viewMatrix);
        inputs.projection.set(camera.projectionMatrix);
        inputs.viewProjection.set(camera.viewProjectionMatrix);
        inputs.inverseViewProjection.set(camera.inverseViewProjectionMatrix);
        inputs.cameraPosition.set(camera.position);
        inputs.sceneColor = null;
        inputs.sceneDepth = null;
    }
    private readonly reportShader = (message: string): void => {
        if (this.scriptRequest)
            this.scriptRequest.warn(message);
        else
            console.warn(`[helix] ${message}`);
    };
    private fillScriptFrame(frame: ScriptFrameTarget, camera: PerspectiveCamera, options: RenderOptions): void {
        const { canvas } = this;
        frame.gl = this.gl;
        frame.width = canvas.width;
        frame.height = canvas.height;
        frame.pixelRatio = this.canvasSize.pixelRatio;
        frame.elapsed = options.elapsedSeconds;
        frame.view.set(camera.viewMatrix);
        frame.projection.set(camera.projectionMatrix);
        frame.viewProjection.set(camera.viewProjectionMatrix);
        frame.cameraPosition.set(camera.position);
        frame.sceneColor = null;
        frame.sceneDepth = null;
        frame.hdr = true;
    }
    private renderScriptsOnly(scripts: ScriptRenderRequest, camera: PerspectiveCamera, started: number): void {
        const { gl, canvas, stats } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(...CLEAR_COLOR);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        scripts.frame.hdr = false;
        let drawCalls = 0;
        for (const pass of SCRIPT_RENDER_PASSES) {
            scripts.beforePass(pass);
            scripts.afterPass(pass);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        drawCalls += this.scriptDebugPass.render(scripts.debugLines, camera);
        scripts.after();
        this.gpuTimer.endFrame();
        this.skins.endFrame();
        this.terrainGpu.endFrame();
        this.customPrograms.endFrame();
        stats.drawCalls = drawCalls;
        stats.width = canvas.width;
        stats.height = canvas.height;
        stats.pixelRatio = this.canvasSize.pixelRatio;
        stats.cpuMs = performance.now() - started;
        stats.settled = false;
        stats.transient = false;
    }
    private endCpuStage(stage: FrameStage, stageStart: number): number {
        const now = performance.now();
        this.cpuStages.push(stageIndex(stage), now - stageStart);
        return now;
    }
    private publishStats(drawCalls: number, cloudsEnabled: boolean, started: number): void {
        const { stats, canvas, visible } = this;
        const timing = this.gpuTimer.enabled;
        stats.gpuStageMs = timing ? this.gpuTimer.averages.ms : null;
        stats.gpuMs = timing ? this.gpuTimer.averages.total() : 0;
        stats.drawCalls = drawCalls + this.myriad.stats.drawCalls;
        stats.triangles =
            this.meshPass.stats.triangles + this.terrainPass.stats.triangles + this.myriad.stats.triangles + this.grassPass.stats.triangles + this.waterPass.stats.triangles;
        const grass = this.grassPass.stats;
        stats.grassBlades = grass.blades;
        stats.grassChunks = grass.chunks;
        stats.grassPending = grass.pending;
        stats.grassDrawCalls = grass.drawCalls;
        stats.grassInteractors = grass.interactors;
        stats.waterDrawCalls = this.waterPass.stats.drawCalls;
        stats.waterTriangles = this.waterPass.stats.triangles;
        stats.vfxParticles = this.vfxPass.stats.particles;
        stats.vfxDrawCalls = this.vfxPass.stats.drawCalls;
        const reflections = this.reflections.stats;
        stats.reflectionProbeFaces = reflections.probeFaces;
        stats.reflectionProbeValid = this.reflections.binding.probeValid;
        stats.reflectionScreenTraced = reflections.screenTraced;
        stats.reflectionDrawCalls = reflections.drawCalls;
        stats.width = canvas.width;
        stats.height = canvas.height;
        stats.pixelRatio = this.canvasSize.pixelRatio;
        stats.renderScale = this.lastRenderScale;
        stats.cloudWidth = cloudsEnabled ? this.sky.stats.cloudWidth : 0;
        stats.cloudHeight = cloudsEnabled ? this.sky.stats.cloudHeight : 0;
        stats.meshCandidates = visible.stats.candidates;
        stats.meshesVisible = visible.stats.visible;
        stats.frustumCulled = visible.stats.frustumCulled;
        stats.sizeCulled = visible.stats.sizeCulled;
        stats.chunks = visible.stats.cells;
        stats.chunksCulled = visible.stats.cellsCulled;
        stats.instances = this.meshPass.stats.instances;
        stats.batches = this.meshPass.stats.batches;
        stats.shadowDrawCalls = this.shadowPass.stats.drawCalls + this.localShadowPass.stats.drawCalls;
        stats.shadowTriangles = this.shadowPass.stats.triangles + this.localShadowPass.stats.triangles;
        const localLights = this.localLights.stats;
        stats.localLights = localLights.visible;
        stats.localLightsCulled = localLights.culled;
        stats.localLightTilesLit = localLights.tilesLit;
        stats.localLightTiles = localLights.tiles;
        const localShadows = this.localShadowPass.stats;
        stats.localShadowFaces = localShadows.facesUsed;
        stats.localShadowRendered = localShadows.facesRendered;
        stats.localShadowPostponed = localShadows.facesPostponed;
        stats.localShadowDeferred = localShadows.lightsDeferred;
        stats.localShadowDrawCalls = localShadows.drawCalls;
        for (let level = 0; level < MAX_LOD_LEVELS; level++)
            stats.lodPerLevel[level] = this.lod.stats.perLevel[level];
        stats.lodPending = this.lod.stats.pending;
        const terrain = this.terrainPass.stats;
        stats.terrainTiles = terrain.tiles;
        stats.terrainTilesDrawn = terrain.drawn;
        stats.terrainDrawCalls = terrain.drawCalls;
        stats.terrainTriangles = terrain.triangles;
        for (let level = 0; level < TILE_LEVELS; level++)
            stats.terrainPerLevel[level] = terrain.perLevel[level];
        const cache = this.terrainCache.stats;
        stats.terrainCacheBaked = cache.baked;
        stats.terrainCachePending = cache.pending;
        stats.terrainCacheLevels = cache.levels;
        stats.terrainCacheMemoryBytes = cache.memoryBytes;
        stats.cpuMs = performance.now() - started;
    }
    dispose(): void {
        this.canvasSize.dispose();
        this.gpuTimer.dispose();
        this.lod.dispose();
        this.myriad.dispose();
        this.sky.dispose();
        this.customPost.dispose();
        this.customPrograms.dispose();
        this.postPass.dispose();
        this.scriptDebugPass.dispose();
        this.skeletonPass.dispose();
        this.lightHelperPass.dispose();
        this.soundHelperPass.dispose();
        this.gizmoPass.dispose();
        this.gridPass.dispose();
        this.guiSurfacePass.dispose();
        this.vfxPass.dispose();
        this.vfxHelperPass.dispose();
        this.meshPass.dispose();
        this.waterPass.dispose();
        this.grassPass.dispose();
        this.terrainPass.dispose();
        this.terrainCache.dispose();
        this.shadowMaskPass.dispose();
        this.probeShadowMask.dispose();
        this.reflections.dispose();
        this.sceneTarget.dispose();
        this.localShadowPass.dispose();
        this.localLights.dispose();
        this.shadowPass.dispose();
        this.terrainShadows.dispose();
        this.terrainGpu.dispose();
        this.terrainPatch.dispose();
        this.textures.dispose();
        this.meshInstances.dispose();
        this.skins.dispose();
        this.meshes.dispose();
        this.triangle.dispose();
    }
}
type LensEffectKey = 'depthOfField' | 'vignette' | 'chromaticAberration' | 'filmGrain';
type LiteEffectCache = {
    [K in LensEffectKey]: PostProcessSettings[K] | null;
};
interface LitePostCache {
    settings: PostProcessSettings | null;
    effects: LiteEffectCache;
}
function createLitePostSettings(): LitePostCache {
    return { settings: null, effects: { depthOfField: null, vignette: null, chromaticAberration: null, filmGrain: null } };
}
function disabledEffect<K extends LensEffectKey>(cache: LitePostCache, key: K, effect: PostProcessSettings[K]): PostProcessSettings[K] {
    const effects: LiteEffectCache = cache.effects;
    let copy = effects[key] as PostProcessSettings[K] | null;
    if (!copy) {
        copy = { ...effect };
        effects[key] = copy;
    }
    Object.assign(copy, effect);
    copy.enabled = false;
    return copy;
}
function editorLitePost(cache: LitePostCache, source: PostProcessSettings): PostProcessSettings {
    if (!source.enabled)
        return source;
    const { depthOfField, vignette, chromaticAberration, filmGrain } = source;
    if (!depthOfField.enabled && !vignette.enabled && !chromaticAberration.enabled && !filmGrain.enabled)
        return source;
    const lite = cache.settings ?? (cache.settings = { ...source });
    Object.assign(lite, source);
    if (depthOfField.enabled)
        lite.depthOfField = disabledEffect(cache, 'depthOfField', depthOfField);
    if (vignette.enabled)
        lite.vignette = disabledEffect(cache, 'vignette', vignette);
    if (chromaticAberration.enabled)
        lite.chromaticAberration = disabledEffect(cache, 'chromaticAberration', chromaticAberration);
    if (filmGrain.enabled)
        lite.filmGrain = disabledEffect(cache, 'filmGrain', filmGrain);
    return lite;
}
