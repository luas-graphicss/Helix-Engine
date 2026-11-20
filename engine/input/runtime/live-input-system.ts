import type { InputAsset } from '../actions/input-asset';
import { BrowserInputSources, type BrowserAttachment } from '../devices/sources/browser-input-sources';
import type { XRSessionLike } from '../devices/sources/xr-controller-source';
import { InputSystem } from './input-system';
export class LiveInputSystem {
    readonly system: InputSystem;
    private readonly sources: BrowserInputSources;
    constructor(asset: InputAsset) {
        this.system = new InputSystem(asset);
        this.sources = new BrowserInputSources(this.system.devices);
    }
    attach(attachment: BrowserAttachment): void {
        this.sources.attach(attachment);
    }
    connectXR(session: XRSessionLike | null): void {
        this.sources.connectXR(session);
    }
    beginFrame(delta: number): void {
        this.sources.poll();
        this.system.update(delta);
    }
    endFrame(): void {
        this.sources.endFrame();
    }
    dispose(): void {
        this.sources.detach();
    }
}
