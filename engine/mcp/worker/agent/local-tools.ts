import type { JsonRecord } from '@/engine/mcp/protocol/json-shape';
import { isText } from '@/engine/mcp/protocol/json-shape';
import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import { fileRejected } from '@/engine/mcp/worker/session/call-failure';
import { describeFile, type FileStore } from '@/engine/mcp/worker/session/file-store';
import type { SessionOverview } from '@/engine/mcp/worker/session/session-overview';
import type { AgentContext } from './agent-context';
import { downloadRemoteFile } from './remote-file';
import { failureReply, successReply, type ToolReply } from './tool-reply';
export interface LocalTool {
    readonly descriptor: ToolDescriptor;
    run(input: JsonRecord, context: AgentContext): ToolReply | Promise<ToolReply>;
}
export interface LocalToolHost {
    readonly files: FileStore;
    describeSession(): SessionOverview;
}
const ENGINE_STATUS: ToolDescriptor = {
    name: 'engine_status',
    title: 'Engine status',
    access: 'read',
    description: 'Reports whether the Helix editor is connected to this session, the open project, the access mode and the call queue. The Worker answers it, so it works while the editor is offline.',
    inputSchema: { type: 'object', properties: {}, required: [] },
};
const FETCH_FILE: ToolDescriptor = {
    name: 'fetch_file',
    title: 'Fetch file',
    access: 'read',
    description: 'Downloads a public https URL into the session file store and returns its file id. Pass the id to import_model, import_asset or apply_texture. Use it when you cannot upload the file yourself.',
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Public https URL of the file.' },
            name: { type: 'string', description: 'File name with extension. Defaults to the last segment of the URL.' },
        },
        required: ['url'],
    },
};
async function fetchFile(files: FileStore, input: JsonRecord, context: AgentContext): Promise<ToolReply> {
    const { url, name } = input;
    const remote = await downloadRemoteFile(isText(url) ? url : '', new URL(context.baseUrl).host);
    if (!remote.ok)
        return failureReply(fileRejected(remote.problem));
    const file = files.put(isText(name) && name.trim() ? name : remote.name, remote.mimeType, remote.bytes);
    return successReply(JSON.stringify(describeFile(file)));
}
export function createLocalTools(host: LocalToolHost): readonly LocalTool[] {
    return [
        { descriptor: ENGINE_STATUS, run: () => successReply(JSON.stringify(host.describeSession(), null, 2)) },
        { descriptor: FETCH_FILE, run: (input, context) => fetchFile(host.files, input, context) },
    ];
}
