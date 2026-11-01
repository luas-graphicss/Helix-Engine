import { deflateSync, inflateSync } from 'fflate';
import type { AssembleJob, AssembleReport, AssembleWorkerMessage } from './assemble-job';
import { brandWindowsExecutable } from './pe-branding';
import { copyEntry, entryData, newEntry, readZipDirectory, writeZip, ZIP_METHOD_DEFLATE, ZIP_METHOD_STORE, type ZipEntry, type ZipWriteEntry } from './zip-rewrite';
const scope = self as unknown as DedicatedWorkerGlobalScope;
function post(message: AssembleWorkerMessage, transfer: Transferable[] = []): void {
    scope.postMessage(message, transfer);
}
async function pipeThrough(bytes: Uint8Array, stream: ReadableWritablePair<Uint8Array, Uint8Array>): Promise<Uint8Array> {
    const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
    return new Uint8Array(await response.arrayBuffer());
}
async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
    if (typeof CompressionStream === 'function') {
        try {
            return await pipeThrough(bytes, new CompressionStream('deflate-raw'));
        }
        catch {
        }
    }
    return deflateSync(bytes, { level: 6 });
}
async function inflateRaw(bytes: Uint8Array, expectedSize: number): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'function') {
        try {
            const result = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
            if (result.length === expectedSize)
                return result;
        }
        catch {
        }
    }
    return inflateSync(bytes, { out: new Uint8Array(expectedSize) });
}
function renamed(name: string, job: AssembleJob): string {
    for (const rename of job.layout.renames) {
        if (rename.prefix) {
            if (name.startsWith(rename.from))
                return rename.to + name.slice(rename.from.length);
        }
        else if (name === rename.from) {
            return rename.to;
        }
    }
    return name;
}
function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function entryContent(template: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
    const raw = entryData(template, entry);
    if (entry.method === ZIP_METHOD_STORE)
        return raw;
    if (entry.method !== ZIP_METHOD_DEFLATE)
        throw new Error(`"${entry.name}" usa um método de compressão desconhecido (${entry.method}).`);
    return inflateRaw(raw, entry.uncompressedSize);
}
async function rebuiltEntry(entry: ZipEntry, name: string, content: Uint8Array): Promise<ZipWriteEntry> {
    const deflated = await deflateRaw(content);
    const fresh = newEntry({ name, content, deflated });
    return { ...fresh, time: entry.time, date: entry.date, versionMadeBy: entry.versionMadeBy, externalAttributes: entry.externalAttributes, internalAttributes: entry.internalAttributes };
}
async function assemble(job: AssembleJob): Promise<{
    bytes: Uint8Array;
    report: AssembleReport;
}> {
    const template = new Uint8Array(job.template);
    post({ type: 'progress', fraction: 0.02, label: 'Lendo o template do Helix Player' });
    const entries = readZipDirectory(template);
    if (entries.length === 0)
        throw new Error('O template do Helix Player está vazio.');
    const executableEntry = entries.find((entry) => entry.name === job.layout.executable);
    if (!executableEntry)
        throw new Error(`O template não contém o executável esperado (${job.layout.executable}).`);
    const drop = new Set(job.layout.drop);
    const patches = new Map(job.layout.textPatches.map((patch) => [patch.path, patch]));
    const output: ZipWriteEntry[] = [];
    let copied = 0;
    let brandingState: AssembleReport['branding'] = 'skipped';
    let brandingError: string | null = null;
    let executablePath = '';
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (drop.has(entry.name) || entry.isDirectory)
            continue;
        const name = job.layout.root + renamed(entry.name, job);
        if (index % 8 === 0)
            post({ type: 'progress', fraction: 0.05 + 0.45 * (index / entries.length), label: 'Copiando o Helix Player' });
        if (entry === executableEntry) {
            executablePath = name;
            if (job.branding) {
                post({ type: 'progress', fraction: 0.5, label: 'Gravando ícone e versão no executável' });
                try {
                    const content = await entryContent(template, entry);
                    const { bytes, report } = brandWindowsExecutable(content, job.branding);
                    post({ type: 'progress', fraction: 0.58, label: 'Comprimindo o executável' });
                    output.push(await rebuiltEntry(entry, name, bytes));
                    brandingState = report.iconReplaced ? 'applied' : 'version-only';
                    continue;
                }
                catch (cause) {
                    brandingState = 'failed';
                    brandingError = cause instanceof Error ? cause.message : String(cause);
                }
            }
            output.push(copyEntry(template, entry, name));
            copied++;
            continue;
        }
        const patch = patches.get(entry.name);
        if (patch) {
            const content = await entryContent(template, entry);
            let text = new TextDecoder().decode(content);
            for (const { pattern, flags, replacement } of patch.replacements)
                text = text.replace(new RegExp(pattern, flags ?? ''), replacement);
            output.push(await rebuiltEntry(entry, name, new TextEncoder().encode(text)));
            continue;
        }
        output.push(copyEntry(template, entry, name));
        copied++;
    }
    let gameBytes = 0;
    for (let index = 0; index < job.files.length; index++) {
        const file = job.files[index];
        const content = new Uint8Array(file.data);
        gameBytes += content.length;
        if (index % 4 === 0)
            post({ type: 'progress', fraction: 0.62 + 0.23 * (index / Math.max(job.files.length, 1)), label: `Comprimindo o jogo (${index + 1} de ${job.files.length})` });
        const deflated = file.store || content.length === 0 ? null : await deflateRaw(content);
        output.push(newEntry({ name: job.layout.root + file.path, content, deflated, mode: file.mode }));
    }
    post({ type: 'progress', fraction: 0.86, label: 'Gravando o pacote' });
    const written = writeZip(output);
    post({ type: 'progress', fraction: 0.93, label: 'Verificando o pacote' });
    const check = readZipDirectory(written.bytes);
    if (check.length !== output.length)
        throw new Error(`Verificação falhou: ${check.length} entradas lidas, ${output.length} gravadas.`);
    const names = new Set(check.map((entry) => entry.name));
    for (const required of job.required) {
        if (!names.has(job.layout.root + required))
            throw new Error(`Verificação falhou: "${required}" não está no pacote.`);
    }
    if (!names.has(executablePath))
        throw new Error('Verificação falhou: o executável não está no pacote.');
    for (const dropped of job.layout.drop) {
        if (names.has(job.layout.root + dropped))
            throw new Error(`Verificação falhou: "${dropped}" deveria ter saído do pacote.`);
    }
    const sha256 = toHex(await crypto.subtle.digest('SHA-256', written.bytes));
    return {
        bytes: written.bytes,
        report: {
            entryCount: check.length,
            totalBytes: written.bytes.length,
            sha256,
            executablePath,
            branding: brandingState,
            brandingError,
            templateEntriesCopied: copied,
            gameFiles: job.files.length,
            gameBytes,
        },
    };
}
scope.onmessage = async (event: MessageEvent<AssembleJob>) => {
    try {
        const { bytes, report } = await assemble(event.data);
        post({ type: 'done', bytes: bytes.buffer as ArrayBuffer, report }, [bytes.buffer as ArrayBuffer]);
    }
    catch (cause) {
        post({ type: 'error', message: cause instanceof Error ? cause.message : String(cause) });
    }
};
