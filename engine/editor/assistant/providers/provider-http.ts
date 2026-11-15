import { isRecord, parseJson } from './json-value';
const REQUEST_TIMEOUT_MS = 240000;
const FAILURE_DETAIL_LIMIT = 400;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const STATUS_HINT: Readonly<Record<number, string>> = {
    401: 'A chave de API foi recusada.',
    403: 'A chave de API não tem acesso a este recurso.',
    404: 'Endpoint ou modelo não encontrado.',
    429: 'Limite de uso do provedor atingido.',
};
export class ProviderError extends Error {
    constructor(message: string, readonly status: number | null, options?: ErrorOptions) {
        super(message, options);
        this.name = 'ProviderError';
    }
}
export interface JsonRequest {
    readonly method: 'GET' | 'POST';
    readonly headers: Readonly<Record<string, string>>;
    readonly signal: AbortSignal;
    readonly body?: unknown;
}
export function resolveEndpointUrl(baseUrl: string, path: string): URL {
    const trimmed = baseUrl.trim();
    if (!trimmed)
        throw new ProviderError('Informe a URL base do provedor.', null);
    if (!URL.canParse(trimmed))
        throw new ProviderError(`A URL base "${trimmed}" não é válida.`, null);
    const url = new URL(path, trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
    const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
    if (!allowed)
        throw new ProviderError('Use uma URL https. Endereços http só valem para servidores locais (localhost).', null);
    return url;
}
function errorMessageOf(payload: unknown): string | undefined {
    if (!isRecord(payload))
        return undefined;
    const { error, message } = payload;
    if (typeof error === 'string')
        return error;
    if (isRecord(error) && typeof error.message === 'string')
        return error.message;
    return typeof message === 'string' ? message : undefined;
}
function summarize(detail: string): string {
    return detail.trim().slice(0, FAILURE_DETAIL_LIMIT);
}
function failureDetail(status: number, body: string): string {
    return [STATUS_HINT[status], summarize(errorMessageOf(parseJson(body)) ?? body)].filter(Boolean).join(' ');
}
export function connectionFailure(url: URL, cause: unknown): ProviderError {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
    const message = timedOut
        ? `${url.host} demorou demais para responder.`
        : `Sem resposta de ${url.host}. Confira a URL, a conexão e se o provedor aceita chamadas feitas pelo navegador (CORS).`;
    return new ProviderError(message, null, { cause });
}
export function streamFailure(url: URL, payload: unknown): ProviderError {
    return new ProviderError(`${url.host} interrompeu a resposta. ${summarize(errorMessageOf(payload) ?? 'O provedor não informou o motivo.')}`, null);
}
export async function openResponse(url: URL, request: JsonRequest, signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: request.method,
            headers: request.headers,
            body: request.body === undefined ? undefined : JSON.stringify(request.body),
            signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            cache: 'no-store',
        });
    }
    catch (cause) {
        if (request.signal.aborted)
            throw cause;
        throw connectionFailure(url, cause);
    }
    if (!response.ok)
        throw new ProviderError(`${url.host} respondeu ${response.status}. ${failureDetail(response.status, await response.text())}`, response.status);
    return response;
}
export async function requestJson(url: URL, request: JsonRequest): Promise<unknown> {
    const response = await openResponse(url, request, AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]));
    const parsed = parseJson(await response.text());
    if (parsed === undefined)
        throw new ProviderError(`${url.host} devolveu uma resposta que não é JSON.`, response.status);
    return parsed;
}
