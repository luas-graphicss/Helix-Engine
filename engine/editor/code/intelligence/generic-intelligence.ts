import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';
import { EditorState, type Extension, type Text } from '@codemirror/state';
import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import { gdscriptVocabulary } from '../languages/gdscript-mode';
import { glslVocabulary } from '../languages/glsl-mode';
import { lua54Vocabulary, luauVocabulary } from '../languages/luau-mode';
import type { LanguageVocabulary } from '../languages/stream-utils';
import { wgslVocabulary } from '../languages/wgsl-mode';
import { zigVocabulary } from '../languages/zig-mode';
import { cHeaderIndex, type CHeaderIndex, type HeaderSymbol } from './c-header-index';
import type { IntelligenceHost } from './create-intelligence';
import { infoNode } from './doc-dom';
import { helixApiIndex, type ApiMember, type HelixApiIndex } from './helix-api-index';
import type { LanguageIntelligence } from './language-intelligence';
interface DottedAccess {
    readonly kind: 'dotted';
    readonly root: string;
    readonly separator: string;
    readonly pascal?: boolean;
}
interface ReflectiveAccess {
    readonly kind: 'reflective';
}
type ApiAccess = DottedAccess | ReflectiveAccess;
const DOTTED: DottedAccess = { kind: 'dotted', root: 'helix', separator: '.' };
const REFLECTIVE: ReflectiveAccess = { kind: 'reflective' };
const API_ACCESS: Partial<Record<ScriptLanguageId, ApiAccess>> = {
    luau: DOTTED,
    lua: DOTTED,
    python: DOTTED,
    gdscript: DOTTED,
    ruby: DOTTED,
    php: { kind: 'dotted', root: '$helix', separator: '->' },
    csharp: { kind: 'dotted', root: 'Helix', separator: '.', pascal: true },
    go: REFLECTIVE,
    java: REFLECTIVE,
    kotlin: REFLECTIVE,
    swift: REFLECTIVE,
    rust: REFLECTIVE,
    dart: REFLECTIVE,
    zig: REFLECTIVE,
    haxe: REFLECTIVE,
};
const VOCABULARIES: Partial<Record<ScriptLanguageId, LanguageVocabulary>> = {
    luau: luauVocabulary,
    lua: lua54Vocabulary,
    gdscript: gdscriptVocabulary,
    glsl: glslVocabulary,
    wgsl: wgslVocabulary,
    zig: zigVocabulary,
};
const WORDLESS = new Set<ScriptLanguageId>(['html', 'css', 'svg', 'json', 'xml', 'yaml', 'toml', 'markdown']);
const lowerFirst = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
const upperFirst = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MEMBER_TYPE: Record<ApiMember['kind'], string> = { method: 'function', namespace: 'namespace', property: 'property' };
const SYMBOL_TYPE: Record<HeaderSymbol['kind'], string> = { function: 'function', macro: 'keyword', type: 'type', constant: 'constant', method: 'method', class: 'class' };
function memberOption(member: ApiMember, pascal: boolean): Completion {
    return {
        label: pascal ? upperFirst(member.name) : member.name,
        type: MEMBER_TYPE[member.kind],
        detail: member.detail || undefined,
        boost: 20,
        info: () => infoNode({ signature: member.signature, doc: member.doc }),
    };
}
function symbolOption(symbol: HeaderSymbol): Completion {
    return {
        label: symbol.name,
        type: SYMBOL_TYPE[symbol.kind],
        detail: symbol.kind === 'method' ? 'helix::Value' : undefined,
        boost: 10,
        info: () => infoNode({ signature: symbol.signature, doc: symbol.doc }),
    };
}
function dottedApiSource(access: DottedAccess, index: HelixApiIndex): CompletionSource {
    const root = escapeRegExp(access.root);
    const separator = escapeRegExp(access.separator);
    const pathBefore = new RegExp(`${root}(?:${separator}[A-Za-z_]\\w*)*${separator}\\w*$`);
    const rootOption: Completion = {
        label: access.root,
        type: 'namespace',
        detail: 'API da engine',
        boost: 50,
        info: () => infoNode({ signature: access.root, doc: 'A raiz da API da engine: cena, tempo, entrada, física, áudio, interface e o resto.' }),
    };
    return (context) => {
        const match = context.matchBefore(pathBefore);
        if (match) {
            const segments = match.text.slice(access.root.length).split(access.separator).slice(1);
            const partial = segments.pop() ?? '';
            const members = index.membersAt(access.pascal ? segments.map(lowerFirst) : segments);
            if (!members)
                return null;
            return { from: context.pos - partial.length, options: members.map((member) => memberOption(member, access.pascal === true)), validFor: /^\w*$/ };
        }
        const word = context.matchBefore(/[\w$]+/);
        if (!word || word.text.length < 2 || !access.root.toLowerCase().startsWith(word.text.toLowerCase()))
            return null;
        return { from: word.from, options: [rootOption], validFor: /^[\w$]*$/ };
    };
}
const REFLECTIVE_CHAIN = /(?:helix\.Root\(\)|helix\(\)|Helix\.root|helix::root\(\)|root\(\)|helix|Helix)((?:\.(?:Get|get)\("[A-Za-z_]\w*"\)|\["[A-Za-z_]\w*"\]|\.(?:Path|path)\("[A-Za-z_.]*"\))*)(?:\.(?:Get|get|Invoke|invoke|Call|call|Path|path)\(|\[)"([A-Za-z_.]*)$/;
const CHAIN_KEY = /"([A-Za-z_.]*)"/g;
function reflectiveApiSource(index: HelixApiIndex): CompletionSource {
    return (context) => {
        const match = context.matchBefore(REFLECTIVE_CHAIN);
        if (!match)
            return null;
        const chain = REFLECTIVE_CHAIN.exec(match.text);
        if (!chain)
            return null;
        const path: string[] = [];
        for (const key of chain[1].matchAll(CHAIN_KEY))
            path.push(...key[1].split('.').filter(Boolean));
        const typed = chain[2].split('.');
        const partial = typed.pop() ?? '';
        path.push(...typed.filter(Boolean));
        const members = index.membersAt(path);
        if (!members)
            return null;
        return { from: context.pos - partial.length, options: members.map((member) => memberOption(member, false)), validFor: /^\w*$/ };
    };
}
function headerMemberSource(header: CHeaderIndex): CompletionSource {
    const valueMethods = header.valueMethods.map(symbolOption);
    const namespaceMembers = header.namespaceMembers.map(symbolOption);
    return (context) => {
        const scoped = context.matchBefore(/helix::\w*/);
        if (scoped)
            return { from: scoped.from + 'helix::'.length, options: namespaceMembers, validFor: /^\w*$/ };
        const member = context.matchBefore(/(?:\.|->)\w*/);
        if (member)
            return { from: member.from + (member.text.startsWith('->') ? 2 : 1), options: valueMethods, validFor: /^\w*$/ };
        return null;
    };
}
function headerGlobalsSource(header: CHeaderIndex): CompletionSource {
    const globals = header.globals.map(symbolOption);
    return (context) => {
        const word = context.matchBefore(/\w+/);
        return word ? { from: word.from, options: globals, validFor: /^\w*$/ } : null;
    };
}
function vocabularySource(vocabulary: LanguageVocabulary): CompletionSource {
    const options: Completion[] = [
        ...Array.from(vocabulary.keywords, (label): Completion => ({ label, type: 'keyword' })),
        ...Array.from(vocabulary.types, (label): Completion => ({ label, type: 'type' })),
        ...Array.from(vocabulary.builtins, (label): Completion => ({ label, type: 'function', boost: 5 })),
        ...Array.from(vocabulary.atoms, (label): Completion => ({ label, type: 'constant' })),
    ];
    return (context) => {
        const word = context.matchBefore(/[@\w]+/);
        if (!word)
            return null;
        return { from: word.from, options, validFor: /^[@\w]*$/ };
    };
}
const DOCUMENT_WORD = /[A-Za-z_$][\w$]{2,}/g;
function documentWordsSource(): CompletionSource {
    let indexedDoc: Text | null = null;
    let words: Completion[] = [];
    return (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/[\w$]+/);
        if (!word || word.text.length < 2)
            return null;
        if (context.state.doc !== indexedDoc) {
            const seen = new Set<string>();
            for (const match of context.state.doc.toString().matchAll(DOCUMENT_WORD))
                seen.add(match[0]);
            words = Array.from(seen, (label): Completion => ({ label, type: 'text', boost: -40 }));
            indexedDoc = context.state.doc;
        }
        return { from: word.from, options: words.filter((option) => option.label !== word.text), validFor: /^[\w$]*$/ };
    };
}
function dottedHover(access: DottedAccess, index: HelixApiIndex) {
    const pattern = new RegExp(`${escapeRegExp(access.root)}(?:${escapeRegExp(access.separator)}[A-Za-z_]\\w*)+`, 'g');
    return (view: EditorView, pos: number): Tooltip | null => {
        const line = view.state.doc.lineAt(pos);
        for (const match of line.text.matchAll(pattern)) {
            const start = line.from + (match.index ?? 0);
            if (pos < start || pos > start + match[0].length)
                continue;
            const segments = match[0].slice(access.root.length).split(access.separator).slice(1);
            let cursor = start + access.root.length;
            for (let depth = 0; depth < segments.length; depth++) {
                cursor += access.separator.length;
                const from = cursor;
                const to = cursor + segments[depth].length;
                cursor = to;
                if (pos < from || pos > to)
                    continue;
                const path = segments.slice(0, depth + 1);
                const member = index.find(access.pascal ? path.map(lowerFirst) : path);
                const dom = member ? infoNode({ signature: member.signature, doc: member.doc, className: 'hx-hover' }) : null;
                return dom ? { pos: from, end: to, above: true, create: () => ({ dom }) } : null;
            }
        }
        return null;
    };
}
function headerHover(header: CHeaderIndex) {
    return (view: EditorView, pos: number): Tooltip | null => {
        const word = view.state.wordAt(pos);
        if (!word)
            return null;
        const symbol = header.byName(view.state.sliceDoc(word.from, word.to));
        const dom = symbol ? infoNode({ signature: symbol.signature, doc: symbol.doc, className: 'hx-hover' }) : null;
        return dom ? { pos: word.from, end: word.to, above: true, create: () => ({ dom }) } : null;
    };
}
export function createGenericIntelligence(host: IntelligenceHost): LanguageIntelligence {
    const language = host.language;
    const access = API_ACCESS[language] ?? null;
    const vocabulary = VOCABULARIES[language] ?? null;
    const header = language === 'c' || language === 'cpp' ? cHeaderIndex() : null;
    const index = access ? helixApiIndex() : null;
    const exclusive: CompletionSource[] = [];
    const merged: CompletionSource[] = [];
    const hovers: Extension[] = [];
    if (access && index) {
        if (access.kind === 'dotted') {
            exclusive.push(dottedApiSource(access, index));
            hovers.push(hoverTooltip(dottedHover(access, index), { hoverTime: 320 }));
        }
        else {
            exclusive.push(reflectiveApiSource(index));
        }
    }
    if (header) {
        if (language === 'cpp')
            exclusive.push(headerMemberSource(header));
        merged.push(headerGlobalsSource(header));
        hovers.push(hoverTooltip(headerHover(header), { hoverTime: 320 }));
    }
    if (vocabulary)
        merged.push(vocabularySource(vocabulary));
    if (!WORDLESS.has(language))
        merged.push(documentWordsSource());
    const combined: CompletionSource = async (context) => {
        for (const source of exclusive) {
            const result = await source(context);
            if (result)
                return result;
        }
        const results = (await Promise.all(merged.map((source) => source(context)))).filter((result): result is CompletionResult => result !== null);
        if (results.length === 0)
            return null;
        const from = Math.min(...results.map((result) => result.from));
        const options = results.flatMap((result) => (result.from === from ? result.options : []));
        return { from, options, validFor: /^[@\w$]*$/ };
    };
    return {
        completionSources: null,
        extensions: [EditorState.languageData.of(() => [{ autocomplete: combined }]), hovers],
        dispose: () => undefined,
    };
}
