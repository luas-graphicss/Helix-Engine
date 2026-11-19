const MIN_AREA_SHARE = 1e-8;
const TRIANGLE_CORNERS = 3;
export function computeAreaShares(positions: Float32Array, triangles: Uint32Array): Float32Array {
    const shares = new Float32Array(positions.length / 3);
    for (let corner = 0; corner < triangles.length; corner += 3) {
        const a = triangles[corner] * 3;
        const b = triangles[corner + 1] * 3;
        const c = triangles[corner + 2] * 3;
        const abx = positions[b] - positions[a];
        const aby = positions[b + 1] - positions[a + 1];
        const abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a];
        const acy = positions[c + 1] - positions[a + 1];
        const acz = positions[c + 2] - positions[a + 2];
        const area = Math.hypot(aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx) / 2;
        const share = area / TRIANGLE_CORNERS;
        shares[triangles[corner]] += share;
        shares[triangles[corner + 1]] += share;
        shares[triangles[corner + 2]] += share;
    }
    for (let particle = 0; particle < shares.length; particle++)
        shares[particle] = Math.max(shares[particle], MIN_AREA_SHARE);
    return shares;
}
export function assignInverseMasses(inverseMasses: Float32Array, areaShares: Float32Array, density: number, anchored: Uint8Array): void {
    for (let particle = 0; particle < inverseMasses.length; particle++)
        inverseMasses[particle] = anchored[particle] === 1 ? 0 : 1 / (areaShares[particle] * density);
}
export function averageInverseMass(inverseMasses: Float32Array): number {
    let total = 0;
    let free = 0;
    for (const inverseMass of inverseMasses) {
        if (inverseMass === 0)
            continue;
        total += inverseMass;
        free++;
    }
    return free > 0 ? total / free : 0;
}
