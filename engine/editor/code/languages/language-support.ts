import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { wast } from '@codemirror/lang-wast';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import { csharp, dart, kotlin } from '@codemirror/legacy-modes/mode/clike';
import { haxe } from '@codemirror/legacy-modes/mode/haxe';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import type { Extension } from '@codemirror/state';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
import { gdscriptLanguage } from './gdscript-mode';
import { glslLanguage } from './glsl-mode';
import { lua54Language, luauLanguage } from './luau-mode';
import { wgslLanguage } from './wgsl-mode';
import { zigLanguage } from './zig-mode';
const javascriptSupport = javascript();
const typescriptSupport = javascript({ typescript: true });
const cppSupport = cpp();
const xmlSupport = xml();
const jsonSupport = json();
const htmlSupport = html({ matchClosingTags: true, autoCloseTags: true });
const cssSupport = css();
const pythonSupport = python();
const luauSupport = new LanguageSupport(luauLanguage);
const MARKDOWN_CODE_LANGUAGES: readonly LanguageDescription[] = [
    LanguageDescription.of({ name: 'JavaScript', alias: ['js', 'mjs', 'javascript'], support: javascriptSupport }),
    LanguageDescription.of({ name: 'TypeScript', alias: ['ts', 'typescript'], support: typescriptSupport }),
    LanguageDescription.of({ name: 'JSON', alias: ['json'], support: jsonSupport }),
    LanguageDescription.of({ name: 'HTML', alias: ['html'], support: htmlSupport }),
    LanguageDescription.of({ name: 'CSS', alias: ['css'], support: cssSupport }),
    LanguageDescription.of({ name: 'Python', alias: ['py', 'python'], support: pythonSupport }),
    LanguageDescription.of({ name: 'Lua', alias: ['lua', 'luau'], support: luauSupport }),
];
const SUPPORT: Record<ScriptLanguageId, Extension> = {
    luau: luauSupport,
    lua: new LanguageSupport(lua54Language),
    javascript: javascriptSupport,
    typescript: typescriptSupport,
    html: htmlSupport,
    css: cssSupport,
    svg: xmlSupport,
    json: jsonSupport,
    glsl: new LanguageSupport(glslLanguage),
    wgsl: new LanguageSupport(wgslLanguage),
    python: pythonSupport,
    csharp: new LanguageSupport(StreamLanguage.define(csharp)),
    cpp: cppSupport,
    c: cppSupport,
    rust: rust(),
    go: go(),
    java: java(),
    kotlin: new LanguageSupport(StreamLanguage.define(kotlin)),
    swift: new LanguageSupport(StreamLanguage.define(swift)),
    ruby: new LanguageSupport(StreamLanguage.define(ruby)),
    php: php(),
    dart: new LanguageSupport(StreamLanguage.define(dart)),
    zig: new LanguageSupport(zigLanguage),
    haxe: new LanguageSupport(StreamLanguage.define(haxe)),
    gdscript: new LanguageSupport(gdscriptLanguage),
    wat: wast(),
    markdown: markdown({ codeLanguages: MARKDOWN_CODE_LANGUAGES }),
    yaml: yaml(),
    toml: new LanguageSupport(StreamLanguage.define(toml)),
    xml: xmlSupport,
    shell: new LanguageSupport(StreamLanguage.define(shell)),
};
export function languageSupport(id: ScriptLanguageId): Extension {
    return SUPPORT[id];
}
