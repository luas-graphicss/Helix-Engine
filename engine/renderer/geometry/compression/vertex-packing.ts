const COMPONENT_SCALE = 511;
const COMPONENT_MASK = 0x3ff;
const COMPONENT_SIGN = 0x200;
const POSITIVE_HANDEDNESS = 1;
const NEGATIVE_HANDEDNESS = 3;
const UNIT_SCALE = 0xffff;
function packComponent(value: number): number {
    return Math.round(Math.max(-1, Math.min(1, value)) * COMPONENT_SCALE) & COMPONENT_MASK;
}
function unpackComponent(bits: number): number {
    const signed = bits & COMPONENT_SIGN ? bits - (COMPONENT_MASK + 1) : bits;
    return Math.max(signed / COMPONENT_SCALE, -1);
}
export function packUnitVectors(source: ArrayLike<number>, stride: 3 | 4): Uint32Array {
    const count = Math.floor(source.length / stride);
    const packed = new Uint32Array(count);
    for (let vertex = 0; vertex < count; vertex++) {
        const offset = vertex * stride;
        const x = source[offset];
        const y = source[offset + 1];
        const z = source[offset + 2];
        const scale = 1 / (Math.hypot(x, y, z) || 1);
        const handedness = stride === 4 && source[offset + 3] < 0 ? NEGATIVE_HANDEDNESS : POSITIVE_HANDEDNESS;
        packed[vertex] = (packComponent(x * scale) | (packComponent(y * scale) << 10) | (packComponent(z * scale) << 20) | (handedness << 30)) >>> 0;
    }
    return packed;
}
export function unpackUnitVector(packed: number, out: Float32Array): Float32Array {
    out[0] = unpackComponent(packed & COMPONENT_MASK);
    out[1] = unpackComponent((packed >>> 10) & COMPONENT_MASK);
    out[2] = unpackComponent((packed >>> 20) & COMPONENT_MASK);
    out[3] = packed >>> 30 === NEGATIVE_HANDEDNESS ? -1 : 1;
    return out;
}
export function packUnitInterval(values: ArrayLike<number>): Uint16Array | null {
    const packed = new Uint16Array(values.length);
    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        if (!(value >= 0 && value <= 1))
            return null;
        packed[index] = Math.round(value * UNIT_SCALE);
    }
    return packed;
}
