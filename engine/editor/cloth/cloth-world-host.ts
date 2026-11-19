import { ClothSystem } from '@/engine/cloth/runtime/cloth-system';
import type { EditorSession } from '@/engine/editor/session/editor-session';
export class ClothWorldHost {
    readonly system = new ClothSystem();
    private simulatedSeconds = 0;
    constructor(private readonly session: EditorSession) { }
    tick(): void {
        const { scene, playtest } = this.session;
        const elapsedSeconds = playtest.isRunning ? playtest.elapsedSeconds : 0;
        const deltaSeconds = elapsedSeconds - this.simulatedSeconds;
        this.simulatedSeconds = elapsedSeconds;
        if (deltaSeconds > 0) {
            this.system.advance(scene, deltaSeconds);
            return;
        }
        if (this.system.active && (deltaSeconds < 0 || !playtest.isRunning))
            this.system.reset();
    }
}
