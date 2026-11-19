import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { OcclusionBuffer } from './occlusion-buffer';
const CLIP_FLOATS = 4;
const MAX_POLYGON_VERTICES = 5;
const MIN_TRIANGLE_AREA = 1e-6;
function clipPolygon(input: Float32Array, count: number, output: Float32Array, planeZ: number, planeW: number, planeOffset: number): number {
    let written = 0;
    let previous = (count - 1) * CLIP_FLOATS;
    let previousDistance = planeZ * input[previous + 2] + planeW * input[previous + 3] + planeOffset;
    for (let vertex = 0; vertex < count; vertex++) {
        const current = vertex * CLIP_FLOATS;
        const distance = planeZ * input[current + 2] + planeW * input[current + 3] + planeOffset;
        if (distance >= 0 !== previousDistance >= 0) {
            const t = previousDistance / (previousDistance - distance);
            const target = written * CLIP_FLOATS;
            for (let component = 0; component < CLIP_FLOATS; component++)
                output[target + component] = input[previous + component] + (input[current + component] - input[previous + component]) * t;
            written++;
        }
        if (distance >= 0) {
            const target = written * CLIP_FLOATS;
            for (let component = 0; component < CLIP_FLOATS; component++)
                output[target + component] = input[current + component];
            written++;
        }
        previous = current;
        previousDistance = distance;
    }
    return written;
}
function rasterizeTriangle(buffer: OcclusionBuffer, x0: number, y0: number, d0: number, x1: number, y1: number, d1: number, x2: number, y2: number, d2: number): void {
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < MIN_TRIANGLE_AREA)
        return;
    const { width, height, depth } = buffer;
    const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - 0.5));
    const maxX = Math.min(width - 1, Math.floor(Math.max(x0, x1, x2) - 0.5));
    const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5));
    const maxY = Math.min(height - 1, Math.floor(Math.max(y0, y1, y2) - 0.5));
    if (minX > maxX || minY > maxY)
        return;
    const sign = area > 0 ? 1 : -1;
    const inverseArea = 1 / area;
    const slopeX = ((d1 - d0) * (y2 - y0) - (d2 - d0) * (y1 - y0)) * inverseArea;
    const slopeY = ((d2 - d0) * (x1 - x0) - (d1 - d0) * (x2 - x0)) * inverseArea;
    const farthestInPixel = 0.5 * (Math.abs(slopeX) + Math.abs(slopeY));
    const startX = minX + 0.5;
    const startY = minY + 0.5;
    let rowEdge0 = sign * ((x2 - x1) * (startY - y1) - (y2 - y1) * (startX - x1));
    let rowEdge1 = sign * ((x0 - x2) * (startY - y2) - (y0 - y2) * (startX - x2));
    let rowEdge2 = sign * ((x1 - x0) * (startY - y0) - (y1 - y0) * (startX - x0));
    const stepX0 = sign * (y1 - y2);
    const stepX1 = sign * (y2 - y0);
    const stepX2 = sign * (y0 - y1);
    const stepY0 = sign * (x2 - x1);
    const stepY1 = sign * (x0 - x2);
    const stepY2 = sign * (x1 - x0);
    let rowDepth = d0 + slopeX * (startX - x0) + slopeY * (startY - y0) - farthestInPixel;
    for (let y = minY; y <= maxY; y++) {
        let edge0 = rowEdge0;
        let edge1 = rowEdge1;
        let edge2 = rowEdge2;
        let value = rowDepth;
        const row = y * width;
        for (let x = minX; x <= maxX; x++) {
            if (edge0 >= 0 && edge1 >= 0 && edge2 >= 0 && value > depth[row + x])
                depth[row + x] = value;
            edge0 += stepX0;
            edge1 += stepX1;
            edge2 += stepX2;
            value += slopeX;
        }
        rowEdge0 += stepY0;
        rowEdge1 += stepY1;
        rowEdge2 += stepY2;
        rowDepth += slopeY;
    }
}
export class OccluderRasterizer {
    private readonly modelViewProjection = mat4.create();
    private readonly polygon = new Float32Array(MAX_POLYGON_VERTICES * CLIP_FLOATS);
    private readonly clipped = new Float32Array(MAX_POLYGON_VERTICES * CLIP_FLOATS);
    private clip = new Float32Array(0);
    draw(buffer: OcclusionBuffer, mesh: MeshData, model: Mat4, viewProjection: Mat4, near: number): void {
        const m = mat4.multiply(this.modelViewProjection, viewProjection, model);
        const { positions, indices } = mesh;
        const vertexCount = positions.length / 3;
        if (this.clip.length < vertexCount * CLIP_FLOATS)
            this.clip = new Float32Array(vertexCount * CLIP_FLOATS);
        const { clip } = this;
        for (let vertex = 0, source = 0, target = 0; vertex < vertexCount; vertex++, source += 3, target += CLIP_FLOATS) {
            const x = positions[source];
            const y = positions[source + 1];
            const z = positions[source + 2];
            clip[target] = m[0] * x + m[4] * y + m[8] * z + m[12];
            clip[target + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
            clip[target + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
            clip[target + 3] = m[3] * x + m[7] * y + m[11] * z + m[15];
        }
        for (let index = 0; index + 2 < indices.length; index += 3)
            this.drawTriangle(buffer, indices[index] * CLIP_FLOATS, indices[index + 1] * CLIP_FLOATS, indices[index + 2] * CLIP_FLOATS, near);
    }
    private drawTriangle(buffer: OcclusionBuffer, a: number, b: number, c: number, near: number): void {
        const { clip } = this;
        const aw = clip[a + 3];
        const bw = clip[b + 3];
        const cw = clip[c + 3];
        if (clip[a] > aw && clip[b] > bw && clip[c] > cw)
            return;
        if (clip[a] < -aw && clip[b] < -bw && clip[c] < -cw)
            return;
        if (clip[a + 1] > aw && clip[b + 1] > bw && clip[c + 1] > cw)
            return;
        if (clip[a + 1] < -aw && clip[b + 1] < -bw && clip[c + 1] < -cw)
            return;
        const behindNear = (clip[a + 2] + aw < 0 ? 1 : 0) + (clip[b + 2] + bw < 0 ? 1 : 0) + (clip[c + 2] + cw < 0 ? 1 : 0);
        const tooClose = (aw < near ? 1 : 0) + (bw < near ? 1 : 0) + (cw < near ? 1 : 0);
        if (behindNear === 3 || tooClose === 3)
            return;
        if (behindNear === 0 && tooClose === 0) {
            this.fill(buffer, clip, a, b, c);
            return;
        }
        const { polygon, clipped } = this;
        for (let component = 0; component < CLIP_FLOATS; component++) {
            polygon[component] = clip[a + component];
            polygon[CLIP_FLOATS + component] = clip[b + component];
            polygon[CLIP_FLOATS * 2 + component] = clip[c + component];
        }
        let count = clipPolygon(polygon, 3, clipped, 1, 1, 0);
        if (count < 3)
            return;
        count = clipPolygon(clipped, count, polygon, 0, 1, -near);
        for (let vertex = 1; vertex + 1 < count; vertex++)
            this.fill(buffer, polygon, 0, vertex * CLIP_FLOATS, (vertex + 1) * CLIP_FLOATS);
    }
    private fill(buffer: OcclusionBuffer, vertices: Float32Array, a: number, b: number, c: number): void {
        const inverseA = 1 / vertices[a + 3];
        const inverseB = 1 / vertices[b + 3];
        const inverseC = 1 / vertices[c + 3];
        rasterizeTriangle(buffer, buffer.pixelX(vertices[a] * inverseA), buffer.pixelY(vertices[a + 1] * inverseA), inverseA, buffer.pixelX(vertices[b] * inverseB), buffer.pixelY(vertices[b + 1] * inverseB), inverseB, buffer.pixelX(vertices[c] * inverseC), buffer.pixelY(vertices[c + 1] * inverseC), inverseC);
    }
}
