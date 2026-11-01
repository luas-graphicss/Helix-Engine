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

`;
}
