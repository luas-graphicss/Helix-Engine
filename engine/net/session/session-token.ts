const TOKEN_BYTES = 16;
export function createSessionToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
