import { splitPolygon, type CsgPlane, type CsgPolygon } from './csg-polygon';
const HEURISTIC_MIN_POLYGONS = 16;
const PLANE_CANDIDATES = 4;
const SPLIT_COST = 8;
interface BuildJob {
    node: BspNode;
    polygons: CsgPolygon[];
}
interface ClipJob {
    node: BspNode;
    polygons: CsgPolygon[];
}
function planeCost(plane: CsgPlane, polygons: readonly CsgPolygon[]): number {
    let front = 0;
    let back = 0;
    let splits = 0;
    for (const polygon of polygons) {
        let type = 0;
        for (const vertex of polygon.vertices) {
            const distance = plane.distance(vertex);
            type |= distance < -1e-5 ? 2 : distance > 1e-5 ? 1 : 0;
            if (type === 3)
                break;
        }
        if (type === 1)
            front++;
        else if (type === 2)
            back++;
        else if (type === 3)
            splits++;
    }
    return splits * SPLIT_COST + Math.abs(front - back);
}
function choosePlane(polygons: readonly CsgPolygon[]): CsgPlane {
    if (polygons.length < HEURISTIC_MIN_POLYGONS)
        return polygons[0].plane;
    const stride = Math.max(1, Math.floor(polygons.length / PLANE_CANDIDATES));
    let best = polygons[0].plane;
    let bestCost = Infinity;
    for (let i = 0; i < polygons.length && i < stride * PLANE_CANDIDATES; i += stride) {
        const plane = polygons[i].plane;
        const cost = planeCost(plane, polygons);
        if (cost < bestCost) {
            bestCost = cost;
            best = plane;
        }
    }
    return best;
}
export class BspNode {
    plane: CsgPlane | null = null;
    front: BspNode | null = null;
    back: BspNode | null = null;
    polygons: CsgPolygon[] = [];
    static build(polygons: readonly CsgPolygon[]): BspNode {
        const node = new BspNode();
        node.addPolygons(polygons);
        return node;
    }
    addPolygons(polygons: readonly CsgPolygon[]): void {
        if (polygons.length === 0)
            return;
        const stack: BuildJob[] = [{ node: this, polygons: polygons as CsgPolygon[] }];
        while (stack.length > 0) {
            const job = stack.pop() as BuildJob;
            const { node } = job;
            const input = job.polygons;
            if (input.length === 0)
                continue;
            if (!node.plane)
                node.plane = choosePlane(input);
            const plane = node.plane;
            const front: CsgPolygon[] = [];
            const back: CsgPolygon[] = [];
            for (let i = 0; i < input.length; i++)
                splitPolygon(plane, input[i], node.polygons, node.polygons, front, back);
            if (front.length > 0) {
                if (!node.front)
                    node.front = new BspNode();
                stack.push({ node: node.front, polygons: front });
            }
            if (back.length > 0) {
                if (!node.back)
                    node.back = new BspNode();
                stack.push({ node: node.back, polygons: back });
            }
        }
    }
    invert(): void {
        const stack: BspNode[] = [this];
        while (stack.length > 0) {
            const node = stack.pop() as BspNode;
            const { polygons } = node;
            for (let i = 0; i < polygons.length; i++)
                polygons[i] = polygons[i].flip();
            if (node.plane)
                node.plane = node.plane.flip();
            const front = node.front;
            node.front = node.back;
            node.back = front;
            if (node.front)
                stack.push(node.front);
            if (node.back)
                stack.push(node.back);
        }
    }
    clipPolygons(polygons: readonly CsgPolygon[]): CsgPolygon[] {
        const result: CsgPolygon[] = [];
        const stack: ClipJob[] = [{ node: this, polygons: polygons as CsgPolygon[] }];
        while (stack.length > 0) {
            const job = stack.pop() as ClipJob;
            const { node } = job;
            const input = job.polygons;
            if (!node.plane) {
                for (let i = 0; i < input.length; i++)
                    result.push(input[i]);
                continue;
            }
            const front: CsgPolygon[] = [];
            const back: CsgPolygon[] = [];
            for (let i = 0; i < input.length; i++)
                splitPolygon(node.plane, input[i], front, back, front, back);
            if (node.front) {
                if (front.length > 0)
                    stack.push({ node: node.front, polygons: front });
            }
            else {
                for (let i = 0; i < front.length; i++)
                    result.push(front[i]);
            }
            if (node.back && back.length > 0)
                stack.push({ node: node.back, polygons: back });
        }
        return result;
    }
    clipTo(bsp: BspNode): void {
        const stack: BspNode[] = [this];
        while (stack.length > 0) {
            const node = stack.pop() as BspNode;
            if (node.polygons.length > 0)
                node.polygons = bsp.clipPolygons(node.polygons);
            if (node.front)
                stack.push(node.front);
            if (node.back)
                stack.push(node.back);
        }
    }
    allPolygons(): CsgPolygon[] {
        const result: CsgPolygon[] = [];
        const stack: BspNode[] = [this];
        while (stack.length > 0) {
            const node = stack.pop() as BspNode;
            const { polygons } = node;
            for (let i = 0; i < polygons.length; i++)
                result.push(polygons[i]);
            if (node.front)
                stack.push(node.front);
            if (node.back)
                stack.push(node.back);
        }
        return result;
    }
}
export function bspUnion(a: BspNode, b: BspNode): CsgPolygon[] {
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.addPolygons(b.allPolygons());
    return a.allPolygons();
}
export function bspSubtract(a: BspNode, b: BspNode): CsgPolygon[] {
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.addPolygons(b.allPolygons());
    a.invert();
    return a.allPolygons();
}
export function bspIntersect(a: BspNode, b: BspNode): CsgPolygon[] {
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.addPolygons(b.allPolygons());
    a.invert();
    return a.allPolygons();
}
