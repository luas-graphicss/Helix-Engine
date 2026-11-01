import { NextResponse, type NextRequest } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildSourceManifest } from './source-manifest';
import { buildSourceZip, sourceZipFilename } from './source-zip';
import { LAUNCHER_CSS_PATH, LAUNCHER_SCRIPT_PATH, LAUNCHER_TOKEN_COOKIE, LAUNCHER_ZIP_PATH, renderLauncherErrorHtml, renderLauncherHtml } from './launcher-html';
const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const STATIC_FILES: Readonly<Record<string, {
    file: string;
    type: string;
}>> = {
    [LAUNCHER_CSS_PATH]: { file: 'launcher.css', type: 'text/css; charset=utf-8' },
    [LAUNCHER_SCRIPT_PATH]: { file: 'launcher-client.js', type: 'text/javascript; charset=utf-8' },
};
function html(body: string, status = 200): NextResponse {
    return new NextResponse(body, { status, headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' } });
}
function isHttps(request: NextRequest): boolean {
    return request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:';
}
function tokenCookie(request: NextRequest, token: string): string {
    const sameSite = isHttps(request) ? 'SameSite=None; Secure' : 'SameSite=Lax';
    return `${LAUNCHER_TOKEN_COOKIE}=${token}; Path=/; Max-Age=120; ${sameSite}`;
}
async function hasSources(rootDir: string): Promise<boolean> {
    return (await stat(path.join(rootDir, 'engine')).catch(() => null))?.isDirectory() ?? false;
}
async function serveStatic(rootDir: string, pathname: string): Promise<NextResponse> {
    const entry = STATIC_FILES[pathname];
    const body = await readFile(path.join(rootDir, 'launcher', entry.file), 'utf8');
    return new NextResponse(body, { headers: { ...NO_STORE, 'Content-Type': entry.type } });
}
async function servePage(rootDir: string): Promise<NextResponse> {
    try {
        return html(renderLauncherHtml(await buildSourceManifest(rootDir)));
    }
    catch (cause) {
        return html(renderLauncherErrorHtml('Não foi possível ler o manifesto', cause instanceof Error ? cause.message : 'Erro desconhecido ao ler o disco.'), 500);
    }
}
async function serveZip(rootDir: string, request: NextRequest): Promise<NextResponse> {
    const includeAssets = request.nextUrl.searchParams.get('assets') !== '0';
    const token = request.nextUrl.searchParams.get('token');
    try {
        const archive = await buildSourceZip(rootDir, { includeAssets });
        const headers = new Headers({
            ...NO_STORE,
            'Content-Type': 'application/zip',
            'Content-Length': String(archive.byteLength),
            'Content-Disposition': `attachment; filename="${sourceZipFilename(includeAssets)}"`,
            'X-Content-Type-Options': 'nosniff',
        });
        if (token && TOKEN_PATTERN.test(token))
            headers.append('Set-Cookie', tokenCookie(request, token));
        return new NextResponse(new Uint8Array(archive), { headers });
    }
    catch (cause) {
        return html(renderLauncherErrorHtml('Falha ao montar o zip', cause instanceof Error ? cause.message : 'Erro desconhecido ao ler o disco.'), 500);
    }
}
export async function handleLauncherRequest(request: NextRequest): Promise<NextResponse | null> {
    const { pathname } = request.nextUrl;
    const rootDir = process.cwd();
    if (pathname === '/') {
        if (!(await hasSources(rootDir)))
            return NextResponse.redirect(new URL('/editor', request.url));
        return servePage(rootDir);
    }
    if (pathname === LAUNCHER_ZIP_PATH)
        return serveZip(rootDir, request);
    if (pathname in STATIC_FILES)
        return serveStatic(rootDir, pathname);
    return null;
}
