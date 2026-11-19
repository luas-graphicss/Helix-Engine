import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import { clamp } from '@/engine/core/math/scalar';
import type { HeightfieldShape } from '@/engine/physics/shapes/collider-shape';
const MAX_MARCH_STEPS = 32;
const REFINE_ITERATIONS = 10;
const STEP_CELLS = 0.5;
const localStart = vec3.create();
const localEnd = vec3.create();
const localPoint = vec3.create();
const localNormal = vec3.create();
const worldPoint = vec3.create();
function pointAt(progress: number): Vec3 {
    localPoint[0] = localStart[0] + (localEnd[0] - localStart[0]) * progress;
    localPoint[1] = localStart[1] + (localEnd[1] - localStart[1]) * progress;
    localPoint[2] = localStart[2] + (localEnd[2] - localStart[2]) * progress;
    return localPoint;
}
function gridCoordinate(shape: HeightfieldShape, value: number): number {
    return (value + shape.source.halfSize) / shape.source.cellSize;
}
function clearanceAt(shape: HeightfieldShape, progress: number): number {
    const point = pointAt(progress);
    const { halfSize, heightfield } = shape.source;
    if (Math.abs(point[0]) > halfSize || Math.abs(point[2]) > halfSize)
        return Infinity;
    return point[1] - heightfield.sampleTriangulated(gridCoordinate(shape, point[0]), gridCoordinate(shape, point[2]));
}
function refineCrossing(shape: HeightfieldShape, above: number, below: number): number {
    let clear = above;
    let buried = below;
    for (let iteration = 0; iteration < REFINE_ITERATIONS; iteration++) {
        const middle = (clear + buried) * 0.5;
        if (clearanceAt(shape, middle) > 0)
            clear = middle;
        else
            buried = middle;
    }
    return buried;
}
function finishHit(shape: HeightfieldShape, progress: number, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number {
    const point = pointAt(progress);
    const { heightfield, cellSize } = shape.source;
    heightfield.normalAt(localNormal, gridCoordinate(shape, point[0]), gridCoordinate(shape, point[2]), cellSize);
    mat4.transformDirection(outNormal, shape.matrix, localNormal);
    vec3.normalize(outNormal, outNormal);
    mat4.transformPoint(worldPoint, shape.matrix, point);
    vec3.subtract(worldPoint, worldPoint, origin);
    return clamp(vec3.dot(worldPoint, direction), 0, maxDistance);
}
export function raycastHeightfield(shape: HeightfieldShape, origin: Vec3, direction: Vec3, maxDistance: number, outNormal: Vec3): number | null {
    vec3.scaleAndAdd(worldPoint, origin, direction, maxDistance);
    mat4.transformPoint(localStart, shape.inverse, origin);
    mat4.transformPoint(localEnd, shape.inverse, worldPoint);
    if (clearanceAt(shape, 0) <= 0)
        return finishHit(shape, 0, origin, direction, maxDistance, outNormal);
    const horizontal = Math.hypot(localEnd[0] - localStart[0], localEnd[2] - localStart[2]);
    const steps = clamp(Math.ceil(horizontal / (shape.source.cellSize * STEP_CELLS)), 1, MAX_MARCH_STEPS);
    let clear = 0;
    for (let step = 1; step <= steps; step++) {
        const progress = step / steps;
        if (clearanceAt(shape, progress) <= 0)
            return finishHit(shape, refineCrossing(shape, clear, progress), origin, direction, maxDistance, outNormal);
        clear = progress;
    }
    return null;
}
