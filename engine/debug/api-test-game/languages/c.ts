import type { GameSources } from '../types';
export function cGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
#include "helix.h"
#include "DebugUtil.h"
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#define LINGUAGEM "C"
#define PI 3.14159265358979323846
#define MAX_ASSINATURAS 48

static int quadros, passos_fisica, late_updates, renders, colisoes, checagens, falhas, pontos;
static double hud_timer;
                                                                       
static hx_ref torus = HX_NONE, heroi = HX_NONE, efeito = HX_NONE, tela = HX_NONE, util = HX_NONE;
static hx_ref assinaturas[MAX_ASSINATURAS];
static int n_assinaturas;

                                                                                         

static hx_ref api(const char* caminho) { return hx_path(caminho); }
static hx_ref str(const char* texto) { return hx_string(texto); }
static hx_ref num(double valor) { return hx_number(valor); }
static hx_ref v3(double x, double y, double z) { return hx_vec3_new(x, y, z); }
static hx_ref cb(hx_callback fn) { return hx_function(fn, NULL, NULL); }
static hx_ref keep(hx_ref valor) { return hx_retain(valor); }
static void drop(hx_ref* slot) {
  if (*slot) hx_release(*slot);
  *slot = HX_NONE;
}

                                                                             
static hx_ref nums(const double* valores, int quantidade) {
  hx_ref lista = hx_array();
  for (int i = 0; i < quantidade; i++) hx_set_index(lista, i, hx_number(valores[i]));
  return lista;
}

                                                     
static hx_ref strs(int quantidade, ...) {
  hx_ref lista = hx_array();
  va_list ap;
  va_start(ap, quantidade);
  for (int i = 0; i < quantidade; i++) hx_set_index(lista, i, hx_string(va_arg(ap, const char*)));
  va_end(ap);
  return lista;
}

                                                                                                                    
static hx_ref opts(const char* chave, ...) {
  hx_ref objeto = hx_object();
  va_list ap;
  va_start(ap, chave);
  for (const char* atual = chave; atual != NULL; atual = va_arg(ap, const char*)) {
    hx_ref valor = va_arg(ap, hx_ref);
    hx_set(objeto, atual, valor);
  }
  va_end(ap);
  return objeto;
}

static hx_ref xy(double x, double y) { return opts("x", num(x), "y", num(y), NULL); }
static hx_ref escala(double scale, double offset) { return opts("scale", num(scale), "offset", num(offset), NULL); }

static int str_eq(hx_ref valor, const char* esperado) { return hx_equals(valor, hx_string(esperado)); }
static int verdadeiro(hx_ref valor) { return hx_type(valor) == HX_BOOLEAN && hx_to_boolean(valor); }
static int falso(hx_ref valor) { return hx_type(valor) == HX_BOOLEAN && !hx_to_boolean(valor); }
static int aprox(double a, double b, double epsilon) { return fabs(a - b) <= epsilon; }
static double numero(hx_ref objeto, const char* chave) { return hx_get_number(objeto, chave); }

                                                                                            
static int eq3(hx_ref vetor, double x, double y, double z, double epsilon) {
  return hx_to_boolean(hx_invoke3(api("math.vec3"), "equals", vetor, v3(x, y, z), num(epsilon)));
}
static double comprimento(hx_ref vetor) { return hx_to_number(hx_invoke1(api("math.vec3"), "length", vetor)); }

static int contem(hx_ref lista, const char* texto) {
  int n = hx_length(lista);
  for (int i = 0; i < n; i++)
    if (str_eq(hx_index(lista, i), texto)) return 1;
  return 0;
}

static void registrar(const char* metodo, const char* fmt, ...) {
  char mensagem[768];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(mensagem, sizeof mensagem, fmt, ap);
  va_end(ap);
  hx_invoke2(api("log"), metodo, str("Debug"), str(mensagem));
}
#define info(...) registrar("info", __VA_ARGS__)
#define aviso(...) registrar("warn", __VA_ARGS__)
#define erro(...) registrar("error", __VA_ARGS__)
#define depurar(...) registrar("debug", __VA_ARGS__)

static void checar(const char* nome, int condicao) {
  checagens++;
  if (condicao) return;
  falhas++;
  erro("FALHOU %s", nome);
}

static void checarf(const char* nome, int condicao, const char* fmt, ...) {
  checagens++;
  if (condicao) return;
  falhas++;
  char detalhe[256];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(detalhe, sizeof detalhe, fmt, ap);
  va_end(ap);
  erro("FALHOU %s: %s", nome, detalhe);
}

static void assinar(hx_ref desligar) {
  if (!hx_is_function(desligar) || n_assinaturas >= MAX_ASSINATURAS) return;
  assinaturas[n_assinaturas++] = keep(desligar);
}

                                                                                          

static hx_ref nucleo(void) {
  hx_ref raiz = hx_root();
  hx_ref engine = api("engine");
  char nome[64], versao[32], api_versao[32], contexto[16];
  hx_string_copy(hx_get(engine, "name"), nome, sizeof nome);
  hx_string_copy(hx_get(engine, "version"), versao, sizeof versao);
  hx_string_copy(hx_get(engine, "apiVersion"), api_versao, sizeof api_versao);
  hx_string_copy(hx_get(raiz, "context"), contexto, sizeof contexto);
  checar("engine.name", hx_is_string(hx_get(engine, "name")) && nome[0] != '\0');
  checar("engine.version", hx_is_string(hx_get(engine, "version")));
  checarf("context", !strcmp(contexto, "shared") || !strcmp(contexto, "client") || !strcmp(contexto, "server"), "%s", contexto);
  checar("isPlaying", verdadeiro(hx_get(raiz, "isPlaying")));
  checar("isEditor", falso(hx_get(raiz, "isEditor")));
  checar("self no script de entrada", hx_is_none(hx_self()) && hx_is_none(hx_get(raiz, "self")));
  checar("hx_script é o handle do script", hx_is_object(hx_script()));
  checar("hx_now", hx_now() >= 0);
  info("%s %s · API %s · " LINGUAGEM, nome, versao, api_versao);
  hx_print("hx_print direto do C (log sem canal)");
  return HX_NONE;
}

static hx_ref modulo(void) {
  checar("#include soma", soma(2, 3) == 5);
  checar("#include limitar", limitar(15, 0, 10) == 10);
  checar("#include saudacao", str_eq(saudacao(str("Helix")), "Olá, Helix"));
  util = keep(hx_require("DebugUtil"));
  checar("hx_require devolve as funções", hx_is_object(util) && hx_is_function(hx_get(util, "soma")));
  double resultado = hx_to_number(hx_invoke2(util, "soma", num(2), num(3)));
  checarf("require soma", resultado == 5, "%g", resultado);
  checar("require saudacao", str_eq(hx_invoke1(util, "saudacao", str("Helix")), "Olá, Helix"));
  checar("require limitar", hx_to_number(hx_invoke3(util, "limitar", num(15), num(0), num(10))) == 10);
  return HX_NONE;
}

static hx_ref matematica(void) {
  hx_ref m = api("math");
  hx_ref V = hx_get(m, "vec3"), Q = hx_get(m, "quat"), M4 = hx_get(m, "mat4"), S = hx_get(m, "scalar");
  checar("vec3.add", eq3(hx_invoke2(V, "add", v3(1, 2, 3), v3(1, 1, 1)), 2, 3, 4, 1e-6));
  checar("vec3.length", aprox(hx_to_number(hx_invoke1(V, "length", v3(3, 4, 0))), 5, 1e-3));
  checar("vec3.normalize", aprox(comprimento(hx_invoke1(V, "normalize", v3(0, 5, 0))), 1, 1e-3));
  checar("vec3.cross", eq3(hx_invoke2(V, "cross", v3(1, 0, 0), v3(0, 1, 0)), 0, 0, 1, 1e-6));
  checar("vec3.lerp", eq3(hx_invoke3(V, "lerp", v3(0, 0, 0), v3(2, 2, 2), num(0.5)), 1, 1, 1, 1e-6));
  hx_ref q = hx_invoke1(Q, "fromEuler", v3(0, 90, 0));
  checar("quat.rotateVec3", eq3(hx_invoke2(Q, "rotateVec3", q, v3(1, 0, 0)), 0, 0, -1, 1e-3));
  checar("quat.toEuler", aprox(numero(hx_invoke1(Q, "toEuler", q), "y"), 90, 0.01));
  hx_ref mat = hx_invoke3(M4, "fromTRS", v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1));
  checar("mat4.transformPoint", eq3(hx_invoke2(M4, "transformPoint", mat, v3(0, 0, 0)), 1, 2, 3, 1e-6));
  checar("mat4.invert", !hx_is_none(hx_invoke1(M4, "invert", mat)));
  hx_ref AABB = hx_get(m, "aabb");
  hx_ref caixa = hx_invoke2(AABB, "fromCenterSize", v3(0, 0, 0), v3(2, 2, 2));
  checar("aabb.contains", hx_to_boolean(hx_invoke2(AABB, "contains", caixa, v3(0.5, 0.5, 0.5))) && !hx_to_boolean(hx_invoke2(AABB, "contains", caixa, v3(2, 0, 0))));
  hx_ref RAY = hx_get(m, "ray");
  hx_ref raio = hx_invoke2(RAY, "create", v3(0, 5, 0), v3(0, -1, 0));
  checar("ray.intersectAabb", !hx_is_none(hx_invoke2(RAY, "intersectAabb", raio, caixa)));
  hx_ref remap_args[5] = { num(5), num(0), num(10), num(0), num(100) };
  checar("scalar.remap", hx_to_number(hx_invoke(S, "remap", remap_args, 5)) == 50);
  checar("clamp/lerp", hx_to_number(hx_invoke3(m, "clamp", num(15), num(0), num(10))) == 10 && hx_to_number(hx_invoke3(m, "lerp", num(0), num(10), num(0.5))) == 5);
  checar("scalar.wrapAngle", aprox(hx_to_number(hx_invoke1(S, "wrapAngle", num(370))), 10, 1e-3));
  checar("degToRad", aprox(hx_to_number(hx_invoke1(m, "degToRad", num(180))), PI, 1e-6));
  hx_ref ruido = hx_get(m, "noise");
  double perlin = hx_to_number(hx_invoke2(ruido, "perlin2", num(0.3), num(0.7)));
  checarf("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, "%g", perlin);
  checar("noise.fbm", hx_is_number(hx_invoke4(ruido, "fbm", num(1.5), num(2.5), num(0), num(4))));
  hx_ref cor = hx_get(m, "color");
  checar("color.hexToVec3", eq3(hx_invoke1(cor, "hexToVec3", str("#ff0000")), 1, 0, 0, 0.01));
  char hex[16];
  hx_string_copy(hx_invoke1(cor, "vec3ToHex", v3(1, 1, 1)), hex, sizeof hex);
  checarf("color.vec3ToHex", !strcmp(hex, "#ffffff") || !strcmp(hex, "#FFFFFF"), "%s", hex);
  hx_ref R = hx_get(m, "random");
  hx_invoke1(R, "seed", num(42));
  double primeiro = hx_to_number(hx_invoke0(R, "value"));
  hx_invoke1(R, "seed", num(42));
  checar("random.seed determinístico", hx_to_number(hx_invoke0(R, "value")) == primeiro);
  double sorteado = hx_to_number(hx_invoke2(R, "int", num(1), num(6)));
  checar("random.int", sorteado >= 1 && sorteado <= 6 && floor(sorteado) == sorteado);
  checar("random.unitVector", aprox(comprimento(hx_invoke0(R, "unitVector")), 1, 1e-3));
  checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI") * 2, 1e-9));
  return HX_NONE;
}

                                                                                         

static int visitados;
static hx_ref contar_visita(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  visitados++;
  return HX_NONE;
}

static hx_ref cena(void) {
  hx_ref s = api("scene"), mat = api("material");
  hx_ref raiz = hx_get(s, "root");
  checar("scene.root", !hx_is_none(raiz) && hx_is_array(hx_get(raiz, "children")));
  int antes = (int)hx_to_number(hx_invoke0(s, "count"));
  hx_ref grupo = hx_invoke2(s, "spawn", str("group"), opts("name", str("DebugCenario"), NULL));
  hx_ref chao = hx_invoke3(s, "spawn", str("mesh"),
    opts("name", str("Chao"),
      "mesh", hx_invoke2(api("mesh"), "plane", num(40), num(40)),
      "material", hx_invoke1(mat, "create", opts("baseColor", str("#4b6b3a"), "roughness", num(0.95), NULL)),
      "rigidBody", opts("type", str("static"), "collider", str("box"), "boxSize", v3(40, 0.2, 40), "center", v3(0, -0.1, 0), NULL),
      "receiveShadows", hx_boolean(1),
      "tags", strs(1, "chao"),
      NULL),
    grupo);
  checar("spawn mesh", str_eq(hx_get(chao, "kind"), "mesh") && !hx_is_none(hx_get(chao, "mesh")) && !hx_is_none(hx_get(chao, "rigidBody")));
  checar("find", hx_equals(hx_invoke1(s, "find", str("Chao")), chao));
  checar("findAll", hx_length(hx_invoke1(s, "findAll", str("Chao"))) == 1);
  checar("byId", hx_equals(hx_invoke1(s, "byId", hx_get(chao, "id")), chao));
  checar("byTag", hx_length(hx_invoke1(s, "byTag", str("chao"))) >= 1);
  checar("byKind", hx_length(hx_invoke1(s, "byKind", str("mesh"))) >= 1);
  int depois = (int)hx_to_number(hx_invoke0(s, "count"));
  checarf("count", depois == antes + 2, "%d vs %d", depois, antes + 2);
  checar("contains", hx_to_boolean(hx_invoke2(s, "contains", grupo, chao)) && hx_to_boolean(hx_invoke2(s, "contains", raiz, chao)));
  char caminho[128];
  hx_string_copy(hx_invoke1(s, "path", chao), caminho, sizeof caminho);
  checarf("path", strstr(caminho, "Chao") != NULL, "%s", caminho);
  visitados = 0;
  hx_invoke2(s, "traverse", cb(contar_visita), grupo);
  checarf("traverse", visitados >= 2, "%d", visitados);

  hx_ref anel = hx_invoke3(s, "spawnPrimitive", str("torus"), opts("name", str("Anel"), "position", v3(-4, 1.2, -2), "scale", num(1.5), NULL), grupo);
  hx_invoke2(mat, "setColor", anel, str("#3a86ff"));
  hx_invoke3(mat, "setEmissive", anel, str("#3a86ff"), num(0.6));
  torus = keep(anel);
  checar("spawnPrimitive", !hx_is_none(hx_get(anel, "mesh")) && !hx_is_none(hx_get(anel, "material")));

  hx_ref copia = hx_invoke3(s, "clone", anel, hx_boolean(1), grupo);
  hx_invoke2(s, "rename", copia, str("AnelCopia"));
  hx_invoke2(api("transform"), "setPosition", copia, v3(-4, 1.2, 2));
  checar("clone + rename", str_eq(hx_get(copia, "name"), "AnelCopia") && hx_equals(hx_invoke1(s, "find", str("AnelCopia")), copia));
  hx_invoke3(s, "setMeta", copia, str("origem"), str("clone"));
  checar("meta", str_eq(hx_invoke2(s, "getMeta", copia, str("origem")), "clone"));
  hx_invoke2(s, "addTag", copia, str("temporario"));
  checar("addTag/hasTag", hx_to_boolean(hx_invoke2(s, "hasTag", copia, str("temporario"))));
  checar("removeTag", verdadeiro(hx_invoke2(s, "removeTag", copia, str("temporario"))) && !hx_to_boolean(hx_invoke2(s, "hasTag", copia, str("temporario"))));
  hx_invoke2(s, "setVisible", copia, hx_boolean(0));
  checar("setVisible", falso(hx_get(copia, "visible")));
  hx_invoke2(s, "setVisible", copia, hx_boolean(1));
  hx_invoke1(s, "destroy", copia);
  checar("destroy", hx_is_none(hx_invoke1(s, "find", str("AnelCopia"))) && !hx_to_boolean(hx_invoke1(s, "isAttached", copia)));

  hx_ref esfera = hx_invoke2(s, "spawnPrimitive", str("sphere"), opts("name", str("Esfera"), "position", v3(4, 0.5, -3), NULL));
  hx_invoke2(s, "reparent", esfera, grupo);
  checar("reparent", hx_equals(hx_get(esfera, "parent"), grupo));
  hx_invoke2(mat, "setColor", esfera, str("#ffbe0b"));
  hx_invoke3(s, "addComponent", esfera, str("rigidBody"), opts("type", str("dynamic"), "collider", str("sphere"), "radius", num(0.5), "mass", num(1), NULL));
  checar("addComponent", !hx_is_none(hx_get(esfera, "rigidBody")) && str_eq(hx_get(hx_get(esfera, "rigidBody"), "type"), "dynamic"));
  hx_ref temporario = hx_invoke2(s, "spawnPrimitive", str("box"), opts("name", str("Temporario"), NULL));
  hx_invoke3(s, "addComponent", temporario, str("csg"), hx_object());
  checar("addComponent csg", !hx_is_none(hx_get(temporario, "csg")));
  hx_invoke2(s, "removeComponent", temporario, str("csg"));
  checar("removeComponent", hx_is_none(hx_get(temporario, "csg")));
  hx_invoke1(s, "destroy", temporario);
  checar("kinds/components", contem(hx_invoke0(s, "kinds"), "mesh") && contem(hx_invoke0(s, "components"), "rigidBody"));
  return HX_NONE;
}

static hx_ref transformacao(void) {
  hx_ref tr = api("transform"), s = api("scene");
  hx_ref alvo = hx_invoke2(s, "spawnPrimitive", str("cone"), opts("name", str("Cone"), "position", v3(0, 0.5, -6), NULL));
  hx_invoke2(api("material"), "setColor", alvo, str("#8338ec"));
  hx_invoke2(tr, "setPosition", alvo, v3(2, 0.5, -6));
  checar("setPosition", eq3(hx_invoke1(tr, "position", alvo), 2, 0.5, -6, 1e-6));
  hx_invoke3(tr, "translate", alvo, v3(0, 1, 0), str("world"));
  checar("translate", aprox(numero(hx_invoke1(tr, "position", alvo), "y"), 1.5, 1e-3));
  hx_invoke2(tr, "setRotation", alvo, v3(0, 90, 0));
  checar("setRotation", aprox(numero(hx_invoke1(tr, "rotation", alvo), "y"), 90, 0.01));
  hx_invoke2(tr, "rotate", alvo, v3(0, 45, 0));
  double girado = hx_to_number(hx_invoke1(api("math.scalar"), "wrapAngle", hx_get(hx_invoke1(tr, "rotation", alvo), "y")));
  checarf("rotate", aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), "%g", girado);
  hx_invoke2(tr, "setScale", alvo, num(2));
  checar("setScale", aprox(numero(hx_invoke1(tr, "scale", alvo), "x"), 2, 1e-6));
  hx_invoke2(tr, "setScale", alvo, v3(1, 1, 1));
  hx_vec3 mundo = hx_get_vec3(hx_invoke1(tr, "worldPosition", alvo));
  checar("worldPosition", eq3(hx_invoke1(tr, "position", alvo), mundo.x, mundo.y, mundo.z, 1e-3));
  checar("forward/up", aprox(comprimento(hx_invoke1(tr, "forward", alvo)), 1, 1e-3) && aprox(comprimento(hx_invoke1(tr, "up", alvo)), 1, 1e-3));
  hx_invoke2(tr, "lookAt", alvo, v3(0, 1.5, 0));
  checar("distance", hx_to_number(hx_invoke2(tr, "distance", alvo, v3(2, 1.5, -6))) < 0.01);
  checar("directionTo", aprox(comprimento(hx_invoke2(tr, "directionTo", alvo, v3(0, 1.5, 0))), 1, 1e-3));
  hx_ref limites = hx_invoke1(tr, "bounds", alvo);
  checar("bounds", !hx_is_none(limites) && numero(hx_get(limites, "max"), "y") > numero(hx_get(limites, "min"), "y"));
  checar("worldMatrix", hx_length(hx_invoke1(tr, "worldMatrix", alvo)) == 16 && hx_length(hx_invoke1(tr, "localMatrix", alvo)) == 16);
  hx_ref local = hx_invoke2(tr, "worldToLocal", alvo, hx_invoke2(tr, "localToWorld", alvo, v3(1, 0, 0)));
  checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3));
  return HX_NONE;
}

static hx_ref malhas(void) {
  hx_ref me = api("mesh"), s = api("scene"), csg = api("csg"), mat = api("material");
  hx_ref caixa = hx_invoke3(me, "box", num(1), num(1), num(1));
  double triangulos = hx_to_number(hx_invoke1(me, "triangleCount", caixa));
  checarf("mesh.box", hx_to_number(hx_invoke1(me, "vertexCount", caixa)) > 0 && triangulos == 12, "%g", triangulos);
  hx_ref esfera = hx_invoke3(me, "sphere", num(0.65), num(16), num(12));
  hx_ref furado = hx_invoke3(csg, "boolean", caixa, esfera, str("subtract"));
  checar("csg.boolean", hx_to_number(hx_invoke1(me, "triangleCount", furado)) > 12);
  hx_ref ator = hx_invoke2(s, "spawn", str("mesh"),
    opts("name", str("CaixaFurada"), "mesh", furado,
      "material", hx_invoke1(mat, "create", opts("baseColor", str("#e63946"), "roughness", num(0.4), "metallic", num(0.2), NULL)),
      "position", v3(4, 0.5, 2), NULL));
  checar("spawn malha CSG", !hx_is_none(hx_get(ator, "mesh")));
  checar("csg.operations", contem(hx_invoke0(csg, "operations"), "union"));
  double posicoes[9] = { -1, 0, 0, 1, 0, 0, 0, 1.5, 0 };
  double uvs[6] = { 0, 0, 1, 0, 0.5, 1 };
  double indices[3] = { 0, 1, 2 };
  hx_ref tri = hx_invoke1(me, "create", opts("name", str("Triangulo"), "positions", nums(posicoes, 9), "uvs", nums(uvs, 6), "indices", nums(indices, 3), NULL));
  hx_invoke1(me, "computeNormals", tri);
  checar("mesh.create + computeBounds", numero(hx_get(hx_invoke1(me, "computeBounds", tri), "max"), "y") >= 1.5);
  hx_ref dupla = hx_invoke2(me, "merge", tri, hx_invoke1(me, "flipWinding", hx_invoke1(me, "clone", tri)));
  checar("mesh.merge", hx_to_number(hx_invoke1(me, "triangleCount", dupla)) == 2);
  hx_invoke2(s, "spawn", str("mesh"),
    opts("name", str("Triangulo"), "mesh", dupla,
      "material", hx_invoke1(mat, "create", opts("baseColor", str("#06d6a0"), "doubleSided", hx_boolean(1), NULL)),
      "position", v3(7, 0, -2), NULL));
  hx_ref grande = hx_invoke2(me, "scale", hx_invoke2(me, "translate", hx_invoke1(me, "clone", caixa), v3(0, 0.5, 0)), num(2));
  checar("mesh.translate/scale", numero(hx_get(hx_invoke1(me, "computeBounds", grande), "max"), "y") > 1.9);
  hx_ref distancia = hx_invoke2(me, "raycast", hx_invoke2(api("math.ray"), "create", v3(0, 5, 0), v3(0, -1, 0)), grande);
  checar("mesh.raycast", hx_is_number(distancia) && hx_to_number(distancia) > 0);
  int vertices = (int)hx_to_number(hx_invoke1(me, "vertexCount", caixa));
  checar("positions/indices", hx_length(hx_invoke1(me, "positions", caixa)) == vertices * 3 && hx_length(hx_invoke1(me, "indices", caixa)) == 36);
  checar("primitivas extras", hx_to_number(hx_invoke1(me, "triangleCount", hx_invoke0(me, "torusKnot"))) > 0 && hx_to_number(hx_invoke1(me, "triangleCount", hx_invoke0(me, "capsule"))) > 0);
  return HX_NONE;
}

                                                                                            

static hx_ref materiais(void) {
  hx_ref mat = api("material"), s = api("scene"), tex = api("texture");
  hx_ref base = hx_invoke1(mat, "create", opts("name", str("DebugBase"), "baseColor", str("#d98c2b"), "roughness", num(0.5), "metallic", num(0.1), NULL));
  checar("material.create", numero(base, "roughness") == 0.5);
  hx_ref copia = hx_invoke1(mat, "clone", base);
  hx_invoke2(mat, "set", copia, opts("roughness", num(1), "emissive", str("#ffffff"), "emissiveIntensity", num(2), NULL));
  checar("material.clone/set", numero(copia, "roughness") == 1 && numero(base, "roughness") == 0.5);
  hx_ref caixa = hx_invoke2(s, "spawnPrimitive", str("box"), opts("name", str("CaixaPintada"), "position", v3(-7, 0.5, 2), NULL));
  hx_invoke2(mat, "assign", caixa, base);
  checar("material.assign/of", !hx_is_none(hx_invoke1(mat, "of", caixa)));
  hx_invoke1(mat, "own", caixa);
  hx_invoke2(mat, "setColor", caixa, str("#d98c2b"));
  hx_ref desenho = hx_invoke2(tex, "canvas", num(64), num(64));
  hx_invoke0(desenho, "update");
  hx_invoke3(mat, "setTexture", caixa, str("baseColorMap"), hx_get(desenho, "texture"));
  checar("texture.canvas + setTexture", hx_to_boolean(hx_invoke1(mat, "hasAnyTexture", hx_invoke1(mat, "of", caixa))) && hx_to_boolean(hx_invoke1(tex, "isTexture", hx_get(desenho, "texture"))));
  checar("material.slots", hx_length(hx_invoke0(mat, "slots")) > 0);
  checar("materials.list", hx_is_array(hx_invoke0(api("materials"), "list")));
  hx_ref sombreado = hx_invoke2(mat, "fromShader", str("DebugSuperficie"), opts("glow", v3(1, 0.45, 0.1), "speed", num(2), NULL));
  checar("material.fromShader", !hx_is_none(sombreado));
  if (!hx_is_none(sombreado)) {
    hx_ref esfera = hx_invoke2(s, "spawnPrimitive", str("sphere"), opts("name", str("EsferaShader"), "position", v3(0, 1, -3), "scale", num(1.4), NULL));
    hx_invoke2(mat, "assign", esfera, sombreado);
    hx_invoke2(hx_invoke1(mat, "uniforms", esfera), "set", str("speed"), num(3));
    checar("material.uniforms.list", hx_length(hx_invoke0(hx_invoke1(mat, "uniforms", esfera), "list")) >= 1);
  }
  return HX_NONE;
}

static hx_ref luzes(void) {
  hx_ref l = api("light");
  checar("light.types", contem(hx_invoke0(l, "types"), "point") && contem(hx_invoke0(l, "localTypes"), "spot"));
  hx_ref lampada = hx_invoke2(l, "spawn", str("point"), opts("name", str("Lampada"), "position", v3(0, 3, 0), "color", str("#ffd166"), "intensity", num(60), "range", num(14), NULL));
  checar("light.spawn", !hx_is_none(hx_get(lampada, "light")) && str_eq(hx_get(hx_get(lampada, "light"), "type"), "point"));
  hx_invoke2(l, "set", lampada, opts("intensity", num(80), NULL));
  checar("light.set", numero(hx_get(lampada, "light"), "intensity") == 80);
  hx_invoke2(l, "setTemperature", lampada, num(3200));
  checar("setTemperature", numero(hx_get(lampada, "light"), "temperature") == 3200);
  hx_ref foco = hx_invoke2(l, "spawn", str("spot"),
    opts("name", str("Holofote"), "position", v3(4, 4, 0), "rotation", v3(-90, 0, 0), "intensity", num(120), "range", num(16),
      "innerAngle", num(20), "outerAngle", num(35), "color", str("#ffffff"), NULL));
  checar("spot", str_eq(hx_get(hx_get(foco, "light"), "type"), "spot"));
  hx_ref convertido = hx_invoke2(l, "convert", foco, str("disc"));
  checar("light.convert", str_eq(hx_get(convertido, "type"), "disc") && str_eq(hx_get(hx_get(foco, "light"), "type"), "disc"));
  hx_invoke2(l, "convert", foco, str("spot"));
  hx_ref presets = hx_invoke0(l, "presets");
  checar("light.presets", hx_length(presets) > 0);
  if (hx_length(presets) > 0) {
    hx_ref primeiro = hx_index(presets, 0);
    hx_ref preset = hx_invoke2(l, "spawn", hx_get(primeiro, "id"), opts("name", str("LuzPreset"), "position", v3(-4, 2.5, 4), NULL));
    checar("light.fromPreset", !hx_is_none(hx_get(preset, "light")) && hx_equals(hx_get(hx_invoke1(l, "fromPreset", hx_get(primeiro, "id")), "type"), hx_get(primeiro, "type")));
  }
  checar("light.all", hx_length(hx_invoke1(l, "all", opts("local", hx_boolean(1), NULL))) >= 2);
  checar("effectiveRange", hx_to_number(hx_invoke1(l, "effectiveRange", lampada)) > 0);
  checar("light.isLocal", verdadeiro(hx_invoke1(l, "isLocal", lampada)));
  checar("temperatureToColor", !hx_is_none(hx_invoke1(l, "temperatureToColor", num(6500))));
  hx_invoke2(l, "setColor", lampada, str("#ffffff"));
  checar("light.setColor", eq3(hx_get(hx_get(lampada, "light"), "color"), 1, 1, 1, 0.01));
  return HX_NONE;
}

static hx_ref hora_mudou(void* userdata, hx_ref args) {
  (void)userdata;
  info("Hora do céu: %g", hx_to_number(hx_index(args, 0)));
  return HX_NONE;
}

static hx_ref ceu(void) {
  hx_ref sky = api("sky"), mundo = api("world");
  hx_invoke1(sky, "set", opts("timeOfDay", num(10.5), "haze", num(0.3), "clouds", opts("enabled", hx_boolean(1), "coverage", num(0.45), NULL), NULL));
  checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(hx_get(hx_get(sky, "clouds"), "enabled")));
  checar("sky.isDay", verdadeiro(hx_get(sky, "isDay")));
  checar("sky.sunDirection", numero(hx_invoke0(sky, "sunDirection"), "y") > 0);
  char hora[16];
  hx_string_copy(hx_invoke1(sky, "formatTimeOfDay", num(10.5)), hora, sizeof hora);
  checarf("sky.formatTimeOfDay", strchr(hora, ':') != NULL, "%s", hora);
  checar("sky.wrapTimeOfDay", hx_to_number(hx_invoke1(sky, "wrapTimeOfDay", num(25))) == 1);
  checar("sky.presets", hx_length(hx_invoke0(sky, "presets")) > 0);
  assinar(hx_invoke1(sky, "onHourChanged", cb(hora_mudou)));
  hx_set_number(sky, "cycleSpeed", 0);
  checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0);
  checar("world.gravity", numero(hx_get(mundo, "gravity"), "y") < 0);
  hx_invoke1(hx_get(mundo, "wind"), "set", opts("speed", num(2), "direction", num(45), NULL));
  checar("world.wind.set", numero(hx_get(mundo, "wind"), "speed") == 2);
  return HX_NONE;
}

static hx_ref camera_mudou(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref entidade = hx_index(args, 0);
  char nome[64] = "editor/jogador";
  if (!hx_is_none(entidade)) hx_string_copy(hx_get(entidade, "name"), nome, sizeof nome);
  info("Câmera principal: %s", nome);
  return HX_NONE;
}

static hx_ref camera(void) {
  hx_ref c = api("camera");
  checar("camera.fov", numero(c, "fov") > 0 && numero(c, "aspect") > 0);
  checar("camera.near/far", numero(c, "near") > 0 && numero(c, "far") > numero(c, "near"));
  hx_ref viewport = hx_get(c, "viewport");
  checar("viewport", numero(viewport, "width") > 0);
  hx_ref na_tela = hx_invoke1(c, "worldToScreen", v3(0, 0, 0));
  checar("worldToScreen", hx_is_none(na_tela) || hx_is_number(hx_get(na_tela, "x")));
  hx_ref raio = hx_invoke2(c, "screenToRay", num(numero(viewport, "width") / 2), num(numero(viewport, "height") / 2));
  checar("screenToRay", hx_is_none(raio) || aprox(comprimento(hx_get(raio, "direction")), 1, 0.01));
  checar("viewMatrix", hx_length(hx_get(c, "viewMatrix")) == 16);
  hx_ref jogador = hx_get(c, "player");
  hx_invoke1(jogador, "set", opts("distance", num(7), "pitch", num(18), NULL));
  checar("player.set", numero(hx_get(jogador, "settings"), "distance") == 7);
  checar("distanceTo", hx_to_number(hx_invoke1(c, "distanceTo", v3(0, 0, 0))) >= 0);
  checar("camera.position", !hx_is_none(hx_get(c, "position")) && !hx_is_none(hx_get(c, "forward")));
  assinar(hx_invoke1(c, "onMainChanged", cb(camera_mudou)));
  return HX_NONE;
}

static hx_ref pos(void) {
  hx_ref p = api("post");
  checar("post.toneMappers", hx_length(hx_invoke0(p, "toneMappers")) > 0);
  hx_invoke1(p, "set",
    opts("bloom", opts("enabled", hx_boolean(1), "intensity", num(0.5), "threshold", num(1), "softKnee", num(0.5), "radius", num(0.6), NULL),
      "vignette", opts("enabled", hx_boolean(1), "intensity", num(0.35), "smoothness", num(0.5), "roundness", num(1), NULL), NULL));
  checar("post.set", verdadeiro(hx_get(hx_get(p, "bloom"), "enabled")) && verdadeiro(hx_get(hx_get(p, "vignette"), "enabled")));
  hx_set_number(p, "exposure", 1.05);
  checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3));
  hx_set_string(p, "toneMapper", "agx");
  checar("post.toneMapper", str_eq(hx_get(p, "toneMapper"), "agx"));
  checar("post.presets", hx_length(hx_invoke0(p, "presets")) > 0);
  hx_ref custom = hx_get(p, "custom");
  hx_ref novo = hx_invoke1(custom, "add", opts("fragment", str("DebugPost"), "name", str("DebugPost"), "uniforms", opts("tint", v3(0.15, 0.05, 0.3), "strength", num(0.6), NULL), NULL));
  efeito = keep(novo);
  checar("post.custom.add", !hx_is_none(novo) && !hx_is_none(hx_invoke1(custom, "get", str("DebugPost"))));
  hx_invoke2(hx_get(novo, "uniforms"), "set", str("strength"), num(0.8));
  checar("efeito.uniforms.list", hx_length(hx_invoke0(hx_get(novo, "uniforms"), "list")) >= 2);
  return HX_NONE;
}

static hx_ref contar_render(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  renders++;
  return HX_NONE;
}

static hx_ref render(void) {
  hx_ref r = api("render");
  checar("render.passNames", hx_length(hx_invoke0(r, "passNames")) > 0);
  checar("render.stats", hx_is_number(hx_get(hx_get(r, "stats"), "drawCalls")));
  checar("render.frame", hx_is_number(hx_get(hx_get(r, "frame"), "width")));
  assinar(hx_invoke1(r, "onAfterFrame", cb(contar_render)));
  hx_set_boolean(r, "showGrid", 0);
  checar("render.showGrid", falso(hx_get(r, "showGrid")));
  checar("render.pixelRatio", numero(r, "pixelRatio") > 0);
  return HX_NONE;
}

                                                                                         

static hx_ref ao_colidir(void* userdata, hx_ref args) {
  (void)userdata;
  colisoes++;
  if (colisoes > 3) return HX_NONE;
  hx_ref e = hx_index(args, 0);
  char a[64], b[64];
  hx_string_copy(hx_get(hx_get(e, "a"), "name"), a, sizeof a);
  hx_string_copy(hx_get(hx_get(e, "b"), "name"), b, sizeof b);
  info("Colisão: %s × %s (impulso %.2f)", a, b, numero(hx_get(e, "contact"), "impulse"));
  return HX_NONE;
}

static hx_ref fora_do_mundo(void* userdata, hx_ref args) {
  (void)userdata;
  char nome[64];
  hx_string_copy(hx_get(hx_index(args, 0), "name"), nome, sizeof nome);
  aviso("%s caiu do mundo", nome);
  return HX_NONE;
}

static hx_ref fisica(void) {
  hx_ref ph = api("physics"), s = api("scene");
  checar("physics.enabled", verdadeiro(hx_get(ph, "enabled")));
  checar("physics.gravity", numero(hx_get(ph, "gravity"), "y") < 0);
  checar("physics.settings", numero(hx_get(ph, "settings"), "fixedTimestep") > 0);
  for (int i = 1; i <= 5; i++) {
    char nome[16];
    snprintf(nome, sizeof nome, "Caixa%d", i);
    hx_ref caixa = hx_invoke2(s, "spawnPrimitive", str("box"),
      opts("name", str(nome), "position", v3(-2 + (i - 1) * 1.1, 3 + (i - 1) * 1.2, 3),
        "rigidBody", opts("type", str("dynamic"), "collider", str("box"), "mass", num(2), "restitution", num(0.3), NULL),
        "tags", strs(1, "caixa"), NULL));
    hx_invoke2(api("material"), "setColor", caixa, hx_invoke3(api("math.color"), "hsl", num(30 + i * 12), num(0.7), num(0.5)));
  }
  hx_ref caixas = hx_invoke1(s, "byTag", str("caixa"));
  hx_ref primeira = hx_index(caixas, 0);
  checar("caixas dinâmicas", hx_length(caixas) == 5 && hx_to_boolean(hx_invoke1(ph, "hasBody", primeira)));
  hx_ref corpo = hx_invoke1(ph, "bodyOf", primeira);
  checar("bodyOf", verdadeiro(hx_get(corpo, "isDynamic")) && numero(corpo, "mass") > 0);
  hx_invoke1(corpo, "applyImpulse", v3(0, 2, 0));
  hx_invoke1(corpo, "applyTorque", v3(0, 1, 0));
  hx_invoke1(corpo, "setMaterial", opts("friction", num(0.8), NULL));
  hx_invoke0(corpo, "wake");
  checar("body.linearVelocity", !hx_is_none(hx_get(corpo, "linearVelocity")));
  checar("bodies()", hx_length(hx_invoke0(ph, "bodies")) >= 6);
  hx_ref hit = hx_invoke3(ph, "raycast", v3(0, 5, 0), v3(0, -1, 0), num(20));
  checar("physics.raycast", !hx_is_none(hit) && !hx_is_none(hx_get(hit, "entity")));
  checar("raycastAll", hx_length(hx_invoke3(ph, "raycastAll", v3(0, 5, 0), v3(0, -1, 0), num(20))) >= 1);
  checar("overlapSphere", hx_is_array(hx_invoke2(ph, "overlapSphere", v3(0, 3, 3), num(4))));
  checar("massProperties", numero(hx_invoke1(ph, "massProperties", primeira), "mass") > 0);
  checar("colliderVolume", hx_to_number(hx_invoke1(ph, "colliderVolume", primeira)) > 0);
  hx_ref formas = hx_get(ph, "shapes");
  checar("shapes.sphere volume", aprox(hx_to_number(hx_invoke1(formas, "volume", hx_invoke1(formas, "sphere", num(1)))), 4.18879, 0.01));
  assinar(hx_invoke1(ph, "onCollisionBegin", cb(ao_colidir)));
  assinar(hx_invoke1(ph, "onOutOfBounds", cb(fora_do_mundo)));
  hx_ref gatilho = hx_invoke2(s, "spawn", str("group"), opts("name", str("Gatilho"), "position", v3(0, 1, 3), "trigger", opts("shape", str("box"), "size", v3(3, 2, 3), NULL), NULL));
  checar("trigger spawn", !hx_is_none(gatilho) && hx_to_boolean(hx_invoke1(s, "isAttached", gatilho)));
  checar("physics.stats", hx_is_number(hx_get(hx_get(ph, "stats"), "bodies")));
  return HX_NONE;
}

static hx_ref ao_pular(void* userdata, hx_ref args) {
  (void)userdata;
  char nome[64];
  hx_string_copy(hx_get(hx_get(hx_index(args, 0), "entity"), "name"), nome, sizeof nome);
  info("%s pulou", nome);
  return HX_NONE;
}

static hx_ref ao_possuir(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref entidade = hx_index(args, 0);
  char nome[64] = "ninguém";
  if (!hx_is_none(entidade)) hx_string_copy(hx_get(entidade, "name"), nome, sizeof nome);
  info("Possuindo %s", nome);
  return HX_NONE;
}

static hx_ref personagem(void) {
  hx_ref ch = api("character"), pl = api("player");
  hx_ref novo = hx_invoke1(ch, "spawn", opts("name", str("Heroi"), "position", v3(0, 1.2, 8), "character", opts("walkSpeed", num(4), "runSpeed", num(7), "jumpHeight", num(1.4), NULL), NULL));
  heroi = keep(novo);
  checar("character.spawn", !hx_is_none(hx_get(novo, "character")) && hx_to_boolean(hx_invoke1(ch, "has", novo)));
  hx_ref c = hx_invoke1(ch, "of", novo);
  checar("character.of", hx_type(hx_get(c, "isGrounded")) == HX_BOOLEAN);
  checar("settingsOf", numero(hx_invoke1(ch, "settingsOf", novo), "walkSpeed") == 4);
  hx_invoke1(pl, "possess", novo);
  checar("player.possess", hx_equals(hx_get(pl, "possessed"), novo) && verdadeiro(hx_get(pl, "isPossessing")));
  assinar(hx_invoke1(ch, "onJumped", cb(ao_pular)));
  assinar(hx_invoke1(pl, "onPossessed", cb(ao_possuir)));
  checar("character.all", hx_length(hx_invoke0(ch, "all")) >= 1);
  checar("player.spawnPoint", !hx_is_none(hx_get(pl, "spawnPoint")));
  checar("character.velocity", !hx_is_none(hx_get(c, "velocity")) && !hx_is_none(hx_get(c, "position")));
  return HX_NONE;
}

static hx_ref terreno(void) {
  hx_ref te = api("terrain");
  checar("terrain.presets", hx_length(hx_invoke0(te, "presets")) > 0);
  hx_ref colinas = hx_invoke1(te, "spawn", opts("name", str("Colinas"), "size", num(48), "resolution", num(65), "preset", str("hills"), "seed", num(7), "position", v3(0, -6, -70), NULL));
  checar("terrain.spawn", !hx_is_none(hx_get(colinas, "terrain")) && hx_length(hx_invoke0(te, "all")) >= 1);
  checar("terrain.of", numero(hx_invoke1(te, "of", colinas), "resolution") == 65);
  hx_ref altura = hx_invoke2(te, "heightAt", v3(0, 0, -70), colinas);
  checar("heightAt", hx_is_number(altura));
  checar("contains", hx_to_boolean(hx_invoke2(te, "contains", v3(0, 0, -70), colinas)) && !hx_to_boolean(hx_invoke2(te, "contains", v3(500, 0, 0), colinas)));
  hx_ref esculpir[5] = { colinas, str("raise"), v3(5, 0, -70), opts("radius", num(6), "strength", num(1), NULL), num(1) };
  hx_invoke(te, "sculpt", esculpir, 5);
  hx_invoke1(te, "markDirty", colinas);
  hx_ref grama = hx_get(te, "grass");
  hx_invoke2(grama, "set", colinas, opts("enabled", hx_boolean(1), "density", num(0.5), NULL));
  checar("grass.set", verdadeiro(hx_get(hx_invoke1(grama, "settingsOf", colinas), "enabled")));
  hx_ref agua = hx_get(te, "water");
  hx_invoke2(agua, "set", colinas, opts("enabled", hx_boolean(1), "level", num(-2), NULL));
  checar("water.set", verdadeiro(hx_get(hx_invoke1(agua, "settingsOf", colinas), "enabled")));
  checar("terrain.raycast", !hx_is_none(hx_invoke3(te, "raycast", v3(0, 50, -70), v3(0, -1, 0), colinas)));
  return HX_NONE;
}

                                                                                          

static void soltar_caixa(void) {
  hx_ref random = api("math.random");
  hx_ref caixa = hx_invoke2(api("scene"), "spawnPrimitive", str("box"),
    opts("name", str("CaixaSolta"),
      "position", v3(hx_to_number(hx_invoke2(random, "range", num(-3), num(3))), 6, hx_to_number(hx_invoke2(random, "range", num(0), num(4)))),
      "rigidBody", opts("type", str("dynamic"), "collider", str("box"), "mass", num(1), NULL),
      "tags", strs(1, "caixa"), NULL));
  hx_invoke2(api("material"), "setColor", caixa, hx_invoke0(random, "color"));
  pontos++;
  hx_invoke2(api("gui"), "bind", str("pontos"), num(pontos));
  hx_invoke2(api("events"), "emit", str("debug.caixa"), opts("nome", hx_get(caixa, "name"), NULL));
}

static hx_ref acao_caixa(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  soltar_caixa();
  return HX_NONE;
}

static hx_ref acao_reiniciar(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_invoke0(api("play"), "restart");
  return HX_NONE;
}

static hx_ref tela_mostrada(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref g = api("gui");
  tela = keep(hx_index(args, 0));
  checar("gui.show/isShown", !hx_is_none(tela) && hx_to_boolean(hx_invoke1(g, "isShown", tela)));
  checar("gui.kinds", contem(hx_invoke0(g, "kinds"), "button"));
  return HX_NONE;
}

static hx_ref interface_grafica(void) {
  hx_ref g = api("gui");
  hx_invoke1(g, "css", str("DebugEstilo"));
  hx_ref hud = hx_invoke2(g, "html", str("DebugHud"), opts("id", str("debug-hud"), NULL));
  checar("gui.html", !hx_is_none(hud) && !hx_is_none(hx_invoke1(g, "element", str("#debug-hud"))));
  hx_ref icone = hx_invoke2(g, "svg", str("DebugIcone"), opts("id", str("debug-icone"), NULL));
  checar("gui.svg", !hx_is_none(icone));
  hx_ref slot = hx_invoke1(g, "element", str("[data-slot=icone]"));
  if (!hx_is_none(slot) && !hx_is_none(icone)) hx_invoke1(slot, "appendChild", icone);
  checar("gui.bind", hx_to_number(hx_invoke2(g, "bind", str("linguagem"), str(LINGUAGEM))) >= 1);
  hx_invoke2(g, "bind", str("titulo"), str("Helix · Debug"));
  assinar(hx_invoke2(g, "onAction", str("caixa"), cb(acao_caixa)));
  assinar(hx_invoke2(g, "onAction", str("reiniciar"), cb(acao_reiniciar)));
  checar("gui.elements", hx_length(hx_invoke1(g, "elements", str("[data-bind]"))) >= 5);
  checar("gui.size", numero(hx_get(g, "size"), "width") > 0);
  hx_ref declarativa = hx_invoke2(g, "create", str("DebugTela"), opts("referenceSize", xy(1280, 720), NULL));
  hx_ref painel = hx_invoke3(g, "add", declarativa, str("frame"),
    opts("name", str("Painel"),
      "rect", opts("position", opts("x", escala(1, -236), "y", escala(0, 16), NULL), "size", opts("x", escala(0, 220), "y", escala(0, 48), NULL), NULL),
      NULL));
  hx_invoke4(g, "add", declarativa, str("text"), opts("name", str("Rotulo"), "text", str("Tela declarativa OK"), NULL), hx_get(hx_get(painel, "node"), "id"));
  checar("gui.add/find", str_eq(hx_get(hx_invoke2(g, "find", declarativa, str("Rotulo")), "kind"), "text"));
  hx_invoke3(g, "setText", declarativa, str("Rotulo"), str("Tela declarativa OK · " LINGUAGEM));
                                                                                        
  return hx_invoke1(hx_invoke2(g, "show", declarativa, str("debug-tela")), "then", cb(tela_mostrada));
}

static hx_ref audio(void) {
  hx_ref a = api("audio"), s = api("scene");
  checar("audio.supported", hx_type(hx_get(a, "supported")) == HX_BOOLEAN);
  hx_ref mixer = hx_get(a, "mixer");
  hx_invoke2(mixer, "setVolumeDb", str("sfx"), num(-3));
  checar("mixer.setVolumeDb", numero(hx_invoke1(mixer, "bus", str("sfx")), "volumeDb") == -3);
  checar("audio.clips", hx_is_array(hx_invoke0(a, "clips")));
  hx_ref fonte = hx_invoke2(s, "spawn", str("sound"), opts("name", str("FonteSonora"), "position", v3(3, 1, 3), "audioSource", opts("trigger", str("manual"), "spatial", hx_boolean(1), NULL), NULL));
  checar("spawn sound", !hx_is_none(hx_get(fonte, "audioSource")));
  hx_ref fontes = hx_get(a, "sources");
  hx_invoke2(fontes, "set", fonte, opts("volumeDb", num(-4), NULL));
  checar("sources.set", numero(hx_get(fonte, "audioSource"), "volumeDb") == -4);
  checar("sources.isPlaying", falso(hx_invoke1(fontes, "isPlaying", fonte)));
  return HX_NONE;
}

static hx_ref vfx_salvo(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref v = api("vfx");
  hx_ref ativo = hx_index(args, 0);
  checar("vfx.save", !hx_is_none(ativo) && str_eq(hx_get(ativo, "kind"), "vfx"));
  hx_ref ator = hx_invoke3(v, "emitAt", ativo, v3(0, 1.5, -8), opts("destroyWhenFinished", hx_boolean(0), NULL));
  checar("vfx.emitAt", verdadeiro(hx_invoke1(v, "has", ator)));
  hx_invoke2(v, "burst", ator, num(20));
  checar("vfx.stats", hx_is_number(hx_get(hx_invoke0(v, "stats"), "effects")));
  return HX_NONE;
}

static hx_ref vfx(void) {
  hx_ref v = api("vfx");
  hx_ref ids = hx_invoke0(hx_get(v, "templates"), "ids");
  checar("vfx.templates", hx_length(ids) > 0);
  checar("vfx.moduleKinds", hx_length(hx_invoke0(v, "moduleKinds")) > 0);
  hx_ref doc = hx_invoke2(v, "fromTemplate", hx_index(ids, 0), str("DebugFaiscas"));
  doc = hx_invoke2(v, "addEmitter", doc, opts("name", str("Extra"), "maxParticles", num(50), NULL));
  doc = hx_invoke2(v, "set", doc, opts("loop", hx_boolean(1), NULL));
  checar("vfx.fromTemplate/addEmitter", hx_length(hx_get(doc, "emitters")) >= 2 && verdadeiro(hx_get(doc, "loop")));
  return hx_invoke1(hx_invoke2(v, "save", doc, str("DebugFaiscas")), "then", cb(vfx_salvo));
}

                                                                                        

static void ao_teclar(hx_ref e) {
  if (hx_to_boolean(hx_get(e, "repeat"))) return;
  char code[32];
  hx_string_copy(hx_get(e, "code"), code, sizeof code);
  if (!strcmp(code, "KeyR")) {
    hx_invoke0(api("play"), "restart");
  } else if (!strcmp(code, "KeyB")) {
    soltar_caixa();
  } else if (!strcmp(code, "KeyE")) {
    hx_invoke2(api("events"), "emit", str("debug.ping"), opts("origem", str("teclado"), "quadro", hx_get(api("time"), "frame"), NULL));
  } else if (!strcmp(code, "KeyF")) {
    hx_invoke2(api("camera"), "shake", num(0.4), num(0.6));
  } else if (!strcmp(code, "KeyG")) {
    if (efeito) {
      int ligado = !hx_to_boolean(hx_get(efeito, "enabled"));
      hx_set_boolean(efeito, "enabled", ligado);
      info("Efeito DebugPost %s", ligado ? "ligado" : "desligado");
    }
  } else if (!strcmp(code, "KeyT")) {
    hx_ref tm = api("time");
    hx_set_number(tm, "scale", numero(tm, "scale") == 1 ? 0.3 : 1);
    info("time.scale = %g", numero(tm, "scale"));
  } else if (!strcmp(code, "KeyH")) {
    if (tela) {
      if (hx_to_boolean(hx_invoke1(api("gui"), "isShown", tela))) hx_invoke1(api("gui"), "hide", tela);
      else hx_invoke2(api("gui"), "show", tela, str("debug-tela"));
    }
  } else if (!strcmp(code, "KeyL")) {
    hx_ref luzes_locais = hx_invoke1(api("light"), "all", opts("local", hx_boolean(1), NULL));
    char lista[512] = "";
    int n = hx_length(luzes_locais);
    for (int i = 0; i < n; i++) {
      char nome[64];
      hx_string_copy(hx_get(hx_get(hx_index(luzes_locais, i), "entity"), "name"), nome, sizeof nome);
      if (strlen(lista) + strlen(nome) + 3 >= sizeof lista) break;
      if (i > 0) strcat(lista, ", ");
      strcat(lista, nome);
    }
    info("Luzes locais: %s", lista);
  }
}

static hx_ref ao_teclar_cb(void* userdata, hx_ref args) {
  (void)userdata;
  ao_teclar(hx_index(args, 0));
  return HX_NONE;
}

static void clique_na_cena(double x, double y) {
  hx_ref c = api("camera");
  hx_ref alvo = hx_invoke2(c, "pick", num(x), num(y));
  hx_ref ponto = hx_invoke2(c, "pickPoint", num(x), num(y));
  if (!hx_is_none(alvo)) {
    char nome[64];
    hx_string_copy(hx_get(alvo, "name"), nome, sizeof nome);
    info("Clique em %s", nome);
  }
  if (!hx_is_none(ponto)) hx_invoke4(api("debug"), "sphere", ponto, num(0.3), str("#ff006e"), num(2));
}

static hx_ref ao_apontar(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref e = hx_index(args, 0);
  if ((int)numero(e, "button") == 0) clique_na_cena(numero(e, "x"), numero(e, "y"));
  return HX_NONE;
}

static hx_ref ao_gamepad(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref e = hx_index(args, 0);
  info("Gamepad %g botão %g", numero(e, "pad"), numero(e, "button"));
  return HX_NONE;
}

static hx_ref entrada(void) {
  hx_ref in = api("input"), acoes = hx_get(in, "actions");
  hx_invoke2(acoes, "define", str("pular"), strs(2, "Space", "Gamepad:0"));
  hx_invoke2(acoes, "define", str("soltar"), strs(1, "KeyB"));
  checar("actions.define/bindings", hx_length(hx_invoke1(acoes, "bindings", str("pular"))) >= 1);
  checar("action()", str_eq(hx_get(hx_invoke1(in, "action", str("pular")), "name"), "pular") && hx_type(hx_invoke1(acoes, "down", str("pular"))) == HX_BOOLEAN);
  checar("isDown", falso(hx_invoke1(in, "isDown", str("KeyW"))));
  checar("pointer", hx_is_number(hx_get(hx_get(in, "pointer"), "x")));
  checar("gamepads", hx_is_array(hx_invoke0(in, "gamepads")));
  checar("axis2d", hx_is_number(hx_get(hx_invoke1(in, "axis2d", opts("up", str("KeyW"), "down", str("KeyS"), "left", str("KeyA"), "right", str("KeyD"), NULL)), "x")));
  checar("keysDown", hx_is_object(hx_invoke0(in, "keysDown")));
  assinar(hx_invoke1(in, "onKeyDown", cb(ao_teclar_cb)));
  assinar(hx_invoke1(in, "onPointerDown", cb(ao_apontar)));
  assinar(hx_invoke1(in, "onGamepadButtonDown", cb(ao_gamepad)));
  return HX_NONE;
}

                                                                                                 
static hx_ref recebido = HX_NONE;
static int uma_vez, do_ator;

static hx_ref guardar_ping(void* userdata, hx_ref args) {
  (void)userdata;
  drop(&recebido);
  recebido = keep(hx_index(args, 0));
  return HX_NONE;
}
static hx_ref contar_uma_vez(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  uma_vez++;
  return HX_NONE;
}
static hx_ref contar_toque(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  do_ator++;
  return HX_NONE;
}
static hx_ref logar_ping(void* userdata, hx_ref args) {
  (void)userdata;
  char origem[64];
  hx_string_copy(hx_get(hx_index(args, 0), "origem"), origem, sizeof origem);
  info("ping de %s", origem);
  return HX_NONE;
}
static hx_ref logar_caixa(void* userdata, hx_ref args) {
  (void)userdata;
  char nome[64];
  hx_string_copy(hx_get(hx_index(args, 0), "nome"), nome, sizeof nome);
  depurar("caixa %s", nome);
  return HX_NONE;
}
static hx_ref logar_parou(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  info("play.onStopped disparou");
  return HX_NONE;
}
static hx_ref logar_pausado(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  info("pausado");
  return HX_NONE;
}
static hx_ref logar_retomado(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  info("retomado");
  return HX_NONE;
}

static hx_ref eventos(void) {
  hx_ref ev = api("events"), play = api("play");
  hx_ref desligar = hx_invoke2(ev, "on", str("debug.ping"), cb(guardar_ping));
  checar("events.emit conta ouvintes", hx_to_number(hx_invoke2(ev, "emit", str("debug.ping"), opts("origem", str("teste"), NULL))) == 1);
  checar("events.on recebe", recebido != HX_NONE && str_eq(hx_get(recebido, "origem"), "teste"));
  drop(&recebido);
  checar("listenerCount", hx_to_number(hx_invoke1(ev, "listenerCount", str("debug.ping"))) == 1);
  hx_call0(desligar);
  checar("unsubscribe", hx_to_number(hx_invoke1(ev, "listenerCount", str("debug.ping"))) == 0);
  uma_vez = 0;
  hx_invoke2(ev, "once", str("debug.once"), cb(contar_uma_vez));
  hx_invoke1(ev, "emit", str("debug.once"));
  hx_invoke1(ev, "emit", str("debug.once"));
  checar("events.once", uma_vez == 1);
  assinar(hx_invoke2(ev, "on", str("debug.ping"), cb(logar_ping)));
  assinar(hx_invoke2(ev, "on", str("debug.caixa"), cb(logar_caixa)));
  do_ator = 0;
  assinar(hx_invoke3(ev, "onEntity", torus, str("toque"), cb(contar_toque)));
  hx_invoke2(ev, "emitEntity", torus, str("toque"));
  checar("onEntity/emitEntity", do_ator == 1);
  assinar(hx_invoke1(play, "onStopped", cb(logar_parou)));
  assinar(hx_invoke1(play, "onPaused", cb(logar_pausado)));
  assinar(hx_invoke1(play, "onResumed", cb(logar_retomado)));
  return HX_NONE;
}

                                                                                    
static double tempo_inicio;
static int tempo_quadro, atraso_disparou;

static hx_ref a_cada_2s(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_invoke2(api("gui"), "bind", str("atores"), hx_invoke0(api("scene"), "count"));
  return HX_NONE;
}
static hx_ref marcar_atraso(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  atraso_disparou = 1;
  return HX_NONE;
}
static hx_ref tempo_passo3(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  checar("time.delay", atraso_disparou);
  return HX_NONE;
}
static hx_ref tempo_passo2(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_ref tm = api("time");
  int quadro = (int)numero(tm, "frame");
  checarf("time.waitFrames", quadro >= tempo_quadro + 2, "%d", quadro - tempo_quadro);
  assinar(hx_invoke2(tm, "every", num(2), cb(a_cada_2s)));
  atraso_disparou = 0;
  hx_invoke2(tm, "delay", num(0.2), cb(marcar_atraso));
  return hx_invoke1(hx_invoke1(tm, "wait", num(0.3)), "then", cb(tempo_passo3));
}
static hx_ref tempo_passo1(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_ref tm = api("time");
  double decorrido = numero(tm, "now") - tempo_inicio;
  checarf("time.wait", decorrido >= 0.09, "%.3f", decorrido);
  tempo_quadro = (int)numero(tm, "frame");
  return hx_invoke1(hx_invoke1(tm, "waitFrames", num(2)), "then", cb(tempo_passo2));
}
static hx_ref tempo(void) {
  hx_ref tm = api("time");
  checar("time.now", numero(tm, "now") >= 0 && numero(tm, "frame") >= 0);
  checar("time.delta", numero(tm, "delta") >= 0 && numero(tm, "fixedDelta") > 0);
  tempo_inicio = numero(tm, "now");
  return hx_invoke1(hx_invoke1(tm, "wait", num(0.1)), "then", cb(tempo_passo1));
}

static int execucoes;

static hx_ref dados_passo4(void* userdata, hx_ref args) {
  (void)userdata;
  char texto[1024];
  hx_string_copy(hx_index(args, 0), texto, sizeof texto);
  checar("assets.text", strstr(texto, "velocidade") != NULL);
  hx_ref ativos = api("assets");
  checar("assets.byName", !hx_is_none(hx_invoke2(ativos, "byName", str("DebugJogo"), str("script"))));
  checar("assets.exists", hx_to_boolean(hx_invoke1(ativos, "exists", str("DebugUtil"))) && !hx_to_boolean(hx_invoke1(ativos, "exists", str("NaoExiste"))));
  checar("assets.search", hx_length(hx_invoke1(ativos, "search", str("Debug"))) >= 5);
  checar("project.name", hx_is_string(hx_get(api("project"), "name")));
  checar("project.stats", numero(hx_get(api("project"), "stats"), "entities") > 0);
  checar("net.localPlayer", verdadeiro(hx_get(hx_get(api("net"), "localPlayer"), "local")));
  checar("play.state", str_eq(hx_get(api("play"), "state"), "playing") && verdadeiro(hx_get(api("play"), "isRunning")));
  return HX_NONE;
}
static hx_ref dados_passo3(void* userdata, hx_ref args) {
  (void)userdata;
  hx_ref cfg = hx_index(args, 0);
  checar("assets.data (TOML)", !hx_is_none(cfg) && !hx_is_none(hx_get(cfg, "jogador")) && numero(hx_get(cfg, "jogador"), "velocidade") == 6.5);
  return hx_invoke1(hx_invoke1(api("assets"), "text", str("DebugConfig")), "then", cb(dados_passo4));
}
static hx_ref dados_passo2(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_ref st = api("storage");
  checarf("storage.get/set", (int)hx_to_number(hx_invoke1(st, "get", str("execucoes"))) == execucoes && hx_to_boolean(hx_invoke1(st, "has", str("execucoes"))), "%d", execucoes);
  info("Execução nº %d deste jogo de teste neste projeto.", execucoes);
  return hx_invoke1(hx_invoke1(api("assets"), "data", str("DebugConfig")), "then", cb(dados_passo3));
}
static hx_ref dados_passo1(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_ref st = api("storage");
  hx_ref atual = hx_invoke2(st, "get", str("execucoes"), num(0));
  execucoes = (hx_is_number(atual) ? (int)hx_to_number(atual) : 0) + 1;
  return hx_invoke1(hx_invoke2(st, "set", str("execucoes"), num(execucoes)), "then", cb(dados_passo2));
}
static hx_ref dados(void) {
  return hx_invoke1(hx_invoke0(api("storage"), "ready"), "then", cb(dados_passo1));
}

                                                                                            
static hx_ref lancar(void) {
  hx_throw("erro proposital: hx_throw interrompe a área e vira ERRO na cadeia");
}

                                                                                          

typedef hx_ref (*area_fn)(void);
typedef struct Area {
  const char* nome;
  area_fn fn;
                                                                                               
  int espera_erro;
} Area;

static const Area AREAS[] = {
  { "Núcleo", nucleo, 0 },
  { "Módulo (#include + hx_require)", modulo, 0 },
  { "Matemática", matematica, 0 },
  { "Cena", cena, 0 },
  { "Transformações", transformacao, 0 },
  { "Malhas e CSG", malhas, 0 },
  { "Materiais", materiais, 0 },
  { "Luzes", luzes, 0 },
  { "Céu e mundo", ceu, 0 },
  { "Câmera", camera, 0 },
  { "Pós-processamento", pos, 0 },
  { "Render", render, 0 },
  { "Física", fisica, 0 },
  { "Personagem e jogador", personagem, 0 },
  { "Terreno", terreno, 0 },
  { "Interface", interface_grafica, 0 },
  { "Áudio", audio, 0 },
  { "VFX", vfx, 0 },
  { "Entrada", entrada, 0 },
  { "Eventos", eventos, 0 },
  { "Tempo e tarefas", tempo, 0 },
  { "Dados, projeto e rede", dados, 0 },
  { "Erro proposital (hx_throw)", lancar, 1 },
};

static hx_ref area_rodar(void* userdata, hx_ref args) {
  (void)args;
  return ((const Area*)userdata)->fn();
}
static hx_ref area_ok(void* userdata, hx_ref args) {
  (void)args;
  const Area* area = (const Area*)userdata;
  if (area->espera_erro) {
    checar("hx_throw deveria ter rejeitado a área", 0);
    return HX_NONE;
  }
  depurar("ok %s", area->nome);
  return HX_NONE;
}
static hx_ref area_erro(void* userdata, hx_ref args) {
  const Area* area = (const Area*)userdata;
  hx_ref causa = hx_index(args, 0);
  char mensagem[512];
  hx_string_copy(hx_is_object(causa) ? hx_get(causa, "message") : causa, mensagem, sizeof mensagem);
  if (area->espera_erro) {
    checarf("hx_throw chega como rejeição da promessa", strstr(mensagem, "proposital") != NULL, "%s", mensagem);
    return HX_NONE;
  }
  falhas++;
  erro("ERRO em %s: %s", area->nome, mensagem);
  return HX_NONE;
}

                                                                                                  
static hx_ref encadear(hx_ref promessa, const Area* area) {
  hx_ref depois = hx_invoke1(promessa, "then", hx_function(area_rodar, (void*)area, NULL));
  return hx_invoke2(depois, "then", hx_function(area_ok, (void*)area, NULL), hx_function(area_erro, (void*)area, NULL));
}

static hx_ref finalizar(void* userdata, hx_ref args) {
  (void)userdata;
  (void)args;
  hx_ref girador = hx_invoke2(api("assets"), "byName", str("DebugGirador"), str("script"));
  if (!hx_is_none(girador)) {
    hx_ref extra = hx_invoke2(api("scene"), "spawnPrimitive", str("box"),
      opts("name", str("GiradorDinamico"), "position", v3(-2, 0.5, -3),
        "rigidBody", opts("type", str("kinematic"), "collider", str("box"), NULL),
        "script", opts("assetId", hx_get(girador, "id"), "props", opts("velocidade", num(180), "cor", str("#00b4d8"), NULL), NULL),
        NULL));
    checar("spawn com script", !hx_is_none(hx_get(extra, "script")) && hx_equals(hx_get(hx_get(extra, "script"), "assetId"), hx_get(girador, "id")));
  } else {
    checarf("ativo DebugGirador", 0, "%s", "não está na biblioteca");
  }
  const char* dica = "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia.";
  if (falhas == 0) info("API percorrida em " LINGUAGEM ": %d checagens, nenhuma falha. %s", checagens, dica);
  else aviso("API percorrida em " LINGUAGEM ": %d checagens, %d falhas (veja FALHOU/ERRO acima). %s", checagens, falhas, dica);
  hx_invoke2(api("gui"), "bind", str("checagens"), num(checagens));
  hx_invoke2(api("gui"), "bind", str("falhas"), num(falhas));
  return HX_NONE;
}

                                                                                         

                                                                                          
int main(void) {
  printf("DebugJogo.c: main rodou antes dos hooks (stdout da WASI)\n");
  return 0;
}

HX_HOOK void onLoad(void) {
  info("onLoad do script de entrada");
}

HX_HOOK void onStart(void) {
  info("Jogo de teste em " LINGUAGEM ": percorrendo a API…");
  hx_ref promessa = hx_invoke1(api("time"), "wait", num(0));
  for (size_t i = 0; i < sizeof AREAS / sizeof AREAS[0]; i++) promessa = encadear(promessa, &AREAS[i]);
  hx_invoke1(promessa, "then", cb(finalizar));
}

HX_HOOK void onUpdate(double dt) {
  quadros++;
  if (torus) hx_invoke2(api("transform"), "rotate", torus, v3(0, 40 * dt, 0));
  hx_ref d = api("debug");
  hx_invoke3(d, "line", v3(-6, 0.05, -6), v3(6, 0.05, -6), str("#ff006e"));
  hx_invoke2(d, "box", opts("center", v3(0, 1, 3), "size", v3(3, 2, 3), NULL), str("#ffbe0b"));
  if (heroi) {
    hx_invoke2(d, "axes", heroi, num(1));
    char rotulo[48];
    snprintf(rotulo, sizeof rotulo, "Heroi · %d pts", pontos);
    hx_ref acima = hx_invoke2(api("math.vec3"), "add", hx_invoke1(api("transform"), "worldPosition", heroi), v3(0, 2.2, 0));
    hx_invoke3(d, "text", acima, str(rotulo), str("#ffffff"));
  }
  hx_invoke4(d, "ray", v3(0, 3, 0), v3(0, -1, 0), num(3), str("#06d6a0"));
  hud_timer += dt;
  if (hud_timer >= 0.5) {
    hud_timer = 0;
    hx_ref g = api("gui");
    hx_invoke2(g, "bind", str("fps"), num(round(numero(hx_get(api("render"), "stats"), "fps"))));
    hx_invoke2(g, "bind", str("checagens"), num(checagens));
    hx_invoke2(g, "bind", str("falhas"), num(falhas));
  }
}

HX_HOOK void onFixedUpdate(double h) {
  passos_fisica++;
  if (passos_fisica == 1) checarf("onFixedUpdate recebe o passo", h > 0 && h < 1, "%g", h);
}

HX_HOOK void onLateUpdate(void) {
  late_updates++;
}

                                                                             
HX_HOOK double onBeforeHotReload(void) {
  return pontos;
}

HX_HOOK void onHotReload(double anterior) {
  pontos = anterior > 0 ? (int)anterior : 0;
  info("Recarga a quente: %d pontos preservados", pontos);
}

HX_HOOK void onStop(void) {
  for (int i = 0; i < n_assinaturas; i++) {
    hx_call0(assinaturas[i]);
    hx_release(assinaturas[i]);
  }
  n_assinaturas = 0;
  info("Parou: %d quadros, %d passos de física, %d lateUpdates, %d frames (onAfterFrame), %d colisões.", quadros, passos_fisica, late_updates, renders, colisoes);
  drop(&torus);
  drop(&heroi);
  drop(&efeito);
  drop(&tela);
  drop(&util);
  drop(&recebido);
}
`;
    const actor = String.raw `                                 
                                                                                              
                                                                                                     
#include "helix.h"
#include <math.h>
#include <stdarg.h>
#include <stdio.h>

static double angulo;
static int contatos, quadros;
static hx_ref desligar = HX_NONE;

static hx_ref str(const char* texto) { return hx_string(texto); }
static hx_ref num(double valor) { return hx_number(valor); }

static hx_ref opts(const char* chave, ...) {
  hx_ref objeto = hx_object();
  va_list ap;
  va_start(ap, chave);
  for (const char* atual = chave; atual != NULL; atual = va_arg(ap, const char*)) {
    hx_ref valor = va_arg(ap, hx_ref);
    hx_set(objeto, atual, valor);
  }
  va_end(ap);
  return objeto;
}

static void registrar(const char* metodo, const char* fmt, ...) {
  char mensagem[256];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(mensagem, sizeof mensagem, fmt, ap);
  va_end(ap);
  hx_invoke2(hx_path("log"), metodo, str("Girador"), str(mensagem));
}

static const char* nome_de(hx_ref entidade, char* buffer, size_t capacidade) {
  hx_string_copy(hx_get(entidade, "name"), buffer, capacidade);
  return buffer;
}

HX_HOOK void onLoad(void) {
  hx_invoke1(hx_path("props"), "define",
    opts("velocidade", opts("type", str("range"), "default", num(90), "min", num(0), "max", num(360), "step", num(1), "label", str("Velocidade (°/s)"), NULL),
      "cor", opts("type", str("color"), "default", str("#ff8800"), "label", str("Cor"), NULL),
      "pulsar", opts("type", str("boolean"), "default", hx_boolean(1), "label", str("Pulsar"), NULL),
      NULL));
}

static hx_ref cor_mudou(void* userdata, hx_ref args) {
  (void)userdata;
  hx_invoke2(hx_path("material"), "setColor", hx_self(), hx_index(args, 0));
  return HX_NONE;
}

HX_HOOK void onStart(void) {
  hx_ref props = hx_path("props"), ator = hx_self(), lg = hx_path("log");
  char nome[64];
  registrar("info", "%s acordou com velocidade %g°/s", nome_de(ator, nome, sizeof nome), hx_to_number(hx_invoke1(props, "get", str("velocidade"))));
  hx_invoke2(hx_path("material"), "setColor", ator, hx_invoke1(props, "get", str("cor")));
  desligar = hx_retain(hx_invoke2(props, "onChanged", str("cor"), hx_function(cor_mudou, NULL, NULL)));
  hx_invoke2(lg, "assert", hx_boolean(!hx_is_none(hx_get(hx_root(), "self")) && hx_equals(hx_get(hx_root(), "self"), ator)), str("helix.self deveria ser o ator deste script"));
  hx_invoke2(lg, "assert", hx_boolean(hx_to_boolean(hx_invoke1(props, "has", str("velocidade"))) && hx_length(hx_invoke0(props, "definitions")) == 3), str("props.define deveria registrar 3 propriedades"));
}

HX_HOOK void onUpdate(double dt) {
  hx_ref props = hx_path("props"), tr = hx_path("transform");
  quadros++;
  angulo += hx_to_number(hx_invoke1(props, "get", str("velocidade"))) * dt;
  hx_invoke2(tr, "setRotation", hx_self(), hx_vec3_new(0, angulo, 0));
  if (hx_to_boolean(hx_invoke1(props, "get", str("pulsar")))) {
    hx_invoke2(tr, "setScale", hx_self(), num(1 + sin(hx_get_number(hx_path("time"), "now") * 3) * 0.1));
  }
}

HX_HOOK void onCollisionBegin(hx_ref outro, hx_ref contato) {
  contatos++;
  if (contatos > 3) return;
  char eu[64], ele[64];
  registrar("info", "%s tocou %s (impulso %.2f)", nome_de(hx_self(), eu, sizeof eu), nome_de(outro, ele, sizeof ele), hx_get_number(contato, "impulse"));
}

HX_HOOK void onTriggerEnter(hx_ref outro) {
  char eu[64], ele[64];
  registrar("info", "%s entrou no gatilho de %s", nome_de(outro, ele, sizeof ele), nome_de(hx_self(), eu, sizeof eu));
}

HX_HOOK void onEnable(void) {
  char eu[64];
  registrar("debug", "%s ativo", nome_de(hx_self(), eu, sizeof eu));
}

HX_HOOK void onDisable(void) {
  char eu[64];
  registrar("debug", "%s inativo", nome_de(hx_self(), eu, sizeof eu));
}

HX_HOOK void onStop(void) {
  char eu[64];
  registrar("info", "%s: %d quadros, %d contatos", nome_de(hx_self(), eu, sizeof eu), quadros, contatos);
}

HX_HOOK void onDestroy(void) {
  if (desligar) {
    hx_call0(desligar);
    hx_release(desligar);
    desligar = HX_NONE;
  }
}
`;
    const module = String.raw `                                     
                                                                                                     
                                                                                                
                                                             
#ifndef DEBUG_UTIL_H
#define DEBUG_UTIL_H

#include "helix.h"
#include <stdio.h>

HX_EXPORT double soma(double a, double b) {
  return a + b;
}

                                                                                            
HX_EXPORT hx_ref saudacao(hx_ref quem) {
  char nome[64], texto[80];
  hx_string_copy(quem, nome, sizeof nome);
  snprintf(texto, sizeof texto, "Olá, %s", nome);
  return hx_string(texto);
}

HX_EXPORT double limitar(double valor, double minimo, double maximo) {
  return valor > maximo ? maximo : valor < minimo ? minimo : valor;
}

#endif                   
`;
    return { entry, actor, module };
}
