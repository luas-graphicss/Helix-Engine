import type { GameSources } from '../types';
export function kotlinGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
import helix.*
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.round

class DebugJogo : Script() {
    private val linguagem = "Kotlin"

    private var quadros = 0
    private var passosFisica = 0
    private var lateUpdates = 0
    private var renders = 0
    private var colisoes = 0
    private var checagens = 0
    private var falhas = 0
    private var pontos = 0
    private var hudTimer = 0.0
                                                                           
    private var torus: Value? = null
    private var heroi: Value? = null
    private var efeito: Value? = null
    private var tela: Value? = null
    private val assinaturas = mutableListOf<Value>()

                                                                                             
    private class Area(val nome: String, val rodar: () -> Any?, val esperaErro: Boolean = false)

                                                                                              

    private fun api(caminho: String): Value = helix.path(caminho)
    private fun v3(x: Double, y: Double, z: Double) = Vec3(x, y, z)
    private fun arg(args: List<Value>, indice: Int): Value = if (indice < args.size) args[indice] else Value.undefined

    private fun registrar(metodo: String, mensagem: String) {
        api("log").invoke(metodo, "Debug", mensagem)
    }

    private fun info(mensagem: String) = registrar("info", mensagem)
    private fun aviso(mensagem: String) = registrar("warn", mensagem)
    private fun erro(mensagem: String) = registrar("error", mensagem)
    private fun depurar(mensagem: String) = registrar("debug", mensagem)

    private fun checar(nome: String, condicao: Boolean, detalhe: Any? = null) {
        checagens++
        if (condicao) return
        falhas++
        erro(if (detalhe == null) "FALHOU " + nome else "FALHOU " + nome + ": " + detalhe)
    }

    private fun assinar(desligar: Value) {
        if (desligar.isFunction) assinaturas.add(desligar)
    }

    private fun verdadeiro(v: Value) = v.isBoolean && v.boolean
    private fun falso(v: Value) = v.isBoolean && !v.boolean
    private fun aprox(a: Double, b: Double, epsilon: Double) = abs(a - b) <= epsilon
    private fun arred(x: Double) = round(x * 100) / 100
    private fun numero(o: Value, chave: String) = o[chave].number
    private fun textoIgual(v: Value, esperado: String) = v.isString && v.string == esperado

                                                                                             
    private fun eq3(vetor: Value, x: Double, y: Double, z: Double, epsilon: Double) =
        api("math.vec3").invoke("equals", vetor, v3(x, y, z), epsilon).boolean

    private fun comprimento(vetor: Value) = api("math.vec3").invoke("length", vetor).number
    private fun contem(lista: Value, texto: String) = lista.list.any { it.string == texto }
    private fun nomeDe(entidade: Value) = if (entidade.isNullish) "ninguém" else entidade["name"].string

                                                                                               

    private fun nucleo(): Any? {
        val engine = api("engine")
        val nome = engine["name"]
        val contexto = helix["context"].string
        checar("engine.name", nome.isString && nome.string != "")
        checar("engine.version", engine["version"].isString)
        checar("context", contexto == "shared" || contexto == "client" || contexto == "server", contexto)
        checar("isPlaying", verdadeiro(helix["isPlaying"]))
        checar("isEditor", falso(helix["isEditor"]))
        checar("self no script de entrada", self.isNullish && helix["self"].isNullish)
        checar("script é o handle do script", script.isObject)
        checar("Helix.now", Helix.now >= 0)
        info(nome.string + " " + engine["version"].string + " · API " + engine["apiVersion"].string + " · " + linguagem)
        Helix.log("Helix.log direto do Kotlin (console da engine)")
        return null
    }

    private fun modulo(): Any? {
        val util = Helix.require("DebugUtil")
        checar("require devolve as funções", util.isObject && util["soma"].isFunction)
        val resultado = util.invoke("soma", 2, 3).number
        checar("require soma", resultado == 5.0, resultado)
        checar("require saudacao", textoIgual(util.invoke("saudacao", "Helix"), "Olá, Helix"))
        checar("require limitar", util.invoke("limitar", 15, 0, 10).number == 10.0)
        return null
    }

    private fun matematica(): Any? {
        val m = api("math")
        val vec = m["vec3"]
        val quat = m["quat"]
        val mat4 = m["mat4"]
        val escalar = m["scalar"]
        checar("vec3.add", eq3(vec.invoke("add", v3(1.0, 2.0, 3.0), v3(1.0, 1.0, 1.0)), 2.0, 3.0, 4.0, 1e-6))
        checar("vec3.length", aprox(vec.invoke("length", v3(3.0, 4.0, 0.0)).number, 5.0, 1e-3))
        checar("vec3.normalize", aprox(comprimento(vec.invoke("normalize", v3(0.0, 5.0, 0.0))), 1.0, 1e-3))
        checar("vec3.cross", eq3(vec.invoke("cross", v3(1.0, 0.0, 0.0), v3(0.0, 1.0, 0.0)), 0.0, 0.0, 1.0, 1e-6))
        checar("vec3.lerp", eq3(vec.invoke("lerp", v3(0.0, 0.0, 0.0), v3(2.0, 2.0, 2.0), 0.5), 1.0, 1.0, 1.0, 1e-6))
        val q = quat.invoke("fromEuler", v3(0.0, 90.0, 0.0))
        checar("quat.rotateVec3", eq3(quat.invoke("rotateVec3", q, v3(1.0, 0.0, 0.0)), 0.0, 0.0, -1.0, 1e-3))
        checar("quat.toEuler", aprox(numero(quat.invoke("toEuler", q), "y"), 90.0, 0.01))
        val mat = mat4.invoke("fromTRS", v3(1.0, 2.0, 3.0), v3(0.0, 0.0, 0.0), v3(1.0, 1.0, 1.0))
        checar("mat4.transformPoint", eq3(mat4.invoke("transformPoint", mat, v3(0.0, 0.0, 0.0)), 1.0, 2.0, 3.0, 1e-6))
        checar("mat4.invert", !mat4.invoke("invert", mat).isNullish)
        val aabb = m["aabb"]
        val caixa = aabb.invoke("fromCenterSize", v3(0.0, 0.0, 0.0), v3(2.0, 2.0, 2.0))
        checar("aabb.contains", aabb.invoke("contains", caixa, v3(0.5, 0.5, 0.5)).boolean && !aabb.invoke("contains", caixa, v3(2.0, 0.0, 0.0)).boolean)
        val ray = m["ray"]
        val raio = ray.invoke("create", v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0))
        checar("ray.intersectAabb", !ray.invoke("intersectAabb", raio, caixa).isNullish)
        checar("scalar.remap", escalar.invoke("remap", 5, 0, 10, 0, 100).number == 50.0)
        checar("clamp/lerp", m.invoke("clamp", 15, 0, 10).number == 10.0 && m.invoke("lerp", 0, 10, 0.5).number == 5.0)
        checar("scalar.wrapAngle", aprox(escalar.invoke("wrapAngle", 370).number, 10.0, 1e-3))
        checar("degToRad", aprox(m.invoke("degToRad", 180).number, PI, 1e-6))
        val ruido = m["noise"]
        val perlin = ruido.invoke("perlin2", 0.3, 0.7).number
        checar("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, perlin)
        checar("noise.fbm", ruido.invoke("fbm", 1.5, 2.5, 0, 4).isNumber)
        val cor = m["color"]
        checar("color.hexToVec3", eq3(cor.invoke("hexToVec3", "#ff0000"), 1.0, 0.0, 0.0, 0.01))
        val hex = cor.invoke("vec3ToHex", v3(1.0, 1.0, 1.0)).string
        checar("color.vec3ToHex", hex.lowercase() == "#ffffff", hex)
        val random = m["random"]
        random.invoke("seed", 42)
        val primeiro = random.invoke("value").number
        random.invoke("seed", 42)
        checar("random.seed determinístico", random.invoke("value").number == primeiro)
        val sorteado = random.invoke("int", 1, 6).number
        checar("random.int", sorteado >= 1 && sorteado <= 6 && floor(sorteado) == sorteado)
        checar("random.unitVector", aprox(comprimento(random.invoke("unitVector")), 1.0, 1e-3))
        checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI") * 2, 1e-9))
        return null
    }

                                                                                                

    private fun cena(): Any? {
        val s = api("scene")
        val mat = api("material")
        val raiz = s["root"]
        checar("scene.root", !raiz.isNullish && raiz["children"].isArray)
        val antes = s.invoke("count").number
        val grupo = s.invoke("spawn", "group", mapOf("name" to "DebugCenario"))
        val chao = s.invoke("spawn", "mesh", mapOf(
            "name" to "Chao",
            "mesh" to api("mesh").invoke("plane", 40, 40),
            "material" to mat.invoke("create", mapOf("baseColor" to "#4b6b3a", "roughness" to 0.95)),
            "rigidBody" to mapOf("type" to "static", "collider" to "box", "boxSize" to v3(40.0, 0.2, 40.0), "center" to v3(0.0, -0.1, 0.0)),
            "receiveShadows" to true,
            "tags" to listOf("chao")
        ), grupo)
        checar("spawn mesh", textoIgual(chao["kind"], "mesh") && !chao["mesh"].isNullish && !chao["rigidBody"].isNullish)
        checar("find", s.invoke("find", "Chao") == chao)
        checar("findAll", s.invoke("findAll", "Chao").size == 1)
        checar("byId", s.invoke("byId", chao["id"]) == chao)
        checar("byTag", s.invoke("byTag", "chao").size >= 1)
        checar("byKind", s.invoke("byKind", "mesh").size >= 1)
        val depois = s.invoke("count").number
        checar("count", depois == antes + 2, "" + depois + " vs " + (antes + 2))
        checar("contains", s.invoke("contains", grupo, chao).boolean && s.invoke("contains", raiz, chao).boolean)
        val caminho = s.invoke("path", chao).string
        checar("path", caminho.contains("Chao"), caminho)
        var visitados = 0
        s.invoke("traverse", Helix.fn { visitados++; null }, grupo)
        checar("traverse", visitados >= 2, visitados)

        val anel = s.invoke("spawnPrimitive", "torus", mapOf("name" to "Anel", "position" to v3(-4.0, 1.2, -2.0), "scale" to 1.5), grupo)
        mat.invoke("setColor", anel, "#3a86ff")
        mat.invoke("setEmissive", anel, "#3a86ff", 0.6)
        torus = anel
        checar("spawnPrimitive", !anel["mesh"].isNullish && !anel["material"].isNullish)

        val copia = s.invoke("clone", anel, true, grupo)
        s.invoke("rename", copia, "AnelCopia")
        api("transform").invoke("setPosition", copia, v3(-4.0, 1.2, 2.0))
        checar("clone + rename", textoIgual(copia["name"], "AnelCopia") && s.invoke("find", "AnelCopia") == copia)
        s.invoke("setMeta", copia, "origem", "clone")
        checar("meta", textoIgual(s.invoke("getMeta", copia, "origem"), "clone"))
        s.invoke("addTag", copia, "temporario")
        checar("addTag/hasTag", s.invoke("hasTag", copia, "temporario").boolean)
        checar("removeTag", verdadeiro(s.invoke("removeTag", copia, "temporario")) && !s.invoke("hasTag", copia, "temporario").boolean)
        s.invoke("setVisible", copia, false)
        checar("setVisible", falso(copia["visible"]))
        s.invoke("setVisible", copia, true)
        s.invoke("destroy", copia)
        checar("destroy", s.invoke("find", "AnelCopia").isNullish && !s.invoke("isAttached", copia).boolean)

        val esfera = s.invoke("spawnPrimitive", "sphere", mapOf("name" to "Esfera", "position" to v3(4.0, 0.5, -3.0)))
        s.invoke("reparent", esfera, grupo)
        checar("reparent", esfera["parent"] == grupo)
        mat.invoke("setColor", esfera, "#ffbe0b")
        s.invoke("addComponent", esfera, "rigidBody", mapOf("type" to "dynamic", "collider" to "sphere", "radius" to 0.5, "mass" to 1))
        checar("addComponent", !esfera["rigidBody"].isNullish && textoIgual(esfera.path("rigidBody.type"), "dynamic"))
        val temporario = s.invoke("spawnPrimitive", "box", mapOf("name" to "Temporario"))
        s.invoke("addComponent", temporario, "csg", Helix.obj())
        checar("addComponent csg", !temporario["csg"].isNullish)
        s.invoke("removeComponent", temporario, "csg")
        checar("removeComponent", temporario["csg"].isNullish)
        s.invoke("destroy", temporario)
        checar("kinds/components", contem(s.invoke("kinds"), "mesh") && contem(s.invoke("components"), "rigidBody"))
        return null
    }

    private fun transformacao(): Any? {
        val tr = api("transform")
        val s = api("scene")
        val alvo = s.invoke("spawnPrimitive", "cone", mapOf("name" to "Cone", "position" to v3(0.0, 0.5, -6.0)))
        api("material").invoke("setColor", alvo, "#8338ec")
        tr.invoke("setPosition", alvo, v3(2.0, 0.5, -6.0))
        checar("setPosition", eq3(tr.invoke("position", alvo), 2.0, 0.5, -6.0, 1e-6))
        tr.invoke("translate", alvo, v3(0.0, 1.0, 0.0), "world")
        checar("translate", aprox(numero(tr.invoke("position", alvo), "y"), 1.5, 1e-3))
        tr.invoke("setRotation", alvo, v3(0.0, 90.0, 0.0))
        checar("setRotation", aprox(numero(tr.invoke("rotation", alvo), "y"), 90.0, 0.01))
        tr.invoke("rotate", alvo, v3(0.0, 45.0, 0.0))
        val girado = api("math.scalar").invoke("wrapAngle", tr.invoke("rotation", alvo)["y"]).number
        checar("rotate", aprox(girado, 135.0, 0.01) || aprox(girado, -225.0, 0.01), girado)
        tr.invoke("setScale", alvo, 2)
        checar("setScale", aprox(numero(tr.invoke("scale", alvo), "x"), 2.0, 1e-6))
        tr.invoke("setScale", alvo, v3(1.0, 1.0, 1.0))
        val mundo = tr.invoke("worldPosition", alvo).vec3
        checar("worldPosition", eq3(tr.invoke("position", alvo), mundo.x, mundo.y, mundo.z, 1e-3))
        checar("forward/up", aprox(comprimento(tr.invoke("forward", alvo)), 1.0, 1e-3) && aprox(comprimento(tr.invoke("up", alvo)), 1.0, 1e-3))
        tr.invoke("lookAt", alvo, v3(0.0, 1.5, 0.0))
        checar("distance", tr.invoke("distance", alvo, v3(2.0, 1.5, -6.0)).number < 0.01)
        checar("directionTo", aprox(comprimento(tr.invoke("directionTo", alvo, v3(0.0, 1.5, 0.0))), 1.0, 1e-3))
        val limites = tr.invoke("bounds", alvo)
        checar("bounds", !limites.isNullish && numero(limites["max"], "y") > numero(limites["min"], "y"))
        checar("worldMatrix", tr.invoke("worldMatrix", alvo).size == 16 && tr.invoke("localMatrix", alvo).size == 16)
        val local = tr.invoke("worldToLocal", alvo, tr.invoke("localToWorld", alvo, v3(1.0, 0.0, 0.0)))
        checar("localToWorld/worldToLocal", eq3(local, 1.0, 0.0, 0.0, 1e-3))
        return null
    }

    private fun malhas(): Any? {
        val me = api("mesh")
        val s = api("scene")
        val csg = api("csg")
        val mat = api("material")
        val caixa = me.invoke("box", 1, 1, 1)
        val triangulos = me.invoke("triangleCount", caixa).number
        checar("mesh.box", me.invoke("vertexCount", caixa).number > 0 && triangulos == 12.0, triangulos)
        val esfera = me.invoke("sphere", 0.65, 16, 12)
        val furado = csg.invoke("boolean", caixa, esfera, "subtract")
        checar("csg.boolean", me.invoke("triangleCount", furado).number > 12)
        val ator = s.invoke("spawn", "mesh", mapOf(
            "name" to "CaixaFurada",
            "mesh" to furado,
            "material" to mat.invoke("create", mapOf("baseColor" to "#e63946", "roughness" to 0.4, "metallic" to 0.2)),
            "position" to v3(4.0, 0.5, 2.0)
        ))
        checar("spawn malha CSG", !ator["mesh"].isNullish)
        checar("csg.operations", contem(csg.invoke("operations"), "union"))
        val tri = me.invoke("create", mapOf(
            "name" to "Triangulo",
            "positions" to listOf(-1, 0, 0, 1, 0, 0, 0, 1.5, 0),
            "uvs" to listOf(0, 0, 1, 0, 0.5, 1),
            "indices" to listOf(0, 1, 2)
        ))
        me.invoke("computeNormals", tri)
        checar("mesh.create + computeBounds", numero(me.invoke("computeBounds", tri)["max"], "y") >= 1.5)
        val dupla = me.invoke("merge", tri, me.invoke("flipWinding", me.invoke("clone", tri)))
        checar("mesh.merge", me.invoke("triangleCount", dupla).number == 2.0)
        s.invoke("spawn", "mesh", mapOf(
            "name" to "Triangulo",
            "mesh" to dupla,
            "material" to mat.invoke("create", mapOf("baseColor" to "#06d6a0", "doubleSided" to true)),
            "position" to v3(7.0, 0.0, -2.0)
        ))
        val grande = me.invoke("scale", me.invoke("translate", me.invoke("clone", caixa), v3(0.0, 0.5, 0.0)), 2)
        checar("mesh.translate/scale", numero(me.invoke("computeBounds", grande)["max"], "y") > 1.9)
        val distancia = me.invoke("raycast", api("math.ray").invoke("create", v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0)), grande)
        checar("mesh.raycast", distancia.isNumber && distancia.number > 0)
        val vertices = me.invoke("vertexCount", caixa).int
        checar("positions/indices", me.invoke("positions", caixa).size == vertices * 3 && me.invoke("indices", caixa).size == 36)
        checar("primitivas extras", me.invoke("triangleCount", me.invoke("torusKnot")).number > 0 && me.invoke("triangleCount", me.invoke("capsule")).number > 0)
        return null
    }

                                                                                                  

    private fun materiais(): Any? {
        val mat = api("material")
        val s = api("scene")
        val tex = api("texture")
        val base = mat.invoke("create", mapOf("name" to "DebugBase", "baseColor" to "#d98c2b", "roughness" to 0.5, "metallic" to 0.1))
        checar("material.create", numero(base, "roughness") == 0.5)
        val copia = mat.invoke("clone", base)
        mat.invoke("set", copia, mapOf("roughness" to 1, "emissive" to "#ffffff", "emissiveIntensity" to 2))
        checar("material.clone/set", numero(copia, "roughness") == 1.0 && numero(base, "roughness") == 0.5)
        val caixa = s.invoke("spawnPrimitive", "box", mapOf("name" to "CaixaPintada", "position" to v3(-7.0, 0.5, 2.0)))
        mat.invoke("assign", caixa, base)
        checar("material.assign/of", !mat.invoke("of", caixa).isNullish)
        mat.invoke("own", caixa)
        mat.invoke("setColor", caixa, "#d98c2b")
        val desenho = tex.invoke("canvas", 64, 64)
        desenho.invoke("update")
        mat.invoke("setTexture", caixa, "baseColorMap", desenho["texture"])
        checar("texture.canvas + setTexture", mat.invoke("hasAnyTexture", mat.invoke("of", caixa)).boolean && tex.invoke("isTexture", desenho["texture"]).boolean)
        checar("material.slots", mat.invoke("slots").size > 0)
        checar("materials.list", api("materials").invoke("list").isArray)
        val sombreado = mat.invoke("fromShader", "DebugSuperficie", mapOf("glow" to v3(1.0, 0.45, 0.1), "speed" to 2))
        checar("material.fromShader", !sombreado.isNullish)
        if (!sombreado.isNullish) {
            val esfera = s.invoke("spawnPrimitive", "sphere", mapOf("name" to "EsferaShader", "position" to v3(0.0, 1.0, -3.0), "scale" to 1.4))
            mat.invoke("assign", esfera, sombreado)
            mat.invoke("uniforms", esfera).invoke("set", "speed", 3)
            checar("material.uniforms.list", mat.invoke("uniforms", esfera).invoke("list").size >= 1)
        }
        return null
    }

    private fun luzes(): Any? {
        val l = api("light")
        checar("light.types", contem(l.invoke("types"), "point") && contem(l.invoke("localTypes"), "spot"))
        val lampada = l.invoke("spawn", "point", mapOf("name" to "Lampada", "position" to v3(0.0, 3.0, 0.0), "color" to "#ffd166", "intensity" to 60, "range" to 14))
        checar("light.spawn", !lampada["light"].isNullish && textoIgual(lampada.path("light.type"), "point"))
        l.invoke("set", lampada, mapOf("intensity" to 80))
        checar("light.set", numero(lampada["light"], "intensity") == 80.0)
        l.invoke("setTemperature", lampada, 3200)
        checar("setTemperature", numero(lampada["light"], "temperature") == 3200.0)
        val foco = l.invoke("spawn", "spot", mapOf(
            "name" to "Holofote", "position" to v3(4.0, 4.0, 0.0), "rotation" to v3(-90.0, 0.0, 0.0), "intensity" to 120, "range" to 16,
            "innerAngle" to 20, "outerAngle" to 35, "color" to "#ffffff"
        ))
        checar("spot", textoIgual(foco.path("light.type"), "spot"))
        val convertido = l.invoke("convert", foco, "disc")
        checar("light.convert", textoIgual(convertido["type"], "disc") && textoIgual(foco.path("light.type"), "disc"))
        l.invoke("convert", foco, "spot")
        val presets = l.invoke("presets")
        checar("light.presets", presets.size > 0)
        if (presets.size > 0) {
            val primeiro = presets[0]
            val preset = l.invoke("spawn", primeiro["id"], mapOf("name" to "LuzPreset", "position" to v3(-4.0, 2.5, 4.0)))
            checar("light.fromPreset", !preset["light"].isNullish && l.invoke("fromPreset", primeiro["id"])["type"] == primeiro["type"])
        }
        checar("light.all", l.invoke("all", mapOf("local" to true)).size >= 2)
        checar("effectiveRange", l.invoke("effectiveRange", lampada).number > 0)
        checar("light.isLocal", verdadeiro(l.invoke("isLocal", lampada)))
        checar("temperatureToColor", !l.invoke("temperatureToColor", 6500).isNullish)
        l.invoke("setColor", lampada, "#ffffff")
        checar("light.setColor", eq3(lampada.path("light.color"), 1.0, 1.0, 1.0, 0.01))
        return null
    }

    private fun ceu(): Any? {
        val sky = api("sky")
        val mundo = api("world")
        sky.invoke("set", mapOf("timeOfDay" to 10.5, "haze" to 0.3, "clouds" to mapOf("enabled" to true, "coverage" to 0.45)))
        checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(sky.path("clouds.enabled")))
        checar("sky.isDay", verdadeiro(sky["isDay"]))
        checar("sky.sunDirection", numero(sky.invoke("sunDirection"), "y") > 0)
        val hora = sky.invoke("formatTimeOfDay", 10.5).string
        checar("sky.formatTimeOfDay", hora.contains(":"), hora)
        checar("sky.wrapTimeOfDay", sky.invoke("wrapTimeOfDay", 25).number == 1.0)
        checar("sky.presets", sky.invoke("presets").size > 0)
        assinar(sky.invoke("onHourChanged", Helix.fn { args -> info("Hora do céu: " + arg(args, 0).string); null }))
        sky["cycleSpeed"] = 0
        checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0.0)
        checar("world.gravity", numero(mundo["gravity"], "y") < 0)
        mundo["wind"].invoke("set", mapOf("speed" to 2, "direction" to 45))
        checar("world.wind.set", numero(mundo["wind"], "speed") == 2.0)
        return null
    }

    private fun camera(): Any? {
        val c = api("camera")
        checar("camera.fov", numero(c, "fov") > 0 && numero(c, "aspect") > 0)
        checar("camera.near/far", numero(c, "near") > 0 && numero(c, "far") > numero(c, "near"))
        val viewport = c["viewport"]
        checar("viewport", numero(viewport, "width") > 0)
        val naTela = c.invoke("worldToScreen", v3(0.0, 0.0, 0.0))
        checar("worldToScreen", naTela.isNullish || naTela["x"].isNumber)
        val raio = c.invoke("screenToRay", numero(viewport, "width") / 2, numero(viewport, "height") / 2)
        checar("screenToRay", raio.isNullish || aprox(comprimento(raio["direction"]), 1.0, 0.01))
        checar("viewMatrix", c["viewMatrix"].size == 16)
        val jogador = c["player"]
        jogador.invoke("set", mapOf("distance" to 7, "pitch" to 18))
        checar("player.set", numero(jogador["settings"], "distance") == 7.0)
        checar("distanceTo", c.invoke("distanceTo", v3(0.0, 0.0, 0.0)).number >= 0)
        checar("camera.position", !c["position"].isNullish && !c["forward"].isNullish)
        assinar(c.invoke("onMainChanged", Helix.fn { args ->
            val entidade = arg(args, 0)
            info(if (entidade.isNullish) "Câmera principal: editor/jogador" else "Câmera principal: " + nomeDe(entidade))
            null
        }))
        return null
    }

    private fun pos(): Any? {
        val p = api("post")
        checar("post.toneMappers", p.invoke("toneMappers").size > 0)
        p.invoke("set", mapOf(
            "bloom" to mapOf("enabled" to true, "intensity" to 0.5, "threshold" to 1, "softKnee" to 0.5, "radius" to 0.6),
            "vignette" to mapOf("enabled" to true, "intensity" to 0.35, "smoothness" to 0.5, "roundness" to 1)
        ))
        checar("post.set", verdadeiro(p.path("bloom.enabled")) && verdadeiro(p.path("vignette.enabled")))
        p["exposure"] = 1.05
        checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3))
        p["toneMapper"] = "agx"
        checar("post.toneMapper", textoIgual(p["toneMapper"], "agx"))
        checar("post.presets", p.invoke("presets").size > 0)
        val custom = p["custom"]
        val novo = custom.invoke("add", mapOf("fragment" to "DebugPost", "name" to "DebugPost", "uniforms" to mapOf("tint" to v3(0.15, 0.05, 0.3), "strength" to 0.6)))
        efeito = novo
        checar("post.custom.add", !novo.isNullish && !custom.invoke("get", "DebugPost").isNullish)
        novo["uniforms"].invoke("set", "strength", 0.8)
        checar("efeito.uniforms.list", novo["uniforms"].invoke("list").size >= 2)
        return null
    }

    private fun render(): Any? {
        val r = api("render")
        checar("render.passNames", r.invoke("passNames").size > 0)
        checar("render.stats", r.path("stats.drawCalls").isNumber)
        checar("render.frame", r.path("frame.width").isNumber)
        assinar(r.invoke("onAfterFrame", Helix.fn { renders++; null }))
        r["showGrid"] = false
        checar("render.showGrid", falso(r["showGrid"]))
        checar("render.pixelRatio", numero(r, "pixelRatio") > 0)
        return null
    }

                                                                                               

    private fun fisica(): Any? {
        val ph = api("physics")
        val s = api("scene")
        checar("physics.enabled", verdadeiro(ph["enabled"]))
        checar("physics.gravity", numero(ph["gravity"], "y") < 0)
        checar("physics.settings", numero(ph["settings"], "fixedTimestep") > 0)
        for (i in 1..5) {
            val indice = (i - 1).toDouble()
            val caixa = s.invoke("spawnPrimitive", "box", mapOf(
                "name" to "Caixa" + i,
                "position" to v3(-2 + indice * 1.1, 3 + indice * 1.2, 3.0),
                "rigidBody" to mapOf("type" to "dynamic", "collider" to "box", "mass" to 2, "restitution" to 0.3),
                "tags" to listOf("caixa")
            ))
            api("material").invoke("setColor", caixa, api("math.color").invoke("hsl", 30 + i * 12, 0.7, 0.5))
        }
        val caixas = s.invoke("byTag", "caixa")
        val primeira = caixas[0]
        checar("caixas dinâmicas", caixas.size == 5 && ph.invoke("hasBody", primeira).boolean)
        val corpo = ph.invoke("bodyOf", primeira)
        checar("bodyOf", verdadeiro(corpo["isDynamic"]) && numero(corpo, "mass") > 0)
        corpo.invoke("applyImpulse", v3(0.0, 2.0, 0.0))
        corpo.invoke("applyTorque", v3(0.0, 1.0, 0.0))
        corpo.invoke("setMaterial", mapOf("friction" to 0.8))
        corpo.invoke("wake")
        checar("body.linearVelocity", !corpo["linearVelocity"].isNullish)
        checar("bodies()", ph.invoke("bodies").size >= 6)
        val hit = ph.invoke("raycast", v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0), 20)
        checar("physics.raycast", !hit.isNullish && !hit["entity"].isNullish)
        checar("raycastAll", ph.invoke("raycastAll", v3(0.0, 5.0, 0.0), v3(0.0, -1.0, 0.0), 20).size >= 1)
        checar("overlapSphere", ph.invoke("overlapSphere", v3(0.0, 3.0, 3.0), 4).isArray)
        checar("massProperties", numero(ph.invoke("massProperties", primeira), "mass") > 0)
        checar("colliderVolume", ph.invoke("colliderVolume", primeira).number > 0)
        val formas = ph["shapes"]
        checar("shapes.sphere volume", aprox(formas.invoke("volume", formas.invoke("sphere", 1)).number, 4.18879, 0.01))
        assinar(ph.invoke("onCollisionBegin", Helix.fn { args ->
            colisoes++
            if (colisoes <= 3) {
                val e = arg(args, 0)
                info("Colisão: " + nomeDe(e["a"]) + " × " + nomeDe(e["b"]) + " (impulso " + arred(numero(e["contact"], "impulse")) + ")")
            }
            null
        }))
        assinar(ph.invoke("onOutOfBounds", Helix.fn { args -> aviso(nomeDe(arg(args, 0)) + " caiu do mundo"); null }))
        val gatilho = s.invoke("spawn", "group", mapOf("name" to "Gatilho", "position" to v3(0.0, 1.0, 3.0), "trigger" to mapOf("shape" to "box", "size" to v3(3.0, 2.0, 3.0))))
        checar("trigger spawn", !gatilho.isNullish && s.invoke("isAttached", gatilho).boolean)
        checar("physics.stats", ph.path("stats.bodies").isNumber)
        return null
    }

    private fun personagem(): Any? {
        val ch = api("character")
        val pl = api("player")
        val novo = ch.invoke("spawn", mapOf("name" to "Heroi", "position" to v3(0.0, 1.2, 8.0), "character" to mapOf("walkSpeed" to 4, "runSpeed" to 7, "jumpHeight" to 1.4)))
        heroi = novo
        checar("character.spawn", !novo["character"].isNullish && ch.invoke("has", novo).boolean)
        val c = ch.invoke("of", novo)
        checar("character.of", c["isGrounded"].isBoolean)
        checar("settingsOf", numero(ch.invoke("settingsOf", novo), "walkSpeed") == 4.0)
        pl.invoke("possess", novo)
        checar("player.possess", pl["possessed"] == novo && verdadeiro(pl["isPossessing"]))
        assinar(ch.invoke("onJumped", Helix.fn { args -> info(nomeDe(arg(args, 0)["entity"]) + " pulou"); null }))
        assinar(pl.invoke("onPossessed", Helix.fn { args -> info("Possuindo " + nomeDe(arg(args, 0))); null }))
        checar("character.all", ch.invoke("all").size >= 1)
        checar("player.spawnPoint", !pl["spawnPoint"].isNullish)
        checar("character.velocity", !c["velocity"].isNullish && !c["position"].isNullish)
        return null
    }

    private fun terreno(): Any? {
        val te = api("terrain")
        checar("terrain.presets", te.invoke("presets").size > 0)
        val colinas = te.invoke("spawn", mapOf("name" to "Colinas", "size" to 48, "resolution" to 65, "preset" to "hills", "seed" to 7, "position" to v3(0.0, -6.0, -70.0)))
        checar("terrain.spawn", !colinas["terrain"].isNullish && te.invoke("all").size >= 1)
        checar("terrain.of", numero(te.invoke("of", colinas), "resolution") == 65.0)
        checar("heightAt", te.invoke("heightAt", v3(0.0, 0.0, -70.0), colinas).isNumber)
        checar("contains", te.invoke("contains", v3(0.0, 0.0, -70.0), colinas).boolean && !te.invoke("contains", v3(500.0, 0.0, 0.0), colinas).boolean)
        te.invoke("sculpt", colinas, "raise", v3(5.0, 0.0, -70.0), mapOf("radius" to 6, "strength" to 1), 1)
        te.invoke("markDirty", colinas)
        val grama = te["grass"]
        grama.invoke("set", colinas, mapOf("enabled" to true, "density" to 0.5))
        checar("grass.set", verdadeiro(grama.invoke("settingsOf", colinas)["enabled"]))
        val agua = te["water"]
        agua.invoke("set", colinas, mapOf("enabled" to true, "level" to -2))
        checar("water.set", verdadeiro(agua.invoke("settingsOf", colinas)["enabled"]))
        checar("terrain.raycast", !te.invoke("raycast", v3(0.0, 50.0, -70.0), v3(0.0, -1.0, 0.0), colinas).isNullish)
        return null
    }

                                                                                               

    private fun soltarCaixa() {
        val random = api("math.random")
        val caixa = api("scene").invoke("spawnPrimitive", "box", mapOf(
            "name" to "CaixaSolta",
            "position" to v3(random.invoke("range", -3, 3).number, 6.0, random.invoke("range", 0, 4).number),
            "rigidBody" to mapOf("type" to "dynamic", "collider" to "box", "mass" to 1),
            "tags" to listOf("caixa")
        ))
        api("material").invoke("setColor", caixa, random.invoke("color"))
        pontos++
        api("gui").invoke("bind", "pontos", pontos)
        api("events").invoke("emit", "debug.caixa", mapOf("nome" to caixa["name"]))
    }

    private fun interfaceGrafica(): Any? {
        val g = api("gui")
        g.invoke("css", "DebugEstilo")
        val hud = g.invoke("html", "DebugHud", mapOf("id" to "debug-hud"))
        checar("gui.html", !hud.isNullish && !g.invoke("element", "#debug-hud").isNullish)
        val icone = g.invoke("svg", "DebugIcone", mapOf("id" to "debug-icone"))
        checar("gui.svg", !icone.isNullish)
        val slot = g.invoke("element", "[data-slot=icone]")
        if (!slot.isNullish && !icone.isNullish) slot.invoke("appendChild", icone)
        checar("gui.bind", g.invoke("bind", "linguagem", linguagem).number >= 1)
        g.invoke("bind", "titulo", "Helix · Debug")
        assinar(g.invoke("onAction", "caixa", Helix.fn { soltarCaixa(); null }))
        assinar(g.invoke("onAction", "reiniciar", Helix.fn { api("play").invoke("restart"); null }))
        checar("gui.elements", g.invoke("elements", "[data-bind]").size >= 5)
        checar("gui.size", numero(g["size"], "width") > 0)
        fun escala(scale: Double, offset: Double) = mapOf("scale" to scale, "offset" to offset)
        val declarativa = g.invoke("create", "DebugTela", mapOf("referenceSize" to mapOf("x" to 1280, "y" to 720)))
        val painel = g.invoke("add", declarativa, "frame", mapOf(
            "name" to "Painel",
            "rect" to mapOf(
                "position" to mapOf("x" to escala(1.0, -236.0), "y" to escala(0.0, 16.0)),
                "size" to mapOf("x" to escala(0.0, 220.0), "y" to escala(0.0, 48.0))
            )
        ))
        g.invoke("add", declarativa, "text", mapOf("name" to "Rotulo", "text" to "Tela declarativa OK"), painel.path("node.id"))
        checar("gui.add/find", textoIgual(g.invoke("find", declarativa, "Rotulo")["kind"], "text"))
        g.invoke("setText", declarativa, "Rotulo", "Tela declarativa OK · " + linguagem)
                                                                                           
        return g.invoke("show", declarativa, "debug-tela").invoke("then", Helix.fn { args ->
            val mostrada = arg(args, 0)
            tela = mostrada
            checar("gui.show/isShown", !mostrada.isNullish && api("gui").invoke("isShown", mostrada).boolean)
            checar("gui.kinds", contem(api("gui").invoke("kinds"), "button"))
            null
        })
    }

    private fun audio(): Any? {
        val a = api("audio")
        val s = api("scene")
        checar("audio.supported", a["supported"].isBoolean)
        val mixer = a["mixer"]
        mixer.invoke("setVolumeDb", "sfx", -3)
        checar("mixer.setVolumeDb", numero(mixer.invoke("bus", "sfx"), "volumeDb") == -3.0)
        checar("audio.clips", a.invoke("clips").isArray)
        val fonte = s.invoke("spawn", "sound", mapOf("name" to "FonteSonora", "position" to v3(3.0, 1.0, 3.0), "audioSource" to mapOf("trigger" to "manual", "spatial" to true)))
        checar("spawn sound", !fonte["audioSource"].isNullish)
        val fontes = a["sources"]
        fontes.invoke("set", fonte, mapOf("volumeDb" to -4))
        checar("sources.set", numero(fonte["audioSource"], "volumeDb") == -4.0)
        checar("sources.isPlaying", falso(fontes.invoke("isPlaying", fonte)))
        return null
    }

    private fun vfx(): Any? {
        val v = api("vfx")
        val ids = v["templates"].invoke("ids")
        checar("vfx.templates", ids.size > 0)
        checar("vfx.moduleKinds", v.invoke("moduleKinds").size > 0)
        var doc = v.invoke("fromTemplate", ids[0], "DebugFaiscas")
        doc = v.invoke("addEmitter", doc, mapOf("name" to "Extra", "maxParticles" to 50))
        doc = v.invoke("set", doc, mapOf("loop" to true))
        checar("vfx.fromTemplate/addEmitter", doc["emitters"].size >= 2 && verdadeiro(doc["loop"]))
        return v.invoke("save", doc, "DebugFaiscas").invoke("then", Helix.fn { args ->
            val vfx = api("vfx")
            val ativo = arg(args, 0)
            checar("vfx.save", !ativo.isNullish && textoIgual(ativo["kind"], "vfx"))
            val ator = vfx.invoke("emitAt", ativo, v3(0.0, 1.5, -8.0), mapOf("destroyWhenFinished" to false))
            checar("vfx.emitAt", verdadeiro(vfx.invoke("has", ator)))
            vfx.invoke("burst", ator, 20)
            checar("vfx.stats", vfx.invoke("stats")["effects"].isNumber)
            null
        })
    }

                                                                                              

    private fun aoTeclar(e: Value) {
        if (e["repeat"].boolean) return
        when (e["code"].string) {
            "KeyR" -> api("play").invoke("restart")
            "KeyB" -> soltarCaixa()
            "KeyE" -> api("events").invoke("emit", "debug.ping", mapOf("origem" to "teclado", "quadro" to api("time")["frame"]))
            "KeyF" -> api("camera").invoke("shake", 0.4, 0.6)
            "KeyG" -> efeito?.let { fx ->
                val ligado = !fx["enabled"].boolean
                fx["enabled"] = ligado
                info(if (ligado) "Efeito DebugPost ligado" else "Efeito DebugPost desligado")
            }
            "KeyT" -> {
                val tm = api("time")
                tm["scale"] = if (numero(tm, "scale") == 1.0) 0.3 else 1
                info("time.scale = " + numero(tm, "scale"))
            }
            "KeyH" -> tela?.let { t ->
                val g = api("gui")
                if (g.invoke("isShown", t).boolean) g.invoke("hide", t) else g.invoke("show", t, "debug-tela")
            }
            "KeyL" -> info("Luzes locais: " + api("light").invoke("all", mapOf("local" to true)).list.joinToString(", ") { nomeDe(it["entity"]) })
        }
    }

    private fun cliqueNaCena(x: Double, y: Double) {
        val c = api("camera")
        val alvo = c.invoke("pick", x, y)
        val ponto = c.invoke("pickPoint", x, y)
        if (!alvo.isNullish) info("Clique em " + nomeDe(alvo))
        if (!ponto.isNullish) api("debug").invoke("sphere", ponto, 0.3, "#ff006e", 2)
    }

    private fun entrada(): Any? {
        val input = api("input")
        val acoes = input["actions"]
        acoes.invoke("define", "pular", listOf("Space", "Gamepad:0"))
        acoes.invoke("define", "soltar", listOf("KeyB"))
        checar("actions.define/bindings", acoes.invoke("bindings", "pular").size >= 1)
        checar("action()", textoIgual(input.invoke("action", "pular")["name"], "pular") && acoes.invoke("down", "pular").isBoolean)
        checar("isDown", falso(input.invoke("isDown", "KeyW")))
        checar("pointer", input.path("pointer.x").isNumber)
        checar("gamepads", input.invoke("gamepads").isArray)
        checar("axis2d", input.invoke("axis2d", mapOf("up" to "KeyW", "down" to "KeyS", "left" to "KeyA", "right" to "KeyD"))["x"].isNumber)
        val teclas = input.invoke("keysDown")
        checar("keysDown", teclas.isObject || teclas.isArray)
        assinar(input.invoke("onKeyDown", Helix.fn { args -> aoTeclar(arg(args, 0)); null }))
        assinar(input.invoke("onPointerDown", Helix.fn { args ->
            val e = arg(args, 0)
            if (numero(e, "button") == 0.0) cliqueNaCena(numero(e, "x"), numero(e, "y"))
            null
        }))
        assinar(input.invoke("onGamepadButtonDown", Helix.fn { args ->
            val e = arg(args, 0)
            info("Gamepad " + numero(e, "pad") + " botão " + numero(e, "button"))
            null
        }))
        return null
    }

    private fun eventos(): Any? {
        val ev = api("events")
        val play = api("play")
                                                                                        
        var recebido = Value.undefined
        val desligar = ev.invoke("on", "debug.ping", Helix.fn { args -> recebido = arg(args, 0); null })
        checar("events.emit conta ouvintes", ev.invoke("emit", "debug.ping", mapOf("origem" to "teste")).number == 1.0)
        checar("events.on recebe", !recebido.isNullish && textoIgual(recebido["origem"], "teste"))
        checar("listenerCount", ev.invoke("listenerCount", "debug.ping").number == 1.0)
        desligar.call()
        checar("unsubscribe", ev.invoke("listenerCount", "debug.ping").number == 0.0)
        var umaVez = 0
        ev.invoke("once", "debug.once", Helix.fn { umaVez++; null })
        ev.invoke("emit", "debug.once")
        ev.invoke("emit", "debug.once")
        checar("events.once", umaVez == 1)
        assinar(ev.invoke("on", "debug.ping", Helix.fn { args -> info("ping de " + arg(args, 0)["origem"].string); null }))
        assinar(ev.invoke("on", "debug.caixa", Helix.fn { args -> depurar("caixa " + arg(args, 0)["nome"].string); null }))
        var doAtor = 0
        val anel = torus ?: Value.undefined
        assinar(ev.invoke("onEntity", anel, "toque", Helix.fn { doAtor++; null }))
        ev.invoke("emitEntity", anel, "toque")
        checar("onEntity/emitEntity", doAtor == 1)
        assinar(play.invoke("onStopped", Helix.fn { info("play.onStopped disparou"); null }))
        assinar(play.invoke("onPaused", Helix.fn { info("pausado"); null }))
        assinar(play.invoke("onResumed", Helix.fn { info("retomado"); null }))
        return null
    }

                                                                                     
    private fun tempo(): Any? {
        val tm = api("time")
        checar("time.now", numero(tm, "now") >= 0 && numero(tm, "frame") >= 0)
        checar("time.delta", numero(tm, "delta") >= 0 && numero(tm, "fixedDelta") > 0)
        val inicio = numero(tm, "now")
        return tm.invoke("wait", 0.1).invoke("then", Helix.fn {
            val relogio = api("time")
            val decorrido = numero(relogio, "now") - inicio
            checar("time.wait", decorrido >= 0.09, arred(decorrido))
            val quadro = relogio["frame"].int
            relogio.invoke("waitFrames", 2).invoke("then", Helix.fn {
                val depois = api("time")
                val agora = depois["frame"].int
                checar("time.waitFrames", agora >= quadro + 2, agora - quadro)
                assinar(depois.invoke("every", 2, Helix.fn { api("gui").invoke("bind", "atores", api("scene").invoke("count")); null }))
                var disparou = false
                depois.invoke("delay", 0.2, Helix.fn { disparou = true; null })
                depois.invoke("wait", 0.3).invoke("then", Helix.fn { checar("time.delay", disparou); null })
            })
        })
    }

    private fun dados(): Any? {
        return api("storage").invoke("ready").invoke("then", Helix.fn {
            val st = api("storage")
            val atual = st.invoke("get", "execucoes", 0)
            val execucoes = (if (atual.isNumber) atual.int else 0) + 1
            st.invoke("set", "execucoes", execucoes).invoke("then", Helix.fn {
                val storage = api("storage")
                checar("storage.get/set", storage.invoke("get", "execucoes").int == execucoes && storage.invoke("has", "execucoes").boolean, execucoes)
                info("Execução nº " + execucoes + " deste jogo de teste neste projeto.")
                api("assets").invoke("data", "DebugConfig").invoke("then", Helix.fn { config ->
                    val cfg = arg(config, 0)
                    checar("assets.data (TOML)", !cfg.isNullish && !cfg["jogador"].isNullish && numero(cfg["jogador"], "velocidade") == 6.5)
                    api("assets").invoke("text", "DebugConfig").invoke("then", Helix.fn { resposta ->
                        checar("assets.text", arg(resposta, 0).string.contains("velocidade"))
                        val ativos = api("assets")
                        checar("assets.byName", !ativos.invoke("byName", "DebugJogo", "script").isNullish)
                        checar("assets.exists", ativos.invoke("exists", "DebugUtil").boolean && !ativos.invoke("exists", "NaoExiste").boolean)
                        checar("assets.search", ativos.invoke("search", "Debug").size >= 5)
                        checar("project.name", api("project")["name"].isString)
                        checar("project.stats", numero(api("project")["stats"], "entities") > 0)
                        checar("net.localPlayer", verdadeiro(api("net").path("localPlayer.local")))
                        checar("play.state", textoIgual(api("play")["state"], "playing") && verdadeiro(api("play")["isRunning"]))
                        null
                    })
                })
            })
        })
    }

                                                                                                        
    private fun lancar(): Any? {
        throw IllegalStateException("erro proposital: a exceção vira ERRO na cadeia")
    }

                                                                                               

    private val areas = listOf(
        Area("Núcleo", ::nucleo),
        Area("Módulo (require)", ::modulo),
        Area("Matemática", ::matematica),
        Area("Cena", ::cena),
        Area("Transformações", ::transformacao),
        Area("Malhas e CSG", ::malhas),
        Area("Materiais", ::materiais),
        Area("Luzes", ::luzes),
        Area("Céu e mundo", ::ceu),
        Area("Câmera", ::camera),
        Area("Pós-processamento", ::pos),
        Area("Render", ::render),
        Area("Física", ::fisica),
        Area("Personagem e jogador", ::personagem),
        Area("Terreno", ::terreno),
        Area("Interface", ::interfaceGrafica),
        Area("Áudio", ::audio),
        Area("VFX", ::vfx),
        Area("Entrada", ::entrada),
        Area("Eventos", ::eventos),
        Area("Tempo e tarefas", ::tempo),
        Area("Dados, projeto e rede", ::dados),
        Area("Erro proposital (exceção Kotlin)", ::lancar, esperaErro = true),
    )

    private fun areaOk(a: Area) {
        if (a.esperaErro) {
            checar("a exceção deveria ter chegado à cadeia", false)
            return
        }
        depurar("ok " + a.nome)
    }

    private fun areaErro(a: Area, causa: Value) {
        val mensagem = if (causa.isObject) causa["message"].string else causa.string
        if (a.esperaErro) {
            checar("a exceção chega como erro da promessa", mensagem.contains("proposital"), mensagem)
            return
        }
        falhas++
        erro("ERRO em " + a.nome + ": " + mensagem)
    }

                                                                                                   
    private fun encadear(promessa: Value, a: Area): Value {
        val depois = promessa.invoke("then", Helix.fn { a.rodar() })
        return depois.invoke("then", Helix.fn { areaOk(a); null }, Helix.fn { args -> areaErro(a, arg(args, 0)); null })
    }

    private fun finalizar() {
        val girador = api("assets").invoke("byName", "DebugGirador", "script")
        if (!girador.isNullish) {
            val extra = api("scene").invoke("spawnPrimitive", "box", mapOf(
                "name" to "GiradorDinamico",
                "position" to v3(-2.0, 0.5, -3.0),
                "rigidBody" to mapOf("type" to "kinematic", "collider" to "box"),
                "script" to mapOf("assetId" to girador["id"], "props" to mapOf("velocidade" to 180, "cor" to "#00b4d8"))
            ))
            checar("spawn com script", !extra["script"].isNullish && extra.path("script.assetId") == girador["id"])
        } else {
            checar("ativo DebugGirador", false, "não está na biblioteca")
        }
        val dica = "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia."
        if (falhas == 0) info("API percorrida em " + linguagem + ": " + checagens + " checagens, nenhuma falha. " + dica)
        else aviso("API percorrida em " + linguagem + ": " + checagens + " checagens, " + falhas + " falhas (veja FALHOU/ERRO acima). " + dica)
        api("gui").invoke("bind", "checagens", checagens)
        api("gui").invoke("bind", "falhas", falhas)
    }

                                                                                              
`;
}
