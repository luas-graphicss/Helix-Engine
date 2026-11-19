const PERCENT = 100;
export function toPercent(ratio: number): number {
    return ratio * PERCENT;
}
export function fromPercent(percent: number): number {
    return percent / PERCENT;
}
export function formatPercent(percent: number): string {
    return `${Math.round(percent)}%`;
}
export function formatDegrees(degrees: number): string {
    return `${Math.round(degrees)}°`;
}
export function formatWhole(value: number): string {
    return Math.round(value).toLocaleString('pt-BR');
}
