import type { GL } from '@/engine/renderer/gl/context';
import { createRepeatingTexture2D, createRepeatingTexture3D } from '@/engine/renderer/gl/texture';
import { perlinFbm2 } from '@/engine/core/noise/perlin';
import { worley2, worley3 } from '@/engine/core/noise/worley';
const FOOTPRINT_SIZE = 256;
const DETAIL_SIZE = 32;
const SEED = 1337;
export interface CloudNoiseTextures {
    readonly footprint: WebGLTexture;
    readonly detail: WebGLTexture;
}
function buildFootprintData(): Uint8Array {
    const size = FOOTPRINT_SIZE;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        const v = y / size;
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const offset = (y * size + x) * 4;
            data[offset] = perlinFbm2(u * 6, v * 6, 6, 5, SEED) * 255;
            data[offset + 1] = worley2(u, v, 8, SEED + 11) * 255;
            data[offset + 2] = worley2(u, v, 20, SEED + 23) * 255;
            data[offset + 3] = perlinFbm2(u * 16, v * 16, 16, 2, SEED + 37) * 255;
        }
    }
    return data;
}
function buildDetailData(): Uint8Array {
    const size = DETAIL_SIZE;
    const data = new Uint8Array(size * size * size * 4);
    for (let z = 0; z < size; z++) {
        const w = z / size;
        for (let y = 0; y < size; y++) {
            const v = y / size;
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const offset = ((z * size + y) * size + x) * 4;
                data[offset] = worley3(u, v, w, 4, SEED + 41) * 255;
                data[offset + 1] = worley3(u, v, w, 8, SEED + 53) * 255;
                data[offset + 2] = worley3(u, v, w, 16, SEED + 67) * 255;
                data[offset + 3] = 255;
            }
        }
    }
    return data;
}
export function createCloudNoiseTextures(gl: GL): CloudNoiseTextures {
    return {
        footprint: createRepeatingTexture2D(gl, { data: buildFootprintData(), width: FOOTPRINT_SIZE, height: FOOTPRINT_SIZE }),
        detail: createRepeatingTexture3D(gl, { data: buildDetailData(), width: DETAIL_SIZE, height: DETAIL_SIZE, depth: DETAIL_SIZE }),
    };
}
export function disposeCloudNoiseTextures(gl: GL, textures: CloudNoiseTextures): void {
    gl.deleteTexture(textures.footprint);
    gl.deleteTexture(textures.detail);
}
