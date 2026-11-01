import type { GuiBox } from '@/engine/gui/layout/gui-layout';
export interface GuiSnapGuide {
    readonly axis: 'x' | 'y';
    readonly at: number;
    readonly from: number;
    readonly to: number;
}
export interface GuiSnapResult {
    readonly dx: number;
    readonly dy: number;
    readonly guides: readonly GuiSnapGuide[];
}
export interface GuiSnapOptions {
    readonly threshold: number;
    readonly grid: number | null;
    readonly targets: readonly GuiBox[];
}
export type GuiSnapEdges = 'all' | 'left' | 'right' | 'top' | 'bottom' | 'horizontal' | 'vertical';
interface Candidate {
    readonly value: number;
    readonly from: number;
    readonly to: number;
}
function candidatesOf(targets: readonly GuiBox[], axis: 'x' | 'y'): Candidate[] {
    const list: Candidate[] = [];
    for (const box of targets) {
        if (axis === 'x') {
            const from = box.y;
            const to = box.y + box.height;
            list.push({ value: box.x, from, to }, { value: box.x + box.width / 2, from, to }, { value: box.x + box.width, from, to });
        }
        else {
            const from = box.x;
            const to = box.x + box.width;
            list.push({ value: box.y, from, to }, { value: box.y + box.height / 2, from, to }, { value: box.y + box.height, from, to });
        }
    }
    return list;
}
interface AxisSnap {
    delta: number;
    guides: GuiSnapGuide[];
}
function snapAxis(values: readonly number[], candidates: readonly Candidate[], grid: number | null, threshold: number, axis: 'x' | 'y', span: readonly [
    number,
    number
]): AxisSnap {
    let best: {
        delta: number;
        distance: number;
        guides: GuiSnapGuide[];
    } | null = null;
    for (const value of values) {
        for (const candidate of candidates) {
            const delta = candidate.value - value;
            const distance = Math.abs(delta);
            if (distance > threshold)
                continue;
            if (best && distance > best.distance + 1e-6)
                continue;
            const guide: GuiSnapGuide = { axis, at: candidate.value, from: Math.min(candidate.from, span[0]), to: Math.max(candidate.to, span[1]) };
            if (best && Math.abs(distance - best.distance) <= 1e-6 && Math.abs(best.delta - delta) <= 1e-6)
                best.guides.push(guide);
            else
                best = { delta, distance, guides: [guide] };
        }
    }
    if (!best && grid && grid > 0) {
        for (const value of values) {
            const snapped = Math.round(value / grid) * grid;
            const delta = snapped - value;
            const distance = Math.abs(delta);
            if (distance <= threshold && (!best || distance < best.distance))
                best = { delta, distance, guides: [] };
        }
    }
    return best ? { delta: best.delta, guides: best.guides } : { delta: 0, guides: [] };
}
export function snapBox(moving: GuiBox, options: GuiSnapOptions, edges: GuiSnapEdges = 'all'): GuiSnapResult {
    const xs: number[] = [];
    const ys: number[] = [];
    const wantsX = edges === 'all' || edges === 'left' || edges === 'right' || edges === 'horizontal';
    const wantsY = edges === 'all' || edges === 'top' || edges === 'bottom' || edges === 'vertical';
    if (wantsX) {
        if (edges === 'all' || edges === 'horizontal' || edges === 'left')
            xs.push(moving.x);
        if (edges === 'all' || edges === 'horizontal')
            xs.push(moving.x + moving.width / 2);
        if (edges === 'all' || edges === 'horizontal' || edges === 'right')
            xs.push(moving.x + moving.width);
    }
    if (wantsY) {
        if (edges === 'all' || edges === 'vertical' || edges === 'top')
            ys.push(moving.y);
        if (edges === 'all' || edges === 'vertical')
            ys.push(moving.y + moving.height / 2);
        if (edges === 'all' || edges === 'vertical' || edges === 'bottom')
            ys.push(moving.y + moving.height);
    }
    const x = xs.length > 0 ? snapAxis(xs, candidatesOf(options.targets, 'x'), options.grid, options.threshold, 'x', [moving.y, moving.y + moving.height]) : { delta: 0, guides: [] };
    const y = ys.length > 0 ? snapAxis(ys, candidatesOf(options.targets, 'y'), options.grid, options.threshold, 'y', [moving.x, moving.x + moving.width]) : { delta: 0, guides: [] };
    return { dx: x.delta, dy: y.delta, guides: [...x.guides, ...y.guides] };
}
export function snapValue(value: number, axis: 'x' | 'y', options: GuiSnapOptions, span: readonly [
    number,
    number
]): {
    delta: number;
    guides: readonly GuiSnapGuide[];
} {
    const result = snapAxis([value], candidatesOf(options.targets, axis), options.grid, options.threshold, axis, span);
    return { delta: result.delta, guides: result.guides };
}
