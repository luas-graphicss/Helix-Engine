import type { DeviceRegistry } from '../device-registry';
export interface SourceContext {
    readonly registry: DeviceRegistry;
    readonly signal: AbortSignal;
    readonly surface: HTMLElement | null;
    readonly acceptsKeyboard: () => boolean;
}
export interface DeviceSource {
    attach(context: SourceContext): void;
    poll?(): void;
    endFrame?(): void;
}
