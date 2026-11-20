import type { NetValue } from '../wire/net-value';
import { isNetRecord } from './service-params';
export type SessionTicket = {
    readonly mode: 'dedicated';
    readonly sessionId: string;
} | {
    readonly mode: 'relay';
    readonly joinCode: string;
};
export type SessionAllocator = (maxPlayers: number) => string;
export function sessionTicketToValue(ticket: SessionTicket): NetValue {
    return ticket.mode === 'dedicated' ? { mode: ticket.mode, sessionId: ticket.sessionId } : { mode: ticket.mode, joinCode: ticket.joinCode };
}
export function parseSessionTicket(value: NetValue | undefined): SessionTicket | null {
    if (!isNetRecord(value))
        return null;
    if (value.mode === 'dedicated' && typeof value.sessionId === 'string')
        return { mode: 'dedicated', sessionId: value.sessionId };
    if (value.mode === 'relay' && typeof value.joinCode === 'string')
        return { mode: 'relay', joinCode: value.joinCode };
    return null;
}
