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
`;
}
