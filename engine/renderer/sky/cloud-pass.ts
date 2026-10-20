import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_RAY_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { CLOUDS_FRAGMENT_SHADER } from '@/engine/renderer/shaders/sky/clouds.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { CloudQuality } from '@/engine/core/environment/sky-settings';
import * as mat4 from '@/engine/core/math/mat4';
import type { AtmosphereLuts } from './atmosphere-luts';
import type { CloudLayerState } from './cloud-layer-state';
import type { CloudNoiseTextures } from './noise/cloud-noise-textures';
import type { SkyFrame } from './sky-frame';
const QUALITY_PRESETS: Record<CloudQuality, {
    scale: number;
    steps: number;
}> = {
    low: { scale: 0.25, steps: 24 },
    medium: { scale: 0.5, steps: 40 },
    high: { scale: 1, steps: 56 },
};
const HISTORY_BLEND = 0.88;
const FOOTPRINT_UNIT = 1;
const DETAIL_UNIT = 2;
const TRANSMITTANCE_UNIT = 3;
const SKY_VIEW_UNIT = 4;
const LIGHTING_UNIT = 5;
const HISTORY_UNIT = 6;
export interface CloudPassInput {
    camera: PerspectiveCamera;
    frame: SkyFrame;
    quality: CloudQuality;
    luts: AtmosphereLuts;
    clouds: CloudLayerState;
    noise: CloudNoiseTextures;
    canvasWidth: number;
    canvasHeight: number;
}
export class CloudPass {
    readonly stats = { drawCalls: 0, width: 0, height: 0 };
    private readonly targets: [
        ColorRenderTarget,
        ColorRenderTarget
    ];
    private writeIndex = 0;
    private historyValid = false;
    private program: ShaderProgram | null = null;
    private programQuality: CloudQuality | null = null;
    private readonly previousViewProjection = mat4.create();
    private frameIndex = 0;
    constructor(private readonly gl: GL, format: ColorFormat, private readonly defines: ShaderDefines, private readonly triangle: FullscreenTriangle) {
        const create = () => new ColorRenderTarget(gl, { width: 2, height: 2, format });
        this.targets = [create(), create()];
    }
    get texture(): WebGLTexture {
        return this.targets[this.writeIndex].texture;
    }
    invalidateHistory(): void {
        this.historyValid = false;
    }
    render(input: CloudPassInput): void {
        const { gl } = this;
        const preset = QUALITY_PRESETS[input.quality];
        const program = this.resolveProgram(input.quality, preset.steps);
        const width = Math.max(1, Math.round(input.canvasWidth * preset.scale));
        const height = Math.max(1, Math.round(input.canvasHeight * preset.scale));
        this.writeIndex = 1 - this.writeIndex;
        const write = this.targets[this.writeIndex];
        const history = this.targets[1 - this.writeIndex];
        if (write.resize(width, height) || history.resize(width, height))
            this.historyValid = false;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, input.camera.inverseViewProjectionMatrix);
        gl.uniformMatrix4fv(program.uniform('u_previousViewProjection'), false, this.previousViewProjection);
        gl.uniform3fv(program.uniform('u_cameraPosition'), input.camera.position);
        gl.uniform3fv(program.uniform('u_sunDirection'), input.frame.sunDirection);
        gl.uniform3fv(program.uniform('u_moonDirection'), input.frame.moonDirection);
        gl.uniform3fv(program.uniform('u_sunIrradiance'), input.frame.sunIrradiance);
        gl.uniform3fv(program.uniform('u_moonIrradiance'), input.frame.moonIrradiance);
        gl.uniform1f(program.uniform('u_mieScale'), input.frame.mieScale);
        gl.uniform1f(program.uniform('u_historyBlend'), this.historyValid ? HISTORY_BLEND : 0);
        gl.uniform1f(program.uniform('u_frameIndex'), this.frameIndex);
        input.clouds.bind(gl, program, input.noise, FOOTPRINT_UNIT, DETAIL_UNIT);
        this.bindTexture(program, 'u_transmittanceLut', TRANSMITTANCE_UNIT, input.luts.transmittance.texture);
        this.bindTexture(program, 'u_skyViewLut', SKY_VIEW_UNIT, input.luts.skyView.texture);
        this.bindTexture(program, 'u_skyLightingLut', LIGHTING_UNIT, input.luts.lighting.texture);
        this.bindTexture(program, 'u_history', HISTORY_UNIT, history.texture);
        write.bind();
        this.triangle.draw();
        gl.activeTexture(gl.TEXTURE0 + HISTORY_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        mat4.copy(this.previousViewProjection, input.camera.viewProjectionMatrix);
        this.historyValid = true;
        this.frameIndex = (this.frameIndex + 1) % 1024;
        this.stats.drawCalls = 1;
        this.stats.width = width;
        this.stats.height = height;
    }
    dispose(): void {
        this.program?.dispose();
        for (const target of this.targets)
            target.dispose();
    }
    private resolveProgram(quality: CloudQuality, steps: number): ShaderProgram {
        if (this.program && this.programQuality === quality)
            return this.program;
        this.program?.dispose();
        const fragment = withDefines(CLOUDS_FRAGMENT_SHADER, { ...this.defines, CLOUD_STEPS: steps });
        this.program = new ShaderProgram(this.gl, FULLSCREEN_RAY_VERTEX_SHADER, fragment);
        this.programQuality = quality;
        this.historyValid = false;
        return this.program;
    }
    private bindTexture(program: ShaderProgram, name: string, unit: number, texture: WebGLTexture): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniform(name), unit);
    }
}
