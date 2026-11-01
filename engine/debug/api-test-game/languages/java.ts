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
        tr.call("setRotation", alvo, v3(0, 90, 0));
        checar("setRotation", aprox(numero(tr.call("rotation", alvo), "y"), 90, 0.01));
        tr.call("rotate", alvo, v3(0, 45, 0));
        double girado = api("math.scalar").call("wrapAngle", tr.call("rotation", alvo).get("y")).asDouble();
        checar("rotate", aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), girado);
        tr.call("setScale", alvo, 2);
        checar("setScale", aprox(numero(tr.call("scale", alvo), "x"), 2, 1e-6));
        tr.call("setScale", alvo, v3(1, 1, 1));
        Vec3 mundo = tr.call("worldPosition", alvo).asVec3();
        checar("worldPosition", eq3(tr.call("position", alvo), mundo.x, mundo.y, mundo.z, 1e-3));
        checar("forward/up", aprox(comprimento(tr.call("forward", alvo)), 1, 1e-3) && aprox(comprimento(tr.call("up", alvo)), 1, 1e-3));
        tr.call("lookAt", alvo, v3(0, 1.5, 0));
        checar("distance", tr.call("distance", alvo, v3(2, 1.5, -6)).asDouble() < 0.01);
        checar("directionTo", aprox(comprimento(tr.call("directionTo", alvo, v3(0, 1.5, 0))), 1, 1e-3));
        Value limites = tr.call("bounds", alvo);
        checar("bounds", !limites.isNullish() && numero(limites.get("max"), "y") > numero(limites.get("min"), "y"));
        checar("worldMatrix", tr.call("worldMatrix", alvo).length() == 16 && tr.call("localMatrix", alvo).length() == 16);
        Value local = tr.call("worldToLocal", alvo, tr.call("localToWorld", alvo, v3(1, 0, 0)));
        checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3));
        return null;
    }

    private Object malhas() {
        Value me = api("mesh"), s = api("scene"), csg = api("csg"), mat = api("material");
        Value caixa = me.call("box", 1, 1, 1);
        double triangulos = me.call("triangleCount", caixa).asDouble();
        checar("mesh.box", me.call("vertexCount", caixa).asDouble() > 0 && triangulos == 12, triangulos);
        Value esfera = me.call("sphere", 0.65, 16, 12);
        Value furado = csg.call("boolean", caixa, esfera, "subtract");
        checar("csg.boolean", me.call("triangleCount", furado).asDouble() > 12);
        Value ator = s.call("spawn", "mesh", obj(
            "name", "CaixaFurada",
            "mesh", furado,
            "material", mat.call("create", obj("baseColor", "#e63946", "roughness", 0.4, "metallic", 0.2)),
            "position", v3(4, 0.5, 2)
        ));
        checar("spawn malha CSG", !ator.get("mesh").isNullish());
        checar("csg.operations", contem(csg.call("operations"), "union"));
        Value tri = me.call("create", obj(
            "name", "Triangulo",
            "positions", new double[] {-1, 0, 0, 1, 0, 0, 0, 1.5, 0},
            "uvs", new double[] {0, 0, 1, 0, 0.5, 1},
            "indices", new int[] {0, 1, 2}
        ));
        me.call("computeNormals", tri);
        checar("mesh.create + computeBounds", numero(me.call("computeBounds", tri).get("max"), "y") >= 1.5);
        Value dupla = me.call("merge", tri, me.call("flipWinding", me.call("clone", tri)));
        checar("mesh.merge", me.call("triangleCount", dupla).asDouble() == 2);
        s.call("spawn", "mesh", obj(
            "name", "Triangulo",
            "mesh", dupla,
            "material", mat.call("create", obj("baseColor", "#06d6a0", "doubleSided", true)),
            "position", v3(7, 0, -2)
        ));
        Value grande = me.call("scale", me.call("translate", me.call("clone", caixa), v3(0, 0.5, 0)), 2);
        checar("mesh.translate/scale", numero(me.call("computeBounds", grande).get("max"), "y") > 1.9);
        Value distancia = me.call("raycast", api("math.ray").call("create", v3(0, 5, 0), v3(0, -1, 0)), grande);
        checar("mesh.raycast", distancia.isNumber() && distancia.asDouble() > 0);
        int vertices = me.call("vertexCount", caixa).asInt();
        checar("positions/indices", me.call("positions", caixa).length() == vertices * 3 && me.call("indices", caixa).length() == 36);
        checar("primitivas extras", me.call("triangleCount", me.call("torusKnot")).asDouble() > 0 && me.call("triangleCount", me.call("capsule")).asDouble() > 0);
        return null;
    }

                                                                                                  

    private Object materiais() {
        Value mat = api("material"), s = api("scene"), tex = api("texture");
        Value base = mat.call("create", obj("name", "DebugBase", "baseColor", "#d98c2b", "roughness", 0.5, "metallic", 0.1));
        checar("material.create", numero(base, "roughness") == 0.5);
        Value copia = mat.call("clone", base);
        mat.call("set", copia, obj("roughness", 1, "emissive", "#ffffff", "emissiveIntensity", 2));
        checar("material.clone/set", numero(copia, "roughness") == 1 && numero(base, "roughness") == 0.5);
        Value caixa = s.call("spawnPrimitive", "box", obj("name", "CaixaPintada", "position", v3(-7, 0.5, 2)));
        mat.call("assign", caixa, base);
        checar("material.assign/of", !mat.call("of", caixa).isNullish());
        mat.call("own", caixa);
        mat.call("setColor", caixa, "#d98c2b");
        Value desenho = tex.call("canvas", 64, 64);
        desenho.call("update");
        mat.call("setTexture", caixa, "baseColorMap", desenho.get("texture"));
        checar("texture.canvas + setTexture", mat.call("hasAnyTexture", mat.call("of", caixa)).asBoolean() && tex.call("isTexture", desenho.get("texture")).asBoolean());
        checar("material.slots", mat.call("slots").length() > 0);
        checar("materials.list", api("materials").call("list").isArray());
        Value sombreado = mat.call("fromShader", "DebugSuperficie", obj("glow", v3(1, 0.45, 0.1), "speed", 2));
        checar("material.fromShader", !sombreado.isNullish());
        if (!sombreado.isNullish()) {
            Value esfera = s.call("spawnPrimitive", "sphere", obj("name", "EsferaShader", "position", v3(0, 1, -3), "scale", 1.4));
            mat.call("assign", esfera, sombreado);
            mat.call("uniforms", esfera).call("set", "speed", 3);
            checar("material.uniforms.list", mat.call("uniforms", esfera).call("list").length() >= 1);
        }
        return null;
    }

    private Object luzes() {
        Value l = api("light");
        checar("light.types", contem(l.call("types"), "point") && contem(l.call("localTypes"), "spot"));
        Value lampada = l.call("spawn", "point", obj("name", "Lampada", "position", v3(0, 3, 0), "color", "#ffd166", "intensity", 60, "range", 14));
        checar("light.spawn", !lampada.get("light").isNullish() && textoIgual(lampada.path("light.type"), "point"));
        l.call("set", lampada, obj("intensity", 80));
        checar("light.set", numero(lampada.get("light"), "intensity") == 80);
        l.call("setTemperature", lampada, 3200);
        checar("setTemperature", numero(lampada.get("light"), "temperature") == 3200);
        Value foco = l.call("spawn", "spot", obj(
            "name", "Holofote", "position", v3(4, 4, 0), "rotation", v3(-90, 0, 0), "intensity", 120, "range", 16,
            "innerAngle", 20, "outerAngle", 35, "color", "#ffffff"
        ));
        checar("spot", textoIgual(foco.path("light.type"), "spot"));
        Value convertido = l.call("convert", foco, "disc");
        checar("light.convert", textoIgual(convertido.get("type"), "disc") && textoIgual(foco.path("light.type"), "disc"));
        l.call("convert", foco, "spot");
        Value presets = l.call("presets");
        checar("light.presets", presets.length() > 0);
        if (presets.length() > 0) {
            Value primeiro = presets.get(0);
            Value preset = l.call("spawn", primeiro.get("id"), obj("name", "LuzPreset", "position", v3(-4, 2.5, 4)));
            checar("light.fromPreset", !preset.get("light").isNullish() && l.call("fromPreset", primeiro.get("id")).get("type").equals(primeiro.get("type")));
        }
        checar("light.all", l.call("all", obj("local", true)).length() >= 2);
        checar("effectiveRange", l.call("effectiveRange", lampada).asDouble() > 0);
        checar("light.isLocal", verdadeiro(l.call("isLocal", lampada)));
        checar("temperatureToColor", !l.call("temperatureToColor", 6500).isNullish());
        l.call("setColor", lampada, "#ffffff");
        checar("light.setColor", eq3(lampada.path("light.color"), 1, 1, 1, 0.01));
        return null;
    }

    private Object ceu() {
        Value sky = api("sky"), mundo = api("world");
        sky.call("set", obj("timeOfDay", 10.5, "haze", 0.3, "clouds", obj("enabled", true, "coverage", 0.45)));
        checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(sky.path("clouds.enabled")));
        checar("sky.isDay", verdadeiro(sky.get("isDay")));
        checar("sky.sunDirection", numero(sky.call("sunDirection"), "y") > 0);
        String hora = sky.call("formatTimeOfDay", 10.5).asString();
        checar("sky.formatTimeOfDay", hora.contains(":"), hora);
        checar("sky.wrapTimeOfDay", sky.call("wrapTimeOfDay", 25).asDouble() == 1);
        checar("sky.presets", sky.call("presets").length() > 0);
        assinar(sky.call("onHourChanged", (Fn1) h -> {
            info("Hora do céu: " + h.asString());
            return null;
        }));
        sky.set("cycleSpeed", 0);
        checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0);
        checar("world.gravity", numero(mundo.get("gravity"), "y") < 0);
        mundo.get("wind").call("set", obj("speed", 2, "direction", 45));
        checar("world.wind.set", numero(mundo.get("wind"), "speed") == 2);
        return null;
    }

    private Object camera() {
        Value c = api("camera");
        checar("camera.fov", numero(c, "fov") > 0 && numero(c, "aspect") > 0);
        checar("camera.near/far", numero(c, "near") > 0 && numero(c, "far") > numero(c, "near"));
        Value viewport = c.get("viewport");
        checar("viewport", numero(viewport, "width") > 0);
        Value naTela = c.call("worldToScreen", v3(0, 0, 0));
        checar("worldToScreen", naTela.isNullish() || naTela.get("x").isNumber());
        Value raio = c.call("screenToRay", numero(viewport, "width") / 2, numero(viewport, "height") / 2);
        checar("screenToRay", raio.isNullish() || aprox(comprimento(raio.get("direction")), 1, 0.01));
        checar("viewMatrix", c.get("viewMatrix").length() == 16);
        Value jogador = c.get("player");
        jogador.call("set", obj("distance", 7, "pitch", 18));
        checar("player.set", numero(jogador.get("settings"), "distance") == 7);
        checar("distanceTo", c.call("distanceTo", v3(0, 0, 0)).asDouble() >= 0);
        checar("camera.position", !c.get("position").isNullish() && !c.get("forward").isNullish());
        assinar(c.call("onMainChanged", (Fn1) entidade -> {
            info(entidade.isNullish() ? "Câmera principal: editor/jogador" : "Câmera principal: " + nomeDe(entidade));
            return null;
        }));
        return null;
    }

    private Object pos() {
        Value p = api("post");
        checar("post.toneMappers", p.call("toneMappers").length() > 0);
        p.call("set", obj(
            "bloom", obj("enabled", true, "intensity", 0.5, "threshold", 1, "softKnee", 0.5, "radius", 0.6),
            "vignette", obj("enabled", true, "intensity", 0.35, "smoothness", 0.5, "roundness", 1)
        ));
        checar("post.set", verdadeiro(p.path("bloom.enabled")) && verdadeiro(p.path("vignette.enabled")));
        p.set("exposure", 1.05);
        checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3));
        p.set("toneMapper", "agx");
        checar("post.toneMapper", textoIgual(p.get("toneMapper"), "agx"));
        checar("post.presets", p.call("presets").length() > 0);
        Value custom = p.get("custom");
        Value novo = custom.call("add", obj("fragment", "DebugPost", "name", "DebugPost", "uniforms", obj("tint", v3(0.15, 0.05, 0.3), "strength", 0.6)));
        efeito = novo;
        checar("post.custom.add", !novo.isNullish() && !custom.call("get", "DebugPost").isNullish());
        novo.get("uniforms").call("set", "strength", 0.8);
        checar("efeito.uniforms.list", novo.get("uniforms").call("list").length() >= 2);
        return null;
    }

    private Object render() {
        Value r = api("render");
        checar("render.passNames", r.call("passNames").length() > 0);
        checar("render.stats", r.path("stats.drawCalls").isNumber());
        checar("render.frame", r.path("frame.width").isNumber());
        assinar(r.call("onAfterFrame", (Fn0) () -> {
            renders++;
            return null;
        }));
        r.set("showGrid", false);
        checar("render.showGrid", falso(r.get("showGrid")));
        checar("render.pixelRatio", numero(r, "pixelRatio") > 0);
        return null;
    }

                                                                                               

    private Object fisica() {
        Value ph = api("physics"), s = api("scene");
        checar("physics.enabled", verdadeiro(ph.get("enabled")));
        checar("physics.gravity", numero(ph.get("gravity"), "y") < 0);
        checar("physics.settings", numero(ph.get("settings"), "fixedTimestep") > 0);
        for (int i = 1; i <= 5; i++) {
            double indice = i - 1;
            Value caixa = s.call("spawnPrimitive", "box", obj(
                "name", "Caixa" + i,
                "position", v3(-2 + indice * 1.1, 3 + indice * 1.2, 3),
                "rigidBody", obj("type", "dynamic", "collider", "box", "mass", 2, "restitution", 0.3),
                "tags", Helix.array("caixa")
            ));
            api("material").call("setColor", caixa, api("math.color").call("hsl", 30 + i * 12, 0.7, 0.5));
        }
        Value caixas = s.call("byTag", "caixa");
        Value primeira = caixas.get(0);
        checar("caixas dinâmicas", caixas.length() == 5 && ph.call("hasBody", primeira).asBoolean());
        Value corpo = ph.call("bodyOf", primeira);
        checar("bodyOf", verdadeiro(corpo.get("isDynamic")) && numero(corpo, "mass") > 0);
        corpo.call("applyImpulse", v3(0, 2, 0));
        corpo.call("applyTorque", v3(0, 1, 0));
        corpo.call("setMaterial", obj("friction", 0.8));
        corpo.call("wake");
        checar("body.linearVelocity", !corpo.get("linearVelocity").isNullish());
        checar("bodies()", ph.call("bodies").length() >= 6);
        Value hit = ph.call("raycast", v3(0, 5, 0), v3(0, -1, 0), 20);
        checar("physics.raycast", !hit.isNullish() && !hit.get("entity").isNullish());
        checar("raycastAll", ph.call("raycastAll", v3(0, 5, 0), v3(0, -1, 0), 20).length() >= 1);
        checar("overlapSphere", ph.call("overlapSphere", v3(0, 3, 3), 4).isArray());
        checar("massProperties", numero(ph.call("massProperties", primeira), "mass") > 0);
        checar("colliderVolume", ph.call("colliderVolume", primeira).asDouble() > 0);
        Value formas = ph.get("shapes");
        checar("shapes.sphere volume", aprox(formas.call("volume", formas.call("sphere", 1)).asDouble(), 4.18879, 0.01));
        assinar(ph.call("onCollisionBegin", (Fn1) e -> {
            colisoes++;
            if (colisoes <= 3) info("Colisão: " + nomeDe(e.get("a")) + " × " + nomeDe(e.get("b")) + " (impulso " + arred(numero(e.get("contact"), "impulse")) + ")");
            return null;
        }));
        assinar(ph.call("onOutOfBounds", (Fn1) entidade -> {
            aviso(nomeDe(entidade) + " caiu do mundo");
            return null;
        }));
        Value gatilho = s.call("spawn", "group", obj("name", "Gatilho", "position", v3(0, 1, 3), "trigger", obj("shape", "box", "size", v3(3, 2, 3))));
        checar("trigger spawn", !gatilho.isNullish() && s.call("isAttached", gatilho).asBoolean());
        checar("physics.stats", ph.path("stats.bodies").isNumber());
        return null;
    }

    private Object personagem() {
        Value ch = api("character"), pl = api("player");
        Value novo = ch.call("spawn", obj("name", "Heroi", "position", v3(0, 1.2, 8), "character", obj("walkSpeed", 4, "runSpeed", 7, "jumpHeight", 1.4)));
        heroi = novo;
        checar("character.spawn", !novo.get("character").isNullish() && ch.call("has", novo).asBoolean());
        Value c = ch.call("of", novo);
        checar("character.of", c.get("isGrounded").isBoolean());
        checar("settingsOf", numero(ch.call("settingsOf", novo), "walkSpeed") == 4);
        pl.call("possess", novo);
        checar("player.possess", pl.get("possessed").equals(novo) && verdadeiro(pl.get("isPossessing")));
        assinar(ch.call("onJumped", (Fn1) e -> {
            info(nomeDe(e.get("entity")) + " pulou");
            return null;
        }));
        assinar(pl.call("onPossessed", (Fn1) entidade -> {
            info("Possuindo " + nomeDe(entidade));
            return null;
        }));
        checar("character.all", ch.call("all").length() >= 1);
`;
}
