export const QUADRIC_FLOATS = 10;
const SINGULAR_DETERMINANT = 1e-10;
const MIN_DOUBLE_AREA = 1e-14;
const BORDER_EDGE_WEIGHT = 2;
const SEAM_EDGE_WEIGHT = 0.5;
export const KIND_MANIFOLD = 0;
export const KIND_BORDER = 1;
export const KIND_SEAM = 2;
export const KIND_COMPLEX = 3;
export const KIND_LOCKED = 4;
export interface PositionQuadrics {
    quadrics: Float64Array;
    weights: Float64Array;
    deviations: Float64Array;
}
export interface SimplifyInput extends PositionQuadrics {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    positionIds: Int32Array;
    positionCount: number;
    locked: Uint8Array;
    targetTriangles: number;
}
export interface SimplifyOutput extends PositionQuadrics {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    positionIds: Int32Array;
    positionCount: number;
    sourcePosition: Int32Array;
    error: number;
    maxDeviation: number;
}
export function computePlaneQuadrics(positions: Float32Array, indices: Uint32Array, positionIds: Int32Array, positionCount: number): PositionQuadrics {
    const quadrics = new Float64Array(positionCount * QUADRIC_FLOATS);
    const weights = new Float64Array(positionCount);
    for (let t = 0; t < indices.length; t += 3) {
        const ia = indices[t], ib = indices[t + 1], ic = indices[t + 2];
        const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
        const ux = positions[ib * 3] - ax, uy = positions[ib * 3 + 1] - ay, uz = positions[ib * 3 + 2] - az;
        const vx = positions[ic * 3] - ax, vy = positions[ic * 3 + 1] - ay, vz = positions[ic * 3 + 2] - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const doubleArea = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (doubleArea < MIN_DOUBLE_AREA)
            continue;
        nx /= doubleArea;
        ny /= doubleArea;
        nz /= doubleArea;
        const d = -(nx * ax + ny * ay + nz * az);
        const weight = doubleArea * 0.5;
        addPlane(quadrics, weights, positionIds[ia], nx, ny, nz, d, weight);
        addPlane(quadrics, weights, positionIds[ib], nx, ny, nz, d, weight);
        addPlane(quadrics, weights, positionIds[ic], nx, ny, nz, d, weight);
    }
    return { quadrics, weights, deviations: new Float64Array(positionCount) };
}
function addPlane(quadrics: Float64Array, weights: Float64Array, position: number, a: number, b: number, c: number, d: number, w: number): void {
    const o = position * QUADRIC_FLOATS;
    quadrics[o] += a * a * w;
    quadrics[o + 1] += a * b * w;
    quadrics[o + 2] += a * c * w;
    quadrics[o + 3] += a * d * w;
    quadrics[o + 4] += b * b * w;
    quadrics[o + 5] += b * c * w;
    quadrics[o + 6] += b * d * w;
    quadrics[o + 7] += c * c * w;
    quadrics[o + 8] += c * d * w;
    quadrics[o + 9] += d * d * w;
    weights[position] += w;
}
function evaluateQuadric(q: Float64Array, x: number, y: number, z: number): number {
    return (q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x +
        q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y +
        q[7] * z * z + 2 * q[8] * z + q[9]);
}
class CollapseHeap {
    private keys = new Float64Array(1024);
    private edges = new Int32Array(1024);
    private versions = new Int32Array(1024);
    size = 0;
    topEdge = -1;
    topVersion = -1;
    push(key: number, edge: number, version: number): void {
        if (this.size === this.keys.length)
            this.grow();
        let i = this.size++;
        while (i > 0) {
            const parent = (i - 1) >>> 1;
            if (this.keys[parent] <= key)
                break;
            this.keys[i] = this.keys[parent];
            this.edges[i] = this.edges[parent];
            this.versions[i] = this.versions[parent];
            i = parent;
        }
        this.keys[i] = key;
        this.edges[i] = edge;
        this.versions[i] = version;
    }
    pop(): boolean {
        if (this.size === 0)
            return false;
        this.topEdge = this.edges[0];
        this.topVersion = this.versions[0];
        const last = --this.size;
        if (last === 0)
            return true;
        const key = this.keys[last], edge = this.edges[last], version = this.versions[last];
        let i = 0;
        for (;;) {
            let child = i * 2 + 1;
            if (child >= last)
                break;
            if (child + 1 < last && this.keys[child + 1] < this.keys[child])
                child++;
            if (this.keys[child] >= key)
                break;
            this.keys[i] = this.keys[child];
            this.edges[i] = this.edges[child];
            this.versions[i] = this.versions[child];
            i = child;
        }
        this.keys[i] = key;
        this.edges[i] = edge;
        this.versions[i] = version;
        return true;
    }
    private grow(): void {
        const length = this.keys.length * 2;
        const keys = new Float64Array(length);
        const edges = new Int32Array(length);
        const versions = new Int32Array(length);
        keys.set(this.keys);
        edges.set(this.edges);
        versions.set(this.versions);
        this.keys = keys;
        this.edges = edges;
        this.versions = versions;
    }
}
function removeValue(list: number[], value: number): void {
    const index = list.indexOf(value);
    if (index !== -1) {
        list[index] = list[list.length - 1];
        list.pop();
    }
}
class PositionSimplifier {
    private readonly positionCount: number;
    private readonly wedgeCount: number;
    private readonly pos: Float64Array;
    private readonly nrm: Float64Array;
    private readonly uv: Float64Array;
    private readonly wedgePos: Int32Array;
    private readonly kind: Uint8Array;
    private readonly qg: Float64Array;
    private readonly wg: Float64Array;
    private readonly qb: Float64Array;
    private readonly wb: Float64Array;
    private readonly deviation: Float64Array;
    private readonly tris: Int32Array;
    private readonly triAlive: Uint8Array;
    private readonly posTris: number[][];
    private readonly posEdges: number[][];
    private readonly edgeMap = new Map<number, number>();
    private readonly edgeA: Int32Array;
    private readonly edgeB: Int32Array;
    private readonly edgeAlive: Uint8Array;
    private readonly edgeVersion: Int32Array;
    private readonly edgeCost: Float64Array;
    private readonly edgeTarget: Float64Array;
    private readonly edgeGoneIsA: Uint8Array;
    private edgeCount = 0;
    private readonly heap = new CollapseHeap();
    private readonly sum = new Float64Array(QUADRIC_FLOATS);
    private readonly before = new Float64Array(3);
    private readonly after = new Float64Array(3);
    private readonly collapsingTris: number[] = [];
    private readonly mapFrom: number[] = [];
    private readonly mapTo: number[] = [];
    private aliveTriangles: number;
    private readonly targetTriangles: number;
    private error = 0;
    constructor(input: SimplifyInput) {
        const { positions, normals, uvs, indices, positionIds, positionCount } = input;
        this.positionCount = positionCount;
        this.wedgeCount = positions.length / 3;
        this.pos = new Float64Array(positionCount * 3);
        for (let w = 0; w < this.wedgeCount; w++) {
            const p = positionIds[w] * 3;
            this.pos[p] = positions[w * 3];
            this.pos[p + 1] = positions[w * 3 + 1];
            this.pos[p + 2] = positions[w * 3 + 2];
        }
        this.nrm = Float64Array.from(normals);
        this.uv = Float64Array.from(uvs);
        this.wedgePos = positionIds;
        this.qg = Float64Array.from(input.quadrics);
        this.wg = Float64Array.from(input.weights);
        this.qb = new Float64Array(positionCount * QUADRIC_FLOATS);
        this.wb = new Float64Array(positionCount);
        this.deviation = Float64Array.from(input.deviations);
        this.tris = Int32Array.from(indices);
        const triangleCount = indices.length / 3;
        this.triAlive = new Uint8Array(triangleCount).fill(1);
        this.aliveTriangles = triangleCount;
        this.targetTriangles = input.targetTriangles;
        this.posTris = new Array(positionCount);
        this.posEdges = new Array(positionCount);
        for (let p = 0; p < positionCount; p++) {
            this.posTris[p] = [];
            this.posEdges[p] = [];
        }
        const maxEdges = triangleCount * 3;
        this.edgeA = new Int32Array(maxEdges);
        this.edgeB = new Int32Array(maxEdges);
        this.edgeAlive = new Uint8Array(maxEdges);
        this.edgeVersion = new Int32Array(maxEdges);
        this.edgeCost = new Float64Array(maxEdges);
        this.edgeTarget = new Float64Array(maxEdges * 3);
        this.edgeGoneIsA = new Uint8Array(maxEdges);
        const edgeTriangles = new Uint16Array(maxEdges);
        const edgeFirstTri = new Int32Array(maxEdges);
        const edgeWedgeA = new Int32Array(maxEdges);
        const edgeWedgeB = new Int32Array(maxEdges);
        const edgeSeam = new Uint8Array(maxEdges);
        for (let t = 0; t < triangleCount; t++) {
            for (let k = 0; k < 3; k++) {
                const wa = this.tris[t * 3 + k], wb = this.tris[t * 3 + ((k + 1) % 3)];
                const pa = positionIds[wa], pb = positionIds[wb];
                this.posTris[pa].push(t);
                const key = this.edgeKey(pa, pb);
                let e = this.edgeMap.get(key);
                if (e === undefined) {
                    e = this.edgeCount++;
                    this.edgeMap.set(key, e);
                    this.edgeA[e] = Math.min(pa, pb);
                    this.edgeB[e] = Math.max(pa, pb);
                    this.edgeAlive[e] = 1;
                    this.posEdges[pa].push(e);
                    this.posEdges[pb].push(e);
                    edgeFirstTri[e] = t;
                    edgeWedgeA[e] = pa < pb ? wa : wb;
                    edgeWedgeB[e] = pa < pb ? wb : wa;
                }
                else {
                    const sideA = pa === this.edgeA[e] ? wa : wb;
                    const sideB = pa === this.edgeA[e] ? wb : wa;
                    if (sideA !== edgeWedgeA[e] || sideB !== edgeWedgeB[e])
                        edgeSeam[e] = 1;
                }
                edgeTriangles[e]++;
            }
        }
        const openEdges = new Uint16Array(positionCount);
        for (let e = 0; e < this.edgeCount; e++) {
            if (edgeTriangles[e] !== 1)
                continue;
            openEdges[this.edgeA[e]]++;
            openEdges[this.edgeB[e]]++;
        }
        this.kind = this.classify(input.locked, openEdges);
        for (let e = 0; e < this.edgeCount; e++) {
            const a = this.edgeA[e], b = this.edgeB[e];
            if (edgeTriangles[e] === 1) {
                if (this.kind[a] === KIND_LOCKED && this.kind[b] === KIND_LOCKED)
                    continue;
                this.addEdgePenalty(a, b, edgeFirstTri[e], BORDER_EDGE_WEIGHT);
            }
            else if (edgeTriangles[e] === 2 && edgeSeam[e]) {
                this.addEdgePenalty(a, b, edgeFirstTri[e], SEAM_EDGE_WEIGHT);
            }
        }
        for (let e = 0; e < this.edgeCount; e++)
            this.evaluate(e);
    }
    private edgeKey(a: number, b: number): number {
        return a < b ? a * this.positionCount + b : b * this.positionCount + a;
    }
    private classify(locked: Uint8Array, openEdges: Uint16Array): Uint8Array {
        const { wedgeCount, positionCount, tris, wedgePos } = this;
        const wedges = new Int32Array(positionCount);
        const wedge0 = new Int32Array(positionCount).fill(-1);
        const wedge1 = new Int32Array(positionCount).fill(-1);
        for (let w = 0; w < wedgeCount; w++) {
            const p = wedgePos[w];
            if (wedges[p] === 0)
                wedge0[p] = w;
            else if (wedges[p] === 1)
                wedge1[p] = w;
            wedges[p]++;
        }
        const halfEdges = new Set<number>();
        for (let i = 0; i < tris.length; i += 3) {
            halfEdges.add(tris[i] * wedgeCount + tris[i + 1]);
            halfEdges.add(tris[i + 1] * wedgeCount + tris[i + 2]);
            halfEdges.add(tris[i + 2] * wedgeCount + tris[i]);
        }
        const openOut = new Int32Array(wedgeCount).fill(-1);
        const openIn = new Int32Array(wedgeCount).fill(-1);
        for (let i = 0; i < tris.length; i += 3) {
            for (let k = 0; k < 3; k++) {
                const a = tris[i + k], b = tris[i + ((k + 1) % 3)];
                if (halfEdges.has(b * wedgeCount + a))
                    continue;
                openOut[a] = openOut[a] === -1 ? b : -2;
                openIn[b] = openIn[b] === -1 ? a : -2;
            }
        }
        const kind = new Uint8Array(positionCount);
        for (let p = 0; p < positionCount; p++) {
            if (locked[p]) {
                kind[p] = KIND_LOCKED;
            }
            else if (wedges[p] === 1) {
                kind[p] = openEdges[p] === 0 ? KIND_MANIFOLD : openEdges[p] === 2 ? KIND_BORDER : KIND_COMPLEX;
            }
            else if (wedges[p] === 2 && openEdges[p] === 0) {
                const w0 = wedge0[p], w1 = wedge1[p];
                const paired = openOut[w0] >= 0 && openIn[w0] >= 0 && openOut[w1] >= 0 && openIn[w1] >= 0 &&
                    wedgePos[openOut[w0]] === wedgePos[openIn[w1]] && wedgePos[openIn[w0]] === wedgePos[openOut[w1]];
                kind[p] = paired ? KIND_SEAM : KIND_COMPLEX;
            }
            else {
                kind[p] = KIND_COMPLEX;
            }
        }
        return kind;
    }
    private addEdgePenalty(a: number, b: number, t: number, factor: number): void {
        const { pos, tris, wedgePos } = this;
        const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
        const ex = pos[b * 3] - ax, ey = pos[b * 3 + 1] - ay, ez = pos[b * 3 + 2] - az;
        const lengthSq = ex * ex + ey * ey + ez * ez;
        if (lengthSq <= 0)
            return;
        const p0 = wedgePos[tris[t * 3]] * 3, p1 = wedgePos[tris[t * 3 + 1]] * 3, p2 = wedgePos[tris[t * 3 + 2]] * 3;
        const ux = pos[p1] - pos[p0], uy = pos[p1 + 1] - pos[p0 + 1], uz = pos[p1 + 2] - pos[p0 + 2];
        const vx = pos[p2] - pos[p0], vy = pos[p2 + 1] - pos[p0 + 1], vz = pos[p2 + 2] - pos[p0 + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        let px = ey * nz - ez * ny, py = ez * nx - ex * nz, pz = ex * ny - ey * nx;
        const length = Math.sqrt(px * px + py * py + pz * pz);
        if (length < 1e-18)
            return;
        px /= length;
        py /= length;
        pz /= length;
        const d = -(px * ax + py * ay + pz * az);
        addPlane(this.qb, this.wb, a, px, py, pz, d, lengthSq * factor);
        addPlane(this.qb, this.wb, b, px, py, pz, d, lengthSq * factor);
    }
    private validate(gone: number, keep: number): boolean {
        const kg = this.kind[gone], kk = this.kind[keep];
        if (kg === KIND_COMPLEX || kg === KIND_LOCKED)
            return false;
        if (kg === KIND_BORDER && kk !== KIND_BORDER)
            return false;
        if (kg === KIND_SEAM && kk !== KIND_SEAM)
            return false;
        const { tris, triAlive, wedgePos, collapsingTris, mapFrom, mapTo } = this;
        collapsingTris.length = 0;
        mapFrom.length = 0;
        mapTo.length = 0;
        for (const t of this.posTris[gone]) {
            if (!triAlive[t])
                continue;
            let wg = -1, wk = -1;
            for (let k = 0; k < 3; k++) {
                const w = tris[t * 3 + k];
                const p = wedgePos[w];
                if (p === gone)
                    wg = w;
                else if (p === keep)
                    wk = w;
            }
            if (wk === -1)
                continue;
            collapsingTris.push(t);
            const existing = mapFrom.indexOf(wg);
            if (existing === -1) {
                mapFrom.push(wg);
                mapTo.push(wk);
            }
            else if (mapTo[existing] !== wk) {
                return false;
            }
        }
        const n = collapsingTris.length;
        if (n === 0)
            return false;
        if (kg === KIND_BORDER && n !== 1)
            return false;
        if (kg === KIND_SEAM && (n !== 2 || mapFrom.length !== 2 || mapTo[0] === mapTo[1]))
            return false;
        if (kg === KIND_MANIFOLD && mapFrom.length !== 1)
            return false;
        let common = 0;
        const keepLocked = kk === KIND_LOCKED;
        for (const f of this.posEdges[gone]) {
            if (!this.edgeAlive[f])
                continue;
            const other = this.edgeA[f] === gone ? this.edgeB[f] : this.edgeA[f];
            if (other === keep)
                continue;
            if (this.edgeMap.has(this.edgeKey(keep, other)))
                common++;
            else if (keepLocked && this.kind[other] === KIND_LOCKED)
                return false;
        }
        return common === n;
    }
    private costOf(gone: number, keep: number, target: Float64Array, offset: number): number {
        const { pos, sum, qg, qb } = this;
        const og = gone * QUADRIC_FLOATS, ok = keep * QUADRIC_FLOATS;
        for (let i = 0; i < QUADRIC_FLOATS; i++)
            sum[i] = qg[og + i] + qg[ok + i] + qb[og + i] + qb[ok + i];
        const kx = pos[keep * 3], ky = pos[keep * 3 + 1], kz = pos[keep * 3 + 2];
        if (this.kind[gone] === this.kind[keep]) {
            const gx = pos[gone * 3], gy = pos[gone * 3 + 1], gz = pos[gone * 3 + 2];
            const mx = (gx + kx) * 0.5, my = (gy + ky) * 0.5, mz = (gz + kz) * 0.5;
            const edgeLengthSq = (kx - gx) ** 2 + (ky - gy) ** 2 + (kz - gz) ** 2;
            if (solveOptimal(sum, target, offset) && distanceSq(target, offset, mx, my, mz) <= edgeLengthSq) {
                return Math.max(evaluateQuadric(sum, target[offset], target[offset + 1], target[offset + 2]), 0);
            }
            const costG = evaluateQuadric(sum, gx, gy, gz);
            const costK = evaluateQuadric(sum, kx, ky, kz);
            const costM = evaluateQuadric(sum, mx, my, mz);
            if (costM <= costG && costM <= costK) {
                target[offset] = mx;
                target[offset + 1] = my;
                target[offset + 2] = mz;
                return Math.max(costM, 0);
            }
            if (costG <= costK) {
                target[offset] = gx;
                target[offset + 1] = gy;
                target[offset + 2] = gz;
                return Math.max(costG, 0);
            }
        }
        target[offset] = kx;
        target[offset + 1] = ky;
        target[offset + 2] = kz;
        return Math.max(evaluateQuadric(sum, kx, ky, kz), 0);
    }
    private evaluate(e: number): void {
        const a = this.edgeA[e], b = this.edgeB[e];
        const { edgeTarget } = this;
        let bestCost = Infinity;
        let goneIsA = 1;
        if (this.validate(a, b)) {
            bestCost = this.costOf(a, b, edgeTarget, e * 3);
            goneIsA = 1;
        }
        const symmetric = this.kind[a] === this.kind[b];
        if (!symmetric && this.validate(b, a)) {
            const cost = this.costOf(b, a, this.after, 0);
            if (cost < bestCost) {
                bestCost = cost;
                goneIsA = 0;
                edgeTarget[e * 3] = this.after[0];
                edgeTarget[e * 3 + 1] = this.after[1];
                edgeTarget[e * 3 + 2] = this.after[2];
            }
        }
        this.edgeCost[e] = bestCost;
        this.edgeGoneIsA[e] = goneIsA;
        const version = ++this.edgeVersion[e];
        if (Number.isFinite(bestCost))
            this.heap.push(bestCost, e, version);
    }
    run(): void {
        const { heap, edgeAlive, edgeVersion } = this;
        while (this.aliveTriangles > this.targetTriangles && heap.pop()) {
            const e = heap.topEdge;
            if (!edgeAlive[e] || edgeVersion[e] !== heap.topVersion)
                continue;
            this.collapse(e);
        }
    }
    private triangleNormal(t: number, moved: number, mx: number, my: number, mz: number, out: Float64Array): boolean {
        const { tris, pos, wedgePos } = this;
        let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < 3; k++) {
            const p = wedgePos[tris[t * 3 + k]];
            let x: number, y: number, z: number;
            if (p === moved) {
                x = mx;
                y = my;
                z = mz;
            }
            else {
                x = pos[p * 3];
                y = pos[p * 3 + 1];
                z = pos[p * 3 + 2];
            }
            if (k === 0) {
                ax = x;
                ay = y;
                az = z;
            }
            else if (k === 1) {
                bx = x;
                by = y;
                bz = z;
            }
            else {
                cx = x;
                cy = y;
                cz = z;
            }
        }
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        out[0] = uy * vz - uz * vy;
        out[1] = uz * vx - ux * vz;
        out[2] = ux * vy - uy * vx;
        return out[0] * out[0] + out[1] * out[1] + out[2] * out[2] > MIN_DOUBLE_AREA * MIN_DOUBLE_AREA;
    }
    private ringStaysOriented(moved: number, partner: number, tx: number, ty: number, tz: number): boolean {
        const { tris, triAlive, wedgePos, pos, before, after } = this;
        const mx = pos[moved * 3], my = pos[moved * 3 + 1], mz = pos[moved * 3 + 2];
        for (const t of this.posTris[moved]) {
            if (!triAlive[t])
                continue;
            const base = t * 3;
            if (wedgePos[tris[base]] === partner || wedgePos[tris[base + 1]] === partner || wedgePos[tris[base + 2]] === partner)
                continue;
            if (!this.triangleNormal(t, moved, mx, my, mz, before))
                continue;
            if (!this.triangleNormal(t, moved, tx, ty, tz, after))
                return false;
            if (before[0] * after[0] + before[1] * after[1] + before[2] * after[2] <= 0)
                return false;
        }
        return true;
    }
    private reject(e: number): void {
        this.edgeCost[e] = Infinity;
        this.edgeVersion[e]++;
    }
    private collapse(e: number): void {
        const gone = this.edgeGoneIsA[e] ? this.edgeA[e] : this.edgeB[e];
        const keep = this.edgeGoneIsA[e] ? this.edgeB[e] : this.edgeA[e];
        if (!this.validate(gone, keep)) {
            this.evaluate(e);
            return;
        }
        if (this.aliveTriangles - this.collapsingTris.length < 1) {
            this.reject(e);
            return;
        }
        const tx = this.edgeTarget[e * 3], ty = this.edgeTarget[e * 3 + 1], tz = this.edgeTarget[e * 3 + 2];
        const { pos, nrm, uv, qg, wg, qb, wb, tris, triAlive, wedgePos, posTris, posEdges, edgeMap } = this;
        const kx = pos[keep * 3], ky = pos[keep * 3 + 1], kz = pos[keep * 3 + 2];
        const keepMoves = tx !== kx || ty !== ky || tz !== kz;
        if (!this.ringStaysOriented(gone, keep, tx, ty, tz) || (keepMoves && !this.ringStaysOriented(keep, gone, tx, ty, tz))) {
            this.reject(e);
            return;
        }
        if (keepMoves) {
            const gx = pos[gone * 3], gy = pos[gone * 3 + 1], gz = pos[gone * 3 + 2];
            const ex = kx - gx, ey = ky - gy, ez = kz - gz;
            const lengthSq = ex * ex + ey * ey + ez * ez;
            const t = lengthSq > 0 ? Math.min(Math.max(((tx - gx) * ex + (ty - gy) * ey + (tz - gz) * ez) / lengthSq, 0), 1) : 1;
            for (let m = 0; m < this.mapFrom.length; m++) {
                const wgone = this.mapFrom[m], wkeep = this.mapTo[m];
                for (let k = 0; k < 3; k++)
                    nrm[wkeep * 3 + k] = nrm[wgone * 3 + k] + (nrm[wkeep * 3 + k] - nrm[wgone * 3 + k]) * t;
                for (let k = 0; k < 2; k++)
                    uv[wkeep * 2 + k] = uv[wgone * 2 + k] + (uv[wkeep * 2 + k] - uv[wgone * 2 + k]) * t;
            }
            pos[keep * 3] = tx;
            pos[keep * 3 + 1] = ty;
            pos[keep * 3 + 2] = tz;
        }
        const ok = keep * QUADRIC_FLOATS, og = gone * QUADRIC_FLOATS;
        for (let i = 0; i < QUADRIC_FLOATS; i++) {
            qg[ok + i] += qg[og + i];
            qb[ok + i] += qb[og + i];
        }
        wg[keep] += wg[gone];
        wb[keep] += wb[gone];
        const totalWeight = wg[keep] + wb[keep];
        if (totalWeight > 0)
            this.error = Math.max(this.error, Math.sqrt(this.edgeCost[e] / totalWeight));
        const { deviation } = this;
        const goneShift = Math.sqrt((tx - pos[gone * 3]) ** 2 + (ty - pos[gone * 3 + 1]) ** 2 + (tz - pos[gone * 3 + 2]) ** 2);
        const keepShift = Math.sqrt((tx - kx) ** 2 + (ty - ky) ** 2 + (tz - kz) ** 2);
        deviation[keep] = Math.max(deviation[gone] + goneShift, deviation[keep] + keepShift);
        for (const t of posTris[gone]) {
            if (!triAlive[t])
                continue;
            const base = t * 3;
            let touchesKeep = false;
            for (let k = 0; k < 3; k++)
                if (wedgePos[tris[base + k]] === keep)
                    touchesKeep = true;
            if (touchesKeep) {
                triAlive[t] = 0;
                this.aliveTriangles--;
                for (let k = 0; k < 3; k++) {
                    const p = wedgePos[tris[base + k]];
                    if (p !== gone)
                        removeValue(posTris[p], t);
                }
                continue;
            }
            for (let k = 0; k < 3; k++) {
                const w = tris[base + k];
                if (wedgePos[w] === gone)
                    tris[base + k] = this.mapTo[this.mapFrom.indexOf(w)];
            }
            posTris[keep].push(t);
        }
        posTris[gone] = [];
        for (const f of posEdges[gone]) {
            if (!this.edgeAlive[f])
                continue;
            const other = this.edgeA[f] === gone ? this.edgeB[f] : this.edgeA[f];
            edgeMap.delete(this.edgeKey(gone, other));
            if (other === keep) {
                this.edgeAlive[f] = 0;
                removeValue(posEdges[keep], f);
                continue;
            }
            const key = this.edgeKey(keep, other);
            if (edgeMap.has(key)) {
                this.edgeAlive[f] = 0;
                removeValue(posEdges[other], f);
                continue;
            }
            edgeMap.set(key, f);
            this.edgeA[f] = Math.min(keep, other);
            this.edgeB[f] = Math.max(keep, other);
            posEdges[keep].push(f);
        }
        posEdges[gone] = [];
        for (const f of posEdges[keep])
            this.evaluate(f);
    }
    output(): SimplifyOutput {
        const { tris, triAlive, wedgePos, wedgeCount, positionCount } = this;
        const outVertexOf = new Int32Array(wedgeCount).fill(-1);
        const outPositionOf = new Int32Array(positionCount).fill(-1);
        let outVertices = 0;
        let outPositions = 0;
        let outTriangles = 0;
        for (let t = 0; t < triAlive.length; t++) {
            if (!triAlive[t])
                continue;
            outTriangles++;
            for (let k = 0; k < 3; k++) {
                const w = tris[t * 3 + k];
                if (outVertexOf[w] !== -1)
                    continue;
                outVertexOf[w] = outVertices++;
                const p = wedgePos[w];
                if (outPositionOf[p] === -1)
                    outPositionOf[p] = outPositions++;
            }
        }
        const positions = new Float32Array(outVertices * 3);
        const normals = new Float32Array(outVertices * 3);
        const uvs = new Float32Array(outVertices * 2);
        const positionIds = new Int32Array(outVertices);
        const sourcePosition = new Int32Array(outPositions);
        const quadrics = new Float64Array(outPositions * QUADRIC_FLOATS);
        const weights = new Float64Array(outPositions);
        const deviations = new Float64Array(outPositions);
        let maxDeviation = 0;
        for (let w = 0; w < wedgeCount; w++) {
            const out = outVertexOf[w];
            if (out === -1)
                continue;
            const p = wedgePos[w];
            positions[out * 3] = this.pos[p * 3];
            positions[out * 3 + 1] = this.pos[p * 3 + 1];
            positions[out * 3 + 2] = this.pos[p * 3 + 2];
            const nx = this.nrm[w * 3], ny = this.nrm[w * 3 + 1], nz = this.nrm[w * 3 + 2];
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (length > 1e-12) {
                normals[out * 3] = nx / length;
                normals[out * 3 + 1] = ny / length;
                normals[out * 3 + 2] = nz / length;
            }
            else {
                normals[out * 3 + 1] = 1;
            }
            uvs[out * 2] = this.uv[w * 2];
            uvs[out * 2 + 1] = this.uv[w * 2 + 1];
            positionIds[out] = outPositionOf[p];
        }
        for (let p = 0; p < positionCount; p++) {
            const out = outPositionOf[p];
            if (out === -1)
                continue;
            sourcePosition[out] = p;
            for (let i = 0; i < QUADRIC_FLOATS; i++)
                quadrics[out * QUADRIC_FLOATS + i] = this.qg[p * QUADRIC_FLOATS + i];
            weights[out] = this.wg[p];
            deviations[out] = this.deviation[p];
            if (deviations[out] > maxDeviation)
                maxDeviation = deviations[out];
        }
        const indices = new Uint32Array(outTriangles * 3);
        let written = 0;
        for (let t = 0; t < triAlive.length; t++) {
            if (!triAlive[t])
                continue;
            indices[written++] = outVertexOf[tris[t * 3]];
            indices[written++] = outVertexOf[tris[t * 3 + 1]];
            indices[written++] = outVertexOf[tris[t * 3 + 2]];
        }
        return { positions, normals, uvs, indices, positionIds, positionCount: outPositions, sourcePosition, quadrics, weights, deviations, error: this.error, maxDeviation };
    }
}
function solveOptimal(q: Float64Array, out: Float64Array, offset: number): boolean {
    const a = q[0], b = q[1], c = q[2], e = q[4], f = q[5], h = q[7];
    const rx = -q[3], ry = -q[6], rz = -q[8];
    const det = a * (e * h - f * f) - b * (b * h - f * c) + c * (b * f - e * c);
    const scale = Math.max(a, e, h, 1e-300);
    if (Math.abs(det) <= SINGULAR_DETERMINANT * scale * scale * scale)
        return false;
    out[offset] = (rx * (e * h - f * f) - b * (ry * h - f * rz) + c * (ry * f - e * rz)) / det;
    out[offset + 1] = (a * (ry * h - f * rz) - rx * (b * h - f * c) + c * (b * rz - ry * c)) / det;
    out[offset + 2] = (a * (e * rz - ry * f) - b * (b * rz - ry * c) + rx * (b * f - e * c)) / det;
    return Number.isFinite(out[offset]) && Number.isFinite(out[offset + 1]) && Number.isFinite(out[offset + 2]);
}
function distanceSq(points: Float64Array, offset: number, x: number, y: number, z: number): number {
    const dx = points[offset] - x, dy = points[offset + 1] - y, dz = points[offset + 2] - z;
    return dx * dx + dy * dy + dz * dz;
}
export function simplifyEdgeCollapse(input: SimplifyInput): SimplifyOutput {
    const simplifier = new PositionSimplifier(input);
    simplifier.run();
    return simplifier.output();
}
