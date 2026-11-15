import type { ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
export interface FileTransfer {
    download(fileId: string): Promise<File>;
    upload(content: Blob, name: string): Promise<ToolAttachment>;
}
