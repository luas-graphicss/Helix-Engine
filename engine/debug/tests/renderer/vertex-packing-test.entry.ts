import { packUnitInterval, packUnitVectors, unpackUnitVector } from '@/engine/renderer/geometry/compression/vertex-packing';
import { createCheckList } from '../support/check-list';
const COMPONENT_STEP = 1 / 511;
const UNIT_STEP = 1 / 0xffff;
const SAMPLES = 2000;
const checks = createCheckList('Compactação de vértices');
function largestError(source: Float32Array, stride: 3 | 4): number {
    const packed = packUnitVectors(source, stride);
    const unpacked = new Float32Array(4);
    let largest = 0;
    for (let vertex = 0; vertex < packed.length; vertex++) {
        unpackUnitVector(packed[vertex], unpacked);
        const offset = vertex * stride;
        const length = Math.hypot(source[offset], source[offset + 1], source[offset + 2]) || 1;
        for (let axis = 0; axis < 3; axis++)
            largest = Math.max(largest, Math.abs(unpacked[axis] - source[offset + axis] / length));
    }
    return largest;
}
function spiral(scale: number): Float32Array {
    const vectors = new Float32Array(SAMPLES * 3);
    for (let sample = 0; sample < SAMPLES; sample++) {
        const height = 1 - (2 * (sample + 0.5)) / SAMPLES;
        const radius = Math.sqrt(1 - height * height);
        const angle = sample * 2.399963;
        vectors.set([Math.cos(angle) * radius * scale, height * scale, Math.sin(angle) * radius * scale], sample * 3);
    }
    return vectors;
}
function vectors(): void {
    checks.check('vetores unitários voltam com erro de meio passo de 10 bits', largestError(spiral(1), 3) <= COMPONENT_STEP / 2 + 1e-6);
    checks.check('vetores de outro comprimento são normalizados antes', largestError(spiral(3.7), 3) <= COMPONENT_STEP / 2 + 1e-6);
    const axes = packUnitVectors(new Float32Array([1, 0, 0, 0, -1, 0, 0, 0, 1]), 3);
    const out = new Float32Array(4);
    checks.nearAll('o eixo +X é exato', unpackUnitVector(axes[0], out).subarray(0, 3), [1, 0, 0]);
    checks.nearAll('o eixo -Y é exato', unpackUnitVector(axes[1], out).subarray(0, 3), [0, -1, 0]);
    checks.nearAll('o eixo +Z é exato', unpackUnitVector(axes[2], out).subarray(0, 3), [0, 0, 1]);
    checks.nearAll('um vetor nulo continua nulo', unpackUnitVector(packUnitVectors(new Float32Array(3), 3)[0], out).subarray(0, 3), [0, 0, 0]);
}
function handedness(): void {
    const tangents = packUnitVectors(new Float32Array([1, 0, 0, 1, 0, 1, 0, -1]), 4);
    const out = new Float32Array(4);
    checks.check('uma tangente destra guarda o sinal positivo', unpackUnitVector(tangents[0], out)[3] === 1);
    checks.check('uma tangente espelhada guarda o sinal negativo', unpackUnitVector(tangents[1], out)[3] === -1);
    checks.check('cada vértice ocupa quatro bytes', tangents.byteLength === 8);
}
function unitInterval(): void {
    const packed = packUnitInterval(new Float32Array([0, 0.25, 0.5, 1]));
    checks.check('coordenadas entre 0 e 1 cabem em 16 bits', packed !== null && packed[0] === 0 && packed[3] === 0xffff);
    checks.near('a coordenada volta com erro de meio passo de 16 bits', (packed?.[1] ?? 0) * UNIT_STEP, 0.25, UNIT_STEP / 2);
    checks.check('coordenadas que repetem a textura não são compactadas', packUnitInterval(new Float32Array([0, 2.5])) === null);
    checks.check('coordenadas negativas não são compactadas', packUnitInterval(new Float32Array([-0.1, 0.5])) === null);
    checks.check('coordenadas inválidas não são compactadas', packUnitInterval(new Float32Array([Number.NaN, 0.5])) === null);
}
vectors();
handedness();
unitInterval();
checks.finish();
