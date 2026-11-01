export type TokenKind = 'identifier' | 'keyword' | 'number' | 'string' | 'interpolated' | 'char' | 'punct' | 'eof';
export interface SourceSpan {
    readonly line: number;
    readonly column: number;
    readonly endLine: number;
    readonly endColumn: number;
}
export type InterpolationPart = {
    readonly kind: 'text';
    readonly value: string;
} | {
    readonly kind: 'expression';
    readonly source: string;
    readonly line: number;
    readonly column: number;
    readonly alignment: string | null;
    readonly format: string | null;
};
export interface Token {
    readonly kind: TokenKind;
    readonly text: string;
    readonly value: number | string | readonly InterpolationPart[] | null;
    readonly integer?: boolean;
    readonly span: SourceSpan;
    readonly adjacent: boolean;
}
export const KEYWORDS: ReadonlySet<string> = new Set([
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
    'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if',
    'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
    'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static', 'string',
    'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void',
    'volatile', 'while',
]);
export const PRIMITIVE_TYPE_KEYWORDS: ReadonlyMap<string, string> = new Map([
    ['bool', 'bool'],
    ['byte', 'int'],
    ['sbyte', 'int'],
    ['short', 'int'],
    ['ushort', 'int'],
    ['int', 'int'],
    ['uint', 'int'],
    ['long', 'int'],
    ['ulong', 'int'],
    ['char', 'char'],
    ['float', 'float'],
    ['double', 'float'],
    ['decimal', 'float'],
    ['string', 'string'],
    ['object', 'object'],
    ['void', 'void'],
]);
export const MODIFIERS: ReadonlySet<string> = new Set([
    'public', 'private', 'protected', 'internal', 'static', 'readonly', 'const', 'virtual', 'override', 'abstract', 'sealed', 'async', 'partial',
    'new', 'extern', 'unsafe', 'volatile', 'required', 'file',
]);
export const PUNCTUATION: readonly string[] = [
    '<<=', '??=',
    '?.', '??', '=>', '->', '::', '..', '++', '--', '&&', '||', '==', '!=', '<=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<',
    '{', '}', '(', ')', '[', ']', ';', ',', '.', ':', '?', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '=', '<', '>',
];
export function spanBetween(start: SourceSpan, end: SourceSpan): SourceSpan {
    return { line: start.line, column: start.column, endLine: end.endLine, endColumn: end.endColumn };
}
