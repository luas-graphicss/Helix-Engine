export interface LodSettings {
    enabled: boolean;
    bias: number;
}
export const MESH_LOD_THRESHOLD_PIXELS = 480;
const HYSTERESIS = 0.15;
export function selectLodLevel(pixelSize: number, threshold: number, levelCount: number, bias: number, previousLevel: number): number {
    if (levelCount <= 1)
        return 0;
    const maxLevel = levelCount - 1;
    if (pixelSize <= 0)
        return maxLevel;
    const scaledThreshold = threshold * Math.pow(2, bias);
    const octaves = Math.log2(scaledThreshold / pixelSize) + 1;
    if (octaves < 1)
        return 0;
    let level = Math.min(Math.floor(octaves), maxLevel);
    if (previousLevel < 0 || previousLevel === level || previousLevel > maxLevel)
        return level;
    const fraction = octaves - level;
    if (level > previousLevel && fraction < HYSTERESIS)
        level = previousLevel;
    else if (level < previousLevel && fraction > 1 - HYSTERESIS)
        level = previousLevel;
    return level;
}
