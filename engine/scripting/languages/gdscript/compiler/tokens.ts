export type TokenKind = 'identifier' | 'keyword' | 'int' | 'float' | 'string' | 'string_name' | 'node_path' | 'get_node' | 'unique_node' | 'annotation' | 'operator' | 'newline' | 'indent' | 'dedent' | 'eof';
export interface SourcePosition {
    readonly line: number;
    readonly column: number;
}
export interface SourceSpan {
    readonly line: number;
    readonly column: number;
    readonly endLine: number;
    readonly endColumn: number;
}
export interface Token extends SourceSpan {
    readonly kind: TokenKind;
    readonly value: string;
    readonly number?: number;
    readonly raw?: boolean;
    readonly depth?: number;
}
export const KEYWORDS: ReadonlySet<string> = new Set([
    'if',
    'elif',
    'else',
    'for',
    'while',
    'match',
    'when',
    'break',
    'continue',
    'pass',
    'return',
    'class',
    'class_name',
    'extends',
    'is',
    'in',
    'as',
    'self',
    'super',
    'signal',
    'func',
    'static',
    'const',
    'enum',
    'var',
    'void',
    'null',
    'true',
    'false',
    'not',
    'and',
    'or',
    'await',
    'breakpoint',
    'assert',
    'preload',
    'yield',
    'namespace',
    'trait',
    'abstract',
]);
export const OPERATORS: readonly string[] = ['**=', '<<=', '>>=', '->', '**', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', ':=', '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', ':', ';', ',', '.', '[', ']', '(', ')', '{', '}', '?'];
export const OPENERS: ReadonlySet<string> = new Set(['(', '[', '{']);
export const CLOSERS: ReadonlySet<string> = new Set([')', ']', '}']);
export function spanOf(start: SourcePosition, end: SourcePosition): SourceSpan {
    return { line: start.line, column: start.column, endLine: end.line, endColumn: end.column };
}
export function describeToken(token: Token): string {
    switch (token.kind) {
        case 'eof':
            return 'o fim do arquivo';
        case 'newline':
            return 'a quebra de linha';
        case 'indent':
            return 'a indentação';
        case 'dedent':
            return 'o fim do bloco';
        case 'string':
        case 'string_name':
        case 'node_path':
            return `a string "${token.value.length > 24 ? `${token.value.slice(0, 24)}…` : token.value}"`;
        case 'int':
        case 'float':
            return `o número ${token.value}`;
        case 'identifier':
            return `o identificador "${token.value}"`;
        case 'keyword':
            return `a palavra-chave "${token.value}"`;
        case 'annotation':
            return `a anotação @${token.value}`;
        case 'get_node':
            return `$${token.value}`;
        case 'unique_node':
            return `%${token.value}`;
        default:
            return `"${token.value}"`;
    }
}
