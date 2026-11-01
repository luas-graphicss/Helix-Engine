export interface SourceEntry {
    readonly path: string;
    readonly description: string;
    readonly assets?: boolean;
}
export const SOURCE_ENTRIES: readonly SourceEntry[] = [
    { path: 'app', description: 'Rotas Next.js: layout, o editor (/editor) e a documentação (/helix/docs)' },
    { path: 'engine', description: 'A engine: núcleo, renderer, física, terreno, editor' },
    { path: 'docs', description: 'Documentação: manual, tutoriais e referência da API em Markdown, mais o site que os exibe' },
    { path: 'proxy.ts', description: 'Serve o launcher (/) antes das rotas do Next, imune a erros da engine' },
    { path: 'launcher', description: 'Esta página: manifesto, HTML, estilos e o gerador do zip' },
    { path: 'components', description: 'Componentes de UI base (shadcn)' },
    { path: 'lib', description: 'Utilitários compartilhados' },
    { path: 'public', description: 'Ativos estáticos: texturas de terreno, modelos, fixtures', assets: true },
    { path: 'package.json', description: 'Dependências e scripts' },
    { path: 'pnpm-lock.yaml', description: 'Versões travadas das dependências' },
    { path: 'pnpm-workspace.yaml', description: 'Configuração do pnpm' },
    { path: 'tsconfig.json', description: 'Configuração do TypeScript' },
    { path: 'next.config.mjs', description: 'Configuração do Next.js' },
    { path: 'postcss.config.mjs', description: 'Pipeline do Tailwind' },
    { path: 'components.json', description: 'Configuração do shadcn' },
    { path: '.gitignore', description: 'Ignorados do Git' },
];
export const IGNORED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', '.next', '.git', '.v0', '.v0-trash', '.vercel']);
export function selectSourceEntries(includeAssets: boolean): readonly SourceEntry[] {
    return includeAssets ? SOURCE_ENTRIES : SOURCE_ENTRIES.filter((entry) => !entry.assets);
}
