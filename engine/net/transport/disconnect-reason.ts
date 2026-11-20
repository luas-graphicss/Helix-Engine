export const DISCONNECT = {
    timeout: 'timeout',
    unreachable: 'unreachable',
    protocol: 'protocol',
    overflow: 'overflow',
    shutdown: 'shutdown',
    left: 'left',
    kicked: 'kicked',
    rejected: 'rejected',
    flood: 'flood',
    replaced: 'replaced',
} as const;
export type DisconnectCode = (typeof DISCONNECT)[keyof typeof DISCONNECT];
const LABELS: Record<DisconnectCode, string> = {
    timeout: 'a conexão ficou sem resposta',
    unreachable: 'o servidor não respondeu',
    protocol: 'mensagens fora do protocolo',
    overflow: 'fila de envio esgotada',
    shutdown: 'a sessão foi encerrada',
    left: 'saiu da sessão',
    kicked: 'removido pelo servidor',
    rejected: 'entrada recusada',
    flood: 'excesso de mensagens',
    replaced: 'a mesma sessão entrou por outra conexão',
};
const REJECTION_LABELS: Record<string, string> = {
    protocol: 'o servidor fala outra versão do protocolo; exporte o pacote de servidor de novo',
    schema: 'o jogo e o servidor foram exportados de versões diferentes do projeto',
    full: 'a sessão está cheia',
    handshake: 'a apresentação não chegou a tempo',
    denied: 'o servidor recusou a entrada',
};
const RECOVERABLE: ReadonlySet<string> = new Set([DISCONNECT.timeout, DISCONNECT.unreachable, DISCONNECT.shutdown, DISCONNECT.overflow]);
function isDisconnectCode(code: string): code is DisconnectCode {
    return Object.hasOwn(LABELS, code);
}
export function disconnectCode(reason: string): string {
    const separator = reason.indexOf(':');
    return separator < 0 ? reason : reason.slice(0, separator);
}
export function disconnectDetail(reason: string): string {
    const separator = reason.indexOf(':');
    return separator < 0 ? '' : reason.slice(separator + 1).trim();
}
export function isRecoverableDisconnect(reason: string): boolean {
    return RECOVERABLE.has(disconnectCode(reason));
}
export function describeDisconnect(reason: string): string {
    const code = disconnectCode(reason);
    if (!isDisconnectCode(code))
        return reason;
    const detail = disconnectDetail(reason);
    if (code === DISCONNECT.rejected && Object.hasOwn(REJECTION_LABELS, detail))
        return REJECTION_LABELS[detail];
    return detail ? `${LABELS[code]} (${detail})` : LABELS[code];
}
export function disconnectReason(code: DisconnectCode, detail = ''): string {
    return detail ? `${code}:${detail}` : code;
}
