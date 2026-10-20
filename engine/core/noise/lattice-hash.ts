function mixBits(value: number): number {
    let x = value >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
}
const INV_UINT32 = 1 / 4294967296;
export function wrap(index: number, period: number): number {
    return ((index % period) + period) % period;
}
export function latticeHash(x: number, y: number, z: number, seed: number): number {
    const h = mixBits(Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(seed, 0x9e3779b1));
    return h * INV_UINT32;
}
