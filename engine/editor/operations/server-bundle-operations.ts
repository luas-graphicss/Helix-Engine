import JSZip from 'jszip';
import { ENGINE_NAME, ENGINE_VERSION } from '@/engine/core/engine-info';
import { downloadBlob } from '@/engine/editor/files/file-download';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { HELIX_NET_PROTOCOL } from '@/engine/net/protocol';
import { hostFiles } from '@/engine/net/server-bundle/host-sources';
import { ROOM_RUNTIME_FILE, ROOM_RUNTIME_SOURCE } from '@/engine/net/server-bundle/room-runtime-source';
import { runtimeModuleForLanguage, serverRuntimeUrl, type ServerRuntimeModule } from '@/engine/net/server-bundle/runtime-modules';
import type { CompiledScript } from '@/engine/scripting/compiler/compile-types';
import { collectScriptSources } from '@/engine/scripting/compiler/project-sources';
import { scriptFileName } from '@/engine/scripting/script-document';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { scriptsForSide } from '@/engine/scripting/script-sides';
import { GAME_SERVER_TARGET_LABEL, isAuthoritative, type GameServerTarget } from '@/engine/scripting/scripting-settings';
const LOG_SOURCE = 'Servidor';
export function serverSlug(name: string): string {
    const slug = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'jogo';
}
interface ManifestScript {
    name: string;
    file: string;
    language: string;
    kind: 'module' | 'source';
    runContext: string;
    entry: boolean;
    module: string;
}
interface EmbeddedRuntime {
    readonly module: ServerRuntimeModule;
    readonly code: string;
}
async function fetchRuntime(module: ServerRuntimeModule): Promise<EmbeddedRuntime> {
    const response = await fetch(serverRuntimeUrl(module));
    if (!response.ok) {
        const detail = await response
            .json()
            .then((body: {
            error?: string;
        }) => body.error)
            .catch(() => undefined);
        throw new Error(detail || `HTTP ${response.status}`);
    }
    return { module, code: await response.text() };
}
function readme(name: string, target: GameServerTarget, scripts: ManifestScript[], runtimes: EmbeddedRuntime[], tickRate: number, maxPlayers: number, url: string): string {
    const executable = scripts.filter((script) => script.kind === 'module');
    const foreign = scripts.filter((script) => script.kind !== 'module');
    const run = target === 'cloudflare'
        ? ['```sh', 'npm install', 'npx wrangler deploy', '```', '', 'O endereço fica `wss://<nome>.<sua-conta>.workers.dev`. Cada sala é um Durable Object: sem servidor para cuidar, e salas vazias dormem sozinhas.']
        : target === 'docker'
            ? ['```sh', 'docker compose up -d --build', '```', '', 'O contêiner expõe a porta 8787 e responde em `/health`. Ponha um proxy com TLS na frente (Caddy, nginx, o balanceador do seu provedor) para o jogo falar em `wss://`.']
            : ['```sh', 'npm install', 'npm start', '```', '', 'O servidor escuta em `PORT` (padrão 8787) e responde em `/health`. Em produção, ponha um proxy com TLS na frente para o jogo falar em `wss://`.'];
    return [
        `# ${name} · servidor autoritativo`,
        '',
        `Pacote gerado pela ${ENGINE_NAME} ${ENGINE_VERSION} para ${GAME_SERVER_TARGET_LABEL[target]}. Contém só o que o servidor precisa: os scripts marcados como **Servidor** e **Ambos** e o runtime da sala. Nada daqui vai para o jogador, e o jogo exportado para o jogador não contém nada daqui.`,
        '',
        '## Rodar',
        '',
        ...run,
        '',
        '## Ligar o jogo a este servidor',
        '',
        `No editor, em **Código ▸ Servidor do jogo**, cole o endereço público (${url ? `hoje: \`${url}\`` : 'por exemplo `wss://jogo.seu-dominio.com`'}) e exporte o jogo de novo. O cliente abre um WebSocket nesse endereço com \`?room=<sala>\` (padrão \`principal\`), envia \`hello\` com o nome e um bilhete opcional, e recebe \`welcome\` com o estado inteiro.`,
        '',
        '## O que está aqui',
        '',
        `- \`${ROOM_RUNTIME_FILE}\`: a sala (protocolo ${HELIX_NET_PROTOCOL}, jogadores, \`helix.net\`, estado, replicação, porteiro). Não precisa editar.`,
        `- \`game/manifest.json\`: nome do jogo, tick (${tickRate} Hz), máximo de jogadores (${maxPlayers}), a lista de scripts e os runtimes embutidos.`,
        ...executable.map((script) => `- \`game/${script.file}\`: ${script.name} (${script.language}, ${script.runContext}${script.entry ? ', entrada' : ''}).`),
        ...runtimes.map(({ module }) => `- \`${module.file}\`: runtime de ${scriptLanguage(module.language).label} que os scripts compilados pedem como \`${module.specifier}\`; o mesmo código que roda no editor, empacotado para o servidor. Não precisa editar.`),
        ...foreign.map((script) => `- \`game/${script.file}\`: ${script.name} (${script.language}) — fonte incluído para referência; este pacote executa as linguagens que compilam para JavaScript (JS, TS, C#, GDScript, Java, Kotlin, Dart, Haxe), as demais entram quando o runtime delas chegar ao servidor.`),
        '',
        '## A API no servidor',
        '',
        'Os scripts veem o mesmo `helix.net` do editor, do lado do servidor: `rpc(nome, (jogador, ...args) => …, { perSecond })`, `on(nome, (jogador, ...args) => …)`, `send`, `broadcast`, `state.set/get/remove`, `replicate(objeto, campos)`, `kick`, `onPlayerJoined`, `onPlayerLeft` e `authenticate((bilhete, pedido) => true | false | motivo | { name })`. Também `helix.log`, `helix.time`, `helix.task` (wait, delay, every, spawn) e `helix.events`. Não há cena nem renderização: o servidor guarda regras e números, não malhas.',
        '',
        '## Segurança',
        '',
        '- Nunca confie no que o cliente manda: confira tipos e limites em cada `rpc` e `on`. `perSecond` corta quem insiste.',
        '- Use `helix.net.authenticate` para validar um bilhete (token da sua conta de jogadores, código de convite…). Sem porteiro, todo mundo entra anônimo.',
        '- Sirva em `wss://` (TLS). Mensagens têm 256 KB no máximo; acima disso o cliente é derrubado.',
        '- Segredos (chaves de API, senhas de banco) ficam em variáveis de ambiente do servidor, lidas por `process.env` nos scripts de servidor; nunca em scripts de cliente ou Ambos.',
        '',
    ].join('\n');
}
export async function exportServerBundle(session: EditorSession): Promise<boolean> {
    const { scripting } = session.scene;
    if (!isAuthoritative(scripting)) {
        session.log.warn(LOG_SOURCE, 'O jogo não tem servidor autoritativo: ligue-o em Código ▸ Servidor do jogo antes de exportar o pacote.');
        return false;
    }
    const { server } = scripting;
    const serverAssets = scriptsForSide(session.library.byKind('script'), 'server');
    if (serverAssets.length === 0) {
        session.log.warn(LOG_SOURCE, 'Nenhum script de Servidor ou Ambos na biblioteca: o pacote ficaria vazio. Crie um pelo modelo "Regras no servidor".');
        return false;
    }
    const startedAt = performance.now();
    const { inputs } = await collectScriptSources(session);
    const roots = new Set(serverAssets.map((asset) => asset.id));
    const result = await session.scripts.compiler.compile(inputs, { roots });
    const compiled = result.compiled.filter((script) => roots.has(script.assetId) || (script.runContext !== 'client' && result.compiled.some((other) => roots.has(other.assetId) && other.dependencies.some((dependency) => dependency.replace(/^\.\//, '') === script.name))));
    const failed = compiled.filter((script) => script.errorCount > 0);
    if (failed.length > 0) {
        session.log.error(LOG_SOURCE, `${failed.length === 1 ? `${failed[0].name} tem erros` : `${failed.length} scripts têm erros`} de compilação; corrija antes de exportar o pacote de servidor.`);
        return false;
    }
    const needed = new Map<string, ServerRuntimeModule>();
    for (const script of compiled) {
        const module = script.kind === 'module' && script.code !== null ? runtimeModuleForLanguage(script.language) : undefined;
        if (module)
            needed.set(module.id, module);
    }
    let runtimes: EmbeddedRuntime[];
    try {
        runtimes = await Promise.all(Array.from(needed.values()).map(fetchRuntime));
    }
    catch (cause) {
        session.log.error(LOG_SOURCE, `Não foi possível empacotar o runtime de ${Array.from(needed.values(), (module) => scriptLanguage(module.language).label).join(', ')}: ${cause instanceof Error ? cause.message : String(cause)}. O pacote não foi gerado.`);
        return false;
    }
    const name = session.projectName;
    const slug = serverSlug(name);
    const zip = new JSZip();
    const manifestScripts: ManifestScript[] = [];
    const indexLines = runtimes.map(({ module }, index) => `import { createBuiltinModule as runtime${index} } from '../${module.file}'`);
    compiled.forEach((script: CompiledScript, index) => {
        const isModule = script.kind === 'module' && script.code !== null;
        const file = isModule ? `${scriptFileName(script.name, script.language).replace(/\.[^.]+$/, '')}.js` : scriptFileName(script.name, script.language);
        const moduleKey = `m${index}`;
        zip.file(`game/${file}`, isModule ? `${script.code}\n` : script.source);
        if (isModule)
            indexLines.push(`export const ${moduleKey} = ${JSON.stringify(script.code)}`);
        manifestScripts.push({ name: script.name, file, language: scriptLanguage(script.language).label, kind: isModule ? 'module' : 'source', runContext: script.runContext, entry: scripting.entryScriptId === script.assetId, module: moduleKey });
    });
    indexLines.push(`export const builtins = { ${runtimes.map(({ module }, index) => `${JSON.stringify(module.specifier)}: runtime${index}`).join(', ')} }`);
    zip.file('game/manifest.json', JSON.stringify({
        format: 'helix-server',
        engine: `${ENGINE_NAME} ${ENGINE_VERSION}`,
        protocol: HELIX_NET_PROTOCOL,
        name,
        exportedAt: new Date().toISOString(),
        server: { tickRate: server.tickRate, maxPlayers: server.maxPlayers, target: server.target, url: server.url },
        scripts: manifestScripts,
        runtimes: runtimes.map(({ module }) => ({ language: module.language, specifier: module.specifier, file: module.file })),
    }, null, 2));
    zip.file('game/index.mjs', `${indexLines.join('\n')}\n`);
    for (const { module, code } of runtimes)
        zip.file(module.file, code);
    zip.file(ROOM_RUNTIME_FILE, ROOM_RUNTIME_SOURCE);
    for (const entry of hostFiles(server.target, slug, name))
        zip.file(entry.path, entry.content);
    zip.file('README.md', readme(name, server.target, manifestScripts, runtimes, server.tickRate, server.maxPlayers, server.url));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE' });
    const delivered = await downloadBlob(blob, `${slug}-servidor-${server.target}.zip`, 'Pacote de servidor Helix');
    if (!delivered)
        return false;
    const modules = manifestScripts.filter((script) => script.kind === 'module').length;
    const sources = manifestScripts.length - modules;
    const duration = Math.max(1, Math.round(performance.now() - startedAt));
    const embedded = runtimes.length > 0 ? ` com o runtime de ${runtimes.map(({ module }) => scriptLanguage(module.language).label).join(' e ')} embutido` : '';
    session.log.info(LOG_SOURCE, `Pacote ${GAME_SERVER_TARGET_LABEL[server.target]} exportado: ${modules} ${modules === 1 ? 'módulo' : 'módulos'}${embedded}${sources > 0 ? ` e ${sources} ${sources === 1 ? 'fonte' : 'fontes'} de outras linguagens` : ''}, ${server.tickRate} Hz, até ${server.maxPlayers} jogadores · ${duration} ms. Nenhum script de cliente foi incluído.`);
    return true;
}
