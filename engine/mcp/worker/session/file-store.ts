import type { ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
export const FILE_LIMIT_BYTES = 24 * 1024 * 1024;
const STORE_LIMIT_BYTES = 64 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;
const FALLBACK_NAME = 'file';
const FALLBACK_MIME_TYPE = 'application/octet-stream';
const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;
const ID_BYTE_COUNT = 8;
export interface StoredFile {
    readonly id: string;
    readonly name: string;
    readonly mimeType: string;
    readonly bytes: Uint8Array;
    readonly expiresAt: number;
}
export interface FileUsage {
    readonly count: number;
    readonly bytes: number;
}
function createFileId(): string {
    const random = crypto.getRandomValues(new Uint8Array(ID_BYTE_COUNT));
    return `f_${Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function sanitizeFileName(name: string): string {
    const baseName = name.split(/[\\/]/).pop() ?? '';
    return baseName.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, MAX_NAME_LENGTH) || FALLBACK_NAME;
}
function sanitizeMimeType(mimeType: string): string {
    const essence = mimeType.split(';')[0].trim().toLowerCase();
    return MIME_TYPE_PATTERN.test(essence) ? essence : FALLBACK_MIME_TYPE;
}
export function describeFile(file: StoredFile): ToolAttachment {
    return { fileId: file.id, name: file.name, mimeType: file.mimeType, size: file.bytes.byteLength };
}
export class FileStore {
    private readonly files = new Map<string, StoredFile>();
    constructor(private readonly ttlMs: number) { }
    get usage(): FileUsage {
        this.dropExpired();
        return { count: this.files.size, bytes: this.storedBytes() };
    }
    put(name: string, mimeType: string, bytes: Uint8Array): StoredFile {
        this.dropExpired();
        this.makeRoom(bytes.byteLength);
        const file: StoredFile = { id: createFileId(), name: sanitizeFileName(name), mimeType: sanitizeMimeType(mimeType), bytes, expiresAt: Date.now() + this.ttlMs };
        this.files.set(file.id, file);
        return file;
    }
    get(id: string): StoredFile | undefined {
        this.dropExpired();
        return this.files.get(id);
    }
    private storedBytes(): number {
        let total = 0;
        for (const file of this.files.values())
            total += file.bytes.byteLength;
        return total;
    }
    private dropExpired(): void {
        const now = Date.now();
        for (const [id, file] of this.files) {
            if (file.expiresAt <= now)
                this.files.delete(id);
        }
    }
    private makeRoom(incomingBytes: number): void {
        let total = this.storedBytes();
        for (const [id, file] of this.files) {
            if (total + incomingBytes <= STORE_LIMIT_BYTES)
                return;
            this.files.delete(id);
            total -= file.bytes.byteLength;
        }
    }
}
