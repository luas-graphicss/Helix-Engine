import { createMeshData, type MeshData } from './mesh-data';
const TWO_PI = Math.PI * 2;
interface SurfaceSample {
    position: [
        number,
        number,
        number
    ];
    normal: [
        number,
        number,
        number
    ];
}
class MeshBuilder {
    readonly positions: number[] = [];
    readonly normals: number[] = [];
    readonly uvs: number[] = [];
    readonly indices: number[] = [];
    get vertexCount(): number {
        return this.positions.length / 3;
    }
    vertex(px: number, py: number, pz: number, nx: number, ny: number, nz: number, u: number, v: number): number {
        this.positions.push(px, py, pz);
        this.normals.push(nx, ny, nz);
        this.uvs.push(u, v);
        return this.vertexCount - 1;
    }
    triangle(a: number, b: number, c: number): void {
        this.indices.push(a, b, c);
    }
    grid(uSegments: number, vSegments: number, sample: (u: number, v: number) => SurfaceSample): void {
        const base = this.vertexCount;
        for (let iv = 0; iv <= vSegments; iv++) {
            const v = iv / vSegments;
            for (let iu = 0; iu <= uSegments; iu++) {
                const u = iu / uSegments;
                const { position, normal } = sample(u, v);
                this.vertex(position[0], position[1], position[2], normal[0], normal[1], normal[2], u, v);
            }
        }
        const stride = uSegments + 1;
        for (let iv = 0; iv < vSegments; iv++) {
            for (let iu = 0; iu < uSegments; iu++) {
                const a = base + iv * stride + iu;
                const b = a + stride;
                this.triangle(a, b, a + 1);
                this.triangle(b, b + 1, a + 1);
            }
        }
    }
    disc(y: number, radius: number, segments: number, facingUp: boolean): void {
        const ny = facingUp ? 1 : -1;
        const center = this.vertex(0, y, 0, 0, ny, 0, 0.5, 0.5);
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * TWO_PI;
            const c = -Math.cos(theta);
            const s = Math.sin(theta);
            this.vertex(c * radius, y, s * radius, 0, ny, 0, 0.5 + c * 0.5, 0.5 + s * 0.5);
        }
        for (let i = 0; i < segments; i++) {
            const a = center + 1 + i;
            if (facingUp)
                this.triangle(center, a, a + 1);
            else
                this.triangle(center, a + 1, a);
        }
    }
    build(name: string): MeshData {
        return createMeshData(name, this.positions, this.normals, this.uvs, this.indices);
    }
}
export function createBox(width = 1, height = 1, depth = 1, uvTileSize?: number): MeshData {
    const hx = width / 2;
    const hy = height / 2;
    const hz = depth / 2;
    const builder = new MeshBuilder();
    const faces: Array<{
        normal: [
            number,
            number,
            number
        ];
        corners: Array<[
            number,
            number,
            number
        ]>;
        size: [
            number,
            number
        ];
    }> = [
        { normal: [0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], size: [width, height] },
        { normal: [0, 0, -1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], size: [width, height] },
        { normal: [1, 0, 0], corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], size: [depth, height] },
        { normal: [-1, 0, 0], corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], size: [depth, height] },
        { normal: [0, 1, 0], corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], size: [width, depth] },
        { normal: [0, -1, 0], corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], size: [width, depth] },
    ];
    const cornerUvs: Array<[
        number,
        number
    ]> = [[0, 1], [1, 1], [1, 0], [0, 0]];
    for (const face of faces) {
        const base = builder.vertexCount;
        const tilesU = uvTileSize ? face.size[0] / uvTileSize : 1;
        const tilesV = uvTileSize ? face.size[1] / uvTileSize : 1;
        face.corners.forEach((corner, i) => {
            builder.vertex(corner[0], corner[1], corner[2], face.normal[0], face.normal[1], face.normal[2], cornerUvs[i][0] * tilesU, cornerUvs[i][1] * tilesV);
        });
        builder.triangle(base, base + 1, base + 2);
        builder.triangle(base, base + 2, base + 3);
    }
    return builder.build('Caixa');
}
const ROUNDED_BOX_BAND_SEGMENTS = 4;
function roundedAxisSamples(half: number, radius: number): number[] {
    const inner = Math.max(half - radius, 0);
    const samples: number[] = [];
    for (let i = ROUNDED_BOX_BAND_SEGMENTS; i >= 1; i--) {
        samples.push(-inner - radius * Math.tan((i / ROUNDED_BOX_BAND_SEGMENTS) * (Math.PI / 4)));
    }
    samples.push(-inner);
    if (inner > 0)
        samples.push(inner);
    for (let i = 1; i <= ROUNDED_BOX_BAND_SEGMENTS; i++) {
        samples.push(inner + radius * Math.tan((i / ROUNDED_BOX_BAND_SEGMENTS) * (Math.PI / 4)));
    }
    return samples;
}
export function createRoundedBox(width = 1, height = 1, depth = 1, radius = 0.1): MeshData {
    const half = [width / 2, height / 2, depth / 2];
    const r = Math.min(radius, half[0], half[1], half[2]);
    if (r <= 0)
        return createBox(width, height, depth);
    const inner = [half[0] - r, half[1] - r, half[2] - r];
    const builder = new MeshBuilder();
    const point = [0, 0, 0];
    const normal = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
        const uAxis = (axis + 1) % 3;
        const vAxis = (axis + 2) % 3;
        const uSamples = roundedAxisSamples(half[uAxis], r);
        const vSamples = roundedAxisSamples(half[vAxis], r);
        for (const sign of [1, -1]) {
            const base = builder.vertexCount;
            for (let j = 0; j < vSamples.length; j++) {
                for (let i = 0; i < uSamples.length; i++) {
                    point[axis] = sign * half[axis];
                    point[uAxis] = uSamples[i];
                    point[vAxis] = vSamples[j];
                    let lengthSquared = 0;
                    for (let k = 0; k < 3; k++) {
                        const clamped = Math.max(-inner[k], Math.min(inner[k], point[k]));
                        normal[k] = point[k] - clamped;
                        point[k] = clamped;
                        lengthSquared += normal[k] * normal[k];
                    }
                    const invLength = 1 / Math.sqrt(lengthSquared);
                    for (let k = 0; k < 3; k++) {
                        normal[k] *= invLength;
                        point[k] += normal[k] * r;
                    }
                    builder.vertex(point[0], point[1], point[2], normal[0], normal[1], normal[2], i / (uSamples.length - 1), 1 - j / (vSamples.length - 1));
                }
            }
            const stride = uSamples.length;
            for (let j = 0; j < vSamples.length - 1; j++) {
                for (let i = 0; i < uSamples.length - 1; i++) {
                    const a = base + j * stride + i;
                    const b = a + 1;
                    const c = a + stride;
                    const d = c + 1;
                    if (sign > 0) {
                        builder.triangle(a, b, c);
                        builder.triangle(b, d, c);
                    }
                    else {
                        builder.triangle(a, c, b);
                        builder.triangle(b, c, d);
                    }
                }
            }
        }
    }
    return builder.build('CaixaArredondada');
}
export function createPlane(width = 1, depth = 1, segments = 1): MeshData {
    const builder = new MeshBuilder();
    builder.grid(segments, segments, (u, v) => ({
        position: [(u - 0.5) * width, 0, (v - 0.5) * depth],
        normal: [0, 1, 0],
    }));
    return builder.build('Plano');
}
export function createSphere(radius = 0.5, widthSegments = 32, heightSegments = 16): MeshData {
    const builder = new MeshBuilder();
    builder.grid(widthSegments, heightSegments, (u, v) => {
        const theta = u * TWO_PI;
        const phi = v * Math.PI;
        const nx = -Math.cos(theta) * Math.sin(phi);
        const ny = Math.cos(phi);
        const nz = Math.sin(theta) * Math.sin(phi);
        return { position: [nx * radius, ny * radius, nz * radius], normal: [nx, ny, nz] };
    });
    return builder.build('Esfera');
}
export function createCylinder(radius = 0.5, height = 1, radialSegments = 32): MeshData {
    const hy = height / 2;
    const builder = new MeshBuilder();
    builder.grid(radialSegments, 1, (u, v) => {
        const theta = u * TWO_PI;
        const c = -Math.cos(theta);
        const s = Math.sin(theta);
        return { position: [c * radius, hy - v * height, s * radius], normal: [c, 0, s] };
    });
    builder.disc(hy, radius, radialSegments, true);
    builder.disc(-hy, radius, radialSegments, false);
    return builder.build('Cilindro');
}
export function createCone(radius = 0.5, height = 1, radialSegments = 32): MeshData {
    const hy = height / 2;
    const slant = Math.hypot(radius, height) || 1;
    const builder = new MeshBuilder();
    builder.grid(radialSegments, 1, (u, v) => {
        const theta = u * TWO_PI;
        const c = -Math.cos(theta);
        const s = Math.sin(theta);
        const ringRadius = radius * v;
        return {
            position: [c * ringRadius, hy - v * height, s * ringRadius],
            normal: [(c * height) / slant, radius / slant, (s * height) / slant],
        };
    });
    builder.disc(-hy, radius, radialSegments, false);
    return builder.build('Cone');
}
export function createTorus(radius = 0.5, tube = 0.2, radialSegments = 48, tubularSegments = 24): MeshData {
    const builder = new MeshBuilder();
    builder.grid(radialSegments, tubularSegments, (u, v) => {
        const theta = u * TWO_PI;
        const phi = v * TWO_PI;
        const rx = -Math.cos(theta);
        const rz = Math.sin(theta);
        const cosPhi = Math.cos(phi);
        const sinPhi = -Math.sin(phi);
        const nx = rx * cosPhi;
        const ny = sinPhi;
        const nz = rz * cosPhi;
        return {
            position: [rx * radius + nx * tube, ny * tube, rz * radius + nz * tube],
            normal: [nx, ny, nz],
        };
    });
    return builder.build('Toro');
}
export function createCapsule(radius = 0.25, height = 0.5, radialSegments = 32, capSegments = 8): MeshData {
    const hh = height / 2;
    const builder = new MeshBuilder();
    const rings = capSegments * 2 + 1;
    builder.grid(radialSegments, rings, (u, v) => {
        const theta = u * TWO_PI;
        const ring = Math.round(v * rings);
        const topHalf = ring <= capSegments;
        const t = topHalf ? ring / capSegments : (ring - capSegments - 1) / capSegments;
        const phi = topHalf ? t * (Math.PI / 2) : Math.PI / 2 + t * (Math.PI / 2);
        const nx = -Math.cos(theta) * Math.sin(phi);
        const ny = Math.cos(phi);
        const nz = Math.sin(theta) * Math.sin(phi);
        const offset = topHalf ? hh : -hh;
        return { position: [nx * radius, ny * radius + offset, nz * radius], normal: [nx, ny, nz] };
    });
    return builder.build('Cápsula');
}
