import { StreamLanguage, type StringStream } from '@codemirror/language';
import { wordSet, type LanguageVocabulary } from './stream-utils';
export type LuaDialect = 'luau' | 'lua';
const BASE_KEYWORDS = 'and break do else elseif end for function if in local not or repeat return then until while';
const ATOMS = wordSet('nil true false');
const SPECIALS = wordSet('helix self script');
const BASE_BUILTINS = 'assert error getmetatable ipairs next pairs pcall print rawequal rawget rawlen rawset require select setmetatable tonumber tostring type unpack xpcall string table math os coroutine utf8 io debug package collectgarbage dofile load loadstring';
const LUAU_BUILTINS = 'typeof gcinfo newproxy tick time warn bit32 buffer vector task';
const TYPES = wordSet('any boolean never nil number string thread unknown buffer vector');
function keywordsFor(dialect: LuaDialect): ReadonlySet<string> {
    return wordSet(dialect === 'luau' ? `${BASE_KEYWORDS} continue` : `${BASE_KEYWORDS} goto`);
}
function builtinsFor(dialect: LuaDialect): ReadonlySet<string> {
    return wordSet(dialect === 'luau' ? `${BASE_BUILTINS} ${LUAU_BUILTINS}` : BASE_BUILTINS);
}
export const luauVocabulary: LanguageVocabulary = { keywords: new Set([...keywordsFor('luau'), 'type', 'export']), types: TYPES, builtins: builtinsFor('luau'), atoms: ATOMS };
export const lua54Vocabulary: LanguageVocabulary = { keywords: keywordsFor('lua'), types: new Set(), builtins: builtinsFor('lua'), atoms: ATOMS };
interface LuaState {
    longLevel: number;
    longIsComment: boolean;
    inTemplate: boolean;
    expectDefinition: boolean;
    expectType: boolean;
    inTypeDeclaration: boolean;
    depth: number;
}
const OPENERS = wordSet('function if repeat do');
const CLOSERS = wordSet('end until');
const DEDENT_LINE = /^\s*(?:(?:end|until|else|elseif)\b|[)}\]])/;
function readLongBracket(stream: StringStream, state: LuaState): string {
    const close = `]${'='.repeat(state.longLevel)}]`;
    while (!stream.eol()) {
        if (stream.match(close)) {
            state.longLevel = -1;
            return state.longIsComment ? 'comment' : 'string';
        }
        stream.next();
    }
    return state.longIsComment ? 'comment' : 'string';
}
function readTemplate(stream: StringStream, state: LuaState): string {
    let escaped = false;
    while (!stream.eol()) {
        const char = stream.next();
        if (char === '`' && !escaped) {
            state.inTemplate = false;
            return 'string';
        }
        escaped = !escaped && char === '\\';
    }
    return 'string';
}
function readQuoted(stream: StringStream, quote: string): string {
    let escaped = false;
    while (!stream.eol()) {
        const char = stream.next();
        if (char === quote && !escaped)
            break;
        escaped = !escaped && char === '\\';
    }
    return 'string';
}
const NUMBER = /^(?:0[xX][0-9a-fA-F_.]+(?:[pP][+-]?\d+)?|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/;
const IDENTIFIER = /^[A-Za-z_]\w*/;
const TYPE_DECLARATION = /^\s+[A-Za-z_]\w*\s*(?:<[^=]*>)?\s*=/;
function createParser(dialect: LuaDialect) {
    const luau = dialect === 'luau';
    const KEYWORDS = keywordsFor(dialect);
    const BUILTINS = builtinsFor(dialect);
    function token(stream: StringStream, state: LuaState): string | null {
        if (state.longLevel >= 0)
            return readLongBracket(stream, state);
        if (state.inTemplate)
            return readTemplate(stream, state);
        if (stream.sol() && state.inTypeDeclaration && !/^\s/.test(stream.string))
            state.inTypeDeclaration = false;
        if (stream.eatSpace())
            return null;
        if (stream.match('--')) {
            const long = stream.match(/^\[(=*)\[/);
            if (long) {
                state.longLevel = (long as RegExpMatchArray)[1].length;
                state.longIsComment = true;
                return readLongBracket(stream, state);
            }
            stream.skipToEnd();
            return 'comment';
        }
        const long = stream.match(/^\[(=*)\[/);
        if (long) {
            state.longLevel = (long as RegExpMatchArray)[1].length;
            state.longIsComment = false;
            return readLongBracket(stream, state);
        }
        const char = stream.peek();
        if (char === '"' || char === "'") {
            stream.next();
            return readQuoted(stream, char);
        }
        if (luau && char === '`') {
            stream.next();
            state.inTemplate = true;
            return readTemplate(stream, state);
        }
        if (luau && stream.match(/^@[A-Za-z_]\w*/))
            return 'meta';
        if (!luau && stream.match(/^::[A-Za-z_]\w*::/))
            return 'labelName';
        if (stream.match(NUMBER))
            return 'number';
        if (stream.match(IDENTIFIER)) {
            const word = stream.current();
            const rest = stream.string.slice(stream.pos);
            if (state.expectDefinition) {
                state.expectDefinition = false;
                if (KEYWORDS.has(word))
                    return 'keyword';
                return state.inTypeDeclaration ? 'typeName' : 'variableName.definition';
            }
            if (state.expectType) {
                state.expectType = false;
                if (ATOMS.has(word))
                    return 'atom';
                if (KEYWORDS.has(word))
                    return 'keyword';
                return 'typeName';
            }
            if (luau) {
                if (word === 'type' && TYPE_DECLARATION.test(rest)) {
                    state.inTypeDeclaration = true;
                    state.expectDefinition = true;
                    return 'keyword';
                }
                if (word === 'export' && /^\s+type\b/.test(rest))
                    return 'keyword';
            }
            if (OPENERS.has(word))
                state.depth++;
            else if (CLOSERS.has(word))
                state.depth = Math.max(0, state.depth - 1);
            if (word === 'function' || word === 'local') {
                state.expectDefinition = word === 'function' || !/^\s+function\b/.test(rest);
                return 'keyword';
            }
            if (KEYWORDS.has(word))
                return 'keyword';
            if (ATOMS.has(word))
                return 'atom';
            if (SPECIALS.has(word))
                return 'variableName.special';
            if (BUILTINS.has(word))
                return 'variableName.standard';
            if (state.inTypeDeclaration && TYPES.has(word))
                return 'typeName';
            if (/^\s*[(`"'{]/.test(rest))
                return 'variableName.function';
            if (/[.:]$/.test(stream.string.slice(0, stream.start)))
                return 'propertyName';
            return 'variableName';
        }
        if (luau && stream.match('->')) {
            state.expectType = true;
            return 'operator';
        }
        if (stream.match(/^[{([]/)) {
            state.depth++;
            return 'bracket';
        }
        if (stream.match(/^[})\]]/)) {
            state.depth = Math.max(0, state.depth - 1);
            return 'bracket';
        }
        if (luau && stream.match(/^::/)) {
            state.expectType = true;
            return 'operator';
        }
        if (stream.match(':')) {
            const rest = stream.string.slice(stream.pos);
            if (luau && /^\s*[A-Za-z_(\{]/.test(rest) && !/^\s*[A-Za-z_]\w*\s*[(`"{]/.test(rest))
                state.expectType = true;
            return 'punctuation';
        }
        if (stream.match(/^[;,.]/))
            return 'punctuation';
        if (stream.match(/^(?:\.\.=?|\/\/=?|<<|>>|[-+*/%^]=?|[<>~=]=|[<>=#&|?~])/))
            return 'operator';
        stream.next();
        return null;
    }
    return StreamLanguage.define<LuaState>({
        name: dialect,
        startState: () => ({ longLevel: -1, longIsComment: false, inTemplate: false, expectDefinition: false, expectType: false, inTypeDeclaration: false, depth: 0 }),
        token,
        blankLine: (state) => {
            state.expectDefinition = false;
            state.expectType = false;
            state.inTypeDeclaration = false;
        },
        indent: (state, textAfter, context) => {
            if (state.longLevel >= 0 || state.inTemplate)
                return null;
            const closing = DEDENT_LINE.test(textAfter) ? 1 : 0;
            return Math.max(0, state.depth - closing) * context.unit;
        },
        languageData: {
            commentTokens: { line: '--', block: { open: '--[[', close: ']]' } },
            closeBrackets: { brackets: luau ? ['(', '[', '{', '"', "'", '`'] : ['(', '[', '{', '"', "'"] },
            indentOnInput: /^\s*(?:end|else|elseif|until|\})$/,
        },
    });
}
export const luauLanguage = createParser('luau');
export const lua54Language = createParser('lua');
