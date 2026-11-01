import { ENGINE_VERSION } from '@/engine/core/engine-info';
import { GAME_MANIFEST_FORMAT, GAME_MANIFEST_VERSION, type GameManifest, type GameNet } from '@/engine/player/game-manifest';
import { HELIX_PLAYER_ELECTRON_VERSION, buildPlatformOf, executableBaseName, gameSlug, normalizeVersion, windowSizeOf, type BuildOptions } from './build-targets';
export interface GameManifestInput {
    readonly buildId: string;
    readonly playerHash: string;
    readonly settings: Readonly<Record<string, boolean | number | string>>;
    readonly net: GameNet;
}
export function gameManifestOf(options: BuildOptions, input: GameManifestInput): GameManifest {
    return {
        format: GAME_MANIFEST_FORMAT,
        formatVersion: GAME_MANIFEST_VERSION,
        name: options.gameName.trim() || 'Jogo',
        slug: gameSlug(options.gameName),
        version: normalizeVersion(options.version),
        buildId: input.buildId,
        company: options.company.trim() || options.gameName.trim() || 'Helix Engine',
        builtAt: Date.now(),
        window: windowSizeOf(options.window),
        engine: { version: ENGINE_VERSION, player: input.playerHash, electron: HELIX_PLAYER_ELECTRON_VERSION },
        settings: input.settings,
        net: input.net,
    };
}
export function launchTargetOf(options: BuildOptions): string {
    const platform = buildPlatformOf(options.platform);
    const base = executableBaseName(options.gameName);
    if (platform.os === 'windows')
        return `${base}.exe`;
    if (platform.os === 'macos')
        return `${base}.app`;
    return gameSlug(options.gameName);
}
export function electronPackageJson(manifest: GameManifest): string {
    return JSON.stringify({ name: manifest.slug, productName: manifest.name, version: manifest.version, description: `${manifest.name} · feito com Helix Engine ${manifest.engine.version}`, main: 'main.js', private: true }, null, 2);
}
export function electronMainScript(): string {
    return `'use strict'
                                                                                
                                                                                  
                                                                                    
const { app, BrowserWindow, protocol, screen, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { Readable } = require('node:stream')
const game = require('./helix-game.json')

const WWW = path.join(__dirname, 'www')
const ORIGIN = 'helix://game'
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ktx2': 'image/ktx2',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.data': 'application/octet-stream', '.zip': 'application/zip', '.helix': 'application/octet-stream',
}

protocol.registerSchemesAsPrivileged([{ scheme: 'helix', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }])

app.setName(game.name)
app.setPath('userData', path.join(app.getPath('appData'), game.slug))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox')

function serve(request) {
  const url = new URL(request.url)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '' || pathname === '/') pathname = '/index.html'
  const file = path.normalize(path.join(WWW, pathname))
  if (!file.startsWith(WWW + path.sep)) return new Response('Proibido', { status: 403 })
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return new Response('Não encontrado', { status: 404 })
  }
  if (stat.isDirectory()) return new Response('Não encontrado', { status: 404 })
  const headers = {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  }
  let start = 0
  let end = stat.size - 1
  let status = 200
  const range = /bytes=(\\d*)-(\\d*)/.exec(request.headers.get('range') || '')
  if (range && stat.size > 0) {
    if (range[1]) start = Number(range[1])
    if (range[2]) end = Number(range[2])
    if (!range[1] && range[2]) {
      start = Math.max(stat.size - Number(range[2]), 0)
      end = stat.size - 1
    }
    if (start > end || end >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + stat.size } })
    status = 206
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size
  }
  headers['Content-Length'] = String(stat.size === 0 ? 0 : end - start + 1)
  if (request.method === 'HEAD') return new Response(null, { status, headers })
  return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status, headers })
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize
  const window = new BrowserWindow({
    width: Math.min(game.window.width, area.width),
    height: Math.min(game.window.height, area.height),
    fullscreen: game.window.fullscreen,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    title: game.name,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: process.argv.includes('--devtools'),
    },
  })
  window.removeMenu()
  window.once('ready-to-show', () => window.show())
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      window.setFullScreen(!window.isFullScreen())
      event.preventDefault()
    }
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault()
  })
  window.loadURL(ORIGIN + '/index.html')
  return window
}

app.whenReady().then(() => {
  protocol.handle('helix', serve)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => app.quit())
`;
}
export interface PlayerPageInput {
    readonly title: string;
    readonly htmlClass: string;
    readonly bodyClass: string;
    readonly colorScheme: string;
}
export function playerIndexHtml({ title, htmlClass, bodyClass, colorScheme }: PlayerPageInput): string {
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return `<!doctype html>
<html lang="pt-BR" class="${escape(htmlClass)}" style="color-scheme: ${escape(colorScheme || 'dark')}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <link rel="stylesheet" href="./player.css" />
    <style>
      html, body, #root { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
      body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; }
    </style>
  </head>
  <body class="${escape(bodyClass)}">
    <div id="root"></div>
    <script type="module" src="./player.js"></script>
  </body>
</html>
`;
}
export function itchManifest(options: BuildOptions): string {
    const platform = buildPlatformOf(options.platform);
    const target = launchTargetOf(options);
    return `[[actions]]
name = "Jogar"
path = "${target}"
${platform.os === 'linux' ? `# O app do itch marca o binário como executável ao instalar.\n` : ''}`;
}
export function readmeText(options: BuildOptions, identity: GameManifest): string {
    const platform = buildPlatformOf(options.platform);
    const target = launchTargetOf(options);
    const lines: string[] = [
        `${identity.name} ${identity.version} · ${platform.label}`,
        `Compilado pela Helix Engine ${identity.engine.version} (Helix Player ${HELIX_PLAYER_ELECTRON_VERSION}) em ${new Date(identity.builtAt).toLocaleString('pt-BR')}.`,
        '',
        'O QUE É ESTA PASTA',
        `Esta pasta inteira é o jogo. O ponto de entrada é "${target}"; os outros arquivos são o runtime`,
        'e os dados do jogo e precisam ficar ao lado dele. Envie a pasta completa para a loja, nunca só o executável.',
        'O jogo roda idêntico ao playtest da engine: mesmos gráficos, física, áudio e scripts, sem o editor.',
        identity.net.authoritative
            ? `Os scripts de servidor não estão aqui: o jogo fala com o servidor hospedado em ${identity.net.serverUrl}.`
            : 'O jogo não tem servidor autoritativo: tudo roda na máquina do jogador.',
        '',
    ];
    if (platform.os === 'windows') {
        lines.push('WINDOWS', `• O executável não está assinado. Para evitar o aviso do SmartScreen em downloads diretos, assine-o com o seu certificado:`, `  signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a "${target}"`, '• Salvamentos ficam em %APPDATA%\\' + identity.slug + '.', '');
    }
    else if (platform.os === 'macos') {
        lines.push('MACOS', `• Antes de distribuir, assine e notarize o app num Mac (obrigatório para abrir fora da Steam):`, `  codesign --force --deep --options runtime --sign "Developer ID Application: SEU NOME" "${target}"`, `  xcrun notarytool submit "${identity.slug}.zip" --keychain-profile "perfil" --wait && xcrun stapler staple "${target}"`, '• Descompacte com o Finder ou "ditto -x -k" para preservar os links simbólicos do pacote .app.', '• Salvamentos ficam em ~/Library/Application Support/' + identity.slug + '.', '');
    }
    else {
        lines.push('LINUX', `• Depois de descompactar, garanta a permissão de execução: chmod +x "${target}"`, '• O jogo roda com --no-sandbox do Chromium (padrão para distribuição em pasta, inclusive no Steam Deck).', '• Salvamentos ficam em ~/.config/' + identity.slug + '.', '');
    }
    if (options.store === 'steam') {
        lines.push('STEAM (SteamPipe)', '1. No Steamworks, crie um depot para esta plataforma e aponte o ContentRoot do script de build para esta pasta.', `2. Em "Instalação › Opções de inicialização", use "${target}" como executável${platform.os === 'macos' ? ' (o .app inteiro)' : ''}.`, options.steamAppId.trim() ? `3. O steam_appid.txt com o App ID ${options.steamAppId.trim()} está incluído para testes locais fora do cliente Steam.` : '3. Informe o App ID na próxima compilação para incluir o steam_appid.txt.', '4. O overlay da Steam funciona com o Helix Player; mantenha a aceleração por GPU ligada no depot.', '');
    }
    else if (options.store === 'itch') {
        lines.push('ITCH.IO (butler)', `1. butler push "<esta pasta>" seu-usuario/${identity.slug}:${platform.os}-${platform.arch} --userversion ${identity.version}`, '2. O .itch.toml incluído diz ao app do itch qual arquivo abrir.', '');
    }
    else {
        lines.push('DISTRIBUIÇÃO DIRETA', '• Compacte esta pasta (ou use o zip entregue) e publique onde quiser; o jogador descompacta e abre o executável.', '');
    }
    lines.push('RUNTIME', '• O Helix Player é baseado no Electron ' + HELIX_PLAYER_ELECTRON_VERSION + ' (licença MIT; as licenças do Chromium estão em LICENSES.chromium.html).', '• Abra com --devtools para inspecionar o console do jogo durante testes.', '• Alterne tela cheia com F11 ou Alt+Enter.');
    return lines.join('\n') + '\n';
}
