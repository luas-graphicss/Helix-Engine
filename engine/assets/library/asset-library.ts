import type { ProjectDatabase } from '@/engine/core/storage/project-database';
import { FileBundle } from '@/engine/assets/import/file-bundle';
import { readModelFile } from '@/engine/assets/import/import-worker-client';
import type { ImportedScene } from '@/engine/assets/import/import-types';
import { AssetStore } from './asset-store';
import { primaryFileOf, type AssetDetails, type AssetKind, type AssetSnapshot, type AssetThumbnail, type LibraryAsset } from './asset-types';
import { upgradeAudioDetails } from './audio-asset';
export type AssetLibraryStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
const MODEL_CACHE_LIMIT = 6;
const METADATA_SAVE_DELAY_MS = 600;
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export function normalizeTags(tags: Iterable<string>): string[] {
    const seen = new Set<string>();
    for (const tag of tags) {
        const trimmed = tag.trim().toLowerCase();
        if (trimmed)
            seen.add(trimmed);
    }
    return Array.from(seen).sort();
}
function upgradeStoredAsset(asset: LibraryAsset): LibraryAsset {
    if (asset.kind === 'audio' && asset.details.kind === 'audio') {
        return { ...asset, details: upgradeAudioDetails(asset.details) };
    }
    if (asset.kind !== 'model' || asset.details.kind !== 'model')
        return asset;
    const details = asset.details as Partial<typeof asset.details> & {
        kind: 'model';
    };
    if (details.rig !== undefined && details.animations !== undefined)
        return asset;
    return { ...asset, details: { ...asset.details, rig: details.rig ?? null, animations: details.animations ?? [] } };
}
export class AssetLibrary {
    private readonly items = new Map<string, LibraryAsset>();
    private readonly store: AssetStore | null;
    private readonly fileCache = new Map<string, Promise<File[]>>();
    private readonly modelCache = new Map<string, Promise<ImportedScene>>();
    private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    status: AssetLibraryStatus = 'idle';
    error: string | null = null;
    busy: string | null = null;
    constructor(private readonly onChange: () => void, database: ProjectDatabase | null) {
        this.store = database ? new AssetStore(database) : null;
    }
    get all(): LibraryAsset[] {
        return Array.from(this.items.values());
    }
    get size(): number {
        return this.items.size;
    }
    byKind(kind: AssetKind): LibraryAsset[] {
        return this.all.filter((asset) => asset.kind === kind);
    }
    get(id: string): LibraryAsset | null {
        return this.items.get(id) ?? null;
    }
    findByHash(contentHash: string): LibraryAsset | null {
        for (const asset of this.items.values())
            if (asset.contentHash === contentHash)
                return asset;
        return null;
    }
    async load(): Promise<void> {
        if (this.status !== 'idle')
            return;
        if (!this.store) {
            this.status = 'unavailable';
            this.error = 'IndexedDB indisponível: a biblioteca de ativos não será salva entre sessões.';
            this.onChange();
            return;
        }
        this.status = 'loading';
        this.onChange();
        try {
            for (const stored of await this.store.loadAll()) {
                const asset = upgradeStoredAsset(stored);
                this.items.set(asset.id, asset);
            }
            this.status = 'ready';
            this.error = null;
        }
        catch (cause) {
            this.status = 'unavailable';
            this.error = `Não foi possível abrir a biblioteca de ativos salva: ${errorMessage(cause)}`;
        }
        this.onChange();
    }
    add(snapshot: AssetSnapshot, scene: ImportedScene | null = null): void {
        const { asset, files } = snapshot;
        this.items.set(asset.id, asset);
        this.fileCache.set(asset.id, Promise.resolve(Array.from(files)));
        if (scene)
            this.rememberModel(asset.id, Promise.resolve(scene));
        this.onChange();
        this.persist(() => this.store?.saveSnapshot(snapshot), `salvar "${asset.name}"`);
    }
    remove(id: string): void {
        const asset = this.items.get(id);
        if (!asset)
            return;
        this.items.delete(id);
        this.fileCache.delete(id);
        this.modelCache.delete(id);
        const pendingSave = this.saveTimers.get(id);
        if (pendingSave)
            clearTimeout(pendingSave);
        this.saveTimers.delete(id);
        this.onChange();
        this.persist(() => this.store?.remove(id), `excluir "${asset.name}"`);
    }
    async snapshot(asset: LibraryAsset): Promise<AssetSnapshot> {
        return { asset, files: await this.files(asset) };
    }
    async reload(id: string): Promise<LibraryAsset | null> {
        if (!this.store)
            return this.items.get(id) ?? null;
        const stored = await this.store.load(id);
        if (!stored)
            return null;
        const asset = upgradeStoredAsset(stored);
        this.items.set(id, asset);
        this.fileCache.delete(id);
        this.modelCache.delete(id);
        this.onChange();
        return asset;
    }
    rename(asset: LibraryAsset, name: string): void {
        const trimmed = name.trim();
        if (!trimmed || trimmed === asset.name)
            return;
        asset.name = trimmed;
        this.touch(asset);
    }
    setTags(asset: LibraryAsset, tags: Iterable<string>): void {
        asset.tags = normalizeTags(tags);
        this.touch(asset);
    }
    setThumbnail(asset: LibraryAsset, thumbnail: AssetThumbnail | null): void {
        asset.thumbnail = thumbnail;
        this.touch(asset);
    }
    setDetails(asset: LibraryAsset, details: AssetDetails): void {
        asset.details = details;
        asset.updatedAt = Date.now();
        this.onChange();
        this.scheduleMetadataSave(asset);
    }
    flush(): void {
        for (const [id, timer] of this.saveTimers) {
            clearTimeout(timer);
            const asset = this.items.get(id);
            if (asset)
                this.persist(() => this.store?.saveMetadata(asset), `salvar "${asset.name}"`);
        }
        this.saveTimers.clear();
    }
    setBusy(label: string | null): void {
        if (this.busy === label)
            return;
        this.busy = label;
        this.onChange();
    }
    files(asset: LibraryAsset): Promise<File[]> {
        let pending = this.fileCache.get(asset.id);
        if (!pending) {
            if (!this.store)
                return Promise.reject(new Error('Os arquivos deste ativo não estão disponíveis sem armazenamento.'));
            pending = this.store.loadFiles(asset.id);
            this.fileCache.set(asset.id, pending);
            pending.catch(() => this.fileCache.delete(asset.id));
        }
        return pending;
    }
    async primaryFile(asset: LibraryAsset): Promise<File> {
        return primaryFileOf({ asset, files: await this.files(asset) });
    }
    loadModel(asset: LibraryAsset): Promise<ImportedScene> {
        if (asset.kind !== 'model')
            return Promise.reject(new Error(`${asset.name} não é um modelo.`));
        const cached = this.modelCache.get(asset.id);
        if (cached) {
            this.rememberModel(asset.id, cached);
            return cached;
        }
        const pending = this.files(asset).then((files) => readModelFile(primaryFileOf({ asset, files }), new FileBundle(files)));
        this.rememberModel(asset.id, pending);
        pending.catch(() => this.modelCache.delete(asset.id));
        return pending;
    }
    uniqueName(base: string, reserved?: ReadonlySet<string>): string {
        const trimmed = base.trim() || 'Ativo';
        const taken = new Set(Array.from(this.items.values(), (asset) => asset.name));
        if (reserved)
            for (const name of reserved)
                taken.add(name);
        if (!taken.has(trimmed))
            return trimmed;
        for (let index = 2;; index++) {
            const candidate = `${trimmed} ${index}`;
            if (!taken.has(candidate))
                return candidate;
        }
    }
    private touch(asset: LibraryAsset): void {
        asset.updatedAt = Date.now();
        this.onChange();
        this.persist(() => this.store?.saveMetadata(asset), `salvar "${asset.name}"`);
    }
    private scheduleMetadataSave(asset: LibraryAsset): void {
        if (!this.store)
            return;
        const pending = this.saveTimers.get(asset.id);
        if (pending)
            clearTimeout(pending);
        this.saveTimers.set(asset.id, setTimeout(() => {
            this.saveTimers.delete(asset.id);
            if (!this.items.has(asset.id))
                return;
            this.persist(() => this.store?.saveMetadata(asset), `salvar "${asset.name}"`);
        }, METADATA_SAVE_DELAY_MS));
    }
    private persist(run: () => Promise<void> | undefined, what: string): void {
        run()?.catch((cause: unknown) => {
            this.error = `Não foi possível ${what} na biblioteca de ativos: ${errorMessage(cause)}`;
            this.onChange();
        });
    }
    private rememberModel(id: string, scene: Promise<ImportedScene>): void {
        this.modelCache.delete(id);
        this.modelCache.set(id, scene);
        while (this.modelCache.size > MODEL_CACHE_LIMIT) {
            const oldest = this.modelCache.keys().next().value;
            if (oldest === undefined)
                break;
            this.modelCache.delete(oldest);
        }
    }
}
