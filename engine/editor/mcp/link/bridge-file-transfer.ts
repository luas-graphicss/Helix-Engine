import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import type { FileTransfer } from '@/engine/editor/mcp/tools/file-transfer';
import type { ToolAttachment } from '@/engine/mcp/protocol/bridge-messages';
import type { BridgeClient } from './bridge-client';
import { BridgeError } from './bridge-error';
function toToolFailure(cause: unknown, action: string): unknown {
    if (!(cause instanceof BridgeError))
        return cause;
    if (cause.kind === 'FILE_NOT_FOUND')
        return new ToolFailure('The file does not exist or has expired. Upload it again and pass the new file id.');
    return new ToolFailure(`Could not ${action}: ${cause.message}`);
}
export class BridgeFileTransfer implements FileTransfer {
    constructor(private readonly client: BridgeClient, private readonly signal: AbortSignal) { }
    async download(fileId: string): Promise<File> {
        try {
            return await this.client.downloadFile(fileId, this.signal);
        }
        catch (cause) {
            throw toToolFailure(cause, `download the file "${fileId}" from the Worker`);
        }
    }
    async upload(content: Blob, name: string): Promise<ToolAttachment> {
        try {
            return await this.client.uploadFile(content, name, this.signal);
        }
        catch (cause) {
            throw toToolFailure(cause, `send "${name}" to the Worker`);
        }
    }
}
