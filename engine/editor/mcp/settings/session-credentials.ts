import type { SessionAddress } from '@/engine/mcp/protocol/session-address';
const SESSION_BYTE_COUNT = 5;
const TOKEN_BYTE_COUNT = 16;
const PEER_BYTE_COUNT = 12;
function randomHex(byteCount: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function createSessionAddress(): SessionAddress {
    return { session: randomHex(SESSION_BYTE_COUNT), token: randomHex(TOKEN_BYTE_COUNT) };
}
export function createPeerId(): string {
    return randomHex(PEER_BYTE_COUNT);
}
