const DISPLAY_EPSILON = 0.0005;
const DISTANCE_FORMAT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ANGLE_FORMAT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function settle(value: number): number {
    return Math.abs(value) < DISPLAY_EPSILON ? 0 : value;
}
export function formatDistance(value: number): string {
    return `${DISTANCE_FORMAT.format(settle(value))} m`;
}
export function formatOffset(x: number, y: number, z: number): string {
    return `${DISTANCE_FORMAT.format(settle(x))} · ${DISTANCE_FORMAT.format(settle(y))} · ${DISTANCE_FORMAT.format(settle(z))} m`;
}
export function formatAngle(degrees: number): string {
    return `${ANGLE_FORMAT.format(settle(degrees))}°`;
}
export function formatFactor(factor: number): string {
    return `× ${DISTANCE_FORMAT.format(factor)}`;
}
