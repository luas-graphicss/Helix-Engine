import type { GameSources } from '../types';
export function javaGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
import helix.*;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

public class DebugJogo extends Script {
    private static final String LINGUAGEM = "Java";

    private int quadros, passosFisica, lateUpdates, renders, colisoes, checagens, falhas, pontos;
    private double hudTimer;
                                                                           
    private Value torus, heroi, efeito, tela;
    private final List<Value> assinaturas = new ArrayList<>();

                                                                                                            
    private static final class Area {
        final String nome;
        final Supplier<Object> rodar;
        final boolean esperaErro;

        Area(String nome, Supplier<Object> rodar, boolean esperaErro) {
            this.nome = nome;
            this.rodar = rodar;
            this.esperaErro = esperaErro;
        }

        Area(String nome, Supplier<Object> rodar) {
            this(nome, rodar, false);
        }
    }

                                                                                              

    private Value api(String caminho) {
        return helix().path(caminho);
    }

    private static Vec3 v3(double x, double y, double z) {
        return new Vec3(x, y, z);
    }

                                                                  
    private static Value obj(Object... pares) {
        return Helix.object(pares);
    }

    private void registrar(String metodo, String mensagem) {
        api("log").call(metodo, "Debug", mensagem);
    }

    private void info(String mensagem) {
        registrar("info", mensagem);
    }

    private void aviso(String mensagem) {
        registrar("warn", mensagem);
    }

    private void erro(String mensagem) {
        registrar("error", mensagem);
    }

    private void depurar(String mensagem) {
        registrar("debug", mensagem);
    }

    private void checar(String nome, boolean condicao) {
        checar(nome, condicao, null);
    }

    private void checar(String nome, boolean condicao, Object detalhe) {
        checagens++;
        if (condicao) return;
        falhas++;
        erro(detalhe == null ? "FALHOU " + nome : "FALHOU " + nome + ": " + detalhe);
    }

    private void assinar(Value desligar) {
        if (desligar.isFunction()) assinaturas.add(desligar);
    }

    private static boolean verdadeiro(Value v) {
        return v.isBoolean() && v.asBoolean();
    }

    private static boolean falso(Value v) {
        return v.isBoolean() && !v.asBoolean();
    }

    private static boolean aprox(double a, double b, double epsilon) {
        return Math.abs(a - b) <= epsilon;
    }

    private static double arred(double x) {
        return Math.round(x * 100) / 100.0;
    }

    private static double numero(Value o, String chave) {
        return o.get(chave).asDouble(Double.NaN);
    }

    private static boolean textoIgual(Value v, String esperado) {
        return v.isString() && v.asString().equals(esperado);
    }

                                                                                                 
    private boolean eq3(Value vetor, double x, double y, double z, double epsilon) {
        return api("math.vec3").call("equals", vetor, v3(x, y, z), epsilon).asBoolean();
    }

    private double comprimento(Value vetor) {
        return api("math.vec3").call("length", vetor).asDouble();
    }

    private static boolean contem(Value lista, String texto) {
        for (Value item : lista.asList()) if (item.asString().equals(texto)) return true;
        return false;
    }

    private static String nomeDe(Value entidade) {
        return entidade.isNullish() ? "ninguém" : entidade.get("name").asString();
    }

                                                                                               

    private Object nucleo() {
        Value engine = api("engine");
        Value nome = engine.get("name");
        String contexto = helix().get("context").asString();
        checar("engine.name", nome.isString() && !nome.asString().isEmpty());
        checar("engine.version", engine.get("version").isString());
        checar("context", contexto.equals("shared") || contexto.equals("client") || contexto.equals("server"), contexto);
        checar("isPlaying", verdadeiro(helix().get("isPlaying")));
        checar("isEditor", falso(helix().get("isEditor")));
        checar("self no script de entrada", self().isNullish() && helix().get("self").isNullish());
        checar("script é o handle do script", script().isObject());
        checar("Helix.root", Helix.root().get("engine").isObject());
        info(nome.asString() + " " + engine.get("version").asString() + " · API " + engine.get("apiVersion").asString() + " · " + LINGUAGEM);
        Helix.log("Helix.log direto do Java (console da engine)");
        return null;
    }

    private Object modulo() {
        Value util = Helix.require("DebugUtil");
        checar("require devolve as funções", util.isObject() && util.get("soma").isFunction());
        double resultado = util.call("soma", 2, 3).asDouble();
        checar("require soma", resultado == 5, resultado);
        checar("require saudacao", textoIgual(util.call("saudacao", "Helix"), "Olá, Helix"));
        checar("require limitar", util.call("limitar", 15, 0, 10).asDouble() == 10);
                                                                                   
        checar("DebugUtil.soma direto", DebugUtil.soma(2, 3) == 5);
        return null;
    }

    private Object matematica() {
        Value m = api("math");
        Value vec = m.get("vec3"), quat = m.get("quat"), mat4 = m.get("mat4"), escalar = m.get("scalar");
        checar("vec3.add", eq3(vec.call("add", v3(1, 2, 3), v3(1, 1, 1)), 2, 3, 4, 1e-6));
        checar("vec3.length", aprox(vec.call("length", v3(3, 4, 0)).asDouble(), 5, 1e-3));
        checar("vec3.normalize", aprox(comprimento(vec.call("normalize", v3(0, 5, 0))), 1, 1e-3));
        checar("vec3.cross", eq3(vec.call("cross", v3(1, 0, 0), v3(0, 1, 0)), 0, 0, 1, 1e-6));
        checar("vec3.lerp", eq3(vec.call("lerp", v3(0, 0, 0), v3(2, 2, 2), 0.5), 1, 1, 1, 1e-6));
        Value q = quat.call("fromEuler", v3(0, 90, 0));
        checar("quat.rotateVec3", eq3(quat.call("rotateVec3", q, v3(1, 0, 0)), 0, 0, -1, 1e-3));
        checar("quat.toEuler", aprox(numero(quat.call("toEuler", q), "y"), 90, 0.01));
        Value mat = mat4.call("fromTRS", v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1));
        checar("mat4.transformPoint", eq3(mat4.call("transformPoint", mat, v3(0, 0, 0)), 1, 2, 3, 1e-6));
        checar("mat4.invert", !mat4.call("invert", mat).isNullish());
        Value aabb = m.get("aabb");
        Value caixa = aabb.call("fromCenterSize", v3(0, 0, 0), v3(2, 2, 2));
        checar("aabb.contains", aabb.call("contains", caixa, v3(0.5, 0.5, 0.5)).asBoolean() && !aabb.call("contains", caixa, v3(2, 0, 0)).asBoolean());
        Value ray = m.get("ray");
        Value raio = ray.call("create", v3(0, 5, 0), v3(0, -1, 0));
        checar("ray.intersectAabb", !ray.call("intersectAabb", raio, caixa).isNullish());
        checar("scalar.remap", escalar.call("remap", 5, 0, 10, 0, 100).asDouble() == 50);
        checar("clamp/lerp", m.call("clamp", 15, 0, 10).asDouble() == 10 && m.call("lerp", 0, 10, 0.5).asDouble() == 5);
        checar("scalar.wrapAngle", aprox(escalar.call("wrapAngle", 370).asDouble(), 10, 1e-3));
        checar("degToRad", aprox(m.call("degToRad", 180).asDouble(), Math.PI, 1e-6));
        Value ruido = m.get("noise");
        double perlin = ruido.call("perlin2", 0.3, 0.7).asDouble();
        checar("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, perlin);
        checar("noise.fbm", ruido.call("fbm", 1.5, 2.5, 0, 4).isNumber());
        Value cor = m.get("color");
        checar("color.hexToVec3", eq3(cor.call("hexToVec3", "#ff0000"), 1, 0, 0, 0.01));
        String hex = cor.call("vec3ToHex", v3(1, 1, 1)).asString();
        checar("color.vec3ToHex", hex.equalsIgnoreCase("#ffffff"), hex);
        Value random = m.get("random");
        random.call("seed", 42);
        double primeiro = random.call("value").asDouble();
        random.call("seed", 42);
        checar("random.seed determinístico", random.call("value").asDouble() == primeiro);
        double sorteado = random.call("int", 1, 6).asDouble();
        checar("random.int", sorteado >= 1 && sorteado <= 6 && Math.floor(sorteado) == sorteado);
        checar("random.unitVector", aprox(comprimento(random.call("unitVector")), 1, 1e-3));
        checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI") * 2, 1e-9));
        return null;
    }

                                                                                                

    private Object cena() {
        Value s = api("scene"), mat = api("material");
        Value raiz = s.get("root");
        checar("scene.root", !raiz.isNullish() && raiz.get("children").isArray());
        double antes = s.call("count").asDouble();
        Value grupo = s.call("spawn", "group", obj("name", "DebugCenario"));
        Value chao = s.call("spawn", "mesh", obj(
            "name", "Chao",
            "mesh", api("mesh").call("plane", 40, 40),
            "material", mat.call("create", obj("baseColor", "#4b6b3a", "roughness", 0.95)),
            "rigidBody", obj("type", "static", "collider", "box", "boxSize", v3(40, 0.2, 40), "center", v3(0, -0.1, 0)),
            "receiveShadows", true,
            "tags", Helix.array("chao")
        ), grupo);
        checar("spawn mesh", textoIgual(chao.get("kind"), "mesh") && !chao.get("mesh").isNullish() && !chao.get("rigidBody").isNullish());
        checar("find", s.call("find", "Chao").equals(chao));
        checar("findAll", s.call("findAll", "Chao").length() == 1);
        checar("byId", s.call("byId", chao.get("id")).equals(chao));
        checar("byTag", s.call("byTag", "chao").length() >= 1);
        checar("byKind", s.call("byKind", "mesh").length() >= 1);
        double depois = s.call("count").asDouble();
        checar("count", depois == antes + 2, depois + " vs " + (antes + 2));
        checar("contains", s.call("contains", grupo, chao).asBoolean() && s.call("contains", raiz, chao).asBoolean());
        String caminho = s.call("path", chao).asString();
        checar("path", caminho.contains("Chao"), caminho);
        int[] visitados = {0};
        s.call("traverse", (Fn1) entidade -> {
            visitados[0]++;
            return null;
        }, grupo);
        checar("traverse", visitados[0] >= 2, visitados[0]);

        Value anel = s.call("spawnPrimitive", "torus", obj("name", "Anel", "position", v3(-4, 1.2, -2), "scale", 1.5), grupo);
        mat.call("setColor", anel, "#3a86ff");
        mat.call("setEmissive", anel, "#3a86ff", 0.6);
        torus = anel;
        checar("spawnPrimitive", !anel.get("mesh").isNullish() && !anel.get("material").isNullish());

        Value copia = s.call("clone", anel, true, grupo);
        s.call("rename", copia, "AnelCopia");
        api("transform").call("setPosition", copia, v3(-4, 1.2, 2));
        checar("clone + rename", textoIgual(copia.get("name"), "AnelCopia") && s.call("find", "AnelCopia").equals(copia));
        s.call("setMeta", copia, "origem", "clone");
        checar("meta", textoIgual(s.call("getMeta", copia, "origem"), "clone"));
        s.call("addTag", copia, "temporario");
        checar("addTag/hasTag", s.call("hasTag", copia, "temporario").asBoolean());
        checar("removeTag", verdadeiro(s.call("removeTag", copia, "temporario")) && !s.call("hasTag", copia, "temporario").asBoolean());
        s.call("setVisible", copia, false);
        checar("setVisible", falso(copia.get("visible")));
        s.call("setVisible", copia, true);
        s.call("destroy", copia);
        checar("destroy", s.call("find", "AnelCopia").isNullish() && !s.call("isAttached", copia).asBoolean());

        Value esfera = s.call("spawnPrimitive", "sphere", obj("name", "Esfera", "position", v3(4, 0.5, -3)));
        s.call("reparent", esfera, grupo);
        checar("reparent", esfera.get("parent").equals(grupo));
        mat.call("setColor", esfera, "#ffbe0b");
        s.call("addComponent", esfera, "rigidBody", obj("type", "dynamic", "collider", "sphere", "radius", 0.5, "mass", 1));
        checar("addComponent", !esfera.get("rigidBody").isNullish() && textoIgual(esfera.path("rigidBody.type"), "dynamic"));
        Value temporario = s.call("spawnPrimitive", "box", obj("name", "Temporario"));
        s.call("addComponent", temporario, "csg", Helix.object());
        checar("addComponent csg", !temporario.get("csg").isNullish());
        s.call("removeComponent", temporario, "csg");
        checar("removeComponent", temporario.get("csg").isNullish());
        s.call("destroy", temporario);
        checar("kinds/components", contem(s.call("kinds"), "mesh") && contem(s.call("components"), "rigidBody"));
        return null;
    }

    private Object transformacao() {
        Value tr = api("transform"), s = api("scene");
        Value alvo = s.call("spawnPrimitive", "cone", obj("name", "Cone", "position", v3(0, 0.5, -6)));
        api("material").call("setColor", alvo, "#8338ec");
        tr.call("setPosition", alvo, v3(2, 0.5, -6));
        checar("setPosition", eq3(tr.call("position", alvo), 2, 0.5, -6, 1e-6));
        tr.call("translate", alvo, v3(0, 1, 0), "world");
        checar("translate", aprox(numero(tr.call("position", alvo), "y"), 1.5, 1e-3));
`;
}
