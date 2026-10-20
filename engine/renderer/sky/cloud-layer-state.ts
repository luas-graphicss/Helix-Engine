import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { CloudSettings } from '@/engine/core/environment/sky-settings';
import { degToRad } from '@/engine/core/math/scalar';
import { CLOUD_DETAIL_TILE_METERS, CLOUD_FOOTPRINT_TILE_METERS } from '@/engine/renderer/shaders/chunks/cloud-density.glsl';
import type { CloudNoiseTextures } from './noise/cloud-noise-textures';
const DETAIL_WIND_FACTOR = 0.6;
function wrap(value: number, period: number): number {
    return ((value % period) + period) % period;
}
export class CloudLayerState {
    readonly layer = new Float32Array(4);
    readonly wind = new Float32Array(4);
    detailStrength = 0.5;
    update(settings: CloudSettings, deltaSeconds: number): void {
        this.layer[0] = settings.altitude;
        this.layer[1] = Math.max(50, settings.thickness);
        this.layer[2] = settings.coverage;
        this.layer[3] = 0.002 + 0.06 * settings.density * settings.density;
        this.detailStrength = settings.detail;
        const angle = degToRad(settings.windDirection);
        const travel = settings.windSpeed * deltaSeconds;
        const dx = -Math.sin(angle) * travel;
        const dz = -Math.cos(angle) * travel;
        this.wind[0] = wrap(this.wind[0] + dx, CLOUD_FOOTPRINT_TILE_METERS);
        this.wind[1] = wrap(this.wind[1] + dz, CLOUD_FOOTPRINT_TILE_METERS);
        this.wind[2] = wrap(this.wind[2] + dx * DETAIL_WIND_FACTOR, CLOUD_DETAIL_TILE_METERS);
        this.wind[3] = wrap(this.wind[3] + dz * DETAIL_WIND_FACTOR, CLOUD_DETAIL_TILE_METERS);
    }
    get midAltitude(): number {
        return this.layer[0] + this.layer[1] * 0.5;
    }
    bind(gl: GL, program: ShaderProgram, noise: CloudNoiseTextures, footprintUnit: number, detailUnit: number): void {
        gl.uniform4fv(program.uniform('u_cloudLayer'), this.layer);
        gl.uniform4fv(program.uniform('u_cloudWind'), this.wind);
        gl.uniform1f(program.uniform('u_cloudDetailStrength'), this.detailStrength);
        gl.activeTexture(gl.TEXTURE0 + footprintUnit);
        gl.bindTexture(gl.TEXTURE_2D, noise.footprint);
        gl.uniform1i(program.uniform('u_cloudFootprint'), footprintUnit);
        gl.activeTexture(gl.TEXTURE0 + detailUnit);
        gl.bindTexture(gl.TEXTURE_3D, noise.detail);
        gl.uniform1i(program.uniform('u_cloudDetail'), detailUnit);
    }
}
