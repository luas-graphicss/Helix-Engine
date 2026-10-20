import { latticeHash, wrap } from './lattice-hash';
export function worley2(x: number, y: number, cells: number, seed: number): number {
    const px = x * cells;
    const py = y * cells;
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    let minDistanceSq = Infinity;
    for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
            const ix = cx + ox;
            const iy = cy + oy;
            const wx = wrap(ix, cells);
            const wy = wrap(iy, cells);
            const fx = ix + latticeHash(wx, wy, 0, seed);
            const fy = iy + latticeHash(wx, wy, 1, seed);
            const dx = fx - px;
            const dy = fy - py;
            minDistanceSq = Math.min(minDistanceSq, dx * dx + dy * dy);
        }
    }
    return 1 - Math.min(Math.sqrt(minDistanceSq), 1);
}
export function worley3(x: number, y: number, z: number, cells: number, seed: number): number {
    const px = x * cells;
    const py = y * cells;
    const pz = z * cells;
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    const cz = Math.floor(pz);
    let minDistanceSq = Infinity;
    for (let oz = -1; oz <= 1; oz++) {
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const ix = cx + ox;
                const iy = cy + oy;
                const iz = cz + oz;
                const wx = wrap(ix, cells);
                const wy = wrap(iy, cells);
                const wz = wrap(iz, cells);
                const dx = ix + latticeHash(wx, wy, wz, seed) - px;
                const dy = iy + latticeHash(wx, wy, wz, seed + 1) - py;
                const dz = iz + latticeHash(wx, wy, wz, seed + 2) - pz;
                minDistanceSq = Math.min(minDistanceSq, dx * dx + dy * dy + dz * dz);
            }
        }
    }
    return 1 - Math.min(Math.sqrt(minDistanceSq), 1);
}
