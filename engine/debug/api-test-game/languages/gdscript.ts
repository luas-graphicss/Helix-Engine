import type { GameSources } from '../types';
export function gdscriptGame(): GameSources {
    const entry = `                                   
                                                                                   
                                                                                  
extends Node

const LINGUAGEM := "GDScript"

var quadros := 0
var passos_fisica := 0
var late_updates := 0
var renders := 0
var colisoes := 0
var checagens := 0
var falhas := 0
var pontos := 0
var hud_timer := 0.0
var torus = null
var heroi = null
var efeito = null
var tela = null
var assinaturas: Array = []
var _area_ok := false


func checar(nome: String, condicao, detalhe = null) -> void:
	checagens += 1
	if condicao:
		return
	falhas += 1
	var sufixo := "" if detalhe == null else ": " + str(detalhe)
	helix.log.error("Debug", "FALHOU " + nome + sufixo)


                                                                                                              
func _rodar(fn: Callable) -> void:
	await fn.call()
	_area_ok = true


func area(nome: String, fn: Callable) -> void:
	_area_ok = false
	var tarefa = helix.task.spawn(_rodar.bind(fn))
	await tarefa.done
	if _area_ok:
		helix.log.debug("Debug", "ok " + nome)
	else:
		falhas += 1
		helix.log.error("Debug", "ERRO em " + nome + ": a área parou antes do fim (veja o erro acima).")


func aprox(a: float, b: float, epsilon := 0.001) -> bool:
	return abs(a - b) <= epsilon


func assinar(desligar) -> void:
	if desligar is Callable:
		assinaturas.append(desligar)


                                                                                              

func nucleo() -> void:
	checar("engine.name", helix.engine.name is String and helix.engine.name.length() > 0)
	checar("engine.version", helix.engine.version is String)
	checar("context", helix.context in ["shared", "client", "server"], helix.context)
	checar("isPlaying", helix.isPlaying == true)
	checar("isEditor", helix.isEditor == false)
	checar("self no script de entrada", helix.self == null)
	helix.log.info("Debug", str(helix.engine.name) + " " + str(helix.engine.version) + " · API " + str(helix.engine.apiVersion) + " · " + LINGUAGEM)


func modulo() -> void:
	checar("class_name soma", DebugUtil.soma(2, 3) == 5, DebugUtil.soma(2, 3))
	checar("class_name saudacao", DebugUtil.saudacao("Helix") == "Olá, Helix", DebugUtil.saudacao("Helix"))
	checar("class_name limitar", DebugUtil.limitar(15, 0, 10) == 10)
	var carregado = load("res://DebugUtil.gd")
	checar("load(res://DebugUtil.gd)", carregado != null)


func matematica() -> void:
	var m = helix.math
	var v = m.vec3.add([1, 2, 3], [1, 1, 1])
	checar("vec3.add", m.vec3.equals(v, [2, 3, 4]))
	checar("vec3.length", aprox(m.vec3.length([3, 4, 0]), 5))
	checar("vec3.normalize", aprox(m.vec3.length(m.vec3.normalize([0, 5, 0])), 1))
	checar("vec3.cross", m.vec3.equals(m.vec3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]))
	checar("vec3.lerp", m.vec3.equals(m.vec3.lerp([0, 0, 0], [2, 2, 2], 0.5), [1, 1, 1]))
	var q = m.quat.fromEuler([0, 90, 0])
	checar("quat.rotateVec3", m.vec3.equals(m.quat.rotateVec3(q, [1, 0, 0]), [0, 0, -1], 0.001))
	checar("quat.toEuler", aprox(m.quat.toEuler(q)[1], 90, 0.01))
	var mat = m.mat4.fromTRS([1, 2, 3], [0, 0, 0], [1, 1, 1])
	checar("mat4.transformPoint", m.vec3.equals(m.mat4.transformPoint(mat, [0, 0, 0]), [1, 2, 3]))
	checar("mat4.invert", m.mat4.invert(mat) != null)
	var caixa = m.aabb.fromCenterSize([0, 0, 0], [2, 2, 2])
	checar("aabb.contains", m.aabb.contains(caixa, [0.5, 0.5, 0.5]) and not m.aabb.contains(caixa, [2, 0, 0]))
	var raio = m.ray.create([0, 5, 0], [0, -1, 0])
	checar("ray.intersectAabb", m.ray.intersectAabb(raio, caixa) != null)
	checar("scalar.remap", m.scalar.remap(5, 0, 10, 0, 100) == 50)
	checar("clamp/lerp", m.clamp(15, 0, 10) == 10 and m.lerp(0, 10, 0.5) == 5)
	checar("scalar.wrapAngle", aprox(m.scalar.wrapAngle(370), 10))
	checar("degToRad", aprox(m.degToRad(180), PI))
	var ruido = m.noise.perlin2(0.3, 0.7)
	checar("noise.perlin2", ruido >= -1.01 and ruido <= 1.01, ruido)
	checar("noise.fbm", m.noise.fbm(1.5, 2.5, 0, 4) is float)
	checar("color.hexToVec3", m.vec3.equals(m.color.hexToVec3("#ff0000"), [1, 0, 0], 0.01))
	checar("color.vec3ToHex", str(m.color.vec3ToHex([1, 1, 1])).to_lower() == "#ffffff", m.color.vec3ToHex([1, 1, 1]))
	m.random.seed(42)
	var a = m.random.value()
	m.random.seed(42)
	checar("random.seed determinístico", m.random.value() == a)
	var sorteado = m.random.int(1, 6)
	checar("random.int", sorteado >= 1 and sorteado <= 6 and sorteado is int)
	checar("random.unitVector", aprox(m.vec3.length(m.random.unitVector()), 1))
	checar("PI/TAU", aprox(m.TAU, m.PI * 2))
	                                                                                     
	checar("Vector3 → engine", aprox(m.vec3.length(Vector3(0, 3, 4)), 5))


                                                                                                    

func cena() -> void:
	var s = helix.scene
	checar("scene.root", s.root != null and s.root.children is Array)
	var antes: int = s.count()
	var grupo = s.spawn("group", {"name": "DebugCenario"})
	var chao = s.spawn("mesh", {
		"name": "Chao",
		"mesh": helix.mesh.plane(40, 40),
		"material": helix.material.create({"baseColor": "#4b6b3a", "roughness": 0.95}),
		"rigidBody": {"type": "static", "collider": "box", "boxSize": [40, 0.2, 40], "center": [0, -0.1, 0]},
		"receiveShadows": true,
		"tags": ["chao"],
	}, grupo)
	checar("spawn mesh", chao.kind == "mesh" and chao.mesh != null and chao.rigidBody != null)
	checar("find", s.find("Chao") == chao)
	checar("findAll", len(s.findAll("Chao")) == 1)
	checar("byId", s.byId(chao.id) == chao)
	checar("byTag", len(s.byTag("chao")) >= 1)
	checar("byKind", len(s.byKind("mesh")) >= 1)
	checar("count", s.count() == antes + 2, str(s.count()) + " vs " + str(antes + 2))
	checar("contains", s.contains(grupo, chao) and s.contains(s.root, chao))
	checar("path", str(s.path(chao)).contains("Chao"), s.path(chao))
	var visitados := [0]
	s.traverse(func(_e): visitados[0] += 1, grupo)
	checar("traverse", visitados[0] >= 2, visitados[0])

	var anel = s.spawnPrimitive("torus", {"name": "Anel", "position": [-4, 1.2, -2], "scale": 1.5}, grupo)
	helix.material.setColor(anel, "#3a86ff")
	helix.material.setEmissive(anel, "#3a86ff", 0.6)
	torus = anel
	checar("spawnPrimitive", anel.mesh != null and anel.material != null)

	var copia = s.clone(anel, true, grupo)
	s.rename(copia, "AnelCopia")
	helix.transform.setPosition(copia, [-4, 1.2, 2])
	checar("clone + rename", copia.name == "AnelCopia" and s.find("AnelCopia") == copia)
	s.setMeta(copia, "origem", "clone")
	checar("meta", s.getMeta(copia, "origem") == "clone")
	s.addTag(copia, "temporario")
	checar("addTag/hasTag", s.hasTag(copia, "temporario"))
	checar("removeTag", s.removeTag(copia, "temporario") == true and not s.hasTag(copia, "temporario"))
	s.setVisible(copia, false)
	checar("setVisible", copia.visible == false)
	s.setVisible(copia, true)
	s.destroy(copia)
	checar("destroy", s.find("AnelCopia") == null and not s.isAttached(copia))

	var esfera = s.spawnPrimitive("sphere", {"name": "Esfera", "position": [4, 0.5, -3]})
	s.reparent(esfera, grupo)
	checar("reparent", esfera.parent == grupo)
	helix.material.setColor(esfera, "#ffbe0b")
	s.addComponent(esfera, "rigidBody", {"type": "dynamic", "collider": "sphere", "radius": 0.5, "mass": 1})
	checar("addComponent", esfera.rigidBody != null and esfera.rigidBody.type == "dynamic")
	var temporario = s.spawnPrimitive("box", {"name": "Temporario"})
	s.addComponent(temporario, "csg", {})
	checar("addComponent csg", temporario.csg != null)
	s.removeComponent(temporario, "csg")
	checar("removeComponent", temporario.csg == null)
	s.destroy(temporario)
	checar("kinds/components", "mesh" in s.kinds() and "rigidBody" in s.components())
	                                                                                                        
	var no = get_tree().root
	checar("get_tree().root", no != null)


func transformacao() -> void:
	var tr = helix.transform
	var m = helix.math
	var alvo = helix.scene.spawnPrimitive("cone", {"name": "Cone", "position": [0, 0.5, -6]})
	helix.material.setColor(alvo, "#8338ec")
	tr.setPosition(alvo, [2, 0.5, -6])
	checar("setPosition", m.vec3.equals(tr.position(alvo), [2, 0.5, -6]))
	tr.translate(alvo, [0, 1, 0], "world")
	checar("translate", aprox(tr.position(alvo)[1], 1.5))
	tr.setRotation(alvo, [0, 90, 0])
	checar("setRotation", aprox(tr.rotation(alvo)[1], 90, 0.01))
	tr.rotate(alvo, [0, 45, 0])
	var girado: float = m.scalar.wrapAngle(tr.rotation(alvo)[1])
	checar("rotate", aprox(girado, 135, 0.01) or aprox(girado, -225, 0.01), girado)
	tr.setScale(alvo, 2)
	checar("setScale", aprox(tr.scale(alvo)[0], 2))
	tr.setScale(alvo, [1, 1, 1])
	checar("worldPosition", m.vec3.equals(tr.worldPosition(alvo), tr.position(alvo), 0.001))
	checar("forward/up", aprox(m.vec3.length(tr.forward(alvo)), 1) and aprox(m.vec3.length(tr.up(alvo)), 1))
	tr.lookAt(alvo, [0, 1.5, 0])
	checar("distance", tr.distance(alvo, [2, 1.5, -6]) < 0.01)
	checar("directionTo", aprox(m.vec3.length(tr.directionTo(alvo, [0, 1.5, 0])), 1))
	var limites = tr.bounds(alvo)
	checar("bounds", limites != null and limites.max[1] > limites.min[1])
	checar("worldMatrix", len(tr.worldMatrix(alvo)) == 16 and len(tr.localMatrix(alvo)) == 16)
	var local = tr.worldToLocal(alvo, tr.localToWorld(alvo, [1, 0, 0]))
	checar("localToWorld/worldToLocal", m.vec3.equals(local, [1, 0, 0], 0.001))


func malhas() -> void:
	var me = helix.mesh
	var caixa = me.box(1, 1, 1)
	checar("mesh.box", me.vertexCount(caixa) > 0 and me.triangleCount(caixa) == 12, me.triangleCount(caixa))
	var esfera = me.sphere(0.65, 16, 12)
	var furado = helix.csg.boolean(caixa, esfera, "subtract")
	checar("csg.boolean", me.triangleCount(furado) > 12)
	var ator = helix.scene.spawn("mesh", {"name": "CaixaFurada", "mesh": furado, "material": helix.material.create({"baseColor": "#e63946", "roughness": 0.4, "metallic": 0.2}), "position": [4, 0.5, 2]})
	checar("spawn malha CSG", ator.mesh != null)
	checar("csg.operations", "union" in helix.csg.operations())
	var tri = me.create({"name": "Triangulo", "positions": [-1, 0, 0, 1, 0, 0, 0, 1.5, 0], "uvs": [0, 0, 1, 0, 0.5, 1], "indices": [0, 1, 2]})
	me.computeNormals(tri)
	checar("mesh.create + computeBounds", me.computeBounds(tri).max[1] >= 1.5)
	var dupla = me.merge(tri, me.flipWinding(me.clone(tri)))
	checar("mesh.merge", me.triangleCount(dupla) == 2)
	helix.scene.spawn("mesh", {"name": "Triangulo", "mesh": dupla, "material": helix.material.create({"baseColor": "#06d6a0", "doubleSided": true}), "position": [7, 0, -2]})
	var grande = me.scale(me.translate(me.clone(caixa), [0, 0.5, 0]), 2)
	checar("mesh.translate/scale", me.computeBounds(grande).max[1] > 1.9)
	var dist = me.raycast(helix.math.ray.create([0, 5, 0], [0, -1, 0]), grande)
	checar("mesh.raycast", dist != null and dist > 0, dist)
	checar("positions/indices", len(me.positions(caixa)) == me.vertexCount(caixa) * 3 and len(me.indices(caixa)) == 36)
	checar("primitivas extras", me.triangleCount(me.torusKnot()) > 0 and me.triangleCount(me.capsule()) > 0)


                                                                                                        

func materiais() -> void:
	var mat = helix.material
	var base = mat.create({"name": "DebugBase", "baseColor": "#d98c2b", "roughness": 0.5, "metallic": 0.1})
	checar("material.create", base.roughness == 0.5)
	var copia = mat.clone(base)
	mat.set(copia, {"roughness": 1, "emissive": "#ffffff", "emissiveIntensity": 2})
	checar("material.clone/set", copia.roughness == 1 and base.roughness == 0.5)
	var caixa = helix.scene.spawnPrimitive("box", {"name": "CaixaPintada", "position": [-7, 0.5, 2]})
	mat.assign(caixa, base)
	checar("material.assign/of", mat.of(caixa) == base)
	var propria = mat.own(caixa)
	checar("material.own", mat.of(caixa) == propria)
	var tela_tex = helix.texture.canvas(64, 64)
	tela_tex.update()
	mat.setTexture(caixa, "baseColorMap", tela_tex.texture)
	checar("texture.canvas + setTexture", mat.hasAnyTexture(propria) and helix.texture.isTexture(tela_tex.texture))
	checar("material.slots", len(mat.slots()) > 0)
	checar("materials.list", helix.materials.list() is Array)
	var sombreado = mat.fromShader("DebugSuperficie", {"glow": [1, 0.45, 0.1], "speed": 2})
	checar("material.fromShader", sombreado != null)
	if sombreado != null:
		var esfera = helix.scene.spawnPrimitive("sphere", {"name": "EsferaShader", "position": [0, 1, -3], "scale": 1.4})
		mat.assign(esfera, sombreado)
		mat.uniforms(esfera).set("speed", 3)
		checar("material.uniforms.list", len(mat.uniforms(esfera).list()) >= 1)


func luzes() -> void:
	var l = helix.light
	checar("light.types", "point" in l.types() and "spot" in l.localTypes())
	var lampada = l.spawn("point", {"name": "Lampada", "position": [0, 3, 0], "color": "#ffd166", "intensity": 60, "range": 14})
	checar("light.spawn", lampada.light != null and lampada.light.type == "point")
	l.set(lampada, {"intensity": 80})
	checar("light.set", lampada.light.intensity == 80)
	l.setTemperature(lampada, 3200)
	checar("setTemperature", lampada.light.temperature == 3200)
	var foco = l.spawn("spot", {"name": "Holofote", "position": [4, 4, 0], "rotation": [-90, 0, 0], "intensity": 120, "range": 16, "innerAngle": 20, "outerAngle": 35, "color": "#ffffff"})
	checar("spot", foco.light.type == "spot")
	var convertido = l.convert(foco, "disc")
	checar("light.convert", convertido.type == "disc" and foco.light.type == "disc")
	l.convert(foco, "spot")
	var presets = l.presets()
	checar("light.presets", len(presets) > 0)
	if len(presets) > 0:
		var preset = l.spawn(presets[0].id, {"name": "LuzPreset", "position": [-4, 2.5, 4]})
		checar("light.fromPreset", preset.light != null and l.fromPreset(presets[0].id).type == presets[0].type)
	checar("light.all", len(l.all({"local": true})) >= 2)
	checar("effectiveRange", l.effectiveRange(lampada) > 0)
	checar("light.isLocal", l.isLocal(lampada))
	checar("temperatureToColor", l.temperatureToColor(6500) != null)
	l.setColor(lampada, "#ffffff")
	checar("light.setColor", helix.math.vec3.equals(lampada.light.color, [1, 1, 1], 0.01))


func ceu() -> void:
	var sky = helix.sky
	sky.set({"timeOfDay": 10.5, "haze": 0.3, "clouds": {"enabled": true, "coverage": 0.45}})
	checar("sky.set", aprox(sky.timeOfDay, 10.5) and sky.clouds.enabled == true)
	checar("sky.isDay", sky.isDay == true)
	checar("sky.sunDirection", sky.sunDirection()[1] > 0)
	checar("sky.formatTimeOfDay", str(sky.formatTimeOfDay(10.5)).contains(":"), sky.formatTimeOfDay(10.5))
	checar("sky.wrapTimeOfDay", sky.wrapTimeOfDay(25) == 1)
	checar("sky.presets", len(sky.presets()) > 0)
	assinar(sky.onHourChanged(func(h): helix.log.info("Debug", "Hora do céu: " + str(h))))
	sky.cycleSpeed = 0
	checar("sky.cycleSpeed", sky.cycleSpeed == 0)
	checar("world.gravity", helix.world.gravity[1] < 0)
	helix.world.wind.set({"speed": 2, "direction": 45})
	checar("world.wind.set", helix.world.wind.speed == 2)


func camera() -> void:
	var c = helix.camera
	checar("camera.fov", c.fov > 0 and c.aspect > 0)
	checar("camera.near/far", c.near > 0 and c.far > c.near)
	checar("viewport", c.viewport.width > 0)
	var ponto = c.worldToScreen([0, 0, 0])
	checar("worldToScreen", ponto == null or ponto.x is float)
	var raio = c.screenToRay(c.viewport.width / 2.0, c.viewport.height / 2.0)
	checar("screenToRay", raio == null or aprox(helix.math.vec3.length(raio.direction), 1, 0.01))
	checar("viewMatrix", len(c.viewMatrix) == 16)
	c.player.set({"distance": 7, "pitch": 18})
	checar("player.set", c.player.settings.distance == 7)
	checar("distanceTo", c.distanceTo([0, 0, 0]) >= 0)
	checar("camera.position", len(c.position) == 3 and len(c.forward) == 3)
	assinar(c.onMainChanged(func(e): helix.log.info("Debug", "Câmera principal: " + (str(e.name) if e != null else "editor/jogador"))))


func pos() -> void:
	var p = helix.post
	checar("post.toneMappers", len(p.toneMappers()) > 0)
	p.set({
		"bloom": {"enabled": true, "intensity": 0.5, "threshold": 1, "softKnee": 0.5, "radius": 0.6},
		"vignette": {"enabled": true, "intensity": 0.35, "smoothness": 0.5, "roundness": 1},
	})
	checar("post.set", p.bloom.enabled == true and p.vignette.enabled == true)
	p.exposure = 1.05
	checar("post.exposure", aprox(p.exposure, 1.05))
	p.toneMapper = "agx"
	checar("post.toneMapper", p.toneMapper == "agx")
	checar("post.presets", len(p.presets()) > 0)
	var custom = p.custom.add({"fragment": "DebugPost", "name": "DebugPost", "uniforms": {"tint": [0.15, 0.05, 0.3], "strength": 0.6}})
	efeito = custom
	checar("post.custom.add", custom != null and p.custom.get("DebugPost") != null)
	custom.uniforms.set("strength", 0.8)
	checar("efeito.uniforms.list", len(custom.uniforms.list()) >= 2)


func render() -> void:
	var r = helix.render
	checar("render.passNames", len(r.passNames()) > 0)
	checar("render.stats", r.stats.drawCalls is float)
	checar("render.frame", r.frame.width is float)
	assinar(r.onAfterFrame(func(): renders += 1))
	r.showGrid = false
	checar("render.showGrid", r.showGrid == false)
	checar("render.pixelRatio", r.pixelRatio > 0)


                                                                                                    

func fisica() -> void:
	var ph = helix.physics
	checar("physics.enabled", ph.enabled == true)
	checar("physics.gravity", ph.gravity[1] < 0)
	checar("physics.settings", ph.settings.fixedTimestep > 0)
	for i in range(1, 6):
		var caixa = helix.scene.spawnPrimitive("box", {"name": "Caixa" + str(i), "position": [-2 + (i - 1) * 1.1, 3 + (i - 1) * 1.2, 3], "rigidBody": {"type": "dynamic", "collider": "box", "mass": 2, "restitution": 0.3}, "tags": ["caixa"]})
		helix.material.setColor(caixa, helix.math.color.hsl(30 + i * 12, 0.7, 0.5))
	var caixas = helix.scene.byTag("caixa")
	checar("caixas dinâmicas", len(caixas) == 5 and ph.hasBody(caixas[0]))
	var corpo = ph.bodyOf(caixas[0])
	checar("bodyOf", corpo.isDynamic and corpo.mass > 0)
	corpo.applyImpulse([0, 2, 0])
	corpo.applyTorque([0, 1, 0])
	corpo.setMaterial({"friction": 0.8})
	corpo.wake()
	checar("body.linearVelocity", len(corpo.linearVelocity) == 3)
	checar("bodies()", len(ph.bodies()) >= 6)
	var hit = ph.raycast([0, 5, 0], [0, -1, 0], 20)
	checar("physics.raycast", hit != null and hit.entity != null, hit.entity.name if hit != null and hit.entity != null else null)
	checar("raycastAll", len(ph.raycastAll([0, 5, 0], [0, -1, 0], 20)) >= 1)
	checar("overlapSphere", ph.overlapSphere([0, 3, 3], 4) is Array)
	checar("massProperties", ph.massProperties(caixas[0]).mass > 0)
	checar("colliderVolume", ph.colliderVolume(caixas[0]) > 0)
	checar("shapes.sphere volume", aprox(ph.shapes.volume(ph.shapes.sphere(1)), 4.18879, 0.01))
	assinar(ph.onCollisionBegin(_on_colisao))
	assinar(ph.onOutOfBounds(func(e): helix.log.warn("Debug", str(e.name) + " caiu do mundo")))
	var gatilho = helix.scene.spawn("group", {"name": "Gatilho", "position": [0, 1, 3], "trigger": {"shape": "box", "size": [3, 2, 3]}})
	checar("trigger spawn", gatilho != null and helix.scene.isAttached(gatilho))
	checar("physics.stats", ph.stats.bodies is float)


func _on_colisao(e) -> void:
	colisoes += 1
	if colisoes <= 3:
		helix.log.info("Debug", "Colisão: %s × %s (impulso %.2f)" % [e.a.name, e.b.name, e.contact.impulse])


func personagem() -> void:
	var h = helix.character.spawn({"name": "Heroi", "position": [0, 1.2, 8], "character": {"walkSpeed": 4, "runSpeed": 7, "jumpHeight": 1.4}})
	heroi = h
	checar("character.spawn", h.character != null and helix.character.has(h))
	var c = helix.character.of(h)
	checar("character.of", c.isGrounded is bool)
	checar("settingsOf", helix.character.settingsOf(h).walkSpeed == 4)
	helix.player.possess(h)
	checar("player.possess", helix.player.possessed == h and helix.player.isPossessing)
	assinar(helix.character.onJumped(func(e): helix.log.info("Debug", str(e.entity.name) + " pulou")))
	assinar(helix.player.onPossessed(func(e): helix.log.info("Debug", "Possuindo " + (str(e.name) if e != null else "ninguém"))))
	checar("character.all", len(helix.character.all()) >= 1)
	checar("player.spawnPoint", len(helix.player.spawnPoint) == 3)
	checar("character.velocity", len(c.velocity) == 3 and len(c.position) == 3)


func terreno() -> void:
	var te = helix.terrain
	checar("terrain.presets", len(te.presets()) > 0)
	var colinas = te.spawn({"name": "Colinas", "size": 48, "resolution": 65, "preset": "hills", "seed": 7, "position": [0, -6, -70]})
	checar("terrain.spawn", colinas.terrain != null and len(te.all()) >= 1)
	checar("terrain.of", te.of(colinas).resolution == 65)
	var altura = te.heightAt([0, 0, -70], colinas)
	checar("heightAt", altura != null and altura is float, altura)
	checar("contains", te.contains([0, 0, -70], colinas) and not te.contains([500, 0, 0], colinas))
	te.sculpt(colinas, "raise", [5, 0, -70], {"radius": 6, "strength": 1}, 1)
	te.markDirty(colinas)
	te.grass.set(colinas, {"enabled": true, "density": 0.5})
	checar("grass.set", te.grass.settingsOf(colinas).enabled == true)
	te.water.set(colinas, {"enabled": true, "level": -2})
	checar("water.set", te.water.settingsOf(colinas).enabled == true)
	checar("terrain.raycast", te.raycast([0, 50, -70], [0, -1, 0], colinas) != null)


                                                                                                   

func interface_grafica() -> void:
	var g = helix.gui
	g.css("DebugEstilo")
	var hud = g.html("DebugHud", {"id": "debug-hud"})
	checar("gui.html", hud != null and g.element("#debug-hud") != null)
	var icone = g.svg("DebugIcone", {"id": "debug-icone"})
	checar("gui.svg", icone != null)
	var slot = g.element("[data-slot=icone]")
	if slot != null and icone != null:
		slot.appendChild(icone)
	checar("gui.bind", g.bind("linguagem", LINGUAGEM) >= 1)
	g.bind("titulo", "Helix · Debug")
	assinar(g.onAction("caixa", soltar_caixa))
	assinar(g.onAction("reiniciar", func(): helix.play.restart()))
	checar("gui.elements", len(g.elements("[data-bind]")) >= 5)
	checar("gui.size", g.size.width > 0)
	var doc = g.create("DebugTela", {"referenceSize": {"x": 1280, "y": 720}})
	var painel = g.add(doc, "frame", {"name": "Painel", "rect": {"position": {"x": {"scale": 1, "offset": -236}, "y": {"scale": 0, "offset": 16}}, "size": {"x": {"scale": 0, "offset": 220}, "y": {"scale": 0, "offset": 48}}}})
	g.add(doc, "text", {"name": "Rotulo", "text": "Tela declarativa OK"}, painel.node.id)
	checar("gui.add/find", g.find(doc, "Rotulo").kind == "text")
	g.setText(doc, "Rotulo", "Tela declarativa OK · " + LINGUAGEM)
	tela = await g.show(doc, "debug-tela")
	checar("gui.show/isShown", tela != null and g.isShown(tela))
	checar("gui.kinds", "button" in g.kinds())


func audio() -> void:
	var a = helix.audio
	checar("audio.supported", a.supported is bool)
	a.mixer.setVolumeDb("sfx", -3)
	checar("mixer.setVolumeDb", a.mixer.bus("sfx").volumeDb == -3)
	checar("audio.clips", a.clips() is Array)
	var fonte = helix.scene.spawn("sound", {"name": "FonteSonora", "position": [3, 1, 3], "audioSource": {"trigger": "manual", "spatial": true}})
	checar("spawn sound", fonte.audioSource != null)
	a.sources.set(fonte, {"volumeDb": -4})
	checar("sources.set", fonte.audioSource.volumeDb == -4)
	checar("sources.isPlaying", a.sources.isPlaying(fonte) == false)


func vfx() -> void:
	var v = helix.vfx
	var ids = v.templates.ids()
	checar("vfx.templates", len(ids) > 0)
	checar("vfx.moduleKinds", len(v.moduleKinds()) > 0)
	var doc = v.fromTemplate(ids[0], "DebugFaiscas")
	doc = v.addEmitter(doc, {"name": "Extra", "maxParticles": 50})
	doc = v.set(doc, {"loop": true})
	checar("vfx.fromTemplate/addEmitter", len(doc.emitters) >= 2 and doc.loop == true)
	var ativo = await v.save(doc, "DebugFaiscas")
	checar("vfx.save", ativo != null and ativo.kind == "vfx")
	var ator = v.emitAt(ativo, [0, 1.5, -8], {"destroyWhenFinished": false})
	checar("vfx.emitAt", v.has(ator))
	v.burst(ator, 20)
	checar("vfx.stats", v.stats().effects is float)


                                                                                                   

func soltar_caixa() -> void:
	var caixa = helix.scene.spawnPrimitive("box", {"name": "CaixaSolta", "position": [helix.math.random.range(-3, 3), 6, helix.math.random.range(0, 4)], "rigidBody": {"type": "dynamic", "collider": "box", "mass": 1}, "tags": ["caixa"]})
	helix.material.setColor(caixa, helix.math.random.color())
	pontos += 1
	helix.gui.bind("pontos", pontos)
	helix.events.emit("debug.caixa", {"nome": caixa.name})


func ao_teclar(e) -> void:
	if e.repeat:
		return
	match e.code:
		"KeyR":
			helix.play.restart()
		"KeyB":
			soltar_caixa()
		"KeyE":
			helix.events.emit("debug.ping", {"origem": "teclado", "quadro": helix.time.frame})
		"KeyF":
			helix.camera.shake(0.4, 0.6)
		"KeyG":
			if efeito != null:
				efeito.enabled = not efeito.enabled
				helix.log.info("Debug", "Efeito DebugPost " + ("ligado" if efeito.enabled else "desligado"))
		"KeyT":
			helix.time.scale = 0.3 if helix.time.scale == 1 else 1
			helix.log.info("Debug", "time.scale = " + str(helix.time.scale))
		"KeyH":
			if tela != null:
				if helix.gui.isShown(tela):
					helix.gui.hide(tela)
				else:
					helix.gui.show(tela, "debug-tela")
		"KeyL":
			var nomes := []
			for luz in helix.light.all({"local": true}):
				nomes.append(str(luz.entity.name))
			helix.log.info("Debug", "Luzes locais: " + ", ".join(nomes))


func clique_na_cena(x: float, y: float) -> void:
	var alvo = helix.camera.pick(x, y)
	var ponto = helix.camera.pickPoint(x, y)
	if alvo != null:
		helix.log.info("Debug", "Clique em " + str(alvo.name))
	if ponto != null:
		helix.debug.sphere(ponto, 0.3, "#ff006e", 2)


func ao_apontar(e) -> void:
	if e.button == 0:
		clique_na_cena(e.x, e.y)


func entrada() -> void:
	var i = helix.input
	i.actions.define("pular", ["Space", "Gamepad:0"])
	i.actions.define("soltar", ["KeyB"])
	checar("actions.define/bindings", len(i.actions.bindings("pular")) >= 1)
	checar("action()", i.action("pular").name == "pular" and i.actions.down("pular") is bool)
	checar("isDown", i.isDown("KeyW") == false)
	checar("pointer", i.pointer.x is float)
	checar("gamepads", i.gamepads() is Array)
	checar("axis2d", i.axis2d({"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD"}).x is float)
	checar("keysDown", i.keysDown() is Array)
	assinar(i.onKeyDown(ao_teclar))
	assinar(i.onPointerDown(ao_apontar))
	assinar(i.onGamepadButtonDown(func(e): helix.log.info("Debug", "Gamepad " + str(e.pad) + " botão " + str(e.button))))
	                                                                      
	checar("Input.is_action_pressed", Input.is_action_pressed("ui_accept") is bool)


func eventos() -> void:
	var ev = helix.events
	var recebido := [null]
	var off = ev.on("debug.ping", func(p): recebido[0] = p)
	checar("events.emit conta ouvintes", ev.emit("debug.ping", {"origem": "teste"}) == 1)
	checar("events.on recebe", recebido[0] != null and recebido[0].origem == "teste")
	checar("listenerCount", ev.listenerCount("debug.ping") == 1)
	off.call()
	checar("unsubscribe", ev.listenerCount("debug.ping") == 0)
	var uma_vez := [0]
	ev.once("debug.once", func(): uma_vez[0] += 1)
	ev.emit("debug.once")
	ev.emit("debug.once")
	checar("events.once", uma_vez[0] == 1)
	assinar(ev.on("debug.ping", func(p): helix.log.info("Debug", "ping de " + str(p.origem))))
	assinar(ev.on("debug.caixa", func(p): helix.log.debug("Debug", "caixa " + str(p.nome))))
	var do_ator := [0]
	assinar(ev.onEntity(torus, "toque", func(): do_ator[0] += 1))
	ev.emitEntity(torus, "toque")
	checar("onEntity/emitEntity", do_ator[0] == 1)
	assinar(helix.play.onStopped(func(): helix.log.info("Debug", "play.onStopped disparou")))
	assinar(helix.play.onPaused(func(): helix.log.info("Debug", "pausado")))
	assinar(helix.play.onResumed(func(): helix.log.info("Debug", "retomado")))


func tempo() -> void:
	var tm = helix.time
	checar("time.now", tm.now >= 0 and tm.frame >= 0)
	checar("time.delta", tm.delta >= 0 and tm.fixedDelta > 0)
	var inicio: float = tm.now
	await tm.wait(0.1)
	checar("time.wait", tm.now - inicio >= 0.09, "%.3f" % (tm.now - inicio))
	var quadro: int = tm.frame
	await tm.waitFrames(2)
	checar("time.waitFrames", tm.frame >= quadro + 2, tm.frame - quadro)
	assinar(tm.every(2, func(): helix.gui.bind("atores", helix.scene.count())))
	var disparou := [false]
	tm.delay(0.2, func(): disparou[0] = true)
	await tm.wait(0.3)
	checar("time.delay", disparou[0])
	                                                                                                 
	await get_tree().create_timer(0.05).timeout
	checar("create_timer().timeout", true)


func dados() -> void:
	var st = helix.storage
	await st.ready()
	var execucoes: int = int(st.get("execucoes", 0)) + 1
	await st.set("execucoes", execucoes)
	checar("storage.get/set", st.get("execucoes") == execucoes and st.has("execucoes"), execucoes)
	helix.log.info("Debug", "Execução nº " + str(execucoes) + " deste jogo de teste neste projeto.")
	var cfg = await helix.assets.data("DebugConfig")
	checar("assets.data (TOML)", cfg != null and cfg.jogador != null and cfg.jogador.velocidade == 6.5)
	var texto = await helix.assets.text("DebugConfig")
	checar("assets.text", str(texto).contains("velocidade"))
	checar("assets.byName", helix.assets.byName("DebugJogo", "script") != null)
	checar("assets.exists", helix.assets.exists("DebugUtil") and not helix.assets.exists("NaoExiste"))
	checar("assets.search", len(helix.assets.search("Debug")) >= 5)
	checar("project.name", helix.project.name is String)
	checar("project.stats", helix.project.stats.entities > 0)
	checar("net.localPlayer", helix.net.localPlayer.local == true)
	checar("play.state", helix.play.state == "playing" and helix.play.isRunning)


                                                                                                 

func onLoad() -> void:
	helix.log.info("Debug", "onLoad do script de entrada")


func _ready() -> void:
	helix.log.info("Debug", "Jogo de teste em " + LINGUAGEM + ": percorrendo a API…")
	await area("Núcleo", nucleo)
	await area("Módulo (class_name)", modulo)
	await area("Matemática", matematica)
	await area("Cena", cena)
	await area("Transformações", transformacao)
	await area("Malhas e CSG", malhas)
	await area("Materiais", materiais)
	await area("Luzes", luzes)
	await area("Céu e mundo", ceu)
	await area("Câmera", camera)
	await area("Pós-processamento", pos)
	await area("Render", render)
	await area("Física", fisica)
	await area("Personagem e jogador", personagem)
	await area("Terreno", terreno)
	await area("Interface", interface_grafica)
	await area("Áudio", audio)
	await area("VFX", vfx)
	await area("Entrada", entrada)
	await area("Eventos", eventos)
	await area("Tempo e tarefas", tempo)
	await area("Dados, projeto e rede", dados)
	var girador = helix.assets.byName("DebugGirador", "script")
	if girador != null:
		var extra = helix.scene.spawnPrimitive("box", {"name": "GiradorDinamico", "position": [-2, 0.5, -3], "rigidBody": {"type": "kinematic", "collider": "box"}, "script": {"assetId": girador.id, "props": {"velocidade": 180, "cor": "#00b4d8"}}})
		checar("spawn com script", extra.script != null and extra.script.assetId == girador.id)
	else:
		checar("ativo DebugGirador", false, "não está na biblioteca")
	var dica := "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia."
	if falhas == 0:
		helix.log.info("Debug", "API percorrida em " + LINGUAGEM + ": " + str(checagens) + " checagens, nenhuma falha. " + dica)
	else:
		helix.log.warn("Debug", "API percorrida em " + LINGUAGEM + ": " + str(checagens) + " checagens, " + str(falhas) + " falhas (veja FALHOU/ERRO acima). " + dica)
	helix.gui.bind("checagens", checagens)
	helix.gui.bind("falhas", falhas)


func _process(delta: float) -> void:
	quadros += 1
	if torus != null:
		helix.transform.rotate(torus, [0, 40 * delta, 0])
	var d = helix.debug
	d.line([-6, 0.05, -6], [6, 0.05, -6], "#ff006e")
	d.box({"center": [0, 1, 3], "size": [3, 2, 3]}, "#ffbe0b")
	if heroi != null:
		d.axes(heroi, 1)
		d.text(helix.math.vec3.add(helix.transform.worldPosition(heroi), [0, 2.2, 0]), "Heroi · " + str(pontos) + " pts", "#ffffff")
	d.ray([0, 3, 0], [0, -1, 0], 3, "#06d6a0")
	hud_timer += delta
	if hud_timer >= 0.5:
		hud_timer = 0.0
		helix.gui.bind("fps", roundi(helix.render.stats.fps))
		helix.gui.bind("checagens", checagens)
		helix.gui.bind("falhas", falhas)


func _physics_process(step: float) -> void:
	passos_fisica += 1
	if passos_fisica == 1:
		checar("_physics_process recebe o passo", step > 0 and step < 1, step)


func onLateUpdate(_dt) -> void:
	late_updates += 1


func onBeforeHotReload():
	return {"pontos": pontos}


func onHotReload(anterior) -> void:
	pontos = int(anterior.pontos) if anterior != null and anterior.pontos is float else 0
	helix.log.info("Debug", "Recarga a quente: " + str(pontos) + " pontos preservados")


func onStop() -> void:
	for desligar in assinaturas:
		desligar.call()
	helix.log.info("Debug", "Parou: " + str(quadros) + " quadros, " + str(passos_fisica) + " passos de física, " + str(late_updates) + " lateUpdates, " + str(renders) + " frames (onAfterFrame), " + str(colisoes) + " colisões.")
`;
    const actor = `                                
                                                                                             
                                                                                                             
                                                                                                  
extends AnimatableBody3D

var angulo := 0.0
var contatos := 0
var quadros := 0
var desligar = null


func onLoad() -> void:
	helix.props.define({
		"velocidade": {"type": "range", "default": 90, "min": 0, "max": 360, "step": 1, "label": "Velocidade (°/s)"},
		"cor": {"type": "color", "default": "#ff8800", "label": "Cor"},
		"pulsar": {"type": "boolean", "default": true, "label": "Pulsar"},
	})


func _ready() -> void:
	var ator = helix.self
	helix.log.info("Girador", str(ator.name) + " acordou com velocidade " + str(helix.props.get("velocidade")) + "°/s")
	helix.material.setColor(ator, helix.props.get("cor"))
	desligar = helix.props.onChanged("cor", func(cor): helix.material.setColor(ator, cor))
	helix.log.assert(name == str(ator.name), "o nome do nó deveria ser o do ator")
	helix.log.assert(helix.props.has("velocidade") and len(helix.props.definitions()) == 3, "props.define deveria registrar 3 propriedades")
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	quadros += 1
	angulo += helix.props.get("velocidade") * delta
	helix.transform.setRotation(helix.self, [0, angulo, 0])
	if helix.props.get("pulsar"):
		helix.transform.setScale(helix.self, 1 + sin(helix.time.now * 3) * 0.1)


func _on_body_entered(outro) -> void:
	contatos += 1
	if contatos <= 3:
		helix.log.info("Girador", name + " tocou " + str(outro.name))


func onStop() -> void:
	helix.log.info("Girador", name + ": " + str(quadros) + " quadros, " + str(contatos) + " contatos")


func _exit_tree() -> void:
	if desligar != null:
		desligar.call()
`;
    const module = `                                    
                                                                                                      
                                                 
class_name DebugUtil
extends RefCounted


static func soma(a: float, b: float) -> float:
	return a + b


static func saudacao(quem: String) -> String:
	return "Olá, " + quem


static func limitar(valor: float, minimo: float, maximo: float) -> float:
	return minf(maximo, maxf(minimo, valor))
`;
    return { entry, actor, module };
}
