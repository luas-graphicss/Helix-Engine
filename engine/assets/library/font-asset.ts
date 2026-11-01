import { fileExtension } from '@/engine/assets/import/import-types';
import type { FontAssetDetails } from './asset-types';
interface TableRecord {
    readonly tag: string;
    readonly offset: number;
    readonly length: number;
    readonly compressedLength: number;
}
const NAME_FAMILY = 1;
const NAME_SUBFAMILY = 2;
const NAME_TYPOGRAPHIC_FAMILY = 16;
const NAME_TYPOGRAPHIC_SUBFAMILY = 17;
const WEIGHT_WORDS: ReadonlyArray<[
    RegExp,
    number
]> = [
    [/\b(thin|hairline)\b/i, 100],
    [/\b(extra ?light|ultra ?light)\b/i, 200],
    [/\blight\b/i, 300],
    [/\b(regular|normal|book|roman)\b/i, 400],
    [/\bmedium\b/i, 500],
    [/\b(semi ?bold|demi ?bold)\b/i, 600],
    [/\b(extra ?bold|ultra ?bold)\b/i, 800],
    [/\b(black|heavy)\b/i, 900],
    [/\bbold\b/i, 700],
];
function tagAt(view: DataView, offset: number): string {
    return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}
function readTables(view: DataView): {
    tables: TableRecord[];
    woff: boolean;
} | null {
    const signature = tagAt(view, 0);
    if (signature === 'wOFF') {
        const count = view.getUint16(12);
        const tables: TableRecord[] = [];
        for (let index = 0; index < count; index++) {
            const at = 44 + index * 20;
            tables.push({ tag: tagAt(view, at), offset: view.getUint32(at + 4), compressedLength: view.getUint32(at + 8), length: view.getUint32(at + 12) });
        }
        return { tables, woff: true };
    }
    let base = 0;
    if (signature === 'ttcf')
        base = view.getUint32(12);
    const version = view.getUint32(base);
    if (version !== 0x00010000 && signature !== 'OTTO' && signature !== 'true' && signature !== 'ttcf')
        return null;
    const count = view.getUint16(base + 4);
    const tables: TableRecord[] = [];
    for (let index = 0; index < count; index++) {
        const at = base + 12 + index * 16;
        const length = view.getUint32(at + 12);
        tables.push({ tag: tagAt(view, at), offset: view.getUint32(at + 8), length, compressedLength: length });
    }
    return { tables, woff: false };
}
async function tableBytes(buffer: ArrayBuffer, record: TableRecord, woff: boolean): Promise<DataView> {
    const slice = buffer.slice(record.offset, record.offset + record.compressedLength);
    if (!woff || record.compressedLength === record.length)
        return new DataView(slice);
    const stream = new Blob([slice]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new DataView(await new Response(stream).arrayBuffer());
}
function decodeName(view: DataView, offset: number, length: number, platform: number): string {
    if (platform === 3 || platform === 0) {
        let text = '';
        for (let index = 0; index + 1 < length; index += 2)
            text += String.fromCharCode(view.getUint16(offset + index));
        return text;
    }
    let text = '';
    for (let index = 0; index < length; index++)
        text += String.fromCharCode(view.getUint8(offset + index));
    return text;
}
function readNames(view: DataView): Map<number, string> {
    const names = new Map<number, string>();
    const priority = new Map<number, number>();
    const count = view.getUint16(2);
    const stringOffset = view.getUint16(4);
    for (let index = 0; index < count; index++) {
        const at = 6 + index * 12;
        const platform = view.getUint16(at);
        const language = view.getUint16(at + 4);
        const nameId = view.getUint16(at + 6);
        const length = view.getUint16(at + 8);
        const offset = view.getUint16(at + 10);
        if (stringOffset + offset + length > view.byteLength)
            continue;
        const score = platform === 3 && language === 0x409 ? 3 : platform === 3 ? 2 : 1;
        if ((priority.get(nameId) ?? 0) >= score)
            continue;
        const text = decodeName(view, stringOffset + offset, length, platform).replace(/\0/g, '').trim();
        if (!text)
            continue;
        names.set(nameId, text);
        priority.set(nameId, score);
    }
    return names;
}
function weightFromWords(text: string): number | null {
    for (const [pattern, weight] of WEIGHT_WORDS)
        if (pattern.test(text))
            return weight;
    return null;
}
export function fontDetailsFromFileName(fileName: string): Omit<FontAssetDetails, 'kind' | 'container'> {
    const stem = fileName.replace(/\.[^.]+$/, '').replace(/[_\s]+/g, ' ');
    const [familyPart, ...styleParts] = stem.split('-');
    const styleText = styleParts.join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    const italic = /italic|oblique/i.test(styleText) || /italic|oblique/i.test(stem);
    const weight = weightFromWords(styleText) ?? 400;
    const family = familyPart.replace(/([a-z])([A-Z])/g, '$1 $2').trim() || stem;
    return { family, style: styleText || (italic ? 'Italic' : 'Regular'), weight, italic };
}
export async function readFontDetails(file: File): Promise<FontAssetDetails> {
    const container = fileExtension(file.name);
    const fallback = { kind: 'font' as const, container, ...fontDetailsFromFileName(file.name) };
    try {
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength < 12)
            return fallback;
        const view = new DataView(buffer);
        const parsed = readTables(view);
        if (!parsed)
            return fallback;
        const nameRecord = parsed.tables.find((table) => table.tag === 'name');
        if (!nameRecord)
            return fallback;
        const names = readNames(await tableBytes(buffer, nameRecord, parsed.woff));
        const family = names.get(NAME_TYPOGRAPHIC_FAMILY) ?? names.get(NAME_FAMILY) ?? fallback.family;
        const style = names.get(NAME_TYPOGRAPHIC_SUBFAMILY) ?? names.get(NAME_SUBFAMILY) ?? fallback.style;
        let weight = weightFromWords(style) ?? fallback.weight;
        let italic = /italic|oblique/i.test(style);
        const os2 = parsed.tables.find((table) => table.tag === 'OS/2');
        if (os2 && os2.length >= 64) {
            const os2View = await tableBytes(buffer, os2, parsed.woff);
            const weightClass = os2View.getUint16(4);
            if (weightClass >= 100 && weightClass <= 900)
                weight = Math.round(weightClass / 100) * 100;
            italic = (os2View.getUint16(62) & 1) === 1 || italic;
        }
        return { kind: 'font', container, family, style, weight, italic };
    }
    catch {
        return fallback;
    }
}
export function fontWeightLabel(weight: number): string {
    if (weight <= 100)
        return 'Fino';
    if (weight <= 200)
        return 'Extraleve';
    if (weight <= 300)
        return 'Leve';
    if (weight <= 400)
        return 'Normal';
    if (weight <= 500)
        return 'Médio';
    if (weight <= 600)
        return 'Seminegrito';
    if (weight <= 700)
        return 'Negrito';
    if (weight <= 800)
        return 'Extranegrito';
    return 'Preto';
}
