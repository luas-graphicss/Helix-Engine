const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
export function createJoinCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(JOIN_CODE_LENGTH));
    return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
export function normalizeJoinCode(code: string): string {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export function createUniqueJoinCode(isTaken: (code: string) => boolean): string {
    for (;;) {
        const code = createJoinCode();
        if (!isTaken(code))
            return code;
    }
}
