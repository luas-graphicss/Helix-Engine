import type { GameSources } from '../types';
export function rubyGame(): GameSources {
    const entry = `                                   
                                                                                   
                                                                                  
require "DebugUtil"

LINGUAGEM = "Ruby"

@quadros = 0
@passos_fisica = 0
@late_updates = 0
@renders = 0
@colisoes = 0
@checagens = 0
@falhas = 0
@pontos = 0
@hud_timer = 0.0
@torus = nil
@heroi = nil
@efeito = nil
@tela = nil
@assinaturas = []

def checar(nome, condicao, detalhe = nil)
  @checagens += 1
  return if condicao
  @falhas += 1
  sufixo = detalhe.nil? ? "" : ": #{detalhe}"
  helix.log.error("Debug", "FALHOU #{nome}#{sufixo}")
end

                                                                                                                                   
def area(nome)
  yield
  helix.log.debug("Debug", "ok #{nome}")
rescue StandardError => erro
  @falhas += 1
  helix.log.error("Debug", "ERRO em #{nome}: #{erro.message}")
end

def aprox(a, b, epsilon = 0.001)
  (a - b).abs <= epsilon
end

def assinar(desligar)
  @assinaturas << desligar
end

                                                                                              

def nucleo
  checar("engine.name", helix.engine.name.is_a?(String) && !helix.engine.name.empty?)
  checar("engine.version", helix.engine.version.is_a?(String))
  checar("context", %w[shared client server].include?(helix.context), helix.context)
  checar("isPlaying", helix.isPlaying == true)
  checar("isEditor", helix.isEditor == false)
  checar("self no script de entrada", helix.self.nil?)
  checar("script handle", helix.script.nil? || helix.script.name == "DebugJogo")
  helix.log.info("Debug", "#{helix.engine.name} #{helix.engine.version} · API #{helix.engine.apiVersion} · #{LINGUAGEM}")
end

def modulo
  checar("require soma", DebugUtil.soma(2, 3) == 5, DebugUtil.soma(2, 3))
  checar("require saudacao", DebugUtil.saudacao("Helix") == "Olá, Helix", DebugUtil.saudacao("Helix"))
  checar("require limitar", DebugUtil.limitar(15, 0, 10) == 10)
  checar("require constante", DebugUtil::VERSAO == "1.0")
end

def matematica
  m = helix.math
  v = m.vec3.add([1, 2, 3], [1, 1, 1])
  checar("vec3.add", m.vec3.equals(v, [2, 3, 4]), v.to_a)
  checar("vec3.length", aprox(m.vec3.length([3, 4, 0]), 5))
  checar("vec3.normalize", aprox(m.vec3.length(m.vec3.normalize([0, 5, 0])), 1))
  checar("vec3.cross", m.vec3.equals(m.vec3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]))
  checar("vec3.lerp", m.vec3.equals(m.vec3.lerp([0, 0, 0], [2, 2, 2], 0.5), [1, 1, 1]))
  q = m.quat.fromEuler([0, 90, 0])
  checar("quat.rotateVec3", m.vec3.equals(m.quat.rotateVec3(q, [1, 0, 0]), [0, 0, -1], 0.001))
  checar("quat.toEuler", aprox(m.quat.toEuler(q)[1], 90, 0.01))
  mat = m.mat4.fromTRS([1, 2, 3], [0, 0, 0], [1, 1, 1])
  checar("mat4.transformPoint", m.vec3.equals(m.mat4.transformPoint(mat, [0, 0, 0]), [1, 2, 3]))
  checar("mat4.invert", !m.mat4.invert(mat).nil?)
  checar("mat4.decompose", m.vec3.equals(m.mat4.decompose(mat)[:translation], [1, 2, 3]))
  caixa = m.aabb.fromCenterSize([0, 0, 0], [2, 2, 2])
  checar("aabb.contains", m.aabb.contains(caixa, [0.5, 0.5, 0.5]) && !m.aabb.contains(caixa, [2, 0, 0]))
  checar("aabb.size", m.vec3.equals(m.aabb.size(caixa), [2, 2, 2]))
  raio = m.ray.create([0, 5, 0], [0, -1, 0])
  checar("ray.intersectAabb", !m.ray.intersectAabb(raio, caixa).nil?)
  checar("ray.at", m.vec3.equals(m.ray.at(raio, 5), [0, 0, 0]))
  checar("scalar.remap", m.scalar.remap(5, 0, 10, 0, 100) == 50)
  checar("clamp/lerp", m.clamp(15, 0, 10) == 10 && m.lerp(0, 10, 0.5) == 5)
  checar("scalar.wrapAngle", aprox(m.scalar.wrapAngle(370), 10))
  checar("scalar.smoothstep", m.scalar.smoothstep(0, 1, 0.5) == 0.5)
  checar("degToRad", aprox(m.degToRad(180), Math::PI))
  ruido = m.noise.perlin2(0.3, 0.7)
  checar("noise.perlin2", ruido.is_a?(Numeric) && ruido.between?(-1.01, 1.01), ruido)
  checar("noise.fbm", m.noise.fbm(1.5, 2.5, 0, 4).is_a?(Numeric))
  checar("noise.worley2", m.noise.worley2(0.2, 0.4).is_a?(Numeric))
  checar("color.hexToVec3", m.vec3.equals(m.color.hexToVec3("#ff0000"), [1, 0, 0], 0.01))
  checar("color.vec3ToHex", m.color.vec3ToHex([1, 1, 1]).downcase == "#ffffff", m.color.vec3ToHex([1, 1, 1]))
  checar("color.parse", m.color.parse("#00ff00")[1] > 0.99)
  checar("color.hsl", m.color.hsl(0, 1, 0.5)[0] > 0.99)
  m.random.seed(42)
  sorteio = m.random.value
  m.random.seed(42)
  checar("random.seed determinístico", m.random.value == sorteio)
  checar("random.int", m.random.int(1, 6).is_a?(Integer))
  checar("random.pick", %w[a b].include?(m.random.pick(%w[a b])))
  checar("random.shuffle", m.random.shuffle([1, 2, 3]).size == 3)
  checar("random.unitVector", aprox(m.vec3.length(m.random.unitVector), 1))
  checar("random.create", m.random.create("debug").range(0, 1).is_a?(Numeric))
  checar("PI/TAU", aprox(m.TAU, m.PI * 2))
end

                                                                                                    

def cena
  s = helix.scene
  checar("scene.root", !s.root.nil? && s.root.children.size >= 0)
  antes = s.count
  grupo = s.spawn("group", { name: "DebugCenario" })
  chao = s.spawn("mesh", {
    name: "Chao",
    mesh: helix.mesh.plane(40, 40),
    material: helix.material.create({ baseColor: "#4b6b3a", roughness: 0.95 }),
    rigidBody: { type: "static", collider: "box", boxSize: [40, 0.2, 40], center: [0, -0.1, 0] },
    receiveShadows: true,
    tags: ["chao"],
  }, grupo)
  checar("spawn mesh", chao.kind == "mesh" && !chao.mesh.nil? && !chao.rigidBody.nil?)
  checar("find", s.find("Chao") == chao)
  checar("findAll", s.findAll("Chao").size == 1)
  checar("byId", s.byId(chao.id) == chao)
  checar("byTag", s.byTag("chao").include?(chao))
  checar("byKind", s.byKind("mesh").include?(chao))
  checar("count", s.count == antes + 2, "#{s.count} vs #{antes + 2}")
  checar("contains", s.contains(grupo, chao) && s.contains(s.root, chao))
  checar("path", s.path(chao).include?("Chao"), s.path(chao))
  checar("all", s.all.include?(chao))
  visitados = 0
  s.traverse(proc { visitados += 1 }, grupo)
  checar("traverse", visitados >= 2, visitados)

  torus = s.spawnPrimitive("torus", { name: "Anel", position: [-4, 1.2, -2], scale: 1.5 }, grupo)
  helix.material.setColor(torus, "#3a86ff")
  helix.material.setEmissive(torus, "#3a86ff", 0.6)
  @torus = torus
  checar("spawnPrimitive", !torus.mesh.nil? && !torus.material.nil?)

  copia = s.clone(torus, true, grupo)
  s.rename(copia, "AnelCopia")
  helix.transform.setPosition(copia, [-4, 1.2, 2])
  checar("clone + rename", copia.name == "AnelCopia" && s.find("AnelCopia") == copia)
  s.setMeta(copia, "origem", "clone")
  checar("meta", s.getMeta(copia, "origem") == "clone")
  s.addTag(copia, "temporario")
  checar("addTag/hasTag", s.hasTag(copia, "temporario"))
  checar("removeTag", s.removeTag(copia, "temporario") == true && !s.hasTag(copia, "temporario"))
  s.setVisible(copia, false)
  checar("setVisible", copia.visible == false)
  s.setVisible(copia, true)
  s.destroy(copia)
  checar("destroy", s.find("AnelCopia").nil? && !s.isAttached(copia))

  esfera = s.spawnPrimitive("sphere", { name: "Esfera", position: [4, 0.5, -3] })
  s.reparent(esfera, grupo)
  checar("reparent", esfera.parent == grupo)
  helix.material.setColor(esfera, "#ffbe0b")
  s.addComponent(esfera, "rigidBody", { type: "dynamic", collider: "sphere", radius: 0.5, mass: 1 })
  checar("addComponent", !esfera.rigidBody.nil? && esfera.rigidBody.type == "dynamic")
  temporario = s.spawnPrimitive("box", { name: "Temporario" })
  s.addComponent(temporario, "csg", {})
  checar("addComponent csg", !temporario.csg.nil?)
  s.removeComponent(temporario, "csg")
  checar("removeComponent", temporario.csg.nil?)
  s.destroy(temporario)
  checar("kinds/components", s.kinds.include?("mesh") && s.components.include?("rigidBody"))
  checar("sun", s.sun.nil? || !s.sun.light.nil?)
end

def transformacao
  tr = helix.transform
  m = helix.math
  alvo = helix.scene.spawnPrimitive("cone", { name: "Cone", position: [0, 0.5, -6] })
  helix.material.setColor(alvo, "#8338ec")
  tr.setPosition(alvo, [2, 0.5, -6])
  checar("setPosition/position", m.vec3.equals(tr.position(alvo), [2, 0.5, -6]))
  tr.translate(alvo, [0, 1, 0], "world")
  checar("translate", aprox(tr.position(alvo)[1], 1.5))
  tr.setRotation(alvo, [0, 90, 0])
  checar("setRotation", aprox(tr.rotation(alvo)[1], 90, 0.01))
  tr.rotate(alvo, [0, 45, 0])
  giro = m.scalar.wrapAngle(tr.rotation(alvo)[1])
  checar("rotate", aprox(giro, 135, 0.01) || aprox(giro, -225, 0.01), giro)
  tr.setScale(alvo, 2)
  checar("setScale", aprox(tr.scale(alvo)[0], 2))
  tr.setScale(alvo, [1, 1, 1])
  checar("worldPosition", m.vec3.equals(tr.worldPosition(alvo), tr.position(alvo), 0.001))
  checar("worldRotation", tr.worldRotation(alvo).size == 4)
  checar("forward unitário", aprox(m.vec3.length(tr.forward(alvo)), 1))
  checar("up", m.vec3.equals(tr.up(alvo), [0, 1, 0], 0.001))
  tr.lookAt(alvo, [0, 1.5, 0])
  checar("distance", tr.distance(alvo, [2, 1.5, -6]) < 0.01)
  checar("directionTo", aprox(m.vec3.length(tr.directionTo(alvo, [0, 1.5, 0])), 1, 0.01))
  limites = tr.bounds(alvo)
  checar("bounds", limites[:max][1] > limites[:min][1])
  local = tr.worldToLocal(alvo, tr.localToWorld(alvo, [1, 0, 0]))
  checar("localToWorld/worldToLocal", m.vec3.equals(local, [1, 0, 0], 0.001))
  checar("worldMatrix", tr.worldMatrix(alvo).size == 16 && tr.localMatrix(alvo).size == 16)
  pai = helix.scene.spawn("group", { name: "PaiDoCone", position: [0, 0, -6] })
  tr.setParentKeepWorld(alvo, pai)
  checar("setParentKeepWorld", alvo.parent == pai && m.vec3.equals(tr.worldPosition(alvo), [2, 1.5, -6], 0.01))
  tr.rotateAround(alvo, [0, 1.5, -6], [0, 1, 0], 90)
  checar("rotateAround", aprox(tr.distance(alvo, [0, 1.5, -6]), 2, 0.01))
end

def malhas
  me = helix.mesh
  caixa = me.box(1, 1, 1)
  checar("mesh.box", me.vertexCount(caixa) > 0 && me.triangleCount(caixa) == 12, me.triangleCount(caixa))
  esfera = me.sphere(0.65, 16, 12)
  furado = helix.csg.boolean(caixa, esfera, "subtract")
  checar("csg.boolean", me.triangleCount(furado) > 12)
  ator = helix.scene.spawn("mesh", { name: "CaixaFurada", mesh: furado, material: helix.material.create({ baseColor: "#e63946", roughness: 0.4, metallic: 0.2 }), position: [4, 0.5, 2] })
  checar("spawn malha CSG", ator.mesh == furado)
  checar("csg.operations", helix.csg.operations.include?("union"))
  tri = me.create({ name: "Triangulo", positions: [-1, 0, 0, 1, 0, 0, 0, 1.5, 0], uvs: [0, 0, 1, 0, 0.5, 1], indices: [0, 1, 2] })
  me.computeNormals(tri)
  checar("mesh.create + computeBounds", me.computeBounds(tri)[:max][1] >= 1.5)
  dupla = me.merge(tri, me.flipWinding(me.clone(tri)))
  checar("mesh.merge", me.triangleCount(dupla) == 2)
  helix.scene.spawn("mesh", { name: "Triangulo", mesh: dupla, material: helix.material.create({ baseColor: "#06d6a0", doubleSided: true }), position: [7, 0, -2] })
  grande = me.scale(me.translate(me.clone(caixa), [0, 0.5, 0]), 2)
  checar("mesh.translate/scale", me.computeBounds(grande)[:max][1] > 1.9)
  dist = me.raycast(helix.math.ray.create([0, 5, 0], [0, -1, 0]), grande)
  checar("mesh.raycast", dist.is_a?(Numeric) && dist > 0, dist)
  checar("primitivas extras", me.triangleCount(me.torusKnot) > 0 && me.triangleCount(me.capsule) > 0)
end

                                                                                                        

def materiais
  mat = helix.material
  base = mat.create({ name: "DebugBase", baseColor: "#d98c2b", roughness: 0.5, metallic: 0.1 })
  checar("material.create", base.roughness == 0.5)
  copia = mat.clone(base)
  mat.set(copia, { roughness: 1, emissive: "#ffffff", emissiveIntensity: 2 })
  checar("material.clone/set", copia.roughness == 1 && base.roughness == 0.5)
  caixa = helix.scene.spawnPrimitive("box", { name: "CaixaPintada", position: [-7, 0.5, 2] })
  mat.assign(caixa, base)
  checar("material.assign/of", !mat.of(caixa).nil?)
  mat.own(caixa)
  mat.setColor(caixa, "#d98c2b")
  checar("materials.list", helix.materials.list.is_a?(Array))
  sombreado = mat.fromShader("DebugSuperficie", { glow: [1, 0.45, 0.1], speed: 2 })
  checar("material.fromShader", !sombreado.nil?)
  return if sombreado.nil?

  esfera = helix.scene.spawnPrimitive("sphere", { name: "EsferaShader", position: [0, 1, -3], scale: 1.4 })
  mat.assign(esfera, sombreado)
  mat.uniforms(esfera).set("speed", 3)
  checar("material.uniforms.list", mat.uniforms(esfera).list.size >= 1)
end

def luzes
  luz = helix.light
  lampada = luz.spawn("point", { name: "Lampada", position: [0, 3, 0], color: "#ffd166", intensity: 60, range: 14 })
  checar("light.spawn", !lampada.light.nil? && lampada.light.type == "point")
  luz.set(lampada, { intensity: 80 })
  checar("light.set", lampada.light.intensity == 80)
  luz.setTemperature(lampada, 3200)
  foco = luz.spawn("spot", { name: "Holofote", position: [4, 4, 0], rotation: [-90, 0, 0], intensity: 120, range: 16, innerAngle: 20, outerAngle: 35, color: "#ffffff" })
  checar("spot", foco.light.type == "spot")
  checar("light.presets", luz.presets.size > 0)
  checar("light.all", luz.all({ local: true }).size >= 2)
  checar("effectiveRange", luz.effectiveRange(lampada) > 0)
  checar("light.isLocal", luz.isLocal(lampada))
  luz.setColor(lampada, "#ffffff")
end

def ceu
  sky = helix.sky
`;
}
