import type { ClothAnchor } from '@/engine/cloth/cloth-settings';
type AttachedAnchor = Exclude<ClothAnchor, 'none'>;
interface AnchorFrame {
    readonly sideAxis: number;
    readonly sideMin: number;
    readonly sideExtent: number;
    readonly heightAxis: number;
    readonly heightMin: number;
    readonly heightExtent: number;
    readonly heightGrowsUp: boolean;
}
const X_AXIS = 0;
const Y_AXIS = 1;
const Z_AXIS = 2;
const EDGE_TOLERANCE = 1e-3;
const FLAT_EXTENT_RATIO = 1e-4;
function measureFrame(restPositions: Float32Array): AnchorFrame {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let offset = 0; offset < restPositions.length; offset += 3) {
        for (let axis = 0; axis < 3; axis++) {
            const coordinate = restPositions[offset + axis];
            if (coordinate < min[axis])
                min[axis] = coordinate;
            if (coordinate > max[axis])
                max[axis] = coordinate;
        }
    }
    const extent = [max[X_AXIS] - min[X_AXIS], max[Y_AXIS] - min[Y_AXIS], max[Z_AXIS] - min[Z_AXIS]];
    const flat = Math.max(...extent) * FLAT_EXTENT_RATIO;
    const heightAxis = extent[Y_AXIS] > flat ? Y_AXIS : Z_AXIS;
    const sideAxis = extent[X_AXIS] > flat || heightAxis === Z_AXIS ? X_AXIS : Z_AXIS;
    return {
        sideAxis,
        sideMin: min[sideAxis],
        sideExtent: extent[sideAxis],
        heightAxis,
        heightMin: min[heightAxis],
        heightExtent: extent[heightAxis],
        heightGrowsUp: heightAxis === Y_AXIS,
    };
}
function fraction(coordinate: number, min: number, extent: number): number {
    return extent > 0 ? (coordinate - min) / extent : 0;
}
function depthFromAnchor(anchor: AttachedAnchor, side: number, height: number): number {
    switch (anchor) {
        case 'top':
            return 1 - height;
        case 'bottom':
            return height;
        case 'left':
            return side;
        case 'right':
            return 1 - side;
        case 'corners':
            return Math.max(Math.min(side, 1 - side), Math.min(height, 1 - height));
    }
}
export function selectAnchoredParticles(restPositions: Float32Array, anchor: ClothAnchor, band: number): Uint8Array {
    const anchored = new Uint8Array(restPositions.length / 3);
    if (anchor === 'none' || anchored.length === 0)
        return anchored;
    const frame = measureFrame(restPositions);
    const reach = Math.max(band, EDGE_TOLERANCE);
    for (let particle = 0; particle < anchored.length; particle++) {
        const side = fraction(restPositions[particle * 3 + frame.sideAxis], frame.sideMin, frame.sideExtent);
        const along = fraction(restPositions[particle * 3 + frame.heightAxis], frame.heightMin, frame.heightExtent);
        const height = frame.heightGrowsUp ? along : 1 - along;
        if (depthFromAnchor(anchor, side, height) <= reach)
            anchored[particle] = 1;
    }
    return anchored;
}
