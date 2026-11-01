import { VT_PAGE_BORDER, VT_PAGE_TEXELS, VT_SLOT_TEXELS, vtSourceLevels } from './vt-layout';
export type VtWorkerRequest = {
    type: 'open';
    sourceId: number;
    key: string;
    url: string;
    size: number;
} | {
    type: 'tile';
    requestId: number;
    sourceId: number;
    level: number;
    px: number;
    py: number;
} | {
    type: 'close';
    sourceId: number;
};
export type VtWorkerResponse = {
    type: 'progress';
    sourceId: number;
    phase: 'download' | 'tiling';
    loaded: number;
    total: number;
} | {
    type: 'ready';
    sourceId: number;
    size: number;
    levels: number;
    fromCache: boolean;
} | {
    type: 'error';
    sourceId: number;
    message: string;
} | {
    type: 'tile';
    requestId: number;
    sourceId: number;
    level: number;
    px: number;
    py: number;
    bitmap: ImageBitmap | null;
};
interface WorkerScope {
    onmessage: ((event: MessageEvent<VtWorkerRequest>) => void) | null;
    postMessage(message: VtWorkerResponse, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
const DB_NAME = 'helix-terrain-virtual-texture';
const DB_VERSION = 1;
const TILES_STORE = 'tiles';
const SOURCES_STORE = 'sources';
const ENCODE_QUALITY = 0.9;
const PROGRESS_EVERY_PAGES = 32;
interface SourceRecord {
    size: number;
    levels: number;
}
interface SourceState {
    id: number;
    key: string;
    size: number;
    levels: number;
    ready: boolean;
    memory: Map<string, Blob> | null;
}
const sources = new Map<number, SourceState>();
const decodeOptions: ImageBitmapOptions = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
let encodeType: 'image/webp' | 'image/jpeg' | null = null;
let tileCanvas: OffscreenCanvas | null = null;
let tileContext: OffscreenCanvasRenderingContext2D | null = null;
function tileKey(sourceKey: string, level: number, px: number, py: number): string {
    return `${sourceKey}#${level}#${px}#${py}`;
}
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Falha no IndexedDB.'));
    });
}
const database: Promise<IDBDatabase | null> = (async () => {
    if (typeof indexedDB === 'undefined')
        return null;
    try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(TILES_STORE))
                db.createObjectStore(TILES_STORE);
            if (!db.objectStoreNames.contains(SOURCES_STORE))
                db.createObjectStore(SOURCES_STORE);
        };
        return await requestToPromise(request);
    }
    catch {
        return null;
    }
})();
async function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
    const transaction = db.transaction(store, 'readonly');
    return requestToPromise(transaction.objectStore(store).get(key) as IDBRequest<T | undefined>);
}
function idbPutMany(db: IDBDatabase, store: string, entries: ReadonlyArray<readonly [
    string,
    unknown
]>): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        for (const [key, value] of entries)
            objectStore.put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao gravar no IndexedDB.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Gravação no IndexedDB abortada.'));
    });
}
async function download(url: string, onProgress: (loaded: number, total: number) => void): Promise<Blob> {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok)
        throw new Error(`HTTP ${response.status} ao baixar ${url}`);
    const total = Number(response.headers.get('content-length') ?? 0);
    if (!response.body)
        return response.blob();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(loaded, total);
    }
    return new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') ?? 'application/octet-stream' });
}
function ensureCanvas(): OffscreenCanvasRenderingContext2D {
    if (!tileCanvas || !tileContext) {
        tileCanvas = new OffscreenCanvas(VT_SLOT_TEXELS, VT_SLOT_TEXELS);
        const context = tileCanvas.getContext('2d', { alpha: false });
        if (!context)
            throw new Error('OffscreenCanvas 2D indisponível no worker.');
        tileContext = context;
    }
    return tileContext;
}
async function cutTile(level: ImageBitmap, side: number, px: number, py: number): Promise<Blob> {
    const context = ensureCanvas();
    const x0 = px * VT_PAGE_TEXELS - VT_PAGE_BORDER;
    const y0 = py * VT_PAGE_TEXELS - VT_PAGE_BORDER;
    const x1 = x0 + VT_SLOT_TEXELS;
    const y1 = y0 + VT_SLOT_TEXELS;
    for (const ox of [-side, 0, side]) {
        const sx0 = Math.max(x0, ox);
        const sx1 = Math.min(x1, ox + side);
        if (sx1 <= sx0)
            continue;
        for (const oy of [-side, 0, side]) {
            const sy0 = Math.max(y0, oy);
            const sy1 = Math.min(y1, oy + side);
            if (sy1 <= sy0)
                continue;
            context.drawImage(level, sx0 - ox, sy0 - oy, sx1 - sx0, sy1 - sy0, sx0 - x0, sy0 - y0, sx1 - sx0, sy1 - sy0);
        }
    }
    const canvas = tileCanvas as OffscreenCanvas;
    if (encodeType === null) {
        const probe = await canvas.convertToBlob({ type: 'image/webp', quality: ENCODE_QUALITY });
        encodeType = probe.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        if (encodeType === 'image/webp')
            return probe;
    }
    return canvas.convertToBlob({ type: encodeType, quality: ENCODE_QUALITY });
}
async function storeTiles(db: IDBDatabase | null, source: SourceState, entries: Array<readonly [
    string,
    Blob
]>): Promise<void> {
    if (db && !source.memory) {
        try {
            await idbPutMany(db, TILES_STORE, entries);
            return;
        }
        catch {
            source.memory = new Map();
        }
    }
    const memory = source.memory ?? (source.memory = new Map());
    for (const [key, blob] of entries)
        memory.set(key, blob);
}
async function prepare(source: SourceState, url: string): Promise<void> {
    const db = await database;
    const record = db ? await idbGet<SourceRecord>(db, SOURCES_STORE, source.key) : undefined;
    if (record && record.size === source.size && record.levels > 0) {
        source.levels = record.levels;
        source.ready = true;
        scope.postMessage({ type: 'ready', sourceId: source.id, size: source.size, levels: source.levels, fromCache: true });
        return;
    }
    const blob = await download(url, (loaded, total) => {
        scope.postMessage({ type: 'progress', sourceId: source.id, phase: 'download', loaded, total });
    });
    const image = await createImageBitmap(blob, decodeOptions);
    const side = image.width;
    if (image.height !== side || (side & (side - 1)) !== 0) {
        image.close();
        throw new Error(`A imagem precisa ser quadrada e potência de dois (recebido ${image.width}×${image.height}).`);
    }
    const levels = vtSourceLevels(Math.log2(side));
    if (levels === 0) {
        image.close();
        throw new Error(`A imagem (${side}²) não é maior que as fatias do catálogo.`);
    }
    source.size = side;
    source.levels = levels;
    let totalPages = 0;
    for (let level = 0; level < levels; level++)
        totalPages += ((side >> level) / VT_PAGE_TEXELS) ** 2;
    let done = 0;
    let current: ImageBitmap = image;
    for (let level = 0; level < levels; level++) {
        const levelSide = side >> level;
        const pages = levelSide / VT_PAGE_TEXELS;
        const entries: Array<readonly [
            string,
            Blob
        ]> = [];
        for (let py = 0; py < pages; py++) {
            for (let px = 0; px < pages; px++) {
                entries.push([tileKey(source.key, level, px, py), await cutTile(current, levelSide, px, py)]);
                done++;
                if (done % PROGRESS_EVERY_PAGES === 0) {
                    scope.postMessage({ type: 'progress', sourceId: source.id, phase: 'tiling', loaded: done, total: totalPages });
                }
            }
        }
        await storeTiles(db, source, entries);
        const next = level + 1 < levels
            ? await createImageBitmap(current, { ...decodeOptions, resizeWidth: levelSide / 2, resizeHeight: levelSide / 2, resizeQuality: 'high' })
            : null;
        current.close();
        if (!next)
            break;
        current = next;
    }
    if (db && !source.memory) {
        try {
            await idbPutMany(db, SOURCES_STORE, [[source.key, { size: side, levels } satisfies SourceRecord]]);
        }
        catch {
        }
    }
    source.ready = true;
    scope.postMessage({ type: 'ready', sourceId: source.id, size: side, levels, fromCache: false });
}
async function serve(request: Extract<VtWorkerRequest, {
    type: 'tile';
}>): Promise<void> {
    const { requestId, sourceId, level, px, py } = request;
    const source = sources.get(sourceId);
    let bitmap: ImageBitmap | null = null;
    if (source?.ready) {
        const key = tileKey(source.key, level, px, py);
        let blob = source.memory?.get(key);
        if (!blob) {
            const db = await database;
            if (db)
                blob = await idbGet<Blob>(db, TILES_STORE, key).catch(() => undefined);
        }
        if (blob)
            bitmap = await createImageBitmap(blob, decodeOptions).catch(() => null);
    }
    scope.postMessage({ type: 'tile', requestId, sourceId, level, px, py, bitmap }, bitmap ? [bitmap] : []);
}
