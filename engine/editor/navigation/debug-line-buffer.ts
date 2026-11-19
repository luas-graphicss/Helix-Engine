import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
interface PooledLine {
    readonly a: Vec3;
    readonly b: Vec3;
    readonly color: Vec3;
    alpha: number;
}
export class DebugLineBuffer {
    readonly lines: PooledLine[] = [];
    private readonly pool: PooledLine[] = [];
    reset(): void {
        this.lines.length = 0;
    }
    segment(from: Vec3, to: Vec3, color: Vec3, alpha: number): void {
        const index = this.lines.length;
        const line = index < this.pool.length ? this.pool[index] : this.allocate();
        vec3.copy(line.a, from);
        vec3.copy(line.b, to);
        vec3.copy(line.color, color);
        line.alpha = alpha;
        this.lines.push(line);
    }
    private allocate(): PooledLine {
        const line: PooledLine = { a: vec3.create(), b: vec3.create(), color: vec3.create(), alpha: 1 };
        this.pool.push(line);
        return line;
    }
}
