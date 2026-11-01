import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Aabb } from '@/engine/core/math/aabb';
import type { GL } from '@/engine/renderer/gl/context';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines } from '@/engine/renderer/gl/shader-source';
import { DepthArrayRenderTarget } from '@/engine/renderer/gl/depth-array-render-target';
import type { GpuMeshCache } from '@/engine/renderer/gl/gpu-mesh-cache';
import { JOINT_MATRICES_TEXTURE_UNIT, type GpuSkinCache } from '@/engine/renderer/gl/gpu-skin-cache';
import { InstanceBuffer } from '@/engine/renderer/gl/instance-buffer';
import { SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER } from '@/engine/renderer/shaders/shadow-depth.glsl';
import { Frustum } from '@/engine/renderer/culling/frustum';
import type { ShadowCasterCandidate } from '@/engine/renderer/culling/visible-set';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
import { LOCAL_LIGHT_SHADOW_TEXTURE_UNIT } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { MAX_SHADOW_SLOTS } from '@/engine/renderer/lighting/local-light-layout';
import type { CollectedLocalLight, LocalLightSet } from '@/engine/renderer/lighting/local-light-set';
import { ShadowCasterMotion } from '@/engine/renderer/shadows/shadow-caster-set';
import { SHADOW_INSTANCE_LAYOUT, type ShadowGeometryHook, type ShadowMeshResolver } from './shadow-pass';
export interface LocalShadowBinding {
    texture: WebGLTexture;
    size: number;
}
export type LocalShadowState = 'rendered' | 'cached' | 'deferred';
export interface LocalShadowStats {
    facesBudget: number;
    facesPerFrame: number;
    facesUsed: number;
    facesRendered: number;
    facesPostponed: number;
    lightsShadowed: number;
    lightsDeferred: number;
    drawCalls: number;
    triangles: number;
    readonly status: Map<number, LocalShadowState>;
}
export interface LocalShadowPassInput {
    lights: LocalLightSet;
    casters: readonly ShadowCasterCandidate[];
    resolveMesh: ShadowMeshResolver;
    virtualGeometry: ShadowGeometryHook | null;
}
interface FaceState {
    drawn: boolean;
    staticSignature: number;
    dynamicSignature: number;
    finalHasDynamics: boolean;
    staticLayer: number;
    staticFrame: number;
    readonly dynamicRect: Int32Array;
    dynamicRectValid: boolean;
    frame: number;
    readonly slot: Float32Array;
}
interface CacheEntry {
    base: number;
    faces: number;
    frame: number;
    readonly states: FaceState[];
}
interface FaceJob {
    light: CollectedLocalLight;
    entry: CacheEntry;
    face: number;
    kind: 'static' | 'dynamic';
    staticSignature: number;
    dynamicSignature: number;
    hasDynamics: boolean;
    mandatory: boolean;
    priority: number;
}
interface FaceBatch {
    mesh: MeshData;
    firstInstance: number;
    readonly items: ShadowCasterCandidate[];
}
const MATRIX_FLOATS = 16;
const SLOT_FLOATS = 20;
const CUBE_FACE_FOV = (91 * Math.PI) / 180;
const SPOT_FOV_MARGIN = (4 * Math.PI) / 180;
const MAX_SPOT_FOV = (164 * Math.PI) / 180;
const CACHE_TTL_FRAMES = 120;
const SHADOW_LOD_CASCADE = 1;
const STATIC_CACHE_LAYERS = 12;
const DYNAMIC_MARGIN_TEXELS = 6;
const FULL_COPY_AREA_FRACTION = 0.5;
const BIAS_MATRIX = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);
const view = mat4.create();
const projection = mat4.create();
const viewProjection = mat4.create();
const shadowMatrix = mat4.create();
const target = vec3.create();
const direction = vec3.create();
const upAxis = vec3.create();
const toCaster = vec3.create();
const hashBuffer = new Float32Array(1);
const hashBits = new Uint32Array(hashBuffer.buffer);
function hashFloat(hash: number, value: number): number {
    hashBuffer[0] = value;
    return Math.imul(hash ^ hashBits[0], 16777619) | 0;
}
function compareJobs(a: FaceJob, b: FaceJob): number {
    if (a.mandatory !== b.mandatory)
        return a.mandatory ? -1 : 1;
    return b.priority - a.priority;
}
function faceBasis(light: CollectedLocalLight, face: number, outDirection: Vec3, outUp: Vec3): void {
    switch (face) {
        case 0:
            vec3.copy(outDirection, light.right);
            vec3.copy(outUp, light.up);
            break;
        case 1:
            vec3.scale(outDirection, light.right, -1);
            vec3.copy(outUp, light.up);
            break;
        case 2:
            vec3.copy(outDirection, light.up);
            vec3.copy(outUp, light.forward);
            break;
        case 3:
            vec3.scale(outDirection, light.up, -1);
            vec3.copy(outUp, light.forward);
            break;
        case 4:
            vec3.copy(outDirection, light.forward);
            vec3.copy(outUp, light.up);
            break;
        default:
            vec3.scale(outDirection, light.forward, -1);
            vec3.copy(outUp, light.up);
    }
}
export class LocalShadowPass {
    readonly binding: LocalShadowBinding;
    readonly stats: LocalShadowStats = {
        facesBudget: 0,
        facesPerFrame: 0,
        facesUsed: 0,
        facesRendered: 0,
        facesPostponed: 0,
        lightsShadowed: 0,
        lightsDeferred: 0,
        drawCalls: 0,
        triangles: 0,
        status: new Map(),
    };
    private readonly program: ShaderProgram;
    private readonly skinnedProgram: ShaderProgram;
    private readonly placeholder: DepthArrayRenderTarget;
    private atlas: DepthArrayRenderTarget | null = null;
    private staticAtlas: DepthArrayRenderTarget | null = null;
    private readonly staticOwners: (FaceState | null)[] = [];
    private readonly instances: InstanceBuffer;
    private readonly faceFrustum = new Frustum();
    private readonly motion = new ShadowCasterMotion();
    private readonly layers: number;
    private readonly staticLayers: number;
    private readonly size: number;
    private readonly profileFacesPerFrame: number;
    private facesPerFrame: number;
    private readonly owners: Int32Array;
    private readonly cache = new Map<number, CacheEntry>();
    private readonly inRangeStatic: ShadowCasterCandidate[] = [];
    private readonly inRangeDynamic: ShadowCasterCandidate[] = [];
    private readonly faceStatic: ShadowCasterCandidate[] = [];
    private readonly faceDynamic: ShadowCasterCandidate[] = [];
    private readonly jobs: FaceJob[] = [];
    private readonly jobPool: FaceJob[] = [];
    private readonly batches: FaceBatch[] = [];
    private readonly skinned: ShadowCasterCandidate[] = [];
    private readonly virtual: ShadowCasterCandidate[] = [];
    private readonly byMesh = new Map<MeshData, FaceBatch>();
    private readonly batchPool: FaceBatch[] = [];
    private readonly rectScratch = new Int32Array(4);
    private readonly unionScratch = new Int32Array(4);
    private readonly rectAccumulator = new Float64Array(4);
    private near = 0;
    private far = 0;
    private fov = 0;
    private texelScale = 0;
    private frame = 0;
    constructor(private readonly gl: GL, private readonly meshes: GpuMeshCache, private readonly skins: GpuSkinCache, profile: RenderProfile) {
        this.program = new ShaderProgram(gl, SHADOW_DEPTH_VERTEX_SHADER, SHADOW_DEPTH_FRAGMENT_SHADER);
        this.skinnedProgram = new ShaderProgram(gl, withDefines(SHADOW_DEPTH_VERTEX_SHADER, { SKINNED: true }), SHADOW_DEPTH_FRAGMENT_SHADER);
        this.instances = new InstanceBuffer(gl, SHADOW_INSTANCE_LAYOUT);
        this.placeholder = new DepthArrayRenderTarget(gl, 1, 1);
        this.layers = Math.min(profile.localShadowFaces, MAX_SHADOW_SLOTS);
        this.staticLayers = Math.min(this.layers, STATIC_CACHE_LAYERS);
        this.size = profile.localShadowMapSize;
        this.profileFacesPerFrame = Math.max(1, profile.localShadowFacesPerFrame);
        this.facesPerFrame = this.profileFacesPerFrame;
        this.owners = new Int32Array(this.layers).fill(-1);
        this.binding = { texture: this.placeholder.texture, size: 1 };
        this.stats.facesBudget = this.layers;
        this.stats.facesPerFrame = this.facesPerFrame;
    }
    setFacesPerFrameScale(scale: number): void {
        const faces = Math.max(1, Math.round(this.profileFacesPerFrame * scale));
        if (faces === this.facesPerFrame)
            return;
        this.facesPerFrame = faces;
        this.stats.facesPerFrame = faces;
    }
    maxShadowedLights = Number.POSITIVE_INFINITY;
}
