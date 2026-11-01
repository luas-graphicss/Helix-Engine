import { NextResponse } from 'next/server';
import { bundleServerRuntime } from '@/engine/net/server-bundle/runtime-bundler';
import { serverRuntimeModule } from '@/engine/net/server-bundle/runtime-modules';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const NO_STORE = { 'Cache-Control': 'no-store' };
export async function GET(request: Request, { params }: {
    params: Promise<{
        module: string;
    }>;
}): Promise<Response> {
    const { module: id } = await params;
    const module = serverRuntimeModule(id);
    if (!module)
        return NextResponse.json({ error: `"${id}" não é um runtime de servidor da engine.` }, { status: 404, headers: NO_STORE });
    try {
        const { code, hash } = await bundleServerRuntime(module);
        const etag = `"${hash}"`;
        if (request.headers.get('if-none-match') === etag)
            return new Response(null, { status: 304, headers: { ETag: etag } });
        return new Response(code, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', ETag: etag, 'X-Helix-Runtime': module.specifier } });
    }
    catch (cause) {
        return NextResponse.json({ error: cause instanceof Error ? cause.message : String(cause) }, { status: 500, headers: NO_STORE });
    }
}
