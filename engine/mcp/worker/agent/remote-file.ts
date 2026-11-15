import { readBytes, RequestBodyError } from '@/engine/mcp/worker/http/request-body';
import { FILE_LIMIT_BYTES } from '@/engine/mcp/worker/session/file-store';
const FETCH_TIMEOUT_MS = 20000;
const BYTES_PER_MEBIBYTE = 1024 * 1024;
const SECURE_PROTOCOL = 'https:';
export type RemoteFile = {
    readonly ok: true;
    readonly name: string;
    readonly mimeType: string;
    readonly bytes: Uint8Array;
} | {
    readonly ok: false;
    readonly problem: string;
};
function rejected(problem: string): RemoteFile {
    return { ok: false, problem };
}
function parsePublicUrl(address: string, ownHost: string): URL | null {
    if (!URL.canParse(address))
        return null;
    const url = new URL(address);
    return url.protocol === SECURE_PROTOCOL && !url.username && !url.password && url.host !== ownHost ? url : null;
}
async function requestFile(url: URL): Promise<Response | string> {
    try {
        return await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    }
    catch (cause) {
        return `Could not reach ${url.hostname}: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
}
async function readFileBody(response: Response): Promise<Uint8Array | null> {
    try {
        return await readBytes(response, FILE_LIMIT_BYTES);
    }
    catch (cause) {
        if (cause instanceof RequestBodyError)
            return null;
        throw cause;
    }
}
export async function downloadRemoteFile(address: string, ownHost: string): Promise<RemoteFile> {
    const url = parsePublicUrl(address, ownHost);
    if (!url)
        return rejected('Only public https URLs without credentials are accepted.');
    const response = await requestFile(url);
    if (typeof response === 'string')
        return rejected(response);
    if (!response.ok)
        return rejected(`${url.hostname} answered HTTP ${response.status}.`);
    if (!response.url.startsWith(SECURE_PROTOCOL))
        return rejected(`${url.hostname} redirected to an address that is not https.`);
    const bytes = await readFileBody(response);
    if (!bytes)
        return rejected(`The file exceeds the limit of ${FILE_LIMIT_BYTES / BYTES_PER_MEBIBYTE} MB.`);
    return { ok: true, name: url.pathname.split('/').pop() ?? '', mimeType: response.headers.get('content-type') ?? '', bytes };
}
