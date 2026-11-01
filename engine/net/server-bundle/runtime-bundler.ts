import 'server-only';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'esbuild';
import { ENGINE_VERSION } from '@/engine/core/engine-info';
import type { ServerRuntimeModule } from './runtime-modules';
export interface BundledRuntime {
    readonly code: string;
    readonly hash: string;
}
const cache = new Map<string, Promise<BundledRuntime>>();
export function bundleServerRuntime(module: ServerRuntimeModule): Promise<BundledRuntime> {
    if (process.env.NODE_ENV !== 'production')
        return bundle(module);
    let pending = cache.get(module.id);
    if (!pending) {
        pending = bundle(module).catch((cause: unknown) => {
            cache.delete(module.id);
            throw cause;
        });
        cache.set(module.id, pending);
    }
    return pending;
}
async function bundle(module: ServerRuntimeModule): Promise<BundledRuntime> {
    const root = process.cwd();
    const result = await build({
        entryPoints: [path.join(root, module.entry)],
        bundle: true,
        write: false,
        platform: 'neutral',
        format: 'esm',
        target: 'es2022',
        alias: { '@': root },
        legalComments: 'none',
        banner: { js: `// ${module.file} · Helix Engine ${ENGINE_VERSION}\n// Runtime de ${module.language} para o servidor: o código compilado o pede como ${JSON.stringify(module.specifier)}. Gerado pela engine; não precisa editar.` },
        logLevel: 'silent',
    });
    const [output] = result.outputFiles;
    if (!output)
        throw new Error(`o esbuild não produziu saída para ${module.entry}`);
    const hash = createHash('sha256').update(output.text).digest('hex').slice(0, 16);
    return { code: output.text, hash };
}
