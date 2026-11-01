import * as mat3 from '@/engine/core/math/mat3';
import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { DEG_TO_RAD, lerp } from '@/engine/core/math/scalar';
import type { VfxShape } from '@/engine/vfx/document/vfx-document';
import type { VfxRandom } from './particle-pool';
const rotationCache = new WeakMap<VfxShape, Float32Array>();
const scratchMatrix = mat4.create();
const scratchEuler = vec3.create();
const unitScale = vec3.create(1, 1, 1);
const origin = vec3.create();
function shapeRotation(shape: VfxShape): Float32Array {
    let rotation = rotationCache.get(shape);
    if (!rotation) {
        rotation = mat3.create();
        vec3.set(scratchEuler, shape.rotation[0], shape.rotation[1], shape.rotation[2]);
        mat4.fromTranslationRotationScale(scratchMatrix, origin, scratchEuler, unitScale);
        const m = scratchMatrix;
        rotation[0] = m[0];
        rotation[1] = m[1];
        rotation[2] = m[2];
        rotation[3] = m[4];
        rotation[4] = m[5];
        rotation[5] = m[6];
        rotation[6] = m[8];
        rotation[7] = m[9];
        rotation[8] = m[10];
        rotationCache.set(shape, rotation);
    }
    return rotation;
}
function randomDirection(rng: VfxRandom, out: Float32Array, offset: number): void {
    const z = rng.range(-1, 1);
    const angle = rng.range(0, Math.PI * 2);
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    out[offset] = Math.cos(angle) * radial;
    out[offset + 1] = z;
    out[offset + 2] = Math.sin(angle) * radial;
}
function sampleRadius(rng: VfxRandom, radius: number, thickness: number, dimensions: 2 | 3): number {
    const inner = radius * (1 - thickness);
    const t = rng.next();
    const exponent = 1 / dimensions;
    const innerPow = inner ** dimensions;
    const outerPow = radius ** dimensions;
    return (innerPow + (outerPow - innerPow) * t) ** exponent;
}
const localPosition = vec3.create();
const localDirection = vec3.create();
const scratchDirection = vec3.create();
export function sampleShape(shape: VfxShape, rng: VfxRandom, scale: number, outPosition: Float32Array, positionOffset: number, outDirection: Float32Array, directionOffset: number): void {
    const p = localPosition;
    const d = localDirection;
    const arc = shape.arc * DEG_TO_RAD;
    switch (shape.kind) {
        case 'point': {
            vec3.set(p, 0, 0, 0);
            randomDirection(rng, d, 0);
            break;
        }
        case 'sphere':
        case 'hemisphere': {
            const angle = rng.range(0, arc);
            let z = rng.range(-1, 1);
            if (shape.kind === 'hemisphere')
                z = Math.abs(z);
            const radial = Math.sqrt(Math.max(0, 1 - z * z));
            vec3.set(d, Math.cos(angle) * radial, z, Math.sin(angle) * radial);
            const radius = shape.emitFrom === 'volume' ? sampleRadius(rng, shape.radius, shape.thickness, 3) : shape.radius;
            vec3.scale(p, d, radius);
            break;
        }
        case 'cone': {
            const angle = rng.range(0, arc);
            const radius = shape.emitFrom === 'volume' ? sampleRadius(rng, shape.radius, shape.thickness, 2) : shape.radius;
            const along = shape.emitFrom === 'volume' ? rng.range(0, shape.length) : shape.emitFrom === 'surface' ? rng.range(0, shape.length) : 0;
            vec3.set(p, Math.cos(angle) * radius, along, Math.sin(angle) * radius);
            const spread = Math.tan(shape.angle * DEG_TO_RAD) * (shape.radius > 0 ? radius / shape.radius : 1);
            vec3.set(d, Math.cos(angle) * spread, 1, Math.sin(angle) * spread);
            vec3.normalize(d, d);
            if (shape.emitFrom !== 'edge' && along > 0) {
                p[0] += d[0] * along;
                p[2] += d[2] * along;
            }
            break;
        }
        case 'box': {
            const [sx, sy, sz] = shape.size;
            if (shape.emitFrom === 'volume') {
                vec3.set(p, rng.range(-0.5, 0.5) * sx, rng.range(-0.5, 0.5) * sy, rng.range(-0.5, 0.5) * sz);
            }
            else if (shape.emitFrom === 'surface') {
                const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
                const total = areas.reduce((sum, area) => sum + area, 0) || 1;
                let pick = rng.range(0, total);
                let face = 0;
                while (face < 5 && pick >= areas[face])
                    pick -= areas[face++];
                const u = rng.range(-0.5, 0.5);
                const v = rng.range(-0.5, 0.5);
                if (face < 2)
                    vec3.set(p, (face === 0 ? -0.5 : 0.5) * sx, u * sy, v * sz);
                else if (face < 4)
                    vec3.set(p, u * sx, (face === 2 ? -0.5 : 0.5) * sy, v * sz);
                else
                    vec3.set(p, u * sx, v * sy, (face === 4 ? -0.5 : 0.5) * sz);
            }
            else {
                const edge = rng.int(0, 11);
                const t = rng.range(-0.5, 0.5);
                const a = edge & 1 ? 0.5 : -0.5;
                const b = edge & 2 ? 0.5 : -0.5;
                const axis = edge >> 2;
                if (axis === 0)
                    vec3.set(p, t * sx, a * sy, b * sz);
                else if (axis === 1)
                    vec3.set(p, a * sx, t * sy, b * sz);
                else
                    vec3.set(p, a * sx, b * sy, t * sz);
            }
            vec3.set(d, 0, 1, 0);
            break;
        }
        case 'circle': {
            const angle = rng.range(0, arc);
            const radius = shape.emitFrom === 'volume' ? sampleRadius(rng, shape.radius, shape.thickness, 2) : shape.radius;
            vec3.set(p, Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
            vec3.set(d, Math.cos(angle), 0, Math.sin(angle));
            break;
        }
        case 'edge': {
            vec3.set(p, rng.range(-0.5, 0.5) * shape.length, 0, 0);
            vec3.set(d, 0, 1, 0);
            break;
        }
    }
    if (shape.spherizeDirection > 0) {
        const length = vec3.length(p);
        if (length > 1e-5) {
            vec3.scale(scratchDirection, p, 1 / length);
            d[0] = lerp(d[0], scratchDirection[0], shape.spherizeDirection);
            d[1] = lerp(d[1], scratchDirection[1], shape.spherizeDirection);
            d[2] = lerp(d[2], scratchDirection[2], shape.spherizeDirection);
        }
    }
    if (shape.randomizeDirection > 0) {
        randomDirection(rng, scratchDirection, 0);
        d[0] = lerp(d[0], scratchDirection[0], shape.randomizeDirection);
        d[1] = lerp(d[1], scratchDirection[1], shape.randomizeDirection);
        d[2] = lerp(d[2], scratchDirection[2], shape.randomizeDirection);
    }
    if (vec3.length(d) < 1e-5)
        vec3.set(d, 0, 1, 0);
    vec3.normalize(d, d);
    p[0] *= shape.scale[0];
    p[1] *= shape.scale[1];
    p[2] *= shape.scale[2];
    const rotation = shapeRotation(shape);
    mat3.transformVec3(p, rotation, p);
    mat3.transformVec3(d, rotation, d);
    outPosition[positionOffset] = (p[0] + shape.offset[0]) * scale;
    outPosition[positionOffset + 1] = (p[1] + shape.offset[1]) * scale;
    outPosition[positionOffset + 2] = (p[2] + shape.offset[2]) * scale;
    outDirection[directionOffset] = d[0];
    outDirection[directionOffset + 1] = d[1];
    outDirection[directionOffset + 2] = d[2];
}
export function shapeExtent(shape: VfxShape): number {
    const scale = Math.max(shape.scale[0], shape.scale[1], shape.scale[2]);
    const offset = Math.hypot(shape.offset[0], shape.offset[1], shape.offset[2]);
    switch (shape.kind) {
        case 'point':
            return offset;
        case 'box':
            return offset + Math.hypot(shape.size[0], shape.size[1], shape.size[2]) * 0.5 * scale;
        case 'cone':
            return offset + Math.max(shape.radius, shape.length) * scale;
        case 'edge':
            return offset + shape.length * 0.5 * scale;
        default:
            return offset + shape.radius * scale;
    }
}
