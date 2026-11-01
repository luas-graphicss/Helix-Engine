const D65_LMS: readonly [
    number,
    number,
    number
] = [0.949237, 1.03542, 1.08728];
function standardIlluminantY(x: number): number {
    return 2.87 * x - 3 * x * x - 0.27509507;
}
function cieXyToLms(x: number, y: number): [
    number,
    number,
    number
] {
    const Y = 1;
    const X = (Y * x) / y;
    const Z = (Y * (1 - x - y)) / y;
    return [0.7328 * X + 0.4296 * Y - 0.1624 * Z, -0.7036 * X + 1.6975 * Y + 0.0061 * Z, 0.003 * X + 0.0136 * Y + 0.9834 * Z];
}
export function whiteBalanceCoefficients(out: Float32Array, temperature: number, tint: number): Float32Array {
    const t1 = temperature * (100 / 65);
    const t2 = tint * (100 / 65);
    const x = 0.31271 - t1 * (t1 < 0 ? 0.1 : 0.05);
    const y = standardIlluminantY(x) + t2 * 0.05;
    const target = cieXyToLms(x, y);
    out[0] = D65_LMS[0] / target[0];
    out[1] = D65_LMS[1] / target[1];
    out[2] = D65_LMS[2] / target[2];
    return out;
}
