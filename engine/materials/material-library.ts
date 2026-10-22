import type { Material } from '@/engine/core/scene/material';
import { copyMaterial } from '@/engine/core/scene/material';
import type { TextureImage } from '@/engine/core/scene/texture';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import { clonePipelineSettings, emptyGeneratedMaps, generateMapsFromAlbedo, type PipelineSettings } from './map-generation';
import { extractChannel } from './map-packing';
import type { PhysicalProperties } from './physical-material';
import { copyDocumentSettings, createMaterialDocument, GENERATED_MAP_KINDS, MATERIAL_MAP_KINDS, renameMaterialDocument, resetMaterialDocument, syncMaterialDocument, type MaterialDocument, type MaterialMapKind, type MaterialMapSource, } from './material-document';
import { deserializeMaterialDocument, serializeMaterialDocument } from './material-serialization';
import { MaterialStore } from './material-store';
export type MaterialLibraryStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
export type MaterialSyncListener = (document: MaterialDocument) => void;
export type PipelinePatch = {
    resolution?: PipelineSettings['resolution'];
    height?: Partial<PipelineSettings['height']>;
    normal?: Partial<PipelineSettings['normal']>;
    roughness?: Partial<PipelineSettings['roughness']>;
    occlusion?: Partial<PipelineSettings['occlusion']>;
};
const SAVE_DELAY_MS = 800;
const REGENERATE_DELAY_MS = 180;
function stripExtension(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
export class MaterialLibrary {
    private readonly documents = new Map<string, MaterialDocument>();
    private readonly store = MaterialStore.supported ? new MaterialStore() : null;
    private readonly generations = new Map<string, AbortController>();
    private readonly regenerateTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly syncListeners = new Set<MaterialSyncListener>();
    status: MaterialLibraryStatus = 'idle';
    error: string | null = null;
    constructor(private readonly onChange: () => void) { }
    get all(): MaterialDocument[] {
        return Array.from(this.documents.values()).sort((a, b) => a.createdAt - b.createdAt);
    }
    get size(): number {
        return this.documents.size;
    }
    get(id: string): MaterialDocument | null {
        return this.documents.get(id) ?? null;
    }
    forMaterial(material: Material | null | undefined): MaterialDocument | null {
        return material?.libraryId ? this.get(material.libraryId) : null;
    }
    addSyncListener(listener: MaterialSyncListener): () => void {
        this.syncListeners.add(listener);
        return () => this.syncListeners.delete(listener);
    }
    async load(): Promise<void> {
        if (this.status !== 'idle')
            return;
        if (!this.store) {
            this.status = 'unavailable';
            this.error = 'IndexedDB indisponível: a biblioteca não será salva entre sessões.';
            this.onChange();
            return;
        }
        this.status = 'loading';
        this.onChange();
        try {
            const records = await this.store.loadAll();
            for (const record of records) {
                const document = await deserializeMaterialDocument(record);
                this.documents.set(document.id, document);
                this.sync(document);
                this.onChange();
                this.regenerate(document, false);
            }
            this.status = 'ready';
            this.error = null;
        }
        catch (cause) {
            this.status = 'unavailable';
            this.error = `Não foi possível abrir a biblioteca salva: ${errorMessage(cause)}`;
        }
        this.onChange();
    }
    create(name?: string): MaterialDocument {
        const document = createMaterialDocument(this.allocateId(), this.uniqueName(name ?? 'Material'));
        this.documents.set(document.id, document);
        this.sync(document);
        this.touch(document);
        return document;
    }
    createFromMaterial(material: Material, name?: string): MaterialDocument {
        const document = this.create(name ?? material.name);
        copyMaterial(document.material, material);
        document.material.name = document.name;
        document.material.libraryId = document.id;
        document.material.baseColorMap = null;
        document.material.metallicRoughnessMap = null;
        document.material.normalMap = null;
        document.material.occlusionMap = null;
        document.material.emissiveMap = null;
        const adopt = (kind: MaterialMapKind, image: TextureImage | null | undefined, fileName: string) => {
            if (image)
                document.sources[kind] = { image, fileName, mimeType: null, blob: null };
        };
        adopt('albedo', material.baseColorMap?.image, material.baseColorMap?.name ?? 'albedo');
        adopt('normal', material.normalMap?.image, material.normalMap?.name ?? 'normal');
        adopt('emissive', material.emissiveMap?.image, material.emissiveMap?.name ?? 'emissive');
        if (material.metallicRoughnessMap?.image) {
            const packed = material.metallicRoughnessMap;
            adopt('roughness', extractChannel(packed.image!, 1), `${packed.name} · G`);
            adopt('metallic', extractChannel(packed.image!, 2), `${packed.name} · B`);
        }
        if (material.occlusionMap?.image) {
            adopt('occlusion', material.occlusionMap === material.metallicRoughnessMap ? extractChannel(material.occlusionMap.image, 0) : material.occlusionMap.image, material.occlusionMap.name);
        }
        this.sync(document);
        this.touch(document);
        this.regenerate(document);
        return document;
    }
    duplicate(source: MaterialDocument): MaterialDocument {
        const document = createMaterialDocument(this.allocateId(), this.uniqueName(`${source.name} cópia`));
        copyDocumentSettings(document, source);
        for (const { kind } of MATERIAL_MAP_KINDS)
            document.sources[kind] = source.sources[kind];
        document.generated = { ...source.generated };
        this.documents.set(document.id, document);
        this.sync(document);
        this.touch(document);
        return document;
    }
    rename(document: MaterialDocument, name: string): void {
        const trimmed = name.trim();
        if (!trimmed || trimmed === document.name)
            return;
        renameMaterialDocument(document, trimmed);
        this.touch(document);
    }
    async setSourceFile(document: MaterialDocument, kind: MaterialMapKind, file: File): Promise<boolean> {
        const mimeType = file.type || mimeTypeFromFileName(file.name);
        try {
            const image = await decodeImage(file, mimeType);
            if (!this.documents.has(document.id))
                return false;
            this.setSource(document, kind, { image, fileName: file.name, mimeType, blob: file });
            return true;
        }
        catch (cause) {
            this.error = `Não foi possível decodificar "${file.name}": ${errorMessage(cause)}`;
            this.onChange();
            return false;
        }
    }
    setSource(document: MaterialDocument, kind: MaterialMapKind, source: MaterialMapSource): void {
        document.sources[kind] = source;
        if (kind === 'albedo' && document.name.startsWith('Material') && /^Material( \d+)?$/.test(document.name)) {
            renameMaterialDocument(document, this.uniqueName(stripExtension(source.fileName).replace(/[_-](albedo|basecolor|base_color|color|diffuse|col|alb)$/i, '')));
        }
        this.sync(document);
        this.touch(document);
        this.regenerate(document);
    }
    clearSource(document: MaterialDocument, kind: MaterialMapKind): void {
        if (!document.sources[kind])
            return;
        document.sources[kind] = null;
        this.sync(document);
        this.touch(document);
        this.regenerate(document);
    }
    clearAllSources(document: MaterialDocument): void {
        for (const { kind } of MATERIAL_MAP_KINDS)
            document.sources[kind] = null;
        document.generated = emptyGeneratedMaps();
        this.sync(document);
        this.touch(document);
        this.regenerate(document);
    }
    updateMaterial(document: MaterialDocument, mutate: (material: Material) => void): void {
        mutate(document.material);
        this.touch(document);
    }
    updatePipeline(document: MaterialDocument, patch: PipelinePatch): void {
        const current = document.pipeline;
        document.pipeline = {
            resolution: patch.resolution ?? current.resolution,
            height: { ...current.height, ...patch.height },
            normal: { ...current.normal, ...patch.normal },
            roughness: { ...current.roughness, ...patch.roughness },
            occlusion: { ...current.occlusion, ...patch.occlusion },
        };
        this.touch(document);
        this.regenerate(document);
    }
    updatePhysics(document: MaterialDocument, patch: Partial<PhysicalProperties>): void {
        document.physics = { ...document.physics, ...patch };
        this.touch(document);
    }
    reset(document: MaterialDocument): void {
        resetMaterialDocument(document);
        this.touch(document);
        this.regenerate(document);
    }
    remove(document: MaterialDocument): void {
        if (!this.documents.delete(document.id))
            return;
        this.generations.get(document.id)?.abort();
        this.generations.delete(document.id);
        const regenerateTimer = this.regenerateTimers.get(document.id);
        if (regenerateTimer)
            clearTimeout(regenerateTimer);
        this.regenerateTimers.delete(document.id);
        const saveTimer = this.saveTimers.get(document.id);
        if (saveTimer)
            clearTimeout(saveTimer);
        this.saveTimers.delete(document.id);
        this.store?.remove(document.id).catch((cause: unknown) => {
            this.error = `Não foi possível excluir "${document.name}" da biblioteca salva: ${errorMessage(cause)}`;
            this.onChange();
        });
        this.onChange();
    }
    flush(): void {
        for (const [id, timer] of this.saveTimers) {
            clearTimeout(timer);
            const document = this.documents.get(id);
            if (document)
                void this.save(document);
        }
        this.saveTimers.clear();
    }
    private sync(document: MaterialDocument): void {
        syncMaterialDocument(document);
        for (const listener of this.syncListeners)
            listener(document);
    }
    private touch(document: MaterialDocument): void {
        document.updatedAt = Date.now();
        document.version++;
        this.onChange();
        this.scheduleSave(document);
    }
    private regenerate(document: MaterialDocument, save = true): void {
        const pending = this.regenerateTimers.get(document.id);
        if (pending)
            clearTimeout(pending);
        this.regenerateTimers.set(document.id, setTimeout(() => {
            this.regenerateTimers.delete(document.id);
            void this.runPipeline(document, save);
        }, REGENERATE_DELAY_MS));
    }
    private async runPipeline(document: MaterialDocument, save: boolean): Promise<void> {
        this.generations.get(document.id)?.abort();
        const albedo = document.sources.albedo?.image ?? null;
        const settings = clonePipelineSettings(document.pipeline);
        for (const kind of GENERATED_MAP_KINDS)
            if (document.sources[kind])
                settings[kind].enabled = false;
        const anythingToGenerate = albedo !== null && GENERATED_MAP_KINDS.some((kind) => settings[kind].enabled);
        if (!anythingToGenerate) {
            const hadGenerated = GENERATED_MAP_KINDS.some((kind) => document.generated[kind] !== null);
            document.generated = emptyGeneratedMaps();
            document.generating = false;
            if (hadGenerated)
                this.sync(document);
            this.onChange();
            return;
        }
        const controller = new AbortController();
        this.generations.set(document.id, controller);
        document.generating = true;
        this.onChange();
        try {
            const maps = await generateMapsFromAlbedo(albedo, settings, controller.signal);
            if (controller.signal.aborted || !this.documents.has(document.id))
                return;
            document.generated = maps;
            document.generating = false;
            this.sync(document);
            if (save)
                this.touch(document);
            else
                this.onChange();
        }
        catch (cause) {
            if (controller.signal.aborted)
                return;
            document.generating = false;
            this.error = `Pipeline de "${document.name}" falhou: ${errorMessage(cause)}`;
            this.onChange();
        }
        finally {
            if (this.generations.get(document.id) === controller)
                this.generations.delete(document.id);
        }
    }
    private scheduleSave(document: MaterialDocument): void {
        if (!this.store)
            return;
        const pending = this.saveTimers.get(document.id);
        if (pending)
            clearTimeout(pending);
        this.saveTimers.set(document.id, setTimeout(() => {
            this.saveTimers.delete(document.id);
            void this.save(document);
        }, SAVE_DELAY_MS));
    }
    private async save(document: MaterialDocument): Promise<void> {
        if (!this.store || !this.documents.has(document.id))
            return;
        try {
            await this.store.save(await serializeMaterialDocument(document));
        }
        catch (cause) {
            this.error = `Não foi possível salvar "${document.name}": ${errorMessage(cause)}`;
            this.onChange();
        }
    }
    private uniqueName(base: string): string {
        const trimmed = base.trim() || 'Material';
        const taken = new Set(Array.from(this.documents.values()).map((document) => document.name));
        if (!taken.has(trimmed))
            return trimmed;
        for (let index = 2;; index++) {
            const candidate = `${trimmed} ${index}`;
            if (!taken.has(candidate))
                return candidate;
        }
    }
    private allocateId(): string {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            return `mat_${crypto.randomUUID()}`;
        return `mat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
}
