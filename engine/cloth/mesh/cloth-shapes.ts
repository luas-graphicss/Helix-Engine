import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { MeshBuilder } from '@/engine/renderer/geometry/primitives';
interface ClothSheetShape {
    readonly width: number;
    readonly length: number;
    readonly columns: number;
    readonly rows: number;
}
interface ClothSkirtShape {
    readonly waistRadius: number;
    readonly hemRadius: number;
    readonly length: number;
    readonly columns: number;
    readonly rows: number;
}
const TWO_PI = Math.PI * 2;
export function createHangingSheet(name: string, shape: ClothSheetShape): MeshData {
    const builder = new MeshBuilder();
    builder.grid(shape.columns, shape.rows, (u, v) => ({
        position: [(u - 0.5) * shape.width, (0.5 - v) * shape.length, 0],
        normal: [0, 0, 1],
    }));
    return builder.build(name);
}
export function createFlatSheet(name: string, shape: ClothSheetShape): MeshData {
    const builder = new MeshBuilder();
    builder.grid(shape.columns, shape.rows, (u, v) => ({
        position: [(u - 0.5) * shape.width, 0, (v - 0.5) * shape.length],
        normal: [0, 1, 0],
    }));
    return builder.build(name);
}
export function createSkirt(name: string, shape: ClothSkirtShape): MeshData {
    const flare = (shape.hemRadius - shape.waistRadius) / shape.length;
    const normalScale = 1 / Math.hypot(1, flare);
    const builder = new MeshBuilder();
    builder.grid(shape.columns, shape.rows, (u, v) => {
        const angle = -u * TWO_PI;
        const radius = shape.waistRadius + (shape.hemRadius - shape.waistRadius) * v;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            position: [cos * radius, (0.5 - v) * shape.length, sin * radius],
            normal: [cos * normalScale, flare * normalScale, sin * normalScale],
        };
    });
    return builder.build(name);
}
