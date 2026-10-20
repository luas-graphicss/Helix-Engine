export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
export function degToRad(degrees: number): number {
    return degrees * DEG_TO_RAD;
}
export function radToDeg(radians: number): number {
    return radians * RAD_TO_DEG;
}
