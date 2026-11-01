import type { GameSources } from '../types';
export function dartGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
import 'dart:math' as math;

import 'package:helix/helix.dart';

                                                                                          
class Area {
  final String nome;
  final Object? Function() rodar;
  final bool esperaErro;

  const Area(this.nome, this.rodar, {this.esperaErro = false});
}

class DebugJogo extends Script {
  static const linguagem = 'Dart';

  var quadros = 0;
  var passosFisica = 0;
  var lateUpdates = 0;
  var renders = 0;
  var colisoes = 0;
  var checagens = 0;
  var falhas = 0;
  var pontos = 0;
  var hudTimer = 0.0;
                                                                         
  Value? torus;
  Value? heroi;
  Value? efeito;
  Value? tela;
  final assinaturas = <Value>[];

                                                                                            

  Value api(String caminho) => helix.path(caminho);
  Vec3 v3(num x, num y, num z) => Vec3(x.toDouble(), y.toDouble(), z.toDouble());
  Value arg(List<Value> args, int indice) => indice < args.length ? args[indice] : Value.none;

  void registrar(String metodo, String mensagem) {
    api('log').invoke(metodo, ['Debug', mensagem]);
  }

  void info(String mensagem) => registrar('info', mensagem);
  void aviso(String mensagem) => registrar('warn', mensagem);
  void erro(String mensagem) => registrar('error', mensagem);
  void depurar(String mensagem) => registrar('debug', mensagem);

  void checar(String nome, bool condicao, [Object? detalhe]) {
    checagens++;
    if (condicao) return;
    falhas++;
    erro(detalhe == null ? 'FALHOU ' + nome : 'FALHOU ' + nome + ': ' + detalhe.toString());
  }

  void assinar(Value desligar) {
    if (desligar.isFunction) assinaturas.add(desligar);
  }

  bool verdadeiro(Value v) => v.isBoolean && v.boolean;
  bool falso(Value v) => v.isBoolean && !v.boolean;
  bool aprox(double a, double b, double epsilon) => (a - b).abs() <= epsilon;
  double arred(double x) => (x * 100).roundToDouble() / 100;
  double numero(Value o, String chave) => o[chave].number;
  bool textoIgual(Value v, String esperado) => v.isString && v.string == esperado;

                                                                                            
  bool eq3(Value vetor, num x, num y, num z, double epsilon) => api('math.vec3').invoke('equals', [vetor, v3(x, y, z), epsilon]).boolean;

  double comprimento(Value vetor) => api('math.vec3').invoke('length', [vetor]).number;
  bool contem(Value lista, String texto) => lista.items.any((item) => item.string == texto);
  String nomeDe(Value entidade) => entidade.isNullish ? 'ninguém' : entidade['name'].string;

                                                                                             

  Object? nucleo() {
    final engine = api('engine');
    final nome = engine['name'];
    final contexto = helix['context'].string;
    checar('engine.name', nome.isString && nome.string != '');
    checar('engine.version', engine['version'].isString);
    checar('context', contexto == 'shared' || contexto == 'client' || contexto == 'server', contexto);
    checar('isPlaying', verdadeiro(helix['isPlaying']));
    checar('isEditor', falso(helix['isEditor']));
    checar('self no script de entrada', self.isNullish && helix['self'].isNullish);
    checar('script é o handle do script', script.isObject);
    checar('Helix.now', Helix.now >= 0);
    info(nome.string + ' ' + engine['version'].string + ' · API ' + engine['apiVersion'].string + ' · ' + linguagem);
    Helix.log('Helix.log direto do Dart (console da engine)');
    return null;
  }

  Object? modulo() {
    final util = Helix.require('DebugUtil');
    checar('require devolve as funções', util.isObject && util['soma'].isFunction);
    final resultado = util.invoke('soma', [2, 3]).number;
    checar('require soma', resultado == 5, resultado);
    checar('require saudacao', textoIgual(util.invoke('saudacao', ['Helix']), 'Olá, Helix'));
    checar('require limitar', util.invoke('limitar', [15, 0, 10]).number == 10);
    return null;
  }

  Object? matematica() {
    final m = api('math');
    final vec = m['vec3'], quat = m['quat'], mat4 = m['mat4'], escalar = m['scalar'];
    checar('vec3.add', eq3(vec.invoke('add', [v3(1, 2, 3), v3(1, 1, 1)]), 2, 3, 4, 1e-6));
    checar('vec3.length', aprox(vec.invoke('length', [v3(3, 4, 0)]).number, 5, 1e-3));
    checar('vec3.normalize', aprox(comprimento(vec.invoke('normalize', [v3(0, 5, 0)])), 1, 1e-3));
    checar('vec3.cross', eq3(vec.invoke('cross', [v3(1, 0, 0), v3(0, 1, 0)]), 0, 0, 1, 1e-6));
    checar('vec3.lerp', eq3(vec.invoke('lerp', [v3(0, 0, 0), v3(2, 2, 2), 0.5]), 1, 1, 1, 1e-6));
    final q = quat.invoke('fromEuler', [v3(0, 90, 0)]);
    checar('quat.rotateVec3', eq3(quat.invoke('rotateVec3', [q, v3(1, 0, 0)]), 0, 0, -1, 1e-3));
    checar('quat.toEuler', aprox(numero(quat.invoke('toEuler', [q]), 'y'), 90, 0.01));
    final mat = mat4.invoke('fromTRS', [v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1)]);
    checar('mat4.transformPoint', eq3(mat4.invoke('transformPoint', [mat, v3(0, 0, 0)]), 1, 2, 3, 1e-6));
    checar('mat4.invert', !mat4.invoke('invert', [mat]).isNullish);
    final aabb = m['aabb'];
    final caixa = aabb.invoke('fromCenterSize', [v3(0, 0, 0), v3(2, 2, 2)]);
    checar('aabb.contains', aabb.invoke('contains', [caixa, v3(0.5, 0.5, 0.5)]).boolean && !aabb.invoke('contains', [caixa, v3(2, 0, 0)]).boolean);
    final ray = m['ray'];
    final raio = ray.invoke('create', [v3(0, 5, 0), v3(0, -1, 0)]);
    checar('ray.intersectAabb', !ray.invoke('intersectAabb', [raio, caixa]).isNullish);
    checar('scalar.remap', escalar.invoke('remap', [5, 0, 10, 0, 100]).number == 50);
    checar('clamp/lerp', m.invoke('clamp', [15, 0, 10]).number == 10 && m.invoke('lerp', [0, 10, 0.5]).number == 5);
    checar('scalar.wrapAngle', aprox(escalar.invoke('wrapAngle', [370]).number, 10, 1e-3));
    checar('degToRad', aprox(m.invoke('degToRad', [180]).number, math.pi, 1e-6));
    final ruido = m['noise'];
    final perlin = ruido.invoke('perlin2', [0.3, 0.7]).number;
    checar('noise.perlin2', perlin >= -1.01 && perlin <= 1.01, perlin);
    checar('noise.fbm', ruido.invoke('fbm', [1.5, 2.5, 0, 4]).isNumber);
    final cor = m['color'];
    checar('color.hexToVec3', eq3(cor.invoke('hexToVec3', ['#ff0000']), 1, 0, 0, 0.01));
    final hex = cor.invoke('vec3ToHex', [v3(1, 1, 1)]).string;
    checar('color.vec3ToHex', hex.toLowerCase() == '#ffffff', hex);
    final random = m['random'];
    random.invoke('seed', [42]);
    final primeiro = random.invoke('value').number;
    random.invoke('seed', [42]);
    checar('random.seed determinístico', random.invoke('value').number == primeiro);
    final sorteado = random.invoke('int', [1, 6]).number;
    checar('random.int', sorteado >= 1 && sorteado <= 6 && sorteado.floorToDouble() == sorteado);
    checar('random.unitVector', aprox(comprimento(random.invoke('unitVector')), 1, 1e-3));
    checar('PI/TAU', aprox(numero(m, 'TAU'), numero(m, 'PI') * 2, 1e-9));
    return null;
  }

                                                                                              

  Object? cena() {
    final s = api('scene'), mat = api('material');
    final raiz = s['root'];
    checar('scene.root', !raiz.isNullish && raiz['children'].isArray);
    final antes = s.invoke('count').number;
    final grupo = s.invoke('spawn', ['group', {'name': 'DebugCenario'}]);
    final chao = s.invoke('spawn', [
      'mesh',
      {
        'name': 'Chao',
        'mesh': api('mesh').invoke('plane', [40, 40]),
        'material': mat.invoke('create', [{'baseColor': '#4b6b3a', 'roughness': 0.95}]),
        'rigidBody': {'type': 'static', 'collider': 'box', 'boxSize': v3(40, 0.2, 40), 'center': v3(0, -0.1, 0)},
        'receiveShadows': true,
        'tags': ['chao'],
      },
      grupo,
    ]);
    checar('spawn mesh', textoIgual(chao['kind'], 'mesh') && !chao['mesh'].isNullish && !chao['rigidBody'].isNullish);
    checar('find', s.invoke('find', ['Chao']) == chao);
    checar('findAll', s.invoke('findAll', ['Chao']).length == 1);
    checar('byId', s.invoke('byId', [chao['id']]) == chao);
    checar('byTag', s.invoke('byTag', ['chao']).length >= 1);
    checar('byKind', s.invoke('byKind', ['mesh']).length >= 1);
    final depois = s.invoke('count').number;
    checar('count', depois == antes + 2, depois.toString() + ' vs ' + (antes + 2).toString());
    checar('contains', s.invoke('contains', [grupo, chao]).boolean && s.invoke('contains', [raiz, chao]).boolean);
    final caminho = s.invoke('path', [chao]).string;
    checar('path', caminho.contains('Chao'), caminho);
    var visitados = 0;
    s.invoke('traverse', [(List<Value> args) => visitados++, grupo]);
    checar('traverse', visitados >= 2, visitados);

    final anel = s.invoke('spawnPrimitive', ['torus', {'name': 'Anel', 'position': v3(-4, 1.2, -2), 'scale': 1.5}, grupo]);
    mat.invoke('setColor', [anel, '#3a86ff']);
    mat.invoke('setEmissive', [anel, '#3a86ff', 0.6]);
    torus = anel;
    checar('spawnPrimitive', !anel['mesh'].isNullish && !anel['material'].isNullish);

    final copia = s.invoke('clone', [anel, true, grupo]);
    s.invoke('rename', [copia, 'AnelCopia']);
    api('transform').invoke('setPosition', [copia, v3(-4, 1.2, 2)]);
    checar('clone + rename', textoIgual(copia['name'], 'AnelCopia') && s.invoke('find', ['AnelCopia']) == copia);
    s.invoke('setMeta', [copia, 'origem', 'clone']);
    checar('meta', textoIgual(s.invoke('getMeta', [copia, 'origem']), 'clone'));
    s.invoke('addTag', [copia, 'temporario']);
    checar('addTag/hasTag', s.invoke('hasTag', [copia, 'temporario']).boolean);
    checar('removeTag', verdadeiro(s.invoke('removeTag', [copia, 'temporario'])) && !s.invoke('hasTag', [copia, 'temporario']).boolean);
    s.invoke('setVisible', [copia, false]);
    checar('setVisible', falso(copia['visible']));
    s.invoke('setVisible', [copia, true]);
    s.invoke('destroy', [copia]);
    checar('destroy', s.invoke('find', ['AnelCopia']).isNullish && !s.invoke('isAttached', [copia]).boolean);

    final esfera = s.invoke('spawnPrimitive', ['sphere', {'name': 'Esfera', 'position': v3(4, 0.5, -3)}]);
    s.invoke('reparent', [esfera, grupo]);
    checar('reparent', esfera['parent'] == grupo);
    mat.invoke('setColor', [esfera, '#ffbe0b']);
    s.invoke('addComponent', [esfera, 'rigidBody', {'type': 'dynamic', 'collider': 'sphere', 'radius': 0.5, 'mass': 1}]);
    checar('addComponent', !esfera['rigidBody'].isNullish && textoIgual(esfera.path('rigidBody.type'), 'dynamic'));
    final temporario = s.invoke('spawnPrimitive', ['box', {'name': 'Temporario'}]);
    s.invoke('addComponent', [temporario, 'csg', <String, Object?>{}]);
    checar('addComponent csg', !temporario['csg'].isNullish);
    s.invoke('removeComponent', [temporario, 'csg']);
    checar('removeComponent', temporario['csg'].isNullish);
    s.invoke('destroy', [temporario]);
    checar('kinds/components', contem(s.invoke('kinds'), 'mesh') && contem(s.invoke('components'), 'rigidBody'));
    return null;
  }

  Object? transformacao() {
    final tr = api('transform'), s = api('scene');
    final alvo = s.invoke('spawnPrimitive', ['cone', {'name': 'Cone', 'position': v3(0, 0.5, -6)}]);
    api('material').invoke('setColor', [alvo, '#8338ec']);
    tr.invoke('setPosition', [alvo, v3(2, 0.5, -6)]);
    checar('setPosition', eq3(tr.invoke('position', [alvo]), 2, 0.5, -6, 1e-6));
    tr.invoke('translate', [alvo, v3(0, 1, 0), 'world']);
    checar('translate', aprox(numero(tr.invoke('position', [alvo]), 'y'), 1.5, 1e-3));
    tr.invoke('setRotation', [alvo, v3(0, 90, 0)]);
    checar('setRotation', aprox(numero(tr.invoke('rotation', [alvo]), 'y'), 90, 0.01));
    tr.invoke('rotate', [alvo, v3(0, 45, 0)]);
    final girado = api('math.scalar').invoke('wrapAngle', [tr.invoke('rotation', [alvo])['y']]).number;
    checar('rotate', aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), girado);
    tr.invoke('setScale', [alvo, 2]);
    checar('setScale', aprox(numero(tr.invoke('scale', [alvo]), 'x'), 2, 1e-6));
    tr.invoke('setScale', [alvo, v3(1, 1, 1)]);
    final mundo = tr.invoke('worldPosition', [alvo]).vec3;
    checar('worldPosition', eq3(tr.invoke('position', [alvo]), mundo.x, mundo.y, mundo.z, 1e-3));
    checar('forward/up', aprox(comprimento(tr.invoke('forward', [alvo])), 1, 1e-3) && aprox(comprimento(tr.invoke('up', [alvo])), 1, 1e-3));
    tr.invoke('lookAt', [alvo, v3(0, 1.5, 0)]);
    checar('distance', tr.invoke('distance', [alvo, v3(2, 1.5, -6)]).number < 0.01);
    checar('directionTo', aprox(comprimento(tr.invoke('directionTo', [alvo, v3(0, 1.5, 0)])), 1, 1e-3));
    final limites = tr.invoke('bounds', [alvo]);
    checar('bounds', !limites.isNullish && numero(limites['max'], 'y') > numero(limites['min'], 'y'));
    checar('worldMatrix', tr.invoke('worldMatrix', [alvo]).length == 16 && tr.invoke('localMatrix', [alvo]).length == 16);
    final local = tr.invoke('worldToLocal', [alvo, tr.invoke('localToWorld', [alvo, v3(1, 0, 0)])]);
    checar('localToWorld/worldToLocal', eq3(local, 1, 0, 0, 1e-3));
    return null;
  }

  Object? malhas() {
    final me = api('mesh'), s = api('scene'), csg = api('csg'), mat = api('material');
    final caixa = me.invoke('box', [1, 1, 1]);
    final triangulos = me.invoke('triangleCount', [caixa]).number;
    checar('mesh.box', me.invoke('vertexCount', [caixa]).number > 0 && triangulos == 12, triangulos);
    final esfera = me.invoke('sphere', [0.65, 16, 12]);
    final furado = csg.invoke('boolean', [caixa, esfera, 'subtract']);
    checar('csg.boolean', me.invoke('triangleCount', [furado]).number > 12);
    final ator = s.invoke('spawn', [
      'mesh',
      {
        'name': 'CaixaFurada',
        'mesh': furado,
        'material': mat.invoke('create', [{'baseColor': '#e63946', 'roughness': 0.4, 'metallic': 0.2}]),
        'position': v3(4, 0.5, 2),
      },
    ]);
    checar('spawn malha CSG', !ator['mesh'].isNullish);
    checar('csg.operations', contem(csg.invoke('operations'), 'union'));
    final tri = me.invoke('create', [
      {
        'name': 'Triangulo',
        'positions': [-1, 0, 0, 1, 0, 0, 0, 1.5, 0],
        'uvs': [0, 0, 1, 0, 0.5, 1],
        'indices': [0, 1, 2],
      },
    ]);
    me.invoke('computeNormals', [tri]);
    checar('mesh.create + computeBounds', numero(me.invoke('computeBounds', [tri])['max'], 'y') >= 1.5);
    final dupla = me.invoke('merge', [tri, me.invoke('flipWinding', [me.invoke('clone', [tri])])]);
    checar('mesh.merge', me.invoke('triangleCount', [dupla]).number == 2);
    s.invoke('spawn', [
      'mesh',
      {
        'name': 'Triangulo',
        'mesh': dupla,
        'material': mat.invoke('create', [{'baseColor': '#06d6a0', 'doubleSided': true}]),
        'position': v3(7, 0, -2),
      },
    ]);
    final grande = me.invoke('scale', [me.invoke('translate', [me.invoke('clone', [caixa]), v3(0, 0.5, 0)]), 2]);
    checar('mesh.translate/scale', numero(me.invoke('computeBounds', [grande])['max'], 'y') > 1.9);
    final distancia = me.invoke('raycast', [api('math.ray').invoke('create', [v3(0, 5, 0), v3(0, -1, 0)]), grande]);
    checar('mesh.raycast', distancia.isNumber && distancia.number > 0);
    final vertices = me.invoke('vertexCount', [caixa]).integer;
    checar('positions/indices', me.invoke('positions', [caixa]).length == vertices * 3 && me.invoke('indices', [caixa]).length == 36);
    checar('primitivas extras', me.invoke('triangleCount', [me.invoke('torusKnot')]).number > 0 && me.invoke('triangleCount', [me.invoke('capsule')]).number > 0);
    return null;
  }

                                                                                                

  Object? materiais() {
    final mat = api('material'), s = api('scene'), tex = api('texture');
    final base = mat.invoke('create', [{'name': 'DebugBase', 'baseColor': '#d98c2b', 'roughness': 0.5, 'metallic': 0.1}]);
    checar('material.create', numero(base, 'roughness') == 0.5);
    final copia = mat.invoke('clone', [base]);
    mat.invoke('set', [copia, {'roughness': 1, 'emissive': '#ffffff', 'emissiveIntensity': 2}]);
    checar('material.clone/set', numero(copia, 'roughness') == 1 && numero(base, 'roughness') == 0.5);
    final caixa = s.invoke('spawnPrimitive', ['box', {'name': 'CaixaPintada', 'position': v3(-7, 0.5, 2)}]);
    mat.invoke('assign', [caixa, base]);
    checar('material.assign/of', !mat.invoke('of', [caixa]).isNullish);
    mat.invoke('own', [caixa]);
    mat.invoke('setColor', [caixa, '#d98c2b']);
    final desenho = tex.invoke('canvas', [64, 64]);
    desenho.invoke('update');
    mat.invoke('setTexture', [caixa, 'baseColorMap', desenho['texture']]);
    checar('texture.canvas + setTexture', mat.invoke('hasAnyTexture', [mat.invoke('of', [caixa])]).boolean && tex.invoke('isTexture', [desenho['texture']]).boolean);
    checar('material.slots', mat.invoke('slots').length > 0);
    checar('materials.list', api('materials').invoke('list').isArray);
    final sombreado = mat.invoke('fromShader', ['DebugSuperficie', {'glow': v3(1, 0.45, 0.1), 'speed': 2}]);
    checar('material.fromShader', !sombreado.isNullish);
    if (!sombreado.isNullish) {
      final esfera = s.invoke('spawnPrimitive', ['sphere', {'name': 'EsferaShader', 'position': v3(0, 1, -3), 'scale': 1.4}]);
      mat.invoke('assign', [esfera, sombreado]);
      mat.invoke('uniforms', [esfera]).invoke('set', ['speed', 3]);
      checar('material.uniforms.list', mat.invoke('uniforms', [esfera]).invoke('list').length >= 1);
    }
    return null;
  }

  Object? luzes() {
    final l = api('light');
    checar('light.types', contem(l.invoke('types'), 'point') && contem(l.invoke('localTypes'), 'spot'));
    final lampada = l.invoke('spawn', ['point', {'name': 'Lampada', 'position': v3(0, 3, 0), 'color': '#ffd166', 'intensity': 60, 'range': 14}]);
    checar('light.spawn', !lampada['light'].isNullish && textoIgual(lampada.path('light.type'), 'point'));
    l.invoke('set', [lampada, {'intensity': 80}]);
    checar('light.set', numero(lampada['light'], 'intensity') == 80);
    l.invoke('setTemperature', [lampada, 3200]);
    checar('setTemperature', numero(lampada['light'], 'temperature') == 3200);
    final foco = l.invoke('spawn', [
      'spot',
      {
        'name': 'Holofote', 'position': v3(4, 4, 0), 'rotation': v3(-90, 0, 0), 'intensity': 120, 'range': 16,
        'innerAngle': 20, 'outerAngle': 35, 'color': '#ffffff',
      },
    ]);
    checar('spot', textoIgual(foco.path('light.type'), 'spot'));
    final convertido = l.invoke('convert', [foco, 'disc']);
    checar('light.convert', textoIgual(convertido['type'], 'disc') && textoIgual(foco.path('light.type'), 'disc'));
    l.invoke('convert', [foco, 'spot']);
    final presets = l.invoke('presets');
    checar('light.presets', presets.length > 0);
    if (presets.length > 0) {
      final primeiro = presets[0];
      final preset = l.invoke('spawn', [primeiro['id'], {'name': 'LuzPreset', 'position': v3(-4, 2.5, 4)}]);
      checar('light.fromPreset', !preset['light'].isNullish && l.invoke('fromPreset', [primeiro['id']])['type'] == primeiro['type']);
    }
    checar('light.all', l.invoke('all', [{'local': true}]).length >= 2);
    checar('effectiveRange', l.invoke('effectiveRange', [lampada]).number > 0);
    checar('light.isLocal', verdadeiro(l.invoke('isLocal', [lampada])));
    checar('temperatureToColor', !l.invoke('temperatureToColor', [6500]).isNullish);
    l.invoke('setColor', [lampada, '#ffffff']);
    checar('light.setColor', eq3(lampada.path('light.color'), 1, 1, 1, 0.01));
    return null;
  }

  Object? ceu() {
    final sky = api('sky'), mundo = api('world');
    sky.invoke('set', [{'timeOfDay': 10.5, 'haze': 0.3, 'clouds': {'enabled': true, 'coverage': 0.45}}]);
    checar('sky.set', aprox(numero(sky, 'timeOfDay'), 10.5, 1e-3) && verdadeiro(sky.path('clouds.enabled')));
    checar('sky.isDay', verdadeiro(sky['isDay']));
    checar('sky.sunDirection', numero(sky.invoke('sunDirection'), 'y') > 0);
    final hora = sky.invoke('formatTimeOfDay', [10.5]).string;
    checar('sky.formatTimeOfDay', hora.contains(':'), hora);
    checar('sky.wrapTimeOfDay', sky.invoke('wrapTimeOfDay', [25]).number == 1);
    checar('sky.presets', sky.invoke('presets').length > 0);
    assinar(sky.invoke('onHourChanged', [(Value hora) => info('Hora do céu: ' + hora.string)]));
    sky['cycleSpeed'] = 0;
    checar('sky.cycleSpeed', numero(sky, 'cycleSpeed') == 0);
    checar('world.gravity', numero(mundo['gravity'], 'y') < 0);
    mundo['wind'].invoke('set', [{'speed': 2, 'direction': 45}]);
    checar('world.wind.set', numero(mundo['wind'], 'speed') == 2);
    return null;
  }

  Object? camera() {
    final c = api('camera');
    checar('camera.fov', numero(c, 'fov') > 0 && numero(c, 'aspect') > 0);
    checar('camera.near/far', numero(c, 'near') > 0 && numero(c, 'far') > numero(c, 'near'));
    final viewport = c['viewport'];
    checar('viewport', numero(viewport, 'width') > 0);
    final naTela = c.invoke('worldToScreen', [v3(0, 0, 0)]);
    checar('worldToScreen', naTela.isNullish || naTela['x'].isNumber);
    final raio = c.invoke('screenToRay', [numero(viewport, 'width') / 2, numero(viewport, 'height') / 2]);
    checar('screenToRay', raio.isNullish || aprox(comprimento(raio['direction']), 1, 0.01));
    checar('viewMatrix', c['viewMatrix'].length == 16);
    final jogador = c['player'];
    jogador.invoke('set', [{'distance': 7, 'pitch': 18}]);
    checar('player.set', numero(jogador['settings'], 'distance') == 7);
    checar('distanceTo', c.invoke('distanceTo', [v3(0, 0, 0)]).number >= 0);
    checar('camera.position', !c['position'].isNullish && !c['forward'].isNullish);
    assinar(c.invoke('onMainChanged', [
      (Value entidade) => info(entidade.isNullish ? 'Câmera principal: editor/jogador' : 'Câmera principal: ' + nomeDe(entidade)),
    ]));
    return null;
  }

  Object? pos() {
    final p = api('post');
    checar('post.toneMappers', p.invoke('toneMappers').length > 0);
    p.invoke('set', [
      {
        'bloom': {'enabled': true, 'intensity': 0.5, 'threshold': 1, 'softKnee': 0.5, 'radius': 0.6},
        'vignette': {'enabled': true, 'intensity': 0.35, 'smoothness': 0.5, 'roundness': 1},
      },
    ]);
    checar('post.set', verdadeiro(p.path('bloom.enabled')) && verdadeiro(p.path('vignette.enabled')));
    p['exposure'] = 1.05;
    checar('post.exposure', aprox(numero(p, 'exposure'), 1.05, 1e-3));
    p['toneMapper'] = 'agx';
    checar('post.toneMapper', textoIgual(p['toneMapper'], 'agx'));
    checar('post.presets', p.invoke('presets').length > 0);
    final custom = p['custom'];
    final novo = custom.invoke('add', [{'fragment': 'DebugPost', 'name': 'DebugPost', 'uniforms': {'tint': v3(0.15, 0.05, 0.3), 'strength': 0.6}}]);
    efeito = novo;
    checar('post.custom.add', !novo.isNullish && !custom.invoke('get', ['DebugPost']).isNullish);
    novo['uniforms'].invoke('set', ['strength', 0.8]);
    checar('efeito.uniforms.list', novo['uniforms'].invoke('list').length >= 2);
    return null;
  }

  Object? render() {
    final r = api('render');
    checar('render.passNames', r.invoke('passNames').length > 0);
    checar('render.stats', r.path('stats.drawCalls').isNumber);
    checar('render.frame', r.path('frame.width').isNumber);
    assinar(r.invoke('onAfterFrame', [() => renders++]));
    r['showGrid'] = false;
    checar('render.showGrid', falso(r['showGrid']));
    checar('render.pixelRatio', numero(r, 'pixelRatio') > 0);
    return null;
  }

                                                                                             

  Object? fisica() {
    final ph = api('physics'), s = api('scene');
    checar('physics.enabled', verdadeiro(ph['enabled']));
    checar('physics.gravity', numero(ph['gravity'], 'y') < 0);
    checar('physics.settings', numero(ph['settings'], 'fixedTimestep') > 0);
    for (var i = 1; i <= 5; i++) {
      final indice = i - 1;
      final caixa = s.invoke('spawnPrimitive', [
        'box',
        {
          'name': 'Caixa' + i.toString(),
          'position': v3(-2 + indice * 1.1, 3 + indice * 1.2, 3),
          'rigidBody': {'type': 'dynamic', 'collider': 'box', 'mass': 2, 'restitution': 0.3},
          'tags': ['caixa'],
        },
      ]);
      api('material').invoke('setColor', [caixa, api('math.color').invoke('hsl', [30 + i * 12, 0.7, 0.5])]);
    }
    final caixas = s.invoke('byTag', ['caixa']);
    final primeira = caixas[0];
    checar('caixas dinâmicas', caixas.length == 5 && ph.invoke('hasBody', [primeira]).boolean);
    final corpo = ph.invoke('bodyOf', [primeira]);
    checar('bodyOf', verdadeiro(corpo['isDynamic']) && numero(corpo, 'mass') > 0);
    corpo.invoke('applyImpulse', [v3(0, 2, 0)]);
    corpo.invoke('applyTorque', [v3(0, 1, 0)]);
    corpo.invoke('setMaterial', [{'friction': 0.8}]);
    corpo.invoke('wake');
    checar('body.linearVelocity', !corpo['linearVelocity'].isNullish);
    checar('bodies()', ph.invoke('bodies').length >= 6);
    final hit = ph.invoke('raycast', [v3(0, 5, 0), v3(0, -1, 0), 20]);
    checar('physics.raycast', !hit.isNullish && !hit['entity'].isNullish);
    checar('raycastAll', ph.invoke('raycastAll', [v3(0, 5, 0), v3(0, -1, 0), 20]).length >= 1);
    checar('overlapSphere', ph.invoke('overlapSphere', [v3(0, 3, 3), 4]).isArray);
    checar('massProperties', numero(ph.invoke('massProperties', [primeira]), 'mass') > 0);
    checar('colliderVolume', ph.invoke('colliderVolume', [primeira]).number > 0);
    final formas = ph['shapes'];
    checar('shapes.sphere volume', aprox(formas.invoke('volume', [formas.invoke('sphere', [1])]).number, 4.18879, 0.01));
    assinar(ph.invoke('onCollisionBegin', [
      (Value e) {
        colisoes++;
        if (colisoes > 3) return;
        info('Colisão: ' + nomeDe(e['a']) + ' × ' + nomeDe(e['b']) + ' (impulso ' + arred(numero(e['contact'], 'impulse')).toString() + ')');
      },
    ]));
    assinar(ph.invoke('onOutOfBounds', [(Value entidade) => aviso(nomeDe(entidade) + ' caiu do mundo')]));
    final gatilho = s.invoke('spawn', ['group', {'name': 'Gatilho', 'position': v3(0, 1, 3), 'trigger': {'shape': 'box', 'size': v3(3, 2, 3)}}]);
    checar('trigger spawn', !gatilho.isNullish && s.invoke('isAttached', [gatilho]).boolean);
    checar('physics.stats', ph.path('stats.bodies').isNumber);
    return null;
  }

  Object? personagem() {
    final ch = api('character'), pl = api('player');
    final novo = ch.invoke('spawn', [{'name': 'Heroi', 'position': v3(0, 1.2, 8), 'character': {'walkSpeed': 4, 'runSpeed': 7, 'jumpHeight': 1.4}}]);
    heroi = novo;
    checar('character.spawn', !novo['character'].isNullish && ch.invoke('has', [novo]).boolean);
    final c = ch.invoke('of', [novo]);
    checar('character.of', c['isGrounded'].isBoolean);
    checar('settingsOf', numero(ch.invoke('settingsOf', [novo]), 'walkSpeed') == 4);
    pl.invoke('possess', [novo]);
    checar('player.possess', pl['possessed'] == novo && verdadeiro(pl['isPossessing']));
    assinar(ch.invoke('onJumped', [(Value e) => info(nomeDe(e['entity']) + ' pulou')]));
    assinar(pl.invoke('onPossessed', [(Value entidade) => info('Possuindo ' + nomeDe(entidade))]));
    checar('character.all', ch.invoke('all').length >= 1);
    checar('player.spawnPoint', !pl['spawnPoint'].isNullish);
    checar('character.velocity', !c['velocity'].isNullish && !c['position'].isNullish);
    return null;
  }

  Object? terreno() {
    final te = api('terrain');
    checar('terrain.presets', te.invoke('presets').length > 0);
    final colinas = te.invoke('spawn', [{'name': 'Colinas', 'size': 48, 'resolution': 65, 'preset': 'hills', 'seed': 7, 'position': v3(0, -6, -70)}]);
    checar('terrain.spawn', !colinas['terrain'].isNullish && te.invoke('all').length >= 1);
    checar('terrain.of', numero(te.invoke('of', [colinas]), 'resolution') == 65);
    checar('heightAt', te.invoke('heightAt', [v3(0, 0, -70), colinas]).isNumber);
    checar('contains', te.invoke('contains', [v3(0, 0, -70), colinas]).boolean && !te.invoke('contains', [v3(500, 0, 0), colinas]).boolean);
    te.invoke('sculpt', [colinas, 'raise', v3(5, 0, -70), {'radius': 6, 'strength': 1}, 1]);
    te.invoke('markDirty', [colinas]);
    final grama = te['grass'];
    grama.invoke('set', [colinas, {'enabled': true, 'density': 0.5}]);
    checar('grass.set', verdadeiro(grama.invoke('settingsOf', [colinas])['enabled']));
    final agua = te['water'];
    agua.invoke('set', [colinas, {'enabled': true, 'level': -2}]);
    checar('water.set', verdadeiro(agua.invoke('settingsOf', [colinas])['enabled']));
    checar('terrain.raycast', !te.invoke('raycast', [v3(0, 50, -70), v3(0, -1, 0), colinas]).isNullish);
    return null;
  }

                                                                                             

  void soltarCaixa() {
    final random = api('math.random');
    final caixa = api('scene').invoke('spawnPrimitive', [
      'box',
      {
        'name': 'CaixaSolta',
        'position': v3(random.invoke('range', [-3, 3]).number, 6, random.invoke('range', [0, 4]).number),
        'rigidBody': {'type': 'dynamic', 'collider': 'box', 'mass': 1},
        'tags': ['caixa'],
      },
    ]);
    api('material').invoke('setColor', [caixa, random.invoke('color')]);
    pontos++;
    api('gui').invoke('bind', ['pontos', pontos]);
    api('events').invoke('emit', ['debug.caixa', {'nome': caixa['name']}]);
  }

  Object? interfaceGrafica() {
    final g = api('gui');
    g.invoke('css', ['DebugEstilo']);
    final hud = g.invoke('html', ['DebugHud', {'id': 'debug-hud'}]);
    checar('gui.html', !hud.isNullish && !g.invoke('element', ['#debug-hud']).isNullish);
    final icone = g.invoke('svg', ['DebugIcone', {'id': 'debug-icone'}]);
    checar('gui.svg', !icone.isNullish);
    final slot = g.invoke('element', ['[data-slot=icone]']);
    if (!slot.isNullish && !icone.isNullish) slot.invoke('appendChild', [icone]);
    checar('gui.bind', g.invoke('bind', ['linguagem', linguagem]).number >= 1);
    g.invoke('bind', ['titulo', 'Helix · Debug']);
    assinar(g.invoke('onAction', ['caixa', () => soltarCaixa()]));
    assinar(g.invoke('onAction', ['reiniciar', () => api('play').invoke('restart')]));
    checar('gui.elements', g.invoke('elements', ['[data-bind]']).length >= 5);
    checar('gui.size', numero(g['size'], 'width') > 0);
    Map<String, Object?> escala(num scale, num offset) => {'scale': scale, 'offset': offset};
    final declarativa = g.invoke('create', ['DebugTela', {'referenceSize': {'x': 1280, 'y': 720}}]);
    final painel = g.invoke('add', [
      declarativa,
      'frame',
      {
        'name': 'Painel',
        'rect': {
          'position': {'x': escala(1, -236), 'y': escala(0, 16)},
          'size': {'x': escala(0, 220), 'y': escala(0, 48)},
        },
      },
    ]);
    g.invoke('add', [declarativa, 'text', {'name': 'Rotulo', 'text': 'Tela declarativa OK'}, painel.path('node.id')]);
    checar('gui.add/find', textoIgual(g.invoke('find', [declarativa, 'Rotulo'])['kind'], 'text'));
    g.invoke('setText', [declarativa, 'Rotulo', 'Tela declarativa OK · ' + linguagem]);
                                                                                       
    return g.invoke('show', [declarativa, 'debug-tela']).invoke('then', [
      (Value mostrada) {
        tela = mostrada;
        checar('gui.show/isShown', !mostrada.isNullish && api('gui').invoke('isShown', [mostrada]).boolean);
        checar('gui.kinds', contem(api('gui').invoke('kinds'), 'button'));
      },
    ]);
  }

  Object? audio() {
    final a = api('audio'), s = api('scene');
    checar('audio.supported', a['supported'].isBoolean);
    final mixer = a['mixer'];
    mixer.invoke('setVolumeDb', ['sfx', -3]);
    checar('mixer.setVolumeDb', numero(mixer.invoke('bus', ['sfx']), 'volumeDb') == -3);
    checar('audio.clips', a.invoke('clips').isArray);
    final fonte = s.invoke('spawn', ['sound', {'name': 'FonteSonora', 'position': v3(3, 1, 3), 'audioSource': {'trigger': 'manual', 'spatial': true}}]);
    checar('spawn sound', !fonte['audioSource'].isNullish);
    final fontes = a['sources'];
    fontes.invoke('set', [fonte, {'volumeDb': -4}]);
    checar('sources.set', numero(fonte['audioSource'], 'volumeDb') == -4);
    checar('sources.isPlaying', falso(fontes.invoke('isPlaying', [fonte])));
    return null;
  }

  Object? vfx() {
    final v = api('vfx');
    final ids = v['templates'].invoke('ids');
    checar('vfx.templates', ids.length > 0);
    checar('vfx.moduleKinds', v.invoke('moduleKinds').length > 0);
    var doc = v.invoke('fromTemplate', [ids[0], 'DebugFaiscas']);
    doc = v.invoke('addEmitter', [doc, {'name': 'Extra', 'maxParticles': 50}]);
    doc = v.invoke('set', [doc, {'loop': true}]);
    checar('vfx.fromTemplate/addEmitter', doc['emitters'].length >= 2 && verdadeiro(doc['loop']));
    return v.invoke('save', [doc, 'DebugFaiscas']).invoke('then', [
      (Value ativo) {
        final efeitos = api('vfx');
        checar('vfx.save', !ativo.isNullish && textoIgual(ativo['kind'], 'vfx'));
        final ator = efeitos.invoke('emitAt', [ativo, v3(0, 1.5, -8), {'destroyWhenFinished': false}]);
        checar('vfx.emitAt', verdadeiro(efeitos.invoke('has', [ator])));
        efeitos.invoke('burst', [ator, 20]);
        checar('vfx.stats', efeitos.invoke('stats')['effects'].isNumber);
      },
    ]);
  }

                                                                                            

  void aoTeclar(Value e) {
    if (e['repeat'].boolean) return;
    switch (e['code'].string) {
      case 'KeyR':
        api('play').invoke('restart');
      case 'KeyB':
        soltarCaixa();
      case 'KeyE':
        api('events').invoke('emit', ['debug.ping', {'origem': 'teclado', 'quadro': api('time')['frame']}]);
      case 'KeyF':
        api('camera').invoke('shake', [0.4, 0.6]);
      case 'KeyG':
        final fx = efeito;
        if (fx != null) {
          final ligado = !fx['enabled'].boolean;
          fx['enabled'] = ligado;
          info(ligado ? 'Efeito DebugPost ligado' : 'Efeito DebugPost desligado');
        }
      case 'KeyT':
        final tm = api('time');
        tm['scale'] = numero(tm, 'scale') == 1 ? 0.3 : 1;
        info('time.scale = ' + numero(tm, 'scale').toString());
      case 'KeyH':
        final t = tela;
        if (t != null) {
          final g = api('gui');
          if (g.invoke('isShown', [t]).boolean) {
            g.invoke('hide', [t]);
          } else {
            g.invoke('show', [t, 'debug-tela']);
          }
        }
      case 'KeyL':
        info('Luzes locais: ' + api('light').invoke('all', [{'local': true}]).items.map((luz) => nomeDe(luz['entity'])).join(', '));
    }
  }

  void cliqueNaCena(double x, double y) {
    final c = api('camera');
    final alvo = c.invoke('pick', [x, y]);
    final ponto = c.invoke('pickPoint', [x, y]);
    if (!alvo.isNullish) info('Clique em ' + nomeDe(alvo));
    if (!ponto.isNullish) api('debug').invoke('sphere', [ponto, 0.3, '#ff006e', 2]);
  }

  Object? entrada() {
    final input = api('input');
    final acoes = input['actions'];
    acoes.invoke('define', ['pular', ['Space', 'Gamepad:0']]);
    acoes.invoke('define', ['soltar', ['KeyB']]);
    checar('actions.define/bindings', acoes.invoke('bindings', ['pular']).length >= 1);
    checar('action()', textoIgual(input.invoke('action', ['pular'])['name'], 'pular') && acoes.invoke('down', ['pular']).isBoolean);
    checar('isDown', falso(input.invoke('isDown', ['KeyW'])));
    checar('pointer', input.path('pointer.x').isNumber);
    checar('gamepads', input.invoke('gamepads').isArray);
    checar('axis2d', input.invoke('axis2d', [{'up': 'KeyW', 'down': 'KeyS', 'left': 'KeyA', 'right': 'KeyD'}])['x'].isNumber);
    final teclas = input.invoke('keysDown');
    checar('keysDown', teclas.isObject || teclas.isArray);
    assinar(input.invoke('onKeyDown', [(Value e) => aoTeclar(e)]));
    assinar(input.invoke('onPointerDown', [
      (Value e) {
        if (numero(e, 'button') == 0) cliqueNaCena(numero(e, 'x'), numero(e, 'y'));
      },
    ]));
    assinar(input.invoke('onGamepadButtonDown', [(Value e) => info('Gamepad ' + numero(e, 'pad').toString() + ' botão ' + numero(e, 'button').toString())]));
    return null;
  }

  Object? eventos() {
    final ev = api('events'), play = api('play');
                                                                                    
    var recebido = Value.none;
    final desligar = ev.invoke('on', ['debug.ping', (Value payload) => recebido = payload]);
    checar('events.emit conta ouvintes', ev.invoke('emit', ['debug.ping', {'origem': 'teste'}]).number == 1);
    checar('events.on recebe', !recebido.isNullish && textoIgual(recebido['origem'], 'teste'));
    checar('listenerCount', ev.invoke('listenerCount', ['debug.ping']).number == 1);
    desligar.call();
    checar('unsubscribe', ev.invoke('listenerCount', ['debug.ping']).number == 0);
    var umaVez = 0;
    ev.invoke('once', ['debug.once', () => umaVez++]);
    ev.invoke('emit', ['debug.once']);
    ev.invoke('emit', ['debug.once']);
    checar('events.once', umaVez == 1);
    assinar(ev.invoke('on', ['debug.ping', (Value payload) => info('ping de ' + payload['origem'].string)]));
    assinar(ev.invoke('on', ['debug.caixa', (Value payload) => depurar('caixa ' + payload['nome'].string)]));
    var doAtor = 0;
    final anel = torus ?? Value.none;
    assinar(ev.invoke('onEntity', [anel, 'toque', () => doAtor++]));
    ev.invoke('emitEntity', [anel, 'toque']);
    checar('onEntity/emitEntity', doAtor == 1);
    assinar(play.invoke('onStopped', [() => info('play.onStopped disparou')]));
    assinar(play.invoke('onPaused', [() => info('pausado')]));
    assinar(play.invoke('onResumed', [() => info('retomado')]));
    return null;
  }

                                                                                    
  Object? tempo() {
    final tm = api('time');
    checar('time.now', numero(tm, 'now') >= 0 && numero(tm, 'frame') >= 0);
    checar('time.delta', numero(tm, 'delta') >= 0 && numero(tm, 'fixedDelta') > 0);
    final inicio = numero(tm, 'now');
    return tm.invoke('wait', [0.1]).invoke('then', [
      () {
        final relogio = api('time');
        final decorrido = numero(relogio, 'now') - inicio;
        checar('time.wait', decorrido >= 0.09, arred(decorrido));
        final quadro = relogio['frame'].integer;
        return relogio.invoke('waitFrames', [2]).invoke('then', [
          () {
            final depois = api('time');
            final agora = depois['frame'].integer;
            checar('time.waitFrames', agora >= quadro + 2, agora - quadro);
            assinar(depois.invoke('every', [2, () => api('gui').invoke('bind', ['atores', api('scene').invoke('count')])]));
            var disparou = false;
            depois.invoke('delay', [0.2, () => disparou = true]);
            return depois.invoke('wait', [0.3]).invoke('then', [() => checar('time.delay', disparou)]);
          },
        ]);
      },
    ]);
  }

  Object? dados() {
    return api('storage').invoke('ready').invoke('then', [
      () {
        final st = api('storage');
        final atual = st.invoke('get', ['execucoes', 0]);
        final execucoes = (atual.isNumber ? atual.integer : 0) + 1;
        return st.invoke('set', ['execucoes', execucoes]).invoke('then', [
          () {
            final storage = api('storage');
            checar('storage.get/set', storage.invoke('get', ['execucoes']).integer == execucoes && storage.invoke('has', ['execucoes']).boolean, execucoes);
            info('Execução nº ' + execucoes.toString() + ' deste jogo de teste neste projeto.');
            return api('assets').invoke('data', ['DebugConfig']).invoke('then', [
              (Value cfg) {
                checar('assets.data (TOML)', !cfg.isNullish && !cfg['jogador'].isNullish && numero(cfg['jogador'], 'velocidade') == 6.5);
                return api('assets').invoke('text', ['DebugConfig']).invoke('then', [
                  (Value texto) {
                    checar('assets.text', texto.string.contains('velocidade'));
                    final ativos = api('assets');
                    checar('assets.byName', !ativos.invoke('byName', ['DebugJogo', 'script']).isNullish);
                    checar('assets.exists', ativos.invoke('exists', ['DebugUtil']).boolean && !ativos.invoke('exists', ['NaoExiste']).boolean);
                    checar('assets.search', ativos.invoke('search', ['Debug']).length >= 5);
                    checar('project.name', api('project')['name'].isString);
                    checar('project.stats', numero(api('project')['stats'], 'entities') > 0);
                    checar('net.localPlayer', verdadeiro(api('net').path('localPlayer.local')));
                    checar('play.state', textoIgual(api('play')['state'], 'playing') && verdadeiro(api('play')['isRunning']));
                  },
                ]);
              },
            ]);
          },
        ]);
      },
    ]);
  }

                                                                            
  Object? lancar() {
    throw StateError('erro proposital: a exceção vira ERRO na cadeia');
  }

                                                                                             

  late final areas = <Area>[
    Area('Núcleo', nucleo),
    Area('Módulo (require)', modulo),
    Area('Matemática', matematica),
    Area('Cena', cena),
    Area('Transformações', transformacao),
    Area('Malhas e CSG', malhas),
    Area('Materiais', materiais),
    Area('Luzes', luzes),
    Area('Céu e mundo', ceu),
    Area('Câmera', camera),
    Area('Pós-processamento', pos),
    Area('Render', render),
    Area('Física', fisica),
    Area('Personagem e jogador', personagem),
    Area('Terreno', terreno),
    Area('Interface', interfaceGrafica),
    Area('Áudio', audio),
    Area('VFX', vfx),
    Area('Entrada', entrada),
    Area('Eventos', eventos),
    Area('Tempo e tarefas', tempo),
    Area('Dados, projeto e rede', dados),
    Area('Erro proposital (exceção Dart)', lancar, esperaErro: true),
  ];

  void areaOk(Area a) {
    if (a.esperaErro) {
      checar('a exceção deveria ter chegado à cadeia', false);
      return;
    }
    depurar('ok ' + a.nome);
  }

  void areaErro(Area a, Value causa) {
    final mensagem = causa.isObject ? causa['message'].string : causa.string;
    if (a.esperaErro) {
      checar('a exceção chega como erro da promessa', mensagem.contains('proposital'), mensagem);
      return;
    }
    falhas++;
`;
}
