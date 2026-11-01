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
import { FloatSnapshot } from '@/engine/renderer/cache/float-snapshot';
import type { AtmosphereLuts } from './atmosphere-luts';
import type { CloudLayerState } from './cloud-layer-state';
import type { CloudNoiseTextures } from './noise/cloud-noise-textures';
import type { SkyFrame } from './sky-frame';
const QUALITY_PRESETS: Record<CloudQuality, {
    scale: number;
    maxSteps: number;
}> = {
    low: { scale: 0.25, maxSteps: 24 },
    medium: { scale: 0.5, maxSteps: 40 },
    high: { scale: 1, maxSteps: 56 },
};
const HISTORY_BLEND = 0.88;
const INTERLEAVED_HISTORY_BLEND = 0.85;
const QUADRANTS: readonly [
    number,
    number
][] = [
    [0, 0],
    [1, 1],
    [1, 0],
    [0, 1],
];
const FAST_ROTATION_RADIANS = 0.02;
const CONVERGED_MARCHES = 32;
const INPUT_FLOATS = 48;
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
    stepsPerFrame: number;
    interleave: boolean;
    resolutionScale?: number;
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
    private programSteps = 0;
    private readonly programs = new Map<number, ShaderProgram>();
    private readonly previousViewProjection = mat4.create();
    private readonly previousForward = new Float32Array(3);
    private frameIndex = 0;
    private readonly inputs = new FloatSnapshot(INPUT_FLOATS);
    private stableFrames = 0;
    private lastInterleave = false;
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
    get converged(): boolean {
        return this.historyValid && this.stableFrames >= CONVERGED_MARCHES * (this.lastInterleave ? 4 : 1);
    }
    render(input: CloudPassInput): boolean {
        const { gl } = this;
        const preset = QUALITY_PRESETS[input.quality];
        const steps = Math.max(8, Math.min(preset.maxSteps, Math.round(input.stepsPerFrame)));
        const program = this.resolveProgram(steps);
        if (!program) {
            this.stats.drawCalls = 0;
            return false;
        }
        const scale = preset.scale * Math.min(1, Math.max(0.25, input.resolutionScale ?? 1));
        const width = Math.max(1, Math.round(input.canvasWidth * scale));
        const height = Math.max(1, Math.round(input.canvasHeight * scale));
        this.writeIndex = 1 - this.writeIndex;
        const write = this.targets[this.writeIndex];
        const history = this.targets[1 - this.writeIndex];
        if (write.resize(width, height) || history.resize(width, height))
            this.historyValid = false;
        const rotation = this.measureRotation(input.camera);
        const interleave = input.interleave && this.historyValid;
        const halfPattern = interleave && rotation > FAST_ROTATION_RADIANS;
        const quadrant = QUADRANTS[this.frameIndex % 4];
        this.trackInputs(input, steps, interleave, width, height);
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, input.camera.inverseViewProjectionMatrix);
        gl.uniformMatrix4fv(program.uniform('u_previousViewProjection'), false, this.previousViewProjection);
        gl.uniform3fv(program.uniform('u_cameraPosition'), input.camera.position);
        gl.uniform3fv(program.uniform('u_sunDirection'), input.frame.sunDirection);
        gl.uniform3fv(program.uniform('u_moonDirection'), input.frame.moonDirection);
        gl.uniform3fv(program.uniform('u_sunIrradiance'), input.frame.sunIrradiance);
        gl.uniform3fv(program.uniform('u_moonIrradiance'), input.frame.moonIrradiance);
        gl.uniform1f(program.uniform('u_mieScale'), input.frame.mieScale);
        gl.uniform1f(program.uniform('u_historyBlend'), this.historyValid ? (interleave ? INTERLEAVED_HISTORY_BLEND : HISTORY_BLEND) : 0);
        gl.uniform1f(program.uniform('u_frameIndex'), this.frameIndex);
        gl.uniform2i(program.uniform('u_interleaveMask'), interleave ? 1 : 0, interleave && !halfPattern ? 1 : 0);
        gl.uniform2i(program.uniform('u_quadrant'), quadrant[0], quadrant[1]);
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
        return true;
    }
    dispose(): void {
        for (const program of this.programs.values())
            program.dispose();
        this.programs.clear();
        this.program = null;
        for (const target of this.targets)
            target.dispose();
    }
    private trackInputs(input: CloudPassInput, steps: number, interleave: boolean, width: number, height: number): void {
        const { inputs, historyValid } = this;
        const { camera, frame, clouds } = input;
        let changed = !historyValid;
        if (inputs.sync(0, camera.viewProjectionMatrix))
            changed = true;
        if (inputs.sync(16, frame.sunDirection))
            changed = true;
        if (inputs.sync(19, frame.moonDirection))
            changed = true;
        if (inputs.sync(22, frame.sunIrradiance))
            changed = true;
        if (inputs.sync(25, frame.moonIrradiance))
            changed = true;
        if (inputs.syncScalar(28, frame.mieScale))
            changed = true;
        if (inputs.sync(29, clouds.layer))
            changed = true;
        if (inputs.sync(33, clouds.wind))
            changed = true;
        if (inputs.syncScalar(37, clouds.detailStrength))
            changed = true;
        if (inputs.syncScalar(38, steps))
            changed = true;
        if (inputs.syncScalar(39, interleave ? 1 : 0))
            changed = true;
        if (inputs.syncScalar(40, width))
            changed = true;
        if (inputs.syncScalar(41, height))
            changed = true;
        this.stableFrames = changed ? 0 : this.stableFrames + 1;
        this.lastInterleave = interleave;
    }
    private measureRotation(camera: PerspectiveCamera): number {
        const view = camera.viewMatrix;
        const fx = view[2];
        const fy = view[6];
        const fz = view[10];
        const previous = this.previousForward;
        const dot = Math.min(1, Math.max(-1, fx * previous[0] + fy * previous[1] + fz * previous[2]));
        previous[0] = fx;
        previous[1] = fy;
        previous[2] = fz;
        return Math.acos(dot);
    }
    private resolveProgram(steps: number): ShaderProgram | null {
        if (this.program && this.programSteps === steps)
            return this.program;
        let candidate = this.programs.get(steps);
        if (!candidate) {
            const fragment = withDefines(CLOUDS_FRAGMENT_SHADER, { ...this.defines, CLOUD_STEPS: steps });
            candidate = new ShaderProgram(this.gl, FULLSCREEN_RAY_VERTEX_SHADER, fragment);
            this.programs.set(steps, candidate);
        }
        if (!candidate.ready)
            return this.program;
        this.program = candidate;
        this.programSteps = steps;
        return this.program;
    }
    private bindTexture(program: ShaderProgram, name: string, unit: number, texture: WebGLTexture): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniform(name), unit);
    }
}
