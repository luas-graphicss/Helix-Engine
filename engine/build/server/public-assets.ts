import 'server-only';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
export const RUNTIME_PUBLIC_ROOTS: readonly string[] = ['smaa', 'models', 'textures', 'vendor/wasmoon', 'vendor/pyodide', 'vendor/ruby', 'vendor/php'];
async function walk(directory: string, into: (file: string, size: number) => void): Promise<void> {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory())
            await walk(file, into);
        else if (entry.isFile())
            into(file, (await stat(file)).size);
    }
}
export async function listRuntimePublicAssets(root: string): Promise<Record<string, number>> {
    const publicDir = path.join(root, 'public');
    const assets: Record<string, number> = {};
    for (const relativeRoot of RUNTIME_PUBLIC_ROOTS) {
        await walk(path.join(publicDir, relativeRoot), (file, size) => {
            assets[path.relative(publicDir, file).split(path.sep).join('/')] = size;
        });
    }
    return assets;
}
