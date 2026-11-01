const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const EOCD64_LOCATOR_SIGNATURE = 0x07064b50;
const EOCD64_SIGNATURE = 0x06064b50;
const ZIP64_EXTRA_ID = 0x0001;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_UTF8 = 0x0800;
export const ZIP_METHOD_STORE = 0;
export const ZIP_METHOD_DEFLATE = 8;
const MADE_BY_UNIX = (3 << 8) | 20;
const VERSION_NEEDED = 20;
export interface ZipEntry {
    readonly name: string;
    readonly method: number;
    readonly flags: number;
    readonly time: number;
    readonly date: number;
    readonly crc: number;
    readonly compressedSize: number;
    readonly uncompressedSize: number;
    readonly versionMadeBy: number;
    readonly internalAttributes: number;
    readonly externalAttributes: number;
    readonly dataOffset: number;
    readonly isDirectory: boolean;
}
export interface ZipWriteEntry {
    readonly name: string;
    readonly method: number;
    readonly flags: number;
    readonly time: number;
    readonly date: number;
    readonly crc: number;
    readonly uncompressedSize: number;
    readonly versionMadeBy: number;
    readonly internalAttributes: number;
    readonly externalAttributes: number;
    readonly data: Uint8Array;
}
const decoder = new TextDecoder();
const encoder = new TextEncoder();
function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
    const minimum = Math.max(0, bytes.length - 22 - 0xffff);
    for (let offset = bytes.length - 22; offset >= minimum; offset--) {
        if (view.getUint32(offset, true) === EOCD_SIGNATURE)
            return offset;
    }
    throw new Error('O arquivo não é um zip válido (fim do diretório central não encontrado).');
}
export function readZipDirectory(bytes: Uint8Array): ZipEntry[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = findEndOfCentralDirectory(bytes, view);
    let count = view.getUint16(eocd + 10, true);
    let directoryOffset = view.getUint32(eocd + 16, true);
    if (count === 0xffff || directoryOffset === 0xffffffff) {
        const locator = eocd - 20;
        if (locator < 0 || view.getUint32(locator, true) !== EOCD64_LOCATOR_SIGNATURE)
            throw new Error('Zip64 sem localizador do diretório central.');
        const eocd64 = Number(view.getBigUint64(locator + 8, true));
        if (view.getUint32(eocd64, true) !== EOCD64_SIGNATURE)
            throw new Error('Registro zip64 corrompido.');
        count = Number(view.getBigUint64(eocd64 + 32, true));
        directoryOffset = Number(view.getBigUint64(eocd64 + 48, true));
    }
    const entries: ZipEntry[] = [];
    let cursor = directoryOffset;
    for (let index = 0; index < count; index++) {
        if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE)
            throw new Error(`Diretório central corrompido na entrada ${index}.`);
        const versionMadeBy = view.getUint16(cursor + 4, true);
        const flags = view.getUint16(cursor + 8, true);
        const method = view.getUint16(cursor + 10, true);
        const time = view.getUint16(cursor + 12, true);
        const date = view.getUint16(cursor + 14, true);
        const crc = view.getUint32(cursor + 16, true);
        let compressedSize = view.getUint32(cursor + 20, true);
        let uncompressedSize = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const extraLength = view.getUint16(cursor + 30, true);
        const commentLength = view.getUint16(cursor + 32, true);
        const internalAttributes = view.getUint16(cursor + 36, true);
        const externalAttributes = view.getUint32(cursor + 38, true);
        let localOffset = view.getUint32(cursor + 42, true);
        const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
            let extra = cursor + 46 + nameLength;
            const end = extra + extraLength;
            while (extra + 4 <= end) {
                const id = view.getUint16(extra, true);
                const size = view.getUint16(extra + 2, true);
                if (id === ZIP64_EXTRA_ID) {
                    let field = extra + 4;
                    if (uncompressedSize === 0xffffffff) {
                        uncompressedSize = Number(view.getBigUint64(field, true));
                        field += 8;
                    }
                    if (compressedSize === 0xffffffff) {
                        compressedSize = Number(view.getBigUint64(field, true));
                        field += 8;
                    }
                    if (localOffset === 0xffffffff)
                        localOffset = Number(view.getBigUint64(field, true));
                    break;
                }
                extra += 4 + size;
            }
        }
        if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE)
            throw new Error(`Cabeçalho local corrompido em "${name}".`);
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        if (dataOffset + compressedSize > bytes.length)
            throw new Error(`Dados de "${name}" fora do arquivo.`);
        entries.push({
            name,
            method,
            flags,
            time,
            date,
            crc,
            compressedSize,
            uncompressedSize,
            versionMadeBy,
            internalAttributes,
            externalAttributes,
            dataOffset,
            isDirectory: name.endsWith('/'),
        });
        cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}
export function entryData(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
    return bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
}
export function copyEntry(bytes: Uint8Array, entry: ZipEntry, name = entry.name): ZipWriteEntry {
    return {
        name,
        method: entry.method,
        flags: entry.flags,
        time: entry.time,
        date: entry.date,
        crc: entry.crc,
        uncompressedSize: entry.uncompressedSize,
        versionMadeBy: entry.versionMadeBy,
        internalAttributes: entry.internalAttributes,
        externalAttributes: entry.externalAttributes,
        data: entryData(bytes, entry),
    };
}
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();
export function crc32(bytes: Uint8Array, seed = 0): number {
    let crc = seed ^ -1;
    for (let i = 0; i < bytes.length; i++)
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}
export function dosDateTime(when: Date = new Date()): {
    time: number;
    date: number;
} {
    const year = Math.min(Math.max(when.getFullYear(), 1980), 2107);
    return {
        time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
        date: ((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
    };
}
export function unixFileAttributes(mode = 0o644): number {
    return (((0o100000 | mode) << 16) >>> 0) | 0;
}
export interface NewEntryInput {
    readonly name: string;
    readonly content: Uint8Array;
    readonly deflated?: Uint8Array | null;
    readonly mode?: number;
    readonly when?: Date;
}
export function newEntry({ name, content, deflated = null, mode = 0o644, when }: NewEntryInput): ZipWriteEntry {
    const { time, date } = dosDateTime(when);
    const useDeflate = deflated !== null && deflated.length < content.length;
    return {
        name,
        method: useDeflate ? ZIP_METHOD_DEFLATE : ZIP_METHOD_STORE,
        flags: 0,
        time,
        date,
        crc: crc32(content),
        uncompressedSize: content.length,
        versionMadeBy: MADE_BY_UNIX,
        internalAttributes: 0,
        externalAttributes: unixFileAttributes(mode),
        data: useDeflate ? deflated : content,
    };
}
function isAscii(text: string): boolean {
    for (let i = 0; i < text.length; i++)
        if (text.charCodeAt(i) > 0x7f)
            return false;
    return true;
}
export interface WrittenZip {
    readonly bytes: Uint8Array;
    readonly entryCount: number;
}
export function writeZip(entries: readonly ZipWriteEntry[]): WrittenZip {
    if (entries.length >= 0xffff)
        throw new Error('O pacote tem entradas demais para um zip simples.');
    const names = entries.map((entry) => encoder.encode(entry.name));
    const seen = new Set<string>();
    for (const entry of entries) {
        if (seen.has(entry.name))
            throw new Error(`Entrada duplicada no pacote: ${entry.name}`);
        seen.add(entry.name);
    }
    let localTotal = 0;
    let centralTotal = 0;
    entries.forEach((entry, index) => {
        localTotal += 30 + names[index].length + entry.data.length;
        centralTotal += 46 + names[index].length;
    });
    const total = localTotal + centralTotal + 22;
    if (total >= 0xffffffff)
        throw new Error('O pacote passa de 4 GB; o zip simples não comporta esse tamanho.');
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);
    const offsets = new Array<number>(entries.length);
    let cursor = 0;
    entries.forEach((entry, index) => {
        const name = names[index];
        const flags = (entry.flags & ~FLAG_DATA_DESCRIPTOR) | (isAscii(entry.name) ? 0 : FLAG_UTF8);
        offsets[index] = cursor;
        view.setUint32(cursor, LOCAL_SIGNATURE, true);
        view.setUint16(cursor + 4, VERSION_NEEDED, true);
        view.setUint16(cursor + 6, flags, true);
        view.setUint16(cursor + 8, entry.method, true);
        view.setUint16(cursor + 10, entry.time, true);
        view.setUint16(cursor + 12, entry.date, true);
        view.setUint32(cursor + 14, entry.crc, true);
        view.setUint32(cursor + 18, entry.data.length, true);
        view.setUint32(cursor + 22, entry.uncompressedSize, true);
        view.setUint16(cursor + 26, name.length, true);
        view.setUint16(cursor + 28, 0, true);
        bytes.set(name, cursor + 30);
        bytes.set(entry.data, cursor + 30 + name.length);
        cursor += 30 + name.length + entry.data.length;
    });
    const directoryOffset = cursor;
    entries.forEach((entry, index) => {
        const name = names[index];
        const flags = (entry.flags & ~FLAG_DATA_DESCRIPTOR) | (isAscii(entry.name) ? 0 : FLAG_UTF8);
        view.setUint32(cursor, CENTRAL_SIGNATURE, true);
        view.setUint16(cursor + 4, entry.versionMadeBy, true);
        view.setUint16(cursor + 6, VERSION_NEEDED, true);
        view.setUint16(cursor + 8, flags, true);
        view.setUint16(cursor + 10, entry.method, true);
        view.setUint16(cursor + 12, entry.time, true);
        view.setUint16(cursor + 14, entry.date, true);
        view.setUint32(cursor + 16, entry.crc, true);
        view.setUint32(cursor + 20, entry.data.length, true);
        view.setUint32(cursor + 24, entry.uncompressedSize, true);
        view.setUint16(cursor + 28, name.length, true);
        view.setUint16(cursor + 30, 0, true);
        view.setUint16(cursor + 32, 0, true);
        view.setUint16(cursor + 34, 0, true);
        view.setUint16(cursor + 36, entry.internalAttributes, true);
        view.setUint32(cursor + 38, entry.externalAttributes >>> 0, true);
        view.setUint32(cursor + 42, offsets[index], true);
        bytes.set(name, cursor + 46);
        cursor += 46 + name.length;
    });
    view.setUint32(cursor, EOCD_SIGNATURE, true);
    view.setUint16(cursor + 4, 0, true);
    view.setUint16(cursor + 6, 0, true);
    view.setUint16(cursor + 8, entries.length, true);
    view.setUint16(cursor + 10, entries.length, true);
    view.setUint32(cursor + 12, cursor - directoryOffset, true);
    view.setUint32(cursor + 16, directoryOffset, true);
    view.setUint16(cursor + 20, 0, true);
    return { bytes, entryCount: entries.length };
}
