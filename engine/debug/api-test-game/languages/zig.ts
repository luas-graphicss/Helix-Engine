import type { GameSources } from '../types';
export function zigGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
const std = @import("std");
const helix = @import("helix");
const Value = helix.Value;
const V = helix.Vec3;

const LINGUAGEM = "Zig";
const MAX_ASSINATURAS = 48;

var quadros: u32 = 0;
var passos_fisica: u32 = 0;
var late_updates: u32 = 0;
var renders: u32 = 0;
var colisoes: u32 = 0;
var checagens: u32 = 0;
var falhas: u32 = 0;
var pontos: u32 = 0;
var hud_timer: f64 = 0;
                                                                    
var torus: Value = Value.none;
var heroi: Value = Value.none;
var efeito: Value = Value.none;
var tela: Value = Value.none;
var assinaturas: [MAX_ASSINATURAS]Value = undefined;
var n_assinaturas: usize = 0;

                                                                                         

                                                                               
fn api(caminho: []const u8) Value {
    const raiz = helix.root();
    defer raiz.deinit();
    return raiz.path(caminho);
}

                                                                                               
fn exec(caminho: []const u8, args: anytype) void {
    helix.call(caminho, args).deinit();
}

fn descartar(valor: Value) void {
    valor.deinit();
}

fn arg(args: []const Value, indice: usize) Value {
    return if (indice < args.len) args[indice] else Value.none;
}

fn registrar(metodo: []const u8, comptime fmt: []const u8, args: anytype) void {
    var caminho_buf: [32]u8 = undefined;
    const caminho = std.fmt.bufPrint(&caminho_buf, "log.{s}", .{metodo}) catch "log.info";
    var buffer: [768]u8 = undefined;
    const mensagem = std.fmt.bufPrint(&buffer, fmt, args) catch "(mensagem longa demais para formatar)";
    exec(caminho, .{ "Debug", mensagem });
}

fn info(comptime fmt: []const u8, args: anytype) void {
    registrar("info", fmt, args);
}

fn aviso(comptime fmt: []const u8, args: anytype) void {
    registrar("warn", fmt, args);
}

fn erro(comptime fmt: []const u8, args: anytype) void {
    registrar("error", fmt, args);
}

fn depurar(comptime fmt: []const u8, args: anytype) void {
    registrar("debug", fmt, args);
}

fn checar(nome: []const u8, condicao: bool) void {
    checagens += 1;
    if (condicao) return;
    falhas += 1;
    erro("FALHOU {s}", .{nome});
}

fn checarf(nome: []const u8, condicao: bool, comptime fmt: []const u8, args: anytype) void {
    checagens += 1;
    if (condicao) return;
    falhas += 1;
    var buffer: [256]u8 = undefined;
    const detalhe = std.fmt.bufPrint(&buffer, fmt, args) catch "(detalhe longo demais)";
    erro("FALHOU {s}: {s}", .{ nome, detalhe });
}

fn assinar(desligar: Value) void {
    if (!desligar.isFunction() or n_assinaturas >= MAX_ASSINATURAS) {
        desligar.deinit();
        return;
    }
    assinaturas[n_assinaturas] = desligar;
    n_assinaturas += 1;
}

fn verdadeiro(valor: Value) bool {
    return valor.isBool() and valor.boolean();
}

fn falso(valor: Value) bool {
    return valor.isBool() and !valor.boolean();
}

fn aprox(a: f64, b: f64, epsilon: f64) bool {
    return @abs(a - b) <= epsilon;
}

fn numero(objeto: Value, chave: []const u8) f64 {
    const campo = objeto.get(chave);
    defer campo.deinit();
    return campo.number();
}

fn textoIgual(valor: Value, esperado: []const u8) bool {
    return valor.isString() and valor.eqlString(esperado);
}

                                                                                          
fn eq3(vetor: Value, x: f64, y: f64, z: f64, epsilon: f64) bool {
    const igual = helix.call("math.vec3.equals", .{ vetor, V.init(x, y, z), epsilon });
    defer igual.deinit();
    return igual.boolean();
}

fn comprimento(vetor: Value) f64 {
    const tamanho = helix.call("math.vec3.length", .{vetor});
    defer tamanho.deinit();
    return tamanho.number();
}

fn contem(lista: Value, texto: []const u8) bool {
    var it = lista.iterator();
    while (it.next()) |item| {
        defer item.deinit();
        if (item.eqlString(texto)) return true;
    }
    return false;
}

                                                              
fn nomeDe(entidade: Value, buffer: []u8) []const u8 {
    if (entidade.isNone()) return "ninguém";
    const nome = entidade.get("name");
    defer nome.deinit();
    return nome.stringBuf(buffer);
}

                                                                                          

fn nucleo() Value {
    const raiz = helix.root();
    defer raiz.deinit();
    const engine = raiz.get("engine");
    defer engine.deinit();
    const nome = engine.get("name");
    defer nome.deinit();
    const versao = engine.get("version");
    defer versao.deinit();
    const api_versao = engine.get("apiVersion");
    defer api_versao.deinit();
    const contexto = raiz.get("context");
    defer contexto.deinit();
    checar("engine.name", nome.isString() and nome.stringLen() > 0);
    checar("engine.version", versao.isString());
    var contexto_buf: [16]u8 = undefined;
    const contexto_texto = contexto.stringBuf(&contexto_buf);
    checarf("context", contexto.eqlString("shared") or contexto.eqlString("client") or contexto.eqlString("server"), "{s}", .{contexto_texto});
    const jogando = raiz.get("isPlaying");
    defer jogando.deinit();
    checar("isPlaying", verdadeiro(jogando));
    const editor = raiz.get("isEditor");
    defer editor.deinit();
    checar("isEditor", falso(editor));
    const ator = helix.actor();
    defer ator.deinit();
    const proprio = raiz.get("self");
    defer proprio.deinit();
    checar("self no script de entrada", ator.isNone() and proprio.isNone());
    const handle_script = helix.script();
    defer handle_script.deinit();
    checar("script() é o handle do script", handle_script.isObject());
    checar("now", helix.now() >= 0);
    info("{f} {f} · API {f} · {s}", .{ nome, versao, api_versao, LINGUAGEM });
    helix.print("print direto do Zig (log sem canal)", .{});
    return Value.none;
}

fn modulo() Value {
    const util = helix.require("DebugUtil");
    defer util.deinit();
    const soma_fn = util.get("soma");
    defer soma_fn.deinit();
    checar("require devolve as funções", util.isObject() and soma_fn.isFunction());
    const resultado = util.invoke("soma", .{ 2, 3 });
    defer resultado.deinit();
    checarf("require soma", resultado.number() == 5, "{d}", .{resultado.number()});
    const saudacao = util.invoke("saudacao", .{"Helix"});
    defer saudacao.deinit();
    checar("require saudacao", textoIgual(saudacao, "Olá, Helix"));
    const limitado = util.invoke("limitar", .{ 15, 0, 10 });
    defer limitado.deinit();
    checar("require limitar", limitado.number() == 10);
    return Value.none;
}

fn matematica() Value {
    const m = api("math");
    defer m.deinit();
    checar("vec3.add", eq3(helix.call("math.vec3.add", .{ V.init(1, 2, 3), V.init(1, 1, 1) }), 2, 3, 4, 1e-6));
    checar("vec3.length", aprox(helix.call("math.vec3.length", .{V.init(3, 4, 0)}).number(), 5, 1e-3));
    checar("vec3.normalize", aprox(comprimento(helix.call("math.vec3.normalize", .{V.init(0, 5, 0)})), 1, 1e-3));
    checar("vec3.cross", eq3(helix.call("math.vec3.cross", .{ V.init(1, 0, 0), V.init(0, 1, 0) }), 0, 0, 1, 1e-6));
    checar("vec3.lerp", eq3(helix.call("math.vec3.lerp", .{ V.init(0, 0, 0), V.init(2, 2, 2), 0.5 }), 1, 1, 1, 1e-6));
    const q = helix.call("math.quat.fromEuler", .{V.init(0, 90, 0)});
    defer q.deinit();
    checar("quat.rotateVec3", eq3(helix.call("math.quat.rotateVec3", .{ q, V.init(1, 0, 0) }), 0, 0, -1, 1e-3));
    checar("quat.toEuler", aprox(numero(helix.call("math.quat.toEuler", .{q}), "y"), 90, 0.01));
    const mat = helix.call("math.mat4.fromTRS", .{ V.init(1, 2, 3), V.init(0, 0, 0), V.init(1, 1, 1) });
    defer mat.deinit();
    checar("mat4.transformPoint", eq3(helix.call("math.mat4.transformPoint", .{ mat, V.init(0, 0, 0) }), 1, 2, 3, 1e-6));
    checar("mat4.invert", !helix.call("math.mat4.invert", .{mat}).isNone());
    const caixa = helix.call("math.aabb.fromCenterSize", .{ V.init(0, 0, 0), V.init(2, 2, 2) });
    defer caixa.deinit();
    checar("aabb.contains", helix.call("math.aabb.contains", .{ caixa, V.init(0.5, 0.5, 0.5) }).boolean() and !helix.call("math.aabb.contains", .{ caixa, V.init(2, 0, 0) }).boolean());
    const raio = helix.call("math.ray.create", .{ V.init(0, 5, 0), V.init(0, -1, 0) });
    defer raio.deinit();
    checar("ray.intersectAabb", !helix.call("math.ray.intersectAabb", .{ raio, caixa }).isNone());
    checar("scalar.remap", helix.call("math.scalar.remap", .{ 5, 0, 10, 0, 100 }).number() == 50);
    checar("clamp/lerp", helix.call("math.clamp", .{ 15, 0, 10 }).number() == 10 and helix.call("math.lerp", .{ 0, 10, 0.5 }).number() == 5);
    checar("scalar.wrapAngle", aprox(helix.call("math.scalar.wrapAngle", .{370}).number(), 10, 1e-3));
    checar("degToRad", aprox(helix.call("math.degToRad", .{180}).number(), std.math.pi, 1e-6));
    const perlin = helix.call("math.noise.perlin2", .{ 0.3, 0.7 }).number();
    checarf("noise.perlin2", perlin >= -1.01 and perlin <= 1.01, "{d}", .{perlin});
    checar("noise.fbm", helix.call("math.noise.fbm", .{ 1.5, 2.5, 0, 4 }).isNumber());
    checar("color.hexToVec3", eq3(helix.call("math.color.hexToVec3", .{"#ff0000"}), 1, 0, 0, 0.01));
    const hex = helix.call("math.color.vec3ToHex", .{V.init(1, 1, 1)});
    defer hex.deinit();
    var hex_buf: [16]u8 = undefined;
    const hex_texto = hex.stringBuf(&hex_buf);
    checarf("color.vec3ToHex", std.ascii.eqlIgnoreCase(hex_texto, "#ffffff"), "{s}", .{hex_texto});
    exec("math.random.seed", .{42});
    const primeiro = helix.call("math.random.value", .{}).number();
    exec("math.random.seed", .{42});
    checar("random.seed determinístico", helix.call("math.random.value", .{}).number() == primeiro);
    const sorteado = helix.call("math.random.int", .{ 1, 6 }).number();
    checar("random.int", sorteado >= 1 and sorteado <= 6 and @floor(sorteado) == sorteado);
    checar("random.unitVector", aprox(comprimento(helix.call("math.random.unitVector", .{})), 1, 1e-3));
    checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI") * 2, 1e-9));
    return Value.none;
}

                                                                                           

var visitados: u32 = 0;

fn contarVisita(args: []const Value) Value {
    _ = args;
    visitados += 1;
    return Value.none;
}

fn cena() Value {
    const s = api("scene");
    defer s.deinit();
    const raiz = s.get("root");
    defer raiz.deinit();
    const filhos = raiz.get("children");
    defer filhos.deinit();
    checar("scene.root", !raiz.isNone() and filhos.isArray());
    const antes = s.invoke("count", .{}).number();
    const grupo = s.invoke("spawn", .{ "group", .{ .name = "DebugCenario" } });
    defer grupo.deinit();
    const chao = s.invoke("spawn", .{ "mesh", .{
        .name = "Chao",
        .mesh = helix.call("mesh.plane", .{ 40, 40 }),
        .material = helix.call("material.create", .{.{ .baseColor = "#4b6b3a", .roughness = 0.95 }}),
        .rigidBody = .{ .@"type" = "static", .collider = "box", .boxSize = V.init(40, 0.2, 40), .center = V.init(0, -0.1, 0) },
        .receiveShadows = true,
        .tags = .{"chao"},
    }, grupo });
    defer chao.deinit();
    const tipo = chao.get("kind");
    defer tipo.deinit();
    checar("spawn mesh", textoIgual(tipo, "mesh") and !chao.get("mesh").isNone() and !chao.get("rigidBody").isNone());
    checar("find", s.invoke("find", .{"Chao"}).equals(chao));
    checar("findAll", s.invoke("findAll", .{"Chao"}).len() == 1);
    checar("byId", s.invoke("byId", .{chao.get("id")}).equals(chao));
    checar("byTag", s.invoke("byTag", .{"chao"}).len() >= 1);
    checar("byKind", s.invoke("byKind", .{"mesh"}).len() >= 1);
    const depois = s.invoke("count", .{}).number();
    checarf("count", depois == antes + 2, "{d} vs {d}", .{ depois, antes + 2 });
    checar("contains", s.invoke("contains", .{ grupo, chao }).boolean() and s.invoke("contains", .{ raiz, chao }).boolean());
    const caminho = s.invoke("path", .{chao});
    defer caminho.deinit();
    var caminho_buf: [128]u8 = undefined;
    const caminho_texto = caminho.stringBuf(&caminho_buf);
    checarf("path", std.mem.indexOf(u8, caminho_texto, "Chao") != null, "{s}", .{caminho_texto});
    visitados = 0;
    descartar(s.invoke("traverse", .{ &contarVisita, grupo }));
    checarf("traverse", visitados >= 2, "{d}", .{visitados});

    const anel = s.invoke("spawnPrimitive", .{ "torus", .{ .name = "Anel", .position = V.init(-4, 1.2, -2), .scale = 1.5 }, grupo });
    exec("material.setColor", .{ anel, "#3a86ff" });
    exec("material.setEmissive", .{ anel, "#3a86ff", 0.6 });
    checar("spawnPrimitive", !anel.get("mesh").isNone() and !anel.get("material").isNone());
    torus = anel;

    const copia = s.invoke("clone", .{ anel, true, grupo });
    defer copia.deinit();
    descartar(s.invoke("rename", .{ copia, "AnelCopia" }));
    exec("transform.setPosition", .{ copia, V.init(-4, 1.2, 2) });
    const nome_copia = copia.get("name");
    defer nome_copia.deinit();
    checar("clone + rename", textoIgual(nome_copia, "AnelCopia") and s.invoke("find", .{"AnelCopia"}).equals(copia));
    descartar(s.invoke("setMeta", .{ copia, "origem", "clone" }));
    checar("meta", textoIgual(s.invoke("getMeta", .{ copia, "origem" }), "clone"));
    descartar(s.invoke("addTag", .{ copia, "temporario" }));
    checar("addTag/hasTag", s.invoke("hasTag", .{ copia, "temporario" }).boolean());
    checar("removeTag", verdadeiro(s.invoke("removeTag", .{ copia, "temporario" })) and !s.invoke("hasTag", .{ copia, "temporario" }).boolean());
    descartar(s.invoke("setVisible", .{ copia, false }));
    checar("setVisible", falso(copia.get("visible")));
    descartar(s.invoke("setVisible", .{ copia, true }));
    descartar(s.invoke("destroy", .{copia}));
    checar("destroy", s.invoke("find", .{"AnelCopia"}).isNone() and !s.invoke("isAttached", .{copia}).boolean());

    const esfera = s.invoke("spawnPrimitive", .{ "sphere", .{ .name = "Esfera", .position = V.init(4, 0.5, -3) } });
    defer esfera.deinit();
    descartar(s.invoke("reparent", .{ esfera, grupo }));
    checar("reparent", esfera.get("parent").equals(grupo));
    exec("material.setColor", .{ esfera, "#ffbe0b" });
    descartar(s.invoke("addComponent", .{ esfera, "rigidBody", .{ .@"type" = "dynamic", .collider = "sphere", .radius = 0.5, .mass = 1 } }));
    checar("addComponent", !esfera.get("rigidBody").isNone() and textoIgual(esfera.path("rigidBody.type"), "dynamic"));
    const temporario = s.invoke("spawnPrimitive", .{ "box", .{ .name = "Temporario" } });
    defer temporario.deinit();
    descartar(s.invoke("addComponent", .{ temporario, "csg", Value.object() }));
    checar("addComponent csg", !temporario.get("csg").isNone());
    descartar(s.invoke("removeComponent", .{ temporario, "csg" }));
    checar("removeComponent", temporario.get("csg").isNone());
    descartar(s.invoke("destroy", .{temporario}));
    checar("kinds/components", contem(s.invoke("kinds", .{}), "mesh") and contem(s.invoke("components", .{}), "rigidBody"));
    return Value.none;
}

fn transformacao() Value {
    const tr = api("transform");
    defer tr.deinit();
    const alvo = helix.call("scene.spawnPrimitive", .{ "cone", .{ .name = "Cone", .position = V.init(0, 0.5, -6) } });
    defer alvo.deinit();
    exec("material.setColor", .{ alvo, "#8338ec" });
    descartar(tr.invoke("setPosition", .{ alvo, V.init(2, 0.5, -6) }));
    checar("setPosition", eq3(tr.invoke("position", .{alvo}), 2, 0.5, -6, 1e-6));
    descartar(tr.invoke("translate", .{ alvo, V.init(0, 1, 0), "world" }));
    checar("translate", aprox(numero(tr.invoke("position", .{alvo}), "y"), 1.5, 1e-3));
    descartar(tr.invoke("setRotation", .{ alvo, V.init(0, 90, 0) }));
    checar("setRotation", aprox(numero(tr.invoke("rotation", .{alvo}), "y"), 90, 0.01));
    descartar(tr.invoke("rotate", .{ alvo, V.init(0, 45, 0) }));
    const girado = helix.call("math.scalar.wrapAngle", .{tr.invoke("rotation", .{alvo}).get("y")}).number();
    checarf("rotate", aprox(girado, 135, 0.01) or aprox(girado, -225, 0.01), "{d}", .{girado});
    descartar(tr.invoke("setScale", .{ alvo, 2 }));
    checar("setScale", aprox(numero(tr.invoke("scale", .{alvo}), "x"), 2, 1e-6));
    descartar(tr.invoke("setScale", .{ alvo, V.init(1, 1, 1) }));
    const mundo = tr.invoke("worldPosition", .{alvo}).vec3();
    checar("worldPosition", eq3(tr.invoke("position", .{alvo}), mundo.x, mundo.y, mundo.z, 1e-3));
    checar("forward/up", aprox(comprimento(tr.invoke("forward", .{alvo})), 1, 1e-3) and aprox(comprimento(tr.invoke("up", .{alvo})), 1, 1e-3));
    descartar(tr.invoke("lookAt", .{ alvo, V.init(0, 1.5, 0) }));
    checar("distance", tr.invoke("distance", .{ alvo, V.init(2, 1.5, -6) }).number() < 0.01);
    checar("directionTo", aprox(comprimento(tr.invoke("directionTo", .{ alvo, V.init(0, 1.5, 0) })), 1, 1e-3));
    const limites = tr.invoke("bounds", .{alvo});
    defer limites.deinit();
    checar("bounds", !limites.isNone() and numero(limites.get("max"), "y") > numero(limites.get("min"), "y"));
    checar("worldMatrix", tr.invoke("worldMatrix", .{alvo}).len() == 16 and tr.invoke("localMatrix", .{alvo}).len() == 16);
    const local = tr.invoke("worldToLocal", .{ alvo, tr.invoke("localToWorld", .{ alvo, V.init(1, 0, 0) }) });
    defer local.deinit();
    checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3));
    return Value.none;
}

fn malhas() Value {
    const me = api("mesh");
    defer me.deinit();
    const caixa = me.invoke("box", .{ 1, 1, 1 });
    defer caixa.deinit();
    const triangulos = me.invoke("triangleCount", .{caixa}).number();
    checarf("mesh.box", me.invoke("vertexCount", .{caixa}).number() > 0 and triangulos == 12, "{d}", .{triangulos});
    const esfera = me.invoke("sphere", .{ 0.65, 16, 12 });
    defer esfera.deinit();
    const furado = helix.call("csg.boolean", .{ caixa, esfera, "subtract" });
    defer furado.deinit();
    checar("csg.boolean", me.invoke("triangleCount", .{furado}).number() > 12);
    const ator = helix.call("scene.spawn", .{ "mesh", .{
        .name = "CaixaFurada",
        .mesh = furado,
        .material = helix.call("material.create", .{.{ .baseColor = "#e63946", .roughness = 0.4, .metallic = 0.2 }}),
        .position = V.init(4, 0.5, 2),
    } });
    defer ator.deinit();
    checar("spawn malha CSG", !ator.get("mesh").isNone());
    checar("csg.operations", contem(helix.call("csg.operations", .{}), "union"));
    const tri = me.invoke("create", .{.{
        .name = "Triangulo",
        .positions = .{ -1, 0, 0, 1, 0, 0, 0, 1.5, 0 },
        .uvs = .{ 0, 0, 1, 0, 0.5, 1 },
        .indices = .{ 0, 1, 2 },
    }});
    defer tri.deinit();
    descartar(me.invoke("computeNormals", .{tri}));
    checar("mesh.create + computeBounds", numero(me.invoke("computeBounds", .{tri}).get("max"), "y") >= 1.5);
    const dupla = me.invoke("merge", .{ tri, me.invoke("flipWinding", .{me.invoke("clone", .{tri})}) });
    defer dupla.deinit();
    checar("mesh.merge", me.invoke("triangleCount", .{dupla}).number() == 2);
    exec("scene.spawn", .{ "mesh", .{
        .name = "Triangulo",
        .mesh = dupla,
        .material = helix.call("material.create", .{.{ .baseColor = "#06d6a0", .doubleSided = true }}),
        .position = V.init(7, 0, -2),
    } });
    const grande = me.invoke("scale", .{ me.invoke("translate", .{ me.invoke("clone", .{caixa}), V.init(0, 0.5, 0) }), 2 });
    defer grande.deinit();
    checar("mesh.translate/scale", numero(me.invoke("computeBounds", .{grande}).get("max"), "y") > 1.9);
    const distancia = me.invoke("raycast", .{ helix.call("math.ray.create", .{ V.init(0, 5, 0), V.init(0, -1, 0) }), grande });
    defer distancia.deinit();
    checar("mesh.raycast", distancia.isNumber() and distancia.number() > 0);
    const n_vertices: usize = @intFromFloat(me.invoke("vertexCount", .{caixa}).number());
    checar("positions/indices", me.invoke("positions", .{caixa}).len() == n_vertices * 3 and me.invoke("indices", .{caixa}).len() == 36);
    checar("primitivas extras", me.invoke("triangleCount", .{me.invoke("torusKnot", .{})}).number() > 0 and me.invoke("triangleCount", .{me.invoke("capsule", .{})}).number() > 0);
    return Value.none;
}

                                                                                             

fn materiais() Value {
    const mat = api("material");
    defer mat.deinit();
    const base = mat.invoke("create", .{.{ .name = "DebugBase", .baseColor = "#d98c2b", .roughness = 0.5, .metallic = 0.1 }});
    defer base.deinit();
    checar("material.create", numero(base, "roughness") == 0.5);
    const copia = mat.invoke("clone", .{base});
    defer copia.deinit();
    descartar(mat.invoke("set", .{ copia, .{ .roughness = 1, .emissive = "#ffffff", .emissiveIntensity = 2 } }));
    checar("material.clone/set", numero(copia, "roughness") == 1 and numero(base, "roughness") == 0.5);
    const caixa = helix.call("scene.spawnPrimitive", .{ "box", .{ .name = "CaixaPintada", .position = V.init(-7, 0.5, 2) } });
    defer caixa.deinit();
    descartar(mat.invoke("assign", .{ caixa, base }));
    checar("material.assign/of", !mat.invoke("of", .{caixa}).isNone());
    descartar(mat.invoke("own", .{caixa}));
    descartar(mat.invoke("setColor", .{ caixa, "#d98c2b" }));
    const desenho = helix.call("texture.canvas", .{ 64, 64 });
    defer desenho.deinit();
    descartar(desenho.invoke("update", .{}));
    const textura = desenho.get("texture");
    defer textura.deinit();
    descartar(mat.invoke("setTexture", .{ caixa, "baseColorMap", textura }));
    checar("texture.canvas + setTexture", mat.invoke("hasAnyTexture", .{mat.invoke("of", .{caixa})}).boolean() and helix.call("texture.isTexture", .{textura}).boolean());
    checar("material.slots", mat.invoke("slots", .{}).len() > 0);
    checar("materials.list", helix.call("materials.list", .{}).isArray());
    const sombreado = mat.invoke("fromShader", .{ "DebugSuperficie", .{ .glow = V.init(1, 0.45, 0.1), .speed = 2 } });
    defer sombreado.deinit();
    checar("material.fromShader", !sombreado.isNone());
    if (!sombreado.isNone()) {
        const esfera = helix.call("scene.spawnPrimitive", .{ "sphere", .{ .name = "EsferaShader", .position = V.init(0, 1, -3), .scale = 1.4 } });
        defer esfera.deinit();
        descartar(mat.invoke("assign", .{ esfera, sombreado }));
        const uniforms = mat.invoke("uniforms", .{esfera});
        defer uniforms.deinit();
        descartar(uniforms.invoke("set", .{ "speed", 3 }));
        checar("material.uniforms.list", uniforms.invoke("list", .{}).len() >= 1);
    }
    return Value.none;
}

fn luzes() Value {
    const l = api("light");
    defer l.deinit();
    checar("light.types", contem(l.invoke("types", .{}), "point") and contem(l.invoke("localTypes", .{}), "spot"));
    const lampada = l.invoke("spawn", .{ "point", .{ .name = "Lampada", .position = V.init(0, 3, 0), .color = "#ffd166", .intensity = 60, .range = 14 } });
    defer lampada.deinit();
    checar("light.spawn", !lampada.get("light").isNone() and textoIgual(lampada.path("light.type"), "point"));
    descartar(l.invoke("set", .{ lampada, .{ .intensity = 80 } }));
    checar("light.set", numero(lampada.get("light"), "intensity") == 80);
    descartar(l.invoke("setTemperature", .{ lampada, 3200 }));
    checar("setTemperature", numero(lampada.get("light"), "temperature") == 3200);
    const foco = l.invoke("spawn", .{ "spot", .{
        .name = "Holofote",
        .position = V.init(4, 4, 0),
        .rotation = V.init(-90, 0, 0),
        .intensity = 120,
        .range = 16,
        .innerAngle = 20,
        .outerAngle = 35,
        .color = "#ffffff",
    } });
    defer foco.deinit();
    checar("spot", textoIgual(foco.path("light.type"), "spot"));
    const convertido = l.invoke("convert", .{ foco, "disc" });
    defer convertido.deinit();
    checar("light.convert", textoIgual(convertido.get("type"), "disc") and textoIgual(foco.path("light.type"), "disc"));
    descartar(l.invoke("convert", .{ foco, "spot" }));
    const presets = l.invoke("presets", .{});
    defer presets.deinit();
    checar("light.presets", presets.len() > 0);
    if (presets.len() > 0) {
        const primeiro = presets.at(0);
        defer primeiro.deinit();
        const id = primeiro.get("id");
        defer id.deinit();
        const preset = l.invoke("spawn", .{ id, .{ .name = "LuzPreset", .position = V.init(-4, 2.5, 4) } });
        defer preset.deinit();
        checar("light.fromPreset", !preset.get("light").isNone() and l.invoke("fromPreset", .{id}).get("type").equals(primeiro.get("type")));
    }
    checar("light.all", l.invoke("all", .{.{ .local = true }}).len() >= 2);
    checar("effectiveRange", l.invoke("effectiveRange", .{lampada}).number() > 0);
    checar("light.isLocal", verdadeiro(l.invoke("isLocal", .{lampada})));
    checar("temperatureToColor", !l.invoke("temperatureToColor", .{6500}).isNone());
    descartar(l.invoke("setColor", .{ lampada, "#ffffff" }));
    checar("light.setColor", eq3(lampada.path("light.color"), 1, 1, 1, 0.01));
    return Value.none;
}

fn horaMudou(args: []const Value) Value {
    info("Hora do céu: {f}", .{arg(args, 0)});
    return Value.none;
}

fn ceu() Value {
    const sky = api("sky");
    defer sky.deinit();
    const mundo = api("world");
    defer mundo.deinit();
    descartar(sky.invoke("set", .{.{ .timeOfDay = 10.5, .haze = 0.3, .clouds = .{ .enabled = true, .coverage = 0.45 } }}));
    checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) and verdadeiro(sky.path("clouds.enabled")));
    checar("sky.isDay", verdadeiro(sky.get("isDay")));
    checar("sky.sunDirection", numero(sky.invoke("sunDirection", .{}), "y") > 0);
    const hora = sky.invoke("formatTimeOfDay", .{10.5});
    defer hora.deinit();
    var hora_buf: [16]u8 = undefined;
    const hora_texto = hora.stringBuf(&hora_buf);
    checarf("sky.formatTimeOfDay", std.mem.indexOfScalar(u8, hora_texto, ':') != null, "{s}", .{hora_texto});
    checar("sky.wrapTimeOfDay", sky.invoke("wrapTimeOfDay", .{25}).number() == 1);
    checar("sky.presets", sky.invoke("presets", .{}).len() > 0);
    assinar(sky.invoke("onHourChanged", .{&horaMudou}));
    sky.set("cycleSpeed", 0);
    checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0);
    checar("world.gravity", numero(mundo.get("gravity"), "y") < 0);
    exec("world.wind.set", .{.{ .speed = 2, .direction = 45 }});
    checar("world.wind.set", numero(mundo.get("wind"), "speed") == 2);
    return Value.none;
}

fn cameraMudou(args: []const Value) Value {
    const entidade = arg(args, 0);
    var nome_buf: [64]u8 = undefined;
    const nome = if (entidade.isNone()) "editor/jogador" else nomeDe(entidade, &nome_buf);
    info("Câmera principal: {s}", .{nome});
    return Value.none;
}

fn camera() Value {
    const c = api("camera");
    defer c.deinit();
    checar("camera.fov", numero(c, "fov") > 0 and numero(c, "aspect") > 0);
    checar("camera.near/far", numero(c, "near") > 0 and numero(c, "far") > numero(c, "near"));
    const viewport = c.get("viewport");
    defer viewport.deinit();
    checar("viewport", numero(viewport, "width") > 0);
    const na_tela = c.invoke("worldToScreen", .{V.init(0, 0, 0)});
    defer na_tela.deinit();
    checar("worldToScreen", na_tela.isNone() or na_tela.get("x").isNumber());
    const raio = c.invoke("screenToRay", .{ numero(viewport, "width") / 2, numero(viewport, "height") / 2 });
    defer raio.deinit();
    checar("screenToRay", raio.isNone() or aprox(comprimento(raio.get("direction")), 1, 0.01));
    checar("viewMatrix", c.get("viewMatrix").len() == 16);
    const jogador = c.get("player");
    defer jogador.deinit();
    descartar(jogador.invoke("set", .{.{ .distance = 7, .pitch = 18 }}));
    checar("player.set", numero(jogador.get("settings"), "distance") == 7);
    checar("distanceTo", c.invoke("distanceTo", .{V.init(0, 0, 0)}).number() >= 0);
    checar("camera.position", !c.get("position").isNone() and !c.get("forward").isNone());
    assinar(c.invoke("onMainChanged", .{&cameraMudou}));
    return Value.none;
}

fn pos() Value {
    const p = api("post");
    defer p.deinit();
    checar("post.toneMappers", p.invoke("toneMappers", .{}).len() > 0);
    descartar(p.invoke("set", .{.{
        .bloom = .{ .enabled = true, .intensity = 0.5, .threshold = 1, .softKnee = 0.5, .radius = 0.6 },
        .vignette = .{ .enabled = true, .intensity = 0.35, .smoothness = 0.5, .roundness = 1 },
    }}));
    checar("post.set", verdadeiro(p.path("bloom.enabled")) and verdadeiro(p.path("vignette.enabled")));
    p.set("exposure", 1.05);
    checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3));
    p.set("toneMapper", "agx");
    checar("post.toneMapper", textoIgual(p.get("toneMapper"), "agx"));
    checar("post.presets", p.invoke("presets", .{}).len() > 0);
    const custom = p.get("custom");
    defer custom.deinit();
    const novo = custom.invoke("add", .{.{ .fragment = "DebugPost", .name = "DebugPost", .uniforms = .{ .tint = V.init(0.15, 0.05, 0.3), .strength = 0.6 } }});
    checar("post.custom.add", !novo.isNone() and !custom.invoke("get", .{"DebugPost"}).isNone());
    const uniforms = novo.get("uniforms");
    defer uniforms.deinit();
    descartar(uniforms.invoke("set", .{ "strength", 0.8 }));
    checar("efeito.uniforms.list", uniforms.invoke("list", .{}).len() >= 2);
    efeito = novo;
    return Value.none;
}

fn contarRender(args: []const Value) Value {
    _ = args;
    renders += 1;
    return Value.none;
}

fn render() Value {
    const r = api("render");
    defer r.deinit();
    checar("render.passNames", r.invoke("passNames", .{}).len() > 0);
    checar("render.stats", r.path("stats.drawCalls").isNumber());
    checar("render.frame", r.path("frame.width").isNumber());
    assinar(r.invoke("onAfterFrame", .{&contarRender}));
    r.set("showGrid", false);
    checar("render.showGrid", falso(r.get("showGrid")));
    checar("render.pixelRatio", numero(r, "pixelRatio") > 0);
    return Value.none;
}

                                                                                          

fn aoColidir(args: []const Value) Value {
    colisoes += 1;
    if (colisoes > 3) return Value.none;
    const e = arg(args, 0);
    var a_buf: [64]u8 = undefined;
    var b_buf: [64]u8 = undefined;
    const a = e.get("a");
    defer a.deinit();
    const b = e.get("b");
    defer b.deinit();
    const contato = e.get("contact");
    defer contato.deinit();
    info("Colisão: {s} × {s} (impulso {d:.2})", .{ nomeDe(a, &a_buf), nomeDe(b, &b_buf), numero(contato, "impulse") });
    return Value.none;
}

fn foraDoMundo(args: []const Value) Value {
    var nome_buf: [64]u8 = undefined;
    aviso("{s} caiu do mundo", .{nomeDe(arg(args, 0), &nome_buf)});
    return Value.none;
}

fn fisica() Value {
    const ph = api("physics");
    defer ph.deinit();
    const s = api("scene");
    defer s.deinit();
    checar("physics.enabled", verdadeiro(ph.get("enabled")));
    checar("physics.gravity", numero(ph.get("gravity"), "y") < 0);
    checar("physics.settings", numero(ph.get("settings"), "fixedTimestep") > 0);
    for (1..6) |i| {
        const indice: f64 = @floatFromInt(i - 1);
        var nome_buf: [16]u8 = undefined;
        const nome = std.fmt.bufPrint(&nome_buf, "Caixa{d}", .{i}) catch "Caixa";
        const caixa = s.invoke("spawnPrimitive", .{ "box", .{
            .name = nome,
            .position = V.init(-2 + indice * 1.1, 3 + indice * 1.2, 3),
            .rigidBody = .{ .@"type" = "dynamic", .collider = "box", .mass = 2, .restitution = 0.3 },
            .tags = .{"caixa"},
        } });
        defer caixa.deinit();
        exec("material.setColor", .{ caixa, helix.call("math.color.hsl", .{ 30 + (indice + 1) * 12, 0.7, 0.5 }) });
    }
    const caixas = s.invoke("byTag", .{"caixa"});
    defer caixas.deinit();
    const primeira = caixas.at(0);
    defer primeira.deinit();
    checar("caixas dinâmicas", caixas.len() == 5 and ph.invoke("hasBody", .{primeira}).boolean());
    const corpo = ph.invoke("bodyOf", .{primeira});
    defer corpo.deinit();
    checar("bodyOf", verdadeiro(corpo.get("isDynamic")) and numero(corpo, "mass") > 0);
    descartar(corpo.invoke("applyImpulse", .{V.init(0, 2, 0)}));
    descartar(corpo.invoke("applyTorque", .{V.init(0, 1, 0)}));
    descartar(corpo.invoke("setMaterial", .{.{ .friction = 0.8 }}));
    descartar(corpo.invoke("wake", .{}));
    checar("body.linearVelocity", !corpo.get("linearVelocity").isNone());
    checar("bodies()", ph.invoke("bodies", .{}).len() >= 6);
    const hit = ph.invoke("raycast", .{ V.init(0, 5, 0), V.init(0, -1, 0), 20 });
    defer hit.deinit();
    checar("physics.raycast", !hit.isNone() and !hit.get("entity").isNone());
    checar("raycastAll", ph.invoke("raycastAll", .{ V.init(0, 5, 0), V.init(0, -1, 0), 20 }).len() >= 1);
    checar("overlapSphere", ph.invoke("overlapSphere", .{ V.init(0, 3, 3), 4 }).isArray());
    checar("massProperties", numero(ph.invoke("massProperties", .{primeira}), "mass") > 0);
    checar("colliderVolume", ph.invoke("colliderVolume", .{primeira}).number() > 0);
    const formas = ph.get("shapes");
    defer formas.deinit();
    checar("shapes.sphere volume", aprox(formas.invoke("volume", .{formas.invoke("sphere", .{1})}).number(), 4.18879, 0.01));
    assinar(ph.invoke("onCollisionBegin", .{&aoColidir}));
    assinar(ph.invoke("onOutOfBounds", .{&foraDoMundo}));
    const gatilho = s.invoke("spawn", .{ "group", .{ .name = "Gatilho", .position = V.init(0, 1, 3), .trigger = .{ .shape = "box", .size = V.init(3, 2, 3) } } });
    defer gatilho.deinit();
    checar("trigger spawn", !gatilho.isNone() and s.invoke("isAttached", .{gatilho}).boolean());
    checar("physics.stats", ph.path("stats.bodies").isNumber());
    return Value.none;
}

fn aoPular(args: []const Value) Value {
    var nome_buf: [64]u8 = undefined;
    const entidade = arg(args, 0).get("entity");
    defer entidade.deinit();
    info("{s} pulou", .{nomeDe(entidade, &nome_buf)});
    return Value.none;
}

fn aoPossuir(args: []const Value) Value {
    var nome_buf: [64]u8 = undefined;
    info("Possuindo {s}", .{nomeDe(arg(args, 0), &nome_buf)});
    return Value.none;
}

fn personagem() Value {
    const ch = api("character");
    defer ch.deinit();
    const pl = api("player");
    defer pl.deinit();
    const novo = ch.invoke("spawn", .{.{ .name = "Heroi", .position = V.init(0, 1.2, 8), .character = .{ .walkSpeed = 4, .runSpeed = 7, .jumpHeight = 1.4 } }});
    checar("character.spawn", !novo.get("character").isNone() and ch.invoke("has", .{novo}).boolean());
    const c = ch.invoke("of", .{novo});
    defer c.deinit();
    checar("character.of", c.get("isGrounded").isBool());
    checar("settingsOf", numero(ch.invoke("settingsOf", .{novo}), "walkSpeed") == 4);
    descartar(pl.invoke("possess", .{novo}));
    checar("player.possess", pl.get("possessed").equals(novo) and verdadeiro(pl.get("isPossessing")));
    assinar(ch.invoke("onJumped", .{&aoPular}));
    assinar(pl.invoke("onPossessed", .{&aoPossuir}));
    checar("character.all", ch.invoke("all", .{}).len() >= 1);
    checar("player.spawnPoint", !pl.get("spawnPoint").isNone());
    checar("character.velocity", !c.get("velocity").isNone() and !c.get("position").isNone());
    heroi = novo;
    return Value.none;
}

fn terreno() Value {
    const te = api("terrain");
    defer te.deinit();
    checar("terrain.presets", te.invoke("presets", .{}).len() > 0);
    const colinas = te.invoke("spawn", .{.{ .name = "Colinas", .size = 48, .resolution = 65, .preset = "hills", .seed = 7, .position = V.init(0, -6, -70) }});
    defer colinas.deinit();
    checar("terrain.spawn", !colinas.get("terrain").isNone() and te.invoke("all", .{}).len() >= 1);
    checar("terrain.of", numero(te.invoke("of", .{colinas}), "resolution") == 65);
    checar("heightAt", te.invoke("heightAt", .{ V.init(0, 0, -70), colinas }).isNumber());
    checar("contains", te.invoke("contains", .{ V.init(0, 0, -70), colinas }).boolean() and !te.invoke("contains", .{ V.init(500, 0, 0), colinas }).boolean());
    descartar(te.invoke("sculpt", .{ colinas, "raise", V.init(5, 0, -70), .{ .radius = 6, .strength = 1 }, 1 }));
    descartar(te.invoke("markDirty", .{colinas}));
    const grama = te.get("grass");
    defer grama.deinit();
    descartar(grama.invoke("set", .{ colinas, .{ .enabled = true, .density = 0.5 } }));
    checar("grass.set", verdadeiro(grama.invoke("settingsOf", .{colinas}).get("enabled")));
    const agua = te.get("water");
    defer agua.deinit();
    descartar(agua.invoke("set", .{ colinas, .{ .enabled = true, .level = -2 } }));
    checar("water.set", verdadeiro(agua.invoke("settingsOf", .{colinas}).get("enabled")));
    checar("terrain.raycast", !te.invoke("raycast", .{ V.init(0, 50, -70), V.init(0, -1, 0), colinas }).isNone());
    return Value.none;
}

                                                                                          

fn soltarCaixa() void {
    const caixa = helix.call("scene.spawnPrimitive", .{ "box", .{
        .name = "CaixaSolta",
        .position = V.init(helix.call("math.random.range", .{ -3, 3 }).number(), 6, helix.call("math.random.range", .{ 0, 4 }).number()),
        .rigidBody = .{ .@"type" = "dynamic", .collider = "box", .mass = 1 },
        .tags = .{"caixa"},
    } });
    defer caixa.deinit();
    exec("material.setColor", .{ caixa, helix.call("math.random.color", .{}) });
    pontos += 1;
    exec("gui.bind", .{ "pontos", pontos });
    const nome = caixa.get("name");
    defer nome.deinit();
    exec("events.emit", .{ "debug.caixa", .{ .nome = nome } });
}

fn acaoCaixa(args: []const Value) Value {
    _ = args;
    soltarCaixa();
    return Value.none;
}

fn acaoReiniciar(args: []const Value) Value {
    _ = args;
    exec("play.restart", .{});
    return Value.none;
}

fn telaMostrada(args: []const Value) Value {
    const g = api("gui");
    defer g.deinit();
    tela = arg(args, 0).clone();
    checar("gui.show/isShown", !tela.isNone() and g.invoke("isShown", .{tela}).boolean());
    checar("gui.kinds", contem(g.invoke("kinds", .{}), "button"));
    return Value.none;
}

fn escala(scale: f64, offset: f64) Value {
    return Value.from(.{ .scale = scale, .offset = offset });
}

fn interfaceGrafica() Value {
    const g = api("gui");
    defer g.deinit();
    descartar(g.invoke("css", .{"DebugEstilo"}));
    const hud = g.invoke("html", .{ "DebugHud", .{ .id = "debug-hud" } });
    defer hud.deinit();
    checar("gui.html", !hud.isNone() and !g.invoke("element", .{"#debug-hud"}).isNone());
    const icone = g.invoke("svg", .{ "DebugIcone", .{ .id = "debug-icone" } });
    defer icone.deinit();
    checar("gui.svg", !icone.isNone());
    const slot = g.invoke("element", .{"[data-slot=icone]"});
    defer slot.deinit();
    if (!slot.isNone() and !icone.isNone()) descartar(slot.invoke("appendChild", .{icone}));
    checar("gui.bind", g.invoke("bind", .{ "linguagem", LINGUAGEM }).number() >= 1);
    descartar(g.invoke("bind", .{ "titulo", "Helix · Debug" }));
    assinar(g.invoke("onAction", .{ "caixa", &acaoCaixa }));
    assinar(g.invoke("onAction", .{ "reiniciar", &acaoReiniciar }));
    checar("gui.elements", g.invoke("elements", .{"[data-bind]"}).len() >= 5);
    checar("gui.size", numero(g.get("size"), "width") > 0);
    const declarativa = g.invoke("create", .{ "DebugTela", .{ .referenceSize = .{ .x = 1280, .y = 720 } } });
    defer declarativa.deinit();
    const painel = g.invoke("add", .{ declarativa, "frame", .{
        .name = "Painel",
        .rect = .{
            .position = .{ .x = escala(1, -236), .y = escala(0, 16) },
            .size = .{ .x = escala(0, 220), .y = escala(0, 48) },
        },
    } });
    defer painel.deinit();
    const painel_id = painel.path("node.id");
    defer painel_id.deinit();
    descartar(g.invoke("add", .{ declarativa, "text", .{ .name = "Rotulo", .text = "Tela declarativa OK" }, painel_id }));
    checar("gui.add/find", textoIgual(g.invoke("find", .{ declarativa, "Rotulo" }).get("kind"), "text"));
    descartar(g.invoke("setText", .{ declarativa, "Rotulo", "Tela declarativa OK · " ++ LINGUAGEM }));
                                                                                       
    const mostrar = g.invoke("show", .{ declarativa, "debug-tela" });
    defer mostrar.deinit();
    return mostrar.invoke("then", .{&telaMostrada});
}

fn audio() Value {
    const a = api("audio");
    defer a.deinit();
    checar("audio.supported", a.get("supported").isBool());
    const mixer = a.get("mixer");
    defer mixer.deinit();
    descartar(mixer.invoke("setVolumeDb", .{ "sfx", -3 }));
    checar("mixer.setVolumeDb", numero(mixer.invoke("bus", .{"sfx"}), "volumeDb") == -3);
    checar("audio.clips", a.invoke("clips", .{}).isArray());
    const fonte = helix.call("scene.spawn", .{ "sound", .{ .name = "FonteSonora", .position = V.init(3, 1, 3), .audioSource = .{ .trigger = "manual", .spatial = true } } });
    defer fonte.deinit();
    checar("spawn sound", !fonte.get("audioSource").isNone());
    const fontes = a.get("sources");
    defer fontes.deinit();
    descartar(fontes.invoke("set", .{ fonte, .{ .volumeDb = -4 } }));
    checar("sources.set", numero(fonte.get("audioSource"), "volumeDb") == -4);
    checar("sources.isPlaying", falso(fontes.invoke("isPlaying", .{fonte})));
    return Value.none;
}

fn vfxSalvo(args: []const Value) Value {
    const v = api("vfx");
    defer v.deinit();
    const ativo = arg(args, 0);
    checar("vfx.save", !ativo.isNone() and textoIgual(ativo.get("kind"), "vfx"));
    const ator = v.invoke("emitAt", .{ ativo, V.init(0, 1.5, -8), .{ .destroyWhenFinished = false } });
    defer ator.deinit();
    checar("vfx.emitAt", verdadeiro(v.invoke("has", .{ator})));
    descartar(v.invoke("burst", .{ ator, 20 }));
    checar("vfx.stats", v.invoke("stats", .{}).get("effects").isNumber());
    return Value.none;
}

fn vfx() Value {
    const v = api("vfx");
    defer v.deinit();
    const ids = helix.call("vfx.templates.ids", .{});
    defer ids.deinit();
    checar("vfx.templates", ids.len() > 0);
    checar("vfx.moduleKinds", v.invoke("moduleKinds", .{}).len() > 0);
    const primeiro = ids.at(0);
    defer primeiro.deinit();
    const base = v.invoke("fromTemplate", .{ primeiro, "DebugFaiscas" });
    defer base.deinit();
    const com_emissor = v.invoke("addEmitter", .{ base, .{ .name = "Extra", .maxParticles = 50 } });
    defer com_emissor.deinit();
    const doc = v.invoke("set", .{ com_emissor, .{ .loop = true } });
    defer doc.deinit();
    checar("vfx.fromTemplate/addEmitter", doc.get("emitters").len() >= 2 and verdadeiro(doc.get("loop")));
    const salvar = v.invoke("save", .{ doc, "DebugFaiscas" });
    defer salvar.deinit();
    return salvar.invoke("then", .{&vfxSalvo});
}

                                                                                         

const Tecla = enum { KeyR, KeyB, KeyE, KeyF, KeyG, KeyT, KeyH, KeyL };

fn aoTeclar(e: Value) void {
    const repetida = e.get("repeat");
    defer repetida.deinit();
    if (repetida.boolean()) return;
    const code = e.get("code");
    defer code.deinit();
    var code_buf: [32]u8 = undefined;
    const tecla = std.meta.stringToEnum(Tecla, code.stringBuf(&code_buf)) orelse return;
    switch (tecla) {
        .KeyR => exec("play.restart", .{}),
        .KeyB => soltarCaixa(),
        .KeyE => {
            const quadro = api("time.frame");
            defer quadro.deinit();
            exec("events.emit", .{ "debug.ping", .{ .origem = "teclado", .quadro = quadro } });
        },
        .KeyF => exec("camera.shake", .{ 0.4, 0.6 }),
        .KeyG => {
            if (efeito.isUndefined()) return;
            const ligado = !efeito.get("enabled").boolean();
            efeito.set("enabled", ligado);
            info("Efeito DebugPost {s}", .{if (ligado) "ligado" else "desligado"});
        },
        .KeyT => {
            const tm = api("time");
            defer tm.deinit();
            tm.set("scale", if (numero(tm, "scale") == 1) @as(f64, 0.3) else @as(f64, 1));
            info("time.scale = {d}", .{numero(tm, "scale")});
        },
        .KeyH => {
            if (tela.isUndefined()) return;
            const g = api("gui");
            defer g.deinit();
            if (g.invoke("isShown", .{tela}).boolean()) descartar(g.invoke("hide", .{tela})) else descartar(g.invoke("show", .{ tela, "debug-tela" }));
        },
        .KeyL => {
            const luzes_locais = helix.call("light.all", .{.{ .local = true }});
            defer luzes_locais.deinit();
            var lista: [512]u8 = undefined;
            var usado: usize = 0;
            var it = luzes_locais.iterator();
            while (it.next()) |luz| {
                defer luz.deinit();
                const entidade = luz.get("entity");
                defer entidade.deinit();
                var nome_buf: [64]u8 = undefined;
                const nome = nomeDe(entidade, &nome_buf);
                if (usado + nome.len + 2 >= lista.len) break;
                if (usado > 0) {
                    @memcpy(lista[usado .. usado + 2], ", ");
                    usado += 2;
                }
                @memcpy(lista[usado .. usado + nome.len], nome);
                usado += nome.len;
            }
            info("Luzes locais: {s}", .{lista[0..usado]});
        },
    }
}

fn aoTeclarCb(args: []const Value) Value {
    aoTeclar(arg(args, 0));
    return Value.none;
}

fn cliqueNaCena(x: f64, y: f64) void {
    const alvo = helix.call("camera.pick", .{ x, y });
    defer alvo.deinit();
    const ponto = helix.call("camera.pickPoint", .{ x, y });
    defer ponto.deinit();
    if (!alvo.isNone()) {
        var nome_buf: [64]u8 = undefined;
        info("Clique em {s}", .{nomeDe(alvo, &nome_buf)});
    }
    if (!ponto.isNone()) exec("debug.sphere", .{ ponto, 0.3, "#ff006e", 2 });
}

fn aoApontar(args: []const Value) Value {
    const e = arg(args, 0);
    if (numero(e, "button") == 0) cliqueNaCena(numero(e, "x"), numero(e, "y"));
    return Value.none;
}

fn aoGamepad(args: []const Value) Value {
    const e = arg(args, 0);
    info("Gamepad {d} botão {d}", .{ numero(e, "pad"), numero(e, "button") });
    return Value.none;
}

fn entrada() Value {
    const in = api("input");
    defer in.deinit();
    const acoes = in.get("actions");
    defer acoes.deinit();
    descartar(acoes.invoke("define", .{ "pular", .{ "Space", "Gamepad:0" } }));
    descartar(acoes.invoke("define", .{ "soltar", .{"KeyB"} }));
    checar("actions.define/bindings", acoes.invoke("bindings", .{"pular"}).len() >= 1);
    checar("action()", textoIgual(in.invoke("action", .{"pular"}).get("name"), "pular") and acoes.invoke("down", .{"pular"}).isBool());
    checar("isDown", falso(in.invoke("isDown", .{"KeyW"})));
    checar("pointer", in.path("pointer.x").isNumber());
    checar("gamepads", in.invoke("gamepads", .{}).isArray());
    checar("axis2d", in.invoke("axis2d", .{.{ .up = "KeyW", .down = "KeyS", .left = "KeyA", .right = "KeyD" }}).get("x").isNumber());
    const teclas = in.invoke("keysDown", .{});
    defer teclas.deinit();
    checar("keysDown", teclas.isObject() or teclas.isArray());
    assinar(in.invoke("onKeyDown", .{&aoTeclarCb}));
    assinar(in.invoke("onPointerDown", .{&aoApontar}));
    assinar(in.invoke("onGamepadButtonDown", .{&aoGamepad}));
    return Value.none;
}

                                                                          
var recebido: Value = Value.none;
var uma_vez: u32 = 0;
var do_ator: u32 = 0;

fn guardarPing(args: []const Value) Value {
    recebido.deinit();
    recebido = arg(args, 0).clone();
    return Value.none;
}

fn contarUmaVez(args: []const Value) Value {
    _ = args;
    uma_vez += 1;
    return Value.none;
}

fn contarToque(args: []const Value) Value {
    _ = args;
    do_ator += 1;
    return Value.none;
}

fn logarPing(args: []const Value) Value {
    const origem = arg(args, 0).get("origem");
    defer origem.deinit();
    info("ping de {f}", .{origem});
    return Value.none;
}

fn logarCaixa(args: []const Value) Value {
    const nome = arg(args, 0).get("nome");
    defer nome.deinit();
    depurar("caixa {f}", .{nome});
    return Value.none;
}

fn logarParou(args: []const Value) Value {
    _ = args;
    info("play.onStopped disparou", .{});
    return Value.none;
}

fn logarPausado(args: []const Value) Value {
    _ = args;
    info("pausado", .{});
    return Value.none;
}

fn logarRetomado(args: []const Value) Value {
    _ = args;
    info("retomado", .{});
    return Value.none;
}

fn eventos() Value {
    const ev = api("events");
    defer ev.deinit();
    const play = api("play");
    defer play.deinit();
    const desligar = ev.invoke("on", .{ "debug.ping", &guardarPing });
    defer desligar.deinit();
    checar("events.emit conta ouvintes", ev.invoke("emit", .{ "debug.ping", .{ .origem = "teste" } }).number() == 1);
    checar("events.on recebe", !recebido.isUndefined() and textoIgual(recebido.get("origem"), "teste"));
    recebido.deinit();
    recebido = Value.none;
    checar("listenerCount", ev.invoke("listenerCount", .{"debug.ping"}).number() == 1);
    descartar(desligar.call(.{}));
    checar("unsubscribe", ev.invoke("listenerCount", .{"debug.ping"}).number() == 0);
    uma_vez = 0;
    descartar(ev.invoke("once", .{ "debug.once", &contarUmaVez }));
    descartar(ev.invoke("emit", .{"debug.once"}));
    descartar(ev.invoke("emit", .{"debug.once"}));
    checar("events.once", uma_vez == 1);
    assinar(ev.invoke("on", .{ "debug.ping", &logarPing }));
    assinar(ev.invoke("on", .{ "debug.caixa", &logarCaixa }));
    do_ator = 0;
    assinar(ev.invoke("onEntity", .{ torus, "toque", &contarToque }));
    descartar(ev.invoke("emitEntity", .{ torus, "toque" }));
    checar("onEntity/emitEntity", do_ator == 1);
    assinar(play.invoke("onStopped", .{&logarParou}));
    assinar(play.invoke("onPaused", .{&logarPausado}));
    assinar(play.invoke("onResumed", .{&logarRetomado}));
    return Value.none;
}

                                                                                 
var tempo_inicio: f64 = 0;
var tempo_quadro: f64 = 0;
var atraso_disparou = false;

fn aCada2s(args: []const Value) Value {
    _ = args;
    exec("gui.bind", .{ "atores", helix.call("scene.count", .{}) });
    return Value.none;
}

fn marcarAtraso(args: []const Value) Value {
    _ = args;
    atraso_disparou = true;
    return Value.none;
}

fn tempoPasso3(args: []const Value) Value {
    _ = args;
    checar("time.delay", atraso_disparou);
    return Value.none;
}

fn tempoPasso2(args: []const Value) Value {
    _ = args;
    const tm = api("time");
    defer tm.deinit();
    const quadro = numero(tm, "frame");
    checarf("time.waitFrames", quadro >= tempo_quadro + 2, "{d}", .{quadro - tempo_quadro});
    assinar(tm.invoke("every", .{ 2, &aCada2s }));
    atraso_disparou = false;
    descartar(tm.invoke("delay", .{ 0.2, &marcarAtraso }));
    const espera = tm.invoke("wait", .{0.3});
    defer espera.deinit();
    return espera.invoke("then", .{&tempoPasso3});
}

fn tempoPasso1(args: []const Value) Value {
    _ = args;
    const tm = api("time");
    defer tm.deinit();
    const decorrido = numero(tm, "now") - tempo_inicio;
    checarf("time.wait", decorrido >= 0.09, "{d:.3}", .{decorrido});
    tempo_quadro = numero(tm, "frame");
    const espera = tm.invoke("waitFrames", .{2});
    defer espera.deinit();
    return espera.invoke("then", .{&tempoPasso2});
}

fn tempo() Value {
    const tm = api("time");
    defer tm.deinit();
    checar("time.now", numero(tm, "now") >= 0 and numero(tm, "frame") >= 0);
    checar("time.delta", numero(tm, "delta") >= 0 and numero(tm, "fixedDelta") > 0);
    tempo_inicio = numero(tm, "now");
    const espera = tm.invoke("wait", .{0.1});
    defer espera.deinit();
    return espera.invoke("then", .{&tempoPasso1});
}

var execucoes: i64 = 0;

fn dadosPasso4(args: []const Value) Value {
    const texto = arg(args, 0);
    var texto_buf: [1024]u8 = undefined;
    checar("assets.text", std.mem.indexOf(u8, texto.stringBuf(&texto_buf), "velocidade") != null);
    const ativos = api("assets");
    defer ativos.deinit();
    checar("assets.byName", !ativos.invoke("byName", .{ "DebugJogo", "script" }).isNone());
    checar("assets.exists", ativos.invoke("exists", .{"DebugUtil"}).boolean() and !ativos.invoke("exists", .{"NaoExiste"}).boolean());
    checar("assets.search", ativos.invoke("search", .{"Debug"}).len() >= 5);
    checar("project.name", api("project.name").isString());
    checar("project.stats", numero(api("project.stats"), "entities") > 0);
    checar("net.localPlayer", verdadeiro(api("net.localPlayer.local")));
    checar("play.state", textoIgual(api("play.state"), "playing") and verdadeiro(api("play.isRunning")));
    return Value.none;
}

fn dadosPasso3(args: []const Value) Value {
    const cfg = arg(args, 0);
    const jogador = cfg.get("jogador");
    defer jogador.deinit();
    checar("assets.data (TOML)", !cfg.isNone() and !jogador.isNone() and numero(jogador, "velocidade") == 6.5);
    const texto = helix.call("assets.text", .{"DebugConfig"});
    defer texto.deinit();
    return texto.invoke("then", .{&dadosPasso4});
}

fn dadosPasso2(args: []const Value) Value {
    _ = args;
    const st = api("storage");
    defer st.deinit();
    const lido = st.invoke("get", .{"execucoes"});
    defer lido.deinit();
    checarf("storage.get/set", lido.integer() == execucoes and st.invoke("has", .{"execucoes"}).boolean(), "{d}", .{execucoes});
    info("Execução nº {d} deste jogo de teste neste projeto.", .{execucoes});
    const dados_cfg = helix.call("assets.data", .{"DebugConfig"});
    defer dados_cfg.deinit();
    return dados_cfg.invoke("then", .{&dadosPasso3});
}

fn dadosPasso1(args: []const Value) Value {
    _ = args;
    const st = api("storage");
    defer st.deinit();
    const atual = st.invoke("get", .{ "execucoes", 0 });
    defer atual.deinit();
    execucoes = (if (atual.isNumber()) atual.integer() else 0) + 1;
    const gravar = st.invoke("set", .{ "execucoes", execucoes });
    defer gravar.deinit();
    return gravar.invoke("then", .{&dadosPasso2});
}

fn dados() Value {
    const pronto = helix.call("storage.ready", .{});
    defer pronto.deinit();
    return pronto.invoke("then", .{&dadosPasso1});
}

                                                                                                            
fn lancar() Value {
    helix.throw("erro proposital: throw interrompe a área e vira ERRO na cadeia", .{});
}

                                                                                          

const Area = struct {
    nome: []const u8,
    rodar: *const fn () Value,
                                                                                               
    espera_erro: bool = false,
};

const AREAS = [_]Area{
    .{ .nome = "Núcleo", .rodar = &nucleo },
    .{ .nome = "Módulo (require)", .rodar = &modulo },
    .{ .nome = "Matemática", .rodar = &matematica },
    .{ .nome = "Cena", .rodar = &cena },
    .{ .nome = "Transformações", .rodar = &transformacao },
    .{ .nome = "Malhas e CSG", .rodar = &malhas },
    .{ .nome = "Materiais", .rodar = &materiais },
    .{ .nome = "Luzes", .rodar = &luzes },
    .{ .nome = "Céu e mundo", .rodar = &ceu },
    .{ .nome = "Câmera", .rodar = &camera },
    .{ .nome = "Pós-processamento", .rodar = &pos },
    .{ .nome = "Render", .rodar = &render },
    .{ .nome = "Física", .rodar = &fisica },
    .{ .nome = "Personagem e jogador", .rodar = &personagem },
    .{ .nome = "Terreno", .rodar = &terreno },
    .{ .nome = "Interface", .rodar = &interfaceGrafica },
    .{ .nome = "Áudio", .rodar = &audio },
    .{ .nome = "VFX", .rodar = &vfx },
    .{ .nome = "Entrada", .rodar = &entrada },
    .{ .nome = "Eventos", .rodar = &eventos },
    .{ .nome = "Tempo e tarefas", .rodar = &tempo },
    .{ .nome = "Dados, projeto e rede", .rodar = &dados },
    .{ .nome = "Erro proposital (throw)", .rodar = &lancar, .espera_erro = true },
};

fn areaRodar(area: *const Area, args: []const Value) Value {
    _ = args;
    return area.rodar();
}

fn areaOk(area: *const Area, args: []const Value) Value {
    _ = args;
    if (area.espera_erro) {
        checar("throw deveria ter rejeitado a área", false);
        return Value.none;
    }
    depurar("ok {s}", .{area.nome});
    return Value.none;
}

fn areaErro(area: *const Area, args: []const Value) Value {
    const causa = arg(args, 0);
    var buffer: [512]u8 = undefined;
    const mensagem = if (causa.isObject()) blk: {
        const campo = causa.get("message");
        defer campo.deinit();
        break :blk campo.stringBuf(&buffer);
    } else causa.stringBuf(&buffer);
    if (area.espera_erro) {
        checarf("throw chega como rejeição da promessa", std.mem.indexOf(u8, mensagem, "proposital") != null, "{s}", .{mensagem});
        return Value.none;
    }
    falhas += 1;
    erro("ERRO em {s}: {s}", .{ area.nome, mensagem });
    return Value.none;
}

                                                                                                
fn encadear(promessa: Value, area: *const Area) Value {
    defer promessa.deinit();
    const depois = promessa.invoke("then", .{Value.closure(area, areaRodar)});
    defer depois.deinit();
    return depois.invoke("then", .{ Value.closure(area, areaOk), Value.closure(area, areaErro) });
}

fn finalizar(args: []const Value) Value {
    _ = args;
    const girador = helix.call("assets.byName", .{ "DebugGirador", "script" });
    defer girador.deinit();
    if (!girador.isNone()) {
        const id = girador.get("id");
        defer id.deinit();
        const extra = helix.call("scene.spawnPrimitive", .{ "box", .{
            .name = "GiradorDinamico",
            .position = V.init(-2, 0.5, -3),
            .rigidBody = .{ .@"type" = "kinematic", .collider = "box" },
            .script = .{ .assetId = id, .props = .{ .velocidade = 180, .cor = "#00b4d8" } },
        } });
        defer extra.deinit();
        checar("spawn com script", !extra.get("script").isNone() and extra.path("script.assetId").equals(id));
    } else {
        checarf("ativo DebugGirador", false, "{s}", .{"não está na biblioteca"});
    }
    const dica = "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia.";
    if (falhas == 0) {
        info("API percorrida em {s}: {d} checagens, nenhuma falha. {s}", .{ LINGUAGEM, checagens, dica });
    } else {
        aviso("API percorrida em {s}: {d} checagens, {d} falhas (veja FALHOU/ERRO acima). {s}", .{ LINGUAGEM, checagens, falhas, dica });
    }
    exec("gui.bind", .{ "checagens", checagens });
    exec("gui.bind", .{ "falhas", falhas });
    return Value.none;
}

                                                                                         

pub fn onLoad() void {
    info("onLoad do script de entrada", .{});
}

pub fn onStart() void {
    info("Jogo de teste em {s}: percorrendo a API…", .{LINGUAGEM});
    var promessa = helix.call("time.wait", .{0});
    for (&AREAS) |*area| promessa = encadear(promessa, area);
    defer promessa.deinit();
    descartar(promessa.invoke("then", .{&finalizar}));
}

pub fn onUpdate(dt: f64) void {
    quadros += 1;
    if (!torus.isUndefined()) exec("transform.rotate", .{ torus, V.init(0, 40 * dt, 0) });
    exec("debug.line", .{ V.init(-6, 0.05, -6), V.init(6, 0.05, -6), "#ff006e" });
    exec("debug.box", .{ .{ .center = V.init(0, 1, 3), .size = V.init(3, 2, 3) }, "#ffbe0b" });
    if (!heroi.isUndefined()) {
        exec("debug.axes", .{ heroi, 1 });
        const posicao = helix.call("transform.worldPosition", .{heroi});
        defer posicao.deinit();
        const acima = helix.call("math.vec3.add", .{ posicao, V.init(0, 2.2, 0) });
        defer acima.deinit();
        var rotulo_buf: [48]u8 = undefined;
        const rotulo = std.fmt.bufPrint(&rotulo_buf, "Heroi · {d} pts", .{pontos}) catch "Heroi";
        exec("debug.text", .{ acima, rotulo, "#ffffff" });
    }
    exec("debug.ray", .{ V.init(0, 3, 0), V.init(0, -1, 0), 3, "#06d6a0" });
    hud_timer += dt;
    if (hud_timer >= 0.5) {
        hud_timer = 0;
        const stats = api("render.stats");
        defer stats.deinit();
        exec("gui.bind", .{ "fps", @round(numero(stats, "fps")) });
        exec("gui.bind", .{ "checagens", checagens });
        exec("gui.bind", .{ "falhas", falhas });
    }
}

pub fn onFixedUpdate(h: f64) void {
    passos_fisica += 1;
    if (passos_fisica == 1) checarf("onFixedUpdate recebe o passo", h > 0 and h < 1, "{d}", .{h});
}

pub fn onLateUpdate() void {
    late_updates += 1;
}

                                                                           
pub fn onBeforeHotReload() f64 {
    return @floatFromInt(pontos);
}

pub fn onHotReload(anterior: f64) void {
    pontos = if (anterior > 0) @as(u32, @intFromFloat(anterior)) else 0;
    info("Recarga a quente: {d} pontos preservados", .{pontos});
}

pub fn onStop() void {
    for (assinaturas[0..n_assinaturas]) |desligar| {
        descartar(desligar.call(.{}));
        desligar.deinit();
    }
    n_assinaturas = 0;
`;
}
