import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import { ExtensionHost } from './host/extension-host';
export class EditorExtensions {
    readonly host: ExtensionHost;
    constructor(session: EditorSession) {
        this.host = new ExtensionHost(session);
    }
    get renderRequest(): ScriptRenderRequest | null {
        return this.host.runtime?.renderRequest ?? null;
    }
    start(): () => void {
        return this.host.start();
    }
    tick(deltaSeconds: number): void {
        this.host.tick(deltaSeconds);
    }
    attachViewport(canvas: HTMLCanvasElement | null): void {
        this.host.attachViewport(canvas);
    }
    dispose(): void {
        this.host.stop();
    }
}
