import type { DeviceRegistry } from '../device-registry';
import type { DeviceSource } from './device-source';
import { GamepadSource } from './gamepad-source';
import { KeyboardSource } from './keyboard-source';
import { PointerSource } from './pointer-source';
import { XRControllerSource, type XRSessionLike } from './xr-controller-source';
export interface BrowserAttachment {
    readonly surface: HTMLElement | null;
    readonly acceptsKeyboard: () => boolean;
}
export class BrowserInputSources {
    private readonly xrControllers = new XRControllerSource();
    private readonly sources: readonly DeviceSource[] = [new KeyboardSource(), new PointerSource(), new GamepadSource(), this.xrControllers];
    private abort = new AbortController();
    constructor(private readonly registry: DeviceRegistry) { }
    attach({ surface, acceptsKeyboard }: BrowserAttachment): void {
        this.detach();
        this.abort = new AbortController();
        for (const source of this.sources)
            source.attach({ registry: this.registry, signal: this.abort.signal, surface, acceptsKeyboard });
    }
    connectXR(session: XRSessionLike | null): void {
        this.xrControllers.connect(session);
    }
    poll(): void {
        for (const source of this.sources)
            source.poll?.();
    }
    endFrame(): void {
        for (const source of this.sources)
            source.endFrame?.();
    }
    detach(): void {
        this.abort.abort();
    }
}
