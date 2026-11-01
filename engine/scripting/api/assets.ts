import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import { decodeImage } from '@/engine/assets/image-decoder';
import { getAnimationDocument } from '@/engine/animation/clip-registry';
import { guiFonts, fontAssetFamily } from '@/engine/gui/fonts/gui-font-registry';
import { addFilesToLibrary, removeLibraryAsset, renameLibraryAsset, setLibraryAssetTags } from '@/engine/editor/operations/asset-library-operations';
import { ensureAnimationDocument } from '@/engine/editor/operations/animation-operations';
import { loadGuiAsset } from '@/engine/editor/operations/gui-operations';
import { loadScriptAsset } from '@/engine/editor/operations/script-operations';
import { loadVfxAsset } from '@/engine/editor/operations/vfx-operations';
import { pickFiles } from '@/engine/editor/files/file-picker';
import { parseToml } from '../languages/toml/toml-parser';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireFunction, requireObject, requireOneOf, requireString } from '../runtime/values';
const ASSET_KINDS: readonly AssetKind[] = ['model', 'texture', 'audio', 'animation', 'gui', 'font', 'video', 'vfx', 'script', 'prefab'];
const DATA_EXTENSIONS = ['json', 'yaml', 'yml', 'toml', 'xml', 'md', 'markdown', 'csv', 'txt'] as const;
export function describeAsset(asset: LibraryAsset) {
    return {
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        format: asset.format,
        size: asset.size,
        tags: asset.tags.slice(),
        contentHash: asset.contentHash,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        files: asset.files.map((file) => file.path),
        details: asset.details,
    };
}
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i++;
                }
                else
                    quoted = false;
            }
            else
                cell += char;
            continue;
        }
        if (char === '"')
            quoted = true;
        else if (char === ',') {
            row.push(cell);
            cell = '';
        }
        else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += char;
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}
function parseYaml(text: string): unknown {
    const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+#.*$/, '')).filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'));
    let index = 0;
    const scalar = (raw: string): unknown => {
        const trimmed = raw.trim();
        if (trimmed === '' || trimmed === '~' || trimmed === 'null')
            return null;
        if (trimmed === 'true')
            return true;
        if (trimmed === 'false')
            return false;
        if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(trimmed))
            return Number(trimmed);
        if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed))
            return trimmed.slice(1, -1);
        if (trimmed.startsWith('[') && trimmed.endsWith(']'))
            return trimmed.slice(1, -1).split(',').filter((item) => item.trim().length > 0).map(scalar);
        return trimmed;
    };
    const indentOf = (line: string) => line.length - line.trimStart().length;
    const parseBlock = (indent: number): unknown => {
        const first = lines[index];
        if (first === undefined)
            return null;
        const isList = first.trim().startsWith('- ') || first.trim() === '-';
        if (isList) {
            const list: unknown[] = [];
            while (index < lines.length && indentOf(lines[index]) === indent && (lines[index].trim().startsWith('- ') || lines[index].trim() === '-')) {
                const content = lines[index].trim().slice(1).trim();
                index++;
                if (content === '')
                    list.push(parseBlock(indent + 2));
                else if (/^[^:]+:\s*(.*)$/.test(content) && !content.startsWith('"') && !content.startsWith("'")) {
                    const map: Record<string, unknown> = {};
                    const match = /^([^:]+):\s*(.*)$/.exec(content) as RegExpExecArray;
                    map[match[1].trim()] = match[2] === '' ? (index < lines.length && indentOf(lines[index]) > indent ? parseBlock(indentOf(lines[index])) : null) : scalar(match[2]);
                    while (index < lines.length && indentOf(lines[index]) === indent + 2 && !lines[index].trim().startsWith('- ')) {
                        const inner = /^([^:]+):\s*(.*)$/.exec(lines[index].trim());
                        index++;
                        if (!inner)
                            continue;
                        map[inner[1].trim()] = inner[2] === '' ? (index < lines.length && indentOf(lines[index]) > indent + 2 ? parseBlock(indentOf(lines[index])) : null) : scalar(inner[2]);
                    }
                    list.push(map);
                }
                else
                    list.push(scalar(content));
            }
            return list;
        }
        const map: Record<string, unknown> = {};
        while (index < lines.length && indentOf(lines[index]) === indent && !lines[index].trim().startsWith('- ')) {
            const match = /^([^:]+):\s*(.*)$/.exec(lines[index].trim());
            index++;
            if (!match)
                continue;
            const key = match[1].trim().replace(/^["']|["']$/g, '');
            if (match[2] === '')
                map[key] = index < lines.length && indentOf(lines[index]) > indent ? parseBlock(indentOf(lines[index])) : null;
            else
                map[key] = scalar(match[2]);
        }
        return map;
    };
    if (lines.length === 0)
        return null;
    return parseBlock(indentOf(lines[0]));
}
