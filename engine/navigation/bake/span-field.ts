import { NULL_AREA } from '../mesh/nav-cells';
export const NO_SPAN = -1;
const INITIAL_CAPACITY = 4096;
function mergedArea(area: number, other: number): number {
    if (area === NULL_AREA)
        return other;
    return other === NULL_AREA ? area : Math.max(area, other);
}
function mergedSurface(area: number, surface: number, otherArea: number, otherSurface: number): number {
    if (area === NULL_AREA && otherArea !== NULL_AREA)
        return otherSurface;
    if (otherArea === NULL_AREA && area !== NULL_AREA)
        return surface;
    return Math.max(surface, otherSurface);
}
export class SpanField {
    readonly first: Int32Array;
    mins = new Float32Array(INITIAL_CAPACITY);
    maxs = new Float32Array(INITIAL_CAPACITY);
    surfaces = new Float32Array(INITIAL_CAPACITY);
    areas = new Uint8Array(INITIAL_CAPACITY);
    next = new Int32Array(INITIAL_CAPACITY);
    private used = 0;
    private freeHead = NO_SPAN;
    constructor(columnCount: number, private readonly mergeThreshold: number) {
        this.first = new Int32Array(columnCount).fill(NO_SPAN);
    }
    add(column: number, min: number, max: number, surface: number, area: number): void {
        const { first, mins, maxs, surfaces, areas, next } = this;
        let low = min;
        let high = max;
        let top = surface;
        let kind = area;
        let previous = NO_SPAN;
        let current = first[column];
        while (current !== NO_SPAN) {
            if (mins[current] > high)
                break;
            if (maxs[current] < low) {
                previous = current;
                current = next[current];
                continue;
            }
            const currentHigh = maxs[current];
            if (Math.abs(high - currentHigh) <= this.mergeThreshold) {
                top = mergedSurface(kind, top, areas[current], surfaces[current]);
                kind = mergedArea(kind, areas[current]);
            }
            else if (currentHigh > high) {
                top = surfaces[current];
                kind = areas[current];
            }
            low = Math.min(low, mins[current]);
            high = Math.max(high, currentHigh);
            const following = next[current];
            this.release(current);
            if (previous === NO_SPAN)
                first[column] = following;
            else
                next[previous] = following;
            current = following;
        }
        const span = this.allocate();
        this.mins[span] = low;
        this.maxs[span] = high;
        this.surfaces[span] = top;
        this.areas[span] = kind;
        if (previous === NO_SPAN) {
            this.next[span] = first[column];
            first[column] = span;
            return;
        }
        this.next[span] = this.next[previous];
        this.next[previous] = span;
    }
    private release(span: number): void {
        this.next[span] = this.freeHead;
        this.freeHead = span;
    }
    private allocate(): number {
        if (this.freeHead !== NO_SPAN) {
            const span = this.freeHead;
            this.freeHead = this.next[span];
            return span;
        }
        if (this.used === this.mins.length)
            this.grow();
        return this.used++;
    }
    private grow(): void {
        const capacity = this.mins.length * 2;
        const mins = new Float32Array(capacity);
        const maxs = new Float32Array(capacity);
        const surfaces = new Float32Array(capacity);
        const areas = new Uint8Array(capacity);
        const next = new Int32Array(capacity);
        mins.set(this.mins);
        maxs.set(this.maxs);
        surfaces.set(this.surfaces);
        areas.set(this.areas);
        next.set(this.next);
        this.mins = mins;
        this.maxs = maxs;
        this.surfaces = surfaces;
        this.areas = areas;
        this.next = next;
    }
}
