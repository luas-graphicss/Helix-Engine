export type Sphere = Float32Array;
export function sphereFromIndexedVertices(positions: Float32Array, indices: ArrayLike<number>): Sphere {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < indices.length; i++) {
        const v = indices[i] * 3;
        const x = positions[v], y = positions[v + 1], z = positions[v + 2];
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
        if (z < minZ)
            minZ = z;
        if (z > maxZ)
            maxZ = z;
    }
    const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5, cz = (minZ + maxZ) * 0.5;
    let radiusSq = 0;
    for (let i = 0; i < indices.length; i++) {
        const v = indices[i] * 3;
        const dx = positions[v] - cx, dy = positions[v + 1] - cy, dz = positions[v + 2] - cz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d > radiusSq)
            radiusSq = d;
    }
    const sphere = new Float32Array(4);
    sphere[0] = cx;
    sphere[1] = cy;
    sphere[2] = cz;
    sphere[3] = Math.sqrt(radiusSq);
    return sphere;
}
export function encloseSphere(out: Sphere, other: Sphere): Sphere {
    const dx = other[0] - out[0], dy = other[1] - out[1], dz = other[2] - out[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance + other[3] <= out[3])
        return out;
    if (distance + out[3] <= other[3]) {
        out.set(other);
        return out;
    }
    const radius = (distance + out[3] + other[3]) * 0.5;
    const t = (radius - out[3]) / distance;
    out[0] += dx * t;
    out[1] += dy * t;
    out[2] += dz * t;
    out[3] = radius;
    return out;
}
