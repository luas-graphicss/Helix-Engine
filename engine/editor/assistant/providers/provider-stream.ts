import { isRecord, parseJson, type JsonRecord } from './json-value';
import { connectionFailure, openResponse, ProviderError, streamFailure, type JsonRequest } from './provider-http';
const IDLE_TIMEOUT_MS = 240000;
const MAX_LINE_LENGTH = 4000000;
const LINE_BREAK = /\r\n|\n|\r(?!$)/;
const DATA_PREFIX = 'data:';
const END_MARKER = '[DONE]';
class EventFrames {
    private dataLines: string[] = [];
    accept(line: string): string | undefined {
        if (line === '')
            return this.take();
        if (line.startsWith(DATA_PREFIX))
            this.dataLines.push(line.slice(DATA_PREFIX.length).replace(/^ /, ''));
        return undefined;
    }
    take(): string | undefined {
        if (this.dataLines.length === 0)
            return undefined;
        const data = this.dataLines.join('\n');
        this.dataLines = [];
        return data;
    }
}
async function* readEventData(body: ReadableStream<Uint8Array>, onChunk: () => void): AsyncGenerator<string> {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    const frames = new EventFrames();
    let pending = '';
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            onChunk();
            const lines = `${pending}${value}`.split(LINE_BREAK);
            pending = lines.pop() ?? '';
            if (pending.length > MAX_LINE_LENGTH)
                throw new ProviderError('O provedor enviou um evento grande demais para ler.', null);
            for (const line of lines) {
                const data = frames.accept(line);
                if (data !== undefined)
                    yield data;
            }
        }
        const data = frames.accept(pending) ?? frames.take();
        if (data !== undefined)
            yield data;
    }
    finally {
        await reader.cancel();
    }
}
function isFailure(payload: JsonRecord): boolean {
    return payload.type === 'error' || (payload.error !== undefined && payload.error !== null);
}
export async function* streamJsonEvents(url: URL, request: JsonRequest): AsyncGenerator<JsonRecord> {
    const idle = new AbortController();
    const expire = () => idle.abort(new DOMException('The provider stopped sending data.', 'TimeoutError'));
    let idleTimer = setTimeout(expire, IDLE_TIMEOUT_MS);
    const restartIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(expire, IDLE_TIMEOUT_MS);
    };
    let received = 0;
    try {
        const response = await openResponse(url, request, AbortSignal.any([request.signal, idle.signal]));
        if (!response.body)
            throw new ProviderError(`${url.host} respondeu sem corpo.`, response.status);
        for await (const data of readEventData(response.body, restartIdleTimer)) {
            const payload = data === END_MARKER ? undefined : parseJson(data);
            if (!isRecord(payload))
                continue;
            if (isFailure(payload))
                throw streamFailure(url, payload);
            received++;
            yield payload;
        }
    }
    catch (cause) {
        if (cause instanceof ProviderError || request.signal.aborted)
            throw cause;
        throw connectionFailure(url, cause);
    }
    finally {
        clearTimeout(idleTimer);
    }
    if (received === 0)
        throw new ProviderError(`${url.host} não respondeu em streaming. Confira se o endpoint aceita "stream": true.`, null);
}
