export class FloatKeyTable {
    private readonly keyLength: number;
    private slots: Int32Array;
    private mask: number;
    private count = 0;
    private readonly scratch = new Float32Array(1);
    private readonly scratchBits = new Int32Array(this.scratch.buffer);
    constructor(keyLength: number, capacityHint: number) {
        this.keyLength = keyLength;
        let capacity = 16;
        while (capacity < capacityHint * 2)
            capacity *= 2;
        this.slots = new Int32Array(capacity).fill(-1);
        this.mask = capacity - 1;
    }
    insert(store: Float32Array, index: number): number {
        if ((this.count + 1) * 2 > this.slots.length)
            this.grow(store);
        const { slots, mask } = this;
        let slot = this.hash(store, index) & mask;
        for (;;) {
            const existing = slots[slot];
            if (existing === -1) {
                slots[slot] = index;
                this.count++;
                return index;
            }
            if (this.equals(store, existing, index))
                return existing;
            slot = (slot + 1) & mask;
        }
    }
    private hash(store: Float32Array, index: number): number {
        const base = index * this.keyLength;
        let h = 0x811c9dc5;
        for (let i = 0; i < this.keyLength; i++) {
            const value = store[base + i];
            this.scratch[0] = value === 0 ? 0 : value;
            h = Math.imul(h ^ this.scratchBits[0], 0x01000193);
        }
        return (h ^ (h >>> 15)) >>> 0;
    }
    private equals(store: Float32Array, a: number, b: number): boolean {
        const baseA = a * this.keyLength;
        const baseB = b * this.keyLength;
        for (let i = 0; i < this.keyLength; i++) {
            if (store[baseA + i] !== store[baseB + i])
                return false;
        }
        return true;
    }
    private grow(store: Float32Array): void {
        const old = this.slots;
        this.slots = new Int32Array(old.length * 2).fill(-1);
        this.mask = this.slots.length - 1;
        for (let i = 0; i < old.length; i++) {
            const index = old[i];
            if (index === -1)
                continue;
            let slot = this.hash(store, index) & this.mask;
            while (this.slots[slot] !== -1)
                slot = (slot + 1) & this.mask;
            this.slots[slot] = index;
        }
    }
}
export interface WeldedGeometry {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    positionIds: Int32Array;
    positionCount: number;
}
const KEY_FLOATS = 8;
export function weldGeometry(positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: ArrayLike<number>): WeldedGeometry {
    const vertexCount = positions.length / 3;
    const keys = new Float32Array(vertexCount * KEY_FLOATS);
    for (let v = 0; v < vertexCount; v++) {
        const k = v * KEY_FLOATS;
        keys[k] = positions[v * 3];
        keys[k + 1] = positions[v * 3 + 1];
        keys[k + 2] = positions[v * 3 + 2];
        keys[k + 3] = normals[v * 3];
        keys[k + 4] = normals[v * 3 + 1];
        keys[k + 5] = normals[v * 3 + 2];
        keys[k + 6] = uvs[v * 2];
        keys[k + 7] = uvs[v * 2 + 1];
    }
    const table = new FloatKeyTable(KEY_FLOATS, vertexCount);
    const remap = new Int32Array(vertexCount);
    const outputIndex = new Int32Array(vertexCount).fill(-1);
    let uniqueCount = 0;
    for (let v = 0; v < vertexCount; v++) {
        const representative = table.insert(keys, v);
        if (outputIndex[representative] === -1)
            outputIndex[representative] = uniqueCount++;
        remap[v] = outputIndex[representative];
    }
    const outPositions = new Float32Array(uniqueCount * 3);
    const outNormals = new Float32Array(uniqueCount * 3);
    const outUvs = new Float32Array(uniqueCount * 2);
    for (let v = 0; v < vertexCount; v++) {
        const out = remap[v];
        outPositions[out * 3] = positions[v * 3];
        outPositions[out * 3 + 1] = positions[v * 3 + 1];
        outPositions[out * 3 + 2] = positions[v * 3 + 2];
        outNormals[out * 3] = normals[v * 3];
        outNormals[out * 3 + 1] = normals[v * 3 + 1];
        outNormals[out * 3 + 2] = normals[v * 3 + 2];
        outUvs[out * 2] = uvs[v * 2];
        outUvs[out * 2 + 1] = uvs[v * 2 + 1];
    }
    const positionIds = computePositionIds(outPositions);
    let positionCount = 0;
    for (let i = 0; i < positionIds.length; i++)
        if (positionIds[i] + 1 > positionCount)
            positionCount = positionIds[i] + 1;
    const triangleCount = indices.length / 3;
    const outIndices = new Uint32Array(triangleCount * 3);
    let written = 0;
    for (let t = 0; t < triangleCount; t++) {
        const a = remap[indices[t * 3]], b = remap[indices[t * 3 + 1]], c = remap[indices[t * 3 + 2]];
        if (a === b || b === c || a === c)
            continue;
        const pa = positionIds[a], pb = positionIds[b], pc = positionIds[c];
        if (pa === pb || pb === pc || pa === pc)
            continue;
        outIndices[written++] = a;
        outIndices[written++] = b;
        outIndices[written++] = c;
    }
    return {
        positions: outPositions,
        normals: outNormals,
        uvs: outUvs,
        indices: written === outIndices.length ? outIndices : outIndices.slice(0, written),
        positionIds,
        positionCount,
    };
}
export function computePositionIds(positions: Float32Array): Int32Array {
    const vertexCount = positions.length / 3;
    const table = new FloatKeyTable(3, vertexCount);
    const ids = new Int32Array(vertexCount);
    const idOfRepresentative = new Int32Array(vertexCount).fill(-1);
    let next = 0;
    for (let v = 0; v < vertexCount; v++) {
        const representative = table.insert(positions, v);
        if (idOfRepresentative[representative] === -1)
            idOfRepresentative[representative] = next++;
        ids[v] = idOfRepresentative[representative];
    }
    return ids;
}
