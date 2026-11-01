import type { GameSources } from '../types';
export function pythonGame(): GameSources {
    const entry = `                                   
                                                                                   
                                                                                  
import math
import DebugUtil

LINGUAGEM = "Python"


class Estado:
    quadros = 0
    passos_fisica = 0
    late_updates = 0
    renders = 0
    colisoes = 0
    checagens = 0
    falhas = 0
    pontos = 0
    hud_timer = 0.0
    torus = None
    heroi = None
    efeito = None
    tela = None
    assinaturas = []


estado = Estado()


def checar(nome, condicao, detalhe=None):
    estado.checagens += 1
    if condicao:
        return
    estado.falhas += 1
    sufixo = "" if detalhe is None else f": {detalhe}"
    helix.log.error("Debug", f"FALHOU {nome}{sufixo}")


async def area(nome, fn):
    try:
        resultado = fn()
        if hasattr(resultado, "__await__"):
            await resultado
        helix.log.debug("Debug", f"ok {nome}")
    except Exception as erro:
        estado.falhas += 1
        helix.log.error("Debug", f"ERRO em {nome}: {erro}")


def aprox(a, b, epsilon=0.001):
    return abs(a - b) <= epsilon


def assinar(desligar):
    estado.assinaturas.append(desligar)


def mesmo(a, b):
    return a is not None and b is not None and a.id == b.id


                                                                                              

def nucleo():
    checar("engine.name", isinstance(helix.engine.name, str) and len(helix.engine.name) > 0)
    checar("engine.version", isinstance(helix.engine.version, str))
    checar("isPlaying", helix.isPlaying is True)
    checar("isEditor", helix.isEditor is False)
    checar("self no script de entrada", helix.self is None)
    helix.log.info("Debug", f"{helix.engine.name} {helix.engine.version} · API {helix.engine.apiVersion} · {LINGUAGEM}")


def modulo():
    checar("import soma", DebugUtil.soma(2, 3) == 5, DebugUtil.soma(2, 3))
    checar("import saudacao", DebugUtil.saudacao("Helix") == "Olá, Helix", DebugUtil.saudacao("Helix"))
    checar("import limitar", DebugUtil.limitar(15, 0, 10) == 10)


def matematica():
    m = helix.math
    v = m.vec3.add([1, 2, 3], [1, 1, 1])
    checar("vec3.add", m.vec3.equals(v, [2, 3, 4]))
    checar("vec3.length", aprox(m.vec3.length([3, 4, 0]), 5))
    checar("vec3.normalize", aprox(m.vec3.length(m.vec3.normalize([0, 5, 0])), 1))
    checar("vec3.cross", m.vec3.equals(m.vec3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]))
    checar("vec3.lerp", m.vec3.equals(m.vec3.lerp([0, 0, 0], [2, 2, 2], 0.5), [1, 1, 1]))
    q = m.quat.fromEuler([0, 90, 0])
    checar("quat.rotateVec3", m.vec3.equals(m.quat.rotateVec3(q, [1, 0, 0]), [0, 0, -1], 0.001))
    checar("quat.toEuler", aprox(m.quat.toEuler(q)[1], 90, 0.01))
    mat = m.mat4.fromTRS([1, 2, 3], [0, 0, 0], [1, 1, 1])
    checar("mat4.transformPoint", m.vec3.equals(m.mat4.transformPoint(mat, [0, 0, 0]), [1, 2, 3]))
    checar("mat4.invert", m.mat4.invert(mat) is not None)
    caixa = m.aabb.fromCenterSize([0, 0, 0], [2, 2, 2])
    checar("aabb.contains", m.aabb.contains(caixa, [0.5, 0.5, 0.5]) and not m.aabb.contains(caixa, [2, 0, 0]))
    raio = m.ray.create([0, 5, 0], [0, -1, 0])
    checar("ray.intersectAabb", m.ray.intersectAabb(raio, caixa) is not None)
    checar("scalar.remap", m.scalar.remap(5, 0, 10, 0, 100) == 50)
    checar("clamp/lerp", m.clamp(15, 0, 10) == 10 and m.lerp(0, 10, 0.5) == 5)
    checar("scalar.wrapAngle", aprox(m.scalar.wrapAngle(370), 10))
    checar("degToRad", aprox(m.degToRad(180), math.pi))
    ruido = m.noise.perlin2(0.3, 0.7)
    checar("noise.perlin2", -1.01 <= ruido <= 1.01, ruido)
    checar("noise.fbm", isinstance(m.noise.fbm(1.5, 2.5, 0, 4), (int, float)))
    checar("color.hexToVec3", m.vec3.equals(m.color.hexToVec3("#ff0000"), [1, 0, 0], 0.01))
    checar("color.vec3ToHex", m.color.vec3ToHex([1, 1, 1]).lower() == "#ffffff", m.color.vec3ToHex([1, 1, 1]))
    m.random.seed(42)
    a = m.random.value()
    m.random.seed(42)
    checar("random.seed determinístico", m.random.value() == a)
    sorteado = m.random.int(1, 6)
    checar("random.int", 1 <= sorteado <= 6 and float(sorteado).is_integer())
    checar("random.unitVector", aprox(m.vec3.length(m.random.unitVector()), 1))
    checar("PI/TAU", aprox(m.TAU, m.PI * 2))


                                                                                                    

def cena():
    s = helix.scene
    checar("scene.root", s.root is not None)
    antes = s.count()
    grupo = s.spawn("group", {"name": "DebugCenario"})
    chao = s.spawn("mesh", {
        "name": "Chao",
        "mesh": helix.mesh.plane(40, 40),
        "material": helix.material.create({"baseColor": "#4b6b3a", "roughness": 0.95}),
        "rigidBody": {"type": "static", "collider": "box", "boxSize": [40, 0.2, 40], "center": [0, -0.1, 0]},
        "receiveShadows": True,
        "tags": ["chao"],
    }, grupo)
    checar("spawn mesh", chao.kind == "mesh" and chao.mesh is not None and chao.rigidBody is not None)
    checar("find", mesmo(s.find("Chao"), chao))
    checar("findAll", len(s.findAll("Chao")) == 1)
    checar("byId", mesmo(s.byId(chao.id), chao))
    checar("byTag", len(s.byTag("chao")) >= 1)
    checar("byKind", len(s.byKind("mesh")) >= 1)
    checar("count", s.count() == antes + 2, f"{s.count()} vs {antes + 2}")
    checar("contains", s.contains(grupo, chao) and s.contains(s.root, chao))
    checar("path", "Chao" in s.path(chao), s.path(chao))
    visitados = [0]

    def visitar(_entidade):
        visitados[0] += 1

    s.traverse(visitar, grupo)
    checar("traverse", visitados[0] >= 2, visitados[0])

    torus = s.spawnPrimitive("torus", {"name": "Anel", "position": [-4, 1.2, -2], "scale": 1.5}, grupo)
    helix.material.setColor(torus, "#3a86ff")
    helix.material.setEmissive(torus, "#3a86ff", 0.6)
    estado.torus = torus
    checar("spawnPrimitive", torus.mesh is not None and torus.material is not None)

    copia = s.clone(torus, True, grupo)
    s.rename(copia, "AnelCopia")
    helix.transform.setPosition(copia, [-4, 1.2, 2])
    checar("clone + rename", copia.name == "AnelCopia" and mesmo(s.find("AnelCopia"), copia))
    s.setMeta(copia, "origem", "clone")
    checar("meta", s.getMeta(copia, "origem") == "clone")
    s.addTag(copia, "temporario")
    checar("addTag/hasTag", s.hasTag(copia, "temporario"))
    checar("removeTag", s.removeTag(copia, "temporario") is True and not s.hasTag(copia, "temporario"))
    s.setVisible(copia, False)
    checar("setVisible", copia.visible is False)
    s.setVisible(copia, True)
    s.destroy(copia)
    checar("destroy", s.find("AnelCopia") is None and not s.isAttached(copia))

    esfera = s.spawnPrimitive("sphere", {"name": "Esfera", "position": [4, 0.5, -3]})
    s.reparent(esfera, grupo)
    checar("reparent", mesmo(esfera.parent, grupo))
    helix.material.setColor(esfera, "#ffbe0b")
    s.addComponent(esfera, "rigidBody", {"type": "dynamic", "collider": "sphere", "radius": 0.5, "mass": 1})
    checar("addComponent", esfera.rigidBody is not None and esfera.rigidBody.type == "dynamic")
    temporario = s.spawnPrimitive("box", {"name": "Temporario"})
    s.addComponent(temporario, "csg", {})
    checar("addComponent csg", temporario.csg is not None)
    s.removeComponent(temporario, "csg")
    checar("removeComponent", temporario.csg is None)
    s.destroy(temporario)


def transformacao():
    tr = helix.transform
    m = helix.math
    alvo = helix.scene.spawnPrimitive("cone", {"name": "Cone", "position": [0, 0.5, -6]})
    helix.material.setColor(alvo, "#8338ec")
    tr.setPosition(alvo, [2, 0.5, -6])
    checar("setPosition", m.vec3.equals(tr.position(alvo), [2, 0.5, -6]))
    tr.translate(alvo, [0, 1, 0], "world")
    checar("translate", aprox(tr.position(alvo)[1], 1.5))
    tr.setRotation(alvo, [0, 90, 0])
    checar("setRotation", aprox(tr.rotation(alvo)[1], 90, 0.01))
    tr.setScale(alvo, 2)
    checar("setScale", aprox(tr.scale(alvo)[0], 2))
    tr.setScale(alvo, [1, 1, 1])
    checar("worldPosition", len(tr.worldPosition(alvo)) == 3)
    checar("forward/up", aprox(m.vec3.length(tr.forward(alvo)), 1) and aprox(m.vec3.length(tr.up(alvo)), 1))
    tr.lookAt(alvo, [0, 1.5, 0])
    checar("distance", tr.distance(alvo, [2, 1.5, -6]) < 0.01)
    checar("directionTo", aprox(m.vec3.length(tr.directionTo(alvo, [0, 1.5, 0])), 1))
    checar("bounds", tr.bounds(alvo) is not None)
    checar("worldMatrix", len(tr.worldMatrix(alvo)) == 16)


def malhas():
    me = helix.mesh
    caixa = me.box(1, 1, 1)
    checar("mesh.box", me.vertexCount(caixa) > 0 and me.triangleCount(caixa) == 12, me.triangleCount(caixa))
    esfera = me.sphere(0.65, 16, 12)
    furado = helix.csg.boolean(caixa, esfera, "subtract")
    checar("csg.boolean", me.triangleCount(furado) > 12)
    ator = helix.scene.spawn("mesh", {"name": "CaixaFurada", "mesh": furado, "material": helix.material.create({"baseColor": "#e63946", "roughness": 0.4, "metallic": 0.2}), "position": [4, 0.5, 2]})
    checar("spawn malha CSG", ator.mesh is not None)
    tri = me.create({"name": "Triangulo", "positions": [-1, 0, 0, 1, 0, 0, 0, 1.5, 0], "uvs": [0, 0, 1, 0, 0.5, 1], "indices": [0, 1, 2]})
    me.computeNormals(tri)
    checar("mesh.create + computeBounds", me.computeBounds(tri).max[1] >= 1.5)
    dupla = me.merge(tri, me.flipWinding(me.clone(tri)))
    checar("mesh.merge", me.triangleCount(dupla) == 2)
    helix.scene.spawn("mesh", {"name": "Triangulo", "mesh": dupla, "material": helix.material.create({"baseColor": "#06d6a0", "doubleSided": True}), "position": [7, 0, -2]})
    grande = me.scale(me.translate(me.clone(caixa), [0, 0.5, 0]), 2)
    checar("mesh.translate/scale", me.computeBounds(grande).max[1] > 1.9)
    dist = me.raycast(helix.math.ray.create([0, 5, 0], [0, -1, 0]), grande)
    checar("mesh.raycast", dist is not None and dist > 0, dist)
    checar("primitivas extras", me.triangleCount(me.torusKnot()) > 0 and me.triangleCount(me.capsule()) > 0)


                                                                                                        

def materiais():
    mat = helix.material
    base = mat.create({"name": "DebugBase", "baseColor": "#d98c2b", "roughness": 0.5, "metallic": 0.1})
    checar("material.create", base.roughness == 0.5)
    copia = mat.clone(base)
    mat.set(copia, {"roughness": 1, "emissive": "#ffffff", "emissiveIntensity": 2})
    checar("material.clone/set", copia.roughness == 1 and base.roughness == 0.5)
    caixa = helix.scene.spawnPrimitive("box", {"name": "CaixaPintada", "position": [-7, 0.5, 2]})
    mat.assign(caixa, base)
    checar("material.assign/of", mat.of(caixa) is not None)
    mat.own(caixa)
    mat.setColor(caixa, "#d98c2b")
    checar("materials.list", isinstance(helix.materials.list(), list))
    sombreado = mat.fromShader("DebugSuperficie", {"glow": [1, 0.45, 0.1], "speed": 2})
    checar("material.fromShader", sombreado is not None)
    if sombreado is not None:
        esfera = helix.scene.spawnPrimitive("sphere", {"name": "EsferaShader", "position": [0, 1, -3], "scale": 1.4})
        mat.assign(esfera, sombreado)
        mat.uniforms(esfera).set("speed", 3)
        checar("material.uniforms.list", len(mat.uniforms(esfera).list()) >= 1)


def luzes():
    l = helix.light
    lampada = l.spawn("point", {"name": "Lampada", "position": [0, 3, 0], "color": "#ffd166", "intensity": 60, "range": 14})
    checar("light.spawn", lampada.light is not None and lampada.light.type == "point")
    l.set(lampada, {"intensity": 80})
    checar("light.set", lampada.light.intensity == 80)
    l.setTemperature(lampada, 3200)
    foco = l.spawn("spot", {"name": "Holofote", "position": [4, 4, 0], "rotation": [-90, 0, 0], "intensity": 120, "range": 16, "innerAngle": 20, "outerAngle": 35, "color": "#ffffff"})
    checar("spot", foco.light.type == "spot")
    checar("light.presets", len(l.presets()) > 0)
    checar("light.all", len(l.all({"local": True})) >= 2)
    checar("effectiveRange", l.effectiveRange(lampada) > 0)
    checar("light.isLocal", l.isLocal(lampada))
    l.setColor(lampada, "#ffffff")


def ceu():
    sky = helix.sky
    sky.set({"timeOfDay": 10.5, "haze": 0.3, "clouds": {"enabled": True, "coverage": 0.45}})
    checar("sky.set", aprox(sky.timeOfDay, 10.5) and sky.clouds.enabled is True)
    checar("sky.isDay", sky.isDay is True)
    checar("sky.sunDirection", sky.sunDirection()[1] > 0)
    checar("sky.wrapTimeOfDay", sky.wrapTimeOfDay(25) == 1)
    checar("sky.presets", len(sky.presets()) > 0)
    assinar(sky.onHourChanged(lambda h: helix.log.info("Debug", f"Hora do céu: {h}")))
    sky.cycleSpeed = 0
    checar("sky.cycleSpeed", sky.cycleSpeed == 0)
    checar("world.gravity", helix.world.gravity[1] < 0)
    helix.world.wind.set({"speed": 2, "direction": 45})
    checar("world.wind.set", helix.world.wind.speed == 2)
`;
}
