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
`;
}
