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
  checar("csg.operations", contem(csg.call("operations"), "union"));
  Value tri = me.call("create", obj({{"name", "Triangulo"},
    {"positions", arr({-1, 0, 0, 1, 0, 0, 0, 1.5, 0})},
    {"uvs", arr({0, 0, 1, 0, 0.5, 1})},
    {"indices", arr({0, 1, 2})}}));
  me.call("computeNormals", tri);
  checar("mesh.create + computeBounds", me.call("computeBounds", tri)["max"].y() >= 1.5);
  Value dupla = me.call("merge", tri, me.call("flipWinding", me.call("clone", tri)));
  checar("mesh.merge", me.call("triangleCount", dupla).number() == 2);
  s.call("spawn", "mesh",
    obj({{"name", "Triangulo"}, {"mesh", dupla},
      {"material", mat.call("create", obj({{"baseColor", "#06d6a0"}, {"doubleSided", true}}))},
      {"position", v3(7, 0, -2)}}));
  Value grande = me.call("scale", me.call("translate", me.call("clone", caixa), v3(0, 0.5, 0)), 2);
  checar("mesh.translate/scale", me.call("computeBounds", grande)["max"].y() > 1.9);
  Value distancia = me.call("raycast", api("math.ray").call("create", v3(0, 5, 0), v3(0, -1, 0)), grande);
  checar("mesh.raycast", distancia.isNumber() && distancia.number() > 0);
  int vertices = me.call("vertexCount", caixa).toInt();
  checar("positions/indices", me.call("positions", caixa).length() == vertices * 3 && me.call("indices", caixa).length() == 36);
  checar("primitivas extras", me.call("triangleCount", me.call("torusKnot")).number() > 0 && me.call("triangleCount", me.call("capsule")).number() > 0);
  return Value();
}

                                                                                         

Value materiais() {
  Value mat = api("material"), s = api("scene"), tex = api("texture");
  Value base = mat.call("create", obj({{"name", "DebugBase"}, {"baseColor", "#d98c2b"}, {"roughness", 0.5}, {"metallic", 0.1}}));
  checar("material.create", numero(base, "roughness") == 0.5);
  Value copia = mat.call("clone", base);
  mat.call("set", copia, obj({{"roughness", 1}, {"emissive", "#ffffff"}, {"emissiveIntensity", 2}}));
  checar("material.clone/set", numero(copia, "roughness") == 1 && numero(base, "roughness") == 0.5);
  Value caixa = s.call("spawnPrimitive", "box", obj({{"name", "CaixaPintada"}, {"position", v3(-7, 0.5, 2)}}));
  mat.call("assign", caixa, base);
  checar("material.assign/of", !mat.call("of", caixa).isNone());
  mat.call("own", caixa);
  mat.call("setColor", caixa, "#d98c2b");
  Value desenho = tex.call("canvas", 64, 64);
  desenho.call("update");
  mat.call("setTexture", caixa, "baseColorMap", desenho["texture"]);
  checar("texture.canvas + setTexture", mat.call("hasAnyTexture", mat.call("of", caixa)).truthy() && tex.call("isTexture", desenho["texture"]).truthy());
  checar("material.slots", mat.call("slots").length() > 0);
  checar("materials.list", api("materials").call("list").isArray());
  Value sombreado = mat.call("fromShader", "DebugSuperficie", obj({{"glow", v3(1, 0.45, 0.1)}, {"speed", 2}}));
  checar("material.fromShader", !sombreado.isNone());
  if (!sombreado.isNone()) {
    Value esfera = s.call("spawnPrimitive", "sphere", obj({{"name", "EsferaShader"}, {"position", v3(0, 1, -3)}, {"scale", 1.4}}));
    mat.call("assign", esfera, sombreado);
    mat.call("uniforms", esfera).call("set", "speed", 3);
    checar("material.uniforms.list", mat.call("uniforms", esfera).call("list").length() >= 1);
  }
  return Value();
}

Value luzes() {
  Value l = api("light");
  checar("light.types", contem(l.call("types"), "point") && contem(l.call("localTypes"), "spot"));
  Value lampada = l.call("spawn", "point", obj({{"name", "Lampada"}, {"position", v3(0, 3, 0)}, {"color", "#ffd166"}, {"intensity", 60}, {"range", 14}}));
  checar("light.spawn", !lampada["light"].isNone() && eh(lampada["light"]["type"], "point"));
  l.call("set", lampada, obj({{"intensity", 80}}));
  checar("light.set", numero(lampada["light"], "intensity") == 80);
  l.call("setTemperature", lampada, 3200);
  checar("setTemperature", numero(lampada["light"], "temperature") == 3200);
  Value foco = l.call("spawn", "spot",
    obj({{"name", "Holofote"}, {"position", v3(4, 4, 0)}, {"rotation", v3(-90, 0, 0)}, {"intensity", 120}, {"range", 16},
      {"innerAngle", 20}, {"outerAngle", 35}, {"color", "#ffffff"}}));
  checar("spot", eh(foco["light"]["type"], "spot"));
  Value convertido = l.call("convert", foco, "disc");
  checar("light.convert", eh(convertido["type"], "disc") && eh(foco["light"]["type"], "disc"));
  l.call("convert", foco, "spot");
  Value presets = l.call("presets");
  checar("light.presets", presets.length() > 0);
  if (presets.length() > 0) {
    Value primeiro = presets[0];
    Value preset = l.call("spawn", primeiro["id"], obj({{"name", "LuzPreset"}, {"position", v3(-4, 2.5, 4)}}));
    checar("light.fromPreset", !preset["light"].isNone() && l.call("fromPreset", primeiro["id"])["type"] == primeiro["type"]);
  }
  checar("light.all", l.call("all", obj({{"local", true}})).length() >= 2);
  checar("effectiveRange", l.call("effectiveRange", lampada).number() > 0);
  checar("light.isLocal", verdadeiro(l.call("isLocal", lampada)));
  checar("temperatureToColor", !l.call("temperatureToColor", 6500).isNone());
  l.call("setColor", lampada, "#ffffff");
  checar("light.setColor", eq3(lampada["light"]["color"], 1, 1, 1, 0.01));
  return Value();
}

Value ceu() {
  Value sky = api("sky"), mundo = api("world");
  sky.call("set", obj({{"timeOfDay", 10.5}, {"haze", 0.3}, {"clouds", obj({{"enabled", true}, {"coverage", 0.45}})}}));
  checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(sky["clouds"]["enabled"]));
  checar("sky.isDay", verdadeiro(sky["isDay"]));
  checar("sky.sunDirection", sky.call("sunDirection").y() > 0);
  std::string hora = sky.call("formatTimeOfDay", 10.5).str();
  checar("sky.formatTimeOfDay", hora.find(':') != std::string::npos, hora);
  checar("sky.wrapTimeOfDay", sky.call("wrapTimeOfDay", 25).number() == 1);
  checar("sky.presets", sky.call("presets").length() > 0);
  assinar(sky.call("onHourChanged", helix::function([](const Args& a) { info(fmt("Hora do céu: %g", a[0].number())); })));
  sky.set("cycleSpeed", 0);
  checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0);
  checar("world.gravity", mundo["gravity"].y() < 0);
  mundo["wind"].call("set", obj({{"speed", 2}, {"direction", 45}}));
  checar("world.wind.set", numero(mundo["wind"], "speed") == 2);
  return Value();
}

Value camera() {
  Value c = api("camera");
  checar("camera.fov", numero(c, "fov") > 0 && numero(c, "aspect") > 0);
  checar("camera.near/far", numero(c, "near") > 0 && numero(c, "far") > numero(c, "near"));
  Value viewport = c["viewport"];
  checar("viewport", numero(viewport, "width") > 0);
  Value naTela = c.call("worldToScreen", v3(0, 0, 0));
  checar("worldToScreen", naTela.isNone() || naTela["x"].isNumber());
  Value raio = c.call("screenToRay", numero(viewport, "width") / 2, numero(viewport, "height") / 2);
  checar("screenToRay", raio.isNone() || aprox(comprimento(raio["direction"]), 1, 0.01));
  checar("viewMatrix", c["viewMatrix"].length() == 16);
  Value jogador = c["player"];
  jogador.call("set", obj({{"distance", 7}, {"pitch", 18}}));
  checar("player.set", numero(jogador["settings"], "distance") == 7);
  checar("distanceTo", c.call("distanceTo", v3(0, 0, 0)).number() >= 0);
  checar("camera.position", !c["position"].isNone() && !c["forward"].isNone());
  assinar(c.call("onMainChanged", helix::function([](const Args& a) {
    Value entidade = a[0];
    info("Câmera principal: " + (entidade.isNone() ? std::string("editor/jogador") : entidade["name"].str()));
  })));
  return Value();
}

Value pos() {
  Value p = api("post");
  checar("post.toneMappers", p.call("toneMappers").length() > 0);
  p.call("set",
    obj({{"bloom", obj({{"enabled", true}, {"intensity", 0.5}, {"threshold", 1}, {"softKnee", 0.5}, {"radius", 0.6}})},
      {"vignette", obj({{"enabled", true}, {"intensity", 0.35}, {"smoothness", 0.5}, {"roundness", 1}})}}));
  checar("post.set", verdadeiro(p["bloom"]["enabled"]) && verdadeiro(p["vignette"]["enabled"]));
  p.set("exposure", 1.05);
  checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3));
  p.set("toneMapper", "agx");
  checar("post.toneMapper", eh(p["toneMapper"], "agx"));
  checar("post.presets", p.call("presets").length() > 0);
  Value custom = p["custom"];
  Value novo = custom.call("add", obj({{"fragment", "DebugPost"}, {"name", "DebugPost"}, {"uniforms", obj({{"tint", v3(0.15, 0.05, 0.3)}, {"strength", 0.6}})}}));
  g.efeito = novo;
  checar("post.custom.add", !novo.isNone() && !custom.call("get", "DebugPost").isNone());
  novo["uniforms"].call("set", "strength", 0.8);
  checar("efeito.uniforms.list", novo["uniforms"].call("list").length() >= 2);
  return Value();
}

Value render() {
  Value r = api("render");
  checar("render.passNames", r.call("passNames").length() > 0);
  checar("render.stats", r["stats"]["drawCalls"].isNumber());
  checar("render.frame", r["frame"]["width"].isNumber());
  assinar(r.call("onAfterFrame", helix::function([] { g.renders++; })));
  r.set("showGrid", false);
  checar("render.showGrid", falso(r["showGrid"]));
  checar("render.pixelRatio", numero(r, "pixelRatio") > 0);
  return Value();
}

                                                                                      

Value fisica() {
  Value ph = api("physics"), s = api("scene");
  checar("physics.enabled", verdadeiro(ph["enabled"]));
  checar("physics.gravity", ph["gravity"].y() < 0);
  checar("physics.settings", numero(ph["settings"], "fixedTimestep") > 0);
  for (int i = 1; i <= 5; i++) {
    Value caixa = s.call("spawnPrimitive", "box",
      obj({{"name", "Caixa" + std::to_string(i)},
        {"position", v3(-2 + (i - 1) * 1.1, 3 + (i - 1) * 1.2, 3)},
        {"rigidBody", obj({{"type", "dynamic"}, {"collider", "box"}, {"mass", 2}, {"restitution", 0.3}})},
        {"tags", arr({"caixa"})}}));
    api("material").call("setColor", caixa, api("math.color").call("hsl", 30 + i * 12, 0.7, 0.5));
  }
  Value caixas = s.call("byTag", "caixa");
  Value primeira = caixas[0];
  checar("caixas dinâmicas", caixas.length() == 5 && ph.call("hasBody", primeira).truthy());
  Value corpo = ph.call("bodyOf", primeira);
  checar("bodyOf", verdadeiro(corpo["isDynamic"]) && numero(corpo, "mass") > 0);
  corpo.call("applyImpulse", v3(0, 2, 0));
  corpo.call("applyTorque", v3(0, 1, 0));
  corpo.call("setMaterial", obj({{"friction", 0.8}}));
  corpo.call("wake");
  checar("body.linearVelocity", !corpo["linearVelocity"].isNone());
  checar("bodies()", ph.call("bodies").length() >= 6);
  Value hit = ph.call("raycast", v3(0, 5, 0), v3(0, -1, 0), 20);
  checar("physics.raycast", !hit.isNone() && !hit["entity"].isNone());
  checar("raycastAll", ph.call("raycastAll", v3(0, 5, 0), v3(0, -1, 0), 20).length() >= 1);
  checar("overlapSphere", ph.call("overlapSphere", v3(0, 3, 3), 4).isArray());
  checar("massProperties", numero(ph.call("massProperties", primeira), "mass") > 0);
  checar("colliderVolume", ph.call("colliderVolume", primeira).number() > 0);
  Value formas = ph["shapes"];
  checar("shapes.sphere volume", aprox(formas.call("volume", formas.call("sphere", 1)).number(), 4.18879, 0.01));
  assinar(ph.call("onCollisionBegin", helix::function([](const Args& a) {
    if (++g.colisoes > 3) return;
    Value e = a[0];
    info(fmt("Colisão: %s × %s (impulso %.2f)", e["a"]["name"].str().c_str(), e["b"]["name"].str().c_str(), numero(e["contact"], "impulse")));
  })));
  assinar(ph.call("onOutOfBounds", helix::function([](const Args& a) { aviso(a[0]["name"].str() + " caiu do mundo"); })));
  Value gatilho = s.call("spawn", "group", obj({{"name", "Gatilho"}, {"position", v3(0, 1, 3)}, {"trigger", obj({{"shape", "box"}, {"size", v3(3, 2, 3)}})}}));
  checar("trigger spawn", !gatilho.isNone() && s.call("isAttached", gatilho).truthy());
  checar("physics.stats", ph["stats"]["bodies"].isNumber());
  return Value();
}

Value personagem() {
  Value ch = api("character"), pl = api("player");
  Value novo = ch.call("spawn", obj({{"name", "Heroi"}, {"position", v3(0, 1.2, 8)}, {"character", obj({{"walkSpeed", 4}, {"runSpeed", 7}, {"jumpHeight", 1.4}})}}));
  g.heroi = novo;
  checar("character.spawn", !novo["character"].isNone() && ch.call("has", novo).truthy());
  Value c = ch.call("of", novo);
  checar("character.of", c["isGrounded"].isBoolean());
  checar("settingsOf", numero(ch.call("settingsOf", novo), "walkSpeed") == 4);
  pl.call("possess", novo);
  checar("player.possess", pl["possessed"] == novo && verdadeiro(pl["isPossessing"]));
  assinar(ch.call("onJumped", helix::function([](const Args& a) { info(a[0]["entity"]["name"].str() + " pulou"); })));
  assinar(pl.call("onPossessed", helix::function([](const Args& a) {
    Value entidade = a[0];
    info("Possuindo " + (entidade.isNone() ? std::string("ninguém") : entidade["name"].str()));
  })));
  checar("character.all", ch.call("all").length() >= 1);
  checar("player.spawnPoint", !pl["spawnPoint"].isNone());
  checar("character.velocity", !c["velocity"].isNone() && !c["position"].isNone());
  return Value();
}

Value terreno() {
  Value te = api("terrain");
  checar("terrain.presets", te.call("presets").length() > 0);
  Value colinas = te.call("spawn", obj({{"name", "Colinas"}, {"size", 48}, {"resolution", 65}, {"preset", "hills"}, {"seed", 7}, {"position", v3(0, -6, -70)}}));
  checar("terrain.spawn", !colinas["terrain"].isNone() && te.call("all").length() >= 1);
  checar("terrain.of", numero(te.call("of", colinas), "resolution") == 65);
  checar("heightAt", te.call("heightAt", v3(0, 0, -70), colinas).isNumber());
  checar("contains", te.call("contains", v3(0, 0, -70), colinas).truthy() && !te.call("contains", v3(500, 0, 0), colinas).truthy());
  te.call("sculpt", colinas, "raise", v3(5, 0, -70), obj({{"radius", 6}, {"strength", 1}}), 1);
  te.call("markDirty", colinas);
  Value grama = te["grass"];
  grama.call("set", colinas, obj({{"enabled", true}, {"density", 0.5}}));
  checar("grass.set", verdadeiro(grama.call("settingsOf", colinas)["enabled"]));
  Value agua = te["water"];
  agua.call("set", colinas, obj({{"enabled", true}, {"level", -2}}));
  checar("water.set", verdadeiro(agua.call("settingsOf", colinas)["enabled"]));
  checar("terrain.raycast", !te.call("raycast", v3(0, 50, -70), v3(0, -1, 0), colinas).isNone());
  return Value();
}

                                                                                        

void soltarCaixa() {
  Value random = api("math.random");
  Value caixa = api("scene").call("spawnPrimitive", "box",
    obj({{"name", "CaixaSolta"},
      {"position", v3(random.call("range", -3, 3).number(), 6, random.call("range", 0, 4).number())},
      {"rigidBody", obj({{"type", "dynamic"}, {"collider", "box"}, {"mass", 1}})},
      {"tags", arr({"caixa"})}}));
  api("material").call("setColor", caixa, random.call("color"));
  api("gui").call("bind", "pontos", ++g.pontos);
  api("events").call("emit", "debug.caixa", obj({{"nome", caixa["name"]}}));
}

Value interfaceGrafica() {
  Value gui = api("gui");
  gui.call("css", "DebugEstilo");
  Value hud = gui.call("html", "DebugHud", obj({{"id", "debug-hud"}}));
  checar("gui.html", !hud.isNone() && !gui.call("element", "#debug-hud").isNone());
  Value icone = gui.call("svg", "DebugIcone", obj({{"id", "debug-icone"}}));
  checar("gui.svg", !icone.isNone());
  Value slot = gui.call("element", "[data-slot=icone]");
  if (!slot.isNone() && !icone.isNone()) slot.call("appendChild", icone);
  checar("gui.bind", gui.call("bind", "linguagem", LINGUAGEM).number() >= 1);
  gui.call("bind", "titulo", "Helix · Debug");
  assinar(gui.call("onAction", "caixa", helix::function([] { soltarCaixa(); })));
  assinar(gui.call("onAction", "reiniciar", helix::function([] { api("play").call("restart"); })));
  checar("gui.elements", gui.call("elements", "[data-bind]").length() >= 5);
  checar("gui.size", numero(gui["size"], "width") > 0);
  Value declarativa = gui.call("create", "DebugTela", obj({{"referenceSize", xy(1280, 720)}}));
  Value painel = gui.call("add", declarativa, "frame",
    obj({{"name", "Painel"},
`;
}
