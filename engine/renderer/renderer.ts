import { createContext, syncCanvasSize, type GL } from './gl/context';
import { detectCapabilities, type GlCapabilities } from './gl/capabilities';
import { FullscreenTriangle } from './gl/fullscreen-triangle';
import { GpuMeshCache } from './gl/gpu-mesh-cache';
import { GpuTextureCache } from './gl/gpu-texture-cache';
import { InstanceBuffer } from './gl/instance-buffer';
import { GpuTimer } from './gl/gpu-timer';
import { FRAME_STAGES, StageAverages } from './stats/frame-stages';
import { GridPass } from './passes/grid-pass';
import { GizmoPass, type GizmoRenderRequest } from './passes/gizmo-pass';
import { MeshPass } from './passes/mesh-pass';
import { ShadowPass, type ShadowMeshResolver } from './passes/shadow-pass';
import { TerrainPass, type TerrainBrushOverlay } from './passes/terrain-pass';
import { MESH_INSTANCE_LAYOUT } from './batching/mesh-batcher';
import { VisibleSet, type CullingOptions } from './culling/visible-set';
import { LodSystem } from './lod/lod-system';
import { MAX_LOD_LEVELS } from './lod/lod-chain';
import type { LodSettings } from './lod/lod-selector';
import { TerrainGpuCache } from './terrain/terrain-gpu-cache';
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
    selectedId: number | null;
    gizmo: GizmoRenderRequest | null;
    terrainBrush: TerrainBrushOverlay | null;
    elapsedSeconds: number;
    deltaSeconds: number;
    culling: CullingOptions;
    lod: LodSettings;
}
export interface FrameStats {
    drawCalls: number;
    triangles: number;
    width: number;
    height: number;
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
}
export function createFrameStats(): FrameStats {
    return {
        lodPerLevel: new Array<number>(MAX_LOD_LEVELS).fill(0),
        lodPending: 0,
        terrainTiles: 0,
        terrainTilesDrawn: 0,
        terrainDrawCalls: 0,
        terrainTriangles: 0,
        terrainPerLevel: new Array<number>(TILE_LEVELS).fill(0),
        drawCalls: 0,
        triangles: 0,
        width: 0,
        height: 0,
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
const SHADOW_MAP_SIZE = 2048;
export class Renderer {
    readonly gl: GL;
    readonly capabilities: GlCapabilities;
    readonly stats = createFrameStats();
    readonly textures: GpuTextureCache;
    private readonly triangle: FullscreenTriangle;
    private readonly meshes: GpuMeshCache;
    private readonly meshInstances: InstanceBuffer;
    private readonly visible = new VisibleSet();
    private readonly lod = new LodSystem();
    private readonly shadowMeshResolver: ShadowMeshResolver;
    private readonly terrainPatch: TerrainPatchGeometry;
    private readonly terrainGpu: TerrainGpuCache;
    private readonly terrainShadows: TerrainShadowRenderer;
    private readonly shadowPass: ShadowPass;
    private readonly terrainPass: TerrainPass;
    private readonly meshPass: MeshPass;
    private readonly gridPass: GridPass;
    private readonly gizmoPass: GizmoPass;
    private readonly sky: SkySystem;
    private readonly lighting = createFrameLighting();
    private readonly gpuTimer: GpuTimer;
    private readonly cpuStages = new StageAverages();
    constructor(readonly canvas: HTMLCanvasElement) {
        this.gl = createContext(canvas);
        this.capabilities = detectCapabilities(this.gl);
        const defines = hdrShaderDefines(this.capabilities);
        this.gpuTimer = new GpuTimer(this.gl);
        this.stats.gpuStageMs = this.gpuTimer.available ? this.gpuTimer.averages.ms : null;
        this.stats.cpuStageMs = this.cpuStages.ms;
        this.triangle = new FullscreenTriangle(this.gl);
        this.meshes = new GpuMeshCache(this.gl);
        this.textures = new GpuTextureCache(this.gl);
        this.meshInstances = new InstanceBuffer(this.gl, MESH_INSTANCE_LAYOUT);
        this.terrainPatch = new TerrainPatchGeometry(this.gl);
        this.terrainGpu = new TerrainGpuCache(this.gl);
        this.terrainShadows = new TerrainShadowRenderer(this.gl, this.terrainPatch, this.terrainGpu);
        this.shadowPass = new ShadowPass(this.gl, this.meshes, this.terrainShadows, SHADOW_MAP_SIZE);
        this.shadowMeshResolver = this.lod.createShadowResolver(this.shadowPass.binding);
        this.terrainPass = new TerrainPass(this.gl, this.terrainPatch, this.terrainGpu, defines);
        this.meshPass = new MeshPass(this.gl, this.meshes, this.textures, defines);
        this.gridPass = new GridPass(this.gl, this.triangle);
        this.gizmoPass = new GizmoPass(this.gl);
        this.sky = new SkySystem(this.gl, this.capabilities, this.triangle);
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
        const { gpuTimer, cpuStages } = this;
        let stageStart = started;
        camera.aspect = canvas.width / canvas.height;
        camera.updateMatrices();
        scene.updateWorldMatrices();
        collectFrameLighting(scene, lighting);
        visible.collect(scene, camera, canvas.height, options.culling);
        this.lod.beginFrame(options.lod);
        stageStart = this.endCpuStage(0, stageStart);
        gpuTimer.begin('sky');
        const skyFrame = this.sky.update(scene.sky, lighting, camera, canvas.width, canvas.height, options.deltaSeconds);
        stageStart = this.endCpuStage(1, stageStart);
        gpuTimer.begin('shadows');
        if (options.shadows && lighting.hasSun && lighting.sunCastShadows) {
            this.shadowPass.render({
                casters: visible.casters,
                terrainCasters: visible.terrainCasters,
                camera,
                lightDirection: skyFrame.shadowCasterDirection,
                resolveMesh: this.shadowMeshResolver,
                lod: options.lod,
            });
        }
        else {
            this.shadowPass.skip();
        }
        stageStart = this.endCpuStage(2, stageStart);
        gpuTimer.begin('meshes');
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(...CLEAR_COLOR);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const surfaceInput = {
            camera,
            lighting,
            shadow: this.shadowPass.binding,
            sky: this.sky.binding,
            fogDensity: fogDensityForSky(scene.sky.enabled, scene.sky.haze),
            selectedId: options.selectedId,
        };
        this.meshPass.prepare(visible, surfaceInput, this.meshInstances, this.lod.resolveMesh);
        this.meshPass.renderOpaque();
        stageStart = this.endCpuStage(3, stageStart);
        gpuTimer.begin('terrain');
        this.terrainPass.render(visible.terrains, {
            ...surfaceInput,
            brush: options.terrainBrush,
            frustum: options.culling.frustumCulling ? visible.frustum : null,
            pixelScale: visible.pixelScale,
            lod: options.lod,
        });
        this.terrainGpu.endFrame();
        stageStart = this.endCpuStage(4, stageStart);
        gpuTimer.begin('overlay');
        this.meshPass.renderTransparent();
        let drawCalls = this.sky.stats.drawCalls + this.shadowPass.stats.drawCalls + this.terrainPass.stats.drawCalls + this.meshPass.stats.drawCalls;
        drawCalls += this.sky.renderBackground(camera, canvas.width, canvas.height, options.elapsedSeconds);
        if (options.showGrid) {
            this.gridPass.render(camera);
            drawCalls++;
        }
        if (options.gizmo)
            drawCalls += this.gizmoPass.render(options.gizmo, camera);
        this.endCpuStage(5, stageStart);
        gpuTimer.endFrame();
        this.publishStats(drawCalls, skyFrame.cloudsEnabled, started);
    }
    private endCpuStage(index: number, stageStart: number): number {
        const now = performance.now();
        this.cpuStages.push(index, now - stageStart);
        return now;
    }
    private publishStats(drawCalls: number, cloudsEnabled: boolean, started: number): void {
        const { stats, canvas, visible } = this;
        stats.gpuMs = this.gpuTimer.available ? this.gpuTimer.averages.total() : 0;
        stats.drawCalls = drawCalls;
        stats.triangles = this.meshPass.stats.triangles + this.terrainPass.stats.triangles;
        stats.width = canvas.width;
        stats.height = canvas.height;
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
        stats.shadowDrawCalls = this.shadowPass.stats.drawCalls;
        stats.shadowTriangles = this.shadowPass.stats.triangles;
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
        stats.cpuMs = performance.now() - started;
    }
    dispose(): void {
        this.gpuTimer.dispose();
        this.lod.dispose();
        this.sky.dispose();
        this.gizmoPass.dispose();
        this.gridPass.dispose();
        this.meshPass.dispose();
        this.terrainPass.dispose();
        this.shadowPass.dispose();
        this.terrainShadows.dispose();
        this.terrainGpu.dispose();
        this.terrainPatch.dispose();
        this.textures.dispose();
        this.meshInstances.dispose();
        this.meshes.dispose();
        this.triangle.dispose();
    }
}
