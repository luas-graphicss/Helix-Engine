import type { GameSources } from '../types';
export function cppGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
#include "helix.hpp"
#include "DebugUtil.hpp"

#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <initializer_list>
#include <string>
#include <utility>
#include <vector>

using helix::Args;
using helix::Value;

namespace {

constexpr const char* LINGUAGEM = "C++";
constexpr double PI = 3.14159265358979323846;

                                                                                      
                                                                                           
                                                                                            
struct Estado {
  int quadros = 0, passosFisica = 0, lateUpdates = 0, renders = 0, colisoes = 0;
  int checagens = 0, falhas = 0, pontos = 0, toques = 0, execucoes = 0;
  double hudTimer = 0;
  bool atrasoDisparou = false;
  Value torus, heroi, efeito, tela, util, recebido;
  std::vector<Value> assinaturas;
};
Estado g;

                                                                                      

Value api(const char* caminho) { return helix::path(caminho); }
Value v3(double x, double y, double z) { return helix::vec3(x, y, z); }

using Campos = std::initializer_list<std::pair<const char*, Value>>;
                                                             
Value obj(Campos campos) { return Value(campos); }
                                                        
Value arr(std::initializer_list<Value> itens) { return Value(std::vector<Value>(itens)); }
Value xy(double x, double y) { return obj({{"x", x}, {"y", y}}); }
Value escala(double scale, double offset) { return obj({{"scale", scale}, {"offset", offset}}); }

std::string fmt(const char* formato, ...) __attribute__((format(printf, 1, 2)));
std::string fmt(const char* formato, ...) {
  char buffer[768];
  va_list ap;
  va_start(ap, formato);
  vsnprintf(buffer, sizeof buffer, formato, ap);
  va_end(ap);
  return buffer;
}

void registrar(const char* metodo, const std::string& mensagem) { api("log").call(metodo, "Debug", mensagem); }
void info(const std::string& mensagem) { registrar("info", mensagem); }
void aviso(const std::string& mensagem) { registrar("warn", mensagem); }
void erro(const std::string& mensagem) { registrar("error", mensagem); }
void depurar(const std::string& mensagem) { registrar("debug", mensagem); }

void checar(const char* nome, bool condicao, const std::string& detalhe = "") {
  g.checagens++;
  if (condicao) return;
  g.falhas++;
  erro(detalhe.empty() ? fmt("FALHOU %s", nome) : fmt("FALHOU %s: %s", nome, detalhe.c_str()));
}

bool eh(const Value& valor, const char* texto) { return valor.isString() && valor.str() == texto; }
bool verdadeiro(const Value& valor) { return valor.isBoolean() && valor.truthy(); }
bool falso(const Value& valor) { return valor.isBoolean() && !valor.truthy(); }
bool aprox(double a, double b, double epsilon) { return std::fabs(a - b) <= epsilon; }
double numero(const Value& objeto, const char* chave) { return objeto[chave].number(); }

                                                                                         
bool eq3(const Value& vetor, double x, double y, double z, double epsilon = 1e-6) {
  return api("math.vec3").call("equals", vetor, v3(x, y, z), epsilon).truthy();
}
double comprimento(const Value& vetor) { return api("math.vec3").call("length", vetor).number(); }

bool contem(const Value& lista, const char* texto) {
  for (int i = 0, n = lista.length(); i < n; i++)
    if (eh(lista[i], texto)) return true;
  return false;
}

void assinar(Value desligar) {
  if (desligar.isFunction()) g.assinaturas.push_back(std::move(desligar));
}

                                                                                       

Value nucleo() {
  Value raiz = helix::root(), engine = api("engine");
  std::string nome = engine["name"].str(), versao = engine["version"].str(), contexto = raiz["context"].str();
  checar("engine.name", engine["name"].isString() && !nome.empty());
  checar("engine.version", engine["version"].isString());
  checar("context", contexto == "shared" || contexto == "client" || contexto == "server", contexto);
  checar("isPlaying", verdadeiro(raiz["isPlaying"]));
  checar("isEditor", falso(raiz["isEditor"]));
  checar("self no script de entrada", helix::self().isNone() && raiz["self"].isNone());
  checar("helix::script é o handle do script", helix::script().isObject());
  checar("helix::now", helix::now() >= 0);
  info(nome + " " + versao + " · API " + engine["apiVersion"].str() + " · " + LINGUAGEM);
  helix::print("helix::print direto do C++ (log sem canal)");
  helix::print("helix::print aceita", 3, "partes, como console.log");
  return Value();
}

Value modulo() {
  checar("#include soma", soma(2, 3) == 5);
  checar("#include limitar", limitar(15, 0, 10) == 10);
  checar("#include saudacao", eh(Value::adopt(saudacao(Value("Helix").ref())), "Olá, Helix"));
  g.util = helix::require("DebugUtil");
  checar("helix::require devolve as funções", g.util.isObject() && g.util["soma"].isFunction());
  double resultado = g.util.call("soma", 2, 3).number();
  checar("require soma", resultado == 5, fmt("%g", resultado));
  checar("require saudacao", eh(g.util.call("saudacao", "Helix"), "Olá, Helix"));
  checar("require limitar", g.util.call("limitar", 15, 0, 10).number() == 10);
  return Value();
}

Value matematica() {
  Value m = api("math"), V = m["vec3"], Q = m["quat"], M4 = m["mat4"], S = m["scalar"];
  checar("vec3.add", eq3(V.call("add", v3(1, 2, 3), v3(1, 1, 1)), 2, 3, 4));
  checar("vec3.length", aprox(V.call("length", v3(3, 4, 0)).number(), 5, 1e-3));
  checar("vec3.normalize", aprox(comprimento(V.call("normalize", v3(0, 5, 0))), 1, 1e-3));
  checar("vec3.cross", eq3(V.call("cross", v3(1, 0, 0), v3(0, 1, 0)), 0, 0, 1));
  checar("vec3.lerp", eq3(V.call("lerp", v3(0, 0, 0), v3(2, 2, 2), 0.5), 1, 1, 1));
  Value q = Q.call("fromEuler", v3(0, 90, 0));
  checar("quat.rotateVec3", eq3(Q.call("rotateVec3", q, v3(1, 0, 0)), 0, 0, -1, 1e-3));
  checar("quat.toEuler", aprox(Q.call("toEuler", q).y(), 90, 0.01));
  Value mat = M4.call("fromTRS", v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1));
  checar("mat4.transformPoint", eq3(M4.call("transformPoint", mat, v3(0, 0, 0)), 1, 2, 3));
  checar("mat4.invert", !M4.call("invert", mat).isNone());
  Value AABB = m["aabb"];
  Value caixa = AABB.call("fromCenterSize", v3(0, 0, 0), v3(2, 2, 2));
  checar("aabb.contains", AABB.call("contains", caixa, v3(0.5, 0.5, 0.5)).truthy() && !AABB.call("contains", caixa, v3(2, 0, 0)).truthy());
  Value RAY = m["ray"];
  Value raio = RAY.call("create", v3(0, 5, 0), v3(0, -1, 0));
  checar("ray.intersectAabb", !RAY.call("intersectAabb", raio, caixa).isNone());
  checar("scalar.remap", S.call("remap", 5, 0, 10, 0, 100).number() == 50);
  checar("clamp/lerp", m.call("clamp", 15, 0, 10).number() == 10 && m.call("lerp", 0, 10, 0.5).number() == 5);
  checar("scalar.wrapAngle", aprox(S.call("wrapAngle", 370).number(), 10, 1e-3));
  checar("degToRad", aprox(m.call("degToRad", 180).number(), PI, 1e-6));
  Value ruido = m["noise"];
  double perlin = ruido.call("perlin2", 0.3, 0.7).number();
  checar("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, fmt("%g", perlin));
  checar("noise.fbm", ruido.call("fbm", 1.5, 2.5, 0, 4).isNumber());
  Value cor = m["color"];
  checar("color.hexToVec3", eq3(cor.call("hexToVec3", "#ff0000"), 1, 0, 0, 0.01));
  std::string hex = cor.call("vec3ToHex", v3(1, 1, 1)).str();
  checar("color.vec3ToHex", hex == "#ffffff" || hex == "#FFFFFF", hex);
  Value R = m["random"];
  R.call("seed", 42);
  double primeiro = R.call("value").number();
  R.call("seed", 42);
  checar("random.seed determinístico", R.call("value").number() == primeiro);
  double sorteado = R.call("int", 1, 6).number();
  checar("random.int", sorteado >= 1 && sorteado <= 6 && std::floor(sorteado) == sorteado);
  checar("random.unitVector", aprox(comprimento(R.call("unitVector")), 1, 1e-3));
  checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI") * 2, 1e-9));
  return Value();
}

                                                                                       

Value cena() {
  Value s = api("scene"), mat = api("material");
  Value raiz = s["root"];
  checar("scene.root", !raiz.isNone() && raiz["children"].isArray());
  int antes = s.call("count").toInt();
  Value grupo = s.call("spawn", "group", obj({{"name", "DebugCenario"}}));
  Value chao = s.call("spawn", "mesh",
    obj({{"name", "Chao"},
      {"mesh", api("mesh").call("plane", 40, 40)},
      {"material", mat.call("create", obj({{"baseColor", "#4b6b3a"}, {"roughness", 0.95}}))},
      {"rigidBody", obj({{"type", "static"}, {"collider", "box"}, {"boxSize", v3(40, 0.2, 40)}, {"center", v3(0, -0.1, 0)}})},
      {"receiveShadows", true},
      {"tags", arr({"chao"})}}),
    grupo);
  checar("spawn mesh", eh(chao["kind"], "mesh") && !chao["mesh"].isNone() && !chao["rigidBody"].isNone());
  checar("find", s.call("find", "Chao") == chao);
  checar("findAll", s.call("findAll", "Chao").length() == 1);
  checar("byId", s.call("byId", chao["id"]) == chao);
  checar("byTag", s.call("byTag", "chao").length() >= 1);
  checar("byKind", s.call("byKind", "mesh").length() >= 1);
  int depois = s.call("count").toInt();
  checar("count", depois == antes + 2, fmt("%d vs %d", depois, antes + 2));
  checar("contains", s.call("contains", grupo, chao).truthy() && s.call("contains", raiz, chao).truthy());
  std::string caminho = s.call("path", chao).str();
  checar("path", caminho.find("Chao") != std::string::npos, caminho);
                                                                                                          
  int visitados = 0;
  s.call("traverse", helix::function([&visitados] { visitados++; }), grupo);
  checar("traverse", visitados >= 2, fmt("%d", visitados));

  Value anel = s.call("spawnPrimitive", "torus", obj({{"name", "Anel"}, {"position", v3(-4, 1.2, -2)}, {"scale", 1.5}}), grupo);
  mat.call("setColor", anel, "#3a86ff");
  mat.call("setEmissive", anel, "#3a86ff", 0.6);
  g.torus = anel;
  checar("spawnPrimitive", !anel["mesh"].isNone() && !anel["material"].isNone());

  Value copia = s.call("clone", anel, true, grupo);
  s.call("rename", copia, "AnelCopia");
  api("transform").call("setPosition", copia, v3(-4, 1.2, 2));
  checar("clone + rename", eh(copia["name"], "AnelCopia") && s.call("find", "AnelCopia") == copia);
  s.call("setMeta", copia, "origem", "clone");
  checar("meta", eh(s.call("getMeta", copia, "origem"), "clone"));
  s.call("addTag", copia, "temporario");
  checar("addTag/hasTag", s.call("hasTag", copia, "temporario").truthy());
  checar("removeTag", verdadeiro(s.call("removeTag", copia, "temporario")) && !s.call("hasTag", copia, "temporario").truthy());
  s.call("setVisible", copia, false);
  checar("setVisible", falso(copia["visible"]));
  s.call("setVisible", copia, true);
  s.call("destroy", copia);
  checar("destroy", s.call("find", "AnelCopia").isNone() && !s.call("isAttached", copia).truthy());

  Value esfera = s.call("spawnPrimitive", "sphere", obj({{"name", "Esfera"}, {"position", v3(4, 0.5, -3)}}));
  s.call("reparent", esfera, grupo);
  checar("reparent", esfera["parent"] == grupo);
  mat.call("setColor", esfera, "#ffbe0b");
  s.call("addComponent", esfera, "rigidBody", obj({{"type", "dynamic"}, {"collider", "sphere"}, {"radius", 0.5}, {"mass", 1}}));
  checar("addComponent", !esfera["rigidBody"].isNone() && eh(esfera["rigidBody"]["type"], "dynamic"));
  Value temporario = s.call("spawnPrimitive", "box", obj({{"name", "Temporario"}}));
  s.call("addComponent", temporario, "csg", obj({}));
  checar("addComponent csg", !temporario["csg"].isNone());
  s.call("removeComponent", temporario, "csg");
  checar("removeComponent", temporario["csg"].isNone());
  s.call("destroy", temporario);
  checar("kinds/components", contem(s.call("kinds"), "mesh") && contem(s.call("components"), "rigidBody"));
  return Value();
}

Value transformacao() {
  Value tr = api("transform"), s = api("scene");
  Value alvo = s.call("spawnPrimitive", "cone", obj({{"name", "Cone"}, {"position", v3(0, 0.5, -6)}}));
  api("material").call("setColor", alvo, "#8338ec");
  tr.call("setPosition", alvo, v3(2, 0.5, -6));
  checar("setPosition", eq3(tr.call("position", alvo), 2, 0.5, -6));
  tr.call("translate", alvo, v3(0, 1, 0), "world");
  checar("translate", aprox(tr.call("position", alvo).y(), 1.5, 1e-3));
  tr.call("setRotation", alvo, v3(0, 90, 0));
  checar("setRotation", aprox(tr.call("rotation", alvo).y(), 90, 0.01));
  tr.call("rotate", alvo, v3(0, 45, 0));
  double girado = api("math.scalar").call("wrapAngle", tr.call("rotation", alvo)["y"]).number();
  checar("rotate", aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), fmt("%g", girado));
  tr.call("setScale", alvo, 2);
  checar("setScale", aprox(tr.call("scale", alvo).x(), 2, 1e-6));
  tr.call("setScale", alvo, v3(1, 1, 1));
  Value mundo = tr.call("worldPosition", alvo);
  checar("worldPosition", eq3(tr.call("position", alvo), mundo.x(), mundo.y(), mundo.z(), 1e-3));
  checar("forward/up", aprox(comprimento(tr.call("forward", alvo)), 1, 1e-3) && aprox(comprimento(tr.call("up", alvo)), 1, 1e-3));
  tr.call("lookAt", alvo, v3(0, 1.5, 0));
  checar("distance", tr.call("distance", alvo, v3(2, 1.5, -6)).number() < 0.01);
  checar("directionTo", aprox(comprimento(tr.call("directionTo", alvo, v3(0, 1.5, 0))), 1, 1e-3));
  Value limites = tr.call("bounds", alvo);
  checar("bounds", !limites.isNone() && limites["max"].y() > limites["min"].y());
  checar("worldMatrix", tr.call("worldMatrix", alvo).length() == 16 && tr.call("localMatrix", alvo).length() == 16);
  Value local = tr.call("worldToLocal", alvo, tr.call("localToWorld", alvo, v3(1, 0, 0)));
  checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3));
  return Value();
}

Value malhas() {
  Value me = api("mesh"), s = api("scene"), csg = api("csg"), mat = api("material");
  Value caixa = me.call("box", 1, 1, 1);
  double triangulos = me.call("triangleCount", caixa).number();
  checar("mesh.box", me.call("vertexCount", caixa).number() > 0 && triangulos == 12, fmt("%g", triangulos));
  Value esfera = me.call("sphere", 0.65, 16, 12);
  Value furado = csg.call("boolean", caixa, esfera, "subtract");
  checar("csg.boolean", me.call("triangleCount", furado).number() > 12);
  Value ator = s.call("spawn", "mesh",
    obj({{"name", "CaixaFurada"}, {"mesh", furado},
      {"material", mat.call("create", obj({{"baseColor", "#e63946"}, {"roughness", 0.4}, {"metallic", 0.2}}))},
      {"position", v3(4, 0.5, 2)}}));
  checar("spawn malha CSG", !ator["mesh"].isNone());
`;
}
