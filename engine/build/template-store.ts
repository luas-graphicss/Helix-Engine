import type { BuildPlatform } from './build-targets';
export const TEMPLATE_API = '/api/build/template';
const CACHE_NAME = 'helix-player-templates';
const SHASUMS_ASSET = 'SHASUMS256.txt';
const SHA_HEADER = 'X-Helix-Sha256';
export function templateUrl(asset: string): string {
    return `${TEMPLATE_API}?asset=${encodeURIComponent(asset)}`;
}
export interface TemplateProgress {
    readonly receivedBytes: number;
    readonly totalBytes: number;
    readonly bytesPerSecond: number;
    readonly phase: 'download' | 'verify' | 'cache';
}
export interface LoadedTemplate {
    readonly bytes: ArrayBuffer;
    readonly sha256: string;
    readonly fromCache: boolean;
    readonly downloadSeconds: number;
}
async function openCache(): Promise<Cache | null> {
    if (typeof caches === 'undefined')
        return null;
    try {
        return await caches.open(CACHE_NAME);
    }
    catch {
        return null;
    }
}
export async function isTemplateCached(platform: BuildPlatform): Promise<boolean> {
    const cache = await openCache();
    if (!cache)
        return false;
    return (await cache.match(templateUrl(platform.asset))) !== undefined;
}
export async function cachedTemplateBytes(): Promise<number> {
    const cache = await openCache();
    if (!cache)
        return 0;
    let total = 0;
    for (const request of await cache.keys()) {
        const response = await cache.match(request);
        total += Number(response?.headers.get('Content-Length') ?? 0);
    }
    return total;
}
export async function clearTemplateCache(): Promise<void> {
    if (typeof caches === 'undefined')
        return;
    await caches.delete(CACHE_NAME);
}
function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function sha256Of(bytes: ArrayBuffer): Promise<string> {
    return toHex(await crypto.subtle.digest('SHA-256', bytes));
}
async function fetchWithProgress(url: string, fallbackTotal: number, signal: AbortSignal | undefined, onProgress: (progress: TemplateProgress) => void): Promise<ArrayBuffer> {
    const response = await fetch(url, { signal, cache: 'no-store' });
    if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Não foi possível baixar o Helix Player (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : '.'}`);
    }
    const total = Number(response.headers.get('Content-Length')) || fallbackTotal;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    const startedAt = performance.now();
    let lastReport = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        chunks.push(value);
        received += value.length;
        const now = performance.now();
        if (now - lastReport > 120) {
            lastReport = now;
            const seconds = (now - startedAt) / 1000;
            onProgress({ receivedBytes: received, totalBytes: Math.max(total, received), bytesPerSecond: seconds > 0 ? received / seconds : 0, phase: 'download' });
        }
    }
    if (total && received !== total)
        throw new Error(`Download incompleto do Helix Player (${received} de ${total} bytes). Tente de novo.`);
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes.buffer;
}
async function publishedSha256(asset: string, signal?: AbortSignal): Promise<string | null> {
    const url = templateUrl(SHASUMS_ASSET);
    const cache = await openCache();
    let text: string | null = null;
    const cached = cache ? await cache.match(url) : undefined;
    if (cached)
        text = await cached.text();
    else {
        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok)
            return null;
        text = await response.text();
        if (cache)
            await cache.put(url, new Response(text, { headers: { 'Content-Type': 'text/plain' } })).catch(() => { });
    }
    for (const line of text.split('\n')) {
        const match = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim());
        if (match && match[2] === asset)
            return match[1];
    }
    return null;
}
export async function loadTemplate(platform: BuildPlatform, onProgress: (progress: TemplateProgress) => void, signal?: AbortSignal): Promise<LoadedTemplate> {
    const url = templateUrl(platform.asset);
    const cache = await openCache();
    const expected = await publishedSha256(platform.asset, signal);
    const cached = cache ? await cache.match(url) : undefined;
    if (cached) {
        onProgress({ receivedBytes: platform.templateBytes, totalBytes: platform.templateBytes, bytesPerSecond: 0, phase: 'verify' });
        const bytes = await cached.arrayBuffer();
        const sha256 = await sha256Of(bytes);
        if (!expected || sha256 === expected)
            return { bytes, sha256, fromCache: true, downloadSeconds: 0 };
        await cache?.delete(url);
    }
    const startedAt = performance.now();
    const bytes = await fetchWithProgress(url, platform.templateBytes, signal, onProgress);
    const downloadSeconds = (performance.now() - startedAt) / 1000;
    onProgress({ receivedBytes: bytes.byteLength, totalBytes: bytes.byteLength, bytesPerSecond: 0, phase: 'verify' });
    const sha256 = await sha256Of(bytes);
    if (expected && sha256 !== expected) {
        throw new Error(`O Helix Player baixado não confere com o hash publicado pelo Electron (${sha256.slice(0, 12)}… ≠ ${expected.slice(0, 12)}…). Tente de novo.`);
    }
    if (cache) {
        onProgress({ receivedBytes: bytes.byteLength, totalBytes: bytes.byteLength, bytesPerSecond: 0, phase: 'cache' });
        const headers = { 'Content-Type': 'application/zip', 'Content-Length': String(bytes.byteLength), [SHA_HEADER]: sha256 };
        await cache.put(url, new Response(bytes.slice(0), { headers })).catch(() => {
        });
    }
    return { bytes, sha256, fromCache: false, downloadSeconds };
}
