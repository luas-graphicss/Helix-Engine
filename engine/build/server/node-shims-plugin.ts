import 'server-only';
import type { Plugin } from 'esbuild';
const EMPTY_BUILTINS: ReadonlySet<string> = new Set([
    'url',
    'path',
    'crypto',
    'worker_threads',
    'child_process',
    'os',
    'util',
    'stream',
    'buffer',
    'events',
    'assert',
    'zlib',
    'http',
    'https',
    'net',
    'tls',
    'vm',
    'perf_hooks',
    'readline',
    'tty',
    'v8',
    'fs/promises',
]);
const NAMESPACE = 'helix-node-empty';
export function nodeShimsPlugin(): Plugin {
    return {
        name: 'helix-node-shims',
        setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
                const specifier = args.path.startsWith('node:') ? args.path.slice(5) : args.path;
                return EMPTY_BUILTINS.has(specifier) ? { path: specifier, namespace: NAMESPACE } : undefined;
            });
            build.onLoad({ filter: /.*/, namespace: NAMESPACE }, () => ({ contents: 'export default {}', loader: 'js' }));
        },
    };
}
