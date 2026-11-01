import { DEBUG_PARAMETER } from '../compiler/debug-instrument';
import { HelixError } from './script-errors';
const EXPLAINED_GLOBALS: Record<string, string> = {
    window: 'A janela do navegador não é acessível aos scripts. Interface: helix.gui.domRoot; tamanho da tela: helix.camera.viewport; relógio: helix.time.',
    self: 'Use helix.self para o ator deste script.',
    globalThis: 'Não há escopo global compartilhado entre scripts; exporte e importe módulos, ou use helix.events.',
    document: 'O documento do editor não é acessível. Para HTML/CSS use helix.gui.domRoot ou helix.gui.html; para desenhar, helix.gui.canvas2d.',
    frames: 'Não há frames acessíveis aos scripts.',
    parent: 'Não há janela pai acessível aos scripts.',
    top: 'Não há janela de topo acessível aos scripts.',
    opener: 'Não há janela de origem acessível aos scripts.',
    location: 'O endereço da página não é acessível. Para saber se o jogo roda no editor: helix.isEditor; fora dele: helix.play.standalone.',
    history: 'O histórico do navegador não é acessível aos scripts.',
    navigator: 'navigator não é acessível. Gamepads: helix.input.gamepads(); áudio: helix.audio; armazenamento: helix.storage.',
    localStorage: 'Use helix.storage (saves do jogo, por projeto) em vez de localStorage.',
    sessionStorage: 'Use helix.storage.session em vez de sessionStorage.',
    indexedDB: 'Use helix.storage em vez de indexedDB.',
    fetch: 'Rede direta não está disponível aos scripts. Ativos: helix.assets.import(url); dados: helix.assets.data.',
    XMLHttpRequest: 'Rede direta não está disponível aos scripts. Ativos: helix.assets.import(url).',
    WebSocket: 'Rede direta não está disponível aos scripts; a ABI de rede é helix.net.',
    Worker: 'Workers não estão disponíveis aos scripts; use helix.task.spawn para trabalho assíncrono.',
    SharedWorker: 'Workers não estão disponíveis aos scripts.',
    alert: 'alert não existe no jogo; use helix.log ou uma tela (helix.gui).',
    confirm: 'confirm não existe no jogo; monte um diálogo com helix.gui (no editor: helix.editor.dialogs.confirm).',
    prompt: 'prompt não existe no jogo; monte um campo com helix.gui (no editor: helix.editor.dialogs.prompt).',
    open: 'window.open não está disponível aos scripts.',
    close: 'window.close não está disponível aos scripts.',
    print: 'print não está disponível aos scripts.',
    postMessage: 'postMessage não está disponível; entre scripts use helix.events.',
    addEventListener: 'Ouça a entrada por helix.input e os eventos da engine por helix.events.',
    removeEventListener: 'Ouça a entrada por helix.input e os eventos da engine por helix.events.',
    dispatchEvent: 'Emita eventos com helix.events.emit.',
    screen: 'Use helix.camera.viewport para o tamanho da área de jogo.',
    customElements: 'Elementos customizados não são registrados pelos scripts.',
    caches: 'Cache HTTP não está disponível aos scripts.',
    cookieStore: 'Cookies não estão disponíveis aos scripts.',
    Notification: 'Notificações do sistema não estão disponíveis aos scripts.',
};
export const MANAGED_GLOBALS = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask'] as const;
export interface ModuleDebugHook {
    readonly l: Uint8Array;
    h(line: number, scope: () => Record<string, unknown>): void;
    s(scope: () => Record<string, unknown>): void;
}
const INERT_LINES = new Uint8Array(0);
export const INERT_DEBUG_HOOK: ModuleDebugHook = { l: INERT_LINES, h: () => undefined, s: () => undefined };
export const MODULE_PARAMETERS = ['require', 'module', 'exports', 'helix', 'console', DEBUG_PARAMETER, ...MANAGED_GLOBALS, ...Object.keys(EXPLAINED_GLOBALS)] as const;
function explained(name: string): object {
    const message = EXPLAINED_GLOBALS[name];
    const fail = (): never => {
        throw new HelixError(`${name} não está disponível nos scripts da engine. ${message}`);
    };
    const target = typeof name === 'string' && /^[a-z]/.test(name) && ['fetch', 'alert', 'confirm', 'prompt', 'open', 'close', 'print', 'postMessage', 'addEventListener', 'removeEventListener', 'dispatchEvent'].includes(name) ? fail : Object.create(null);
    return new Proxy(target as object, {
        get: (_target, property) => {
            if (property === Symbol.toPrimitive || property === 'toString' || property === 'valueOf')
                return () => `[bloqueado: ${name}]`;
            if (property === Symbol.toStringTag)
                return `Bloqueado(${name})`;
            if (property === 'then')
                return undefined;
            return fail();
        },
        set: () => fail(),
        has: () => fail(),
        apply: () => fail(),
        construct: () => fail(),
        deleteProperty: () => fail(),
        defineProperty: () => fail(),
        ownKeys: () => [],
        getOwnPropertyDescriptor: () => undefined,
    });
}
let explainedCache: object[] | null = null;
export function explainedGlobalValues(): object[] {
    if (!explainedCache)
        explainedCache = Object.keys(EXPLAINED_GLOBALS).map((name) => explained(name));
    return explainedCache;
}
export type ModuleFactory = (...args: unknown[]) => void;
export function createModuleFactory(code: string, sourceUrl: string, scriptName: string): ModuleFactory {
    const body = `${code}\n//# sourceURL=${sourceUrl}`;
    try {
        return new Function(...MODULE_PARAMETERS, body) as ModuleFactory;
    }
    catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new HelixError(`O navegador não aceitou o código compilado de ${scriptName}: ${message}`);
    }
}
