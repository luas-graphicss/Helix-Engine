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
function isDisconnectCode(code: string): code is DisconnectCode {
    return Object.hasOwn(LABELS, code);
}
export function describeDisconnect(reason: string): string {
    const [code, ...detail] = reason.split(':');
    if (!isDisconnectCode(code))
        return reason;
    const extra = detail.join(':').trim();
    return extra ? `${LABELS[code]} (${extra})` : LABELS[code];
}
export function disconnectReason(code: DisconnectCode, detail = ''): string {
    return detail ? `${code}:${detail}` : code;
}
