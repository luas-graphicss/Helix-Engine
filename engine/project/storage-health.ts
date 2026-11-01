export interface StorageHealth {
    persisted: boolean;
    usage: number | null;
    quota: number | null;
}
export async function requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist)
        return false;
    try {
        if (await navigator.storage.persisted())
            return true;
        return await navigator.storage.persist();
    }
    catch {
        return false;
    }
}
export async function readStorageHealth(): Promise<StorageHealth> {
    const health: StorageHealth = { persisted: false, usage: null, quota: null };
    if (typeof navigator === 'undefined' || !navigator.storage)
        return health;
    try {
        if (navigator.storage.persisted)
            health.persisted = await navigator.storage.persisted();
        if (navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            health.usage = estimate.usage ?? null;
            health.quota = estimate.quota ?? null;
        }
    }
    catch {
    }
    return health;
}
export function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value >= 100 ? 0 : 1 })} ${units[unit]}`;
}
