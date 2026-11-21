import { LocalizationRuntime } from '@/engine/localization/runtime/localization-runtime';
import type { RuntimeHost } from './runtime-host';
const LOG_SOURCE = 'Localização';
function devicePreferredLocales(): readonly string[] {
    if (typeof navigator === 'undefined')
        return [];
    return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}
export function createRuntimeLocalization(host: Pick<RuntimeHost, 'log' | 'session'>): LocalizationRuntime {
    return new LocalizationRuntime({
        settings: () => host.session.scene.localization,
        preferredLocales: devicePreferredLocales,
        warn: (message) => host.log('warn', message, { source: LOG_SOURCE }),
    });
}
