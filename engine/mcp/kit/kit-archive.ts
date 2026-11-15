import 'server-only';
import { strToU8, zipSync, type Zippable } from 'fflate';
import { bundleWorker } from './kit-bundler';
import { KIT_STATIC_FILES, KIT_WORKER_FILE } from './kit-files';
import { MCP_KIT_FOLDER } from './kit-location';
const COMPRESSION_LEVEL = 6;
export async function buildKitArchive(): Promise<Uint8Array> {
    const entries: Zippable = { [`${MCP_KIT_FOLDER}/${KIT_WORKER_FILE}`]: strToU8(await bundleWorker()) };
    for (const [name, content] of KIT_STATIC_FILES)
        entries[`${MCP_KIT_FOLDER}/${name}`] = strToU8(content);
    return zipSync(entries, { level: COMPRESSION_LEVEL });
}
