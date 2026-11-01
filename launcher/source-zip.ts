import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { IGNORED_DIRECTORIES, selectSourceEntries } from './source-entries';
export interface SourceZipOptions {
    includeAssets: boolean;
}
async function addToZip(zip: JSZip, rootDir: string, relativePath: string): Promise<void> {
    const absolutePath = path.join(rootDir, relativePath);
    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats)
        return;
    if (stats.isFile()) {
        zip.file(relativePath, await fs.readFile(absolutePath));
        return;
    }
    if (!stats.isDirectory())
        return;
    const children = await fs.readdir(absolutePath);
    for (const child of children) {
        if (IGNORED_DIRECTORIES.has(child))
            continue;
        await addToZip(zip, rootDir, path.posix.join(relativePath, child));
    }
}
export async function buildSourceZip(rootDir: string, options: SourceZipOptions): Promise<Buffer> {
    const zip = new JSZip();
    for (const entry of selectSourceEntries(options.includeAssets)) {
        await addToZip(zip, rootDir, entry.path);
    }
    return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });
}
export function sourceZipFilename(includeAssets: boolean, now = new Date()): string {
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    return `helix-engine${includeAssets ? '' : '-src'}-${timestamp}.zip`;
}
