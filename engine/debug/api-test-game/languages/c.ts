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
`;
}
