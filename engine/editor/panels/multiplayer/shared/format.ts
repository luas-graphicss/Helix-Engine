const BITS_PER_BYTE = 8;
const KILO = 1000;
export function formatBitRate(bytesPerSecond: number): string {
    const kilobits = (bytesPerSecond * BITS_PER_BYTE) / KILO;
    return kilobits >= KILO ? `${(kilobits / KILO).toFixed(2)} Mb/s` : `${kilobits.toFixed(1)} kb/s`;
}
export function formatBytes(bytes: number): string {
    if (bytes >= KILO * KILO)
        return `${(bytes / (KILO * KILO)).toFixed(2)} MB`;
    return bytes >= KILO ? `${(bytes / KILO).toFixed(1)} kB` : `${Math.round(bytes)} B`;
}
export function formatMilliseconds(value: number): string {
    return `${Math.round(value)} ms`;
}
export function formatPercent(ratio: number): string {
    return `${(ratio * 100).toFixed(1)}%`;
}
export function formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}
export function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}
