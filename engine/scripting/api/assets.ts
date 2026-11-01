import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import { decodeImage } from '@/engine/assets/image-decoder';
import { getAnimationDocument } from '@/engine/animation/clip-registry';
import { guiFonts, fontAssetFamily } from '@/engine/gui/fonts/gui-font-registry';
import { addFilesToLibrary, removeLibraryAsset, renameLibraryAsset, setLibraryAssetTags } from '@/engine/editor/operations/asset-library-operations';
import { ensureAnimationDocument } from '@/engine/editor/operations/animation-operations';
import { loadGuiAsset } from '@/engine/editor/operations/gui-operations';
import { loadScriptAsset } from '@/engine/editor/operations/script-operations';
import { loadVfxAsset } from '@/engine/editor/operations/vfx-operations';
import { pickFiles } from '@/engine/editor/files/file-picker';
import { parseToml } from '../languages/toml/toml-parser';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireFunction, requireObject, requireOneOf, requireString } from '../runtime/values';
const ASSET_KINDS: readonly AssetKind[] = ['model', 'texture', 'audio', 'animation', 'gui', 'font', 'video', 'vfx', 'script', 'prefab'];
const DATA_EXTENSIONS = ['json', 'yaml', 'yml', 'toml', 'xml', 'md', 'markdown', 'csv', 'txt'] as const;
export function describeAsset(asset: LibraryAsset) {
    return {
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        format: asset.format,
        size: asset.size,
        tags: asset.tags.slice(),
        contentHash: asset.contentHash,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        files: asset.files.map((file) => file.path),
        details: asset.details,
    };
}
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i++;
                }
                else
                    quoted = false;
            }
            else
                cell += char;
            continue;
        }
        if (char === '"')
            quoted = true;
        else if (char === ',') {
            row.push(cell);
            cell = '';
        }
        else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += char;
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}
function parseYaml(text: string): unknown {
    const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+#.*$/, '')).filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'));
    let index = 0;
    const scalar = (raw: string): unknown => {
        const trimmed = raw.trim();
        if (trimmed === '' || trimmed === '~' || trimmed === 'null')
            return null;
        if (trimmed === 'true')
            return true;
        if (trimmed === 'false')
            return false;
        if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(trimmed))
            return Number(trimmed);
        if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed))
            return trimmed.slice(1, -1);
        if (trimmed.startsWith('[') && trimmed.endsWith(']'))
            return trimmed.slice(1, -1).split(',').filter((item) => item.trim().length > 0).map(scalar);
        return trimmed;
    };
    const indentOf = (line: string) => line.length - line.trimStart().length;
    const parseBlock = (indent: number): unknown => {
        const first = lines[index];
        if (first === undefined)
            return null;
        const isList = first.trim().startsWith('- ') || first.trim() === '-';
        if (isList) {
            const list: unknown[] = [];
            while (index < lines.length && indentOf(lines[index]) === indent && (lines[index].trim().startsWith('- ') || lines[index].trim() === '-')) {
                const content = lines[index].trim().slice(1).trim();
                index++;
                if (content === '')
                    list.push(parseBlock(indent + 2));
                else if (/^[^:]+:\s*(.*)$/.test(content) && !content.startsWith('"') && !content.startsWith("'")) {
                    const map: Record<string, unknown> = {};
                    const match = /^([^:]+):\s*(.*)$/.exec(content) as RegExpExecArray;
                    map[match[1].trim()] = match[2] === '' ? (index < lines.length && indentOf(lines[index]) > indent ? parseBlock(indentOf(lines[index])) : null) : scalar(match[2]);
                    while (index < lines.length && indentOf(lines[index]) === indent + 2 && !lines[index].trim().startsWith('- ')) {
                        const inner = /^([^:]+):\s*(.*)$/.exec(lines[index].trim());
                        index++;
                        if (!inner)
                            continue;
                        map[inner[1].trim()] = inner[2] === '' ? (index < lines.length && indentOf(lines[index]) > indent + 2 ? parseBlock(indentOf(lines[index])) : null) : scalar(inner[2]);
                    }
                    list.push(map);
                }
                else
                    list.push(scalar(content));
            }
            return list;
        }
        const map: Record<string, unknown> = {};
        while (index < lines.length && indentOf(lines[index]) === indent && !lines[index].trim().startsWith('- ')) {
            const match = /^([^:]+):\s*(.*)$/.exec(lines[index].trim());
            index++;
            if (!match)
                continue;
            const key = match[1].trim().replace(/^["']|["']$/g, '');
            if (match[2] === '')
                map[key] = index < lines.length && indentOf(lines[index]) > indent ? parseBlock(indentOf(lines[index])) : null;
            else
                map[key] = scalar(match[2]);
        }
        return map;
    };
    if (lines.length === 0)
        return null;
    return parseBlock(indentOf(lines[0]));
}
export function createAssetsApi(host: RuntimeHost) {
    const { session, bus } = host;
    const { library } = session;
    const urls = new Map<string, string>();
    const videos = new Map<string, HTMLVideoElement>();
    function resolve(value: unknown, member: string, kind?: AssetKind): LibraryAsset {
        return host.resolveAsset(value, member, kind);
    }
    function kindOf(value: unknown, member: string): AssetKind | undefined {
        return value === undefined ? undefined : requireOneOf(value, ASSET_KINDS, member, 'o tipo de ativo');
    }
    async function url(asset: LibraryAsset): Promise<string> {
        const cached = urls.get(asset.id);
        if (cached)
            return cached;
        const file = await library.primaryFile(asset);
        const created = URL.createObjectURL(file);
        urls.set(asset.id, created);
        return created;
    }
    async function text(asset: LibraryAsset): Promise<string> {
        const file = await library.primaryFile(asset);
        return file.text();
    }
    function extensionOf(asset: LibraryAsset): string {
        const path = asset.primaryPath || asset.name;
        const dot = path.lastIndexOf('.');
        return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
    }
    async function data(asset: LibraryAsset, formatValue: unknown, member: string): Promise<unknown> {
        const source = await text(asset);
        const format = formatValue === undefined ? extensionOf(asset) : requireOneOf(formatValue, DATA_EXTENSIONS, member, 'o formato');
        switch (format) {
            case 'json':
                return JSON.parse(source);
            case 'yaml':
            case 'yml':
                return parseYaml(source);
            case 'toml': {
                const parsed = parseToml(source);
                const first = parsed.diagnostics[0];
                if (first)
                    throw new HelixError(`${member}: TOML inválido em ${asset.name} (linha ${first.line}, coluna ${first.column}): ${first.message}`);
                return parsed.value;
            }
            case 'csv':
                return parseCsv(source);
            case 'xml': {
                const parsed = new DOMParser().parseFromString(source, 'application/xml');
                const error = parsed.querySelector('parsererror');
                if (error)
                    throw new HelixError(`${member}: XML inválido em ${asset.name}: ${error.textContent?.trim() ?? ''}`);
                return parsed;
            }
            case 'md':
            case 'markdown':
            case 'txt':
                return source;
            default:
                throw new HelixArgumentError(member, `não sei interpretar ".${format}" como dados; passe o formato (${DATA_EXTENSIONS.join(', ')}).`);
        }
    }
    host.disposers.add(() => {
        for (const created of urls.values())
            URL.revokeObjectURL(created);
        urls.clear();
        for (const video of videos.values()) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        videos.clear();
    });
    return {
        kinds: () => ASSET_KINDS.slice(),
        get: (id: unknown) => {
            const asset = library.get(requireString(id, 'helix.assets.get', 'o id'));
            return asset ? describeAsset(asset) : null;
        },
        byName: (name: unknown, kind?: unknown) => {
            const wanted = requireString(name, 'helix.assets.byName', 'o nome');
            const type = kindOf(kind, 'helix.assets.byName');
            const asset = library.all.find((candidate) => candidate.name === wanted && (!type || candidate.kind === type)) ?? null;
            return asset ? describeAsset(asset) : null;
        },
        list: (kind?: unknown) => {
            const type = kindOf(kind, 'helix.assets.list');
            return (type ? library.byKind(type) : library.all).map(describeAsset);
        },
        byTag: (tag: unknown) => {
            const wanted = requireString(tag, 'helix.assets.byTag', 'a tag').toLowerCase();
            return library.all.filter((asset) => asset.tags.some((candidate) => candidate.toLowerCase() === wanted)).map(describeAsset);
        },
        search: (query: unknown, kind?: unknown) => {
            const needle = requireString(query, 'helix.assets.search', 'a busca').trim().toLowerCase();
            const type = kindOf(kind, 'helix.assets.search');
            return library.all
                .filter((asset) => (!type || asset.kind === type) && (needle === '' || asset.name.toLowerCase().includes(needle) || asset.format.toLowerCase().includes(needle) || asset.tags.some((tag) => tag.toLowerCase().includes(needle))))
                .map(describeAsset);
        },
        exists: (value: unknown) => {
            try {
                resolve(value, 'helix.assets.exists');
                return true;
            }
            catch {
                return false;
            }
        },
        tags: (asset: unknown) => resolve(asset, 'helix.assets.tags').tags.slice(),
        setTags: (asset: unknown, tags: unknown) => {
            if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))
                throw new HelixArgumentError('helix.assets.setTags', 'as tags precisam ser uma lista de strings.');
            setLibraryAssetTags(session, resolve(asset, 'helix.assets.setTags'), tags as string[]);
        },
        rename: (asset: unknown, name: unknown) => renameLibraryAsset(session, resolve(asset, 'helix.assets.rename'), requireString(name, 'helix.assets.rename', 'o novo nome')),
        remove: (asset: unknown) => removeLibraryAsset(session, resolve(asset, 'helix.assets.remove')),
        file: (asset: unknown) => library.primaryFile(resolve(asset, 'helix.assets.file')),
        files: (asset: unknown) => library.files(resolve(asset, 'helix.assets.files')),
        url: (asset: unknown) => url(resolve(asset, 'helix.assets.url')),
        text: (asset: unknown) => text(resolve(asset, 'helix.assets.text')),
        bytes: async (asset: unknown) => new Uint8Array(await (await library.primaryFile(resolve(asset, 'helix.assets.bytes'))).arrayBuffer()),
        data: (asset: unknown, format?: unknown) => data(resolve(asset, 'helix.assets.data'), format, 'helix.assets.data'),
        model: (asset: unknown) => library.loadModel(resolve(asset, 'helix.assets.model', 'model')),
        image: async (asset: unknown) => {
            const resolved = resolve(asset, 'helix.assets.image', 'texture');
            const file = await library.primaryFile(resolved);
            return decodeImage(file, file.type || null);
        },
        audio: async (asset: unknown) => {
            const resolved = resolve(asset, 'helix.assets.audio', 'audio');
            const engine = session.audio.engine;
            if (!engine.supported)
                throw new HelixError('helix.assets.audio: este navegador não tem Web Audio.');
            return engine.load(resolved.id, () => library.primaryFile(resolved));
        },
        animation: async (asset: unknown) => {
            const resolved = resolve(asset, 'helix.assets.animation', 'animation');
            const document = getAnimationDocument(resolved.id) ?? (await ensureAnimationDocument(session, resolved.id));
            if (!document)
                throw new HelixError(`helix.assets.animation: não foi possível ler ${resolved.name}.`);
            return document;
        },
        gui: (asset: unknown) => loadGuiAsset(session, resolve(asset, 'helix.assets.gui', 'gui')),
        vfx: (asset: unknown) => loadVfxAsset(session, resolve(asset, 'helix.assets.vfx', 'vfx')),
        script: (asset: unknown) => loadScriptAsset(session, resolve(asset, 'helix.assets.script', 'script')),
        font: async (asset: unknown) => {
            const resolved = resolve(asset, 'helix.assets.font', 'font');
            await guiFonts.ensure(resolved.id);
            if (guiFonts.hasFailed(resolved.id))
                throw new HelixError(`helix.assets.font: não foi possível carregar a fonte ${resolved.name}.`);
            return guiFonts.cssFamily(fontAssetFamily(resolved.id));
        },
        video: async (asset: unknown) => {
            const resolved = resolve(asset, 'helix.assets.video', 'video');
            const existing = videos.get(resolved.id);
            if (existing)
                return existing;
            const video = document.createElement('video');
            video.src = await url(resolved);
            video.playsInline = true;
            video.muted = true;
            video.loop = false;
            video.preload = 'auto';
            videos.set(resolved.id, video);
            return video;
        },
        import: async (source: unknown, options?: unknown) => {
            const member = 'helix.assets.import';
            const settings = options === undefined ? {} : requireObject(options, member);
            const files: File[] = [];
            const pushBlob = async (blob: Blob, name: string) => files.push(blob instanceof File ? blob : new File([blob], name, { type: blob.type }));
            const list = Array.isArray(source) ? source : [source];
            for (const item of list) {
                if (item instanceof File)
                    files.push(item);
                else if (item instanceof Blob)
                    await pushBlob(item, typeof settings.name === 'string' ? settings.name : 'arquivo');
                else if (typeof item === 'string') {
                    const response = await fetch(item);
                    if (!response.ok)
                        throw new HelixError(`${member}: ${item} respondeu ${response.status}.`);
                    const name = typeof settings.name === 'string' ? settings.name : decodeURIComponent(item.split('/').pop()?.split('?')[0] || 'arquivo');
                    await pushBlob(await response.blob(), name);
                }
                else
                    throw new HelixArgumentError(member, 'esperava File, Blob, URL ou uma lista deles.');
            }
            const added = await addFilesToLibrary(session, files);
            return added.map(describeAsset);
        },
        pickFiles: async (accept: unknown = '*/*', multiple: unknown = true) => pickFiles({ accept: requireString(accept, 'helix.assets.pickFiles', 'os tipos aceitos'), multiple: Boolean(multiple) }),
        thumbnail: (asset: unknown) => resolve(asset, 'helix.assets.thumbnail').thumbnail?.blob ?? null,
        onChange: (handler: unknown) => {
            const fn = requireFunction<(event: {
                type: string;
                asset: ReturnType<typeof describeAsset>;
            }) => void>(handler, 'helix.assets.onChange');
            const unsubscribes = ['assets.added', 'assets.changed', 'assets.removed'].map((name) => bus.on(name, (payload) => fn({ type: name.slice('assets.'.length), asset: payload as ReturnType<typeof describeAsset> }), host.current));
            return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
        },
        get count() {
            return library.size;
        },
        get busy() {
            return library.busy;
        },
        get status() {
            return library.status;
        },
    };
}
export type AssetsApi = ReturnType<typeof createAssetsApi>;
