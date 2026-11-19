const HYSTERESIS = 0.1;
export function selectLodGroupLevel(screenHeights: readonly number[], levelCount: number, relativeHeight: number, previousLevel: number | undefined): number {
    let level = levelCount;
    for (let candidate = 0; candidate < levelCount; candidate++) {
        if (relativeHeight >= screenHeights[candidate]) {
            level = candidate;
            break;
        }
    }
    if (previousLevel === undefined || previousLevel === level || previousLevel > levelCount)
        return level;
    if (level > previousLevel)
        return relativeHeight >= screenHeights[level - 1] * (1 - HYSTERESIS) ? level - 1 : level;
    return relativeHeight < screenHeights[level] * (1 + HYSTERESIS) ? level + 1 : level;
}
