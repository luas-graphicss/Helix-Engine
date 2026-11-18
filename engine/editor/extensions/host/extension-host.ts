import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { ScriptInstance } from '@/engine/scripting/runtime/script-instance';
import { ScriptRuntime } from '@/engine/scripting/runtime/script-runtime';
import type { EditorExtensionEntry } from '@/engine/scripting/scripting-settings';
import { sanitizeExtensionEntries } from './extension-entries';
import { isProjectTrusted, trustProject } from './extension-trust';
const LOG_SOURCE = 'Extensões';
const SYNC_DELAY_MS = 60;
export type ExtensionScriptState = 'blocked' | 'disabled' | 'missing' | 'loading' | 'active' | 'failed';
export interface ExtensionScriptStatus {
    readonly assetId: string;
    readonly name: string;
    readonly enabled: boolean;
    readonly state: ExtensionScriptState;
}
type Listener = () => void;
function describeCause(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class ExtensionHost {
    trusted = false;
    private scriptRuntime: ScriptRuntime | null = null;
    private started = false;
    private viewportCanvas: HTMLCanvasElement | null = null;
    private readonly loadedHashes = new Map<string, string>();
    private readonly failedLoads = new Set<string>();
    private readonly loading = new Set<string>();
    private readonly listeners = new Set<Listener>();
    private version = 0;
    private syncTimer: ReturnType<typeof setTimeout> | null = null;
    private syncChain: Promise<void> = Promise.resolve();
    constructor(private readonly session: EditorSession) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    get runtime(): ScriptRuntime | null {
        return this.scriptRuntime;
    }
    get entries(): EditorExtensionEntry[] {
        return sanitizeExtensionEntries(this.session.scene.scripting.extensions);
    }
    start(): () => void {
        this.started = true;
        const unsubscribe = this.session.subscribeTopic('assets', () => this.requestSync());
        void isProjectTrusted(this.session.project.id).then((trusted) => {
            if (!this.started)
                return;
            this.trusted ||= trusted;
            this.changed();
            this.requestSync();
        });
        return () => {
            unsubscribe();
            this.stop();
        };
    }
    grantTrust(): void {
        if (this.trusted)
            return;
        this.trusted = true;
        void trustProject(this.session.project.id);
        this.changed();
        this.requestSync();
    }
    requestSync(): void {
        if (!this.started)
            return;
        if (this.syncTimer !== null)
            clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncTimer = null;
            this.syncChain = this.syncChain
                .then(() => this.sync())
                .catch((cause: unknown) => this.session.log.error(LOG_SOURCE, `As extensões não puderam ser sincronizadas: ${describeCause(cause)}`));
        }, SYNC_DELAY_MS);
    }
    reload(assetId: string): void {
        this.loadedHashes.delete(assetId);
        this.requestSync();
    }
    reloadAll(): void {
        this.loadedHashes.clear();
        this.requestSync();
    }
    tick(deltaSeconds: number): void {
        this.scriptRuntime?.tickTool(deltaSeconds);
    }
    attachViewport(canvas: HTMLCanvasElement | null): void {
        this.viewportCanvas = canvas;
        this.scriptRuntime?.attachViewport(canvas);
    }
    stop(): void {
        this.started = false;
        if (this.syncTimer !== null) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
        this.scriptRuntime?.stop();
        this.loadedHashes.clear();
        this.failedLoads.clear();
        this.loading.clear();
        this.changed();
    }
    describeScripts(): ExtensionScriptStatus[] {
        const { library } = this.session;
        return this.entries.map((entry) => {
            const asset = library.get(entry.assetId);
            const script = asset?.kind === 'script' ? asset : null;
            return { assetId: entry.assetId, name: script?.name ?? 'Script ausente', enabled: entry.enabled, state: this.stateOf(entry, script) };
        });
    }
    private stateOf(entry: EditorExtensionEntry, asset: LibraryAsset | null): ExtensionScriptState {
        if (!asset)
            return 'missing';
        if (!entry.enabled)
            return 'disabled';
        if (!this.trusted)
            return 'blocked';
        if (this.loading.has(asset.id) || !this.loadedHashes.has(asset.id))
            return 'loading';
        return this.failedLoads.has(asset.id) || !this.isHealthy(asset.id) ? 'failed' : 'active';
    }
    private isHealthy(assetId: string): boolean {
        const instances = this.scriptRuntime?.scriptsOfAsset(assetId) ?? [];
        return instances.length > 0 && instances.every((instance) => !(instance instanceof ScriptInstance) || !instance.faulted);
    }
    private wantedAssets(): Map<string, LibraryAsset> {
        const wanted = new Map<string, LibraryAsset>();
        if (!this.trusted)
            return wanted;
        for (const entry of this.entries) {
            const asset = entry.enabled ? this.session.library.get(entry.assetId) : null;
            if (asset?.kind === 'script')
                wanted.set(asset.id, asset);
        }
        return wanted;
    }
    private ensureRuntime(): ScriptRuntime {
        if (!this.scriptRuntime) {
            this.scriptRuntime = new ScriptRuntime(this.session);
            this.scriptRuntime.attachViewport(this.viewportCanvas);
        }
        return this.scriptRuntime;
    }
    private async sync(): Promise<void> {
        if (!this.started || this.session.library.status !== 'ready')
            return;
        const wanted = this.wantedAssets();
        for (const assetId of Array.from(this.loadedHashes.keys()))
            if (!wanted.has(assetId))
                this.unload(assetId);
        if (wanted.size === 0) {
            this.scriptRuntime?.stop();
            this.changed();
            return;
        }
        const runtime = this.ensureRuntime();
        if (!runtime.running)
            await runtime.start('editor', { persistent: true });
        for (const asset of wanted.values())
            if (this.started && runtime.running && this.loadedHashes.get(asset.id) !== asset.contentHash)
                await this.load(runtime, asset);
        this.changed();
    }
    private async load(runtime: ScriptRuntime, asset: LibraryAsset): Promise<void> {
        this.loading.add(asset.id);
        this.changed();
        if (runtime.scriptsOfAsset(asset.id).length === 0)
            runtime.unload(asset.id);
        let loaded = false;
        try {
            loaded = await runtime.reload(asset);
        }
        finally {
            this.loading.delete(asset.id);
        }
        if (!this.started)
            return;
        this.loadedHashes.set(asset.id, asset.contentHash);
        if (loaded)
            this.failedLoads.delete(asset.id);
        else
            this.failedLoads.add(asset.id);
    }
    private unload(assetId: string): void {
        this.scriptRuntime?.unload(assetId);
        this.loadedHashes.delete(assetId);
        this.failedLoads.delete(assetId);
    }
    private changed(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
