import 'server-only';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build, type BuildOptions, type Plugin } from 'esbuild';
import { ENGINE_VERSION } from '@/engine/core/engine-info';
import { HELIX_PLAYER_ELECTRON_VERSION } from '../build-targets';
import type { PlayerBundleManifest } from '../player-bundle';
import { nodeShimsPlugin } from './node-shims-plugin';
import { listRuntimePublicAssets } from './public-assets';
import { EDITOR_ONLY_WORKER_FILE, editorOnlyWorkerStub, UrlAssetCollector, urlAssetsPlugin } from './url-assets-plugin';
export interface PlayerBundle {
    readonly manifest: PlayerBundleManifest;
    readonly files: Map<string, Uint8Array>;
}
const PLAYER_ENTRY = 'engine/player/player-entry.tsx';
const EDITOR_ONLY_WORKERS: ReadonlySet<string> = new Set(['engine/scripting/compiler/typescript-worker.ts', 'engine/scripting/languages/c/clang-worker.ts', 'engine/build/assemble.worker.ts']);
let cached: Promise<PlayerBundle> | null = null;
export function bundlePlayerRuntime(): Promise<PlayerBundle> {
    if (process.env.NODE_ENV !== 'production')
        return bundle();
    if (!cached) {
        cached = bundle().catch((cause: unknown) => {
            cached = null;
            throw cause;
        });
    }
    return cached;
}
function baseOptions(root: string, plugins: Plugin[]): BuildOptions {
    return {
        bundle: true,
        write: false,
        platform: 'browser',
        format: 'esm',
        target: 'es2022',
        minify: true,
        sourcemap: false,
        legalComments: 'none',
        logLevel: 'silent',
        jsx: 'automatic',
        absWorkingDir: root,
        alias: {
            '@': root,
            module: path.join(root, 'lib/shims/node-module.browser.ts'),
            fs: path.join(root, 'lib/shims/node-fs.browser.ts'),
        },
        define: { 'process.env.NODE_ENV': '"production"' },
        plugins,
    };
}
async function bundle(): Promise<PlayerBundle> {
    const started = performance.now();
    const root = process.cwd();
    const outdir = path.join(root, '.helix-player-out');
    const collector = new UrlAssetCollector(EDITOR_ONLY_WORKERS);
    const files = new Map<string, Uint8Array>();
    const main = await build({
        ...baseOptions(root, [nodeShimsPlugin(), urlAssetsPlugin({ root, collector, toRoot: './' })]),
        entryPoints: { player: path.join(root, PLAYER_ENTRY) },
        outdir,
        splitting: true,
        chunkNames: '[name]-[hash]',
    });
    for (const output of main.outputFiles ?? [])
        files.set(path.relative(outdir, output.path).split(path.sep).join('/'), output.contents);
    for (let pending = collector.takePendingWorkers(); pending.length > 0; pending = collector.takePendingWorkers()) {
        for (const worker of pending) {
            const result = await build({
                ...baseOptions(root, [nodeShimsPlugin(), urlAssetsPlugin({ root, collector, toRoot: '../' })]),
                entryPoints: { [worker.slug]: worker.source },
                outdir: path.join(outdir, 'workers'),
            });
            for (const output of result.outputFiles ?? [])
                files.set(`workers/${path.basename(output.path)}`, output.contents);
        }
    }
    if (collector.editorOnlyHits.size > 0)
        files.set(EDITOR_ONLY_WORKER_FILE, new TextEncoder().encode(editorOnlyWorkerStub()));
    for (const asset of collector.assets.values())
        files.set(`assets/${asset.name}`, asset.bytes);
    if (!files.has('player.js'))
        throw new Error('o esbuild não produziu o player.js');
    const hash = createHash('sha256');
    for (const name of Array.from(files.keys()).sort())
        hash.update(name).update(files.get(name)!);
    const sizes: Record<string, number> = {};
    for (const [name, bytes] of files)
        sizes[name] = bytes.byteLength;
    const manifest: PlayerBundleManifest = {
        hash: hash.digest('hex').slice(0, 16),
        builtAt: Date.now(),
        engineVersion: ENGINE_VERSION,
        electronVersion: HELIX_PLAYER_ELECTRON_VERSION,
        files: sizes,
        publicAssets: await listRuntimePublicAssets(root),
        workerEntries: Array.from(collector.workers.values(), (worker) => worker.source),
        editorOnlyWorkers: Array.from(collector.editorOnlyHits),
        durationMs: Math.round(performance.now() - started),
    };
    return { manifest, files };
}
