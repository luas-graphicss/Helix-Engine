import 'server-only';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'esbuild';
const URL_PATTERN = /new URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g;
const MODULE_EXTENSIONS = /\.(m?js|tsx?)$/;
const EDITOR_ONLY_STUB = 'editor-only';
export interface WorkerEntry {
    readonly slug: string;
    readonly source: string;
}
export interface CollectedAsset {
    readonly name: string;
    readonly bytes: Uint8Array;
}
export class UrlAssetCollector {
    readonly workers = new Map<string, WorkerEntry>();
    readonly assets = new Map<string, CollectedAsset>();
    readonly editorOnlyHits = new Set<string>();
    private readonly pending: WorkerEntry[] = [];
    constructor(private readonly editorOnlyWorkers: ReadonlySet<string>) { }
    isEditorOnly(source: string): boolean {
        return this.editorOnlyWorkers.has(source);
    }
    worker(source: string): WorkerEntry {
        const existing = Array.from(this.workers.values()).find((entry) => entry.source === source);
        if (existing)
            return existing;
        const base = path
            .basename(source)
            .replace(MODULE_EXTENSIONS, '')
            .replace(/\.worker$/, '')
            .replace(/-worker$/, '');
        const slug = this.workers.has(base) ? `${base}-${shortHash(source)}` : base;
        const entry = { slug, source };
        this.workers.set(slug, entry);
        this.pending.push(entry);
        return entry;
    }
    takePendingWorkers(): WorkerEntry[] {
        return this.pending.splice(0);
    }
    async asset(source: string): Promise<CollectedAsset> {
        for (const asset of this.assets.values())
            if (asset.name.startsWith(assetStem(source)))
                return asset;
        const bytes = new Uint8Array(await readFile(source));
        const name = `${assetStem(source)}-${shortHash(bytes)}${path.extname(source)}`;
        const asset = { name, bytes };
        this.assets.set(name, asset);
        return asset;
    }
}
function assetStem(source: string): string {
    return path.basename(source, path.extname(source));
}
function shortHash(input: string | Uint8Array): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 8);
}
function loaderFor(file: string): 'ts' | 'tsx' | 'js' | 'jsx' {
    if (file.endsWith('.tsx'))
        return 'tsx';
    if (file.endsWith('.ts'))
        return 'ts';
    if (file.endsWith('.jsx'))
        return 'jsx';
    return 'js';
}
async function exists(file: string): Promise<boolean> {
    try {
        return (await stat(file)).isFile();
    }
    catch {
        return false;
    }
}
export interface UrlAssetsPluginOptions {
    readonly root: string;
    readonly collector: UrlAssetCollector;
    readonly toRoot: string;
}
export function urlAssetsPlugin({ root, collector, toRoot }: UrlAssetsPluginOptions): Plugin {
    return {
        name: 'helix-url-assets',
        setup(build) {
            build.onLoad({ filter: MODULE_EXTENSIONS }, async (args) => {
                const text = await readFile(args.path, 'utf8');
                if (!text.includes('import.meta.url'))
                    return undefined;
                const directory = path.dirname(args.path);
                const replacements: Array<{
                    match: string;
                    replacement: string;
                }> = [];
                for (const match of text.matchAll(URL_PATTERN)) {
                    const target = path.resolve(directory, match[2]);
                    if (!(await exists(target)))
                        continue;
                    const relativeSource = path.relative(root, target).split(path.sep).join('/');
                    let location: string;
                    if (MODULE_EXTENSIONS.test(target)) {
                        if (collector.isEditorOnly(relativeSource)) {
                            collector.editorOnlyHits.add(relativeSource);
                            location = `${toRoot}workers/${EDITOR_ONLY_STUB}.js`;
                        }
                        else {
                            location = `${toRoot}workers/${collector.worker(target).slug}.js`;
                        }
                    }
                    else {
                        location = `${toRoot}assets/${(await collector.asset(target)).name}`;
                    }
                    replacements.push({ match: match[0], replacement: `new URL(${JSON.stringify(location)}, import.meta.url)` });
                }
                if (replacements.length === 0)
                    return undefined;
                let contents = text;
                for (const { match, replacement } of replacements)
                    contents = contents.split(match).join(replacement);
                return { contents, loader: loaderFor(args.path), resolveDir: directory };
            });
        },
    };
}
export function editorOnlyWorkerStub(): string {
    return `throw new Error('Este worker pertence ao editor da Helix Engine e não acompanha o jogo compilado.')\n`;
}
export const EDITOR_ONLY_WORKER_FILE = `workers/${EDITOR_ONLY_STUB}.js`;
