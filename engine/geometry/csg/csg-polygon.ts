export const CSG_EPSILON = 1e-5;
export interface CsgVertex {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly nx: number;
    readonly ny: number;
    readonly nz: number;
    readonly u: number;
    readonly v: number;
}
export function createVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number): CsgVertex {
    return { x, y, z, nx, ny, nz, u, v };
}
export function flipVertex(vertex: CsgVertex): CsgVertex {
    return { x: vertex.x, y: vertex.y, z: vertex.z, nx: -vertex.nx, ny: -vertex.ny, nz: -vertex.nz, u: vertex.u, v: vertex.v };
}
export function lerpVertex(a: CsgVertex, b: CsgVertex, t: number): CsgVertex {
    let nx = a.nx + (b.nx - a.nx) * t;
    let ny = a.ny + (b.ny - a.ny) * t;
    let nz = a.nz + (b.nz - a.nz) * t;
    const length = Math.hypot(nx, ny, nz);
    if (length > 1e-12) {
        nx /= length;
        ny /= length;
        nz /= length;
    }
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        nx,
        ny,
        nz,
        u: a.u + (b.u - a.u) * t,
        v: a.v + (b.v - a.v) * t,
    };
}
export class CsgPlane {
    constructor(readonly nx: number, readonly ny: number, readonly nz: number, readonly w: number) { }
    static fromPoints(a: CsgVertex, b: CsgVertex, c: CsgVertex): CsgPlane | null {
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const abz = b.z - a.z;
        const acx = c.x - a.x;
        const acy = c.y - a.y;
        const acz = c.z - a.z;
        let nx = aby * acz - abz * acy;
        let ny = abz * acx - abx * acz;
        let nz = abx * acy - aby * acx;
        const length = Math.hypot(nx, ny, nz);
        if (length < 1e-12)
            return null;
        nx /= length;
        ny /= length;
        nz /= length;
        return new CsgPlane(nx, ny, nz, nx * a.x + ny * a.y + nz * a.z);
    }
    flip(): CsgPlane {
        return new CsgPlane(-this.nx, -this.ny, -this.nz, -this.w);
    }
    distance(vertex: CsgVertex): number {
        return this.nx * vertex.x + this.ny * vertex.y + this.nz * vertex.z - this.w;
    }
}
export class CsgPolygon {
    constructor(readonly vertices: readonly CsgVertex[], readonly plane: CsgPlane, readonly shared: number) { }
    static fromVertices(vertices: readonly CsgVertex[], shared: number): CsgPolygon | null {
        if (vertices.length < 3)
            return null;
        const plane = CsgPlane.fromPoints(vertices[0], vertices[1], vertices[2]);
        return plane ? new CsgPolygon(vertices, plane, shared) : null;
    }
    flip(): CsgPolygon {
        const count = this.vertices.length;
        const flipped = new Array<CsgVertex>(count);
        for (let i = 0; i < count; i++)
            flipped[i] = flipVertex(this.vertices[count - 1 - i]);
        return new CsgPolygon(flipped, this.plane.flip(), this.shared);
    }
}
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;
let types = new Int8Array(16);
export function splitPolygon(plane: CsgPlane, polygon: CsgPolygon, coplanarFront: CsgPolygon[], coplanarBack: CsgPolygon[], front: CsgPolygon[], back: CsgPolygon[]): void {
    const { vertices } = polygon;
    const count = vertices.length;
    if (types.length < count)
        types = new Int8Array(count * 2);
    let polygonType = 0;
    for (let i = 0; i < count; i++) {
        const distance = plane.distance(vertices[i]);
        const type = distance < -CSG_EPSILON ? BACK : distance > CSG_EPSILON ? FRONT : COPLANAR;
        polygonType |= type;
        types[i] = type;
    }
    switch (polygonType) {
        case COPLANAR: {
            const sameSide = plane.nx * polygon.plane.nx + plane.ny * polygon.plane.ny + plane.nz * polygon.plane.nz > 0;
            (sameSide ? coplanarFront : coplanarBack).push(polygon);
            break;
        }
        case FRONT:
            front.push(polygon);
            break;
        case BACK:
            back.push(polygon);
            break;
        case SPANNING: {
            const frontVertices: CsgVertex[] = [];
            const backVertices: CsgVertex[] = [];
            for (let i = 0; i < count; i++) {
                const j = (i + 1) % count;
                const typeI = types[i];
                const typeJ = types[j];
                const vi = vertices[i];
                const vj = vertices[j];
                if (typeI !== BACK)
                    frontVertices.push(vi);
                if (typeI !== FRONT)
                    backVertices.push(vi);
                if ((typeI | typeJ) === SPANNING) {
                    const di = plane.distance(vi);
                    const dj = plane.distance(vj);
                    const t = di / (di - dj);
                    const cut = lerpVertex(vi, vj, t);
                    frontVertices.push(cut);
                    backVertices.push(cut);
                }
            }
            if (frontVertices.length >= 3)
                front.push(new CsgPolygon(frontVertices, polygon.plane, polygon.shared));
            if (backVertices.length >= 3)
                back.push(new CsgPolygon(backVertices, polygon.plane, polygon.shared));
            break;
        }
    }
}
