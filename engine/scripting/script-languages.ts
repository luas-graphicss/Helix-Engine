export type ScriptLanguageId = 'luau' | 'lua' | 'javascript' | 'typescript' | 'html' | 'css' | 'svg' | 'json' | 'glsl' | 'wgsl' | 'python' | 'csharp' | 'cpp' | 'c' | 'rust' | 'go' | 'java' | 'kotlin' | 'swift' | 'ruby' | 'php' | 'dart' | 'zig' | 'haxe' | 'gdscript' | 'wat' | 'markdown' | 'yaml' | 'toml' | 'xml' | 'shell';
export type ScriptLanguageFamily = 'scripting' | 'web' | 'shader' | 'systems' | 'data';
export const SCRIPT_FAMILY_LABEL: Record<ScriptLanguageFamily, string> = {
    scripting: 'Scripting de jogo',
    web: 'Interface em código',
    shader: 'Shaders',
    systems: 'Linguagens de sistema',
    data: 'Dados e configuração',
};
export const SCRIPT_FAMILY_DESCRIPTION: Record<ScriptLanguageFamily, string> = {
    scripting: 'Lógica dos atores, regras do jogo e eventos. É daqui que a linguagem base de um jogo costuma sair.',
    web: 'Telas, HUDs e elementos desenhados em HTML, CSS e SVG, lado a lado com o designer de interface.',
    shader: 'Programas de GPU para materiais, pós-processo e efeitos.',
    systems: 'Linguagens compiladas para módulos de alto desempenho e portes de código existente.',
    data: 'Tabelas, configurações e documentação que acompanham o jogo.',
};
export const SCRIPT_FAMILIES: readonly ScriptLanguageFamily[] = ['scripting', 'web', 'shader', 'systems', 'data'];
export type ScriptCompilerStatus = 'pending' | 'beta' | 'ready';
export const SCRIPT_COMPILER_STATUS_LABEL: Record<ScriptCompilerStatus, string> = {
    pending: 'Somente edição',
    beta: 'Execução em beta',
    ready: 'Execução estável',
};
export interface ScriptLanguage {
    readonly id: ScriptLanguageId;
    readonly label: string;
    readonly tag: string;
    readonly family: ScriptLanguageFamily;
    readonly description: string;
    readonly extensions: readonly string[];
    readonly mimeType: string;
    readonly lineComment: string | null;
    readonly blockComment: readonly [
        string,
        string
    ] | null;
    readonly indent: {
        readonly size: number;
        readonly useTabs: boolean;
    };
    readonly compiler: ScriptCompilerStatus;
    readonly recommended?: boolean;
    readonly markup?: boolean;
}
function language(definition: ScriptLanguage): ScriptLanguage {
    return definition;
}
export const SCRIPT_LANGUAGES: readonly ScriptLanguage[] = [
    language({
        id: 'luau',
        label: 'Luau',
        tag: 'LUAU',
        family: 'scripting',
        description: 'Lua com tipos graduais e desempenho de jogo, no espírito do Roblox. Recomendada para a lógica dos atores.',
        extensions: ['luau'],
        mimeType: 'text/x-luau',
        lineComment: '--',
        blockComment: ['--[[', ']]'],
        indent: { size: 4, useTabs: true },
        compiler: 'ready',
        recommended: true,
    }),
    language({
        id: 'lua',
        label: 'Lua',
        tag: 'LUA',
        family: 'scripting',
        description: 'Lua 5.4 clássica, leve e embutível; portes de bibliotecas existentes entram sem conversão.',
        extensions: ['lua'],
        mimeType: 'text/x-lua',
        lineComment: '--',
        blockComment: ['--[[', ']]'],
        indent: { size: 4, useTabs: true },
        compiler: 'ready',
    }),
    language({
        id: 'javascript',
        label: 'JavaScript',
        tag: 'JS',
        family: 'scripting',
        description: 'A linguagem da web, com acesso direto à API do jogo e às APIs do navegador.',
        extensions: ['js', 'mjs'],
        mimeType: 'text/javascript',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 2, useTabs: false },
        compiler: 'beta',
        recommended: true,
    }),
    language({
        id: 'typescript',
        label: 'TypeScript',
        tag: 'TS',
        family: 'scripting',
        description: 'JavaScript com tipos estáticos: autocompletar preciso e erros antes de rodar.',
        extensions: ['ts'],
        mimeType: 'text/typescript',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 2, useTabs: false },
        compiler: 'beta',
        recommended: true,
    }),
    language({
        id: 'python',
        label: 'Python',
        tag: 'PY',
        family: 'scripting',
        description: 'Sintaxe legível para prototipar regras e ferramentas do jogo, com o Python 3 completo.',
        extensions: ['py'],
        mimeType: 'text/x-python',
        lineComment: '#',
        blockComment: null,
        indent: { size: 4, useTabs: false },
        compiler: 'ready',
    }),
    language({
        id: 'gdscript',
        label: 'GDScript',
        tag: 'GD',
        family: 'scripting',
        description: 'A linguagem do Godot, para quem traz projetos e hábitos de lá.',
        extensions: ['gd'],
        mimeType: 'text/x-gdscript',
        lineComment: '#',
        blockComment: null,
        indent: { size: 4, useTabs: true },
        compiler: 'ready',
    }),
    language({
        id: 'csharp',
        label: 'C#',
        tag: 'C#',
        family: 'scripting',
        description: 'Componentes no estilo Unity, com classes, propriedades e eventos (subconjunto do C#: classes, propriedades, lambdas, List/Dictionary, LINQ básico, async/await).',
        extensions: ['cs'],
        mimeType: 'text/x-csharp',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'haxe',
        label: 'Haxe',
        tag: 'HX',
        family: 'scripting',
        description: 'Linguagem multiplataforma com tipos, popular em motores 2D e ferramentas.',
        extensions: ['hx'],
        mimeType: 'text/x-haxe',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: true },
        compiler: 'ready',
    }),
    language({
        id: 'html',
        label: 'HTML',
        tag: 'HTML',
        family: 'web',
        description: 'Estrutura de telas e HUDs em marcação.',
        extensions: ['html', 'htm'],
        mimeType: 'text/html',
        lineComment: null,
        blockComment: ['<!--', '-->'],
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
        markup: true,
    }),
    language({
        id: 'css',
        label: 'CSS',
        tag: 'CSS',
        family: 'web',
        description: 'Estilo das telas em código: cores, tipografia, layout e animações.',
        extensions: ['css'],
        mimeType: 'text/css',
        lineComment: null,
        blockComment: ['/*', '*/'],
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
        markup: true,
    }),
    language({
        id: 'svg',
        label: 'SVG',
        tag: 'SVG',
        family: 'web',
        description: 'Ícones, formas e ilustrações vetoriais para a interface.',
        extensions: ['svg'],
        mimeType: 'image/svg+xml',
        lineComment: null,
        blockComment: ['<!--', '-->'],
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
        markup: true,
    }),
    language({
        id: 'glsl',
        label: 'GLSL',
        tag: 'GLSL',
        family: 'shader',
        description: 'Shaders GLSL ES 3.00 de pós-processamento (helix.post.custom) e de superfície de material (helix.material.fromShader).',
        extensions: ['glsl', 'frag', 'vert'],
        mimeType: 'text/x-glsl',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'ready',
    }),
    language({
        id: 'wgsl',
        label: 'WGSL',
        tag: 'WGSL',
        family: 'shader',
        description: 'A linguagem de shaders do WebGPU, com os mesmos modelos de pós-processamento e superfície do GLSL.',
        extensions: ['wgsl'],
        mimeType: 'text/x-wgsl',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'ready',
    }),
    language({
        id: 'cpp',
        label: 'C++',
        tag: 'C++',
        family: 'systems',
        description: 'Módulos de alto desempenho compilados para WebAssembly.',
        extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh'],
        mimeType: 'text/x-c++src',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'c',
        label: 'C',
        tag: 'C',
        family: 'systems',
        description: 'C puro para bibliotecas pequenas e portes de código clássico.',
        extensions: ['c', 'h'],
        mimeType: 'text/x-csrc',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'rust',
        label: 'Rust',
        tag: 'RS',
        family: 'systems',
        description: 'Segurança de memória e desempenho nativo, compilada para WebAssembly.',
        extensions: ['rs'],
        mimeType: 'text/x-rust',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'go',
        label: 'Go',
        tag: 'GO',
        family: 'systems',
        description: 'Simplicidade e concorrência, compilada para WebAssembly.',
        extensions: ['go'],
        mimeType: 'text/x-go',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: true },
        compiler: 'beta',
    }),
    language({
        id: 'zig',
        label: 'Zig',
        tag: 'ZIG',
        family: 'systems',
        description: 'Controle de baixo nível sem macros ocultas, compilada para WebAssembly.',
        extensions: ['zig'],
        mimeType: 'text/x-zig',
        lineComment: '//',
        blockComment: null,
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'java',
        label: 'Java',
        tag: 'JAVA',
        family: 'systems',
        description: 'Classes e pacotes para quem vem do ecossistema JVM.',
        extensions: ['java'],
        mimeType: 'text/x-java',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'kotlin',
        label: 'Kotlin',
        tag: 'KT',
        family: 'systems',
        description: 'Concisa e segura contra nulos, familiar para quem desenvolve para Android.',
        extensions: ['kt', 'kts'],
        mimeType: 'text/x-kotlin',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'swift',
        label: 'Swift',
        tag: 'SWIFT',
        family: 'systems',
        description: 'A linguagem da Apple, com sintaxe moderna e tipos fortes, compilada para WebAssembly.',
        extensions: ['swift'],
        mimeType: 'text/x-swift',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'dart',
        label: 'Dart',
        tag: 'DART',
        family: 'systems',
        description: 'Linguagem do Flutter, otimizada para interfaces e compilação rápida.',
        extensions: ['dart'],
        mimeType: 'text/x-dart',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 2, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'ruby',
        label: 'Ruby',
        tag: 'RB',
        family: 'scripting',
        description: 'Expressiva e amigável para scripts de regras e ferramentas, com o Ruby 3.4 completo: hooks on_start/on_update, require("Nome") entre scripts e esperas automáticas nas promessas.',
        extensions: ['rb'],
        mimeType: 'text/x-ruby',
        lineComment: '#',
        blockComment: ['=begin', '=end'],
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
    }),
    language({
        id: 'php',
        label: 'PHP',
        tag: 'PHP',
        family: 'scripting',
        description: 'PHP 8.4 completo, para quem já domina a linguagem: classes com hooks, módulos por helix_require e esperas com yield.',
        extensions: ['php'],
        mimeType: 'text/x-php',
        lineComment: '//',
        blockComment: ['/*', '*/'],
        indent: { size: 4, useTabs: false },
        compiler: 'beta',
    }),
    language({
        id: 'wat',
        label: 'WebAssembly (texto)',
        tag: 'WAT',
        family: 'systems',
        description: 'O formato textual do WebAssembly, para módulos escritos à mão, com a API inteira pelas importações helix.*.',
        extensions: ['wat'],
        mimeType: 'text/x-wat',
        lineComment: ';;',
        blockComment: ['(;', ';)'],
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
    }),
    language({
        id: 'json',
        label: 'JSON',
        tag: 'JSON',
        family: 'data',
        description: 'Tabelas de dados, configurações e manifestos do jogo.',
        extensions: ['json'],
        mimeType: 'application/json',
        lineComment: null,
        blockComment: null,
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
        markup: true,
    }),
    language({
        id: 'yaml',
        label: 'YAML',
        tag: 'YAML',
        family: 'data',
        description: 'Configurações legíveis, com indentação significativa.',
        extensions: ['yaml', 'yml'],
        mimeType: 'text/yaml',
        lineComment: '#',
        blockComment: null,
        indent: { size: 2, useTabs: false },
        compiler: 'pending',
        markup: true,
    }),
    language({
        id: 'toml',
        label: 'TOML',
        tag: 'TOML',
        family: 'data',
        description: 'Configuração em seções e chaves, sem ambiguidades; o arquivo chega aos scripts por require("Nome") ou helix.assets.data, já interpretado.',
        extensions: ['toml'],
        mimeType: 'application/toml',
        lineComment: '#',
        blockComment: null,
        indent: { size: 2, useTabs: false },
        compiler: 'ready',
        markup: true,
    }),
    language({
        id: 'xml',
        label: 'XML',
        tag: 'XML',
        family: 'data',
        description: 'Dados estruturados e formatos de intercâmbio.',
        extensions: ['xml'],
        mimeType: 'application/xml',
        lineComment: null,
        blockComment: ['<!--', '-->'],
        indent: { size: 2, useTabs: false },
        compiler: 'pending',
        markup: true,
    }),
    language({
        id: 'markdown',
        label: 'Markdown',
        tag: 'MD',
        family: 'data',
        description: 'Documentação, notas de design e textos do jogo.',
        extensions: ['md', 'markdown'],
        mimeType: 'text/markdown',
        lineComment: null,
        blockComment: ['<!--', '-->'],
        indent: { size: 2, useTabs: false },
        compiler: 'pending',
        markup: true,
    }),
    language({
        id: 'shell',
        label: 'Shell',
        tag: 'SH',
        family: 'data',
        description: 'Scripts de automação e build que acompanham o projeto.',
        extensions: ['sh', 'bash', 'zsh'],
        mimeType: 'text/x-shellscript',
        lineComment: '#',
        blockComment: null,
        indent: { size: 2, useTabs: false },
        compiler: 'pending',
        markup: true,
    }),
];
const LANGUAGES_BY_ID = new Map<ScriptLanguageId, ScriptLanguage>(SCRIPT_LANGUAGES.map((entry) => [entry.id, entry]));
const LANGUAGES_BY_EXTENSION = new Map<string, ScriptLanguage>();
for (const entry of SCRIPT_LANGUAGES) {
    for (const extension of entry.extensions) {
        if (!LANGUAGES_BY_EXTENSION.has(extension))
            LANGUAGES_BY_EXTENSION.set(extension, entry);
    }
}
export const SCRIPT_EXTENSIONS: readonly string[] = Array.from(LANGUAGES_BY_EXTENSION.keys());
export const SCRIPT_ACCEPT = SCRIPT_EXTENSIONS.map((extension) => `.${extension}`).join(',');
export const DEFAULT_SCRIPT_LANGUAGE: ScriptLanguageId = 'luau';
export function scriptLanguage(id: ScriptLanguageId): ScriptLanguage {
    const found = LANGUAGES_BY_ID.get(id);
    if (!found)
        throw new Error(`Linguagem de script desconhecida: ${id}.`);
    return found;
}
export function isScriptLanguageId(value: unknown): value is ScriptLanguageId {
    return typeof value === 'string' && LANGUAGES_BY_ID.has(value as ScriptLanguageId);
}
export function scriptLanguageForExtension(extension: string): ScriptLanguage | null {
    return LANGUAGES_BY_EXTENSION.get(extension.toLowerCase().replace(/^\./, '')) ?? null;
}
export function scriptExtension(id: ScriptLanguageId): string {
    return scriptLanguage(id).extensions[0];
}
export function baseLanguageCandidates(): ScriptLanguage[] {
    return SCRIPT_LANGUAGES.filter((entry) => !entry.markup).sort((a, b) => {
        if (Boolean(a.recommended) !== Boolean(b.recommended))
            return a.recommended ? -1 : 1;
        return a.label.localeCompare(b.label, 'pt-BR');
    });
}
export function languagesByFamily(family: ScriptLanguageFamily): ScriptLanguage[] {
    return SCRIPT_LANGUAGES.filter((entry) => entry.family === family);
}
export const ASSET_LANGUAGE_FAMILIES: readonly ScriptLanguageFamily[] = ['web', 'shader', 'data'];
export function isAssetLanguage(id: ScriptLanguageId): boolean {
    return ASSET_LANGUAGE_FAMILIES.includes(scriptLanguage(id).family);
}
export function isShaderLanguage(id: ScriptLanguageId): boolean {
    return scriptLanguage(id).family === 'shader';
}
export function formatLanguageLabels(ids: readonly ScriptLanguageId[]): string {
    const labels = ids.map((id) => scriptLanguage(id).label);
    if (labels.length <= 1)
        return labels.join('');
    return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}
export function commentLine(id: ScriptLanguageId, text: string): string {
    const entry = scriptLanguage(id);
    if (entry.lineComment)
        return `${entry.lineComment} ${text}`;
    if (entry.blockComment)
        return `${entry.blockComment[0]} ${text} ${entry.blockComment[1]}`;
    return '';
}
export function indentUnit(id: ScriptLanguageId): string {
    const { indent } = scriptLanguage(id);
    return indent.useTabs ? '\t' : ' '.repeat(indent.size);
}
