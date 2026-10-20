export class FloatSnapshot {
    private readonly values: Float64Array;
    constructor(size: number) {
        this.values = new Float64Array(size).fill(Number.NaN);
    }
    sync(offset: number, source: ArrayLike<number>): boolean {
        const { values } = this;
        let changed = false;
        for (let i = 0; i < source.length; i++) {
            const value = source[i];
            if (values[offset + i] !== value) {
                values[offset + i] = value;
                changed = true;
            }
        }
        return changed;
    }
    syncScalar(index: number, value: number): boolean {
        if (this.values[index] === value)
            return false;
        this.values[index] = value;
        return true;
    }
}
