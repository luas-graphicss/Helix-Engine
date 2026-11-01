import type { GameSources } from '../types';
export function swiftGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        

final class DebugJogo: Script {
    private let linguagem = "Swift"

    private var quadros = 0
    private var passosFisica = 0
    private var lateUpdates = 0
    private var renders = 0
    private var colisoes = 0
    private var checagens = 0
    private var falhas = 0
    private var pontos = 0
    private var hudTimer = 0.0
                                                                           
    private var torus: Value?
    private var heroi: Value?
    private var efeito: Value?
    private var tela: Value?
    private var assinaturas: [Value] = []

                                                                                             
    private struct Area {
        let nome: String
        let rodar: () -> Value
        var esperaErro = false
    }

                                                                                              

    private func api(_ caminho: String) -> Value { helix.path(caminho) }
    private func v3(_ x: Double, _ y: Double, _ z: Double) -> Vec3 { Vec3(x, y, z) }
    private func obj(_ campos: [String: ValueConvertible]) -> Value { Value.object(campos) }
    private func lista(_ itens: [ValueConvertible]) -> Value { Value.list(itens) }
    private func arg(_ args: [Value], _ indice: Int) -> Value { indice < args.count ? args[indice] : Value.undefined }

    private func registrar(_ metodo: String, _ mensagem: String) {
        api("log").invoke(metodo, "Debug", mensagem)
    }

    private func info(_ mensagem: String) { registrar("info", mensagem) }
    private func aviso(_ mensagem: String) { registrar("warn", mensagem) }
    private func erro(_ mensagem: String) { registrar("error", mensagem) }
    private func depurar(_ mensagem: String) { registrar("debug", mensagem) }

    private func checar(_ nome: String, _ condicao: Bool, _ detalhe: Any? = nil) {
        checagens += 1
        if condicao { return }
        falhas += 1
        if let detalhe {
            erro("FALHOU \(nome): \(String(describing: detalhe))")
        } else {
            erro("FALHOU \(nome)")
        }
    }

    private func assinar(_ desligar: Value) {
        if desligar.isFunction { assinaturas.append(desligar) }
    }

    private func verdadeiro(_ v: Value) -> Bool { v.isBool && v.bool }
    private func falso(_ v: Value) -> Bool { v.isBool && !v.bool }
    private func aprox(_ a: Double, _ b: Double, _ epsilon: Double) -> Bool { abs(a - b) <= epsilon }
    private func arred(_ x: Double) -> Double { (x * 100).rounded() / 100 }
    private func numero(_ o: Value, _ chave: String) -> Double { o[chave].number }
    private func textoIgual(_ v: Value, _ esperado: String) -> Bool { v.isString && v.string == esperado }

                                                                                             
    private func eq3(_ vetor: Value, _ x: Double, _ y: Double, _ z: Double, _ epsilon: Double) -> Bool {
        api("math.vec3").invoke("equals", vetor, v3(x, y, z), epsilon).bool
    }

    private func comprimento(_ vetor: Value) -> Double { api("math.vec3").invoke("length", vetor).number }
    private func contem(_ lista: Value, _ texto: String) -> Bool { lista.array.contains { $0.string == texto } }
    private func nomeDe(_ entidade: Value) -> String { entidade.isNone ? "ninguém" : entidade["name"].string }

                                                                                               

    private func nucleo() -> Value {
        let engine = api("engine")
        let nome = engine["name"]
        let contexto = helix["context"].string
        checar("engine.name", nome.isString && nome.string != "")
        checar("engine.version", engine["version"].isString)
        checar("context", contexto == "shared" || contexto == "client" || contexto == "server", contexto)
        checar("isPlaying", verdadeiro(helix["isPlaying"]))
        checar("isEditor", falso(helix["isEditor"]))
        checar("self no script de entrada", entity.isNone && helix["self"].isNone)
        checar("script é o handle do script", script.isObject)
        checar("Helix.now", Helix.now() >= 0)
        info("\(nome.string) \(engine["version"].string) · API \(engine["apiVersion"].string) · \(linguagem)")
        Helix.log("Helix.log direto do Swift (console da engine)")
        return Value.undefined
    }

    private func modulo() -> Value {
        let util = Helix.require("DebugUtil")
        checar("require devolve as funções", util.isObject && util["soma"].isFunction)
        let resultado = util.invoke("soma", 2, 3).number
        checar("require soma", resultado == 5, resultado)
        checar("require saudacao", textoIgual(util.invoke("saudacao", "Helix"), "Olá, Helix"))
        checar("require limitar", util.invoke("limitar", 15, 0, 10).number == 10)
        return Value.undefined
    }

    private func matematica() -> Value {
        let m = api("math")
        let vec = m["vec3"]
        let quat = m["quat"]
        let mat4 = m["mat4"]
        let escalar = m["scalar"]
        checar("vec3.add", eq3(vec.invoke("add", v3(1, 2, 3), v3(1, 1, 1)), 2, 3, 4, 1e-6))
        checar("vec3.length", aprox(vec.invoke("length", v3(3, 4, 0)).number, 5, 1e-3))
        checar("vec3.normalize", aprox(comprimento(vec.invoke("normalize", v3(0, 5, 0))), 1, 1e-3))
        checar("vec3.cross", eq3(vec.invoke("cross", v3(1, 0, 0), v3(0, 1, 0)), 0, 0, 1, 1e-6))
        checar("vec3.lerp", eq3(vec.invoke("lerp", v3(0, 0, 0), v3(2, 2, 2), 0.5), 1, 1, 1, 1e-6))
        let q = quat.invoke("fromEuler", v3(0, 90, 0))
        checar("quat.rotateVec3", eq3(quat.invoke("rotateVec3", q, v3(1, 0, 0)), 0, 0, -1, 1e-3))
        checar("quat.toEuler", aprox(numero(quat.invoke("toEuler", q), "y"), 90, 0.01))
        let mat = mat4.invoke("fromTRS", v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1))
        checar("mat4.transformPoint", eq3(mat4.invoke("transformPoint", mat, v3(0, 0, 0)), 1, 2, 3, 1e-6))
        checar("mat4.invert", !mat4.invoke("invert", mat).isNone)
        let aabb = m["aabb"]
        let caixa = aabb.invoke("fromCenterSize", v3(0, 0, 0), v3(2, 2, 2))
        checar("aabb.contains", aabb.invoke("contains", caixa, v3(0.5, 0.5, 0.5)).bool && !aabb.invoke("contains", caixa, v3(2, 0, 0)).bool)
        let ray = m["ray"]
        let raio = ray.invoke("create", v3(0, 5, 0), v3(0, -1, 0))
        checar("ray.intersectAabb", !ray.invoke("intersectAabb", raio, caixa).isNone)
        checar("scalar.remap", escalar.invoke("remap", 5, 0, 10, 0, 100).number == 50)
        checar("clamp/lerp", m.invoke("clamp", 15, 0, 10).number == 10 && m.invoke("lerp", 0, 10, 0.5).number == 5)
        checar("scalar.wrapAngle", aprox(escalar.invoke("wrapAngle", 370).number, 10, 1e-3))
        checar("degToRad", aprox(m.invoke("degToRad", 180).number, Double.pi, 1e-6))
        let ruido = m["noise"]
        let perlin = ruido.invoke("perlin2", 0.3, 0.7).number
        checar("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, perlin)
        checar("noise.fbm", ruido.invoke("fbm", 1.5, 2.5, 0, 4).isNumber)
        let cor = m["color"]
        checar("color.hexToVec3", eq3(cor.invoke("hexToVec3", "#ff0000"), 1, 0, 0, 0.01))
        let hex = cor.invoke("vec3ToHex", v3(1, 1, 1)).string
        checar("color.vec3ToHex", hex.lowercased() == "#ffffff", hex)
        let random = m["random"]
        random.invoke("seed", 42)
        let primeiro = random.invoke("value").number
        random.invoke("seed", 42)
        checar("random.seed determinístico", random.invoke("value").number == primeiro)
        let sorteado = random.invoke("int", 1, 6).number
        checar("random.int", sorteado >= 1 && sorteado <= 6 && sorteado.rounded(.down) == sorteado)
        checar("random.unitVector", aprox(comprimento(random.invoke("unitVector")), 1, 1e-3))
        checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI") * 2, 1e-9))
        return Value.undefined
    }

                                                                                                

    private func cena() -> Value {
        let s = api("scene")
        let mat = api("material")
        let raiz = s["root"]
        checar("scene.root", !raiz.isNone && raiz["children"].isArray)
        let antes = s.invoke("count").number
        let grupo = s.invoke("spawn", "group", obj(["name": "DebugCenario"]))
        let chao = s.invoke("spawn", "mesh", obj([
            "name": "Chao",
            "mesh": api("mesh").invoke("plane", 40, 40),
            "material": mat.invoke("create", obj(["baseColor": "#4b6b3a", "roughness": 0.95])),
            "rigidBody": obj(["type": "static", "collider": "box", "boxSize": v3(40, 0.2, 40), "center": v3(0, -0.1, 0)]),
            "receiveShadows": true,
            "tags": lista(["chao"]),
        ]), grupo)
        checar("spawn mesh", textoIgual(chao["kind"], "mesh") && !chao["mesh"].isNone && !chao["rigidBody"].isNone)
        checar("find", s.invoke("find", "Chao") == chao)
        checar("findAll", s.invoke("findAll", "Chao").count == 1)
        checar("byId", s.invoke("byId", chao["id"]) == chao)
        checar("byTag", s.invoke("byTag", "chao").count >= 1)
        checar("byKind", s.invoke("byKind", "mesh").count >= 1)
        let depois = s.invoke("count").number
        checar("count", depois == antes + 2, "\(depois) vs \(antes + 2)")
        checar("contains", s.invoke("contains", grupo, chao).bool && s.invoke("contains", raiz, chao).bool)
        let caminho = s.invoke("path", chao).string
        checar("path", caminho.contains("Chao"), caminho)
        var visitados = 0
        s.invoke("traverse", Value.function { _ in visitados += 1; return Value.undefined }, grupo)
        checar("traverse", visitados >= 2, visitados)

        let anel = s.invoke("spawnPrimitive", "torus", obj(["name": "Anel", "position": v3(-4, 1.2, -2), "scale": 1.5]), grupo)
        mat.invoke("setColor", anel, "#3a86ff")
        mat.invoke("setEmissive", anel, "#3a86ff", 0.6)
        torus = anel
        checar("spawnPrimitive", !anel["mesh"].isNone && !anel["material"].isNone)

        let copia = s.invoke("clone", anel, true, grupo)
        s.invoke("rename", copia, "AnelCopia")
        api("transform").invoke("setPosition", copia, v3(-4, 1.2, 2))
        checar("clone + rename", textoIgual(copia["name"], "AnelCopia") && s.invoke("find", "AnelCopia") == copia)
        s.invoke("setMeta", copia, "origem", "clone")
        checar("meta", textoIgual(s.invoke("getMeta", copia, "origem"), "clone"))
        s.invoke("addTag", copia, "temporario")
        checar("addTag/hasTag", s.invoke("hasTag", copia, "temporario").bool)
        checar("removeTag", verdadeiro(s.invoke("removeTag", copia, "temporario")) && !s.invoke("hasTag", copia, "temporario").bool)
        s.invoke("setVisible", copia, false)
        checar("setVisible", falso(copia["visible"]))
        s.invoke("setVisible", copia, true)
        s.invoke("destroy", copia)
        checar("destroy", s.invoke("find", "AnelCopia").isNone && !s.invoke("isAttached", copia).bool)

        let esfera = s.invoke("spawnPrimitive", "sphere", obj(["name": "Esfera", "position": v3(4, 0.5, -3)]))
        s.invoke("reparent", esfera, grupo)
        checar("reparent", esfera["parent"] == grupo)
        mat.invoke("setColor", esfera, "#ffbe0b")
        s.invoke("addComponent", esfera, "rigidBody", obj(["type": "dynamic", "collider": "sphere", "radius": 0.5, "mass": 1]))
        checar("addComponent", !esfera["rigidBody"].isNone && textoIgual(esfera.path("rigidBody.type"), "dynamic"))
        let temporario = s.invoke("spawnPrimitive", "box", obj(["name": "Temporario"]))
        s.invoke("addComponent", temporario, "csg", Value.object())
        checar("addComponent csg", !temporario["csg"].isNone)
        s.invoke("removeComponent", temporario, "csg")
        checar("removeComponent", temporario["csg"].isNone)
        s.invoke("destroy", temporario)
        checar("kinds/components", contem(s.invoke("kinds"), "mesh") && contem(s.invoke("components"), "rigidBody"))
        return Value.undefined
    }

    private func transformacao() -> Value {
        let tr = api("transform")
        let s = api("scene")
        let alvo = s.invoke("spawnPrimitive", "cone", obj(["name": "Cone", "position": v3(0, 0.5, -6)]))
        api("material").invoke("setColor", alvo, "#8338ec")
        tr.invoke("setPosition", alvo, v3(2, 0.5, -6))
        checar("setPosition", eq3(tr.invoke("position", alvo), 2, 0.5, -6, 1e-6))
        tr.invoke("translate", alvo, v3(0, 1, 0), "world")
        checar("translate", aprox(numero(tr.invoke("position", alvo), "y"), 1.5, 1e-3))
        tr.invoke("setRotation", alvo, v3(0, 90, 0))
        checar("setRotation", aprox(numero(tr.invoke("rotation", alvo), "y"), 90, 0.01))
        tr.invoke("rotate", alvo, v3(0, 45, 0))
        let girado = api("math.scalar").invoke("wrapAngle", tr.invoke("rotation", alvo)["y"]).number
        checar("rotate", aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), girado)
        tr.invoke("setScale", alvo, 2)
        checar("setScale", aprox(numero(tr.invoke("scale", alvo), "x"), 2, 1e-6))
        tr.invoke("setScale", alvo, v3(1, 1, 1))
        let mundo = tr.invoke("worldPosition", alvo).vec3
        checar("worldPosition", eq3(tr.invoke("position", alvo), mundo.x, mundo.y, mundo.z, 1e-3))
        checar("forward/up", aprox(comprimento(tr.invoke("forward", alvo)), 1, 1e-3) && aprox(comprimento(tr.invoke("up", alvo)), 1, 1e-3))
        tr.invoke("lookAt", alvo, v3(0, 1.5, 0))
        checar("distance", tr.invoke("distance", alvo, v3(2, 1.5, -6)).number < 0.01)
        checar("directionTo", aprox(comprimento(tr.invoke("directionTo", alvo, v3(0, 1.5, 0))), 1, 1e-3))
        let limites = tr.invoke("bounds", alvo)
        checar("bounds", !limites.isNone && numero(limites["max"], "y") > numero(limites["min"], "y"))
        checar("worldMatrix", tr.invoke("worldMatrix", alvo).count == 16 && tr.invoke("localMatrix", alvo).count == 16)
        let local = tr.invoke("worldToLocal", alvo, tr.invoke("localToWorld", alvo, v3(1, 0, 0)))
        checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3))
        return Value.undefined
    }

    private func malhas() -> Value {
        let me = api("mesh")
        let s = api("scene")
        let csg = api("csg")
        let mat = api("material")
        let caixa = me.invoke("box", 1, 1, 1)
        let triangulos = me.invoke("triangleCount", caixa).number
        checar("mesh.box", me.invoke("vertexCount", caixa).number > 0 && triangulos == 12, triangulos)
        let esfera = me.invoke("sphere", 0.65, 16, 12)
        let furado = csg.invoke("boolean", caixa, esfera, "subtract")
        checar("csg.boolean", me.invoke("triangleCount", furado).number > 12)
        let ator = s.invoke("spawn", "mesh", obj([
            "name": "CaixaFurada",
            "mesh": furado,
            "material": mat.invoke("create", obj(["baseColor": "#e63946", "roughness": 0.4, "metallic": 0.2])),
            "position": v3(4, 0.5, 2),
        ]))
        checar("spawn malha CSG", !ator["mesh"].isNone)
        checar("csg.operations", contem(csg.invoke("operations"), "union"))
        let tri = me.invoke("create", obj([
            "name": "Triangulo",
            "positions": lista([-1, 0, 0, 1, 0, 0, 0, 1.5, 0]),
            "uvs": lista([0, 0, 1, 0, 0.5, 1]),
            "indices": lista([0, 1, 2]),
        ]))
        me.invoke("computeNormals", tri)
`;
}
