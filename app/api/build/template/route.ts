import { NextResponse } from 'next/server';
import { BUILD_PLATFORMS, HELIX_PLAYER_ELECTRON_VERSION } from '@/engine/build/build-targets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const RELEASE_BASE = `https://github.com/electron/electron/releases/download/v${HELIX_PLAYER_ELECTRON_VERSION}/`;
const SHASUMS_ASSET = 'SHASUMS256.txt';
const ALLOWED_ASSETS: ReadonlySet<string> = new Set([SHASUMS_ASSET, ...BUILD_PLATFORMS.map((platform) => platform.asset)]);
const NO_STORE = { 'Cache-Control': 'no-store' };
export async function GET(request: Request): Promise<Response> {
    const asset = new URL(request.url).searchParams.get('asset') ?? '';
    if (!ALLOWED_ASSETS.has(asset))
        return NextResponse.json({ error: `"${asset}" não é um template do Helix Player.` }, { status: 400, headers: NO_STORE });
    let upstream: Response;
    try {
        upstream = await fetch(RELEASE_BASE + asset, { redirect: 'follow', signal: request.signal });
    }
    catch (cause) {
        return NextResponse.json({ error: `Não foi possível alcançar os lançamentos do Electron: ${cause instanceof Error ? cause.message : String(cause)}` }, { status: 502, headers: NO_STORE });
    }
    if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: `Os lançamentos do Electron responderam HTTP ${upstream.status} para ${asset}.` }, { status: 502, headers: NO_STORE });
    }
    const headers: Record<string, string> = {
        'Content-Type': asset === SHASUMS_ASSET ? 'text/plain; charset=utf-8' : 'application/zip',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Helix-Template': asset,
    };
    const length = upstream.headers.get('content-length');
    if (length)
        headers['Content-Length'] = length;
    return new Response(upstream.body, { status: 200, headers });
}
