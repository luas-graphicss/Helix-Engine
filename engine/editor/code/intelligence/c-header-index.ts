import { HELIX_H } from '@/engine/scripting/languages/c/helix-h';
import { HELIX_HPP } from '@/engine/scripting/languages/c/helix-hpp';
export type HeaderSymbolKind = 'function' | 'macro' | 'type' | 'constant' | 'method' | 'class';
export interface HeaderSymbol {
    readonly name: string;
    readonly kind: HeaderSymbolKind;
    readonly signature: string;
    readonly doc: string;
}
export interface CHeaderIndex {
    readonly globals: readonly HeaderSymbol[];
    readonly valueMethods: readonly HeaderSymbol[];
    readonly namespaceMembers: readonly HeaderSymbol[];
    byName(name: string): HeaderSymbol | null;
}
const C_FUNCTION_HEAD = /^(?:HX_IMPORT\(\w+\)\s+|static\s+inline\s+)/;
const C_FUNCTION = /^(?:HX_IMPORT\(\w+\)\s+|static\s+inline\s+)((?:const\s+)?\w+(?:\s*\*+)?)\s+(hx_\w+)\s*\(([^)]*)\)/;
const MACRO = /^#define\s+(HX_\w+)(\([^)]*\))?/;
const TYPEDEF_TAG = /^typedef\s+(?:enum|struct)\s+(hx_\w+)/;
const TYPEDEF_POINTER = /^typedef\s+[^(;]+\(\*\s*(hx_\w+)\)/;
const TYPEDEF_PLAIN = /^typedef\s+[\w\s*]+?\s\*?(hx_\w+);/;
const ENUM_CONSTANT = /\b(HX_[A-Z][A-Z0-9_]*)\s*=\s*-?\d+/g;
const CPP_FUNCTION = /^\s*(?:\[\[\w+\]\]\s+)?(?:static\s+)?(?:inline\s+)?(?:explicit\s+)?([\w:<>&*,.\s]+?)\s+([a-z_]\w*)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;|->)/;
const CPP_SKIP = new Set(['if', 'for', 'while', 'return', 'switch', 'sizeof', 'operator', 'template', 'typename', 'static_cast', 'decltype', 'double', 'bool']);
function docBefore(lines: readonly string[], index: number): string {
    let end = index - 1;
    if (end >= 0 && /^\s*template\s*</.test(lines[end]))
        end--;
    if (end < 0 || !lines[end].trim().endsWith('*/'))
        return '';
    let start = end;
    while (start >= 0 && !lines[start].includes('/**')) {
        if (lines[start].includes('/*'))
            return '';
        start--;
    }
    if (start < 0)
        return '';
    return lines
        .slice(start, end + 1)
        .join('\n')
        .replace(/\/\*\*\s?/, '')
        .replace(/\s*\*\/\s*$/, '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();
}
function joinDeclaration(lines: readonly string[], index: number): {
    text: string;
    end: number;
} {
    let text = lines[index];
    let end = index;
    let depth = 0;
    for (let cursor = index; cursor < lines.length; cursor++) {
        for (const char of lines[cursor]) {
            if (char === '(')
                depth++;
            else if (char === ')')
                depth--;
        }
        end = cursor;
        if (cursor > index)
            text += ` ${lines[cursor]}`;
        if (depth <= 0 && lines[cursor].includes('('))
            break;
        if (depth <= 0 && cursor > index)
            break;
    }
    return { text: text.replace(/\s+/g, ' ').trim(), end };
}
function readCHeader(source: string): HeaderSymbol[] {
    const lines = source.split('\n');
    const symbols: HeaderSymbol[] = [];
    const seen = new Set<string>();
    const push = (symbol: HeaderSymbol) => {
        if (seen.has(symbol.name))
            return;
        seen.add(symbol.name);
        symbols.push(symbol);
    };
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (C_FUNCTION_HEAD.test(line)) {
            const { text, end } = joinDeclaration(lines, index);
            const match = C_FUNCTION.exec(text);
            if (match)
                push({ name: match[2], kind: 'function', signature: `${match[1]} ${match[2]}(${match[3].trim()})`, doc: docBefore(lines, index) });
            index = end;
            continue;
        }
        const macro = MACRO.exec(line);
        if (macro) {
            push({ name: macro[1], kind: 'macro', signature: `#define ${macro[1]}${macro[2] ?? ''}`, doc: docBefore(lines, index) });
            continue;
        }
        const typedef = TYPEDEF_TAG.exec(line) ?? TYPEDEF_POINTER.exec(line) ?? TYPEDEF_PLAIN.exec(line);
        if (typedef)
            push({ name: typedef[1], kind: 'type', signature: line.trim().replace(/\s*\{.*$/, ''), doc: docBefore(lines, index) });
    }
    for (const match of source.matchAll(ENUM_CONSTANT))
        push({ name: match[1], kind: 'constant', signature: match[0], doc: '' });
    return symbols;
}
function readCppHeader(source: string): {
    valueMethods: HeaderSymbol[];
    namespaceMembers: HeaderSymbol[];
} {
    const lines = source.split('\n');
    const valueMethods: HeaderSymbol[] = [];
    const namespaceMembers: HeaderSymbol[] = [
        { name: 'Value', kind: 'class', signature: 'class helix::Value', doc: 'Um valor da engine (número, texto, lista, objeto, função ou entidade) com contagem de referências.' },
        { name: 'Args', kind: 'class', signature: 'class helix::Args', doc: 'Os argumentos recebidos por um hook ou função exportada.' },
    ];
    const seenMethods = new Set<string>();
    let depth = 0;
    let currentClass: string | null = null;
    let classDepth = 0;
    let detailDepth: number | null = null;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const trimmed = line.trim();
        const classHead = /^class (\w+) \{/.exec(trimmed);
        if (classHead) {
            currentClass = classHead[1];
            classDepth = depth;
        }
        else if (/^namespace detail \{/.test(trimmed)) {
            detailDepth = depth;
        }
        else if (currentClass && !/^\s*(?:public|private|protected):/.test(line)) {
            const match = CPP_FUNCTION.exec(line);
            if (match && currentClass === 'Value' && !CPP_SKIP.has(match[2]) && !match[1].includes('operator') && !seenMethods.has(match[2])) {
                seenMethods.add(match[2]);
                valueMethods.push({ name: match[2], kind: 'method', signature: `${match[1].trim()} ${match[2]}(${match[3].trim()})`, doc: docBefore(lines, index) });
            }
        }
        else if (depth === 1 && detailDepth === null) {
            const match = CPP_FUNCTION.exec(line);
            if (match && !CPP_SKIP.has(match[2])) {
                const symbol: HeaderSymbol = { name: match[2], kind: 'function', signature: `${match[1].trim()} ${match[2]}(${match[3].trim()})`, doc: docBefore(lines, index) };
                const existing = namespaceMembers.findIndex((member) => member.name === symbol.name);
                if (existing === -1)
                    namespaceMembers.push(symbol);
                else if (!namespaceMembers[existing].doc && symbol.doc)
                    namespaceMembers[existing] = { ...namespaceMembers[existing], doc: symbol.doc };
            }
        }
        for (const char of line) {
            if (char === '{')
                depth++;
            else if (char === '}')
                depth--;
        }
        if (currentClass && depth <= classDepth)
            currentClass = null;
        if (detailDepth !== null && depth <= detailDepth)
            detailDepth = null;
    }
    return { valueMethods, namespaceMembers };
}
let cached: CHeaderIndex | null = null;
export function cHeaderIndex(): CHeaderIndex {
    if (cached)
        return cached;
    const globals = readCHeader(HELIX_H);
    const { valueMethods, namespaceMembers } = readCppHeader(HELIX_HPP);
    const byName = new Map<string, HeaderSymbol>();
    for (const symbol of [...globals, ...namespaceMembers, ...valueMethods])
        if (!byName.has(symbol.name))
            byName.set(symbol.name, symbol);
    cached = { globals, valueMethods, namespaceMembers, byName: (name) => byName.get(name) ?? null };
    return cached;
}
