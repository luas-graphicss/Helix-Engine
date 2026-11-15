import { NextResponse } from 'next/server';
import { buildKitArchive } from '@/engine/mcp/kit/kit-archive';
import { MCP_KIT_FILE_NAME } from '@/engine/mcp/kit/kit-location';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const NO_STORE = { 'Cache-Control': 'no-store' };
export async function GET(): Promise<Response> {
    try {
        const archive = await buildKitArchive();
        return new Response(archive, {
            headers: { ...NO_STORE, 'Content-Type': 'application/zip', 'Content-Length': String(archive.byteLength), 'Content-Disposition': `attachment; filename="${MCP_KIT_FILE_NAME}"`, 'X-Content-Type-Options': 'nosniff' },
        });
    }
    catch (cause) {
        return NextResponse.json({ error: cause instanceof Error ? cause.message : String(cause) }, { status: 500, headers: NO_STORE });
    }
}
