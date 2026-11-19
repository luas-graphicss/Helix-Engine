export const OCCLUSION_BUFFER_WIDTH = 256;
export const OCCLUSION_BUFFER_HEIGHT = 128;
const GUARD_PIXELS = 1;
const MAX_TEST_TEXELS = 8;
const DEPTH_MARGIN = 1e-3;
interface PyramidLevel {
    readonly width: number;
    readonly height: number;
    readonly depth: Float32Array;
}
function createPyramid(width: number, height: number): PyramidLevel[] {
    const levels: PyramidLevel[] = [{ width, height, depth: new Float32Array(width * height) }];
    let last = levels[0];
    while (last.width > 1 || last.height > 1) {
        const levelWidth = Math.max(1, last.width >> 1);
        const levelHeight = Math.max(1, last.height >> 1);
        last = { width: levelWidth, height: levelHeight, depth: new Float32Array(levelWidth * levelHeight) };
        levels.push(last);
    }
    return levels;
}
function reduceFarthest(source: PyramidLevel, target: PyramidLevel): void {
    const lastColumn = source.width - 1;
    const lastRow = source.height - 1;
    for (let y = 0; y < target.height; y++) {
        const top = Math.min(y * 2, lastRow) * source.width;
        const bottom = Math.min(y * 2 + 1, lastRow) * source.width;
        for (let x = 0; x < target.width; x++) {
            const left = Math.min(x * 2, lastColumn);
            const right = Math.min(x * 2 + 1, lastColumn);
            target.depth[y * target.width + x] = Math.min(source.depth[top + left], source.depth[top + right], source.depth[bottom + left], source.depth[bottom + right]);
        }
    }
}
export class OcclusionBuffer {
    readonly depth: Float32Array;
    private readonly rowFarthest: Float32Array;
    private readonly levels: PyramidLevel[];
    constructor(readonly width: number = OCCLUSION_BUFFER_WIDTH, readonly height: number = OCCLUSION_BUFFER_HEIGHT) {
        this.depth = new Float32Array(width * height);
        this.rowFarthest = new Float32Array(width * height);
        this.levels = createPyramid(width, height);
    }
    clear(): void {
        this.depth.fill(0);
    }
    pixelX(ndcX: number): number {
        return GUARD_PIXELS + (ndcX * 0.5 + 0.5) * (this.width - GUARD_PIXELS * 2);
    }
    pixelY(ndcY: number): number {
        return GUARD_PIXELS + (ndcY * 0.5 + 0.5) * (this.height - GUARD_PIXELS * 2);
    }
    build(): void {
        this.erodeCoverage();
        for (let level = 1; level < this.levels.length; level++)
            reduceFarthest(this.levels[level - 1], this.levels[level]);
    }
    isOccluded(minX: number, minY: number, maxX: number, maxY: number, nearestInverseDepth: number): boolean {
        const x0 = Math.max(GUARD_PIXELS, Math.floor(minX));
        const y0 = Math.max(GUARD_PIXELS, Math.floor(minY));
        const x1 = Math.min(this.width - GUARD_PIXELS - 1, Math.floor(maxX));
        const y1 = Math.min(this.height - GUARD_PIXELS - 1, Math.floor(maxY));
        if (x1 < x0 || y1 < y0)
            return false;
        const span = Math.max(x1 - x0, y1 - y0) + 1;
        let index = 0;
        while (span >> index > MAX_TEST_TEXELS && index < this.levels.length - 1)
            index++;
        const level = this.levels[index];
        const threshold = nearestInverseDepth * (1 + DEPTH_MARGIN);
        const lastColumn = Math.min(x1 >> index, level.width - 1);
        const lastRow = Math.min(y1 >> index, level.height - 1);
        for (let y = y0 >> index; y <= lastRow; y++) {
            const row = y * level.width;
            for (let x = x0 >> index; x <= lastColumn; x++) {
                if (level.depth[row + x] <= threshold)
                    return false;
            }
        }
        return true;
    }
    private erodeCoverage(): void {
        const { width, height, depth, rowFarthest } = this;
        const eroded = this.levels[0].depth;
        const lastColumn = width - 1;
        const lastRow = height - 1;
        for (let y = 0; y < height; y++) {
            const row = y * width;
            for (let x = 0; x < width; x++) {
                const left = depth[row + (x > 0 ? x - 1 : 0)];
                const right = depth[row + (x < lastColumn ? x + 1 : lastColumn)];
                rowFarthest[row + x] = Math.min(left, depth[row + x], right);
            }
        }
        for (let y = 0; y < height; y++) {
            const row = y * width;
            const above = (y > 0 ? y - 1 : 0) * width;
            const below = (y < lastRow ? y + 1 : lastRow) * width;
            for (let x = 0; x < width; x++)
                eroded[row + x] = Math.min(rowFarthest[above + x], rowFarthest[row + x], rowFarthest[below + x]);
        }
    }
}
