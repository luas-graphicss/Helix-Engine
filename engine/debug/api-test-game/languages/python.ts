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


def camera():
    c = helix.camera
    checar("camera.fov", c.fov > 0 and c.aspect > 0)
    checar("camera.near/far", c.near > 0 and c.far > c.near)
    checar("viewport", c.viewport.width > 0)
    tela = c.worldToScreen([0, 0, 0])
    checar("worldToScreen", tela is None or isinstance(tela.x, (int, float)))
    raio = c.screenToRay(c.viewport.width / 2, c.viewport.height / 2)
    checar("screenToRay", raio is None or aprox(helix.math.vec3.length(raio.direction), 1, 0.01))
    checar("viewMatrix", len(c.viewMatrix) == 16)
    c.player.set({"distance": 7, "pitch": 18})
    checar("player.set", c.player.settings.distance == 7)
    checar("distanceTo", c.distanceTo([0, 0, 0]) >= 0)
    checar("camera.position", len(c.position) == 3 and len(c.forward) == 3)
    assinar(c.onMainChanged(lambda e: helix.log.info("Debug", f"Câmera principal: {e.name if e else 'editor/jogador'}")))


def pos():
    p = helix.post
    checar("post.toneMappers", len(p.toneMappers()) > 0)
    p.set({
        "bloom": {"enabled": True, "intensity": 0.5, "threshold": 1, "softKnee": 0.5, "radius": 0.6},
        "vignette": {"enabled": True, "intensity": 0.35, "smoothness": 0.5, "roundness": 1},
    })
    checar("post.set", p.bloom.enabled is True and p.vignette.enabled is True)
    p.exposure = 1.05
    checar("post.exposure", aprox(p.exposure, 1.05))
    p.toneMapper = "agx"
    checar("post.toneMapper", p.toneMapper == "agx")
    checar("post.presets", len(p.presets()) > 0)
    efeito = p.custom.add({"fragment": "DebugPost", "name": "DebugPost", "uniforms": {"tint": [0.15, 0.05, 0.3], "strength": 0.6}})
    estado.efeito = efeito
    checar("post.custom.add", efeito is not None and p.custom.get("DebugPost") is not None)
    efeito.uniforms.set("strength", 0.8)
    checar("efeito.uniforms.list", len(efeito.uniforms.list()) >= 2)


def render():
    r = helix.render
    checar("render.passNames", len(r.passNames()) > 0)
    checar("render.stats", isinstance(r.stats.drawCalls, (int, float)))
    checar("render.frame", isinstance(r.frame.width, (int, float)))

    def contar():
        estado.renders += 1

    assinar(r.onAfterFrame(contar))
    r.showGrid = False
    checar("render.showGrid", r.showGrid is False)
    checar("render.pixelRatio", r.pixelRatio > 0)


                                                                                                    

def fisica():
    ph = helix.physics
    checar("physics.enabled", ph.enabled is True)
    checar("physics.gravity", ph.gravity[1] < 0)
    checar("physics.settings", ph.settings.fixedTimestep > 0)
    for i in range(5):
        caixa = helix.scene.spawnPrimitive("box", {"name": f"Caixa{i + 1}", "position": [-2 + i * 1.1, 3 + i * 1.2, 3], "rigidBody": {"type": "dynamic", "collider": "box", "mass": 2, "restitution": 0.3}, "tags": ["caixa"]})
        helix.material.setColor(caixa, helix.math.color.hsl(30 + i * 12, 0.7, 0.5))
    caixas = helix.scene.byTag("caixa")
    checar("caixas dinâmicas", len(caixas) == 5 and ph.hasBody(caixas[0]))
    corpo = ph.bodyOf(caixas[0])
    checar("bodyOf", corpo.isDynamic and corpo.mass > 0)
    corpo.applyImpulse([0, 2, 0])
    corpo.applyTorque([0, 1, 0])
    corpo.setMaterial({"friction": 0.8})
    corpo.wake()
    checar("body.linearVelocity", len(corpo.linearVelocity) == 3)
    checar("bodies()", len(ph.bodies()) >= 6)
    hit = ph.raycast([0, 5, 0], [0, -1, 0], 20)
    checar("physics.raycast", hit is not None and hit.entity is not None, hit.entity.name if hit and hit.entity else None)
    checar("raycastAll", len(ph.raycastAll([0, 5, 0], [0, -1, 0], 20)) >= 1)
    checar("overlapSphere", isinstance(ph.overlapSphere([0, 3, 3], 4), list))
    checar("massProperties", ph.massProperties(caixas[0]).mass > 0)
    checar("colliderVolume", ph.colliderVolume(caixas[0]) > 0)
    checar("shapes.sphere volume", aprox(ph.shapes.volume(ph.shapes.sphere(1)), 4.18879, 0.01))

    def colidiu(e):
        estado.colisoes += 1
        if estado.colisoes <= 3:
            helix.log.info("Debug", f"Colisão: {e.a.name} × {e.b.name} (impulso {e.contact.impulse:.2f})")

    assinar(ph.onCollisionBegin(colidiu))
    assinar(ph.onOutOfBounds(lambda e: helix.log.warn("Debug", f"{e.name} caiu do mundo")))
    gatilho = helix.scene.spawn("group", {"name": "Gatilho", "position": [0, 1, 3], "trigger": {"shape": "box", "size": [3, 2, 3]}})
    checar("trigger spawn", gatilho is not None and helix.scene.isAttached(gatilho))
    checar("physics.stats", isinstance(ph.stats.bodies, (int, float)))


def personagem():
    heroi = helix.character.spawn({"name": "Heroi", "position": [0, 1.2, 8], "character": {"walkSpeed": 4, "runSpeed": 7, "jumpHeight": 1.4}})
    estado.heroi = heroi
    checar("character.spawn", heroi.character is not None and helix.character.has(heroi))
    h = helix.character.of(heroi)
    checar("character.of", isinstance(h.isGrounded, bool))
    checar("settingsOf", helix.character.settingsOf(heroi).walkSpeed == 4)
    helix.player.possess(heroi)
    checar("player.possess", mesmo(helix.player.possessed, heroi) and helix.player.isPossessing)
    assinar(helix.character.onJumped(lambda e: helix.log.info("Debug", f"{e.entity.name} pulou")))
    assinar(helix.player.onPossessed(lambda e: helix.log.info("Debug", f"Possuindo {e.name if e else 'ninguém'}")))
    checar("character.all", len(helix.character.all()) >= 1)
    checar("player.spawnPoint", len(helix.player.spawnPoint) == 3)
    checar("character.velocity", len(h.velocity) == 3 and len(h.position) == 3)


def terreno():
    te = helix.terrain
    checar("terrain.presets", len(te.presets()) > 0)
    colinas = te.spawn({"name": "Colinas", "size": 48, "resolution": 65, "preset": "hills", "seed": 7, "position": [0, -6, -70]})
    checar("terrain.spawn", colinas.terrain is not None and len(te.all()) >= 1)
    checar("terrain.of", te.of(colinas).resolution == 65)
    altura = te.heightAt([0, 0, -70], colinas)
    checar("heightAt", altura is not None and isinstance(altura, (int, float)), altura)
    checar("contains", te.contains([0, 0, -70], colinas) and not te.contains([500, 0, 0], colinas))
    te.sculpt(colinas, "raise", [5, 0, -70], {"radius": 6, "strength": 1}, 1)
    te.markDirty(colinas)
    te.grass.set(colinas, {"enabled": True, "density": 0.5})
    checar("grass.set", te.grass.settingsOf(colinas).enabled is True)
    te.water.set(colinas, {"enabled": True, "level": -2})
    checar("water.set", te.water.settingsOf(colinas).enabled is True)
    checar("terrain.raycast", te.raycast([0, 50, -70], [0, -1, 0], colinas) is not None)


                                                                                                   

async def interface_grafica():
    g = helix.gui
    g.css("DebugEstilo")
    hud = g.html("DebugHud", {"id": "debug-hud"})
    checar("gui.html", hud is not None and g.element("#debug-hud") is not None)
    icone = g.svg("DebugIcone", {"id": "debug-icone"})
    checar("gui.svg", icone is not None)
    slot = g.element("[data-slot=icone]")
    if slot is not None and icone is not None:
        slot.appendChild(icone)
    checar("gui.bind", g.bind("linguagem", LINGUAGEM) >= 1)
    g.bind("titulo", "Helix · Debug")
    assinar(g.onAction("caixa", lambda *_: soltar_caixa()))
    assinar(g.onAction("reiniciar", lambda *_: helix.play.restart()))
    checar("gui.elements", len(g.elements("[data-bind]")) >= 5)
    checar("gui.size", g.size.width > 0)
    tela = g.create("DebugTela", {"referenceSize": {"x": 1280, "y": 720}})
    painel = g.add(tela, "frame", {"name": "Painel", "rect": {"position": {"x": {"scale": 1, "offset": -236}, "y": {"scale": 0, "offset": 16}}, "size": {"x": {"scale": 0, "offset": 220}, "y": {"scale": 0, "offset": 48}}}})
    g.add(tela, "text", {"name": "Rotulo", "text": "Tela declarativa OK"}, painel.node.id)
    checar("gui.add/find", g.find(tela, "Rotulo").kind == "text")
    g.setText(tela, "Rotulo", f"Tela declarativa OK · {LINGUAGEM}")
    estado.tela = await g.show(tela, "debug-tela")
    checar("gui.show/isShown", g.isShown(estado.tela))
    checar("gui.kinds", isinstance(g.kinds(), list))


def audio():
    a = helix.audio
    checar("audio.supported", isinstance(a.supported, bool))
    a.mixer.setVolumeDb("sfx", -3)
    checar("mixer.setVolumeDb", a.mixer.bus("sfx").volumeDb == -3)
    checar("audio.clips", isinstance(a.clips(), list))
    fonte = helix.scene.spawn("sound", {"name": "FonteSonora", "position": [3, 1, 3], "audioSource": {"trigger": "manual", "spatial": True}})
    checar("spawn sound", fonte.audioSource is not None)
    a.sources.set(fonte, {"volumeDb": -4})
    checar("sources.set", fonte.audioSource.volumeDb == -4)
    checar("sources.isPlaying", a.sources.isPlaying(fonte) is False)


async def vfx():
    v = helix.vfx
    ids = v.templates.ids()
    checar("vfx.templates", len(ids) > 0)
    checar("vfx.moduleKinds", len(v.moduleKinds()) > 0)
    doc = v.fromTemplate(ids[0], "DebugFaiscas")
    doc = v.addEmitter(doc, {"name": "Extra", "maxParticles": 50})
    doc = v.set(doc, {"loop": True})
    checar("vfx.fromTemplate/addEmitter", len(doc.emitters) >= 2 and doc.loop is True)
    ativo = await v.save(doc, "DebugFaiscas")
    checar("vfx.save", ativo.kind == "vfx")
    ator = v.emitAt(ativo, [0, 1.5, -8], {"destroyWhenFinished": False})
    checar("vfx.emitAt", v.has(ator))
    v.burst(ator, 20)
    checar("vfx.stats", isinstance(v.stats().effects, (int, float)))


                                                                                                   

def soltar_caixa():
    caixa = helix.scene.spawnPrimitive("box", {"name": "CaixaSolta", "position": [helix.math.random.range(-3, 3), 6, helix.math.random.range(0, 4)], "rigidBody": {"type": "dynamic", "collider": "box", "mass": 1}, "tags": ["caixa"]})
    helix.material.setColor(caixa, helix.math.random.color())
    estado.pontos += 1
    helix.gui.bind("pontos", estado.pontos)
    helix.events.emit("debug.caixa", {"nome": caixa.name})


def ao_teclar(e):
    if e.repeat:
        return
    codigo = e.code
    if codigo == "KeyR":
        helix.play.restart()
    elif codigo == "KeyB":
        soltar_caixa()
    elif codigo == "KeyE":
        helix.events.emit("debug.ping", {"origem": "teclado", "quadro": helix.time.frame})
    elif codigo == "KeyF":
        helix.camera.shake(0.4, 0.6)
    elif codigo == "KeyG":
        if estado.efeito is not None:
            estado.efeito.enabled = not estado.efeito.enabled
            helix.log.info("Debug", f"Efeito DebugPost {'ligado' if estado.efeito.enabled else 'desligado'}")
    elif codigo == "KeyT":
        helix.time.scale = 0.3 if helix.time.scale == 1 else 1
        helix.log.info("Debug", f"time.scale = {helix.time.scale}")
    elif codigo == "KeyH":
        if estado.tela is not None:
            if helix.gui.isShown(estado.tela):
                helix.gui.hide(estado.tela)
            else:
                helix.gui.show(estado.tela, "debug-tela")
    elif codigo == "KeyL":
        nomes = [luz.entity.name for luz in helix.light.all({"local": True})]
        helix.log.info("Debug", "Luzes locais: " + ", ".join(nomes))


def clique_na_cena(x, y):
    alvo = helix.camera.pick(x, y)
    ponto = helix.camera.pickPoint(x, y)
    if alvo is not None:
        helix.log.info("Debug", f"Clique em {alvo.name}")
    if ponto is not None:
        helix.debug.sphere(ponto, 0.3, "#ff006e", 2)


def entrada():
    i = helix.input
    i.actions.define("pular", ["Space", "Gamepad:0"])
    i.actions.define("soltar", ["KeyB"])
    checar("actions.define/bindings", len(i.actions.bindings("pular")) >= 1)
    checar("action()", i.action("pular").name == "pular" and isinstance(i.actions.down("pular"), bool))
    checar("isDown", i.isDown("KeyW") is False)
    checar("pointer", isinstance(i.pointer.x, (int, float)))
    checar("gamepads", isinstance(i.gamepads(), list))
    checar("axis2d", isinstance(i.axis2d({"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD"}).x, (int, float)))
    checar("keysDown", isinstance(i.keysDown(), list))
    assinar(i.onKeyDown(ao_teclar))

    def ao_clicar(e):
        if e.button == 0:
            clique_na_cena(e.x, e.y)

    assinar(i.onPointerDown(ao_clicar))
    assinar(i.onGamepadButtonDown(lambda e: helix.log.info("Debug", f"Gamepad {e.pad} botão {e.button}")))


def eventos():
    ev = helix.events
    recebido = [None]

    def guardar(p):
        recebido[0] = p

    off = ev.on("debug.ping", guardar)
    checar("events.emit conta ouvintes", ev.emit("debug.ping", {"origem": "teste"}) == 1)
    checar("events.on recebe", recebido[0] is not None and recebido[0].origem == "teste")
    checar("listenerCount", ev.listenerCount("debug.ping") == 1)
    off()
    checar("unsubscribe", ev.listenerCount("debug.ping") == 0)
    uma_vez = [0]

    def contar(*_):
        uma_vez[0] += 1

    ev.once("debug.once", contar)
    ev.emit("debug.once")
    ev.emit("debug.once")
    checar("events.once", uma_vez[0] == 1)
    assinar(ev.on("debug.ping", lambda p: helix.log.info("Debug", f"ping de {p.origem}")))
    assinar(ev.on("debug.caixa", lambda p: helix.log.debug("Debug", f"caixa {p.nome}")))
`;
}
