import * as parse5 from 'parse5';
import * as csstree from 'css-tree';
import { positionAt, type CompileDiagnostic } from './compile-types';
export const ASSET_URL_PREFIX = 'asset:';
export function isAssetUrl(value: string): boolean {
    return value.trim().toLowerCase().startsWith(ASSET_URL_PREFIX);
}
export function assetUrlTarget(value: string): string {
    return decodeURIComponent(value.trim().slice(ASSET_URL_PREFIX.length).replace(/^\/\//, ''));
}
export interface WebCompileOutput {
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly dependencies: readonly string[];
}
const HTML_ERROR_MESSAGES: Record<string, string> = {
    'non-void-html-element-start-tag-with-trailing-solidus': 'Elemento não vazio fechado com "/>": em HTML a barra é ignorada e a tag continua aberta. Feche com a tag de fim.',
    'end-tag-without-matching-open-element': 'Tag de fim sem tag de início correspondente.',
    'unexpected-solidus-in-tag': 'Barra "/" inesperada dentro da tag.',
    'unexpected-null-character': 'Caractere nulo inesperado.',
    'unexpected-question-mark-instead-of-tag-name': '"<?" não abre uma instrução de processamento em HTML; use "<!-- -->" para comentários.',
    'invalid-first-character-of-tag-name': 'Primeiro caractere inválido no nome da tag.',
    'missing-end-tag-name': 'Tag de fim sem nome ("</>").',
    'eof-before-tag-name': 'O arquivo terminou antes do nome da tag.',
    'eof-in-tag': 'O arquivo terminou dentro de uma tag.',
    'eof-in-comment': 'O arquivo terminou dentro de um comentário.',
    'eof-in-script-html-comment-like-text': 'O arquivo terminou dentro de um comentário em <script>.',
    'eof-in-doctype': 'O arquivo terminou dentro do DOCTYPE.',
    'eof-in-cdata': 'O arquivo terminou dentro de uma seção CDATA.',
    'missing-whitespace-between-attributes': 'Falta um espaço entre os atributos.',
    'unexpected-character-in-attribute-name': 'Caractere inesperado no nome do atributo.',
    'unexpected-character-in-unquoted-attribute-value': 'Caractere inesperado num valor de atributo sem aspas; coloque o valor entre aspas.',
    'missing-attribute-value': 'Atributo com "=" mas sem valor.',
    'duplicate-attribute': 'Atributo repetido no mesmo elemento; só o primeiro vale.',
    'unexpected-equals-sign-before-attribute-name': '"=" inesperado antes do nome do atributo.',
    'missing-whitespace-after-doctype-public-keyword': 'Falta espaço depois de PUBLIC no DOCTYPE.',
    'missing-doctype-name': 'DOCTYPE sem nome.',
    'abrupt-closing-of-empty-comment': 'Comentário vazio fechado abruptamente ("<!-->").',
    'incorrectly-closed-comment': 'Comentário fechado incorretamente ("--!>").',
    'incorrectly-opened-comment': 'Comentário aberto incorretamente; use "<!--".',
    'nested-comment': 'Comentário aninhado ("<!--" dentro de outro comentário).',
    'cdata-in-html-content': 'Seção CDATA fora de conteúdo estrangeiro (SVG/MathML).',
    'control-character-in-input-stream': 'Caractere de controle no código.',
    'noncharacter-in-input-stream': 'Caractere Unicode inválido no código.',
    'surrogate-in-input-stream': 'Par substituto Unicode solto no código.',
    'character-reference-outside-unicode-range': 'Referência de caractere fora do intervalo Unicode.',
    'unknown-named-character-reference': 'Entidade HTML desconhecida ("&nome;").',
    'missing-semicolon-after-character-reference': 'Falta ";" depois da entidade HTML.',
    'absence-of-digits-in-numeric-character-reference': 'Entidade numérica sem dígitos.',
    'null-character-reference': 'Referência ao caractere nulo.',
    'surrogate-character-reference': 'Referência a um par substituto Unicode.',
    'noncharacter-character-reference': 'Referência a um caractere Unicode inválido.',
    'control-character-reference': 'Referência a um caractere de controle.',
    'disallowed-content-in-noscript-in-head': 'Conteúdo não permitido dentro de <noscript> no <head>.',
    'open-elements-left-after-eof': 'O arquivo terminou com elementos ainda abertos; faltam tags de fim.',
    'closing-of-element-with-open-child-elements': 'Elemento fechado com filhos ainda abertos.',
    'misplaced-doctype': 'DOCTYPE fora do início do documento.',
    'misplaced-start-tag-for-head-element': 'Tag <head> fora do lugar.',
    'nested-noscript-in-head': '<noscript> aninhado no <head>.',
};
const IGNORED_HTML_ERRORS = new Set(['missing-doctype']);
interface Parse5Error {
    code: string;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}
interface Parse5Node {
    nodeName: string;
    tagName?: string;
    attrs?: Array<{
        name: string;
        value: string;
    }>;
    childNodes?: Parse5Node[];
    content?: Parse5Node;
    value?: string;
    sourceCodeLocation?: {
        startLine: number;
        startCol: number;
        endLine: number;
        endCol: number;
    } | null;
}
const URL_ATTRIBUTES = new Set(['src', 'href', 'poster', 'xlink:href', 'data', 'srcset']);
const INLINE_EVENT_ATTRIBUTE = /^on[a-z]+$/i;
export function compileHtml(source: string): WebCompileOutput {
    const diagnostics: CompileDiagnostic[] = [];
    const dependencies = new Set<string>();
    const errors: Parse5Error[] = [];
    const fullDocument = /^\s*(<!doctype|<html[\s>])/i.test(source);
    const parseOptions = { sourceCodeLocationInfo: true, onParseError: (error: Parse5Error) => errors.push(error) };
    const root = (fullDocument ? parse5.parse(source, parseOptions) : parse5.parseFragment(source, parseOptions)) as unknown as Parse5Node;
    for (const error of errors) {
        if (IGNORED_HTML_ERRORS.has(error.code))
            continue;
        const message = HTML_ERROR_MESSAGES[error.code] ?? `Erro de análise HTML: ${error.code}.`;
        diagnostics.push({ severity: 'warning', message, line: error.startLine, column: error.startCol, endLine: error.endLine, endColumn: error.endCol, code: error.code, source: 'HTML' });
    }
    const visit = (node: Parse5Node) => {
        const location = node.sourceCodeLocation ?? undefined;
        const line = location?.startLine ?? 1;
        const column = location?.startCol ?? 1;
        const tag = node.tagName?.toLowerCase();
        if (tag === 'script') {
            diagnostics.push({ severity: 'warning', message: 'Scripts embutidos em HTML não rodam na engine: a lógica fica num script JavaScript ou TypeScript que acessa esta tela por helix.gui.html.', line, column, code: 'inline-script', source: 'HTML' });
        }
        if (tag === 'link') {
            const rel = node.attrs?.find((attribute) => attribute.name === 'rel')?.value ?? '';
            const href = node.attrs?.find((attribute) => attribute.name === 'href')?.value ?? '';
            if (/stylesheet/i.test(rel) && href && !isAssetUrl(href)) {
                diagnostics.push({ severity: 'warning', message: `Folha de estilo externa "${href}" não é carregada: use um script CSS da biblioteca (href="asset:Nome") ou um bloco <style>.`, line, column, code: 'external-stylesheet', source: 'HTML' });
            }
        }
        if (tag === 'iframe' || tag === 'object' || tag === 'embed') {
            diagnostics.push({ severity: 'warning', message: `<${tag}> não é permitido na interface do jogo e será removido.`, line, column, code: 'disallowed-element', source: 'HTML' });
        }
        for (const attribute of node.attrs ?? []) {
            if (INLINE_EVENT_ATTRIBUTE.test(attribute.name)) {
                diagnostics.push({ severity: 'warning', message: `O atributo ${attribute.name} não roda código: use data-action="nome" e trate o evento num script com helix.gui.html.`, line, column, code: 'inline-event', source: 'HTML' });
            }
            if (URL_ATTRIBUTES.has(attribute.name) && isAssetUrl(attribute.value))
                dependencies.add(assetUrlTarget(attribute.value));
            if (attribute.name === 'style')
                for (const url of cssAssetUrls(attribute.value))
                    dependencies.add(url);
        }
        if (tag === 'style') {
            const text = (node.childNodes ?? []).map((child) => child.value ?? '').join('');
            const styleLocation = node.childNodes?.[0]?.sourceCodeLocation ?? location;
            const nested = compileCss(text);
            for (const diagnostic of nested.diagnostics) {
                diagnostics.push({ ...diagnostic, line: diagnostic.line + (styleLocation?.startLine ?? 1) - 1, column: diagnostic.line === 1 ? diagnostic.column + (styleLocation?.startCol ?? 1) - 1 : diagnostic.column });
            }
            for (const dependency of nested.dependencies)
                dependencies.add(dependency);
        }
        for (const child of node.childNodes ?? [])
            visit(child);
        if (node.content)
            visit(node.content);
    };
    visit(root);
    return { diagnostics, dependencies: Array.from(dependencies) };
}
interface CssParseError {
    message: string;
    line?: number;
    column?: number;
    offset?: number;
}
function cssAssetUrls(css: string): string[] {
    const urls: string[] = [];
    try {
        const ast = csstree.parse(css, { context: css.includes('{') ? 'stylesheet' : 'declarationList', positions: false });
        csstree.walk(ast, {
            visit: 'Url',
            enter(node) {
                if (isAssetUrl(node.value))
                    urls.push(assetUrlTarget(node.value));
            },
        });
    }
    catch {
    }
    return urls;
}
const CSS_PROPERTY_ALLOWLIST = new Set(['pointer-events', 'user-select', 'backdrop-filter', 'text-wrap', 'field-sizing', 'anchor-name', 'position-anchor', 'view-transition-name', 'interpolate-size', 'scrollbar-gutter', 'text-box-trim', 'text-box-edge']);
export function compileCss(source: string): WebCompileOutput {
    const diagnostics: CompileDiagnostic[] = [];
    const dependencies = new Set<string>();
    let ast: csstree.CssNode;
    try {
        ast = csstree.parse(source, {
            positions: true,
            onParseError: (error: CssParseError) => {
                diagnostics.push({ severity: 'error', message: `Erro de sintaxe CSS: ${error.message}.`, line: error.line ?? 1, column: error.column ?? 1, source: 'CSS' });
            },
        });
    }
    catch (cause) {
        const error = cause as CssParseError;
        diagnostics.push({ severity: 'error', message: `Erro de sintaxe CSS: ${error.message}.`, line: error.line ?? 1, column: error.column ?? 1, source: 'CSS' });
        return { diagnostics, dependencies: [] };
    }
    csstree.walk(ast, {
        visit: 'Declaration',
        enter(node) {
            const property = node.property.trim();
            const start = node.loc?.start;
            const line = start?.line ?? 1;
            const column = start?.column ?? 1;
            if (property.startsWith('--') || CSS_PROPERTY_ALLOWLIST.has(property.toLowerCase()))
                return;
            const result = csstree.lexer.matchProperty(property, node.value);
            if (result.matched || !result.error)
                return;
            const error = result.error as {
                name?: string;
                message?: string;
                rawMessage?: string;
                loc?: {
                    start?: {
                        line: number;
                        column: number;
                    };
                };
            };
            if (error.name === 'SyntaxReferenceError') {
                diagnostics.push({ severity: 'warning', message: `Propriedade CSS desconhecida "${property}"; o navegador vai ignorá-la.`, line, column, code: 'unknown-property', source: 'CSS' });
                return;
            }
            const value = csstree.generate(node.value).trim();
            const where = error.loc?.start;
            const grammar = csstree.lexer.getProperty(property)?.syntax;
            const expected = grammar ? ` Sintaxe esperada: ${csstree.generate(grammar as unknown as csstree.CssNode).slice(0, 120)}` : '';
            diagnostics.push({
                severity: 'warning',
                message: `Valor inválido para "${property}": ${value}; o navegador vai descartar a declaração.${expected}`,
                line: where?.line ?? line,
                column: where?.column ?? column,
                code: 'invalid-value',
                source: 'CSS',
            });
        },
    });
    csstree.walk(ast, {
        visit: 'Atrule',
        enter(node) {
            if (node.name.toLowerCase() === 'import') {
                const start = node.loc?.start;
                diagnostics.push({ severity: 'warning', message: '@import não carrega folhas externas na interface do jogo; anexe o script CSS à cena ou use asset:Nome.', line: start?.line ?? 1, column: start?.column ?? 1, code: 'import', source: 'CSS' });
            }
        },
    });
    csstree.walk(ast, {
        visit: 'Url',
        enter(node) {
            if (isAssetUrl(node.value))
                dependencies.add(assetUrlTarget(node.value));
        },
    });
    return { diagnostics, dependencies: Array.from(dependencies) };
}
function parseXmlErrorLocation(message: string): {
    line: number;
    column: number;
} {
    const chrome = /line (\d+) at column (\d+)/i.exec(message);
    if (chrome)
        return { line: Number(chrome[1]), column: Number(chrome[2]) };
    const firefox = /Line Number (\d+), Column (\d+)/i.exec(message);
    if (firefox)
        return { line: Number(firefox[1]), column: Number(firefox[2]) };
    const generic = /(\d+):(\d+)/.exec(message);
    return generic ? { line: Number(generic[1]), column: Number(generic[2]) } : { line: 1, column: 1 };
}
function xmlParseError(document: Document, label: string, source: string): CompileDiagnostic | null {
    const error = document.querySelector('parsererror');
    if (!error)
        return null;
    const text = (error.textContent ?? '').replace(/\s+/g, ' ').trim();
    const { line, column } = parseXmlErrorLocation(text);
    return { severity: 'error', message: `${label} mal formado: ${text.replace(/^This page contains the following errors:/i, '').trim() || 'XML inválido'}`, line, column, source };
}
export function compileXml(source: string): WebCompileOutput {
    if (typeof DOMParser === 'undefined')
        return { diagnostics: [], dependencies: [] };
    if (source.trim().length === 0)
        return { diagnostics: [{ severity: 'error', message: 'O arquivo XML está vazio.', line: 1, column: 1, source: 'XML' }], dependencies: [] };
    const document = new DOMParser().parseFromString(source, 'application/xml');
    const error = xmlParseError(document, 'XML', 'XML');
    return { diagnostics: error ? [error] : [], dependencies: [] };
}
export function compileSvg(source: string): WebCompileOutput {
    const diagnostics: CompileDiagnostic[] = [];
    const dependencies = new Set<string>();
    if (typeof DOMParser === 'undefined')
        return { diagnostics, dependencies: [] };
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    const error = xmlParseError(document, 'SVG', 'SVG');
    if (error)
        return { diagnostics: [error], dependencies: [] };
    const root = document.documentElement;
    if (root.localName !== 'svg') {
        diagnostics.push({ severity: 'error', message: `O elemento raiz é <${root.localName}>; um script SVG precisa começar por <svg>.`, line: 1, column: 1, source: 'SVG' });
    }
    else if (!root.getAttribute('viewBox') && !(root.getAttribute('width') && root.getAttribute('height'))) {
        diagnostics.push({ severity: 'info', message: 'O <svg> não declara viewBox nem width/height; o desenho pode não escalar como esperado.', line: 1, column: 1, code: 'missing-viewbox', source: 'SVG' });
    }
    for (const script of Array.from(document.querySelectorAll('script'))) {
        void script;
        diagnostics.push({ severity: 'warning', message: 'Scripts dentro de SVG não rodam na engine.', line: 1, column: 1, code: 'inline-script', source: 'SVG' });
    }
    for (const element of Array.from(document.querySelectorAll('[href], [*|href], [src]'))) {
        const value = element.getAttribute('href') ?? element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? element.getAttribute('src') ?? '';
        if (isAssetUrl(value))
            dependencies.add(assetUrlTarget(value));
    }
    return { diagnostics, dependencies: Array.from(dependencies) };
}
export function compileJson(source: string): WebCompileOutput {
    if (source.trim().length === 0) {
        return { diagnostics: [{ severity: 'error', message: 'O arquivo JSON está vazio.', line: 1, column: 1, source: 'JSON' }], dependencies: [] };
    }
    try {
        JSON.parse(source);
        return { diagnostics: [], dependencies: [] };
    }
    catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const explicit = /\(line (\d+) column (\d+)\)/i.exec(message);
        const atPosition = /position (\d+)/i.exec(message);
        const location = explicit ? { line: Number(explicit[1]), column: Number(explicit[2]) } : atPosition ? positionAt(source, Number(atPosition[1])) : { line: 1, column: 1 };
        return { diagnostics: [{ severity: 'error', message: `JSON inválido: ${message.replace(/ in JSON at position \d+.*$/i, '').replace(/^JSON\.parse: /, '')}.`, ...location, source: 'JSON' }], dependencies: [] };
    }
}
