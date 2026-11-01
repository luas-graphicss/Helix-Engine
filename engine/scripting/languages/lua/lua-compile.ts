import type { CompileDiagnostic } from '../../compiler/compile-types';
import type { ForeignCompileInput } from '../language-engine';
import { splitLuaMessage } from './lua-errors';
const BUILTIN_MODULES: ReadonlySet<string> = new Set(['helix', '@helix/engine']);
const REQUIRE_CALL = /\brequire\s*(?:\(\s*)?(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\[\[([^\]]*)\]\])/g;
const LONG_COMMENT = /--\[(=*)\[[\s\S]*?\]\1\]/g;
const LINE_COMMENT = /--[^\n]*/g;
export function luaDependencies(source: string): string[] {
    const code = source.replace(LONG_COMMENT, ' ').replace(LINE_COMMENT, '');
    const found = new Set<string>();
    for (const match of code.matchAll(REQUIRE_CALL)) {
        const name = (match[1] ?? match[2] ?? match[3] ?? '').trim();
        if (name && !BUILTIN_MODULES.has(name))
            found.add(name);
    }
    return Array.from(found);
}
export function luaSyntaxDiagnostic(message: string, input: ForeignCompileInput, source: string): CompileDiagnostic {
    const split = splitLuaMessage(message);
    const line = split ? Math.max(1, split.line) : 1;
    const text = (split ? split.text : message).trim() || 'erro de sintaxe';
    return { severity: 'error', message: text, line, column: 1, source };
}
