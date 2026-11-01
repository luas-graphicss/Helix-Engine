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
;; Helix Engine — modo debug, em WebAssembly textual. Cada área da API roda como um passo de uma
;; cadeia de promessas (time.wait(0).then(área).then(ok, erro)): o que falhar vai ao console como
;; FALHOU/ERRO sem derrubar as outras. Controles na HUD.
;; A engine inteira chega pelas importações helix.* (a ABI de helix.h): valores são handles (i32),
;; textos vivem na memória e cada callback é um id despachado por __hx_invoke_callback.
(module
  (@helix.require "DebugUtil")
${IMPORTS.map((line) => `  ${line}`).join('\n')}

  (memory (export "memory") 1)
${strings.data.map((line) => `  ${line}`).join('\n')}
  ${stringTable(TABLE, areas, 'nomes das áreas')}

  ;; Contadores e handles retidos (soltos em onStop).
  (global $quadros (mut i32) (i32.const 0))
  (global $passos (mut i32) (i32.const 0))
  (global $late (mut i32) (i32.const 0))
  (global $colisoes (mut i32) (i32.const 0))
  (global $checagens (mut i32) (i32.const 0))
  (global $falhas (mut i32) (i32.const 0))
  (global $pontos (mut i32) (i32.const 0))
  (global $pings (mut i32) (i32.const 0))
  (global $visitados (mut i32) (i32.const 0))
  (global $assinaturas (mut i32) (i32.const 0))
  (global $hud (mut f64) (f64.const 0))
  (global $execucoes (mut f64) (f64.const 0))
  (global $torus (mut i32) (i32.const 0))
  (global $heroi (mut i32) (i32.const 0))

${helpers(mem, $)}
  ;; --- Checagens e assinaturas ----------------------------------------------------------------
  ;; FALHOU <nome> no console (nível 3 = erro) quando a condição é falsa.
  (func $checar (param $p i32) (param $n i32) (param $cond i32)
    (local $fim i32)
    (global.set $checagens (i32.add (global.get $checagens) (i32.const 1)))
    (if (local.get $cond) (then (return)))
    (global.set $falhas (i32.add (global.get $falhas) (i32.const 1)))
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.falhou}))
    (local.set $fim (call $anexar (local.get $fim) (local.get $p) (local.get $n)))
    (call $log_buf (i32.const 3) (local.get $fim)))
  ;; Guarda (retida) a função de desligar devolvida por um on*; onStop chama todas.
  (func $assinar (param $f i32)
    (if (i32.ne (call $hx_type (local.get $f)) (i32.const 7)) (then (return)))
    (if (i32.ge_u (global.get $assinaturas) (i32.const ${SUBS_MAX})) (then (return)))
    (i32.store (i32.add (i32.const ${SUBS}) (i32.shl (global.get $assinaturas) (i32.const 2))) (call $hx_retain (local.get $f)))
    (global.set $assinaturas (i32.add (global.get $assinaturas) (i32.const 1))))
  (func $desligar_tudo
    (local $i i32) (local $f i32)
    (block $fim
      (loop $cada
        (br_if $fim (i32.ge_u (local.get $i) (global.get $assinaturas)))
        (local.set $f (i32.load (i32.add (i32.const ${SUBS}) (i32.shl (local.get $i) (i32.const 2)))))
        (drop (call $hx_call (local.get $f) (i32.const ${mem.args}) (i32.const 0)))
        (call $hx_release (local.get $f))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $cada)))
    (global.set $assinaturas (i32.const 0)))
  ;; Procura "agulha" dentro de BUF[p..p+n).
  (func $contem (param $p i32) (param $n i32) (param $ap i32) (param $an i32) (result i32)
    (local $i i32) (local $j i32)
    (if (i32.gt_u (local.get $an) (local.get $n)) (then (return (i32.const 0))))
    (block $fora
      (loop $posicoes
        (br_if $fora (i32.gt_u (i32.add (local.get $i) (local.get $an)) (local.get $n)))
        (local.set $j (i32.const 0))
        (block $difere
          (loop $bytes
            (br_if $difere (i32.ne
              (i32.load8_u (i32.add (local.get $p) (i32.add (local.get $i) (local.get $j))))
              (i32.load8_u (i32.add (local.get $ap) (local.get $j)))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br_if $bytes (i32.lt_u (local.get $j) (local.get $an))))
          (return (i32.const 1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $posicoes)))
    (i32.const 0))
  (func $nome_ptr (param $i i32) (result i32) (i32.load (i32.add (i32.const ${TABLE - 8}) (i32.shl (local.get $i) (i32.const 3)))))
  (func $nome_len (param $i i32) (result i32) (i32.load offset=4 (i32.add (i32.const ${TABLE - 8}) (i32.shl (local.get $i) (i32.const 3)))))

  ;; --- 1. Núcleo e módulo -----------------------------------------------------------------------
  (func $nucleo (result i32)
    (local $engine i32) (local $nome i32) (local $contexto i32) (local $fim i32)
    (local.set $engine (call $api ${$.engine}))
    (local.set $nome (call $hx_get (local.get $engine) ${$.name}))
    (local.set $contexto (call $hx_get (call $hx_root) ${$.context}))
    (call $checar ${$.cEngineName} (i32.and (call $texto (local.get $nome)) (i32.gt_u (call $hx_length (local.get $nome)) (i32.const 0))))
    (call $checar ${$.cEngineVersion} (call $texto (call $hx_get (local.get $engine) ${$.version})))
    (call $checar ${$.cContext} (i32.or (call $igual (local.get $contexto) ${$.shared}) (i32.or (call $igual (local.get $contexto) ${$.client}) (call $igual (local.get $contexto) ${$.server}))))
    (call $checar ${$.cIsPlaying} (call $verdadeiro (call $hx_get (call $hx_root) ${$.isPlaying})))
    (call $checar ${$.cIsEditor} (call $falso (call $hx_get (call $hx_root) ${$.isEditor})))
    (call $checar ${$.cSelfEntrada} (i32.and (call $nenhum (call $hx_self)) (call $nenhum (call $hx_get (call $hx_root) ${$.self}))))
    (call $checar ${$.cScript} (i32.eq (call $hx_type (call $hx_script)) (i32.const 6)))
    (call $checar ${$.cNow} (f64.ge (call $hx_now) (f64.const 0)))
    ;; "<engine.name> <engine.version> · WebAssembly (texto), direto pela ABI helix.*"
    (local.set $fim (call $anexar_valor (i32.const ${BUF}) (local.get $nome)))
    (local.set $fim (call $anexar (local.get $fim) ${$.espaco}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $hx_get (local.get $engine) ${$.version})))
    (local.set $fim (call $anexar (local.get $fim) ${$.sufixoLinguagem}))
    (call $log_buf (i32.const 1) (local.get $fim))
    (i32.const 0))

  (func $modulo (result i32)
    (local $util i32)
    (local.set $util (call $hx_require ${$.DebugUtil}))
    (call $checar ${$.cRequire} (i32.and (i32.eq (call $hx_type (local.get $util)) (i32.const 6)) (i32.eq (call $hx_type (call $hx_get (local.get $util) ${$.soma})) (i32.const 7))))
    (call $checar ${$.cRequireSoma} (f64.eq (call $hx_to_number (call $invoke2 (local.get $util) ${$.soma} (call $num (f64.const 2)) (call $num (f64.const 3)))) (f64.const 5)))
    (call $checar ${$.cRequireSaudacao} (call $igual (call $invoke1 (local.get $util) ${$.saudacao} (call $str ${$.Helix})) ${$.olaHelix}))
    (call $checar ${$.cRequireLimitar} (f64.eq (call $hx_to_number (call $invoke3 (local.get $util) ${$.limitar} (call $num (f64.const 15)) (call $num (f64.const 0)) (call $num (f64.const 10)))) (f64.const 10)))
    (i32.const 0))

  (func $matematica (result i32)
    (local $m i32) (local $vec i32) (local $sorteado f64)
    (local.set $m (call $api ${$.math}))
    (local.set $vec (call $hx_get (local.get $m) ${$.vec3}))
    (call $checar ${$.cVec3Add} (call $hx_to_boolean (call $invoke3 (local.get $vec) ${$.equals}
      (call $invoke2 (local.get $vec) ${$.add} (call $vec3 (f64.const 1) (f64.const 2) (f64.const 3)) (call $vec3 (f64.const 1) (f64.const 1) (f64.const 1)))
      (call $vec3 (f64.const 2) (f64.const 3) (f64.const 4))
      (call $num (f64.const 1e-6)))))
    (call $checar ${$.cVec3Length} (call $aprox (call $hx_to_number (call $invoke1 (local.get $vec) ${$.length} (call $vec3 (f64.const 3) (f64.const 4) (f64.const 0)))) (f64.const 5) (f64.const 1e-3)))
    (call $checar ${$.cClampLerp} (i32.and
      (f64.eq (call $hx_to_number (call $invoke3 (local.get $m) ${$.clamp} (call $num (f64.const 15)) (call $num (f64.const 0)) (call $num (f64.const 10)))) (f64.const 10))
      (f64.eq (call $hx_to_number (call $invoke3 (local.get $m) ${$.lerp} (call $num (f64.const 0)) (call $num (f64.const 10)) (call $num (f64.const 0.5)))) (f64.const 5))))
    (call $checar ${$.cWrapAngle} (call $aprox (call $hx_to_number (call $invoke1 (call $hx_get (local.get $m) ${$.scalar}) ${$.wrapAngle} (call $num (f64.const 370)))) (f64.const 10) (f64.const 1e-3)))
    (local.set $sorteado (call $hx_to_number (call $invoke2 (call $hx_get (local.get $m) ${$.random}) ${$.int} (call $num (f64.const 1)) (call $num (f64.const 6)))))
    (call $checar ${$.cRandomInt} (i32.and (i32.and (f64.ge (local.get $sorteado) (f64.const 1)) (f64.le (local.get $sorteado) (f64.const 6))) (f64.eq (f64.floor (local.get $sorteado)) (local.get $sorteado))))
    (call $checar ${$.cPiTau} (call $aprox (call $numero (local.get $m) ${$.TAU}) (f64.mul (call $numero (local.get $m) ${$.PI}) (f64.const 2)) (f64.const 1e-9)))
    (i32.const 0))

  ;; --- 2. Cena e transformações -----------------------------------------------------------------
  (func $cena (result i32)
    (local $s i32) (local $mat i32) (local $antes f64) (local $grupo i32) (local $opcoes i32) (local $corpo i32) (local $chao i32) (local $anel i32) (local $copia i32)
    (local.set $s (call $api ${$.scene}))
    (local.set $mat (call $api ${$.material}))
    (call $checar ${$.cSceneRoot} (i32.eq (call $hx_type (call $hx_get (call $hx_get (local.get $s) ${$.root}) ${$.children})) (i32.const 5)))
    (local.set $antes (call $hx_to_number (call $invoke0 (local.get $s) ${$.count})))
    ;; grupo = scene.spawn("group", { name: "DebugCenario" })
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.DebugCenario})
    (local.set $grupo (call $invoke2 (local.get $s) ${$.spawn} (call $str ${$.group}) (local.get $opcoes)))
    ;; chao = scene.spawn("mesh", { name, mesh: mesh.plane(40, 40), material: material.create({…}), rigidBody: {…}, receiveShadows: true, tags: ["chao"] }, grupo)
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.Chao})
    (call $hx_set (local.get $opcoes) ${$.mesh} (call $invoke2 (call $api ${$.mesh}) ${$.plane} (call $num (f64.const 40)) (call $num (f64.const 40))))
    (local.set $corpo (call $hx_object))
    (call $set_str (local.get $corpo) ${$.baseColor} ${$.verde})
    (call $set_num (local.get $corpo) ${$.roughness} (f64.const 0.95))
    (call $hx_set (local.get $opcoes) ${$.material} (call $invoke1 (local.get $mat) ${$.create} (local.get $corpo)))
    (local.set $corpo (call $hx_object))
    (call $set_str (local.get $corpo) ${$.type} ${$.static})
    (call $set_str (local.get $corpo) ${$.collider} ${$.box})
    (call $hx_set (local.get $corpo) ${$.boxSize} (call $vec3 (f64.const 40) (f64.const 0.2) (f64.const 40)))
    (call $hx_set (local.get $corpo) ${$.center} (call $vec3 (f64.const 0) (f64.const -0.1) (f64.const 0)))
    (call $hx_set (local.get $opcoes) ${$.rigidBody} (local.get $corpo))
    (call $set_bool (local.get $opcoes) ${$.receiveShadows} (i32.const 1))
    (call $hx_set (local.get $opcoes) ${$.tags} (call $lista1 (call $str ${$.chao})))
    (local.set $chao (call $invoke3 (local.get $s) ${$.spawn} (call $str ${$.mesh}) (local.get $opcoes) (local.get $grupo)))
    (call $checar ${$.cSpawnMesh} (i32.and (call $igual (call $hx_get (local.get $chao) ${$.kind}) ${$.mesh}) (i32.eqz (call $nenhum (call $hx_get (local.get $chao) ${$.rigidBody})))))
    (call $checar ${$.cFind} (call $hx_equals (call $invoke1 (local.get $s) ${$.find} (call $str ${$.Chao})) (local.get $chao)))
    (call $checar ${$.cFindAll} (i32.eq (call $hx_length (call $invoke1 (local.get $s) ${$.findAll} (call $str ${$.Chao}))) (i32.const 1)))
    (call $checar ${$.cByTag} (i32.ge_u (call $hx_length (call $invoke1 (local.get $s) ${$.byTag} (call $str ${$.chao}))) (i32.const 1)))
    (call $checar ${$.cCount} (f64.eq (call $hx_to_number (call $invoke0 (local.get $s) ${$.count})) (f64.add (local.get $antes) (f64.const 2))))
    (call $checar ${$.cContains} (call $hx_to_boolean (call $invoke2 (local.get $s) ${$.contains} (local.get $grupo) (local.get $chao))))
    (global.set $visitados (i32.const 0))
    (drop (call $invoke2 (local.get $s) ${$.traverse} (call $hx_callback (i32.const ${CB.visita})) (local.get $grupo)))
    (call $checar ${$.cTraverse} (i32.ge_u (global.get $visitados) (i32.const 2)))
    ;; anel = scene.spawnPrimitive("torus", { name: "Anel", position, scale: 1.5 }, grupo): retido para girar a cada quadro
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.Anel})
    (call $hx_set (local.get $opcoes) ${$.position} (call $vec3 (f64.const -4) (f64.const 1.2) (f64.const -2)))
    (call $set_num (local.get $opcoes) ${$.scale} (f64.const 1.5))
    (local.set $anel (call $invoke3 (local.get $s) ${$.spawnPrimitive} (call $str ${$.torus}) (local.get $opcoes) (local.get $grupo)))
    (drop (call $invoke2 (local.get $mat) ${$.setColor} (local.get $anel) (call $str ${$.azul})))
    (drop (call $invoke3 (local.get $mat) ${$.setEmissive} (local.get $anel) (call $str ${$.azul}) (call $num (f64.const 0.6))))
    (global.set $torus (call $hx_retain (local.get $anel)))
    (call $checar ${$.cSpawnPrimitive} (i32.and (i32.eqz (call $nenhum (call $hx_get (local.get $anel) ${$.mesh}))) (i32.eqz (call $nenhum (call $hx_get (local.get $anel) ${$.material})))))
    (call $checar ${$.cPath} (call $texto (call $invoke1 (local.get $s) ${$.path} (local.get $anel))))
    ;; clone + rename + destroy
    (local.set $copia (call $invoke3 (local.get $s) ${$.clone} (local.get $anel) (call $hx_boolean (i32.const 1)) (local.get $grupo)))
    (drop (call $invoke2 (local.get $s) ${$.rename} (local.get $copia) (call $str ${$.AnelCopia})))
    (call $checar ${$.cCloneRename} (call $hx_equals (call $invoke1 (local.get $s) ${$.find} (call $str ${$.AnelCopia})) (local.get $copia)))
    (drop (call $invoke1 (local.get $s) ${$.destroy} (local.get $copia)))
    (call $checar ${$.cDestroy} (call $nenhum (call $invoke1 (local.get $s) ${$.find} (call $str ${$.AnelCopia}))))
    (i32.const 0))

  (func $transformacao (result i32)
    (local $tr i32) (local $alvo i32) (local $opcoes i32)
    (local.set $tr (call $api ${$.transform}))
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.Cone})
    (call $hx_set (local.get $opcoes) ${$.position} (call $vec3 (f64.const 0) (f64.const 0.5) (f64.const -6)))
    (local.set $alvo (call $invoke2 (call $api ${$.scene}) ${$.spawnPrimitive} (call $str ${$.cone}) (local.get $opcoes)))
    (drop (call $invoke2 (call $api ${$.material}) ${$.setColor} (local.get $alvo) (call $str ${$.roxo})))
    (drop (call $invoke2 (local.get $tr) ${$.setPosition} (local.get $alvo) (call $vec3 (f64.const 2) (f64.const 0.5) (f64.const -6))))
    (call $checar ${$.cSetPosition} (call $aprox (call $numero (call $invoke1 (local.get $tr) ${$.position} (local.get $alvo)) ${$.x}) (f64.const 2) (f64.const 1e-6)))
    (drop (call $invoke3 (local.get $tr) ${$.translate} (local.get $alvo) (call $vec3 (f64.const 0) (f64.const 1) (f64.const 0)) (call $str ${$.world})))
    (call $checar ${$.cTranslate} (call $aprox (call $numero (call $invoke1 (local.get $tr) ${$.position} (local.get $alvo)) ${$.y}) (f64.const 1.5) (f64.const 1e-3)))
    (drop (call $invoke2 (local.get $tr) ${$.setRotation} (local.get $alvo) (call $vec3 (f64.const 0) (f64.const 90) (f64.const 0))))
    (call $checar ${$.cSetRotation} (call $aprox (call $numero (call $invoke1 (local.get $tr) ${$.rotation} (local.get $alvo)) ${$.y}) (f64.const 90) (f64.const 0.01)))
    (drop (call $invoke2 (local.get $tr) ${$.setScale} (local.get $alvo) (call $num (f64.const 2))))
    (call $checar ${$.cSetScale} (call $aprox (call $numero (call $invoke1 (local.get $tr) ${$.scale} (local.get $alvo)) ${$.x}) (f64.const 2) (f64.const 1e-6)))
    (drop (call $invoke2 (local.get $tr) ${$.setScale} (local.get $alvo) (call $vec3 (f64.const 1) (f64.const 1) (f64.const 1))))
    (call $checar ${$.cDistance} (f64.lt (call $hx_to_number (call $invoke2 (local.get $tr) ${$.distance} (local.get $alvo) (call $vec3 (f64.const 2) (f64.const 1.5) (f64.const -6)))) (f64.const 0.01)))
    (call $checar ${$.cWorldMatrix} (i32.eq (call $hx_length (call $invoke1 (local.get $tr) ${$.worldMatrix} (local.get $alvo))) (i32.const 16)))
    (i32.const 0))

  ;; --- 3. Luzes, céu, câmera e pós --------------------------------------------------------------
  (func $luzes_e_ceu (result i32)
    (local $l i32) (local $sky i32) (local $opcoes i32) (local $lampada i32)
    (local.set $l (call $api ${$.light}))
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.Lampada})
    (call $hx_set (local.get $opcoes) ${$.position} (call $vec3 (f64.const 0) (f64.const 3) (f64.const 0)))
    (call $set_str (local.get $opcoes) ${$.color} ${$.amarelo})
    (call $set_num (local.get $opcoes) ${$.intensity} (f64.const 60))
    (call $set_num (local.get $opcoes) ${$.range} (f64.const 14))
    (local.set $lampada (call $invoke2 (local.get $l) ${$.spawn} (call $str ${$.point}) (local.get $opcoes)))
    (call $checar ${$.cLightSpawn} (call $igual (call $hx_get (call $hx_get (local.get $lampada) ${$.light}) ${$.type}) ${$.point}))
    (local.set $opcoes (call $hx_object))
    (call $set_num (local.get $opcoes) ${$.intensity} (f64.const 80))
    (drop (call $invoke2 (local.get $l) ${$.set} (local.get $lampada) (local.get $opcoes)))
    (call $checar ${$.cLightSet} (f64.eq (call $numero (call $hx_get (local.get $lampada) ${$.light}) ${$.intensity}) (f64.const 80)))
    (call $checar ${$.cLightTypes} (i32.gt_u (call $hx_length (call $invoke0 (local.get $l) ${$.types})) (i32.const 0)))
    (call $checar ${$.cEffectiveRange} (f64.gt (call $hx_to_number (call $invoke1 (local.get $l) ${$.effectiveRange} (local.get $lampada))) (f64.const 0)))
    ;; sky.set({ timeOfDay: 10.5 }); sky.cycleSpeed = 0
    (local.set $sky (call $api ${$.sky}))
    (local.set $opcoes (call $hx_object))
    (call $set_num (local.get $opcoes) ${$.timeOfDay} (f64.const 10.5))
    (drop (call $invoke1 (local.get $sky) ${$.set} (local.get $opcoes)))
    (call $checar ${$.cSkySet} (call $aprox (call $numero (local.get $sky) ${$.timeOfDay}) (f64.const 10.5) (f64.const 1e-3)))
    (call $checar ${$.cSkyIsDay} (call $verdadeiro (call $hx_get (local.get $sky) ${$.isDay})))
    (call $hx_set (local.get $sky) ${$.cycleSpeed} (call $num (f64.const 0)))
    (call $checar ${$.cCycleSpeed} (f64.eq (call $numero (local.get $sky) ${$.cycleSpeed}) (f64.const 0)))
    (call $checar ${$.cWorldGravity} (f64.lt (call $numero (call $hx_get (call $api ${$.world}) ${$.gravity}) ${$.y}) (f64.const 0)))
    (i32.const 0))

  (func $camera_e_pos (result i32)
    (local $c i32) (local $p i32) (local $opcoes i32) (local $bloom i32)
    (local.set $c (call $api ${$.camera}))
    (call $checar ${$.cCameraFov} (i32.and (f64.gt (call $numero (local.get $c) ${$.fov}) (f64.const 0)) (f64.gt (call $numero (local.get $c) ${$.aspect}) (f64.const 0))))
    (call $checar ${$.cViewMatrix} (i32.eq (call $hx_length (call $hx_get (local.get $c) ${$.viewMatrix})) (i32.const 16)))
    (local.set $opcoes (call $hx_object))
    (call $set_num (local.get $opcoes) ${$.distance} (f64.const 7))
    (call $set_num (local.get $opcoes) ${$.pitch} (f64.const 18))
    (drop (call $invoke1 (call $hx_get (local.get $c) ${$.player}) ${$.set} (local.get $opcoes)))
    (call $checar ${$.cPlayerSet} (f64.eq (call $numero (call $hx_get (call $hx_get (local.get $c) ${$.player}) ${$.settings}) ${$.distance}) (f64.const 7)))
    (call $checar ${$.cDistanceTo} (f64.ge (call $hx_to_number (call $invoke1 (local.get $c) ${$.distanceTo} (call $vec3 (f64.const 0) (f64.const 0) (f64.const 0)))) (f64.const 0)))
    ;; post.set({ bloom: { enabled: true, intensity: 0.5 } }); post.exposure = 1.05; post.toneMapper = "agx"
    (local.set $p (call $api ${$.post}))
    (local.set $bloom (call $hx_object))
    (call $set_bool (local.get $bloom) ${$.enabled} (i32.const 1))
    (call $set_num (local.get $bloom) ${$.intensity} (f64.const 0.5))
    (local.set $opcoes (call $hx_object))
    (call $hx_set (local.get $opcoes) ${$.bloom} (local.get $bloom))
    (drop (call $invoke1 (local.get $p) ${$.set} (local.get $opcoes)))
    (call $checar ${$.cPostSet} (call $verdadeiro (call $hx_get (call $hx_get (local.get $p) ${$.bloom}) ${$.enabled})))
    (call $hx_set (local.get $p) ${$.exposure} (call $num (f64.const 1.05)))
    (call $checar ${$.cPostExposure} (call $aprox (call $numero (local.get $p) ${$.exposure}) (f64.const 1.05) (f64.const 1e-3)))
    (call $hx_set (local.get $p) ${$.toneMapper} (call $str ${$.agx}))
    (call $checar ${$.cToneMapper} (call $igual (call $hx_get (local.get $p) ${$.toneMapper}) ${$.agx}))
    (call $checar ${$.cRenderStats} (i32.eq (call $hx_type (call $hx_get (call $hx_get (call $api ${$.render}) ${$.stats}) ${$.drawCalls})) (i32.const 3)))
    (i32.const 0))

  ;; --- 4. Física e personagem -------------------------------------------------------------------
  (func $fisica (result i32)
    (local $ph i32) (local $s i32) (local $i i32) (local $f f64) (local $opcoes i32) (local $corpo i32) (local $caixa i32) (local $caixas i32)
    (local.set $ph (call $api ${$.physics}))
    (local.set $s (call $api ${$.scene}))
    (call $checar ${$.cPhysicsEnabled} (call $verdadeiro (call $hx_get (local.get $ph) ${$.enabled})))
    (call $checar ${$.cPhysicsGravity} (f64.lt (call $numero (call $hx_get (local.get $ph) ${$.gravity}) ${$.y}) (f64.const 0)))
    ;; cinco caixas dinâmicas empilhadas em diagonal, cada uma com uma cor HSL
    (loop $caixas
      (local.set $f (f64.convert_i32_u (local.get $i)))
      (local.set $opcoes (call $hx_object))
      (call $set_str (local.get $opcoes) ${$.name} ${$.Caixa})
      (call $hx_set (local.get $opcoes) ${$.position} (call $vec3 (f64.add (f64.const -2) (f64.mul (local.get $f) (f64.const 1.1))) (f64.add (f64.const 3) (f64.mul (local.get $f) (f64.const 1.2))) (f64.const 3)))
      (local.set $corpo (call $hx_object))
      (call $set_str (local.get $corpo) ${$.type} ${$.dynamic})
      (call $set_str (local.get $corpo) ${$.collider} ${$.box})
      (call $set_num (local.get $corpo) ${$.mass} (f64.const 2))
      (call $set_num (local.get $corpo) ${$.restitution} (f64.const 0.3))
      (call $hx_set (local.get $opcoes) ${$.rigidBody} (local.get $corpo))
      (call $hx_set (local.get $opcoes) ${$.tags} (call $lista1 (call $str ${$.caixa})))
      (local.set $caixa (call $invoke2 (local.get $s) ${$.spawnPrimitive} (call $str ${$.box}) (local.get $opcoes)))
      (drop (call $invoke2 (call $api ${$.material}) ${$.setColor} (local.get $caixa)
        (call $invoke3 (call $hx_get (call $api ${$.math}) ${$.color}) ${$.hsl} (call $num (f64.add (f64.const 42) (f64.mul (local.get $f) (f64.const 12)))) (call $num (f64.const 0.7)) (call $num (f64.const 0.5)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $caixas (i32.lt_u (local.get $i) (i32.const 5))))
    (local.set $caixas (call $invoke1 (local.get $s) ${$.byTag} (call $str ${$.caixa})))
    (call $checar ${$.cCaixas} (i32.and (i32.eq (call $hx_length (local.get $caixas)) (i32.const 5)) (call $hx_to_boolean (call $invoke1 (local.get $ph) ${$.hasBody} (call $hx_index (local.get $caixas) (i32.const 0))))))
    (call $checar ${$.cBodyOf} (call $verdadeiro (call $hx_get (call $invoke1 (local.get $ph) ${$.bodyOf} (call $hx_index (local.get $caixas) (i32.const 0))) ${$.isDynamic})))
    (call $checar ${$.cRaycast} (i32.eqz (call $nenhum (call $invoke3 (local.get $ph) ${$.raycast} (call $vec3 (f64.const 0) (f64.const 5) (f64.const 0)) (call $vec3 (f64.const 0) (f64.const -1) (f64.const 0)) (call $num (f64.const 20))))))
    (call $checar ${$.cBodies} (i32.ge_u (call $hx_length (call $invoke0 (local.get $ph) ${$.bodies})) (i32.const 6)))
    (call $assinar (call $invoke1 (local.get $ph) ${$.onCollisionBegin} (call $hx_callback (i32.const ${CB.colisao}))))
    (i32.const 0))

  (func $personagem (result i32)
    (local $ch i32) (local $pl i32) (local $opcoes i32) (local $cfg i32) (local $novo i32)
    (local.set $ch (call $api ${$.character}))
    (local.set $pl (call $api ${$.player}))
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.Heroi})
    (call $hx_set (local.get $opcoes) ${$.position} (call $vec3 (f64.const 0) (f64.const 1.2) (f64.const 8)))
    (local.set $cfg (call $hx_object))
    (call $set_num (local.get $cfg) ${$.walkSpeed} (f64.const 4))
    (call $set_num (local.get $cfg) ${$.runSpeed} (f64.const 7))
    (call $set_num (local.get $cfg) ${$.jumpHeight} (f64.const 1.4))
    (call $hx_set (local.get $opcoes) ${$.character} (local.get $cfg))
    (local.set $novo (call $invoke1 (local.get $ch) ${$.spawn} (local.get $opcoes)))
    (global.set $heroi (call $hx_retain (local.get $novo)))
    (call $checar ${$.cCharacterSpawn} (i32.and (i32.eqz (call $nenhum (call $hx_get (local.get $novo) ${$.character}))) (call $hx_to_boolean (call $invoke1 (local.get $ch) ${$.has} (local.get $novo)))))
    (call $checar ${$.cSettingsOf} (f64.eq (call $numero (call $invoke1 (local.get $ch) ${$.settingsOf} (local.get $novo)) ${$.walkSpeed}) (f64.const 4)))
    (drop (call $invoke1 (local.get $pl) ${$.possess} (local.get $novo)))
    (call $checar ${$.cPossess} (i32.and (call $hx_equals (call $hx_get (local.get $pl) ${$.possessed}) (local.get $novo)) (call $verdadeiro (call $hx_get (local.get $pl) ${$.isPossessing}))))
    (call $checar ${$.cCharacterAll} (i32.ge_u (call $hx_length (call $invoke0 (local.get $ch) ${$.all})) (i32.const 1)))
    (i32.const 0))

  ;; --- 5. Interface, entrada e eventos ----------------------------------------------------------
  (func $interface (result i32)
    (local $g i32) (local $opcoes i32) (local $icone i32) (local $slot i32)
    (local.set $g (call $api ${$.gui}))
    (drop (call $invoke1 (local.get $g) ${$.css} (call $str ${$.DebugEstilo})))
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.id} ${$.debugHud})
    (call $checar ${$.cGuiHtml} (i32.and
      (i32.eqz (call $nenhum (call $invoke2 (local.get $g) ${$.html} (call $str ${$.DebugHud}) (local.get $opcoes))))
      (i32.eqz (call $nenhum (call $invoke1 (local.get $g) ${$.element} (call $str ${$.seletorHud}))))))
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.id} ${$.debugIcone})
    (local.set $icone (call $invoke2 (local.get $g) ${$.svg} (call $str ${$.DebugIcone}) (local.get $opcoes)))
    (call $checar ${$.cGuiSvg} (i32.eqz (call $nenhum (local.get $icone))))
    (local.set $slot (call $invoke1 (local.get $g) ${$.element} (call $str ${$.seletorSlot})))
    (if (i32.eqz (i32.or (call $nenhum (local.get $slot)) (call $nenhum (local.get $icone))))
      (then (drop (call $invoke1 (local.get $slot) ${$.appendChild} (local.get $icone)))))
    (call $checar ${$.cGuiBind} (f64.ge (call $hx_to_number (call $invoke2 (local.get $g) ${$.bind} (call $str ${$.linguagem}) (call $str ${$.WAT}))) (f64.const 1)))
    (drop (call $invoke2 (local.get $g) ${$.bind} (call $str ${$.titulo}) (call $str ${$.tituloTexto})))
    (call $assinar (call $invoke2 (local.get $g) ${$.onAction} (call $str ${$.caixa}) (call $hx_callback (i32.const ${CB.acaoCaixa}))))
    (call $assinar (call $invoke2 (local.get $g) ${$.onAction} (call $str ${$.reiniciar}) (call $hx_callback (i32.const ${CB.acaoReiniciar}))))
    (call $checar ${$.cGuiElements} (i32.ge_u (call $hx_length (call $invoke1 (local.get $g) ${$.elements} (call $str ${$.seletorBind}))) (i32.const 5)))
    (call $checar ${$.cGuiSize} (f64.gt (call $numero (call $hx_get (local.get $g) ${$.size}) ${$.width}) (f64.const 0)))
    (i32.const 0))

  (func $entrada_e_eventos (result i32)
    (local $input i32) (local $ev i32) (local $desligar i32) (local $carga i32)
    (local.set $input (call $api ${$.input}))
    (call $checar ${$.cIsDown} (call $falso (call $invoke1 (local.get $input) ${$.isDown} (call $str ${$.KeyW}))))
    (call $checar ${$.cPointer} (i32.eq (call $hx_type (call $hx_get (call $hx_get (local.get $input) ${$.pointer}) ${$.x})) (i32.const 3)))
    (call $assinar (call $invoke1 (local.get $input) ${$.onKeyDown} (call $hx_callback (i32.const ${CB.teclar}))))
    ;; events.on recebe o payload num callback síncrono: o contador de pings prova a entrega.
    (local.set $ev (call $api ${$.events}))
    (global.set $pings (i32.const 0))
    (local.set $desligar (call $invoke2 (local.get $ev) ${$.on} (call $str ${$.debugPing}) (call $hx_callback (i32.const ${CB.ping}))))
    (local.set $carga (call $hx_object))
    (call $set_str (local.get $carga) ${$.origem} ${$.teste})
    (call $checar ${$.cEmit} (f64.eq (call $hx_to_number (call $invoke2 (local.get $ev) ${$.emit} (call $str ${$.debugPing}) (local.get $carga))) (f64.const 1)))
    (call $checar ${$.cOnRecebe} (i32.eq (global.get $pings) (i32.const 1)))
    (call $checar ${$.cListenerCount} (f64.eq (call $hx_to_number (call $invoke1 (local.get $ev) ${$.listenerCount} (call $str ${$.debugPing}))) (f64.const 1)))
    (drop (call $hx_call (local.get $desligar) (i32.const ${mem.args}) (i32.const 0)))
    (call $checar ${$.cUnsubscribe} (f64.eq (call $hx_to_number (call $invoke1 (local.get $ev) ${$.listenerCount} (call $str ${$.debugPing}))) (f64.const 0)))
    ;; de novo, agora para o resto da partida (a tecla E emite debug.ping)
    (call $assinar (call $invoke2 (local.get $ev) ${$.on} (call $str ${$.debugPing}) (call $hx_callback (i32.const ${CB.ping}))))
    (i32.const 0))

  ;; --- 6. Tempo e dados -------------------------------------------------------------------------
  ;; storage.ready() devolve uma promessa: a área a devolve e a cadeia espera a continuação (${CB.dadosProntos}).
  (func $tempo_e_dados (result i32)
    (local $tm i32) (local $ativos i32)
    (local.set $tm (call $api ${$.time}))
    (call $checar ${$.cTimeNow} (i32.and (f64.ge (call $numero (local.get $tm) ${$.now}) (f64.const 0)) (f64.ge (call $numero (local.get $tm) ${$.frame}) (f64.const 0))))
    (call $checar ${$.cTimeDelta} (f64.gt (call $numero (local.get $tm) ${$.fixedDelta}) (f64.const 0)))
    (local.set $ativos (call $api ${$.assets}))
    (call $checar ${$.cAssetsExists} (i32.and
      (call $hx_to_boolean (call $invoke1 (local.get $ativos) ${$.exists} (call $str ${$.DebugUtil})))
      (i32.eqz (call $hx_to_boolean (call $invoke1 (local.get $ativos) ${$.exists} (call $str ${$.NaoExiste}))))))
    (call $checar ${$.cAssetsSearch} (i32.ge_u (call $hx_length (call $invoke1 (local.get $ativos) ${$.search} (call $str ${$.Debug}))) (i32.const 5)))
    (call $checar ${$.cProjectName} (call $texto (call $hx_get (call $api ${$.project}) ${$.name})))
    (call $checar ${$.cPlayState} (call $igual (call $hx_get (call $api ${$.play}) ${$.state}) ${$.playing}))
    (call $invoke1 (call $invoke0 (call $api ${$.storage}) ${$.ready}) ${$.then} (call $hx_callback (i32.const ${CB.dadosProntos}))))

  ;; Continuação de storage.ready(): lê e grava o contador de execuções; devolve a promessa do set.
  (func $dados_prontos (result i32)
    (local $st i32) (local $atual i32)
    (local.set $st (call $api ${$.storage}))
    (local.set $atual (call $invoke2 (local.get $st) ${$.get} (call $str ${$.execucoes}) (call $num (f64.const 0))))
    (global.set $execucoes (f64.add (f64.const 1)
      (if (result f64) (i32.eq (call $hx_type (local.get $atual)) (i32.const 3)) (then (call $hx_to_number (local.get $atual))) (else (f64.const 0)))))
    (call $invoke1 (call $invoke2 (local.get $st) ${$.set} (call $str ${$.execucoes}) (call $num (global.get $execucoes))) ${$.then} (call $hx_callback (i32.const ${CB.dadosGravados}))))

  (func $dados_gravados
    (local $st i32) (local $fim i32)
    (local.set $st (call $api ${$.storage}))
    (call $checar ${$.cStorage} (i32.and
      (f64.eq (call $hx_to_number (call $invoke1 (local.get $st) ${$.get} (call $str ${$.execucoes}))) (global.get $execucoes))
      (call $hx_to_boolean (call $invoke1 (local.get $st) ${$.has} (call $str ${$.execucoes})))))
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.execucaoTxt}))
    (local.set $fim (call $anexar_int (local.get $fim) (i32.trunc_f64_u (global.get $execucoes))))
    (local.set $fim (call $anexar (local.get $fim) ${$.execucaoFim}))
    (call $log_buf (i32.const 1) (local.get $fim)))

  ;; helix.throw interrompe a área na hora e chega à cadeia como rejeição da promessa.
  (func $lancar (result i32)
    (call $hx_throw ${$.erroProposital})
    (i32.const 0))

  ;; --- Cadeia de áreas --------------------------------------------------------------------------
  (func $rodar_area (param $i i32) (result i32)
    (if (i32.eq (local.get $i) (i32.const 1)) (then (return (call $nucleo))))
    (if (i32.eq (local.get $i) (i32.const 2)) (then (return (call $modulo))))
    (if (i32.eq (local.get $i) (i32.const 3)) (then (return (call $matematica))))
    (if (i32.eq (local.get $i) (i32.const 4)) (then (return (call $cena))))
    (if (i32.eq (local.get $i) (i32.const 5)) (then (return (call $transformacao))))
    (if (i32.eq (local.get $i) (i32.const 6)) (then (return (call $luzes_e_ceu))))
    (if (i32.eq (local.get $i) (i32.const 7)) (then (return (call $camera_e_pos))))
    (if (i32.eq (local.get $i) (i32.const 8)) (then (return (call $fisica))))
    (if (i32.eq (local.get $i) (i32.const 9)) (then (return (call $personagem))))
    (if (i32.eq (local.get $i) (i32.const 10)) (then (return (call $interface))))
    (if (i32.eq (local.get $i) (i32.const 11)) (then (return (call $entrada_e_eventos))))
    (if (i32.eq (local.get $i) (i32.const 12)) (then (return (call $tempo_e_dados))))
    (if (i32.eq (local.get $i) (i32.const 13)) (then (return (call $lancar))))
    (i32.const 0))

  ;; A área que deve rejeitar conta o sucesso como falha; as outras só registram "ok <nome>".
  (func $area_ok (param $i i32)
    (local $fim i32)
    (if (i32.eq (local.get $i) (i32.const ${ID_ERRO}))
      (then (call $checar ${$.cRejeicaoDeveria} (i32.const 0)) (return)))
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.okPrefixo}))
    (local.set $fim (call $anexar (local.get $fim) (call $nome_ptr (local.get $i)) (call $nome_len (local.get $i))))
    (call $log_buf (i32.const 0) (local.get $fim)))

  (func $area_erro (param $i i32) (param $causa i32)
    (local $mensagem i32) (local $fim i32)
    (local.set $mensagem (if (result i32) (i32.eq (call $hx_type (local.get $causa)) (i32.const 6))
      (then (call $hx_get (local.get $causa) ${$.message}))
      (else (local.get $causa))))
    (if (i32.eq (local.get $i) (i32.const ${ID_ERRO}))
      (then
        (local.set $fim (call $anexar_valor (i32.const ${BUF}) (local.get $mensagem)))
        (call $checar ${$.cRejeicaoChega} (call $contem (i32.const ${BUF}) (i32.sub (local.get $fim) (i32.const ${BUF})) ${$.proposital}))
        (return)))
    (global.set $falhas (i32.add (global.get $falhas) (i32.const 1)))
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.erroEm}))
    (local.set $fim (call $anexar (local.get $fim) (call $nome_ptr (local.get $i)) (call $nome_len (local.get $i))))
    (local.set $fim (call $anexar (local.get $fim) ${$.doisPontos}))
    (local.set $fim (call $anexar_valor (local.get $fim) (local.get $mensagem)))
    (call $log_buf (i32.const 3) (local.get $fim)))

  ;; --- Eventos da partida -----------------------------------------------------------------------
  (func $ao_teclar (param $e i32)
    (local $code i32) (local $tm i32) (local $carga i32)
    (if (call $hx_to_boolean (call $hx_get (local.get $e) ${$.repeat})) (then (return)))
    (local.set $code (call $hx_get (local.get $e) ${$.code}))
    (if (call $igual (local.get $code) ${$.KeyR}) (then (drop (call $invoke0 (call $api ${$.play}) ${$.restart})) (return)))
    (if (call $igual (local.get $code) ${$.KeyB}) (then (call $soltar_caixa) (return)))
    (if (call $igual (local.get $code) ${$.KeyE})
      (then
        (local.set $carga (call $hx_object))
        (call $set_str (local.get $carga) ${$.origem} ${$.teclado})
        (drop (call $invoke2 (call $api ${$.events}) ${$.emit} (call $str ${$.debugPing}) (local.get $carga)))
        (return)))
    (if (call $igual (local.get $code) ${$.KeyF})
      (then (drop (call $invoke2 (call $api ${$.camera}) ${$.shake} (call $num (f64.const 0.4)) (call $num (f64.const 0.6)))) (return)))
    (if (call $igual (local.get $code) ${$.KeyT})
      (then
        (local.set $tm (call $api ${$.time}))
        (call $hx_set (local.get $tm) ${$.scale} (call $num (select (f64.const 0.3) (f64.const 1) (f64.eq (call $numero (local.get $tm) ${$.scale}) (f64.const 1))))))))

  (func $soltar_caixa
    (local $random i32) (local $opcoes i32) (local $corpo i32) (local $caixa i32) (local $carga i32)
    (local.set $random (call $hx_get (call $api ${$.math}) ${$.random}))
    (local.set $opcoes (call $hx_object))
    (call $set_str (local.get $opcoes) ${$.name} ${$.CaixaSolta})
    (call $hx_set (local.get $opcoes) ${$.position} (call $vec3
      (call $hx_to_number (call $invoke2 (local.get $random) ${$.range} (call $num (f64.const -3)) (call $num (f64.const 3))))
      (f64.const 6)
      (call $hx_to_number (call $invoke2 (local.get $random) ${$.range} (call $num (f64.const 0)) (call $num (f64.const 4))))))
    (local.set $corpo (call $hx_object))
    (call $set_str (local.get $corpo) ${$.type} ${$.dynamic})
    (call $set_str (local.get $corpo) ${$.collider} ${$.box})
    (call $set_num (local.get $corpo) ${$.mass} (f64.const 1))
    (call $hx_set (local.get $opcoes) ${$.rigidBody} (local.get $corpo))
    (call $hx_set (local.get $opcoes) ${$.tags} (call $lista1 (call $str ${$.caixa})))
    (local.set $caixa (call $invoke2 (call $api ${$.scene}) ${$.spawnPrimitive} (call $str ${$.box}) (local.get $opcoes)))
    (drop (call $invoke2 (call $api ${$.material}) ${$.setColor} (local.get $caixa) (call $invoke0 (local.get $random) ${$.color})))
    (global.set $pontos (i32.add (global.get $pontos) (i32.const 1)))
    (drop (call $invoke2 (call $api ${$.gui}) ${$.bind} (call $str ${$.pontos}) (call $num (f64.convert_i32_u (global.get $pontos)))))
    (local.set $carga (call $hx_object))
    (call $hx_set (local.get $carga) ${$.nome} (call $hx_get (local.get $caixa) ${$.name}))
    (drop (call $invoke2 (call $api ${$.events}) ${$.emit} (call $str ${$.debugCaixa}) (local.get $carga))))

  (func $ao_ping (param $carga i32)
    (local $fim i32)
    (global.set $pings (i32.add (global.get $pings) (i32.const 1)))
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.pingDe}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $hx_get (local.get $carga) ${$.origem})))
    (call $log_buf (i32.const 1) (local.get $fim)))

  (func $ao_colidir (param $e i32)
    (local $fim i32)
    (global.set $colisoes (i32.add (global.get $colisoes) (i32.const 1)))
    (if (i32.gt_u (global.get $colisoes) (i32.const 3)) (then (return)))
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.colisao}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $hx_get (call $hx_get (local.get $e) ${$.a}) ${$.name})))
    (local.set $fim (call $anexar (local.get $fim) ${$.vezes}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $hx_get (call $hx_get (local.get $e) ${$.b}) ${$.name})))
    (call $log_buf (i32.const 1) (local.get $fim)))

  (func $atualizar_hud
    (local $g i32)
    (local.set $g (call $api ${$.gui}))
    (drop (call $invoke2 (local.get $g) ${$.bind} (call $str ${$.fps}) (call $num (f64.nearest (call $numero (call $hx_get (call $api ${$.render}) ${$.stats}) ${$.fps})))))
    (drop (call $invoke2 (local.get $g) ${$.bind} (call $str ${$.checagens}) (call $num (f64.convert_i32_u (global.get $checagens)))))
    (drop (call $invoke2 (local.get $g) ${$.bind} (call $str ${$.falhas}) (call $num (f64.convert_i32_u (global.get $falhas)))))
    (drop (call $invoke2 (local.get $g) ${$.bind} (call $str ${$.atores}) (call $invoke0 (call $api ${$.scene}) ${$.count}))))

  ;; Fim da cadeia: um ator com o script DebugGirador nasce no jogo e o resumo vai ao console.
  (func $finalizar
    (local $girador i32) (local $opcoes i32) (local $corpo i32) (local $script i32) (local $props i32) (local $extra i32) (local $fim i32)
    (local.set $girador (call $invoke2 (call $api ${$.assets}) ${$.byName} (call $str ${$.DebugGirador}) (call $str ${$.script})))
    (if (call $nenhum (local.get $girador))
      (then (call $checar ${$.cAtivoGirador} (i32.const 0)))
      (else
        (local.set $opcoes (call $hx_object))
        (call $set_str (local.get $opcoes) ${$.name} ${$.GiradorDinamico})
        (call $hx_set (local.get $opcoes) ${$.position} (call $vec3 (f64.const -2) (f64.const 0.5) (f64.const -3)))
        (local.set $corpo (call $hx_object))
        (call $set_str (local.get $corpo) ${$.type} ${$.kinematic})
        (call $set_str (local.get $corpo) ${$.collider} ${$.box})
        (call $hx_set (local.get $opcoes) ${$.rigidBody} (local.get $corpo))
        (local.set $props (call $hx_object))
        (call $set_num (local.get $props) ${$.velocidade} (f64.const 180))
        (call $set_str (local.get $props) ${$.cor} ${$.ciano})
        (local.set $script (call $hx_object))
        (call $hx_set (local.get $script) ${$.assetId} (call $hx_get (local.get $girador) ${$.id}))
        (call $hx_set (local.get $script) ${$.props} (local.get $props))
        (call $hx_set (local.get $opcoes) ${$.script} (local.get $script))
        (local.set $extra (call $invoke2 (call $api ${$.scene}) ${$.spawnPrimitive} (call $str ${$.box}) (local.get $opcoes)))
        (call $checar ${$.cSpawnComScript} (i32.and
          (i32.eqz (call $nenhum (call $hx_get (local.get $extra) ${$.script})))
          (call $hx_equals (call $hx_get (call $hx_get (local.get $extra) ${$.script}) ${$.assetId}) (call $hx_get (local.get $girador) ${$.id}))))))
    ;; "API percorrida em WebAssembly (texto): N checagens, F falhas. <dica>"
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.resumoInicio}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $checagens)))
    (local.set $fim (call $anexar (local.get $fim) ${$.resumoChecagens}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $falhas)))
    (local.set $fim (call $anexar (local.get $fim) ${$.resumoFalhas}))
    (local.set $fim (call $anexar (local.get $fim) ${$.dica}))
    (call $log_buf (select (i32.const 1) (i32.const 2) (i32.eqz (global.get $falhas))) (local.get $fim))
    (call $atualizar_hud))

  ;; Despacho dos callbacks: 1..${N} áreas, ${101}..${100 + N} ok, ${201}..${200 + N} erro, ${CB.teclar}+ eventos da partida.
  (func (export "__hx_invoke_callback") (param $id i32) (param $args i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $id) (i32.const 1)) (i32.le_u (local.get $id) (i32.const ${N})))
      (then (return (call $rodar_area (local.get $id)))))
    (if (i32.and (i32.gt_u (local.get $id) (i32.const 100)) (i32.le_u (local.get $id) (i32.const ${100 + N})))
      (then (call $area_ok (i32.sub (local.get $id) (i32.const 100))) (return (i32.const 0))))
    (if (i32.and (i32.gt_u (local.get $id) (i32.const 200)) (i32.le_u (local.get $id) (i32.const ${200 + N})))
      (then (call $area_erro (i32.sub (local.get $id) (i32.const 200)) (call $hx_index (local.get $args) (i32.const 0))) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.teclar})) (then (call $ao_teclar (call $hx_index (local.get $args) (i32.const 0))) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.acaoCaixa})) (then (call $soltar_caixa) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.acaoReiniciar})) (then (drop (call $invoke0 (call $api ${$.play}) ${$.restart})) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.ping})) (then (call $ao_ping (call $hx_index (local.get $args) (i32.const 0))) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.finalizar})) (then (call $finalizar) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.colisao})) (then (call $ao_colidir (call $hx_index (local.get $args) (i32.const 0))) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.dadosProntos})) (then (return (call $dados_prontos))))
    (if (i32.eq (local.get $id) (i32.const ${CB.dadosGravados})) (then (call $dados_gravados) (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const ${CB.visita})) (then (global.set $visitados (i32.add (global.get $visitados) (i32.const 1)))))
    (i32.const 0))

  ;; --- Hooks ------------------------------------------------------------------------------------
  (func (export "onLoad")
    (call $hx_log (i32.const 1) ${$.onLoadMsg}))

  (func (export "onStart")
    (local $p i32) (local $i i32)
    (call $hx_log (i32.const 1) ${$.inicio})
    (local.set $p (call $invoke1 (call $api ${$.time}) ${$.wait} (call $num (f64.const 0))))
    (local.set $i (i32.const 1))
    (loop $areas
      (local.set $p (call $invoke1 (local.get $p) ${$.then} (call $hx_callback (local.get $i))))
      (local.set $p (call $invoke2 (local.get $p) ${$.then} (call $hx_callback (i32.add (local.get $i) (i32.const 100))) (call $hx_callback (i32.add (local.get $i) (i32.const 200)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $areas (i32.le_u (local.get $i) (i32.const ${N}))))
    (drop (call $invoke1 (local.get $p) ${$.then} (call $hx_callback (i32.const ${CB.finalizar})))))

  (func (export "onUpdate") (param $dt f64)
    (local $d i32) (local $fim i32)
    (global.set $quadros (i32.add (global.get $quadros) (i32.const 1)))
    (if (global.get $torus)
      (then (drop (call $invoke2 (call $api ${$.transform}) ${$.rotate} (global.get $torus) (call $vec3 (f64.const 0) (f64.mul (f64.const 40) (local.get $dt)) (f64.const 0))))))
    (local.set $d (call $api ${$.debug}))
    (drop (call $invoke3 (local.get $d) ${$.line} (call $vec3 (f64.const -6) (f64.const 0.05) (f64.const -6)) (call $vec3 (f64.const 6) (f64.const 0.05) (f64.const -6)) (call $str ${$.rosa})))
    (if (global.get $heroi)
      (then
        (drop (call $invoke2 (local.get $d) ${$.axes} (global.get $heroi) (call $num (f64.const 1))))
        ;; "Heroi · <pontos> pts" acima do herói
        (local.set $fim (call $anexar (i32.const ${BUF}) ${$.heroiRotulo}))
        (local.set $fim (call $anexar_int (local.get $fim) (global.get $pontos)))
        (local.set $fim (call $anexar (local.get $fim) ${$.pts}))
        (drop (call $invoke3 (local.get $d) ${$.text}
          (call $invoke2 (call $hx_get (call $api ${$.math}) ${$.vec3}) ${$.add} (call $invoke1 (call $api ${$.transform}) ${$.worldPosition} (global.get $heroi)) (call $vec3 (f64.const 0) (f64.const 2.2) (f64.const 0)))
          (call $hx_string (i32.const ${BUF}) (i32.sub (local.get $fim) (i32.const ${BUF})))
          (call $str ${$.branco})))))
    (global.set $hud (f64.add (global.get $hud) (local.get $dt)))
    (if (f64.ge (global.get $hud) (f64.const 0.5))
      (then (global.set $hud (f64.const 0)) (call $atualizar_hud))))

  (func (export "onFixedUpdate") (param $h f64)
    (global.set $passos (i32.add (global.get $passos) (i32.const 1)))
    (if (i32.eq (global.get $passos) (i32.const 1))
      (then (call $checar ${$.cFixedUpdate} (i32.and (f64.gt (local.get $h) (f64.const 0)) (f64.lt (local.get $h) (f64.const 1)))))))

  (func (export "onLateUpdate") (param $dt f64)
    (global.set $late (i32.add (global.get $late) (i32.const 1))))

  (func (export "onStop")
    (local $fim i32)
    (call $desligar_tudo)
    (local.set $fim (call $anexar (i32.const ${BUF}) ${$.parou}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $quadros)))
    (local.set $fim (call $anexar (local.get $fim) ${$.quadrosTxt}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $passos)))
    (local.set $fim (call $anexar (local.get $fim) ${$.passosTxt}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $late)))
    (local.set $fim (call $anexar (local.get $fim) ${$.lateTxt}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $colisoes)))
    (local.set $fim (call $anexar (local.get $fim) ${$.colisoesTxt}))
    (call $log_buf (i32.const 1) (local.get $fim))
    (if (global.get $torus) (then (call $hx_release (global.get $torus)) (global.set $torus (i32.const 0))))
    (if (global.get $heroi) (then (call $hx_release (global.get $heroi)) (global.set $heroi (i32.const 0)))))
)
`;
}
function actorModule(): string {
    const strings = watStrings({
        name: 'name', props: 'props', define: 'define', get: 'get', velocidade: 'velocidade', cor: 'cor', pulsar: 'pulsar',
        type: 'type', range: 'range', default: 'default', min: 'min', max: 'max', step: 'step', label: 'label', rotuloVelocidade: 'Velocidade (°/s)',
        color: 'color', laranja: '#ff8800', Cor: 'Cor', boolean: 'boolean', Pulsar: 'Pulsar',
        material: 'material', setColor: 'setColor', onChanged: 'onChanged', log: 'log', assert: 'assert', self: 'self',
        transform: 'transform', setRotation: 'setRotation', setScale: 'setScale', time: 'time', now: 'now', has: 'has', definitions: 'definitions',
        x: 'x', y: 'y', z: 'z',
        acordouCom: ' acordou com velocidade ', grausPorSegundo: '°/s', tocou: ' tocou ', entrouNoGatilho: ' entrou no gatilho de ',
        ativo: ' ativo', inativo: ' inativo', doisPontos: ': ', quadrosTxt: ' quadros, ', contatosTxt: ' contatos',
        msgSelf: 'helix.self deveria ser o ator deste script', msgDefine: 'props.define deveria registrar 3 propriedades',
    });
    const $ = refs(strings.at);
    const mem = scratch(strings.next, 512);
    const BUF = mem.buf;
    return `;; DebugGirador · Script de ator
;; Helix Engine — modo debug: ciclo de vida de um ator, propriedades no inspetor e contatos.
;; Um ator vem da hierarquia (Caixa giratória); outro nasce no jogo por spawnPrimitive(..., script).
;; Cada ator com este script recebe uma instância própria do módulo: memória e globais são o estado daquele ator.
(module
${IMPORTS.map((line) => `  ${line}`).join('\n')}

  (memory (export "memory") 1)
${strings.data.map((line) => `  ${line}`).join('\n')}

  (global $angulo (mut f64) (f64.const 0))
  (global $contatos (mut i32) (i32.const 0))
  (global $quadros (mut i32) (i32.const 0))
  (global $desligar (mut i32) (i32.const 0))

${helpers(mem, $)}
  ;; "<nome do ator><sufixo>" no console.
  (func $log_nome (param $nivel i32) (param $p i32) (param $n i32)
    (local $fim i32)
    (local.set $fim (call $anexar_valor (i32.const ${BUF}) (call $hx_get (call $hx_self) ${$.name})))
    (local.set $fim (call $anexar (local.get $fim) (local.get $p) (local.get $n)))
    (call $log_buf (local.get $nivel) (local.get $fim)))

  ;; props.define({ velocidade: range, cor: color, pulsar: boolean })
  (func (export "onLoad")
    (local $defs i32) (local $p i32)
    (local.set $defs (call $hx_object))
    (local.set $p (call $hx_object))
    (call $set_str (local.get $p) ${$.type} ${$.range})
    (call $set_num (local.get $p) ${$.default} (f64.const 90))
    (call $set_num (local.get $p) ${$.min} (f64.const 0))
    (call $set_num (local.get $p) ${$.max} (f64.const 360))
    (call $set_num (local.get $p) ${$.step} (f64.const 1))
    (call $set_str (local.get $p) ${$.label} ${$.rotuloVelocidade})
    (call $hx_set (local.get $defs) ${$.velocidade} (local.get $p))
    (local.set $p (call $hx_object))
    (call $set_str (local.get $p) ${$.type} ${$.color})
    (call $set_str (local.get $p) ${$.default} ${$.laranja})
    (call $set_str (local.get $p) ${$.label} ${$.Cor})
    (call $hx_set (local.get $defs) ${$.cor} (local.get $p))
    (local.set $p (call $hx_object))
    (call $set_str (local.get $p) ${$.type} ${$.boolean})
    (call $set_bool (local.get $p) ${$.default} (i32.const 1))
    (call $set_str (local.get $p) ${$.label} ${$.Pulsar})
    (call $hx_set (local.get $defs) ${$.pulsar} (local.get $p))
    (drop (call $invoke1 (call $hx_get (call $hx_root) ${$.props}) ${$.define} (local.get $defs))))

  (func (export "onStart")
    (local $props i32) (local $lg i32) (local $fim i32)
    (local.set $props (call $hx_get (call $hx_root) ${$.props}))
    (local.set $lg (call $hx_get (call $hx_root) ${$.log}))
    ;; "<nome> acordou com velocidade <v>°/s"
    (local.set $fim (call $anexar_valor (i32.const ${BUF}) (call $hx_get (call $hx_self) ${$.name})))
    (local.set $fim (call $anexar (local.get $fim) ${$.acordouCom}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $invoke1 (local.get $props) ${$.get} (call $str ${$.velocidade}))))
    (local.set $fim (call $anexar (local.get $fim) ${$.grausPorSegundo}))
    (call $log_buf (i32.const 1) (local.get $fim))
    (drop (call $invoke2 (call $hx_get (call $hx_root) ${$.material}) ${$.setColor} (call $hx_self) (call $invoke1 (local.get $props) ${$.get} (call $str ${$.cor}))))
    ;; props.onChanged("cor", callback 1) devolve a função de desligar, retida até onDestroy
    (global.set $desligar (call $hx_retain (call $invoke2 (local.get $props) ${$.onChanged} (call $str ${$.cor}) (call $hx_callback (i32.const 1)))))
    (drop (call $invoke2 (local.get $lg) ${$.assert}
      (call $hx_boolean (call $hx_equals (call $hx_get (call $hx_root) ${$.self}) (call $hx_self)))
      (call $str ${$.msgSelf})))
    (drop (call $invoke2 (local.get $lg) ${$.assert}
      (call $hx_boolean (i32.and
        (call $hx_to_boolean (call $invoke1 (local.get $props) ${$.has} (call $str ${$.velocidade})))
        (i32.eq (call $hx_length (call $invoke0 (local.get $props) ${$.definitions})) (i32.const 3))))
      (call $str ${$.msgDefine}))))

  ;; Callback 1: a cor mudou no inspetor → material.setColor(self, nova cor).
  (func (export "__hx_invoke_callback") (param $id i32) (param $args i32) (result i32)
    (if (i32.eq (local.get $id) (i32.const 1))
      (then (drop (call $invoke2 (call $hx_get (call $hx_root) ${$.material}) ${$.setColor} (call $hx_self) (call $hx_index (local.get $args) (i32.const 0))))))
    (i32.const 0))

  (func (export "onUpdate") (param $dt f64)
    (local $props i32) (local $tr i32) (local $t f64) (local $onda f64)
    (local.set $props (call $hx_get (call $hx_root) ${$.props}))
    (local.set $tr (call $hx_get (call $hx_root) ${$.transform}))
    (global.set $quadros (i32.add (global.get $quadros) (i32.const 1)))
    (global.set $angulo (f64.add (global.get $angulo) (f64.mul (call $hx_to_number (call $invoke1 (local.get $props) ${$.get} (call $str ${$.velocidade}))) (local.get $dt))))
    (drop (call $invoke2 (local.get $tr) ${$.setRotation} (call $hx_self) (call $vec3 (f64.const 0) (global.get $angulo) (f64.const 0))))
    (if (call $hx_to_boolean (call $invoke1 (local.get $props) ${$.get} (call $str ${$.pulsar})))
      (then
        ;; onda triangular entre 0 e 1 a partir de time.now (não há seno na ABI): escala entre 0.9 e 1.1
        (local.set $t (f64.mul (call $numero (call $hx_get (call $hx_root) ${$.time}) ${$.now}) (f64.const 1.5)))
        (local.set $onda (f64.abs (f64.sub (f64.mul (f64.sub (local.get $t) (f64.floor (local.get $t))) (f64.const 2)) (f64.const 1))))
        (drop (call $invoke2 (local.get $tr) ${$.setScale} (call $hx_self) (call $num (f64.add (f64.const 0.9) (f64.mul (local.get $onda) (f64.const 0.2)))))))))

  (func (export "onCollisionBegin") (param $outro i32) (param $contato i32)
    (local $fim i32)
    (global.set $contatos (i32.add (global.get $contatos) (i32.const 1)))
    (if (i32.gt_u (global.get $contatos) (i32.const 3)) (then (return)))
    (local.set $fim (call $anexar_valor (i32.const ${BUF}) (call $hx_get (call $hx_self) ${$.name})))
    (local.set $fim (call $anexar (local.get $fim) ${$.tocou}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $hx_get (local.get $outro) ${$.name})))
    (call $log_buf (i32.const 1) (local.get $fim)))

  (func (export "onTriggerEnter") (param $outro i32)
    (local $fim i32)
    (local.set $fim (call $anexar_valor (i32.const ${BUF}) (call $hx_get (local.get $outro) ${$.name})))
    (local.set $fim (call $anexar (local.get $fim) ${$.entrouNoGatilho}))
    (local.set $fim (call $anexar_valor (local.get $fim) (call $hx_get (call $hx_self) ${$.name})))
    (call $log_buf (i32.const 1) (local.get $fim)))

  (func (export "onEnable") (call $log_nome (i32.const 0) ${$.ativo}))
  (func (export "onDisable") (call $log_nome (i32.const 0) ${$.inativo}))

  (func (export "onStop")
    (local $fim i32)
    (local.set $fim (call $anexar_valor (i32.const ${BUF}) (call $hx_get (call $hx_self) ${$.name})))
    (local.set $fim (call $anexar (local.get $fim) ${$.doisPontos}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $quadros)))
    (local.set $fim (call $anexar (local.get $fim) ${$.quadrosTxt}))
    (local.set $fim (call $anexar_int (local.get $fim) (global.get $contatos)))
    (local.set $fim (call $anexar (local.get $fim) ${$.contatosTxt}))
    (call $log_buf (i32.const 1) (local.get $fim)))

  (func (export "onDestroy")
    (if (global.get $desligar)
      (then
        (drop (call $hx_call (global.get $desligar) (i32.const ${mem.args}) (i32.const 0)))
        (call $hx_release (global.get $desligar))
        (global.set $desligar (i32.const 0)))))
)
`;
}
function utilModule(): string {
    const strings = watStrings({ prefixo: 'Olá, ' });
    const buffer = strings.next;
    const capacidade = 200;
    return `;; DebugUtil · Módulo compartilhado
;; Helix Engine — modo debug: as funções exportadas são as exportações do módulo (require("DebugUtil")
;; de qualquer linguagem). Números passam como f64; textos chegam e voltam como handles (i32) da engine.
(module
  (import "helix" "string" (func $hx_string (param i32 i32) (result i32)))
  (import "helix" "string_read" (func $hx_string_read (param i32 i32 i32) (result i32)))

  (memory (export "memory") 1)
${strings.data.map((line) => `  ${line}`).join('\n')}

  (func (export "soma") (param $a f64) (param $b f64) (result f64)
    (f64.add (local.get $a) (local.get $b)))

  ;; saudacao("Helix") devolve "Olá, Helix": monta o texto num buffer e cria uma String da engine.
  (func (export "saudacao") (param $quem i32) (result i32)
    (local $tamanho i32)
    (memory.copy (i32.const ${buffer}) (i32.const ${strings.at.prefixo.offset}) (i32.const ${strings.at.prefixo.length}))
    (local.set $tamanho (call $hx_string_read (local.get $quem) (i32.const ${buffer + strings.at.prefixo.length}) (i32.const ${capacidade})))
    (if (i32.gt_u (local.get $tamanho) (i32.const ${capacidade})) (then (local.set $tamanho (i32.const ${capacidade}))))
    (call $hx_string (i32.const ${buffer}) (i32.add (i32.const ${strings.at.prefixo.length}) (local.get $tamanho))))

  (func (export "limitar") (param $valor f64) (param $minimo f64) (param $maximo f64) (result f64)
    (f64.max (local.get $minimo) (f64.min (local.get $maximo) (local.get $valor))))
)
`;
}
