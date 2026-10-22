import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import type { Material } from '@/engine/core/scene/material';
import { MATERIAL_MAP_SLOTS } from '@/engine/renderer/batching/material-state';
import { createBox, createCapsule, createCylinder, createPlane, createSphere, createTorus } from '@/engine/renderer/geometry/primitives';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { syncCanvasSize, WebGLUnsupportedError, type GL } from '@/engine/renderer/gl/context';
import { GpuMesh } from '@/engine/renderer/gl/gpu-mesh';
import { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { PREVIEW_FRAGMENT_SHADER, PREVIEW_VERTEX_SHADER } from './preview-shader.glsl';
import type { PreviewLighting, PreviewSettings, PreviewShape } from './preview-settings';
interface LightingRig {
    key: Vec3;
    fill: Vec3;
    rim: Vec3;
    sky: Vec3;
    ground: Vec3;
}
const LIGHTING_RIGS: Record<PreviewLighting, LightingRig> = {
    studio: { key: vec3.create(3.2, 3.1, 3.0), fill: vec3.create(0.7, 0.75, 0.9), rim: vec3.create(1.6, 1.6, 1.7), sky: vec3.create(0.34, 0.36, 0.4), ground: vec3.create(0.1, 0.1, 0.11) },
    daylight: { key: vec3.create(4.2, 3.9, 3.4), fill: vec3.create(0.45, 0.6, 0.9), rim: vec3.create(0.6, 0.65, 0.7), sky: vec3.create(0.5, 0.66, 0.95), ground: vec3.create(0.26, 0.22, 0.17) },
    sunset: { key: vec3.create(3.4, 1.7, 0.7), fill: vec3.create(0.3, 0.3, 0.6), rim: vec3.create(1.1, 0.5, 0.3), sky: vec3.create(0.4, 0.26, 0.36), ground: vec3.create(0.14, 0.09, 0.07) },
    night: { key: vec3.create(0.6, 0.7, 1.1), fill: vec3.create(0.1, 0.12, 0.25), rim: vec3.create(0.5, 0.55, 0.8), sky: vec3.create(0.03, 0.045, 0.1), ground: vec3.create(0.012, 0.012, 0.02) },
};
const SHAPE_BOUNDING_RADIUS: Record<PreviewShape, number> = { sphere: 0.5, cube: 0.78, plane: 0.92, cylinder: 0.64, torus: 0.63, capsule: 0.58 };
const FIELD_OF_VIEW_DEGREES = 32;
const FRAMING_MARGIN = 1.3;
const TEXTURE_UNIFORMS = ['u_baseColorMap', 'u_metallicRoughnessMap', 'u_normalMap', 'u_occlusionMap', 'u_emissiveMap'] as const;
const ALPHA_MODE_VALUE = { opaque: 0, mask: 1, blend: 2 } as const;
const AUTO_ROTATE_SPEED = 0.35;
function buildShape(shape: PreviewShape): MeshData {
    switch (shape) {
        case 'sphere':
            return createSphere(0.5, 64, 32);
        case 'cube':
            return createBox(0.9, 0.9, 0.9);
        case 'plane':
            return createPlane(1.3, 1.3, 1);
        case 'cylinder':
            return createCylinder(0.42, 0.95, 48);
        case 'torus':
            return createTorus(0.44, 0.19, 72, 36);
        case 'capsule':
            return createCapsule(0.3, 0.55, 48, 12);
    }
}
export class MaterialPreviewRenderer {
    private readonly gl: GL;
    private readonly program: ShaderProgram;
    private readonly textures: GpuTextureCache;
    private readonly meshes = new Map<PreviewShape, GpuMesh>();
    private readonly model = mat4.create();
    private readonly view = mat4.create();
    private readonly projection = mat4.create();
    private readonly viewProjection = mat4.create();
    private readonly normalMatrix = mat3.create();
    private readonly eye = vec3.create();
    private readonly lightDirections = new Float32Array(9);
    private readonly lightColors = new Float32Array(9);
    private spin = 0;
    private lastTime = 0;
    yaw = 28;
    pitch = 18;
    zoom = 1;
    constructor(private readonly canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, depth: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
        if (!gl)
            throw new WebGLUnsupportedError();
        this.gl = gl;
        this.program = new ShaderProgram(gl, PREVIEW_VERTEX_SHADER, PREVIEW_FRAGMENT_SHADER);
        this.textures = new GpuTextureCache(gl);
    }
    orbit(deltaYawDegrees: number, deltaPitchDegrees: number): void {
        this.yaw = (this.yaw + deltaYawDegrees) % 360;
        this.pitch = clamp(this.pitch + deltaPitchDegrees, -85, 85);
    }
    dolly(factor: number): void {
        this.zoom = clamp(this.zoom * factor, 0.5, 3);
    }
    resetCamera(): void {
        this.yaw = 28;
        this.pitch = 18;
        this.zoom = 1;
        this.spin = 0;
    }
    render(material: Material, settings: PreviewSettings, timeMs: number): void {
        const { gl, canvas } = this;
        syncCanvasSize(canvas);
        const width = canvas.width;
        const height = canvas.height;
        const delta = this.lastTime > 0 ? Math.min((timeMs - this.lastTime) / 1000, 0.1) : 0;
        this.lastTime = timeMs;
        if (settings.autoRotate)
            this.spin += delta * AUTO_ROTATE_SPEED;
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        if (material.doubleSided)
            gl.disable(gl.CULL_FACE);
        else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
        }
        if (material.alphaMode === 'blend') {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
        }
        else {
            gl.disable(gl.BLEND);
            gl.depthMask(true);
        }
        this.updateCamera(settings.shape, width / height);
        this.updateModel(settings.shape);
        this.updateLights(settings);
        const { program } = this;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_model'), false, this.model);
        gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, this.viewProjection);
        gl.uniformMatrix3fv(program.uniform('u_normalMatrix'), false, this.normalMatrix);
        gl.uniform3fv(program.uniform('u_cameraPosition'), this.eye);
        gl.uniform1f(program.uniform('u_uvTiling'), material.uvTiling);
        gl.uniform4f(program.uniform('u_baseColorOpacity'), material.baseColor[0], material.baseColor[1], material.baseColor[2], material.opacity);
        gl.uniform2f(program.uniform('u_roughnessMetallic'), material.roughness, material.metallic);
        gl.uniform3fv(program.uniform('u_emissive'), material.emissive);
        gl.uniform1f(program.uniform('u_emissiveIntensity'), material.emissiveIntensity);
        gl.uniform1f(program.uniform('u_normalScale'), material.normalScale);
        gl.uniform1f(program.uniform('u_occlusionStrength'), material.occlusionStrength);
        gl.uniform1f(program.uniform('u_alphaCutoff'), material.alphaCutoff);
        gl.uniform1f(program.uniform('u_alphaMode'), ALPHA_MODE_VALUE[material.alphaMode]);
        gl.uniform3fv(program.uniform('u_lightDirections[0]'), this.lightDirections);
        gl.uniform3fv(program.uniform('u_lightColors[0]'), this.lightColors);
        const rig = LIGHTING_RIGS[settings.lighting];
        gl.uniform3fv(program.uniform('u_skyColor'), rig.sky);
        gl.uniform3fv(program.uniform('u_groundColor'), rig.ground);
        gl.uniform1f(program.uniform('u_exposure'), settings.exposure);
        let mask = 0;
        MATERIAL_MAP_SLOTS.forEach((slot, index) => {
            const texture = material[slot];
            const handle = texture ? this.textures.resolve(texture) : null;
            gl.activeTexture(gl.TEXTURE0 + index);
            gl.bindTexture(gl.TEXTURE_2D, handle ?? (slot === 'normalMap' ? this.textures.flatNormal : this.textures.white));
            gl.uniform1i(program.uniform(TEXTURE_UNIFORMS[index]), index);
            if (handle)
                mask |= 1 << index;
        });
        gl.uniform1i(program.uniform('u_textureMask'), mask);
        this.mesh(settings.shape).draw();
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
    dispose(): void {
        for (const mesh of this.meshes.values())
            mesh.dispose();
        this.meshes.clear();
        this.textures.dispose();
        this.program.dispose();
    }
    private mesh(shape: PreviewShape): GpuMesh {
        let mesh = this.meshes.get(shape);
        if (!mesh) {
            mesh = new GpuMesh(this.gl, buildShape(shape));
            this.meshes.set(shape, mesh);
        }
        return mesh;
    }
    private updateCamera(shape: PreviewShape, aspect: number): void {
        const safeAspect = Math.max(aspect, 1e-3);
        const halfFov = degToRad(FIELD_OF_VIEW_DEGREES) / 2;
        const fitDistance = (SHAPE_BOUNDING_RADIUS[shape] / Math.sin(halfFov)) * FRAMING_MARGIN;
        const distance = (safeAspect < 1 ? fitDistance / safeAspect : fitDistance) * this.zoom;
        const yaw = degToRad(this.yaw);
        const pitch = degToRad(this.pitch);
        vec3.set(this.eye, Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance);
        mat4.lookAt(this.view, this.eye, vec3.create(0, 0, 0), vec3.create(0, 1, 0));
        mat4.perspective(this.projection, degToRad(FIELD_OF_VIEW_DEGREES), safeAspect, 0.05, 50);
        mat4.multiply(this.viewProjection, this.projection, this.view);
    }
    private updateModel(shape: PreviewShape): void {
        const spinDegrees = (this.spin * 180) / Math.PI;
        const rotation = shape === 'plane' ? vec3.create(90, spinDegrees, 0) : vec3.create(0, spinDegrees, 0);
        mat4.fromTranslationRotationScale(this.model, vec3.create(0, 0, 0), rotation, vec3.create(1, 1, 1));
        if (!mat4.normalMatrix(this.normalMatrix, this.model))
            mat3.identity(this.normalMatrix);
    }
    private updateLights(settings: PreviewSettings): void {
        const rig = LIGHTING_RIGS[settings.lighting];
        const writeDirection = (index: number, yawDegrees: number, pitchDegrees: number) => {
            const yaw = degToRad(yawDegrees);
            const pitch = degToRad(pitchDegrees);
            const direction = vec3.normalize(vec3.create(), vec3.create(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)));
            this.lightDirections.set(direction, index * 3);
        };
        const base = this.yaw + settings.lightYaw;
        writeDirection(0, base, settings.lightPitch);
        writeDirection(1, base - 110, Math.max(settings.lightPitch * 0.3, 8));
        writeDirection(2, base + 160, Math.min(settings.lightPitch + 25, 80));
        this.lightColors.set(rig.key, 0);
        this.lightColors.set(rig.fill, 3);
        this.lightColors.set(rig.rim, 6);
    }
}
