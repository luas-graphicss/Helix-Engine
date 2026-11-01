import { watStrings, type WatString } from '@/engine/scripting/script-templates';
import type { GameSources } from '../types';
export function watGame(): GameSources {
    return { entry: entryModule(), actor: actorModule(), module: utilModule() };
}
function refs<K extends string>(at: Readonly<Record<K, WatString>>): Record<K, string> {
    const out = {} as Record<K, string>;
    for (const key of Object.keys(at) as K[])
        out[key] = `(i32.const ${at[key].offset}) (i32.const ${at[key].length})`;
    return out;
}
function stringTable(offset: number, entries: readonly WatString[], label: string): string {
    const bytes: number[] = [];
    for (const entry of entries) {
        for (const value of [entry.offset, entry.length])
            bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    }
    return `(data (i32.const ${offset}) "${bytes.map((byte) => `\\${byte.toString(16).padStart(2, '0')}`).join('')}") ;; ${label}: ${entries.length} pares (deslocamento, tamanho)`;
}
function align(value: number, to: number): number {
    return Math.ceil(value / to) * to;
}
interface Scratch {
    readonly args: number;
    readonly digEnd: number;
    readonly buf: number;
    readonly bufEnd: number;
}
function scratch(start: number, bufSize: number): Scratch {
    const args = align(start, 16);
    const dig = args + 32;
    const digEnd = dig + 16;
    return { args, digEnd, buf: digEnd, bufEnd: digEnd + bufSize };
}
const IMPORTS = [
    '(import "helix" "root" (func $hx_root (result i32)))',
    '(import "helix" "self" (func $hx_self (result i32)))',
    '(import "helix" "script" (func $hx_script (result i32)))',
    '(import "helix" "require" (func $hx_require (param i32 i32) (result i32)))',
    '(import "helix" "retain" (func $hx_retain (param i32) (result i32)))',
    '(import "helix" "release" (func $hx_release (param i32)))',
    '(import "helix" "type" (func $hx_type (param i32) (result i32)))',
    '(import "helix" "equals" (func $hx_equals (param i32 i32) (result i32)))',
    '(import "helix" "number" (func $hx_number (param f64) (result i32)))',
    '(import "helix" "boolean" (func $hx_boolean (param i32) (result i32)))',
    '(import "helix" "string" (func $hx_string (param i32 i32) (result i32)))',
    '(import "helix" "array" (func $hx_array (result i32)))',
    '(import "helix" "object" (func $hx_object (result i32)))',
    '(import "helix" "callback" (func $hx_callback (param i32) (result i32)))',
    '(import "helix" "to_number" (func $hx_to_number (param i32) (result f64)))',
    '(import "helix" "to_boolean" (func $hx_to_boolean (param i32) (result i32)))',
    '(import "helix" "string_read" (func $hx_string_read (param i32 i32 i32) (result i32)))',
    '(import "helix" "get" (func $hx_get (param i32 i32 i32) (result i32)))',
    '(import "helix" "index" (func $hx_index (param i32 i32) (result i32)))',
    '(import "helix" "set" (func $hx_set (param i32 i32 i32 i32)))',
    '(import "helix" "set_index" (func $hx_set_index (param i32 i32 i32)))',
    '(import "helix" "length" (func $hx_length (param i32) (result i32)))',
    '(import "helix" "call" (func $hx_call (param i32 i32 i32) (result i32)))',
    '(import "helix" "invoke" (func $hx_invoke (param i32 i32 i32 i32 i32) (result i32)))',
    '(import "helix" "log" (func $hx_log (param i32 i32 i32)))',
    '(import "helix" "throw" (func $hx_throw (param i32 i32)))',
    '(import "helix" "now" (func $hx_now (result f64)))',
];
function helpers(mem: Scratch, $: {
    readonly x: string;
    readonly y: string;
    readonly z: string;
}): string {
    return `  ;; --- Atalhos sobre a ABI ----------------------------------------------------------------
  ;; Tipos de hx_type: 0 undefined, 1 null, 2 bool, 3 número, 4 texto, 5 lista, 6 objeto, 7 função.
  (func $str (param $p i32) (param $n i32) (result i32) (call $hx_string (local.get $p) (local.get $n)))
  (func $num (param $v f64) (result i32) (call $hx_number (local.get $v)))
  (func $api (param $p i32) (param $n i32) (result i32) (call $hx_get (call $hx_root) (local.get $p) (local.get $n)))
  (func $nenhum (param $v i32) (result i32) (i32.le_u (call $hx_type (local.get $v)) (i32.const 1)))
  (func $texto (param $v i32) (result i32) (i32.eq (call $hx_type (local.get $v)) (i32.const 4)))
  (func $verdadeiro (param $v i32) (result i32) (i32.and (i32.eq (call $hx_type (local.get $v)) (i32.const 2)) (call $hx_to_boolean (local.get $v))))
  (func $falso (param $v i32) (result i32) (i32.and (i32.eq (call $hx_type (local.get $v)) (i32.const 2)) (i32.eqz (call $hx_to_boolean (local.get $v)))))
  (func $numero (param $o i32) (param $p i32) (param $n i32) (result f64) (call $hx_to_number (call $hx_get (local.get $o) (local.get $p) (local.get $n))))
  (func $aprox (param $a f64) (param $b f64) (param $e f64) (result i32) (f64.le (f64.abs (f64.sub (local.get $a) (local.get $b))) (local.get $e)))
  ;; valor === "texto": a igualdade da engine compara strings por conteúdo.
  (func $igual (param $v i32) (param $p i32) (param $n i32) (result i32) (call $hx_equals (local.get $v) (call $str (local.get $p) (local.get $n))))
  (func $vec3 (param $x f64) (param $y f64) (param $z f64) (result i32)
    (local $o i32)
    (local.set $o (call $hx_object))
    (call $hx_set (local.get $o) ${$.x} (call $num (local.get $x)))
    (call $hx_set (local.get $o) ${$.y} (call $num (local.get $y)))
    (call $hx_set (local.get $o) ${$.z} (call $num (local.get $z)))
    (local.get $o))
  (func $lista1 (param $v i32) (result i32)
    (local $a i32)
    (local.set $a (call $hx_array))
    (call $hx_set_index (local.get $a) (i32.const 0) (local.get $v))
    (local.get $a))
  (func $set_num (param $o i32) (param $p i32) (param $n i32) (param $v f64) (call $hx_set (local.get $o) (local.get $p) (local.get $n) (call $num (local.get $v))))
  (func $set_str (param $o i32) (param $p i32) (param $n i32) (param $vp i32) (param $vn i32) (call $hx_set (local.get $o) (local.get $p) (local.get $n) (call $str (local.get $vp) (local.get $vn))))
  (func $set_bool (param $o i32) (param $p i32) (param $n i32) (param $v i32) (call $hx_set (local.get $o) (local.get $p) (local.get $n) (call $hx_boolean (local.get $v))))
  ;; objeto.metodo(args…): a lista de handles vive em ARGS e a engine a lê antes de o método rodar.
  (func $invoke0 (param $o i32) (param $p i32) (param $n i32) (result i32)
    (call $hx_invoke (local.get $o) (local.get $p) (local.get $n) (i32.const ${mem.args}) (i32.const 0)))
  (func $invoke1 (param $o i32) (param $p i32) (param $n i32) (param $a i32) (result i32)
    (i32.store (i32.const ${mem.args}) (local.get $a))
    (call $hx_invoke (local.get $o) (local.get $p) (local.get $n) (i32.const ${mem.args}) (i32.const 1)))
  (func $invoke2 (param $o i32) (param $p i32) (param $n i32) (param $a i32) (param $b i32) (result i32)
    (i32.store (i32.const ${mem.args}) (local.get $a))
    (i32.store offset=4 (i32.const ${mem.args}) (local.get $b))
    (call $hx_invoke (local.get $o) (local.get $p) (local.get $n) (i32.const ${mem.args}) (i32.const 2)))
  (func $invoke3 (param $o i32) (param $p i32) (param $n i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    (i32.store (i32.const ${mem.args}) (local.get $a))
    (i32.store offset=4 (i32.const ${mem.args}) (local.get $b))
    (i32.store offset=8 (i32.const ${mem.args}) (local.get $c))
    (call $hx_invoke (local.get $o) (local.get $p) (local.get $n) (i32.const ${mem.args}) (i32.const 3)))
  ;; Montagem de mensagens em BUF: cada função copia bytes e devolve o próximo endereço livre.
  (func $anexar (param $dst i32) (param $p i32) (param $n i32) (result i32)
    (memory.copy (local.get $dst) (local.get $p) (local.get $n))
    (i32.add (local.get $dst) (local.get $n)))
  (func $anexar_valor (param $dst i32) (param $v i32) (result i32)
    (local $cap i32) (local $n i32)
    (local.set $cap (i32.sub (i32.const ${mem.bufEnd}) (local.get $dst)))
    (local.set $n (call $hx_string_read (local.get $v) (local.get $dst) (local.get $cap)))
    (if (i32.gt_u (local.get $n) (local.get $cap)) (then (local.set $n (local.get $cap))))
    (i32.add (local.get $dst) (local.get $n)))
  (func $anexar_int (param $dst i32) (param $v i32) (result i32)
    (local $fim i32) (local $n i32)
    (local.set $fim (i32.const ${mem.digEnd}))
    (loop $digitos
      (local.set $fim (i32.sub (local.get $fim) (i32.const 1)))
      (i32.store8 (local.get $fim) (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
      (local.set $v (i32.div_u (local.get $v) (i32.const 10)))
      (br_if $digitos (local.get $v)))
    (local.set $n (i32.sub (i32.const ${mem.digEnd}) (local.get $fim)))
    (memory.copy (local.get $dst) (local.get $fim) (local.get $n))
    (i32.add (local.get $dst) (local.get $n)))
  (func $log_buf (param $nivel i32) (param $fim i32)
    (call $hx_log (local.get $nivel) (i32.const ${mem.buf}) (i32.sub (local.get $fim) (i32.const ${mem.buf}))))
`;
}
const AREA_KEYS = ['area1', 'area2', 'area3', 'area4', 'area5', 'area6', 'area7', 'area8', 'area9', 'area10', 'area11', 'area12', 'area13'] as const;
const CB = { teclar: 301, acaoCaixa: 302, acaoReiniciar: 303, ping: 304, finalizar: 305, colisao: 306, dadosProntos: 307, dadosGravados: 308, visita: 309 } as const;
function entryModule(): string {
    const strings = watStrings({
        area1: 'Núcleo',
        area2: 'Módulo (require)',
        area3: 'Matemática',
        area4: 'Cena',
        area5: 'Transformações',
        area6: 'Luzes e céu',
        area7: 'Câmera e pós',
        area8: 'Física',
        area9: 'Personagem e jogador',
        area10: 'Interface',
        area11: 'Entrada e eventos',
        area12: 'Tempo e dados',
        area13: 'Erro proposital (throw)',
        engine: 'engine', name: 'name', version: 'version', context: 'context', shared: 'shared', client: 'client', server: 'server', isPlaying: 'isPlaying', isEditor: 'isEditor', self: 'self',
        DebugUtil: 'DebugUtil', soma: 'soma', saudacao: 'saudacao', limitar: 'limitar', Helix: 'Helix', olaHelix: 'Olá, Helix',
        math: 'math', vec3: 'vec3', add: 'add', equals: 'equals', length: 'length', clamp: 'clamp', lerp: 'lerp', scalar: 'scalar', wrapAngle: 'wrapAngle', random: 'random', int: 'int', range: 'range', color: 'color', hsl: 'hsl', TAU: 'TAU', PI: 'PI',
        scene: 'scene', root: 'root', children: 'children', count: 'count', spawn: 'spawn', group: 'group', DebugCenario: 'DebugCenario', Chao: 'Chao', mesh: 'mesh', plane: 'plane', material: 'material', create: 'create', baseColor: 'baseColor', verde: '#4b6b3a', roughness: 'roughness', type: 'type', static: 'static', collider: 'collider', box: 'box', boxSize: 'boxSize', center: 'center', rigidBody: 'rigidBody', receiveShadows: 'receiveShadows', tags: 'tags', chao: 'chao', kind: 'kind', find: 'find', findAll: 'findAll', byTag: 'byTag', contains: 'contains', traverse: 'traverse', spawnPrimitive: 'spawnPrimitive', torus: 'torus', Anel: 'Anel', position: 'position', scale: 'scale', setColor: 'setColor', setEmissive: 'setEmissive', azul: '#3a86ff', path: 'path', clone: 'clone', rename: 'rename', AnelCopia: 'AnelCopia', destroy: 'destroy',
        transform: 'transform', cone: 'cone', Cone: 'Cone', roxo: '#8338ec', setPosition: 'setPosition', translate: 'translate', world: 'world', setRotation: 'setRotation', rotation: 'rotation', setScale: 'setScale', distance: 'distance', worldMatrix: 'worldMatrix', x: 'x', y: 'y', z: 'z',
        light: 'light', point: 'point', Lampada: 'Lampada', amarelo: '#ffd166', intensity: 'intensity', set: 'set', types: 'types', effectiveRange: 'effectiveRange', sky: 'sky', timeOfDay: 'timeOfDay', isDay: 'isDay', cycleSpeed: 'cycleSpeed', gravity: 'gravity',
        camera: 'camera', fov: 'fov', aspect: 'aspect', viewMatrix: 'viewMatrix', player: 'player', pitch: 'pitch', settings: 'settings', distanceTo: 'distanceTo', post: 'post', bloom: 'bloom', enabled: 'enabled', exposure: 'exposure', toneMapper: 'toneMapper', agx: 'agx', render: 'render', stats: 'stats', drawCalls: 'drawCalls',
        physics: 'physics', Caixa: 'Caixa', dynamic: 'dynamic', mass: 'mass', restitution: 'restitution', caixa: 'caixa', hasBody: 'hasBody', bodyOf: 'bodyOf', isDynamic: 'isDynamic', raycast: 'raycast', bodies: 'bodies', onCollisionBegin: 'onCollisionBegin', a: 'a', b: 'b',
        character: 'character', Heroi: 'Heroi', walkSpeed: 'walkSpeed', runSpeed: 'runSpeed', jumpHeight: 'jumpHeight', has: 'has', settingsOf: 'settingsOf', possess: 'possess', possessed: 'possessed', isPossessing: 'isPossessing', all: 'all',
        gui: 'gui', css: 'css', DebugEstilo: 'DebugEstilo', html: 'html', DebugHud: 'DebugHud', id: 'id', debugHud: 'debug-hud', seletorHud: '#debug-hud', svg: 'svg', DebugIcone: 'DebugIcone', debugIcone: 'debug-icone', element: 'element', seletorSlot: '[data-slot=icone]', appendChild: 'appendChild', bind: 'bind', linguagem: 'linguagem', WAT: 'WAT', titulo: 'titulo', tituloTexto: 'Helix · Debug', onAction: 'onAction', reiniciar: 'reiniciar', elements: 'elements', seletorBind: '[data-bind]', size: 'size', width: 'width', pontos: 'pontos', fps: 'fps', checagens: 'checagens', falhas: 'falhas', atores: 'atores',
        input: 'input', isDown: 'isDown', KeyW: 'KeyW', pointer: 'pointer', onKeyDown: 'onKeyDown', events: 'events', on: 'on', debugPing: 'debug.ping', origem: 'origem', teste: 'teste', teclado: 'teclado', emit: 'emit', listenerCount: 'listenerCount', debugCaixa: 'debug.caixa', nome: 'nome',
        time: 'time', now: 'now', frame: 'frame', fixedDelta: 'fixedDelta', wait: 'wait', then: 'then', assets: 'assets', exists: 'exists', NaoExiste: 'NaoExiste', search: 'search', Debug: 'Debug', project: 'project', play: 'play', state: 'state', playing: 'playing', storage: 'storage', ready: 'ready', get: 'get', execucoes: 'execucoes', restart: 'restart', shake: 'shake', byName: 'byName', DebugGirador: 'DebugGirador', script: 'script', GiradorDinamico: 'GiradorDinamico', kinematic: 'kinematic', assetId: 'assetId', props: 'props', velocidade: 'velocidade', cor: 'cor', ciano: '#00b4d8', CaixaSolta: 'CaixaSolta',
        debug: 'debug', line: 'line', rosa: '#ff006e', rotate: 'rotate', axes: 'axes', text: 'text', branco: '#ffffff', worldPosition: 'worldPosition',
        code: 'code', repeat: 'repeat', KeyR: 'KeyR', KeyB: 'KeyB', KeyE: 'KeyE', KeyF: 'KeyF', KeyT: 'KeyT',
        message: 'message', proposital: 'proposital', erroProposital: 'erro proposital: throw interrompe a área e vira ERRO na cadeia',
        falhou: 'FALHOU ', erroEm: 'ERRO em ', doisPontos: ': ', okPrefixo: 'ok ', espaco: ' ',
        inicio: 'Jogo de teste em WebAssembly (texto): percorrendo a API…',
        onLoadMsg: 'onLoad do script de entrada',
        sufixoLinguagem: ' · WebAssembly (texto), direto pela ABI helix.*',
        resumoInicio: 'API percorrida em WebAssembly (texto): ', resumoChecagens: ' checagens, ', resumoFalhas: ' falhas. ',
        dica: 'WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, T câmera lenta, R reinicia.',
        parou: 'Parou: ', quadrosTxt: ' quadros, ', passosTxt: ' passos de física, ', lateTxt: ' lateUpdates, ', colisoesTxt: ' colisões.',
        execucaoTxt: 'Execução nº ', execucaoFim: ' deste jogo de teste neste projeto.',
        pingDe: 'ping de ', colisao: 'Colisão: ', vezes: ' × ', heroiRotulo: 'Heroi · ', pts: ' pts',
        cEngineName: 'engine.name', cEngineVersion: 'engine.version', cContext: 'context', cIsPlaying: 'isPlaying', cIsEditor: 'isEditor', cSelfEntrada: 'self no script de entrada', cScript: 'script é o handle do script', cNow: 'helix.now',
        cRequire: 'require devolve as funções', cRequireSoma: 'require soma', cRequireSaudacao: 'require saudacao', cRequireLimitar: 'require limitar',
        cVec3Add: 'vec3.add', cVec3Length: 'vec3.length', cClampLerp: 'clamp/lerp', cWrapAngle: 'scalar.wrapAngle', cRandomInt: 'random.int', cPiTau: 'PI/TAU',
        cSceneRoot: 'scene.root', cSpawnMesh: 'spawn mesh', cFind: 'find', cFindAll: 'findAll', cByTag: 'byTag', cCount: 'count', cContains: 'contains', cTraverse: 'traverse', cSpawnPrimitive: 'spawnPrimitive', cPath: 'path', cCloneRename: 'clone + rename', cDestroy: 'destroy',
        cSetPosition: 'setPosition', cTranslate: 'translate', cSetRotation: 'setRotation', cSetScale: 'setScale', cDistance: 'distance', cWorldMatrix: 'worldMatrix',
        cLightSpawn: 'light.spawn', cLightSet: 'light.set', cLightTypes: 'light.types', cEffectiveRange: 'effectiveRange', cSkySet: 'sky.set', cSkyIsDay: 'sky.isDay', cCycleSpeed: 'sky.cycleSpeed', cWorldGravity: 'world.gravity',
        cCameraFov: 'camera.fov', cViewMatrix: 'viewMatrix', cPlayerSet: 'player.set', cDistanceTo: 'distanceTo', cPostSet: 'post.set', cPostExposure: 'post.exposure', cToneMapper: 'post.toneMapper', cRenderStats: 'render.stats',
        cPhysicsEnabled: 'physics.enabled', cPhysicsGravity: 'physics.gravity', cCaixas: 'caixas dinâmicas', cBodyOf: 'bodyOf', cRaycast: 'physics.raycast', cBodies: 'bodies()',
        cCharacterSpawn: 'character.spawn', cSettingsOf: 'settingsOf', cPossess: 'player.possess', cCharacterAll: 'character.all',
        cGuiHtml: 'gui.html', cGuiSvg: 'gui.svg', cGuiBind: 'gui.bind', cGuiElements: 'gui.elements', cGuiSize: 'gui.size',
        cIsDown: 'isDown', cPointer: 'pointer', cEmit: 'events.emit conta ouvintes', cOnRecebe: 'events.on recebe', cListenerCount: 'listenerCount', cUnsubscribe: 'unsubscribe',
        cTimeNow: 'time.now', cTimeDelta: 'time.fixedDelta', cAssetsExists: 'assets.exists', cAssetsSearch: 'assets.search', cProjectName: 'project.name', cPlayState: 'play.state', cStorage: 'storage.get/set',
        cRejeicaoDeveria: 'a rejeição deveria ter chegado à cadeia', cRejeicaoChega: 'throw chega como rejeição da promessa', cAtivoGirador: 'ativo DebugGirador', cSpawnComScript: 'spawn com script', cFixedUpdate: 'onFixedUpdate recebe o passo',
    });
    const $ = refs(strings.at);
    const areas = AREA_KEYS.map((key) => strings.at[key]);
    const N = areas.length;
    const ID_ERRO = N;
    const TABLE = strings.next;
    const mem = scratch(TABLE + N * 8, 1024);
    const SUBS = mem.bufEnd;
    const SUBS_MAX = 16;
    const BUF = mem.buf;
    return `;; DebugJogo · Jogo de teste da API
`;
}
