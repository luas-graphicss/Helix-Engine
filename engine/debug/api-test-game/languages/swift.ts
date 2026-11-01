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
        checar("mesh.create + computeBounds", numero(me.invoke("computeBounds", tri)["max"], "y") >= 1.5)
        let dupla = me.invoke("merge", tri, me.invoke("flipWinding", me.invoke("clone", tri)))
        checar("mesh.merge", me.invoke("triangleCount", dupla).number == 2)
        s.invoke("spawn", "mesh", obj([
            "name": "Triangulo",
            "mesh": dupla,
            "material": mat.invoke("create", obj(["baseColor": "#06d6a0", "doubleSided": true])),
            "position": v3(7, 0, -2),
        ]))
        let grande = me.invoke("scale", me.invoke("translate", me.invoke("clone", caixa), v3(0, 0.5, 0)), 2)
        checar("mesh.translate/scale", numero(me.invoke("computeBounds", grande)["max"], "y") > 1.9)
        let distancia = me.invoke("raycast", api("math.ray").invoke("create", v3(0, 5, 0), v3(0, -1, 0)), grande)
        checar("mesh.raycast", distancia.isNumber && distancia.number > 0)
        let vertices = me.invoke("vertexCount", caixa).int
        checar("positions/indices", me.invoke("positions", caixa).count == vertices * 3 && me.invoke("indices", caixa).count == 36)
        checar("primitivas extras", me.invoke("triangleCount", me.invoke("torusKnot")).number > 0 && me.invoke("triangleCount", me.invoke("capsule")).number > 0)
        return Value.undefined
    }

                                                                                                  

    private func materiais() -> Value {
        let mat = api("material")
        let s = api("scene")
        let tex = api("texture")
        let base = mat.invoke("create", obj(["name": "DebugBase", "baseColor": "#d98c2b", "roughness": 0.5, "metallic": 0.1]))
        checar("material.create", numero(base, "roughness") == 0.5)
        let copia = mat.invoke("clone", base)
        mat.invoke("set", copia, obj(["roughness": 1, "emissive": "#ffffff", "emissiveIntensity": 2]))
        checar("material.clone/set", numero(copia, "roughness") == 1 && numero(base, "roughness") == 0.5)
        let caixa = s.invoke("spawnPrimitive", "box", obj(["name": "CaixaPintada", "position": v3(-7, 0.5, 2)]))
        mat.invoke("assign", caixa, base)
        checar("material.assign/of", !mat.invoke("of", caixa).isNone)
        mat.invoke("own", caixa)
        mat.invoke("setColor", caixa, "#d98c2b")
        let desenho = tex.invoke("canvas", 64, 64)
        desenho.invoke("update")
        mat.invoke("setTexture", caixa, "baseColorMap", desenho["texture"])
        checar("texture.canvas + setTexture", mat.invoke("hasAnyTexture", mat.invoke("of", caixa)).bool && tex.invoke("isTexture", desenho["texture"]).bool)
        checar("material.slots", mat.invoke("slots").count > 0)
        checar("materials.list", api("materials").invoke("list").isArray)
        let sombreado = mat.invoke("fromShader", "DebugSuperficie", obj(["glow": v3(1, 0.45, 0.1), "speed": 2]))
        checar("material.fromShader", !sombreado.isNone)
        if !sombreado.isNone {
            let esfera = s.invoke("spawnPrimitive", "sphere", obj(["name": "EsferaShader", "position": v3(0, 1, -3), "scale": 1.4]))
            mat.invoke("assign", esfera, sombreado)
            mat.invoke("uniforms", esfera).invoke("set", "speed", 3)
            checar("material.uniforms.list", mat.invoke("uniforms", esfera).invoke("list").count >= 1)
        }
        return Value.undefined
    }

    private func luzes() -> Value {
        let l = api("light")
        checar("light.types", contem(l.invoke("types"), "point") && contem(l.invoke("localTypes"), "spot"))
        let lampada = l.invoke("spawn", "point", obj(["name": "Lampada", "position": v3(0, 3, 0), "color": "#ffd166", "intensity": 60, "range": 14]))
        checar("light.spawn", !lampada["light"].isNone && textoIgual(lampada.path("light.type"), "point"))
        l.invoke("set", lampada, obj(["intensity": 80]))
        checar("light.set", numero(lampada["light"], "intensity") == 80)
        l.invoke("setTemperature", lampada, 3200)
        checar("setTemperature", numero(lampada["light"], "temperature") == 3200)
        let foco = l.invoke("spawn", "spot", obj([
            "name": "Holofote", "position": v3(4, 4, 0), "rotation": v3(-90, 0, 0), "intensity": 120, "range": 16,
            "innerAngle": 20, "outerAngle": 35, "color": "#ffffff",
        ]))
        checar("spot", textoIgual(foco.path("light.type"), "spot"))
        let convertido = l.invoke("convert", foco, "disc")
        checar("light.convert", textoIgual(convertido["type"], "disc") && textoIgual(foco.path("light.type"), "disc"))
        l.invoke("convert", foco, "spot")
        let presets = l.invoke("presets")
        checar("light.presets", presets.count > 0)
        if presets.count > 0 {
            let primeiro = presets[0]
            let preset = l.invoke("spawn", primeiro["id"], obj(["name": "LuzPreset", "position": v3(-4, 2.5, 4)]))
            checar("light.fromPreset", !preset["light"].isNone && l.invoke("fromPreset", primeiro["id"])["type"] == primeiro["type"])
        }
        checar("light.all", l.invoke("all", obj(["local": true])).count >= 2)
        checar("effectiveRange", l.invoke("effectiveRange", lampada).number > 0)
        checar("light.isLocal", verdadeiro(l.invoke("isLocal", lampada)))
        checar("temperatureToColor", !l.invoke("temperatureToColor", 6500).isNone)
        l.invoke("setColor", lampada, "#ffffff")
        checar("light.setColor", eq3(lampada.path("light.color"), 1, 1, 1, 0.01))
        return Value.undefined
    }

    private func ceu() -> Value {
        let sky = api("sky")
        let mundo = api("world")
        sky.invoke("set", obj(["timeOfDay": 10.5, "haze": 0.3, "clouds": obj(["enabled": true, "coverage": 0.45])]))
        checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(sky.path("clouds.enabled")))
        checar("sky.isDay", verdadeiro(sky["isDay"]))
        checar("sky.sunDirection", numero(sky.invoke("sunDirection"), "y") > 0)
        let hora = sky.invoke("formatTimeOfDay", 10.5).string
        checar("sky.formatTimeOfDay", hora.contains(":"), hora)
        checar("sky.wrapTimeOfDay", sky.invoke("wrapTimeOfDay", 25).number == 1)
        checar("sky.presets", sky.invoke("presets").count > 0)
        assinar(sky.invoke("onHourChanged", Value.function { [self] args in info("Hora do céu: \(arg(args, 0).string)"); return Value.undefined }))
        sky["cycleSpeed"] = 0
        checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0)
        checar("world.gravity", numero(mundo["gravity"], "y") < 0)
        mundo["wind"].invoke("set", obj(["speed": 2, "direction": 45]))
        checar("world.wind.set", numero(mundo["wind"], "speed") == 2)
        return Value.undefined
    }

    private func camera() -> Value {
        let c = api("camera")
        checar("camera.fov", numero(c, "fov") > 0 && numero(c, "aspect") > 0)
        checar("camera.near/far", numero(c, "near") > 0 && numero(c, "far") > numero(c, "near"))
        let viewport = c["viewport"]
        checar("viewport", numero(viewport, "width") > 0)
        let naTela = c.invoke("worldToScreen", v3(0, 0, 0))
        checar("worldToScreen", naTela.isNone || naTela["x"].isNumber)
        let raio = c.invoke("screenToRay", numero(viewport, "width") / 2, numero(viewport, "height") / 2)
        checar("screenToRay", raio.isNone || aprox(comprimento(raio["direction"]), 1, 0.01))
        checar("viewMatrix", c["viewMatrix"].count == 16)
        let jogador = c["player"]
        jogador.invoke("set", obj(["distance": 7, "pitch": 18]))
        checar("player.set", numero(jogador["settings"], "distance") == 7)
        checar("distanceTo", c.invoke("distanceTo", v3(0, 0, 0)).number >= 0)
        checar("camera.position", !c["position"].isNone && !c["forward"].isNone)
        assinar(c.invoke("onMainChanged", Value.function { [self] args in
            let entidade = arg(args, 0)
            info(entidade.isNone ? "Câmera principal: editor/jogador" : "Câmera principal: \(nomeDe(entidade))")
            return Value.undefined
        }))
        return Value.undefined
    }

    private func pos() -> Value {
        let p = api("post")
        checar("post.toneMappers", p.invoke("toneMappers").count > 0)
        p.invoke("set", obj([
            "bloom": obj(["enabled": true, "intensity": 0.5, "threshold": 1, "softKnee": 0.5, "radius": 0.6]),
            "vignette": obj(["enabled": true, "intensity": 0.35, "smoothness": 0.5, "roundness": 1]),
        ]))
        checar("post.set", verdadeiro(p.path("bloom.enabled")) && verdadeiro(p.path("vignette.enabled")))
        p["exposure"] = 1.05
        checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3))
        p["toneMapper"] = "agx"
        checar("post.toneMapper", textoIgual(p["toneMapper"], "agx"))
        checar("post.presets", p.invoke("presets").count > 0)
        let custom = p["custom"]
        let novo = custom.invoke("add", obj(["fragment": "DebugPost", "name": "DebugPost", "uniforms": obj(["tint": v3(0.15, 0.05, 0.3), "strength": 0.6])]))
        efeito = novo
        checar("post.custom.add", !novo.isNone && !custom.invoke("get", "DebugPost").isNone)
        novo["uniforms"].invoke("set", "strength", 0.8)
        checar("efeito.uniforms.list", novo["uniforms"].invoke("list").count >= 2)
        return Value.undefined
    }

    private func render() -> Value {
        let r = api("render")
        checar("render.passNames", r.invoke("passNames").count > 0)
        checar("render.stats", r.path("stats.drawCalls").isNumber)
        checar("render.frame", r.path("frame.width").isNumber)
        assinar(r.invoke("onAfterFrame", Value.function { [self] _ in renders += 1; return Value.undefined }))
        r["showGrid"] = false
        checar("render.showGrid", falso(r["showGrid"]))
        checar("render.pixelRatio", numero(r, "pixelRatio") > 0)
        return Value.undefined
    }

                                                                                               

    private func fisica() -> Value {
        let ph = api("physics")
        let s = api("scene")
        checar("physics.enabled", verdadeiro(ph["enabled"]))
        checar("physics.gravity", numero(ph["gravity"], "y") < 0)
        checar("physics.settings", numero(ph["settings"], "fixedTimestep") > 0)
        for i in 1...5 {
            let indice = Double(i - 1)
            let caixa = s.invoke("spawnPrimitive", "box", obj([
                "name": "Caixa\(i)",
                "position": v3(-2 + indice * 1.1, 3 + indice * 1.2, 3),
                "rigidBody": obj(["type": "dynamic", "collider": "box", "mass": 2, "restitution": 0.3]),
                "tags": lista(["caixa"]),
            ]))
            api("material").invoke("setColor", caixa, api("math.color").invoke("hsl", 30 + Double(i) * 12, 0.7, 0.5))
        }
        let caixas = s.invoke("byTag", "caixa")
        let primeira = caixas[0]
        checar("caixas dinâmicas", caixas.count == 5 && ph.invoke("hasBody", primeira).bool)
        let corpo = ph.invoke("bodyOf", primeira)
        checar("bodyOf", verdadeiro(corpo["isDynamic"]) && numero(corpo, "mass") > 0)
        corpo.invoke("applyImpulse", v3(0, 2, 0))
        corpo.invoke("applyTorque", v3(0, 1, 0))
        corpo.invoke("setMaterial", obj(["friction": 0.8]))
        corpo.invoke("wake")
        checar("body.linearVelocity", !corpo["linearVelocity"].isNone)
        checar("bodies()", ph.invoke("bodies").count >= 6)
        let hit = ph.invoke("raycast", v3(0, 5, 0), v3(0, -1, 0), 20)
        checar("physics.raycast", !hit.isNone && !hit["entity"].isNone)
        checar("raycastAll", ph.invoke("raycastAll", v3(0, 5, 0), v3(0, -1, 0), 20).count >= 1)
        checar("overlapSphere", ph.invoke("overlapSphere", v3(0, 3, 3), 4).isArray)
        checar("massProperties", numero(ph.invoke("massProperties", primeira), "mass") > 0)
        checar("colliderVolume", ph.invoke("colliderVolume", primeira).number > 0)
        let formas = ph["shapes"]
        checar("shapes.sphere volume", aprox(formas.invoke("volume", formas.invoke("sphere", 1)).number, 4.18879, 0.01))
        assinar(ph.invoke("onCollisionBegin", Value.function { [self] args in
            colisoes += 1
            if colisoes <= 3 {
                let e = arg(args, 0)
                info("Colisão: \(nomeDe(e["a"])) × \(nomeDe(e["b"])) (impulso \(arred(numero(e["contact"], "impulse"))))")
            }
            return Value.undefined
        }))
        assinar(ph.invoke("onOutOfBounds", Value.function { [self] args in aviso("\(nomeDe(arg(args, 0))) caiu do mundo"); return Value.undefined }))
        let gatilho = s.invoke("spawn", "group", obj(["name": "Gatilho", "position": v3(0, 1, 3), "trigger": obj(["shape": "box", "size": v3(3, 2, 3)])]))
        checar("trigger spawn", !gatilho.isNone && s.invoke("isAttached", gatilho).bool)
        checar("physics.stats", ph.path("stats.bodies").isNumber)
        return Value.undefined
    }

    private func personagem() -> Value {
        let ch = api("character")
        let pl = api("player")
        let novo = ch.invoke("spawn", obj(["name": "Heroi", "position": v3(0, 1.2, 8), "character": obj(["walkSpeed": 4, "runSpeed": 7, "jumpHeight": 1.4])]))
        heroi = novo
        checar("character.spawn", !novo["character"].isNone && ch.invoke("has", novo).bool)
        let c = ch.invoke("of", novo)
        checar("character.of", c["isGrounded"].isBool)
        checar("settingsOf", numero(ch.invoke("settingsOf", novo), "walkSpeed") == 4)
        pl.invoke("possess", novo)
        checar("player.possess", pl["possessed"] == novo && verdadeiro(pl["isPossessing"]))
        assinar(ch.invoke("onJumped", Value.function { [self] args in info("\(nomeDe(arg(args, 0)["entity"])) pulou"); return Value.undefined }))
        assinar(pl.invoke("onPossessed", Value.function { [self] args in info("Possuindo \(nomeDe(arg(args, 0)))"); return Value.undefined }))
        checar("character.all", ch.invoke("all").count >= 1)
        checar("player.spawnPoint", !pl["spawnPoint"].isNone)
        checar("character.velocity", !c["velocity"].isNone && !c["position"].isNone)
        return Value.undefined
    }

    private func terreno() -> Value {
        let te = api("terrain")
        checar("terrain.presets", te.invoke("presets").count > 0)
        let colinas = te.invoke("spawn", obj(["name": "Colinas", "size": 48, "resolution": 65, "preset": "hills", "seed": 7, "position": v3(0, -6, -70)]))
        checar("terrain.spawn", !colinas["terrain"].isNone && te.invoke("all").count >= 1)
        checar("terrain.of", numero(te.invoke("of", colinas), "resolution") == 65)
        checar("heightAt", te.invoke("heightAt", v3(0, 0, -70), colinas).isNumber)
        checar("contains", te.invoke("contains", v3(0, 0, -70), colinas).bool && !te.invoke("contains", v3(500, 0, 0), colinas).bool)
        te.invoke("sculpt", colinas, "raise", v3(5, 0, -70), obj(["radius": 6, "strength": 1]), 1)
        te.invoke("markDirty", colinas)
        let grama = te["grass"]
        grama.invoke("set", colinas, obj(["enabled": true, "density": 0.5]))
        checar("grass.set", verdadeiro(grama.invoke("settingsOf", colinas)["enabled"]))
        let agua = te["water"]
        agua.invoke("set", colinas, obj(["enabled": true, "level": -2]))
        checar("water.set", verdadeiro(agua.invoke("settingsOf", colinas)["enabled"]))
        checar("terrain.raycast", !te.invoke("raycast", v3(0, 50, -70), v3(0, -1, 0), colinas).isNone)
        return Value.undefined
    }

                                                                                               

    private func soltarCaixa() {
        let random = api("math.random")
        let caixa = api("scene").invoke("spawnPrimitive", "box", obj([
            "name": "CaixaSolta",
            "position": v3(random.invoke("range", -3, 3).number, 6, random.invoke("range", 0, 4).number),
            "rigidBody": obj(["type": "dynamic", "collider": "box", "mass": 1]),
            "tags": lista(["caixa"]),
        ]))
        api("material").invoke("setColor", caixa, random.invoke("color"))
        pontos += 1
        api("gui").invoke("bind", "pontos", pontos)
        api("events").invoke("emit", "debug.caixa", obj(["nome": caixa["name"]]))
    }

    private func interfaceGrafica() -> Value {
        let g = api("gui")
        g.invoke("css", "DebugEstilo")
        let hud = g.invoke("html", "DebugHud", obj(["id": "debug-hud"]))
        checar("gui.html", !hud.isNone && !g.invoke("element", "#debug-hud").isNone)
        let icone = g.invoke("svg", "DebugIcone", obj(["id": "debug-icone"]))
        checar("gui.svg", !icone.isNone)
        let slot = g.invoke("element", "[data-slot=icone]")
        if !slot.isNone && !icone.isNone { slot.invoke("appendChild", icone) }
        checar("gui.bind", g.invoke("bind", "linguagem", linguagem).number >= 1)
`;
}
