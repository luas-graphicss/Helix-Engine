import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NativeBuildLanguage, NativeBuildMeta } from '../languages/native/build-protocol';
export function buildRoot(): string {
    return process.env.HELIX_BUILD_DIR ?? path.join(tmpdir(), 'helix-build');
}
export function sdkSourceDir(language: NativeBuildLanguage): string {
    return path.join(process.cwd(), 'engine', 'scripting', 'languages', language, 'sdk');
}
export function hashOf(...parts: readonly (string | Uint8Array)[]): string {
    const hash = createHash('sha256');
    for (const part of parts)
        hash.update(part);
    return hash.digest('hex').slice(0, 32);
}
export async function withWorkspace<T>(language: NativeBuildLanguage, fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = path.join(buildRoot(), 'work', language, randomBytes(8).toString('hex'));
    await mkdir(dir, { recursive: true });
    try {
        return await fn(dir);
    }
    finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
}
export async function cacheDir(language: NativeBuildLanguage, key: string): Promise<string> {
    const dir = path.join(buildRoot(), 'cache', language, key);
    await mkdir(dir, { recursive: true });
    return dir;
}
export interface CachedArtifact {
    readonly meta: NativeBuildMeta;
    readonly bytes: Uint8Array | null;
}
const ARTIFACT_META = 'meta.json';
const ARTIFACT_BYTES = 'artifact.bin';
export async function readCachedArtifact(language: NativeBuildLanguage, key: string): Promise<CachedArtifact | null> {
    const dir = path.join(buildRoot(), 'artifacts', language, key);
    try {
        const meta = JSON.parse(await readFile(path.join(dir, ARTIFACT_META), 'utf8')) as NativeBuildMeta;
        const bytes = meta.artifact ? new Uint8Array(await readFile(path.join(dir, ARTIFACT_BYTES))) : null;
        return { meta: { ...meta, cached: true }, bytes };
    }
    catch {
        return null;
    }
}
export async function writeCachedArtifact(language: NativeBuildLanguage, key: string, artifact: CachedArtifact): Promise<void> {
    if (!artifact.meta.ok)
        return;
    const dir = path.join(buildRoot(), 'artifacts', language, key);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ARTIFACT_META), JSON.stringify({ ...artifact.meta, cached: false }));
    if (artifact.bytes)
        await writeFile(path.join(dir, ARTIFACT_BYTES), artifact.bytes);
}
