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
`;
}
