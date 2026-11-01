import { NextResponse } from 'next/server';
import { build, buildStatus } from '@/engine/scripting/build/build-service';
import { BUILD_ENVELOPE_CONTENT_TYPE, encodeBuildEnvelope, validateBuildRequest, type NativeBuildRequest } from '@/engine/scripting/languages/native/build-protocol';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const NO_STORE = { 'Cache-Control': 'no-store' };
export async function GET(): Promise<Response> {
    return NextResponse.json(await buildStatus(), { headers: NO_STORE });
}
export async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: 'o corpo do pedido precisa ser JSON.' }, { status: 400, headers: NO_STORE });
    }
    const problem = validateBuildRequest(body);
    if (problem)
        return NextResponse.json({ error: problem }, { status: 400, headers: NO_STORE });
    try {
        const { meta, artifact } = await build(body as NativeBuildRequest);
        const envelope = encodeBuildEnvelope(meta, artifact);
        return new Response(envelope.buffer as ArrayBuffer, { headers: { ...NO_STORE, 'Content-Type': BUILD_ENVELOPE_CONTENT_TYPE } });
    }
    catch (cause) {
        return NextResponse.json({ error: cause instanceof Error ? cause.message : String(cause) }, { status: 500, headers: NO_STORE });
    }
}
