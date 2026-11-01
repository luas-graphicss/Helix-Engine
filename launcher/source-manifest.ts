import { promises as fs } from 'node:fs';
import path from 'node:path';
import { IGNORED_DIRECTORIES, SOURCE_ENTRIES } from './source-entries';
export interface SourceEntryStats {
    readonly path: string;
    readonly description: string;
    readonly assets: boolean;
    readonly present: boolean;
    readonly files: number;
    readonly bytes: number;
    readonly modifiedAt: number;
}
export interface SourceManifest {
    readonly entries: readonly SourceEntryStats[];
    readonly totalFiles: number;
    readonly totalBytes: number;
    readonly codeBytes: number;
    readonly codeFiles: number;
    readonly modifiedAt: number;
    readonly generatedAt: number;
}
interface WalkTotals {
    files: number;
    bytes: number;
    modifiedAt: number;
}
async function walk(absolutePath: string, totals: WalkTotals): Promise<void> {
    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats)
        return;
    if (stats.isFile()) {
        totals.files++;
        totals.bytes += stats.size;
        totals.modifiedAt = Math.max(totals.modifiedAt, stats.mtimeMs);
        return;
    }
    if (!stats.isDirectory())
        return;
    const children = await fs.readdir(absolutePath);
    for (const child of children) {
        if (IGNORED_DIRECTORIES.has(child))
            continue;
        await walk(path.join(absolutePath, child), totals);
    }
}
export async function buildSourceManifest(rootDir: string): Promise<SourceManifest> {
    const entries: SourceEntryStats[] = [];
    for (const entry of SOURCE_ENTRIES) {
        const totals: WalkTotals = { files: 0, bytes: 0, modifiedAt: 0 };
        const absolutePath = path.join(rootDir, entry.path);
        const present = (await fs.stat(absolutePath).catch(() => null)) !== null;
        if (present)
            await walk(absolutePath, totals);
        entries.push({ path: entry.path, description: entry.description, assets: entry.assets ?? false, present, ...totals });
    }
    let totalFiles = 0;
    let totalBytes = 0;
    let codeBytes = 0;
    let codeFiles = 0;
    let modifiedAt = 0;
    for (const entry of entries) {
        totalFiles += entry.files;
        totalBytes += entry.bytes;
        modifiedAt = Math.max(modifiedAt, entry.modifiedAt);
        if (!entry.assets) {
            codeBytes += entry.bytes;
            codeFiles += entry.files;
        }
    }
    return { entries, totalFiles, totalBytes, codeBytes, codeFiles, modifiedAt, generatedAt: Date.now() };
}
