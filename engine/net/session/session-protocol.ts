export const SESSION_PROTOCOL_VERSION = 2;
export const MESSAGE = {
    hello: 1,
    welcome: 2,
    ping: 3,
    pong: 4,
    playerJoined: 5,
    playerLeft: 6,
    defineName: 7,
    rpc: 8,
    spawn: 9,
    despawn: 10,
    ownerChanged: 11,
    variables: 12,
    variableSet: 13,
    state: 14,
    ownerState: 15,
    correction: 16,
    input: 17,
    ownershipRequest: 18,
} as const;
export const MAX_PLAYER_NAME_LENGTH = 32;
export const MAX_NAME_BYTES = 128;
export const MAX_TOKEN_BYTES = 64;
export const MAX_REASON_BYTES = 256;
export interface SessionPlayer {
    readonly id: number;
    readonly name: string;
}
export const REJECTION = {
    protocol: 'protocol',
    schema: 'schema',
    full: 'full',
    handshake: 'handshake',
    denied: 'denied',
} as const;
