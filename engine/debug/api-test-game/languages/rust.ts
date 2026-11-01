import type { GameSources } from '../types';
export function rustGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
use helix::prelude::*;
use std::cell::{Cell, RefCell};
use std::rc::Rc;

const LINGUAGEM: &str = "Rust";

#[derive(Default)]
struct Estado {
    quadros: Cell<u32>,
    passos_fisica: Cell<u32>,
    late_updates: Cell<u32>,
    renders: Cell<u32>,
    colisoes: Cell<u32>,
    checagens: Cell<u32>,
    falhas: Cell<u32>,
    pontos: Cell<u32>,
    hud_timer: Cell<f64>,
                                                                         
    torus: RefCell<Value>,
    heroi: RefCell<Value>,
    efeito: RefCell<Value>,
    tela: RefCell<Value>,
    assinaturas: RefCell<Vec<Value>>,
}

thread_local! {
    static ESTADO: Estado = Estado::default();
}

                                                                                         

fn api(caminho: &str) -> Value {
    root().path(caminho)
}

fn v3(x: f64, y: f64, z: f64) -> Vec3 {
    Vec3::new(x, y, z)
}

                                                                  
macro_rules! obj {
    ($($chave:literal => $valor:expr),* $(,)?) => {{
        let objeto = Value::object();
        $( objeto.set($chave, $valor); )*
        objeto
    }};
}

fn contar(campo: fn(&Estado) -> &Cell<u32>) {
    ESTADO.with(|estado| {
        let celula = campo(estado);
        celula.set(celula.get() + 1);
    });
}

fn lido(campo: fn(&Estado) -> &Cell<u32>) -> u32 {
    ESTADO.with(|estado| campo(estado).get())
}

fn guardar(slot: fn(&Estado) -> &RefCell<Value>, valor: Value) {
    ESTADO.with(|estado| *slot(estado).borrow_mut() = valor);
}

fn lembrado(slot: fn(&Estado) -> &RefCell<Value>) -> Value {
    ESTADO.with(|estado| slot(estado).borrow().clone())
}

fn arg(args: &[Value], indice: usize) -> Value {
    args.get(indice).cloned().unwrap_or_default()
}

fn registrar(metodo: &str, mensagem: &str) {
    api("log").invoke(metodo, ("Debug", mensagem));
}

macro_rules! info { ($($arg:tt)*) => { registrar("info", &format!($($arg)*)) }; }
macro_rules! aviso { ($($arg:tt)*) => { registrar("warn", &format!($($arg)*)) }; }
macro_rules! erro { ($($arg:tt)*) => { registrar("error", &format!($($arg)*)) }; }
macro_rules! depurar { ($($arg:tt)*) => { registrar("debug", &format!($($arg)*)) }; }

fn checar(nome: &str, condicao: bool) {
    contar(|estado| &estado.checagens);
    if condicao {
        return;
    }
    contar(|estado| &estado.falhas);
    erro!("FALHOU {nome}");
}

fn checarf(nome: &str, condicao: bool, detalhe: &str) {
    contar(|estado| &estado.checagens);
    if condicao {
        return;
    }
    contar(|estado| &estado.falhas);
    erro!("FALHOU {nome}: {detalhe}");
}

fn assinar(desligar: Value) {
    if !desligar.is_function() {
        return;
    }
    ESTADO.with(|estado| estado.assinaturas.borrow_mut().push(desligar));
}

fn verdadeiro(valor: &Value) -> bool {
    valor.is_bool() && valor.boolean()
}

fn falso(valor: &Value) -> bool {
    valor.is_bool() && !valor.boolean()
}

fn aprox(a: f64, b: f64, epsilon: f64) -> bool {
    (a - b).abs() <= epsilon
}

fn numero(objeto: &Value, chave: &str) -> f64 {
    objeto.get(chave).number()
}

fn texto_igual(valor: &Value, esperado: &str) -> bool {
    valor.is_string() && valor.to_string() == esperado
}

                                                                                          
fn eq3(vetor: &Value, x: f64, y: f64, z: f64, epsilon: f64) -> bool {
    api("math.vec3").invoke("equals", (vetor, v3(x, y, z), epsilon)).boolean()
}

fn comprimento(vetor: &Value) -> f64 {
    api("math.vec3").invoke("length", (vetor,)).number()
}

fn contem(lista: &Value, texto: &str) -> bool {
    lista.iter().any(|item| item.to_string() == texto)
}

fn nome_de(entidade: &Value) -> String {
    if entidade.is_none() { "ninguém".to_string() } else { entidade.get("name").to_string() }
}

                                                                                          

fn nucleo() -> Value {
    let raiz = root();
    let engine = api("engine");
    let nome = engine.get("name");
    let versao = engine.get("version");
    let contexto = raiz.get("context").to_string();
    checar("engine.name", nome.is_string() && !nome.to_string().is_empty());
    checar("engine.version", versao.is_string());
    checarf("context", ["shared", "client", "server"].contains(&contexto.as_str()), &contexto);
    checar("isPlaying", verdadeiro(&raiz.get("isPlaying")));
    checar("isEditor", falso(&raiz.get("isEditor")));
    checar("self no script de entrada", actor().is_none() && raiz.get("self").is_none());
    checar("script() é o handle do script", script().is_object());
    checar("now", now() >= 0.0);
    info!("{} {} · API {} · {}", nome, versao, engine.get("apiVersion"), LINGUAGEM);
    helix::print("print direto do Rust (log sem canal)");
    Value::undefined()
}

fn modulo() -> Value {
    let util = require("DebugUtil");
    checar("require devolve as funções", util.is_object() && util.get("soma").is_function());
    let resultado = util.invoke("soma", (2, 3)).number();
    checarf("require soma", resultado == 5.0, &format!("{resultado}"));
    checar("require saudacao", texto_igual(&util.invoke("saudacao", ("Helix",)), "Olá, Helix"));
    checar("require limitar", util.invoke("limitar", (15, 0, 10)).number() == 10.0);
    Value::undefined()
}

fn matematica() -> Value {
    let m = api("math");
    let vec = m.get("vec3");
    let quat = m.get("quat");
    let mat4 = m.get("mat4");
    let escalar = m.get("scalar");
    checar("vec3.add", eq3(&vec.invoke("add", (v3(1.0, 2.0, 3.0), v3(1.0, 1.0, 1.0))), 2.0, 3.0, 4.0, 1e-6));
    checar("vec3.length", aprox(vec.invoke("length", (v3(3.0, 4.0, 0.0),)).number(), 5.0, 1e-3));
    checar("vec3.normalize", aprox(comprimento(&vec.invoke("normalize", (v3(0.0, 5.0, 0.0),))), 1.0, 1e-3));
    checar("vec3.cross", eq3(&vec.invoke("cross", (v3(1.0, 0.0, 0.0), v3(0.0, 1.0, 0.0))), 0.0, 0.0, 1.0, 1e-6));
    checar("vec3.lerp", eq3(&vec.invoke("lerp", (v3(0.0, 0.0, 0.0), v3(2.0, 2.0, 2.0), 0.5)), 1.0, 1.0, 1.0, 1e-6));
    let q = quat.invoke("fromEuler", (v3(0.0, 90.0, 0.0),));
    checar("quat.rotateVec3", eq3(&quat.invoke("rotateVec3", (&q, v3(1.0, 0.0, 0.0))), 0.0, 0.0, -1.0, 1e-3));
    checar("quat.toEuler", aprox(numero(&quat.invoke("toEuler", (&q,)), "y"), 90.0, 0.01));
    let mat = mat4.invoke("fromTRS", (v3(1.0, 2.0, 3.0), v3(0.0, 0.0, 0.0), v3(1.0, 1.0, 1.0)));
    checar("mat4.transformPoint", eq3(&mat4.invoke("transformPoint", (&mat, v3(0.0, 0.0, 0.0))), 1.0, 2.0, 3.0, 1e-6));
    checar("mat4.invert", !mat4.invoke("invert", (&mat,)).is_none());
    let aabb = m.get("aabb");
    let caixa = aabb.invoke("fromCenterSize", (v3(0.0, 0.0, 0.0), v3(2.0, 2.0, 2.0)));
    checar("aabb.contains", aabb.invoke("contains", (&caixa, v3(0.5, 0.5, 0.5))).boolean() && !aabb.invoke("contains", (&caixa, v3(2.0, 0.0, 0.0))).boolean());
    let ray = m.get("ray");
    let raio = ray.invoke("create", (v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0)));
    checar("ray.intersectAabb", !ray.invoke("intersectAabb", (&raio, &caixa)).is_none());
    checar("scalar.remap", escalar.invoke("remap", (5, 0, 10, 0, 100)).number() == 50.0);
    checar("clamp/lerp", m.invoke("clamp", (15, 0, 10)).number() == 10.0 && m.invoke("lerp", (0, 10, 0.5)).number() == 5.0);
    checar("scalar.wrapAngle", aprox(escalar.invoke("wrapAngle", (370,)).number(), 10.0, 1e-3));
    checar("degToRad", aprox(m.invoke("degToRad", (180,)).number(), std::f64::consts::PI, 1e-6));
    let ruido = m.get("noise");
    let perlin = ruido.invoke("perlin2", (0.3, 0.7)).number();
    checarf("noise.perlin2", (-1.01..=1.01).contains(&perlin), &format!("{perlin}"));
    checar("noise.fbm", ruido.invoke("fbm", (1.5, 2.5, 0, 4)).is_number());
    let cor = m.get("color");
    checar("color.hexToVec3", eq3(&cor.invoke("hexToVec3", ("#ff0000",)), 1.0, 0.0, 0.0, 0.01));
    let hex = cor.invoke("vec3ToHex", (v3(1.0, 1.0, 1.0),)).to_string();
    checarf("color.vec3ToHex", hex.eq_ignore_ascii_case("#ffffff"), &hex);
    let random = m.get("random");
    random.invoke("seed", (42,));
    let primeiro = random.invoke("value", ()).number();
    random.invoke("seed", (42,));
    checar("random.seed determinístico", random.invoke("value", ()).number() == primeiro);
    let sorteado = random.invoke("int", (1, 6)).number();
    checar("random.int", (1.0..=6.0).contains(&sorteado) && sorteado.floor() == sorteado);
    checar("random.unitVector", aprox(comprimento(&random.invoke("unitVector", ())), 1.0, 1e-3));
    checar("PI/TAU", aprox(numero(&m, "TAU"), numero(&m, "PI") * 2.0, 1e-9));
    Value::undefined()
}

                                                                                           

fn cena() -> Value {
    let s = api("scene");
    let mat = api("material");
    let raiz = s.get("root");
    checar("scene.root", !raiz.is_none() && raiz.get("children").is_array());
    let antes = s.invoke("count", ()).number();
    let grupo = s.invoke("spawn", ("group", obj! { "name" => "DebugCenario" }));
    let chao = s.invoke("spawn", ("mesh", obj! {
        "name" => "Chao",
        "mesh" => api("mesh").invoke("plane", (40, 40)),
        "material" => mat.invoke("create", (obj! { "baseColor" => "#4b6b3a", "roughness" => 0.95 },)),
        "rigidBody" => obj! { "type" => "static", "collider" => "box", "boxSize" => v3(40.0, 0.2, 40.0), "center" => v3(0.0, -0.1, 0.0) },
        "receiveShadows" => true,
        "tags" => Value::list(["chao"]),
    }, &grupo));
    checar("spawn mesh", texto_igual(&chao.get("kind"), "mesh") && !chao.get("mesh").is_none() && !chao.get("rigidBody").is_none());
    checar("find", s.invoke("find", ("Chao",)).equals(&chao));
    checar("findAll", s.invoke("findAll", ("Chao",)).len() == 1);
    checar("byId", s.invoke("byId", (chao.get("id"),)).equals(&chao));
    checar("byTag", s.invoke("byTag", ("chao",)).len() >= 1);
    checar("byKind", s.invoke("byKind", ("mesh",)).len() >= 1);
    let depois = s.invoke("count", ()).number();
    checarf("count", depois == antes + 2.0, &format!("{depois} vs {}", antes + 2.0));
    checar("contains", s.invoke("contains", (&grupo, &chao)).boolean() && s.invoke("contains", (&raiz, &chao)).boolean());
    let caminho = s.invoke("path", (&chao,)).to_string();
    checarf("path", caminho.contains("Chao"), &caminho);
    let visitados = Rc::new(Cell::new(0u32));
    let contador = visitados.clone();
    s.invoke("traverse", (Value::function(move |_| contador.set(contador.get() + 1)), &grupo));
    checarf("traverse", visitados.get() >= 2, &format!("{}", visitados.get()));

    let anel = s.invoke("spawnPrimitive", ("torus", obj! { "name" => "Anel", "position" => v3(-4.0, 1.2, -2.0), "scale" => 1.5 }, &grupo));
    mat.invoke("setColor", (&anel, "#3a86ff"));
    mat.invoke("setEmissive", (&anel, "#3a86ff", 0.6));
    checar("spawnPrimitive", !anel.get("mesh").is_none() && !anel.get("material").is_none());
    guardar(|estado| &estado.torus, anel.clone());

    let copia = s.invoke("clone", (&anel, true, &grupo));
    s.invoke("rename", (&copia, "AnelCopia"));
    api("transform").invoke("setPosition", (&copia, v3(-4.0, 1.2, 2.0)));
    checar("clone + rename", texto_igual(&copia.get("name"), "AnelCopia") && s.invoke("find", ("AnelCopia",)).equals(&copia));
    s.invoke("setMeta", (&copia, "origem", "clone"));
    checar("meta", texto_igual(&s.invoke("getMeta", (&copia, "origem")), "clone"));
    s.invoke("addTag", (&copia, "temporario"));
    checar("addTag/hasTag", s.invoke("hasTag", (&copia, "temporario")).boolean());
    checar("removeTag", verdadeiro(&s.invoke("removeTag", (&copia, "temporario"))) && !s.invoke("hasTag", (&copia, "temporario")).boolean());
    s.invoke("setVisible", (&copia, false));
    checar("setVisible", falso(&copia.get("visible")));
    s.invoke("setVisible", (&copia, true));
    s.invoke("destroy", (&copia,));
    checar("destroy", s.invoke("find", ("AnelCopia",)).is_none() && !s.invoke("isAttached", (&copia,)).boolean());

    let esfera = s.invoke("spawnPrimitive", ("sphere", obj! { "name" => "Esfera", "position" => v3(4.0, 0.5, -3.0) }));
    s.invoke("reparent", (&esfera, &grupo));
    checar("reparent", esfera.get("parent").equals(&grupo));
    mat.invoke("setColor", (&esfera, "#ffbe0b"));
    s.invoke("addComponent", (&esfera, "rigidBody", obj! { "type" => "dynamic", "collider" => "sphere", "radius" => 0.5, "mass" => 1 }));
    checar("addComponent", !esfera.get("rigidBody").is_none() && texto_igual(&esfera.path("rigidBody.type"), "dynamic"));
    let temporario = s.invoke("spawnPrimitive", ("box", obj! { "name" => "Temporario" }));
    s.invoke("addComponent", (&temporario, "csg", Value::object()));
    checar("addComponent csg", !temporario.get("csg").is_none());
    s.invoke("removeComponent", (&temporario, "csg"));
    checar("removeComponent", temporario.get("csg").is_none());
    s.invoke("destroy", (&temporario,));
    checar("kinds/components", contem(&s.invoke("kinds", ()), "mesh") && contem(&s.invoke("components", ()), "rigidBody"));
    Value::undefined()
}

fn transformacao() -> Value {
    let tr = api("transform");
    let s = api("scene");
    let alvo = s.invoke("spawnPrimitive", ("cone", obj! { "name" => "Cone", "position" => v3(0.0, 0.5, -6.0) }));
    api("material").invoke("setColor", (&alvo, "#8338ec"));
    tr.invoke("setPosition", (&alvo, v3(2.0, 0.5, -6.0)));
    checar("setPosition", eq3(&tr.invoke("position", (&alvo,)), 2.0, 0.5, -6.0, 1e-6));
    tr.invoke("translate", (&alvo, v3(0.0, 1.0, 0.0), "world"));
    checar("translate", aprox(numero(&tr.invoke("position", (&alvo,)), "y"), 1.5, 1e-3));
    tr.invoke("setRotation", (&alvo, v3(0.0, 90.0, 0.0)));
    checar("setRotation", aprox(numero(&tr.invoke("rotation", (&alvo,)), "y"), 90.0, 0.01));
    tr.invoke("rotate", (&alvo, v3(0.0, 45.0, 0.0)));
    let girado = api("math.scalar").invoke("wrapAngle", (tr.invoke("rotation", (&alvo,)).get("y"),)).number();
    checarf("rotate", aprox(girado, 135.0, 0.01) || aprox(girado, -225.0, 0.01), &format!("{girado}"));
    tr.invoke("setScale", (&alvo, 2));
    checar("setScale", aprox(numero(&tr.invoke("scale", (&alvo,)), "x"), 2.0, 1e-6));
    tr.invoke("setScale", (&alvo, v3(1.0, 1.0, 1.0)));
    let mundo = tr.invoke("worldPosition", (&alvo,)).vec3();
    checar("worldPosition", eq3(&tr.invoke("position", (&alvo,)), mundo.x, mundo.y, mundo.z, 1e-3));
    checar("forward/up", aprox(comprimento(&tr.invoke("forward", (&alvo,))), 1.0, 1e-3) && aprox(comprimento(&tr.invoke("up", (&alvo,))), 1.0, 1e-3));
    tr.invoke("lookAt", (&alvo, v3(0.0, 1.5, 0.0)));
    checar("distance", tr.invoke("distance", (&alvo, v3(2.0, 1.5, -6.0))).number() < 0.01);
    checar("directionTo", aprox(comprimento(&tr.invoke("directionTo", (&alvo, v3(0.0, 1.5, 0.0)))), 1.0, 1e-3));
    let limites = tr.invoke("bounds", (&alvo,));
    checar("bounds", !limites.is_none() && numero(&limites.get("max"), "y") > numero(&limites.get("min"), "y"));
    checar("worldMatrix", tr.invoke("worldMatrix", (&alvo,)).len() == 16 && tr.invoke("localMatrix", (&alvo,)).len() == 16);
    let local = tr.invoke("worldToLocal", (&alvo, tr.invoke("localToWorld", (&alvo, v3(1.0, 0.0, 0.0)))));
    checar("localToWorld/worldToLocal", eq3(&local, 1.0, 0.0, 0.0, 1e-3));
    Value::undefined()
}

fn malhas() -> Value {
    let me = api("mesh");
    let s = api("scene");
    let csg = api("csg");
    let mat = api("material");
    let caixa = me.invoke("box", (1, 1, 1));
    let triangulos = me.invoke("triangleCount", (&caixa,)).number();
    checarf("mesh.box", me.invoke("vertexCount", (&caixa,)).number() > 0.0 && triangulos == 12.0, &format!("{triangulos}"));
    let esfera = me.invoke("sphere", (0.65, 16, 12));
    let furado = csg.invoke("boolean", (&caixa, &esfera, "subtract"));
    checar("csg.boolean", me.invoke("triangleCount", (&furado,)).number() > 12.0);
    let ator = s.invoke("spawn", ("mesh", obj! {
        "name" => "CaixaFurada",
        "mesh" => &furado,
        "material" => mat.invoke("create", (obj! { "baseColor" => "#e63946", "roughness" => 0.4, "metallic" => 0.2 },)),
        "position" => v3(4.0, 0.5, 2.0),
    }));
    checar("spawn malha CSG", !ator.get("mesh").is_none());
    checar("csg.operations", contem(&csg.invoke("operations", ()), "union"));
    let tri = me.invoke("create", (obj! {
        "name" => "Triangulo",
        "positions" => Value::list([-1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.5, 0.0]),
        "uvs" => Value::list([0.0, 0.0, 1.0, 0.0, 0.5, 1.0]),
        "indices" => Value::list([0, 1, 2]),
    },));
    me.invoke("computeNormals", (&tri,));
    checar("mesh.create + computeBounds", numero(&me.invoke("computeBounds", (&tri,)).get("max"), "y") >= 1.5);
    let dupla = me.invoke("merge", (&tri, me.invoke("flipWinding", (me.invoke("clone", (&tri,)),))));
    checar("mesh.merge", me.invoke("triangleCount", (&dupla,)).number() == 2.0);
    s.invoke("spawn", ("mesh", obj! {
        "name" => "Triangulo",
        "mesh" => &dupla,
        "material" => mat.invoke("create", (obj! { "baseColor" => "#06d6a0", "doubleSided" => true },)),
        "position" => v3(7.0, 0.0, -2.0),
    }));
    let grande = me.invoke("scale", (me.invoke("translate", (me.invoke("clone", (&caixa,)), v3(0.0, 0.5, 0.0))), 2));
    checar("mesh.translate/scale", numero(&me.invoke("computeBounds", (&grande,)).get("max"), "y") > 1.9);
    let distancia = me.invoke("raycast", (api("math.ray").invoke("create", (v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0))), &grande));
    checar("mesh.raycast", distancia.is_number() && distancia.number() > 0.0);
    let vertices = me.invoke("vertexCount", (&caixa,)).number() as usize;
    checar("positions/indices", me.invoke("positions", (&caixa,)).len() == vertices * 3 && me.invoke("indices", (&caixa,)).len() == 36);
    checar("primitivas extras", me.invoke("triangleCount", (me.invoke("torusKnot", ()),)).number() > 0.0 && me.invoke("triangleCount", (me.invoke("capsule", ()),)).number() > 0.0);
    Value::undefined()
}

                                                                                             

fn materiais() -> Value {
    let mat = api("material");
    let s = api("scene");
    let tex = api("texture");
    let base = mat.invoke("create", (obj! { "name" => "DebugBase", "baseColor" => "#d98c2b", "roughness" => 0.5, "metallic" => 0.1 },));
    checar("material.create", numero(&base, "roughness") == 0.5);
    let copia = mat.invoke("clone", (&base,));
    mat.invoke("set", (&copia, obj! { "roughness" => 1, "emissive" => "#ffffff", "emissiveIntensity" => 2 }));
    checar("material.clone/set", numero(&copia, "roughness") == 1.0 && numero(&base, "roughness") == 0.5);
    let caixa = s.invoke("spawnPrimitive", ("box", obj! { "name" => "CaixaPintada", "position" => v3(-7.0, 0.5, 2.0) }));
    mat.invoke("assign", (&caixa, &base));
    checar("material.assign/of", !mat.invoke("of", (&caixa,)).is_none());
    mat.invoke("own", (&caixa,));
    mat.invoke("setColor", (&caixa, "#d98c2b"));
    let desenho = tex.invoke("canvas", (64, 64));
    desenho.invoke("update", ());
    mat.invoke("setTexture", (&caixa, "baseColorMap", desenho.get("texture")));
    checar("texture.canvas + setTexture", mat.invoke("hasAnyTexture", (mat.invoke("of", (&caixa,)),)).boolean() && tex.invoke("isTexture", (desenho.get("texture"),)).boolean());
    checar("material.slots", mat.invoke("slots", ()).len() > 0);
    checar("materials.list", api("materials").invoke("list", ()).is_array());
    let sombreado = mat.invoke("fromShader", ("DebugSuperficie", obj! { "glow" => v3(1.0, 0.45, 0.1), "speed" => 2 }));
    checar("material.fromShader", !sombreado.is_none());
    if !sombreado.is_none() {
        let esfera = s.invoke("spawnPrimitive", ("sphere", obj! { "name" => "EsferaShader", "position" => v3(0.0, 1.0, -3.0), "scale" => 1.4 }));
        mat.invoke("assign", (&esfera, &sombreado));
        mat.invoke("uniforms", (&esfera,)).invoke("set", ("speed", 3));
        checar("material.uniforms.list", mat.invoke("uniforms", (&esfera,)).invoke("list", ()).len() >= 1);
    }
    Value::undefined()
}

fn luzes() -> Value {
    let l = api("light");
    checar("light.types", contem(&l.invoke("types", ()), "point") && contem(&l.invoke("localTypes", ()), "spot"));
    let lampada = l.invoke("spawn", ("point", obj! { "name" => "Lampada", "position" => v3(0.0, 3.0, 0.0), "color" => "#ffd166", "intensity" => 60, "range" => 14 }));
    checar("light.spawn", !lampada.get("light").is_none() && texto_igual(&lampada.path("light.type"), "point"));
    l.invoke("set", (&lampada, obj! { "intensity" => 80 }));
    checar("light.set", numero(&lampada.get("light"), "intensity") == 80.0);
    l.invoke("setTemperature", (&lampada, 3200));
    checar("setTemperature", numero(&lampada.get("light"), "temperature") == 3200.0);
    let foco = l.invoke("spawn", ("spot", obj! {
        "name" => "Holofote", "position" => v3(4.0, 4.0, 0.0), "rotation" => v3(-90.0, 0.0, 0.0), "intensity" => 120, "range" => 16,
        "innerAngle" => 20, "outerAngle" => 35, "color" => "#ffffff",
    }));
    checar("spot", texto_igual(&foco.path("light.type"), "spot"));
    let convertido = l.invoke("convert", (&foco, "disc"));
    checar("light.convert", texto_igual(&convertido.get("type"), "disc") && texto_igual(&foco.path("light.type"), "disc"));
    l.invoke("convert", (&foco, "spot"));
    let presets = l.invoke("presets", ());
    checar("light.presets", presets.len() > 0);
    if presets.len() > 0 {
        let primeiro = presets.at(0);
        let preset = l.invoke("spawn", (primeiro.get("id"), obj! { "name" => "LuzPreset", "position" => v3(-4.0, 2.5, 4.0) }));
        checar("light.fromPreset", !preset.get("light").is_none() && l.invoke("fromPreset", (primeiro.get("id"),)).get("type").equals(&primeiro.get("type")));
    }
    checar("light.all", l.invoke("all", (obj! { "local" => true },)).len() >= 2);
    checar("effectiveRange", l.invoke("effectiveRange", (&lampada,)).number() > 0.0);
    checar("light.isLocal", verdadeiro(&l.invoke("isLocal", (&lampada,))));
    checar("temperatureToColor", !l.invoke("temperatureToColor", (6500,)).is_none());
    l.invoke("setColor", (&lampada, "#ffffff"));
    checar("light.setColor", eq3(&lampada.path("light.color"), 1.0, 1.0, 1.0, 0.01));
    Value::undefined()
}

fn ceu() -> Value {
    let sky = api("sky");
    let mundo = api("world");
    sky.invoke("set", (obj! { "timeOfDay" => 10.5, "haze" => 0.3, "clouds" => obj! { "enabled" => true, "coverage" => 0.45 } },));
    checar("sky.set", aprox(numero(&sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(&sky.path("clouds.enabled")));
    checar("sky.isDay", verdadeiro(&sky.get("isDay")));
    checar("sky.sunDirection", numero(&sky.invoke("sunDirection", ()), "y") > 0.0);
    let hora = sky.invoke("formatTimeOfDay", (10.5,)).to_string();
    checarf("sky.formatTimeOfDay", hora.contains(':'), &hora);
    checar("sky.wrapTimeOfDay", sky.invoke("wrapTimeOfDay", (25,)).number() == 1.0);
    checar("sky.presets", sky.invoke("presets", ()).len() > 0);
    assinar(sky.invoke("onHourChanged", (Value::function(|args| info!("Hora do céu: {}", arg(args, 0))),)));
    sky.set("cycleSpeed", 0);
    checar("sky.cycleSpeed", numero(&sky, "cycleSpeed") == 0.0);
    checar("world.gravity", numero(&mundo.get("gravity"), "y") < 0.0);
    mundo.get("wind").invoke("set", (obj! { "speed" => 2, "direction" => 45 },));
    checar("world.wind.set", numero(&mundo.get("wind"), "speed") == 2.0);
    Value::undefined()
}

fn camera() -> Value {
    let c = api("camera");
    checar("camera.fov", numero(&c, "fov") > 0.0 && numero(&c, "aspect") > 0.0);
    checar("camera.near/far", numero(&c, "near") > 0.0 && numero(&c, "far") > numero(&c, "near"));
    let viewport = c.get("viewport");
    checar("viewport", numero(&viewport, "width") > 0.0);
    let na_tela = c.invoke("worldToScreen", (v3(0.0, 0.0, 0.0),));
    checar("worldToScreen", na_tela.is_none() || na_tela.get("x").is_number());
    let raio = c.invoke("screenToRay", (numero(&viewport, "width") / 2.0, numero(&viewport, "height") / 2.0));
    checar("screenToRay", raio.is_none() || aprox(comprimento(&raio.get("direction")), 1.0, 0.01));
    checar("viewMatrix", c.get("viewMatrix").len() == 16);
    let jogador = c.get("player");
    jogador.invoke("set", (obj! { "distance" => 7, "pitch" => 18 },));
    checar("player.set", numero(&jogador.get("settings"), "distance") == 7.0);
    checar("distanceTo", c.invoke("distanceTo", (v3(0.0, 0.0, 0.0),)).number() >= 0.0);
    checar("camera.position", !c.get("position").is_none() && !c.get("forward").is_none());
    assinar(c.invoke("onMainChanged", (Value::function(|args| {
        let entidade = arg(args, 0);
        info!("Câmera principal: {}", if entidade.is_none() { "editor/jogador".to_string() } else { nome_de(&entidade) });
    }),)));
    Value::undefined()
}

fn pos() -> Value {
    let p = api("post");
    checar("post.toneMappers", p.invoke("toneMappers", ()).len() > 0);
    p.invoke("set", (obj! {
        "bloom" => obj! { "enabled" => true, "intensity" => 0.5, "threshold" => 1, "softKnee" => 0.5, "radius" => 0.6 },
        "vignette" => obj! { "enabled" => true, "intensity" => 0.35, "smoothness" => 0.5, "roundness" => 1 },
    },));
    checar("post.set", verdadeiro(&p.path("bloom.enabled")) && verdadeiro(&p.path("vignette.enabled")));
    p.set("exposure", 1.05);
    checar("post.exposure", aprox(numero(&p, "exposure"), 1.05, 1e-3));
    p.set("toneMapper", "agx");
    checar("post.toneMapper", texto_igual(&p.get("toneMapper"), "agx"));
    checar("post.presets", p.invoke("presets", ()).len() > 0);
    let custom = p.get("custom");
    let novo = custom.invoke("add", (obj! { "fragment" => "DebugPost", "name" => "DebugPost", "uniforms" => obj! { "tint" => v3(0.15, 0.05, 0.3), "strength" => 0.6 } },));
    checar("post.custom.add", !novo.is_none() && !custom.invoke("get", ("DebugPost",)).is_none());
    novo.get("uniforms").invoke("set", ("strength", 0.8));
    checar("efeito.uniforms.list", novo.get("uniforms").invoke("list", ()).len() >= 2);
    guardar(|estado| &estado.efeito, novo);
    Value::undefined()
}

fn render() -> Value {
    let r = api("render");
    checar("render.passNames", r.invoke("passNames", ()).len() > 0);
    checar("render.stats", r.path("stats.drawCalls").is_number());
    checar("render.frame", r.path("frame.width").is_number());
    assinar(r.invoke("onAfterFrame", (Value::function(|_| contar(|estado| &estado.renders)),)));
    r.set("showGrid", false);
    checar("render.showGrid", falso(&r.get("showGrid")));
    checar("render.pixelRatio", numero(&r, "pixelRatio") > 0.0);
    Value::undefined()
}

                                                                                          

fn fisica() -> Value {
    let ph = api("physics");
    let s = api("scene");
    checar("physics.enabled", verdadeiro(&ph.get("enabled")));
    checar("physics.gravity", numero(&ph.get("gravity"), "y") < 0.0);
    checar("physics.settings", numero(&ph.get("settings"), "fixedTimestep") > 0.0);
    for i in 1..=5 {
        let indice = i as f64;
        let caixa = s.invoke("spawnPrimitive", ("box", obj! {
            "name" => format!("Caixa{i}"),
            "position" => v3(-2.0 + (indice - 1.0) * 1.1, 3.0 + (indice - 1.0) * 1.2, 3.0),
            "rigidBody" => obj! { "type" => "dynamic", "collider" => "box", "mass" => 2, "restitution" => 0.3 },
            "tags" => Value::list(["caixa"]),
        }));
        api("material").invoke("setColor", (&caixa, api("math.color").invoke("hsl", (30.0 + indice * 12.0, 0.7, 0.5))));
    }
    let caixas = s.invoke("byTag", ("caixa",));
    let primeira = caixas.at(0);
    checar("caixas dinâmicas", caixas.len() == 5 && ph.invoke("hasBody", (&primeira,)).boolean());
    let corpo = ph.invoke("bodyOf", (&primeira,));
    checar("bodyOf", verdadeiro(&corpo.get("isDynamic")) && numero(&corpo, "mass") > 0.0);
    corpo.invoke("applyImpulse", (v3(0.0, 2.0, 0.0),));
    corpo.invoke("applyTorque", (v3(0.0, 1.0, 0.0),));
    corpo.invoke("setMaterial", (obj! { "friction" => 0.8 },));
    corpo.invoke("wake", ());
    checar("body.linearVelocity", !corpo.get("linearVelocity").is_none());
    checar("bodies()", ph.invoke("bodies", ()).len() >= 6);
    let hit = ph.invoke("raycast", (v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0), 20));
    checar("physics.raycast", !hit.is_none() && !hit.get("entity").is_none());
    checar("raycastAll", ph.invoke("raycastAll", (v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0), 20)).len() >= 1);
    checar("overlapSphere", ph.invoke("overlapSphere", (v3(0.0, 3.0, 3.0), 4)).is_array());
    checar("massProperties", numero(&ph.invoke("massProperties", (&primeira,)), "mass") > 0.0);
    checar("colliderVolume", ph.invoke("colliderVolume", (&primeira,)).number() > 0.0);
    let formas = ph.get("shapes");
    checar("shapes.sphere volume", aprox(formas.invoke("volume", (formas.invoke("sphere", (1,)),)).number(), 4.18879, 0.01));
    assinar(ph.invoke("onCollisionBegin", (Value::function(|args| {
        contar(|estado| &estado.colisoes);
        if lido(|estado| &estado.colisoes) > 3 {
            return;
        }
        let e = arg(args, 0);
        info!("Colisão: {} × {} (impulso {:.2})", nome_de(&e.get("a")), nome_de(&e.get("b")), numero(&e.get("contact"), "impulse"));
    }),)));
    assinar(ph.invoke("onOutOfBounds", (Value::function(|args| aviso!("{} caiu do mundo", nome_de(&arg(args, 0)))),)));
    let gatilho = s.invoke("spawn", ("group", obj! { "name" => "Gatilho", "position" => v3(0.0, 1.0, 3.0), "trigger" => obj! { "shape" => "box", "size" => v3(3.0, 2.0, 3.0) } }));
    checar("trigger spawn", !gatilho.is_none() && s.invoke("isAttached", (&gatilho,)).boolean());
    checar("physics.stats", ph.path("stats.bodies").is_number());
    Value::undefined()
}

fn personagem() -> Value {
    let ch = api("character");
    let pl = api("player");
    let novo = ch.invoke("spawn", (obj! { "name" => "Heroi", "position" => v3(0.0, 1.2, 8.0), "character" => obj! { "walkSpeed" => 4, "runSpeed" => 7, "jumpHeight" => 1.4 } },));
    checar("character.spawn", !novo.get("character").is_none() && ch.invoke("has", (&novo,)).boolean());
    let c = ch.invoke("of", (&novo,));
    checar("character.of", c.get("isGrounded").is_bool());
    checar("settingsOf", numero(&ch.invoke("settingsOf", (&novo,)), "walkSpeed") == 4.0);
    pl.invoke("possess", (&novo,));
    checar("player.possess", pl.get("possessed").equals(&novo) && verdadeiro(&pl.get("isPossessing")));
    assinar(ch.invoke("onJumped", (Value::function(|args| info!("{} pulou", nome_de(&arg(args, 0).get("entity")))),)));
    assinar(pl.invoke("onPossessed", (Value::function(|args| info!("Possuindo {}", nome_de(&arg(args, 0)))),)));
    checar("character.all", ch.invoke("all", ()).len() >= 1);
    checar("player.spawnPoint", !pl.get("spawnPoint").is_none());
    checar("character.velocity", !c.get("velocity").is_none() && !c.get("position").is_none());
    guardar(|estado| &estado.heroi, novo);
    Value::undefined()
}

fn terreno() -> Value {
    let te = api("terrain");
    checar("terrain.presets", te.invoke("presets", ()).len() > 0);
    let colinas = te.invoke("spawn", (obj! { "name" => "Colinas", "size" => 48, "resolution" => 65, "preset" => "hills", "seed" => 7, "position" => v3(0.0, -6.0, -70.0) },));
    checar("terrain.spawn", !colinas.get("terrain").is_none() && te.invoke("all", ()).len() >= 1);
    checar("terrain.of", numero(&te.invoke("of", (&colinas,)), "resolution") == 65.0);
    checar("heightAt", te.invoke("heightAt", (v3(0.0, 0.0, -70.0), &colinas)).is_number());
    checar("contains", te.invoke("contains", (v3(0.0, 0.0, -70.0), &colinas)).boolean() && !te.invoke("contains", (v3(500.0, 0.0, 0.0), &colinas)).boolean());
    te.invoke("sculpt", (&colinas, "raise", v3(5.0, 0.0, -70.0), obj! { "radius" => 6, "strength" => 1 }, 1));
    te.invoke("markDirty", (&colinas,));
    let grama = te.get("grass");
    grama.invoke("set", (&colinas, obj! { "enabled" => true, "density" => 0.5 }));
    checar("grass.set", verdadeiro(&grama.invoke("settingsOf", (&colinas,)).get("enabled")));
    let agua = te.get("water");
    agua.invoke("set", (&colinas, obj! { "enabled" => true, "level" => -2 }));
    checar("water.set", verdadeiro(&agua.invoke("settingsOf", (&colinas,)).get("enabled")));
    checar("terrain.raycast", !te.invoke("raycast", (v3(0.0, 50.0, -70.0), v3(0.0, -1.0, 0.0), &colinas)).is_none());
    Value::undefined()
}

                                                                                          

fn soltar_caixa() {
    let random = api("math.random");
    let caixa = api("scene").invoke("spawnPrimitive", ("box", obj! {
        "name" => "CaixaSolta",
        "position" => v3(random.invoke("range", (-3, 3)).number(), 6.0, random.invoke("range", (0, 4)).number()),
        "rigidBody" => obj! { "type" => "dynamic", "collider" => "box", "mass" => 1 },
        "tags" => Value::list(["caixa"]),
    }));
    api("material").invoke("setColor", (&caixa, random.invoke("color", ())));
    contar(|estado| &estado.pontos);
    api("gui").invoke("bind", ("pontos", lido(|estado| &estado.pontos)));
    api("events").invoke("emit", ("debug.caixa", obj! { "nome" => caixa.get("name") }));
}

fn interface_grafica() -> Value {
    let g = api("gui");
    g.invoke("css", ("DebugEstilo",));
    let hud = g.invoke("html", ("DebugHud", obj! { "id" => "debug-hud" }));
    checar("gui.html", !hud.is_none() && !g.invoke("element", ("#debug-hud",)).is_none());
    let icone = g.invoke("svg", ("DebugIcone", obj! { "id" => "debug-icone" }));
    checar("gui.svg", !icone.is_none());
    let slot = g.invoke("element", ("[data-slot=icone]",));
    if !slot.is_none() && !icone.is_none() {
        slot.invoke("appendChild", (&icone,));
    }
    checar("gui.bind", g.invoke("bind", ("linguagem", LINGUAGEM)).number() >= 1.0);
    g.invoke("bind", ("titulo", "Helix · Debug"));
    assinar(g.invoke("onAction", ("caixa", Value::function(|_| soltar_caixa()))));
    assinar(g.invoke("onAction", ("reiniciar", Value::function(|_| { api("play").invoke("restart", ()); }))));
    checar("gui.elements", g.invoke("elements", ("[data-bind]",)).len() >= 5);
    checar("gui.size", numero(&g.get("size"), "width") > 0.0);
    let escala = |scale: f64, offset: f64| obj! { "scale" => scale, "offset" => offset };
    let declarativa = g.invoke("create", ("DebugTela", obj! { "referenceSize" => obj! { "x" => 1280, "y" => 720 } }));
    let painel = g.invoke("add", (&declarativa, "frame", obj! {
        "name" => "Painel",
        "rect" => obj! {
            "position" => obj! { "x" => escala(1.0, -236.0), "y" => escala(0.0, 16.0) },
            "size" => obj! { "x" => escala(0.0, 220.0), "y" => escala(0.0, 48.0) },
        },
    }));
    g.invoke("add", (&declarativa, "text", obj! { "name" => "Rotulo", "text" => "Tela declarativa OK" }, painel.path("node.id")));
    checar("gui.add/find", texto_igual(&g.invoke("find", (&declarativa, "Rotulo")).get("kind"), "text"));
    g.invoke("setText", (&declarativa, "Rotulo", format!("Tela declarativa OK · {LINGUAGEM}")));
                                                                                       
    g.invoke("show", (&declarativa, "debug-tela")).invoke("then", (Value::function(|args| {
        let g = api("gui");
        let tela = arg(args, 0);
        checar("gui.show/isShown", !tela.is_none() && g.invoke("isShown", (&tela,)).boolean());
        checar("gui.kinds", contem(&g.invoke("kinds", ()), "button"));
        guardar(|estado| &estado.tela, tela);
    }),))
}

fn audio() -> Value {
    let a = api("audio");
    let s = api("scene");
    checar("audio.supported", a.get("supported").is_bool());
    let mixer = a.get("mixer");
    mixer.invoke("setVolumeDb", ("sfx", -3));
    checar("mixer.setVolumeDb", numero(&mixer.invoke("bus", ("sfx",)), "volumeDb") == -3.0);
    checar("audio.clips", a.invoke("clips", ()).is_array());
    let fonte = s.invoke("spawn", ("sound", obj! { "name" => "FonteSonora", "position" => v3(3.0, 1.0, 3.0), "audioSource" => obj! { "trigger" => "manual", "spatial" => true } }));
    checar("spawn sound", !fonte.get("audioSource").is_none());
    let fontes = a.get("sources");
    fontes.invoke("set", (&fonte, obj! { "volumeDb" => -4 }));
    checar("sources.set", numero(&fonte.get("audioSource"), "volumeDb") == -4.0);
    checar("sources.isPlaying", falso(&fontes.invoke("isPlaying", (&fonte,))));
    Value::undefined()
}

fn vfx() -> Value {
    let v = api("vfx");
    let ids = v.get("templates").invoke("ids", ());
    checar("vfx.templates", ids.len() > 0);
    checar("vfx.moduleKinds", v.invoke("moduleKinds", ()).len() > 0);
    let mut doc = v.invoke("fromTemplate", (ids.at(0), "DebugFaiscas"));
    doc = v.invoke("addEmitter", (&doc, obj! { "name" => "Extra", "maxParticles" => 50 }));
    doc = v.invoke("set", (&doc, obj! { "loop" => true }));
    checar("vfx.fromTemplate/addEmitter", doc.get("emitters").len() >= 2 && verdadeiro(&doc.get("loop")));
    v.invoke("save", (&doc, "DebugFaiscas")).invoke("then", (Value::function(|args| {
        let v = api("vfx");
        let ativo = arg(args, 0);
        checar("vfx.save", !ativo.is_none() && texto_igual(&ativo.get("kind"), "vfx"));
        let ator = v.invoke("emitAt", (&ativo, v3(0.0, 1.5, -8.0), obj! { "destroyWhenFinished" => false }));
        checar("vfx.emitAt", verdadeiro(&v.invoke("has", (&ator,))));
        v.invoke("burst", (&ator, 20));
        checar("vfx.stats", v.invoke("stats", ()).get("effects").is_number());
    }),))
}

                                                                                         

fn ao_teclar(e: &Value) {
    if e.get("repeat").boolean() {
        return;
    }
    match e.get("code").to_string().as_str() {
        "KeyR" => {
            api("play").invoke("restart", ());
        }
        "KeyB" => soltar_caixa(),
        "KeyE" => {
            api("events").invoke("emit", ("debug.ping", obj! { "origem" => "teclado", "quadro" => api("time").get("frame") }));
        }
        "KeyF" => {
            api("camera").invoke("shake", (0.4, 0.6));
        }
        "KeyG" => {
            let efeito = lembrado(|estado| &estado.efeito);
            if !efeito.is_undefined() {
                let ligado = !efeito.get("enabled").boolean();
                efeito.set("enabled", ligado);
                info!("Efeito DebugPost {}", if ligado { "ligado" } else { "desligado" });
            }
        }
        "KeyT" => {
            let tm = api("time");
            tm.set("scale", if numero(&tm, "scale") == 1.0 { 0.3 } else { 1.0 });
            info!("time.scale = {}", numero(&tm, "scale"));
        }
        "KeyH" => {
            let tela = lembrado(|estado| &estado.tela);
            if !tela.is_undefined() {
                let g = api("gui");
                if g.invoke("isShown", (&tela,)).boolean() {
                    g.invoke("hide", (&tela,));
                } else {
                    g.invoke("show", (&tela, "debug-tela"));
                }
            }
        }
        "KeyL" => {
            let nomes: Vec<String> = api("light").invoke("all", (obj! { "local" => true },)).iter().map(|luz| nome_de(&luz.get("entity"))).collect();
            info!("Luzes locais: {}", nomes.join(", "));
        }
        _ => {}
    }
}

fn clique_na_cena(x: f64, y: f64) {
    let c = api("camera");
    let alvo = c.invoke("pick", (x, y));
    let ponto = c.invoke("pickPoint", (x, y));
    if !alvo.is_none() {
        info!("Clique em {}", nome_de(&alvo));
    }
    if !ponto.is_none() {
        api("debug").invoke("sphere", (&ponto, 0.3, "#ff006e", 2));
    }
}

fn entrada() -> Value {
    let input = api("input");
    let acoes = input.get("actions");
    acoes.invoke("define", ("pular", Value::list(["Space", "Gamepad:0"])));
    acoes.invoke("define", ("soltar", Value::list(["KeyB"])));
    checar("actions.define/bindings", acoes.invoke("bindings", ("pular",)).len() >= 1);
    checar("action()", texto_igual(&input.invoke("action", ("pular",)).get("name"), "pular") && acoes.invoke("down", ("pular",)).is_bool());
    checar("isDown", falso(&input.invoke("isDown", ("KeyW",))));
    checar("pointer", input.path("pointer.x").is_number());
    checar("gamepads", input.invoke("gamepads", ()).is_array());
    checar("axis2d", input.invoke("axis2d", (obj! { "up" => "KeyW", "down" => "KeyS", "left" => "KeyA", "right" => "KeyD" },)).get("x").is_number());
    checar("keysDown", input.invoke("keysDown", ()).is_object() || input.invoke("keysDown", ()).is_array());
    assinar(input.invoke("onKeyDown", (Value::function(|args| ao_teclar(&arg(args, 0))),)));
    assinar(input.invoke("onPointerDown", (Value::function(|args| {
        let e = arg(args, 0);
        if numero(&e, "button") == 0.0 {
            clique_na_cena(numero(&e, "x"), numero(&e, "y"));
        }
    }),)));
    assinar(input.invoke("onGamepadButtonDown", (Value::function(|args| {
        let e = arg(args, 0);
        info!("Gamepad {} botão {}", numero(&e, "pad"), numero(&e, "button"));
    }),)));
    Value::undefined()
}

fn eventos() -> Value {
    let ev = api("events");
    let play = api("play");
                                                                             
    let recebido = Rc::new(RefCell::new(Value::undefined()));
    let guardar_ping = recebido.clone();
    let desligar = ev.invoke("on", ("debug.ping", Value::function(move |args| *guardar_ping.borrow_mut() = arg(args, 0))));
    checar("events.emit conta ouvintes", ev.invoke("emit", ("debug.ping", obj! { "origem" => "teste" })).number() == 1.0);
    let payload = recebido.borrow().clone();
    checar("events.on recebe", !payload.is_undefined() && texto_igual(&payload.get("origem"), "teste"));
    checar("listenerCount", ev.invoke("listenerCount", ("debug.ping",)).number() == 1.0);
    desligar.call(());
    checar("unsubscribe", ev.invoke("listenerCount", ("debug.ping",)).number() == 0.0);
    let uma_vez = Rc::new(Cell::new(0u32));
    let contar_uma_vez = uma_vez.clone();
    ev.invoke("once", ("debug.once", Value::function(move |_| contar_uma_vez.set(contar_uma_vez.get() + 1))));
    ev.invoke("emit", ("debug.once",));
    ev.invoke("emit", ("debug.once",));
    checar("events.once", uma_vez.get() == 1);
    assinar(ev.invoke("on", ("debug.ping", Value::function(|args| info!("ping de {}", arg(args, 0).get("origem"))))));
    assinar(ev.invoke("on", ("debug.caixa", Value::function(|args| depurar!("caixa {}", arg(args, 0).get("nome"))))));
    let torus = lembrado(|estado| &estado.torus);
    let do_ator = Rc::new(Cell::new(0u32));
    let contar_toque = do_ator.clone();
    assinar(ev.invoke("onEntity", (&torus, "toque", Value::function(move |_| contar_toque.set(contar_toque.get() + 1)))));
    ev.invoke("emitEntity", (&torus, "toque"));
    checar("onEntity/emitEntity", do_ator.get() == 1);
    assinar(play.invoke("onStopped", (Value::function(|_| info!("play.onStopped disparou")),)));
    assinar(play.invoke("onPaused", (Value::function(|_| info!("pausado")),)));
    assinar(play.invoke("onResumed", (Value::function(|_| info!("retomado")),)));
    Value::undefined()
}

                                                                                 
fn tempo() -> Value {
    let tm = api("time");
    checar("time.now", numero(&tm, "now") >= 0.0 && numero(&tm, "frame") >= 0.0);
    checar("time.delta", numero(&tm, "delta") >= 0.0 && numero(&tm, "fixedDelta") > 0.0);
    let inicio = numero(&tm, "now");
    tm.invoke("wait", (0.1,)).invoke("then", (Value::function(move |_| tempo_passo1(inicio)),))
}

fn tempo_passo1(inicio: f64) -> Value {
    let tm = api("time");
    let decorrido = numero(&tm, "now") - inicio;
    checarf("time.wait", decorrido >= 0.09, &format!("{decorrido:.3}"));
    let quadro = numero(&tm, "frame") as i64;
    tm.invoke("waitFrames", (2,)).invoke("then", (Value::function(move |_| tempo_passo2(quadro)),))
}

fn tempo_passo2(quadro_antes: i64) -> Value {
    let tm = api("time");
    let quadro = numero(&tm, "frame") as i64;
    checarf("time.waitFrames", quadro >= quadro_antes + 2, &format!("{}", quadro - quadro_antes));
    assinar(tm.invoke("every", (2, Value::function(|_| { api("gui").invoke("bind", ("atores", api("scene").invoke("count", ()))); }))));
    let disparou = Rc::new(Cell::new(false));
    let marcar = disparou.clone();
    tm.invoke("delay", (0.2, Value::function(move |_| marcar.set(true))));
`;
}
