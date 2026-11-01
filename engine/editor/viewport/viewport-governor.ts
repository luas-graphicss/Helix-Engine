const UI_ACTIVITY_MS = 150;
const POINTER_RELEASE_MS = 100;
export class ViewportGovernor {
    covered = false;
    resizing = false;
    pendingFrame = false;
    pointerHeld = false;
    private uiActivityUntil = 0;
    markUiActivity(durationMs = UI_ACTIVITY_MS): void {
        const until = performance.now() + durationMs;
        if (until > this.uiActivityUntil)
            this.uiActivityUntil = until;
    }
    get uiActive(): boolean {
        return performance.now() < this.uiActivityUntil;
    }
    get uiBusy(): boolean {
        return this.pointerHeld || this.resizing || this.uiActive;
    }
    setCovered(covered: boolean): void {
        this.covered = covered;
    }
    setResizing(resizing: boolean): void {
        this.resizing = resizing;
        if (resizing)
            this.markUiActivity();
    }
    setPointerHeld(held: boolean): void {
        if (this.pointerHeld === held)
            return;
        this.pointerHeld = held;
        this.markUiActivity(held ? UI_ACTIVITY_MS : POINTER_RELEASE_MS);
    }
}
