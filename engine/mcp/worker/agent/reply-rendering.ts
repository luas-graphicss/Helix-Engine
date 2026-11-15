import type { ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
import type { FileStore } from '@/engine/mcp/worker/session/file-store';
import type { ToolReply } from './tool-reply';
const INLINE_IMAGE_LIMIT_BYTES = 1536 * 1024;
const BASE64_CHUNK_SIZE = 0x8000;
export type McpContent = {
    readonly type: 'text';
    readonly text: string;
} | {
    readonly type: 'image';
    readonly data: string;
    readonly mimeType: string;
};
function fileUrl(baseUrl: string, file: ToolAttachment): string {
    return `${baseUrl}/files/${file.fileId}`;
}
function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
    return btoa(binary);
}
function inlineImage(files: FileStore, attachment: ToolAttachment): McpContent | null {
    if (!attachment.mimeType.startsWith('image/') || attachment.size > INLINE_IMAGE_LIMIT_BYTES)
        return null;
    const file = files.get(attachment.fileId);
    return file ? { type: 'image', data: toBase64(file.bytes), mimeType: file.mimeType } : null;
}
export function renderReplyText(reply: ToolReply, baseUrl: string): string {
    const fileLines = reply.attachments.map((file) => `File ${file.name} (${file.mimeType}, ${file.size} bytes): ${fileUrl(baseUrl, file)}`);
    return [reply.text, ...fileLines].join('\n');
}
export function renderReplyJson(reply: ToolReply, baseUrl: string): object {
    return {
        ok: !reply.failed,
        output: reply.text,
        files: reply.attachments.map((file) => ({ ...file, url: fileUrl(baseUrl, file) })),
        error: reply.failure ?? undefined,
    };
}
export function renderMcpContent(reply: ToolReply, baseUrl: string, files: FileStore): McpContent[] {
    const images = reply.attachments.map((attachment) => inlineImage(files, attachment)).filter((image) => image !== null);
    return [{ type: 'text', text: renderReplyText(reply, baseUrl) }, ...images];
}
