type Listener = () => void;
export interface GuiVideoPlayback {
    readonly loop: boolean;
    readonly muted: boolean;
    readonly volume: number;
    readonly speed: number;
    readonly startTime: number;
    readonly endTime: number | null;
}
export class GuiVideoHandle {
    readonly element: HTMLVideoElement;
    failed = false;
    blocked = false;
    private wantPlaying = false;
    private playPending = false;
    private loadedAssetId: string | null = null;
    constructor(readonly assetId: string) {
        this.element = document.createElement('video');
        this.element.muted = true;
        this.element.playsInline = true;
        this.element.preload = 'auto';
        this.element.crossOrigin = 'anonymous';
    }
    get ready(): boolean {
        return !this.failed && this.element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.element.videoWidth > 0;
    }
    get playing(): boolean {
        return !this.element.paused && !this.element.ended;
    }
    get currentTime(): number {
        return this.element.currentTime;
    }
    get duration(): number {
        return Number.isFinite(this.element.duration) ? this.element.duration : 0;
    }
    get frame(): HTMLVideoElement | null {
        return this.ready ? this.element : null;
    }
    attach(url: string | null): void {
        if (this.loadedAssetId === this.assetId && this.element.src)
            return;
        if (!url) {
            this.failed = true;
            return;
        }
        this.loadedAssetId = this.assetId;
        this.element.src = url;
        this.element.load();
    }
    sync(playback: GuiVideoPlayback, playing: boolean): void {
        const { element } = this;
        if (this.failed)
            return;
        if (element.loop !== playback.loop)
            element.loop = playback.loop;
        if (element.muted !== playback.muted)
            element.muted = playback.muted;
        const volume = Math.max(0, Math.min(1, playback.volume));
        if (Math.abs(element.volume - volume) > 1e-3)
            element.volume = volume;
        const speed = Math.max(0.1, Math.min(4, playback.speed));
        if (Math.abs(element.playbackRate - speed) > 1e-3)
            element.playbackRate = speed;
        const start = Math.max(0, playback.startTime);
        const end = playback.endTime !== null && playback.endTime > start ? playback.endTime : null;
        if (end !== null && element.currentTime >= end) {
            if (playback.loop)
                element.currentTime = start;
            else {
                element.pause();
                playing = false;
            }
        }
        else if (element.readyState >= HTMLMediaElement.HAVE_METADATA && element.currentTime < start && start > 0 && element.duration > start) {
            element.currentTime = start;
        }
        const shouldPlay = playing && !(element.ended && !playback.loop);
        if (shouldPlay) {
            if (element.paused && !this.playPending && !this.blocked) {
                this.playPending = true;
                const promise = element.play();
                if (promise) {
                    promise
                        .then(() => {
                        this.blocked = false;
                    })
                        .catch(() => {
                        this.blocked = true;
                    })
                        .finally(() => {
                        this.playPending = false;
                    });
                }
                else {
                    this.playPending = false;
                }
            }
        }
        else if (!element.paused) {
            element.pause();
        }
        this.wantPlaying = shouldPlay;
    }
    retryIfBlocked(): void {
        this.blocked = false;
    }
    seek(seconds: number): void {
        if (this.failed || !Number.isFinite(seconds))
            return;
        this.element.currentTime = Math.max(0, Math.min(this.duration || seconds, seconds));
    }
    restart(startTime: number): void {
        this.seek(startTime);
    }
    dispose(): void {
        this.element.pause();
        this.element.removeAttribute('src');
        this.element.load();
    }
}
export class GuiVideoCache {
    private readonly urls = new Map<string, Promise<string | null>>();
    private readonly resolved = new Map<string, string | null>();
    private readonly handles = new Map<string, GuiVideoHandle>();
    private readonly listeners = new Set<Listener>();
    loadFile: ((assetId: string) => Promise<File | null>) | null = null;
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    private notify(): void {
        for (const listener of this.listeners)
            listener();
    }
    get anyPlaying(): boolean {
        for (const handle of this.handles.values())
            if (handle.playing)
                return true;
        return false;
    }
    acquire(scope: string, assetId: string): GuiVideoHandle {
        let handle = this.handles.get(scope);
        if (handle && handle.assetId !== assetId) {
            handle.dispose();
            handle = undefined;
        }
        if (!handle) {
            handle = new GuiVideoHandle(assetId);
            this.handles.set(scope, handle);
            const created = handle;
            created.element.addEventListener('loadeddata', () => this.notify(), { once: true });
            created.element.addEventListener('error', () => {
                created.failed = true;
                this.notify();
            });
            const url = this.resolved.get(assetId);
            if (url !== undefined)
                created.attach(url);
            else
                void this.url(assetId).then((resolved) => created.attach(resolved));
        }
        return handle;
    }
    peek(scope: string): GuiVideoHandle | null {
        return this.handles.get(scope) ?? null;
    }
    release(scope: string): void {
        const handle = this.handles.get(scope);
        if (!handle)
            return;
        handle.dispose();
        this.handles.delete(scope);
    }
    releaseScope(prefix: string): void {
        for (const scope of [...this.handles.keys()])
            if (scope.startsWith(prefix))
                this.release(scope);
    }
    retainOnly(prefix: string, alive: ReadonlySet<string>): void {
        for (const scope of [...this.handles.keys()])
            if (scope.startsWith(prefix) && !alive.has(scope))
                this.release(scope);
    }
    pauseAll(): void {
        for (const handle of this.handles.values())
            handle.element.pause();
    }
    unblockAll(): void {
        for (const handle of this.handles.values())
            handle.retryIfBlocked();
    }
    invalidate(assetId: string): void {
        const url = this.resolved.get(assetId);
        if (url)
            URL.revokeObjectURL(url);
        this.resolved.delete(assetId);
        this.urls.delete(assetId);
        for (const [scope, handle] of [...this.handles.entries()]) {
            if (handle.assetId !== assetId)
                continue;
            handle.dispose();
            this.handles.delete(scope);
        }
        this.notify();
    }
    private url(assetId: string): Promise<string | null> {
        let pending = this.urls.get(assetId);
        if (!pending) {
            pending = (async () => {
                try {
                    const file = await this.loadFile?.(assetId);
                    const url = file ? URL.createObjectURL(file) : null;
                    this.resolved.set(assetId, url);
                    return url;
                }
                catch {
                    this.resolved.set(assetId, null);
                    return null;
                }
            })();
            this.urls.set(assetId, pending);
        }
        return pending;
    }
}
export const guiVideos = new GuiVideoCache();
