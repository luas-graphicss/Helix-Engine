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
`;
}
