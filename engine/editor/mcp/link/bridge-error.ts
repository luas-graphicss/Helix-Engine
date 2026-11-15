import type { BridgeErrorCode } from '@/engine/mcp/protocol/bridge-messages';
export type BridgeFailureKind = BridgeErrorCode | 'UNREACHABLE' | 'UNEXPECTED_RESPONSE';
const FATAL_KINDS: ReadonlySet<BridgeFailureKind> = new Set(['PEER_REPLACED', 'PROTOCOL_MISMATCH', 'UNAUTHORIZED', 'BAD_REQUEST']);
const FAILURE_TEXT: Record<BridgeFailureKind, string> = {
    UNREACHABLE: 'Não foi possível alcançar o Worker. Confira a URL e a sua conexão.',
    UNEXPECTED_RESPONSE: 'O endereço respondeu algo inesperado. Confira se a URL é a do Worker do kit MCP.',
    UNAUTHORIZED: 'O Worker exige um segredo. Preencha o campo Segredo com o valor definido no wrangler.',
    PROTOCOL_MISMATCH: 'O Worker publicado é de outra versão do kit. Baixe o kit de novo e rode npx wrangler deploy.',
    PEER_REPLACED: 'Outra aba do editor assumiu esta conexão.',
    BAD_REQUEST: 'O Worker recusou a mensagem do editor. Baixe o kit de novo e publique.',
    UNKNOWN_PEER: 'O Worker reiniciou e o editor está se apresentando de novo.',
    FILE_NOT_FOUND: 'O Worker não tem mais o arquivo pedido.',
    BODY_TOO_LARGE: 'O Worker recusou um envio grande demais.',
};
export class BridgeError extends Error {
    constructor(readonly kind: BridgeFailureKind, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'BridgeError';
    }
    get fatal(): boolean {
        return FATAL_KINDS.has(this.kind);
    }
}
export function describeBridgeFailure(cause: unknown): string {
    if (cause instanceof BridgeError)
        return FAILURE_TEXT[cause.kind];
    return `Falha inesperada na conexão MCP: ${cause instanceof Error ? cause.message : String(cause)}`;
}
