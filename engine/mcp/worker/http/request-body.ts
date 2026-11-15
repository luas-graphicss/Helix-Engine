export class RequestBodyError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'RequestBodyError';
    }
}
interface BodySource {
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
}
function joinChunks(chunks: readonly Uint8Array[], size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
export async function readBytes(source: BodySource, limit: number): Promise<Uint8Array> {
    const tooLarge = () => new RequestBodyError(`The body exceeds the limit of ${limit} bytes.`, 413);
    if (Number(source.headers.get('content-length') ?? Number.NaN) > limit)
        throw tooLarge();
    if (!source.body)
        return new Uint8Array(0);
    const reader = source.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            return joinChunks(chunks, size);
        size += value.byteLength;
        if (size > limit) {
            await reader.cancel();
            throw tooLarge();
        }
        chunks.push(value);
    }
}
export async function readJson(source: BodySource, limit: number): Promise<unknown> {
    const text = new TextDecoder().decode(await readBytes(source, limit));
    if (text.trim() === '')
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch {
        throw new RequestBodyError('The body is not valid JSON.', 400);
    }
}
