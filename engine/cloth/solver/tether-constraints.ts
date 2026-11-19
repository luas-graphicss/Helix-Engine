export interface TetherConstraints {
    readonly particles: Uint32Array;
    readonly anchors: Uint32Array;
    readonly restLengths: Float32Array;
}
function squaredDistance(positions: Float32Array, first: number, second: number): number {
    const dx = positions[first * 3] - positions[second * 3];
    const dy = positions[first * 3 + 1] - positions[second * 3 + 1];
    const dz = positions[first * 3 + 2] - positions[second * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
}
export function createTetherConstraints(restPositions: Float32Array, anchored: Uint8Array): TetherConstraints {
    const anchorParticles: number[] = [];
    anchored.forEach((flag, particle) => {
        if (flag === 1)
            anchorParticles.push(particle);
    });
    const tetherCount = anchorParticles.length > 0 ? anchored.length - anchorParticles.length : 0;
    const particles = new Uint32Array(tetherCount);
    const anchors = new Uint32Array(tetherCount);
    const restLengths = new Float32Array(tetherCount);
    let tether = 0;
    for (let particle = 0; tether < tetherCount; particle++) {
        if (anchored[particle] === 1)
            continue;
        let nearestSquared = Infinity;
        for (const anchor of anchorParticles) {
            const candidate = squaredDistance(restPositions, particle, anchor);
            if (candidate >= nearestSquared)
                continue;
            nearestSquared = candidate;
            anchors[tether] = anchor;
        }
        particles[tether] = particle;
        restLengths[tether] = Math.sqrt(nearestSquared);
        tether++;
    }
    return { particles, anchors, restLengths };
}
export function solveTetherConstraints(positions: Float32Array, tethers: TetherConstraints, slack: number): void {
    const { particles, anchors, restLengths } = tethers;
    const reach = 1 + slack;
    for (let tether = 0; tether < restLengths.length; tether++) {
        const particle = particles[tether] * 3;
        const anchor = anchors[tether] * 3;
        const dx = positions[particle] - positions[anchor];
        const dy = positions[particle + 1] - positions[anchor + 1];
        const dz = positions[particle + 2] - positions[anchor + 2];
        const squaredLength = dx * dx + dy * dy + dz * dz;
        const limit = restLengths[tether] * reach;
        if (squaredLength <= limit * limit)
            continue;
        const scale = limit / Math.sqrt(squaredLength);
        positions[particle] = positions[anchor] + dx * scale;
        positions[particle + 1] = positions[anchor + 1] + dy * scale;
        positions[particle + 2] = positions[anchor + 2] + dz * scale;
    }
}
