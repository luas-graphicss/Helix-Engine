export type QuaternionTuple = [
    number,
    number,
    number,
    number
];
const COMPONENT_STEPS = 1023;
const COMPONENT_RADIX = COMPONENT_STEPS + 1;
const COMPONENT_RANGE = Math.SQRT1_2;
const INDEX_RADIX = 4;
const MIN_LENGTH = 1e-6;
const IDENTITY: QuaternionTuple = [0, 0, 0, 1];
function normalized(rotation: ArrayLike<number>): QuaternionTuple {
    const length = Math.hypot(rotation[0], rotation[1], rotation[2], rotation[3]);
    if (!(length > MIN_LENGTH))
        return IDENTITY;
    return [rotation[0] / length, rotation[1] / length, rotation[2] / length, rotation[3] / length];
}
export function packQuaternion(rotation: ArrayLike<number>): number {
    const unit = normalized(rotation);
    let largest = 0;
    for (let index = 1; index < 4; index++)
        if (Math.abs(unit[index]) > Math.abs(unit[largest]))
            largest = index;
    const sign = unit[largest] < 0 ? -1 : 1;
    let packed = largest;
    let scale = INDEX_RADIX;
    for (let index = 0; index < 4; index++) {
        if (index === largest)
            continue;
        const ratio = (unit[index] * sign + COMPONENT_RANGE) / (2 * COMPONENT_RANGE);
        packed += Math.round(Math.min(1, Math.max(0, ratio)) * COMPONENT_STEPS) * scale;
        scale *= COMPONENT_RADIX;
    }
    return packed;
}
export function unpackQuaternion(packed: number, target: QuaternionTuple): QuaternionTuple {
    const largest = packed % INDEX_RADIX;
    let rest = Math.floor(packed / INDEX_RADIX);
    let squares = 0;
    for (let index = 0; index < 4; index++) {
        if (index === largest)
            continue;
        const component = ((rest % COMPONENT_RADIX) / COMPONENT_STEPS) * 2 * COMPONENT_RANGE - COMPONENT_RANGE;
        rest = Math.floor(rest / COMPONENT_RADIX);
        target[index] = component;
        squares += component * component;
    }
    target[largest] = Math.sqrt(Math.max(0, 1 - squares));
    return target;
}
