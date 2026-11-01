import * as aabb from '@/engine/core/math/aabb';
import * as mat4 from '@/engine/core/math/mat4';
import type { Texture } from '@/engine/core/scene/texture';
import type { Frustum } from '@/engine/renderer/culling/frustum';
import type { GL } from '@/engine/renderer/gl/context';
import type { GpuTextureCache } from '@/engine/renderer/gl/gpu-texture-cache';
import type { SceneRenderTarget } from '@/engine/renderer/gl/scene-render-target';
import { SceneDepthCapture } from '@/engine/renderer/gl/scene-depth-capture';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { bindSceneLightingUniforms, FIRST_PASS_TEXTURE_UNIT, sceneLightingDefines, type SceneLightingInput } from '@/engine/renderer/lighting/scene-lighting-uniforms';
import { VFX_BLEND_CODE, VFX_FRAGMENT_SHADER, VFX_INSTANCE_FLOATS, VFX_RENDER_MODE_CODE, VFX_VERTEX_SHADER } from '@/engine/renderer/shaders/vfx.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { VfxEmitter } from '@/engine/vfx/document/vfx-document';
import type { EmitterSimulator } from '@/engine/vfx/simulation/emitter-simulator';
import { vfxDocumentExtent } from '@/engine/vfx/simulation/vfx-instance';
import type { VfxDraw } from '@/engine/vfx/world/vfx-system';
const QUAD_VERTICES = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
const SPRITE_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT;
const DEPTH_TEXTURE_UNIT = FIRST_PASS_TEXTURE_UNIT + 1;
const INSTANCE_STRIDE = VFX_INSTANCE_FLOATS * 4;
const IDENTITY = mat4.create();
interface Batch {
    readonly draw: VfxDraw;
    readonly emitter: VfxEmitter;
    readonly simulator: EmitterSimulator;
    readonly texture: Texture | null;
    offset: number;
    count: number;
}
export interface VfxPassInput extends SceneLightingInput {
    readonly frustum: Frustum | null;
    readonly sceneTarget: SceneRenderTarget;
}
