import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { MULTI_SCATTERING_LUT_SIZE, SKY_LIGHTING_LUT_SIZE, SKY_VIEW_LUT_SIZE, TRANSMITTANCE_LUT_SIZE, } from '@/engine/renderer/shaders/sky/atmosphere.glsl';
import { TRANSMITTANCE_LUT_FRAGMENT_SHADER } from '@/engine/renderer/shaders/sky/transmittance-lut.glsl';
import { MULTI_SCATTERING_LUT_FRAGMENT_SHADER } from '@/engine/renderer/shaders/sky/multi-scattering-lut.glsl';
import { SKY_VIEW_LUT_FRAGMENT_SHADER } from '@/engine/renderer/shaders/sky/sky-view-lut.glsl';
import { SKY_LIGHTING_LUT_FRAGMENT_SHADER } from '@/engine/renderer/shaders/sky/sky-lighting-lut.glsl';
import { FloatSnapshot } from '@/engine/renderer/cache/float-snapshot';
import type { SkyFrame } from './sky-frame';
const TRANSMITTANCE_UNIT = 1;
const MULTI_SCATTERING_UNIT = 2;
const SKY_VIEW_UNIT = 3;
const INPUT_MIE_SCALE = 0;
const INPUT_SUN_DIRECTION = 1;
const INPUT_MOON_DIRECTION = 4;
const INPUT_SUN_IRRADIANCE = 7;
const INPUT_MOON_IRRADIANCE = 10;
const INPUT_COUNT = 13;
type TargetOptions = {
    filter?: 'linear' | 'nearest';
    wrapS?: 'clamp' | 'repeat';
};
export class AtmosphereLuts {
    readonly transmittance: ColorRenderTarget;
    readonly multiScattering: ColorRenderTarget;
    readonly skyView: ColorRenderTarget;
    readonly lighting: ColorRenderTarget;
    readonly stats = { drawCalls: 0 };
    private readonly transmittanceProgram: ShaderProgram;
    private readonly multiScatteringProgram: ShaderProgram;
    private readonly skyViewProgram: ShaderProgram;
    private readonly lightingProgram: ShaderProgram;
    private readonly inputs = new FloatSnapshot(INPUT_COUNT);
    constructor(private readonly gl: GL, format: ColorFormat, defines: ShaderDefines, private readonly triangle: FullscreenTriangle) {
        const target = (size: readonly [
            number,
            number
        ], options: TargetOptions = {}) => new ColorRenderTarget(gl, { width: size[0], height: size[1], format, ...options });
        this.transmittance = target(TRANSMITTANCE_LUT_SIZE);
        this.multiScattering = target(MULTI_SCATTERING_LUT_SIZE);
        this.skyView = target(SKY_VIEW_LUT_SIZE, { wrapS: 'repeat' });
        this.lighting = target(SKY_LIGHTING_LUT_SIZE, { filter: 'nearest' });
        const program = (fragment: string) => new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(fragment, defines));
        this.transmittanceProgram = program(TRANSMITTANCE_LUT_FRAGMENT_SHADER);
        this.multiScatteringProgram = program(MULTI_SCATTERING_LUT_FRAGMENT_SHADER);
        this.skyViewProgram = program(SKY_VIEW_LUT_FRAGMENT_SHADER);
        this.lightingProgram = program(SKY_LIGHTING_LUT_FRAGMENT_SHADER);
    }
    update(frame: SkyFrame): void {
        this.stats.drawCalls = 0;
        const mediumChanged = this.inputs.syncScalar(INPUT_MIE_SCALE, frame.mieScale);
        const lightsChanged = this.syncLights(frame);
        if (mediumChanged) {
            this.renderTransmittance(frame);
            this.renderMultiScattering(frame);
        }
        if (mediumChanged || lightsChanged) {
            this.renderSkyView(frame);
            this.renderLighting(frame);
        }
    }
    dispose(): void {
        for (const target of [this.transmittance, this.multiScattering, this.skyView, this.lighting])
            target.dispose();
        for (const program of [this.transmittanceProgram, this.multiScatteringProgram, this.skyViewProgram, this.lightingProgram]) {
            program.dispose();
        }
    }
    private syncLights(frame: SkyFrame): boolean {
        const { inputs } = this;
        const sunDirection = inputs.sync(INPUT_SUN_DIRECTION, frame.sunDirection);
        const moonDirection = inputs.sync(INPUT_MOON_DIRECTION, frame.moonDirection);
        const sunIrradiance = inputs.sync(INPUT_SUN_IRRADIANCE, frame.sunIrradiance);
        const moonIrradiance = inputs.sync(INPUT_MOON_IRRADIANCE, frame.moonIrradiance);
        return sunDirection || moonDirection || sunIrradiance || moonIrradiance;
    }
    private bindLights(program: ShaderProgram, frame: SkyFrame): void {
        const { gl } = this;
        gl.uniform3fv(program.uniform('u_sunDirection'), frame.sunDirection);
        gl.uniform3fv(program.uniform('u_moonDirection'), frame.moonDirection);
        gl.uniform3fv(program.uniform('u_sunIrradiance'), frame.sunIrradiance);
        gl.uniform3fv(program.uniform('u_moonIrradiance'), frame.moonIrradiance);
    }
    private bindTexture(program: ShaderProgram, name: string, unit: number, target: ColorRenderTarget): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, target.texture);
        gl.uniform1i(program.uniform(name), unit);
    }
    private draw(program: ShaderProgram, target: ColorRenderTarget, frame: SkyFrame): void {
        this.gl.uniform1f(program.uniform('u_mieScale'), frame.mieScale);
        target.bind();
        this.triangle.draw();
        this.stats.drawCalls++;
    }
    private renderTransmittance(frame: SkyFrame): void {
        this.transmittanceProgram.use();
        this.draw(this.transmittanceProgram, this.transmittance, frame);
    }
    private renderMultiScattering(frame: SkyFrame): void {
        const program = this.multiScatteringProgram;
        program.use();
        this.bindTexture(program, 'u_transmittanceLut', TRANSMITTANCE_UNIT, this.transmittance);
        this.draw(program, this.multiScattering, frame);
    }
    private renderSkyView(frame: SkyFrame): void {
        const program = this.skyViewProgram;
        program.use();
        this.bindTexture(program, 'u_transmittanceLut', TRANSMITTANCE_UNIT, this.transmittance);
        this.bindTexture(program, 'u_multiScatteringLut', MULTI_SCATTERING_UNIT, this.multiScattering);
        this.bindLights(program, frame);
        this.draw(program, this.skyView, frame);
    }
    private renderLighting(frame: SkyFrame): void {
        const program = this.lightingProgram;
        program.use();
        this.bindTexture(program, 'u_transmittanceLut', TRANSMITTANCE_UNIT, this.transmittance);
        this.bindTexture(program, 'u_skyViewLut', SKY_VIEW_UNIT, this.skyView);
        this.bindLights(program, frame);
        this.draw(program, this.lighting, frame);
    }
}
