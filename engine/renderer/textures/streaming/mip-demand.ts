const MIN_STREAMED_LONG_SIDE = 64;
const MIN_STREAMED_SHORT_SIDE = 4;
export function maxTopLevel(width: number, height: number): number {
    const longSide = Math.max(width, height);
    const shortSide = Math.min(width, height);
    let level = 0;
    while (longSide >> (level + 1) >= MIN_STREAMED_LONG_SIDE && shortSide >> (level + 1) >= MIN_STREAMED_SHORT_SIDE)
        level++;
    return level;
}
export function topLevelForSize(textureSize: number, neededSize: number, maxLevel: number): number {
    if (!(neededSize > 0))
        return maxLevel;
    if (neededSize >= textureSize)
        return 0;
    return Math.min(Math.floor(Math.log2(textureSize / neededSize)), maxLevel);
}
export function neededTextureSize(pixelsPerUnit: number, uvPerUnit: number): number {
    return uvPerUnit > 0 ? pixelsPerUnit / uvPerUnit : Infinity;
}
