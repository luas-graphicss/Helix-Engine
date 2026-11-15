import 'server-only';
import path from 'node:path';
import { build } from 'esbuild';
const WORKER_ENTRY = 'engine/mcp/worker/worker-entry.ts';
let cached: Promise<string> | null = null;
async function bundle(): Promise<string> {
    const root = process.cwd();
    const result = await build({
        entryPoints: [path.join(root, WORKER_ENTRY)],
        bundle: true,
        write: false,
        platform: 'neutral',
        format: 'esm',
        target: 'es2022',
        alias: { '@': root },
        legalComments: 'none',
        logLevel: 'silent',
    });
    const [output] = result.outputFiles;
    if (!output)
        throw new Error(`o esbuild não produziu saída para ${WORKER_ENTRY}`);
    return output.text;
}
export function bundleWorker(): Promise<string> {
    if (process.env.NODE_ENV !== 'production')
        return bundle();
    cached ??= bundle().catch((cause: unknown) => {
        cached = null;
        throw cause;
    });
    return cached;
}
