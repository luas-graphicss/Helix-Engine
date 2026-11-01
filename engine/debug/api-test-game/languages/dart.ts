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
`;
}
