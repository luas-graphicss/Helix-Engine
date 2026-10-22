import { fbm3, ridgedFbm3, valueNoise3 } from '@/engine/core/noise/value-noise';
import { createIndexArray, type MeshData } from './mesh-data';
const TWO_PI = Math.PI * 2;
const DERIVATIVE_STEP = 1e-4;
const DEGENERATE_NORMAL = 1e-12;
const POLE_RETREAT = 2e-3;
type Point = [
    number,
    number,
    number
];
type SurfaceFunction = (u: number, v: number, out: Point) => void;
function sampleSurface(name: string, uSegments: number, vSegments: number, surface: SurfaceFunction): MeshData {
    const columns = uSegments + 1;
    const rows = vSegments + 1;
    const vertexCount = columns * rows;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const point: Point = [0, 0, 0];
    const du: Point = [0, 0, 0];
    const dv: Point = [0, 0, 0];
    const other: Point = [0, 0, 0];
    const differentiate = (u: number, v: number, alongU: boolean, out: Point): void => {
        surface(alongU ? u + DERIVATIVE_STEP : u, alongU ? v : v + DERIVATIVE_STEP, out);
        surface(alongU ? u - DERIVATIVE_STEP : u, alongU ? v : v - DERIVATIVE_STEP, other);
        out[0] -= other[0];
        out[1] -= other[1];
        out[2] -= other[2];
    };
    for (let iv = 0; iv < rows; iv++) {
        const v = iv / vSegments;
        for (let iu = 0; iu < columns; iu++) {
            const u = iu / uSegments;
            const index = iv * columns + iu;
            surface(u, v, point);
            differentiate(u, v, true, du);
            differentiate(u, v, false, dv);
            let nx = dv[1] * du[2] - dv[2] * du[1];
            let ny = dv[2] * du[0] - dv[0] * du[2];
            let nz = dv[0] * du[1] - dv[1] * du[0];
            let length = Math.hypot(nx, ny, nz);
            if (length < DEGENERATE_NORMAL) {
                differentiate(u, v < 0.5 ? v + POLE_RETREAT : v - POLE_RETREAT, true, du);
                nx = dv[1] * du[2] - dv[2] * du[1];
                ny = dv[2] * du[0] - dv[0] * du[2];
                nz = dv[0] * du[1] - dv[1] * du[0];
                length = Math.hypot(nx, ny, nz) || 1;
            }
            nx /= length;
            ny /= length;
            nz /= length;
            positions[index * 3] = point[0];
            positions[index * 3 + 1] = point[1];
            positions[index * 3 + 2] = point[2];
            normals[index * 3] = nx;
            normals[index * 3 + 1] = ny;
            normals[index * 3 + 2] = nz;
            uvs[index * 2] = u;
            uvs[index * 2 + 1] = v;
        }
    }
    const indices = new Uint32Array(uSegments * vSegments * 6);
    let write = 0;
    for (let iv = 0; iv < vSegments; iv++) {
        for (let iu = 0; iu < uSegments; iu++) {
            const a = iv * columns + iu;
            const b = a + columns;
            indices[write++] = a;
            indices[write++] = b;
            indices[write++] = a + 1;
            indices[write++] = b;
            indices[write++] = b + 1;
            indices[write++] = a + 1;
        }
    }
    return { name, positions, normals, uvs, indices: createIndexArray(indices, vertexCount) };
}
function sphereDirection(u: number, v: number, out: Point): void {
    const theta = u * TWO_PI;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    out[0] = -Math.cos(theta) * sinPhi;
    out[1] = Math.cos(phi);
    out[2] = Math.sin(theta) * sinPhi;
}
export function createRock(radius = 0.5, segments = 360, seed = 1): MeshData {
    const direction: Point = [0, 0, 0];
    return sampleSurface('Rocha', segments, segments >> 1, (u, v, out) => {
        sphereDirection(u, v, direction);
        const [dx, dy, dz] = direction;
        const shape = fbm3(dx * 1.6 + seed, dy * 1.6, dz * 1.6, 3, seed) * 0.28;
        const ridges = (ridgedFbm3(dx * 5 + seed, dy * 5, dz * 5, 4, seed + 7) - 0.5) * 0.09;
        const grain = valueNoise3(dx * 36, dy * 36 + seed, dz * 36, seed + 11) * 0.012;
        const r = radius * (1 + shape + ridges + grain);
        out[0] = dx * r;
        out[1] = dy * r * 0.85;
        out[2] = dz * r;
    });
}
export function createDenseSphere(radius = 0.5, segments = 320): MeshData {
    const direction: Point = [0, 0, 0];
    return sampleSurface('Esfera densa', segments, segments >> 1, (u, v, out) => {
        sphereDirection(u, v, direction);
        const [dx, dy, dz] = direction;
        const ripples = Math.sin(dx * 60) * Math.sin(dy * 60) * Math.sin(dz * 60) * 0.03;
        const r = radius * (1 + ripples);
        out[0] = dx * r;
        out[1] = dy * r;
        out[2] = dz * r;
    });
}
export function createEngravedTorus(radius = 0.5, tube = 0.2, radialSegments = 320, tubularSegments = 160): MeshData {
    return sampleSurface('Toro gravado', radialSegments, tubularSegments, (u, v, out) => {
        const theta = u * TWO_PI;
        const phi = v * TWO_PI;
        const rx = -Math.cos(theta);
        const rz = Math.sin(theta);
        const cosPhi = Math.cos(phi);
        const sinPhi = -Math.sin(phi);
        const grooves = 1 + Math.sin(theta * 24 + phi * 3) * 0.06 + Math.sin(phi * 16) * 0.03;
        const t = tube * grooves;
        out[0] = rx * radius + rx * cosPhi * t;
        out[1] = sinPhi * t;
        out[2] = rz * radius + rz * cosPhi * t;
    });
}
export function createTorusKnot(radius = 0.4, tube = 0.12, p = 2, q = 3, pathSegments = 640, tubeSegments = 96): MeshData {
    const center: Point = [0, 0, 0];
    const ahead: Point = [0, 0, 0];
    const knotPoint = (t: number, out: Point): void => {
        const angle = t * TWO_PI;
        const r = radius * (2 + Math.cos(q * angle)) * 0.5;
        out[0] = r * Math.cos(p * angle);
        out[1] = radius * 0.5 * Math.sin(q * angle);
        out[2] = r * Math.sin(p * angle);
    };
    return sampleSurface('Nó toroidal', pathSegments, tubeSegments, (u, v, out) => {
        knotPoint(u, center);
        knotPoint(u + 0.001, ahead);
        let tx = ahead[0] - center[0];
        let ty = ahead[1] - center[1];
        let tz = ahead[2] - center[2];
        const tLength = Math.hypot(tx, ty, tz) || 1;
        tx /= tLength;
        ty /= tLength;
        tz /= tLength;
        let nx = ahead[0] + center[0];
        let ny = ahead[1] + center[1];
        let nz = ahead[2] + center[2];
        const bx = ty * nz - tz * ny;
        const by = tz * nx - tx * nz;
        const bz = tx * ny - ty * nx;
        const bLength = Math.hypot(bx, by, bz) || 1;
        nx = by * tz - bz * ty;
        ny = bz * tx - bx * tz;
        nz = bx * ty - by * tx;
        const nLength = Math.hypot(nx, ny, nz) || 1;
        const phi = v * TWO_PI;
        const cx = Math.cos(phi) * tube;
        const cy = -Math.sin(phi) * tube;
        out[0] = center[0] + (nx / nLength) * cx + (bx / bLength) * cy;
        out[1] = center[1] + (ny / nLength) * cx + (by / bLength) * cy;
        out[2] = center[2] + (nz / nLength) * cx + (bz / bLength) * cy;
    });
}
export function createFlutedColumn(radius = 0.3, height = 1.4, radialSegments = 384, heightSegments = 192, flutes = 20): MeshData {
    return sampleSurface('Coluna canelada', radialSegments, heightSegments, (u, v, out) => {
        const theta = u * TWO_PI;
        const profile = Math.sin(v * Math.PI);
        const cap = Math.pow(Math.min(1, profile * 3), 0.5);
        const fluting = 1 - Math.pow(Math.abs(Math.sin(theta * flutes * 0.5)), 0.6) * 0.12;
        const r = radius * cap * fluting;
        out[0] = -Math.cos(theta) * r;
        out[1] = (v - 0.5) * height;
        out[2] = Math.sin(theta) * r;
    });
}
