import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const entryIndex = args.indexOf('--entry');
const entry = entryIndex >= 0 ? args.splice(entryIndex, 2)[1] : 'engine/debug/bench/physics-benchmark.entry.ts';
const directory = await mkdtemp(path.join(os.tmpdir(), 'helix-bench-'));
const outfile = path.join(directory, 'entry.mjs');
try {
    await build({
        entryPoints: [path.join(root, entry)],
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node20',
        outfile,
        alias: { '@': root },
        logLevel: 'warning',
    });
    process.argv = [process.argv[0], outfile, ...args];
    await import(pathToFileURL(outfile).href);
}
finally {
    await rm(directory, { recursive: true, force: true });
}
