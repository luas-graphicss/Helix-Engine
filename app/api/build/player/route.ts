import { zipSync, type Zippable } from 'fflate';
import { NextResponse } from 'next/server';
import { bundlePlayerRuntime } from '@/engine/build/server/player-bundler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const NO_STORE = { 'Cache-Control': 'no-store' };
export async function GET(request: Request): Promise<Response> {
    try {
        const { manifest, files } = await bundlePlayerRuntime();
        const etag = `"${manifest.hash}"`;
        if (request.headers.get('if-none-match') === etag)
            return new Response(null, { status: 304, headers: { ETag: etag } });
        const entries: Zippable = { 'manifest.json': [new TextEncoder().encode(JSON.stringify(manifest)), { level: 6 }] };
        for (const [name, bytes] of files)
            entries[name] = [bytes, { level: name.endsWith('.wasm') ? 0 : 6 }];
        const zip = zipSync(entries);
        return new Response(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer, {
            headers: { 'Content-Type': 'application/zip', 'Cache-Control': 'no-cache', ETag: etag, 'X-Helix-Player': manifest.hash },
        });
    }
    catch (cause) {
        return NextResponse.json({ error: cause instanceof Error ? cause.message : String(cause) }, { status: 500, headers: NO_STORE });
    }
}
