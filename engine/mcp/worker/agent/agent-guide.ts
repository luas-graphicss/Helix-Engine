import type { SessionOverview } from '@/engine/mcp/worker/session/session-overview';
const CONNECT_HINT = 'ask the user to open the game in the Helix editor and switch on the MCP connection in the Assistant panel';
const WORKFLOW = 'Workflow: get_project_overview -> list_scene or list_scripts -> change the game -> compile_scripts -> control_playtest action=play -> read_console.';
const EXTERNAL_ASSETS = 'External assets: list_asset_sources shows the libraries of models, textures, HDRIs, audio and images that the user allowed, search_assets returns the results with a sheet of thumbnails, inspect_asset lists formats and sizes, and insert_asset puts the chosen one in the game.';
const FAILURE_RULE = 'A failure that says "Nothing was executed" is safe to retry. Otherwise inspect the project before repeating the call.';
export const AGENT_INSTRUCTIONS = [
    'Helix Engine MCP controls the Helix game editor open in the browser of the user: scene, scripts, terrain, interface, playtest, imports and screenshots.',
    WORKFLOW,
    'Files: upload with PUT <this URL>/files/<name>, or call fetch_file with a public https URL, then pass the returned file id to import_model, import_asset or apply_texture. capture_viewport returns a screenshot of the viewport.',
    EXTERNAL_ASSETS,
    `engine_status tells whether the editor is connected. When a call fails with ENGINE_OFFLINE, ${CONNECT_HINT}.`,
    FAILURE_RULE,
].join('\n');
function describeEditor(overview: SessionOverview): string {
    if (!overview.engineOnline)
        return `offline, ${CONNECT_HINT}`;
    return `connected, project "${overview.project ?? ''}", ${overview.toolCount} tools, access mode ${overview.accessMode ?? 'unknown'}`;
}
export function renderHelp(baseUrl: string, overview: SessionOverview): string {
    return `Helix Engine MCP - terminal access
URL: ${baseUrl}
Editor: ${describeEditor(overview)}

This address controls the Helix game editor open in the browser of the user: scene, scripts, terrain, interface, playtest, imports and screenshots.

OPTION 1 - CLI (needs only sh and curl):
  curl -fsSL ${baseUrl}/cli -o helix && chmod +x helix
  ./helix status                                          editor connection, project and queue
  ./helix tools                                           tool catalog
  ./helix schema write_script                             arguments of one tool
  ./helix call list_scene                                 run a tool
  ./helix call write_script script=Player source@player.lua    key@file reads the value from a file
  ./helix call update_entity id=12 position='[0,2,0]'     lists and objects are JSON
  ./helix upload model.glb                                send a file, prints its file id
  ./helix shot viewport.jpg                               save a screenshot of the viewport
  ./helix download <file-id> output.bin                   fetch a stored file

OPTION 2 - plain curl:
  curl -s ${baseUrl}/tools                                catalog; /tools/<name> shows the arguments
  curl -s -X POST ${baseUrl}/call/get_project_overview
  curl -s ${baseUrl}/call/write_script --data-urlencode script=Player --data-urlencode source@player.lua
  curl -s -H 'Content-Type: application/json' -d '{"ids":[12]}' ${baseUrl}/call/inspect_entities
  curl -s -T model.glb ${baseUrl}/files/model.glb         upload; the first line of the answer is the file id
  Answers are plain text. HTTP 200 means success, 4xx and 5xx carry the reason. Add ?format=json for the raw envelope.
  Send the header Idempotency-Key to make a retried call run only once, and X-Mcp-Agent to name yourself in the editor log.

OPTION 3 - MCP client (Streamable HTTP): POST ${baseUrl} with JSON-RPC.

${WORKFLOW}
${EXTERNAL_ASSETS}
${FAILURE_RULE}
`;
}
export function renderRootHelp(origin: string): string {
    return `Helix Engine MCP Worker
The Helix editor shows the full agent address in the Assistant panel, under MCP. It has the form ${origin}/mcp/<session>/<token>.
GET that address for the terminal guide, or POST JSON-RPC to it from an MCP client.
`;
}
