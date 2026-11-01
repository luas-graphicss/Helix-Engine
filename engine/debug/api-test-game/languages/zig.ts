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
`;
}
