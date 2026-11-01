import type { Vec3 } from '@/engine/core/math/vec3';
import type { CustomPostEffect } from './post/custom-post-pass';
import type { CompiledShaderBundle } from './shaders/custom/shader-bundle';
export const SCRIPT_RENDER_PASSES = ['shadow', 'localShadow', 'depthPrepass', 'mesh', 'terrain', 'grass', 'water', 'sky', 'vfx', 'guiSurface', 'post', 'overlays'] as const;
export type ScriptRenderPass = (typeof SCRIPT_RENDER_PASSES)[number];
export interface ScriptFrameTarget {
    gl: WebGL2RenderingContext | null;
    width: number;
    height: number;
    pixelRatio: number;
    elapsed: number;
    delta: number;
    readonly view: Float32Array;
    readonly projection: Float32Array;
    readonly viewProjection: Float32Array;
    readonly cameraPosition: Float32Array;
    sceneColor: WebGLTexture | null;
    sceneDepth: WebGLTexture | null;
    hdr: boolean;
}
export interface ScriptDebugLine {
    readonly a: Vec3;
    readonly b: Vec3;
    readonly color: Vec3;
    readonly alpha: number;
}
export interface ScriptRenderRequest {
    readonly enabled: boolean;
    readonly hasHooks: boolean;
    readonly frame: ScriptFrameTarget;
    readonly debugLines: readonly ScriptDebugLine[];
    readonly customPost: readonly CustomPostEffect[];
    takeShaderWarmup(): readonly CompiledShaderBundle[];
    isPassEnabled(pass: ScriptRenderPass): boolean;
    warn(message: string): void;
    before(): void;
    beforePass(pass: ScriptRenderPass): void;
    afterPass(pass: ScriptRenderPass): void;
    after(): void;
}
