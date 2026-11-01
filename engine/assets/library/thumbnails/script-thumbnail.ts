import type { ScriptDocument } from '@/engine/scripting/script-document';
import { scriptLanguage, type ScriptLanguage } from '@/engine/scripting/script-languages';
import { createThumbnailCanvas, encodeCanvasToBlob, THUMBNAIL_SIZE } from './image-thumbnail';
const BACKDROP = '#141821';
const TEXT = 'rgba(244, 246, 251, 0.8)';
const COMMENT = 'rgba(244, 246, 251, 0.36)';
const KEYWORD = '#e8a24a';
const STRING = '#8fd3a3';
const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PADDING_RATIO = 0.075;
const FONT_RATIO = 0.068;
const LINE_RATIO = 0.09;
const TAG_RATIO = 0.1;
const KEYWORDS = new Set([
    'local', 'function', 'end', 'if', 'then', 'else', 'elseif', 'return', 'for', 'in', 'while', 'do', 'repeat', 'until', 'break', 'continue',
    'const', 'let', 'var', 'import', 'export', 'from', 'class', 'extends', 'new', 'this', 'self', 'super', 'static', 'public', 'private', 'protected',
    'def', 'fn', 'func', 'pub', 'struct', 'enum', 'match', 'impl', 'trait', 'interface', 'type', 'async', 'await', 'yield', 'try', 'catch', 'finally',
    'throw', 'switch', 'case', 'default', 'void', 'int', 'float', 'bool', 'string', 'uniform', 'varying', 'attribute', 'out', 'vec2', 'vec3', 'vec4',
    'mat3', 'mat4', 'true', 'false', 'nil', 'null', 'undefined', 'not', 'and', 'or', 'using', 'namespace', 'package', 'module', 'signal', 'onready',
]);
type TokenKind = 'text' | 'comment' | 'keyword' | 'string';
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function tokenPattern(language: ScriptLanguage): RegExp {
    const alternatives = [
        language.lineComment ? `${escapeRegExp(language.lineComment)}.*` : null,
        language.markup ? '<!--.*?(?:-->|$)' : '\\/\\*.*?(?:\\*\\/|$)',
        language.markup ? '<\\/?[A-Za-z][\\w:-]*' : null,
        `"(?:\\\\.|[^"\\\\])*"?`,
        `'(?:\\\\.|[^'\\\\])*'?`,
        '`(?:\\\\.|[^`\\\\])*`?',
        '[A-Za-z_][A-Za-z0-9_]*',
        '\\s+',
        '.',
    ].filter((part): part is string => part !== null);
    return new RegExp(alternatives.join('|'), 'g');
}
function classify(token: string, language: ScriptLanguage): TokenKind {
    const first = token[0];
    if (language.lineComment && token.startsWith(language.lineComment))
        return 'comment';
    if (token.startsWith('/*') || token.startsWith('<!--'))
        return 'comment';
    if (first === '"' || first === "'" || first === '`')
        return 'string';
    if (language.markup && first === '<')
        return 'keyword';
    if (KEYWORDS.has(token))
        return 'keyword';
    return 'text';
}
const INK: Record<TokenKind, string> = { text: TEXT, comment: COMMENT, keyword: KEYWORD, string: STRING };
function previewLines(source: string, max: number): string[] {
    const lines = source.replace(/\t/g, '  ').split('\n');
    while (lines.length > 0 && lines[0].trim().length === 0)
        lines.shift();
    return lines.slice(0, max);
}
export async function renderScriptThumbnail(document: ScriptDocument, size = THUMBNAIL_SIZE): Promise<Blob | null> {
    const target = createThumbnailCanvas(size);
    if (!target)
        return null;
    const { canvas, context } = target;
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, size, size);
    const language = scriptLanguage(document.language);
    const padding = size * PADDING_RATIO;
    const lineHeight = size * LINE_RATIO;
    const tagFont = Math.round(size * TAG_RATIO);
    const textBottom = size - padding - tagFont * 1.4;
    const lines = previewLines(document.source, Math.floor((textBottom - padding) / lineHeight));
    const pattern = tokenPattern(language);
    context.save();
    context.beginPath();
    context.rect(padding, 0, size - padding * 2, size);
    context.clip();
    context.font = `500 ${Math.round(size * FONT_RATIO)}px ${FONT_FAMILY}`;
    context.textBaseline = 'top';
    context.textAlign = 'left';
    lines.forEach((line, index) => {
        const y = padding + index * lineHeight;
        let x = padding;
        for (const match of line.matchAll(pattern)) {
            const token = match[0];
            context.fillStyle = INK[classify(token, language)];
            context.fillText(token, x, y);
            x += context.measureText(token).width;
            if (x > size - padding)
                break;
        }
    });
    context.restore();
    context.font = `600 ${tagFont}px ${FONT_FAMILY}`;
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    const tag = language.tag;
    const tagWidth = context.measureText(tag).width;
    const tagRight = size - padding;
    const tagBottom = size - padding * 0.8;
    context.fillStyle = BACKDROP;
    context.fillRect(tagRight - tagWidth - padding * 0.5, tagBottom - tagFont * 1.3, tagWidth + padding, tagFont * 1.6);
    context.fillStyle = KEYWORD;
    context.fillText(tag, tagRight, tagBottom);
    return encodeCanvasToBlob(canvas);
}
