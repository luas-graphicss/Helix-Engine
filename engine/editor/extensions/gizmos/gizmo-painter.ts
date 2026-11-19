import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export interface GizmoLine {
    readonly a: Vec3;
    readonly b: Vec3;
    readonly color: Vec3;
    readonly alpha: number;
}
const CIRCLE_SEGMENTS = 32;
const ARROW_HEAD_RATIO = 0.2;
const ARROW_HEAD_MAX_LENGTH = 0.5;
const ARROW_HEAD_SPREAD = 0.5;
const PARALLEL_LIMIT = 0.99;
const MIN_LENGTH = 1e-6;
const DEFAULT_COLOR = vec3.create(1, 0.8, 0.2);
const AXES: readonly Vec3[] = [vec3.create(1, 0, 0), vec3.create(0, 1, 0), vec3.create(0, 0, 1)];
const EDGE_BITS = [1, 2, 4] as const;
function perpendicularTo(direction: Vec3): Vec3 {
    const reference = Math.abs(direction[1]) < PARALLEL_LIMIT ? AXES[1] : AXES[0];
    return vec3.normalize(vec3.create(), vec3.cross(vec3.create(), reference, direction));
}
export class GizmoPainter {
    readonly lines: GizmoLine[] = [];
    private color: Vec3 = DEFAULT_COLOR;
    private alpha = 1;
    private matrix: Mat4 | null = null;
    constructor(private readonly maxLines: number) { }
    get isFull(): boolean {
        return this.lines.length >= this.maxLines;
    }
    reset(): void {
        this.lines.length = 0;
        this.matrix = null;
        this.resetStyle();
    }
    resetStyle(): void {
        this.color = DEFAULT_COLOR;
        this.alpha = 1;
    }
    setColor(color: Vec3, alpha = 1): void {
        this.color = color;
        this.alpha = Math.min(1, Math.max(0, alpha));
    }
    withMatrix(matrix: Mat4, paint: () => void): void {
        const previous = this.matrix;
        this.matrix = previous ? mat4.multiply(mat4.create(), previous, matrix) : matrix;
        try {
            paint();
        }
        finally {
            this.matrix = previous;
        }
    }
    line(a: Vec3, b: Vec3): void {
        if (this.isFull)
            return;
        this.lines.push({ a: this.toWorld(a), b: this.toWorld(b), color: this.color, alpha: this.alpha });
    }
    polyline(points: readonly Vec3[], closed = false): void {
        for (let index = 1; index < points.length; index++)
            this.line(points[index - 1], points[index]);
        if (closed && points.length > 2)
            this.line(points[points.length - 1], points[0]);
    }
    ray(origin: Vec3, direction: Vec3, length: number): void {
        this.line(origin, vec3.scaleAndAdd(vec3.create(), origin, vec3.normalize(vec3.create(), direction), length));
    }
    cross(center: Vec3, size: number): void {
        const half = size / 2;
        for (const axis of AXES)
            this.line(vec3.scaleAndAdd(vec3.create(), center, axis, -half), vec3.scaleAndAdd(vec3.create(), center, axis, half));
    }
    box(center: Vec3, size: Vec3): void {
        const corner = (index: number): Vec3 => vec3.create(center[0] + (index & 1 ? 0.5 : -0.5) * size[0], center[1] + (index & 2 ? 0.5 : -0.5) * size[1], center[2] + (index & 4 ? 0.5 : -0.5) * size[2]);
        for (let index = 0; index < 8; index++)
            for (const bit of EDGE_BITS)
                if ((index & bit) === 0)
                    this.line(corner(index), corner(index | bit));
    }
    circle(center: Vec3, normal: Vec3, radius: number): void {
        const axis = vec3.length(normal) < MIN_LENGTH ? AXES[1] : vec3.normalize(vec3.create(), normal);
        const u = perpendicularTo(axis);
        const v = vec3.cross(vec3.create(), axis, u);
        const pointAt = (index: number): Vec3 => {
            const angle = (index / CIRCLE_SEGMENTS) * Math.PI * 2;
            const point = vec3.scaleAndAdd(vec3.create(), center, u, Math.cos(angle) * radius);
            return vec3.scaleAndAdd(point, point, v, Math.sin(angle) * radius);
        };
        let previous = pointAt(0);
        for (let index = 1; index <= CIRCLE_SEGMENTS; index++) {
            const next = pointAt(index);
            this.line(previous, next);
            previous = next;
        }
    }
    sphere(center: Vec3, radius: number): void {
        for (const axis of AXES)
            this.circle(center, axis, radius);
    }
    arrow(from: Vec3, to: Vec3): void {
        this.line(from, to);
        const direction = vec3.subtract(vec3.create(), to, from);
        const length = vec3.length(direction);
        if (length < MIN_LENGTH)
            return;
        vec3.scale(direction, direction, 1 / length);
        const head = Math.min(length * ARROW_HEAD_RATIO, ARROW_HEAD_MAX_LENGTH);
        const side = perpendicularTo(direction);
        const up = vec3.cross(vec3.create(), direction, side);
        const base = vec3.scaleAndAdd(vec3.create(), to, direction, -head);
        for (const axis of [side, up])
            for (const sign of [1, -1])
                this.line(to, vec3.scaleAndAdd(vec3.create(), base, axis, sign * head * ARROW_HEAD_SPREAD));
    }
    private toWorld(point: Vec3): Vec3 {
        return this.matrix ? mat4.transformPoint(vec3.create(), this.matrix, point) : vec3.copy(vec3.create(), point);
    }
}
