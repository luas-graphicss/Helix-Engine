import { createGradient, scalarConstant, type VfxGradient, type VfxRgb } from '../vfx-curves';
import { createBurst, createEmitter, createModule, createSpawn, VFX_EMITTER_TINTS, type VfxEmitter, type VfxModule, type VfxModuleOf, type VfxSpawn } from '../vfx-document';
export const WHITE: VfxRgb = [1, 1, 1];
export function module<K extends VfxModule['kind']>(kind: K, patch: Partial<Omit<VfxModuleOf<K>, 'kind' | 'id'>>): VfxModule {
    return { ...(createModule(kind) as VfxModuleOf<K>), ...patch } as VfxModule;
}
export function gradient(colors: ReadonlyArray<[
    number,
    VfxRgb
]>, alphas: ReadonlyArray<[
    number,
    number
]>): VfxGradient {
    return createGradient(colors.map(([t, color]) => ({ t, color })), alphas.map(([t, alpha]) => ({ t, alpha })));
}
export function emitter(index: number, patch: Partial<Omit<VfxEmitter, 'id'>>): VfxEmitter {
    return createEmitter({ tint: VFX_EMITTER_TINTS[index % VFX_EMITTER_TINTS.length], ...patch });
}
export function burstSpawn(count: number, countMax = 0, interval = 0, time = 0): VfxSpawn {
    return createSpawn({
        rate: scalarConstant(0),
        bursts: [createBurst(interval > 0 ? { time, count, countMax, cycles: 0, interval } : { time, count, countMax, cycles: 1 })],
    });
}
export const FIRE_GRADIENT = gradient([
    [0, [1, 0.95, 0.75]],
    [0.35, [1, 0.55, 0.12]],
    [0.75, [0.75, 0.12, 0.02]],
    [1, [0.2, 0.02, 0]],
], [
    [0, 0],
    [0.12, 1],
    [0.6, 0.8],
    [1, 0],
]);
