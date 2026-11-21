export interface ThreadCapabilities {
    readonly workers: boolean;
    readonly logicalCores: number;
    readonly sharedMemory: boolean;
}
export function detectThreadCapabilities(): ThreadCapabilities {
    const cores = typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency;
    return {
        workers: typeof Worker !== 'undefined',
        logicalCores: cores > 0 ? cores : 1,
        sharedMemory: typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true,
    };
}
