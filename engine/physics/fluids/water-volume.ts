import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { WaveSpectrum, type WaterSample } from '@/engine/terrain/water/water-surface';
const localPoint = vec3.create();
const worldPoint = vec3.create();
export class WaterVolume {
    private readonly inverse = mat4.create();
    private readonly spectrum = new WaveSpectrum();
    private readonly displacement = vec3.create();
    constructor(readonly terrain: Terrain, private readonly matrix: Mat4) {
        mat4.invert(this.inverse, matrix);
    }
    get enabled(): boolean {
        return this.terrain.water.enabled;
    }
    containsHorizontally(point: Vec3): boolean {
        mat4.transformPoint(localPoint, this.inverse, point);
        return this.terrain.containsLocal(localPoint[0], localPoint[2]);
    }
    maxSurfaceHeight(point: Vec3): number {
        const water = this.terrain.water;
        mat4.transformPoint(localPoint, this.inverse, point);
        localPoint[1] = water.level + Math.max(water.waveHeight, 0) * 0.5;
        mat4.transformPoint(worldPoint, this.matrix, localPoint);
        return worldPoint[1];
    }
    beginBody(reference: Vec3, time: number): void {
        this.spectrum.prepare(this.terrain.water, this.terrain.size);
        mat4.transformPoint(localPoint, this.inverse, reference);
        this.spectrum.invertDisplacement(this.displacement, localPoint[0], localPoint[2], time);
    }
    sampleAt(out: WaterSample, point: Vec3, time: number): boolean {
        const terrain = this.terrain;
        mat4.transformPoint(localPoint, this.inverse, point);
        const x = localPoint[0];
        const z = localPoint[2];
        if (!terrain.containsLocal(x, z))
            return false;
        const floor = terrain.heightAtLocal(x, z);
        this.spectrum.sample(out, x, z, time, this.displacement);
        if (out.height <= floor)
            return false;
        localPoint[1] = out.height;
        mat4.transformPoint(worldPoint, this.matrix, localPoint);
        out.height = worldPoint[1];
        mat4.transformDirection(out.velocity, this.matrix, out.velocity);
        mat4.transformDirection(out.normal, this.matrix, out.normal);
        vec3.normalize(out.normal, out.normal);
        return true;
    }
}
