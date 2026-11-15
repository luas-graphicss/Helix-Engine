import { ENGINE_VERSION } from '@/engine/core/engine-info';
import { MCP_KIT_FOLDER } from './kit-location';
export const KIT_WORKER_FILE = 'worker.js';
const WRANGLER_CONFIG = `name = "${MCP_KIT_FOLDER}"
main = "${KIT_WORKER_FILE}"
compatibility_date = "2025-06-01"
workers_dev = true

[[durable_objects.bindings]]
name = "SESSIONS"
class_name = "EngineSession"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["EngineSession"]

[vars]
CALL_TIMEOUT_MS = "45000"
POLL_WAIT_MS = "25000"
QUEUE_LIMIT = "64"
ENGINE_WINDOW_MS = "40000"
FILE_TTL_MS = "900000"
`;
const PACKAGE_MANIFEST = {
    name: MCP_KIT_FOLDER,
    version: ENGINE_VERSION,
    private: true,
    type: 'module',
    scripts: { deploy: 'wrangler deploy', dev: 'wrangler dev', tail: 'wrangler tail' },
    devDependencies: { wrangler: '^4.0.0' },
    engines: { node: '>=20' },
};
const README = `# Kit MCP da Helix Engine ${ENGINE_VERSION}

Este kit publica um Worker na sua conta da Cloudflare. Ele liga agentes de IA ao editor da Helix aberto no seu navegador: o agente chama o Worker e o editor executa as ferramentas na cena, no código, no terreno, na interface e no playtest.

## Publicar

1. Tenha o Node.js 20 ou mais novo instalado.
2. Nesta pasta, rode \`npx wrangler login\` e depois \`npx wrangler deploy\`.
3. Copie a URL que o wrangler mostra, no formato \`https://${MCP_KIT_FOLDER}.<seu-subdominio>.workers.dev\`.
4. No editor, abra o painel Assistente de IA, clique em MCP, cole a URL do Worker e ative a conexão.
5. Envie a URL do agente que o painel mostra para o agente de IA.

## Usar

- Cliente MCP (Streamable HTTP): aponte para a URL do agente.
- Agente com terminal: \`curl -s <URL do agente>\` mostra o guia, os comandos curl e o CLI.

O editor precisa estar aberto com a conexão ativa. As ferramentas aparecem para o agente depois da primeira conexão do editor.

## Segurança

A URL do agente é a credencial: quem tem a URL controla o editor enquanto a conexão estiver ativa. O botão "Gerar nova URL" do painel invalida a anterior, e o nível de acesso do painel limita o que os agentes podem alterar.

Para exigir uma segunda chave em todas as chamadas, rode \`npx wrangler secret put SECRET\` e preencha o mesmo valor no campo Segredo do painel. Os agentes passam a enviar o cabeçalho \`Authorization: Bearer <segredo>\`; no CLI, defina \`HELIX_SECRET\`.

## Ajustes

Os limites ficam em \`[vars]\` no \`wrangler.toml\`:

| Variável | Padrão | Efeito |
|---|---|---|
| CALL_TIMEOUT_MS | 45000 | Tempo que o Worker espera o editor concluir uma ferramenta |
| POLL_WAIT_MS | 25000 | Duração de cada espera do editor por novas chamadas |
| QUEUE_LIMIT | 64 | Chamadas simultâneas aceitas por sessão |
| ENGINE_WINDOW_MS | 40000 | Tempo sem contato para considerar o editor desconectado |
| FILE_TTL_MS | 900000 | Tempo de vida dos arquivos enviados e das capturas |

Depois de alterar, rode \`npx wrangler deploy\` de novo.
`;
export const KIT_STATIC_FILES: ReadonlyMap<string, string> = new Map([
    ['wrangler.toml', WRANGLER_CONFIG],
    ['package.json', `${JSON.stringify(PACKAGE_MANIFEST, null, 2)}\n`],
    ['README.md', README],
]);
