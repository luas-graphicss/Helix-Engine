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
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
    language({
    }),
];
