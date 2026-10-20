import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { CLOUD_FOOTPRINT_TILE_METERS } from '@/engine/renderer/shaders/chunks/cloud-density.glsl';
import { CLOUD_SHADOW_FRAGMENT_SHADER, CLOUD_SHADOW_MAP_SIZE } from '@/engine/renderer/shaders/sky/cloud-shadow.glsl';
import { FloatSnapshot } from '@/engine/renderer/cache/float-snapshot';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { CloudLayerState } from './cloud-layer-state';
import type { CloudNoiseTextures } from './noise/cloud-noise-textures';
const REGION_EXTENT = 8000;
const TEXEL_METERS = REGION_EXTENT / CLOUD_SHADOW_MAP_SIZE;
const MIN_LIGHT_ELEVATION = 0.08;
const MAX_DRIFT = REGION_EXTENT / 32;
const FOOTPRINT_UNIT = 1;
const DETAIL_UNIT = 2;
const INPUT_LIGHT = 0;
const INPUT_LAYER = 3;
const INPUT_COUNT = 7;
function windDelta(current: number, reference: number): number {
    const period = CLOUD_FOOTPRINT_TILE_METERS;
    return ((((current - reference) % period) + period * 1.5) % period) - period * 0.5;
}
export class CloudShadowMap {
    readonly target: ColorRenderTarget;
    readonly region = new Float32Array(4);
    readonly stats = { drawCalls: 0 };
    private readonly program: ShaderProgram;
    private readonly inputs = new FloatSnapshot(INPUT_COUNT);
    private readonly drawnCenter = new Float64Array(2);
    private readonly drawnWind = new Float64Array(2);
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle) {
        this.target = new ColorRenderTarget(gl, { width: CLOUD_SHADOW_MAP_SIZE, height: CLOUD_SHADOW_MAP_SIZE, format: 'rgba8' });
        this.program = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, CLOUD_SHADOW_FRAGMENT_SHADER);
    }
    render(lightDirection: Vec3, cameraPosition: Vec3, clouds: CloudLayerState, noise: CloudNoiseTextures): boolean {
        this.stats.drawCalls = 0;
        if (lightDirection[1] < MIN_LIGHT_ELEVATION)
            return false;
        const { region, drawnCenter, drawnWind } = this;
        const windX = clouds.wind[0];
        const windZ = clouds.wind[1];
        const reach = (clouds.midAltitude - cameraPosition[1]) / lightDirection[1];
        const focusX = cameraPosition[0] + lightDirection[0] * reach + windX;
        const focusZ = cameraPosition[2] + lightDirection[2] * reach + windZ;
        const inputsChanged = this.inputsChanged(lightDirection, clouds);
        const drifted = Math.abs(windDelta(focusX, drawnCenter[0])) > MAX_DRIFT || Math.abs(windDelta(focusZ, drawnCenter[1])) > MAX_DRIFT;
        const redraw = inputsChanged || drifted;
        if (redraw) {
            drawnCenter[0] = Math.round(focusX / TEXEL_METERS) * TEXEL_METERS;
            drawnCenter[1] = Math.round(focusZ / TEXEL_METERS) * TEXEL_METERS;
            drawnWind[0] = windX;
            drawnWind[1] = windZ;
            region[2] = 1 / REGION_EXTENT;
            region[3] = clouds.midAltitude;
        }
        region[0] = drawnCenter[0] - drawnWind[0] - windDelta(windX, drawnWind[0]);
        region[1] = drawnCenter[1] - drawnWind[1] - windDelta(windZ, drawnWind[1]);
        if (redraw)
            this.draw(lightDirection, clouds, noise);
        return true;
    }
    dispose(): void {
        this.program.dispose();
        this.target.dispose();
    }
    private inputsChanged(lightDirection: Vec3, clouds: CloudLayerState): boolean {
        const light = this.inputs.sync(INPUT_LIGHT, lightDirection);
        const layer = this.inputs.sync(INPUT_LAYER, clouds.layer);
        return light || layer;
    }
    private draw(lightDirection: Vec3, clouds: CloudLayerState, noise: CloudNoiseTextures): void {
        const { gl, program } = this;
        program.use();
        gl.uniform4fv(program.uniform('u_cloudShadowRegion'), this.region);
        gl.uniform3fv(program.uniform('u_lightDirection'), lightDirection);
        clouds.bind(gl, program, noise, FOOTPRINT_UNIT, DETAIL_UNIT);
        this.target.bind();
        this.triangle.draw();
        this.stats.drawCalls = 1;
    }
}
