import { isNetValue, type NetValue } from '../wire/net-value';
export const MAX_SERVICE_FRAME_LENGTH = 64 * 1024;
const ERROR_LABELS = {
    invalid: 'pedido inválido',
    'not-found': 'não encontrado',
    forbidden: 'sem permissão',
    full: 'lotado',
    conflict: 'estado incompatível',
    limit: 'limite atingido',
    timeout: 'o serviço não respondeu a tempo',
    disconnected: 'sem ligação com o serviço',
    'unknown-method': 'serviço desconhecido',
} as const;
export type ServiceErrorCode = keyof typeof ERROR_LABELS;
export class ServiceError extends Error {
    constructor(readonly code: ServiceErrorCode, message: string) {
        super(message);
        this.name = 'ServiceError';
    }
}
export interface ServiceRequest {
    readonly id: number;
    readonly method: string;
    readonly params: NetValue;
}
export type ServiceReply = {
    readonly id: number;
    readonly ok: true;
    readonly value: NetValue;
} | {
    readonly id: number;
    readonly ok: false;
    readonly code: ServiceErrorCode;
    readonly message: string;
};
export interface ServiceEvent {
    readonly event: string;
    readonly payload: NetValue;
}
export type ServerFrame = ServiceReply | ServiceEvent;
function isErrorCode(code: unknown): code is ServiceErrorCode {
    return typeof code === 'string' && Object.hasOwn(ERROR_LABELS, code);
}
export function describeServiceError(error: ServiceError): string {
    return error.message ? `${ERROR_LABELS[error.code]}: ${error.message}` : ERROR_LABELS[error.code];
}
function parseRecord(text: string): Record<string, unknown> | null {
    if (text.length > MAX_SERVICE_FRAME_LENGTH)
        return null;
    try {
        const parsed: unknown = JSON.parse(text);
        return isNetValue(parsed) && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
export function parseServiceRequest(text: string): ServiceRequest | null {
    const record = parseRecord(text);
    if (!record || typeof record.id !== 'number' || typeof record.method !== 'string' || !isNetValue(record.params))
        return null;
    return { id: record.id, method: record.method, params: record.params };
}
export function parseServerFrame(text: string): ServerFrame | null {
    const record = parseRecord(text);
    if (!record)
        return null;
    if (typeof record.event === 'string' && isNetValue(record.payload))
        return { event: record.event, payload: record.payload };
    if (typeof record.id !== 'number')
        return null;
    if (record.ok === true && isNetValue(record.value))
        return { id: record.id, ok: true, value: record.value };
    if (record.ok === false && isErrorCode(record.code) && typeof record.message === 'string')
        return { id: record.id, ok: false, code: record.code, message: record.message };
    return null;
}
