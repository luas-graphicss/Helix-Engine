import type { NetServer } from '../session/net-server';
import type { NetServerListener } from '../session/server-types';
export interface SessionDelegate extends NetServerListener {
    opened(server: NetServer): void;
    closed(): void;
}
export type SessionDelegateFactory = (sessionId: string) => SessionDelegate;
export function createIdleDelegate(): SessionDelegate {
    return {
        opened: () => undefined,
        closed: () => undefined,
        playerJoined: () => undefined,
        playerLeft: () => undefined,
        playerSuspended: () => undefined,
        playerResumed: () => undefined,
        inputReceived: () => undefined,
        ownershipRequested: () => false,
        approvalFailed: () => undefined,
        ticked: () => undefined,
    };
}
