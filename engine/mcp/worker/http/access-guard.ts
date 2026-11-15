const BEARER_PREFIX = 'bearer ';
async function digest(text: string): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function matchesSecret(candidate: string, secret: string): Promise<boolean> {
    const [left, right] = await Promise.all([digest(candidate), digest(secret)]);
    let difference = 0;
    for (let index = 0; index < left.length; index++)
        difference |= left[index] ^ right[index];
    return difference === 0;
}
export async function isAuthorized(request: Request, secret: string): Promise<boolean> {
    if (!secret)
        return true;
    const header = request.headers.get('authorization') ?? '';
    if (!header.toLowerCase().startsWith(BEARER_PREFIX))
        return false;
    return matchesSecret(header.slice(BEARER_PREFIX.length).trim(), secret);
}
