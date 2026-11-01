import type { StreamParser, StringStream } from '@codemirror/language';
export function wordSet(words: string): ReadonlySet<string> {
    return new Set(words.split(/\s+/).filter(Boolean));
}
export interface LanguageVocabulary {
    readonly keywords: ReadonlySet<string>;
    readonly types: ReadonlySet<string>;
    readonly builtins: ReadonlySet<string>;
    readonly atoms: ReadonlySet<string>;
}
export interface CLikeSpec {
    readonly keywords: ReadonlySet<string>;
    readonly types: ReadonlySet<string>;
    readonly builtins?: ReadonlySet<string>;
    readonly atoms?: ReadonlySet<string>;
    readonly specials?: ReadonlySet<string>;
    readonly specialPrefix?: RegExp;
    readonly preprocessor?: boolean;
    readonly attributes?: boolean;
    readonly nestedBlockComments?: boolean;
    readonly callsAsFunctions?: boolean;
    readonly definitionKeywords?: ReadonlySet<string>;
    readonly number: RegExp;
    readonly identifier: RegExp;
}
export interface CLikeState {
    blockDepth: number;
    expectDefinition: boolean;
}
export const C_NUMBER = /^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)[a-zA-Z]{0,3}/;
export const C_IDENTIFIER = /^[A-Za-z_][\w]*/;
export function skipBlockComment(stream: StringStream, state: CLikeState, nested: boolean): string {
    while (!stream.eol()) {
        if (stream.match('*/')) {
            state.blockDepth--;
            if (state.blockDepth <= 0) {
                state.blockDepth = 0;
                return 'comment';
            }
            continue;
        }
        if (nested && stream.match('/*')) {
            state.blockDepth++;
            continue;
        }
        stream.next();
    }
    return 'comment';
}
export function readString(stream: StringStream, quote: string): void {
    let escaped = false;
    while (!stream.eol()) {
        const char = stream.next();
        if (char === quote && !escaped)
            return;
        escaped = !escaped && char === '\\';
    }
}
export function cLikeToken(stream: StringStream, state: CLikeState, spec: CLikeSpec): string | null {
    if (state.blockDepth > 0)
        return skipBlockComment(stream, state, spec.nestedBlockComments ?? false);
    if (stream.eatSpace())
        return null;
    if (spec.preprocessor && stream.sol() && stream.peek() === '#') {
        stream.skipToEnd();
        return 'meta';
    }
    if (stream.match('//')) {
        stream.skipToEnd();
        return 'comment';
    }
    if (stream.match('/*')) {
        state.blockDepth = 1;
        return skipBlockComment(stream, state, spec.nestedBlockComments ?? false);
    }
    if (spec.attributes && stream.match(/^@[A-Za-z_]\w*/))
        return 'meta';
    if (spec.specialPrefix && stream.match(spec.specialPrefix))
        return 'variableName.standard';
    const char = stream.peek();
    if (char === '"' || char === "'") {
        stream.next();
        readString(stream, char);
        return 'string';
    }
    if (stream.match(spec.number))
        return 'number';
    if (stream.match(spec.identifier)) {
        const word = stream.current();
        if (state.expectDefinition) {
            state.expectDefinition = false;
            return 'variableName.definition';
        }
        if (spec.definitionKeywords?.has(word)) {
            state.expectDefinition = true;
            return 'keyword';
        }
        if (spec.keywords.has(word))
            return 'keyword';
        if (spec.types.has(word))
            return 'typeName';
        if (spec.atoms?.has(word))
            return 'atom';
        if (spec.specials?.has(word))
            return 'variableName.special';
        if (spec.builtins?.has(word))
            return 'variableName.standard';
        if (spec.callsAsFunctions && /^\s*\(/.test(stream.string.slice(stream.pos)))
            return 'variableName.function';
        return 'variableName';
    }
    if (stream.match(/^[{}()[\]]/))
        return 'bracket';
    if (stream.match(/^[;,.]/))
        return 'punctuation';
    if (stream.match(/^(?:->|=>|<<=|>>=|[-+*/%&|^!<>=]=?|&&|\|\||\+\+|--|<<|>>|[~?:])/))
        return 'operator';
    stream.next();
    return null;
}
export function cLikeParser(spec: CLikeSpec, extra: Partial<StreamParser<CLikeState>> = {}): StreamParser<CLikeState> {
    return {
        name: extra.name,
        startState: () => ({ blockDepth: 0, expectDefinition: false }),
        token: (stream, state) => cLikeToken(stream, state, spec),
        blankLine: (state) => {
            state.expectDefinition = false;
        },
        languageData: extra.languageData,
        indent: extra.indent,
        tokenTable: extra.tokenTable,
    };
}
