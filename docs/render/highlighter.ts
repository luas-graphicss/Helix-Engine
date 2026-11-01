import 'server-only';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { bundledLanguages, type BundledLanguage } from 'shiki/langs';
import { helixCodeTheme } from './helix-code-theme';
export const DOCS_CODE_LANGUAGES = [
    'luau',
    'lua',
    'javascript',
    'typescript',
    'python',
    'ruby',
    'php',
    'gdscript',
    'csharp',
    'haxe',
    'c',
    'cpp',
    'rust',
    'go',
    'zig',
    'java',
    'kotlin',
    'swift',
    'dart',
    'wasm',
    'glsl',
    'wgsl',
    'html',
    'css',
    'json',
    'yaml',
    'toml',
    'xml',
    'markdown',
    'shellscript',
] as const satisfies readonly BundledLanguage[];
export const CODE_LANGUAGE_LABEL: Readonly<Record<string, string>> = {
    luau: 'Luau',
    lua: 'Lua',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    python: 'Python',
    py: 'Python',
    ruby: 'Ruby',
    rb: 'Ruby',
    php: 'PHP',
    gdscript: 'GDScript',
    csharp: 'C#',
    cs: 'C#',
    haxe: 'Haxe',
    c: 'C',
    cpp: 'C++',
    rust: 'Rust',
    go: 'Go',
    zig: 'Zig',
    java: 'Java',
    kotlin: 'Kotlin',
    swift: 'Swift',
    dart: 'Dart',
    wasm: 'WebAssembly (texto)',
    glsl: 'GLSL',
    wgsl: 'WGSL',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    yaml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    markdown: 'Markdown',
    shellscript: 'Shell',
    bash: 'Shell',
    sh: 'Shell',
    text: 'Texto',
};
const HIGHLIGHTER_SLOT = Symbol.for('helix.docs.highlighter');
type HighlighterHolder = {
    [HIGHLIGHTER_SLOT]?: Promise<HighlighterCore>;
};
export function getDocsHighlighter(): Promise<HighlighterCore> {
    const holder = globalThis as HighlighterHolder;
    holder[HIGHLIGHTER_SLOT] ??= createHighlighterCore({
        themes: [helixCodeTheme],
        langs: DOCS_CODE_LANGUAGES.map((id) => bundledLanguages[id]),
        engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
    return holder[HIGHLIGHTER_SLOT];
}
