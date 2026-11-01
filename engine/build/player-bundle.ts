import JSZip from 'jszip';
export const PLAYER_BUNDLE_API = '/api/build/player';
export interface PlayerBundleManifest {
    readonly hash: string;
    readonly builtAt: number;
    readonly engineVersion: string;
    readonly electronVersion: string;
    readonly files: Record<string, number>;
    readonly publicAssets: Record<string, number>;
    readonly workerEntries: readonly string[];
    readonly editorOnlyWorkers: readonly string[];
    readonly durationMs: number;
}
export interface PlayerRuntime {
    readonly manifest: PlayerBundleManifest;
    readonly files: Map<string, Uint8Array>;
    readonly jsBytes: number;
}
export async function fetchPlayerRuntime(signal?: AbortSignal): Promise<PlayerRuntime> {
    const response = await fetch(PLAYER_BUNDLE_API, { signal, cache: 'no-store' });
    if (!response.ok) {
        let detail = '';
        try {
            const body = (await response.json()) as {
                error?: string;
            };
            detail = body.error ?? '';
        }
        catch {
        }
        throw new Error(`O servidor não conseguiu montar o runtime do jogo (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`);
    }
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry)
        throw new Error('O runtime do jogo veio sem manifesto.');
    const manifest = JSON.parse(await manifestEntry.async('string')) as PlayerBundleManifest;
    const files = new Map<string, Uint8Array>();
    let jsBytes = 0;
    for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir || path === 'manifest.json')
            continue;
        const bytes = await entry.async('uint8array');
        files.set(path, bytes);
        if (path.endsWith('.js'))
            jsBytes += bytes.length;
    }
    if (!files.has('player.js'))
        throw new Error('O runtime do jogo veio sem o player.js.');
    return { manifest, files, jsBytes };
}
export async function fetchPublicAsset(path: string, signal?: AbortSignal): Promise<Uint8Array> {
    const response = await fetch(`/${path}`, { signal });
    if (!response.ok)
        throw new Error(`Arquivo da engine indisponível: /${path} (HTTP ${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
}
export interface CapturedStyles {
    readonly css: string;
    readonly htmlClass: string;
    readonly bodyClass: string;
    readonly colorScheme: string;
    readonly inlinedAssets: number;
}
async function toDataUrl(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const blob = await response.blob();
        if (blob.size > 4 * 1024 * 1024)
            return null;
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }
    catch {
        return null;
    }
}
export async function captureStyles(): Promise<CapturedStyles> {
    const parts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
            rules = sheet.cssRules;
        }
        catch {
            continue;
        }
        for (const rule of Array.from(rules))
            parts.push(rule.cssText);
    }
    let css = parts.join('\n');
    const urls = new Set<string>();
    for (const match of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
        const target = match[2];
        if (target.startsWith('data:') || target.startsWith('blob:') || target.startsWith('#'))
            continue;
        urls.add(target);
    }
    let inlinedAssets = 0;
    for (const target of urls) {
        let absolute: URL;
        try {
            absolute = new URL(target, location.href);
        }
        catch {
            continue;
        }
        if (absolute.origin !== location.origin)
            continue;
        const dataUrl = await toDataUrl(absolute.href);
        if (!dataUrl)
            continue;
        inlinedAssets++;
        css = css.split(`url(${target})`).join(`url(${dataUrl})`).split(`url("${target}")`).join(`url("${dataUrl}")`).split(`url('${target}')`).join(`url('${dataUrl}')`);
    }
    const root = document.documentElement;
    return {
        css,
        htmlClass: root.className,
        bodyClass: document.body.className,
        colorScheme: getComputedStyle(root).colorScheme || 'dark',
        inlinedAssets,
    };
}
