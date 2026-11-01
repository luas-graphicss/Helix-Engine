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
  sky.set({ timeOfDay: 10.5, haze: 0.3, clouds: { enabled: true, coverage: 0.45 } })
  checar("sky.set", aprox(sky.timeOfDay, 10.5) && sky.clouds.enabled == true)
  checar("sky.isDay", sky.isDay == true)
  checar("sky.sunDirection", sky.sunDirection[1] > 0)
  checar("sky.wrapTimeOfDay", sky.wrapTimeOfDay(25) == 1)
  checar("sky.presets", sky.presets.size > 0)
  assinar(sky.onHourChanged { |hora| helix.log.info("Debug", "Hora do céu: #{hora}") })
  sky.cycleSpeed = 0
  checar("sky.cycleSpeed", sky.cycleSpeed == 0)
  checar("world.gravity", helix.world.gravity[1] < 0)
  helix.world.wind.set({ speed: 2, direction: 45 })
  checar("world.wind.set", helix.world.wind.speed == 2)
end

def camera
  cam = helix.camera
  checar("camera.fov", cam.fov > 0 && cam.aspect > 0)
  checar("camera.near/far", cam.near > 0 && cam.far > cam.near)
  checar("viewport", cam.viewport.width > 0)
  tela = cam.worldToScreen([0, 0, 0])
  checar("worldToScreen", tela.nil? || tela.x.is_a?(Numeric))
  raio = cam.screenToRay(cam.viewport.width / 2.0, cam.viewport.height / 2.0)
  checar("screenToRay", raio.nil? || aprox(helix.math.vec3.length(raio[:direction]), 1, 0.01))
  checar("viewMatrix", cam.viewMatrix.size == 16)
  cam.player.set({ distance: 7, pitch: 18 })
  checar("player.set", cam.player.settings.distance == 7)
  checar("distanceTo", cam.distanceTo([0, 0, 0]) >= 0)
  checar("camera.position", cam.position.size == 3 && cam.forward.size == 3)
  assinar(cam.onMainChanged { |ator| helix.log.info("Debug", "Câmera principal: #{ator ? ator.name : "editor/jogador"}") })
end

def pos_processamento
  post = helix.post
  checar("post.toneMappers", post.toneMappers.size > 0)
  post.set({
    bloom: { enabled: true, intensity: 0.5, threshold: 1, softKnee: 0.5, radius: 0.6 },
    vignette: { enabled: true, intensity: 0.35, smoothness: 0.5, roundness: 1 },
  })
  checar("post.set", post.bloom.enabled == true && post.vignette.enabled == true)
  post.exposure = 1.05
  checar("post.exposure", aprox(post.exposure, 1.05))
  post.toneMapper = "agx"
  checar("post.toneMapper", post.toneMapper == "agx")
  checar("post.presets", post.presets.size > 0)
  efeito = post.custom.add({ fragment: "DebugPost", name: "DebugPost", uniforms: { tint: [0.15, 0.05, 0.3], strength: 0.6 } })
  @efeito = efeito
  checar("post.custom.add", !efeito.nil? && !post.custom.get("DebugPost").nil?)
  efeito.uniforms.set("strength", 0.8)
  checar("efeito.uniforms.list", efeito.uniforms.list.size >= 2)
end

def render
  rend = helix.render
  checar("render.passNames", rend.passNames.size > 0)
  checar("render.stats", rend.stats.drawCalls.is_a?(Numeric))
  checar("render.frame", rend.frame.width.is_a?(Numeric))
  assinar(rend.onAfterFrame { @renders += 1 })
  rend.showGrid = false
  checar("render.showGrid", rend.showGrid == false)
  checar("render.pixelRatio", rend.pixelRatio > 0)
end

                                                                                                    

def fisica
  fis = helix.physics
  checar("physics.enabled", fis.enabled == true)
  checar("physics.gravity", fis.gravity[1] < 0)
  checar("physics.settings", fis.settings.fixedTimestep > 0)
  5.times do |i|
    caixa = helix.scene.spawnPrimitive("box", { name: "Caixa#{i + 1}", position: [-2 + i * 1.1, 3 + i * 1.2, 3], rigidBody: { type: "dynamic", collider: "box", mass: 2, restitution: 0.3 }, tags: ["caixa"] })
    helix.material.setColor(caixa, helix.math.color.hsl(42 + i * 12, 0.7, 0.5))
  end
  caixas = helix.scene.byTag("caixa")
  checar("caixas dinâmicas", caixas.size == 5 && fis.hasBody(caixas[0]))
  corpo = fis.bodyOf(caixas[0])
  checar("bodyOf", corpo.isDynamic && corpo.mass > 0)
  corpo.applyImpulse([0, 2, 0])
  corpo.applyTorque([0, 1, 0])
  corpo.setMaterial({ friction: 0.8 })
  corpo.wake
  checar("body.linearVelocity", corpo.linearVelocity.size == 3)
  checar("bodies()", fis.bodies.size >= 6)
  hit = fis.raycast([0, 5, 0], [0, -1, 0], 20)
  checar("physics.raycast", hit && hit[:entity], hit && hit[:entity]&.name)
  checar("raycastAll", fis.raycastAll([0, 5, 0], [0, -1, 0], 20).size >= 1)
  checar("overlapSphere", fis.overlapSphere([0, 3, 3], 4).is_a?(Array))
  checar("massProperties", fis.massProperties(caixas[0]).mass > 0)
  checar("colliderVolume", fis.colliderVolume(caixas[0]) > 0)
  checar("shapes.sphere volume", aprox(fis.shapes.volume(fis.shapes.sphere(1)), 4.18879, 0.01))
  assinar(fis.onCollisionBegin { |e|
    @colisoes += 1
    helix.log.info("Debug", "Colisão: #{e.a.name} × #{e.b.name}#{format(" (impulso %.2f)", e.contact.impulse)}") if @colisoes <= 3
  })
  assinar(fis.onOutOfBounds { |ator| helix.log.warn("Debug", "#{ator.name} caiu do mundo") })
  gatilho = helix.scene.spawn("group", { name: "Gatilho", position: [0, 1, 3], trigger: { shape: "box", size: [3, 2, 3] } })
  checar("trigger spawn", !gatilho.nil? && helix.scene.isAttached(gatilho))
  checar("physics.stats", fis.stats.bodies.is_a?(Numeric))
end

def personagem
  heroi = helix.character.spawn({ name: "Heroi", position: [0, 1.2, 8], character: { walkSpeed: 4, runSpeed: 7, jumpHeight: 1.4 } })
  @heroi = heroi
  checar("character.spawn", !heroi.character.nil? && helix.character.has(heroi))
  controle = helix.character.of(heroi)
  checar("character.of", [true, false].include?(controle.isGrounded))
  checar("settingsOf", helix.character.settingsOf(heroi).walkSpeed == 4)
  helix.player.possess(heroi)
  checar("player.possess", helix.player.possessed == heroi && helix.player.isPossessing)
  assinar(helix.character.onJumped { |e| helix.log.info("Debug", "#{e.entity.name} pulou") })
  assinar(helix.player.onPossessed { |ator| helix.log.info("Debug", "Possuindo #{ator ? ator.name : "ninguém"}") })
  checar("character.all", helix.character.all.size >= 1)
  checar("player.spawnPoint", helix.player.spawnPoint.size == 3)
  checar("character.velocity", controle.velocity.size == 3 && controle.position.size == 3)
end

def terreno
  terr = helix.terrain
  checar("terrain.presets", terr.presets.size > 0)
  colinas = terr.spawn({ name: "Colinas", size: 48, resolution: 65, preset: "hills", seed: 7, position: [0, -6, -70] })
  checar("terrain.spawn", !colinas.terrain.nil? && terr.all.size >= 1)
  checar("terrain.of", terr.of(colinas).resolution == 65)
  altura = terr.heightAt([0, 0, -70], colinas)
  checar("heightAt", altura.is_a?(Numeric), altura)
  checar("contains", terr.contains([0, 0, -70], colinas) && !terr.contains([500, 0, 0], colinas))
  terr.sculpt(colinas, "raise", [5, 0, -70], { radius: 6, strength: 1 }, 1)
  terr.markDirty(colinas)
  terr.grass.set(colinas, { enabled: true, density: 0.5 })
  checar("grass.set", terr.grass.settingsOf(colinas).enabled == true)
  terr.water.set(colinas, { enabled: true, level: -2 })
  checar("water.set", terr.water.settingsOf(colinas).enabled == true)
  checar("terrain.raycast", !terr.raycast([0, 50, -70], [0, -1, 0], colinas).nil?)
end

                                                                                                   

def interface_grafica
  gui = helix.gui
  gui.css("DebugEstilo")
  hud = gui.html("DebugHud", { id: "debug-hud" })
  checar("gui.html", !hud.nil? && !gui.element("#debug-hud").nil?)
  icone = gui.svg("DebugIcone", { id: "debug-icone" })
  checar("gui.svg", !icone.nil?)
  slot = gui.element("[data-slot=icone]")
  slot.appendChild(icone) if slot && icone
  checar("gui.bind", gui.bind("linguagem", LINGUAGEM) >= 1)
  gui.bind("titulo", "Helix · Debug")
  assinar(gui.onAction("caixa") { soltar_caixa })
  assinar(gui.onAction("reiniciar") { helix.play.restart })
  checar("gui.elements", gui.elements("[data-bind]").size >= 5)
  checar("gui.size", gui.size.width > 0)
  tela = gui.create("DebugTela", { referenceSize: { x: 1280, y: 720 } })
  painel = gui.add(tela, "frame", { name: "Painel", rect: { position: { x: { scale: 1, offset: -236 }, y: { scale: 0, offset: 16 } }, size: { x: { scale: 0, offset: 220 }, y: { scale: 0, offset: 48 } } } })
  gui.add(tela, "text", { name: "Rotulo", text: "Tela declarativa OK" }, painel.node.id)
  checar("gui.add/find", gui.find(tela, "Rotulo").kind == "text")
  gui.setText(tela, "Rotulo", "Tela declarativa OK · #{LINGUAGEM}")
  @tela = gui.show(tela, "debug-tela")
  checar("gui.show/isShown", gui.isShown(@tela))
  checar("gui.kinds", gui.kinds.is_a?(Array))
end

def audio
  som = helix.audio
  checar("audio.supported", [true, false].include?(som.supported))
  som.mixer.setVolumeDb("sfx", -3)
  checar("mixer.setVolumeDb", som.mixer.bus("sfx").volumeDb == -3)
  checar("audio.clips", som.clips.is_a?(Array))
  fonte = helix.scene.spawn("sound", { name: "FonteSonora", position: [3, 1, 3], audioSource: { trigger: "manual", spatial: true } })
  checar("spawn sound", !fonte.audioSource.nil?)
  som.sources.set(fonte, { volumeDb: -4 })
  checar("sources.set", fonte.audioSource.volumeDb == -4)
  checar("sources.isPlaying", som.sources.isPlaying(fonte) == false)
end

def efeitos_visuais
  vfx = helix.vfx
  ids = vfx.templates.ids
  checar("vfx.templates", ids.size > 0)
  checar("vfx.moduleKinds", vfx.moduleKinds.size > 0)
  doc = vfx.fromTemplate(ids[0], "DebugFaiscas")
  doc = vfx.addEmitter(doc, { name: "Extra", maxParticles: 50 })
  doc = vfx.set(doc, { loop: true })
  checar("vfx.fromTemplate/addEmitter", doc[:emitters].size >= 2 && doc[:loop] == true)
  ativo = vfx.save(doc, "DebugFaiscas")
  checar("vfx.save", ativo.kind == "vfx")
  ator = vfx.emitAt(ativo, [0, 1.5, -8], { destroyWhenFinished: false })
  checar("vfx.emitAt", vfx.has(ator))
  vfx.burst(ator, 20)
  checar("vfx.stats", vfx.stats.effects.is_a?(Numeric))
end

                                                                                                   

def soltar_caixa
  caixa = helix.scene.spawnPrimitive("box", { name: "CaixaSolta", position: [helix.math.random.range(-3, 3), 6, helix.math.random.range(0, 4)], rigidBody: { type: "dynamic", collider: "box", mass: 1 }, tags: ["caixa"] })
  helix.material.setColor(caixa, helix.math.random.color)
  @pontos += 1
  helix.gui.bind("pontos", @pontos)
  helix.events.emit("debug.caixa", { nome: caixa.name })
end

def ao_teclar(evento)
  return if evento.repeat?

  case evento.code
  when "KeyR" then helix.play.restart
  when "KeyB" then soltar_caixa
  when "KeyE" then helix.events.emit("debug.ping", { origem: "teclado", quadro: helix.time.frame })
  when "KeyF" then helix.camera.shake(0.4, 0.6)
  when "KeyG"
    if @efeito
      @efeito.enabled = !@efeito.enabled
      helix.log.info("Debug", "Efeito DebugPost #{@efeito.enabled ? "ligado" : "desligado"}")
    end
  when "KeyT"
    helix.time.scale = helix.time.scale == 1 ? 0.3 : 1
    helix.log.info("Debug", "time.scale = #{helix.time.scale}")
  when "KeyH"
    return unless @tela

    helix.gui.isShown(@tela) ? helix.gui.hide(@tela) : helix.gui.show(@tela, "debug-tela")
  when "KeyL"
    nomes = helix.light.all({ local: true }).map { |luz| luz.entity.name }
    helix.log.info("Debug", "Luzes locais: #{nomes.join(", ")}")
  end
end

def clique_na_cena(x, y)
  alvo = helix.camera.pick(x, y)
  ponto = helix.camera.pickPoint(x, y)
  helix.log.info("Debug", "Clique em #{alvo.name}") if alvo
  helix.debug.sphere(ponto, 0.3, "#ff006e", 2) if ponto
end

def entrada
  inp = helix.input
  inp.actions.define("pular", ["Space", "Gamepad:0"])
  inp.actions.define("soltar", ["KeyB"])
  checar("actions.define/bindings", inp.actions.bindings("pular").size >= 1)
  checar("action()", inp.action("pular").name == "pular" && [true, false].include?(inp.actions.down("pular")))
  checar("isDown", inp.isDown("KeyW") == false)
  checar("pointer", inp.pointer.x.is_a?(Numeric))
  checar("gamepads", inp.gamepads.is_a?(Array))
  checar("axis2d", inp.axis2d({ up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }).x.is_a?(Numeric))
  checar("keysDown", inp.keysDown.is_a?(Array))
  assinar(inp.onKeyDown(method(:ao_teclar)))
  assinar(inp.onPointerDown { |e| clique_na_cena(e.x, e.y) if e.button == 0 })
  assinar(inp.onGamepadButtonDown { |e| helix.log.info("Debug", "Gamepad #{e.pad} botão #{e.button}") })
end

def eventos
  ev = helix.events
  recebido = nil
  desligar = ev.on("debug.ping") { |carga| recebido = carga }
  checar("events.emit conta ouvintes", ev.emit("debug.ping", { origem: "teste" }) == 1)
  checar("events.on recebe", recebido && recebido[:origem] == "teste")
  checar("listenerCount", ev.listenerCount("debug.ping") == 1)
  desligar.call
  checar("unsubscribe", ev.listenerCount("debug.ping") == 0)
  uma_vez = 0
  ev.once("debug.once") { uma_vez += 1 }
  ev.emit("debug.once")
  ev.emit("debug.once")
  checar("events.once", uma_vez == 1)
  assinar(ev.on("debug.ping") { |carga| helix.log.info("Debug", "ping de #{carga[:origem]}") })
  assinar(ev.on("debug.caixa") { |carga| helix.log.debug("Debug", "caixa #{carga[:nome]}") })
  do_ator = 0
  assinar(ev.onEntity(@torus, "toque") { do_ator += 1 })
  ev.emitEntity(@torus, "toque")
  checar("onEntity/emitEntity", do_ator == 1)
  assinar(helix.play.onStopped { helix.log.info("Debug", "play.onStopped disparou") })
  assinar(helix.play.onPaused { helix.log.info("Debug", "pausado") })
  assinar(helix.play.onResumed { helix.log.info("Debug", "retomado") })
end

def tempo
  tm = helix.time
  checar("time.now", tm.now >= 0 && tm.frame >= 0)
  checar("time.delta", tm.delta >= 0 && tm.fixedDelta > 0)
  inicio = tm.now
  tm.wait(0.1)
  checar("time.wait", tm.now - inicio >= 0.09, format("%.3f", tm.now - inicio))
  quadro = tm.frame
  tm.waitFrames(2)
  checar("time.waitFrames", tm.frame >= quadro + 2, tm.frame - quadro)
  assinar(tm.every(2) { helix.gui.bind("atores", helix.scene.count) })
  disparou = false
  tm.delay(0.2) { disparou = true }
  tm.wait(0.3)
  checar("time.delay", disparou)
end

def dados
  st = helix.storage
  st.ready
  execucoes = (st.get("execucoes", 0) || 0) + 1
  st.set("execucoes", execucoes)
  checar("storage.get/set", st.get("execucoes") == execucoes && st.has("execucoes"), execucoes)
  helix.log.info("Debug", "Execução nº #{execucoes} deste jogo de teste neste projeto.")
  cfg = helix.assets.data("DebugConfig")
  checar("assets.data (TOML)", cfg&.dig(:jogador, :velocidade) == 6.5)
  checar("assets.text", helix.assets.text("DebugConfig").include?("velocidade"))
  checar("assets.byName", !helix.assets.byName("DebugJogo", "script").nil?)
  checar("assets.exists", helix.assets.exists("DebugUtil") && !helix.assets.exists("NaoExiste"))
  checar("assets.search", helix.assets.search("Debug").size >= 5)
  checar("project.name", helix.project.name.is_a?(String))
  checar("project.stats", helix.project.stats.entities > 0)
  checar("net.localPlayer", helix.net.localPlayer[:local] == true)
  checar("play.state", helix.play.state == "playing" && helix.play.isRunning)
end

                                                                                                 

def on_load
  puts "on_load do script de entrada (puts chega ao console)"
end

def on_start
  helix.log.info("Debug", "Jogo de teste em #{LINGUAGEM}: percorrendo a API…")
  area("Núcleo") { nucleo }
  area("Módulo (require)") { modulo }
  area("Matemática") { matematica }
  area("Cena") { cena }
  area("Transformações") { transformacao }
  area("Malhas e CSG") { malhas }
  area("Materiais") { materiais }
  area("Luzes") { luzes }
  area("Céu e mundo") { ceu }
  area("Câmera") { camera }
  area("Pós-processamento") { pos_processamento }
  area("Render") { render }
  area("Física") { fisica }
  area("Personagem e jogador") { personagem }
  area("Terreno") { terreno }
  area("Interface") { interface_grafica }
  area("Áudio") { audio }
  area("VFX") { efeitos_visuais }
  area("Entrada") { entrada }
  area("Eventos") { eventos }
  area("Tempo e tarefas") { tempo }
  area("Dados, projeto e rede") { dados }
  girador = helix.assets.byName("DebugGirador", "script")
  if girador
    extra = helix.scene.spawnPrimitive("box", { name: "GiradorDinamico", position: [-2, 0.5, -3], rigidBody: { type: "kinematic", collider: "box" }, script: { assetId: girador.id, props: { velocidade: 180, cor: "#00b4d8" } } })
    checar("spawn com script", !extra.script.nil? && extra.script.assetId == girador.id)
  else
    checar("ativo DebugGirador", false, "não está na biblioteca")
  end
  dica = "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia."
  if @falhas.zero?
    helix.log.info("Debug", "API percorrida em #{LINGUAGEM}: #{@checagens} checagens, nenhuma falha. #{dica}")
  else
    helix.log.warn("Debug", "API percorrida em #{LINGUAGEM}: #{@checagens} checagens, #{@falhas} falhas (veja FALHOU/ERRO acima). #{dica}")
  end
  helix.gui.bind("checagens", @checagens)
  helix.gui.bind("falhas", @falhas)
end

def on_update(dt)
  @quadros += 1
  helix.transform.rotate(@torus, [0, 40 * dt, 0]) if @torus
  d = helix.debug
  d.line([-6, 0.05, -6], [6, 0.05, -6], "#ff006e")
  d.box({ center: [0, 1, 3], size: [3, 2, 3] }, "#ffbe0b")
  if @heroi
    d.axes(@heroi, 1)
    d.text(helix.math.vec3.add(helix.transform.worldPosition(@heroi), [0, 2.2, 0]), "Heroi · #{@pontos} pts", "#ffffff")
  end
  d.ray([0, 3, 0], [0, -1, 0], 3, "#06d6a0")
  @hud_timer += dt
  return if @hud_timer < 0.5

  @hud_timer = 0.0
  helix.gui.bind("fps", helix.render.stats.fps.round)
  helix.gui.bind("checagens", @checagens)
  helix.gui.bind("falhas", @falhas)
end

def on_fixed_update(passo)
  @passos_fisica += 1
  checar("on_fixed_update recebe o passo", passo > 0 && passo < 1, passo) if @passos_fisica == 1
end

def on_late_update
  @late_updates += 1
end

def on_before_hot_reload
  { pontos: @pontos }
end

def on_hot_reload(anterior)
  @pontos = anterior && anterior[:pontos].is_a?(Numeric) ? anterior[:pontos] : 0
  helix.log.info("Debug", "Recarga a quente: #{@pontos} pontos preservados")
end

def on_stop
  @assinaturas.each(&:call)
  helix.log.info("Debug", "Parou: #{@quadros} quadros, #{@passos_fisica} passos de física, #{@late_updates} lateUpdates, #{@renders} frames (onAfterFrame), #{@colisoes} colisões.")
end
`;
    const actor = `                                
                                                                                             
                                                                                                             
                                                                                               
class DebugGirador
  def initialize
    @angulo = 0.0
    @contatos = 0
    @quadros = 0
    @desligar = nil
  end

  def on_load
    helix.props.define({
      velocidade: { type: "range", default: 90, min: 0, max: 360, step: 1, label: "Velocidade (°/s)" },
      cor: { type: "color", default: "#ff8800", label: "Cor" },
      pulsar: { type: "boolean", default: true, label: "Pulsar" },
    })
  end

  def on_start
    helix.log.info("Girador", "#{actor.name} acordou com velocidade #{helix.props.get("velocidade")}°/s")
    helix.material.setColor(actor, helix.props.get("cor"))
    @desligar = helix.props.onChanged("cor") { |cor| helix.material.setColor(actor, cor) }
    helix.log.assert(helix.props.has("velocidade") && helix.props.definitions.size == 3, "props.define deveria registrar 3 propriedades")
  end

  def on_update(dt)
    @quadros += 1
    @angulo += helix.props.get("velocidade") * dt
    helix.transform.setRotation(actor, [0, @angulo, 0])
    helix.transform.setScale(actor, 1 + Math.sin(helix.time.now * 3) * 0.1) if helix.props.get("pulsar")
  end

  def on_collision_begin(outro, contato)
    @contatos += 1
    helix.log.info("Girador", "#{actor.name} tocou #{outro.name}#{format(" (impulso %.2f)", contato.impulse)}") if @contatos <= 3
  end

  def on_trigger_enter(outro)
    helix.log.info("Girador", "#{outro.name} entrou no gatilho de #{actor.name}")
  end

  def on_enable
    helix.log.debug("Girador", "#{actor.name} ativo")
  end

  def on_disable
    helix.log.debug("Girador", "#{actor.name} inativo")
  end

  def on_stop
    helix.log.info("Girador", "#{actor.name}: #{@quadros} quadros, #{@contatos} contatos")
  end

  def on_destroy
    @desligar&.call
  end
end
`;
    const module = `                                    
                                                                                                                 
                                                                                                    
module DebugUtil
  VERSAO = "1.0"

  def self.soma(a, b)
    a + b
  end

  def self.saudacao(quem)
    "Olá, #{quem}"
  end

  def self.limitar(valor, minimo, maximo)
    valor.clamp(minimo, maximo)
  end
end
`;
    return { entry, actor, module };
}
