import type { GameSources } from '../types';
export function luaGame(typed: boolean): GameSources {
    const t = (annotation: string): string => (typed ? annotation : '');
    const label = typed ? 'Luau' : 'Lua';
    const entry = `                                    
                                                                                    
                                                                                   
local util = require("DebugUtil")

local LINGUAGEM = "${label}"

local estado = {
  quadros = 0,
  passosFisica = 0,
  lateUpdates = 0,
  renders = 0,
  colisoes = 0,
  checagens = 0,
  falhas = 0,
  pontos = 0,
  hudTimer = 0,
  torus = nil,
  heroi = nil,
  efeito = nil,
  tela = nil,
  assinaturas = {},
}

local function checar(nome${t(': string')}, condicao${t(': any')}, detalhe${t(': any?')})
  estado.checagens = estado.checagens + 1
  if condicao then return end
  estado.falhas = estado.falhas + 1
  helix.log.error("Debug", "FALHOU " .. nome .. (detalhe == nil and "" or (": " .. tostring(detalhe))))
end

local function area(nome${t(': string')}, fn${t(': () -> ()')})
  local ok, erro = pcall(fn)
  if ok then
    helix.log.debug("Debug", "ok " .. nome)
  else
    estado.falhas = estado.falhas + 1
    helix.log.error("Debug", "ERRO em " .. nome .. ": " .. tostring(type(erro) == "table" and erro.message or erro))
  end
end

local function aprox(a${t(': number')}, b${t(': number')}, epsilon${t(': number?')})
  return math.abs(a - b) <= (epsilon or 0.001)
end

local function assinar(desligar)
  table.insert(estado.assinaturas, desligar)
end

local function mesmo(a, b)
  return a ~= nil and b ~= nil and a.id == b.id
end

                                                                                                            
local soltarCaixa

                                                                                               

local function nucleo()
  checar("engine.name", type(helix.engine.name) == "string" and #helix.engine.name > 0)
  checar("engine.version", type(helix.engine.version) == "string")
  checar("isPlaying", helix.isPlaying == true)
  checar("isEditor", helix.isEditor == false)
  checar("self no script de entrada", helix.self == nil)
  helix.log.info("Debug", helix.engine.name .. " " .. helix.engine.version .. " · API " .. tostring(helix.engine.apiVersion) .. " · " .. LINGUAGEM)
end

local function modulo()
  checar("require soma", util.soma(2, 3) == 5, util.soma(2, 3))
  checar("require saudacao", util.saudacao("Helix") == "Olá, Helix", util.saudacao("Helix"))
  checar("require limitar", util.limitar(15, 0, 10) == 10)
end

local function matematica()
  local m = helix.math
  local v = m.vec3.add({ 1, 2, 3 }, { 1, 1, 1 })
  checar("vec3.add", m.vec3.equals(v, { 2, 3, 4 }))
  checar("vec3.length", aprox(m.vec3.length({ 3, 4, 0 }), 5))
  checar("vec3.normalize", aprox(m.vec3.length(m.vec3.normalize({ 0, 5, 0 })), 1))
  checar("vec3.cross", m.vec3.equals(m.vec3.cross({ 1, 0, 0 }, { 0, 1, 0 }), { 0, 0, 1 }))
  checar("vec3.lerp", m.vec3.equals(m.vec3.lerp({ 0, 0, 0 }, { 2, 2, 2 }, 0.5), { 1, 1, 1 }))
  local q = m.quat.fromEuler({ 0, 90, 0 })
  checar("quat.rotateVec3", m.vec3.equals(m.quat.rotateVec3(q, { 1, 0, 0 }), { 0, 0, -1 }, 0.001))
  checar("quat.toEuler", aprox(m.quat.toEuler(q)[2], 90, 0.01))
  local mat = m.mat4.fromTRS({ 1, 2, 3 }, { 0, 0, 0 }, { 1, 1, 1 })
  checar("mat4.transformPoint", m.vec3.equals(m.mat4.transformPoint(mat, { 0, 0, 0 }), { 1, 2, 3 }))
  checar("mat4.invert", m.mat4.invert(mat) ~= nil)
  local caixa = m.aabb.fromCenterSize({ 0, 0, 0 }, { 2, 2, 2 })
  checar("aabb.contains", m.aabb.contains(caixa, { 0.5, 0.5, 0.5 }) and not m.aabb.contains(caixa, { 2, 0, 0 }))
  local raio = m.ray.create({ 0, 5, 0 }, { 0, -1, 0 })
  checar("ray.intersectAabb", m.ray.intersectAabb(raio, caixa) ~= nil)
  checar("scalar.remap", m.scalar.remap(5, 0, 10, 0, 100) == 50)
  checar("clamp/lerp", m.clamp(15, 0, 10) == 10 and m.lerp(0, 10, 0.5) == 5)
  checar("scalar.wrapAngle", aprox(m.scalar.wrapAngle(370), 10))
  checar("degToRad", aprox(m.degToRad(180), math.pi))
  local ruido = m.noise.perlin2(0.3, 0.7)
  checar("noise.perlin2", ruido >= -1.01 and ruido <= 1.01, ruido)
  checar("noise.fbm", type(m.noise.fbm(1.5, 2.5, 0, 4)) == "number")
  checar("color.hexToVec3", m.vec3.equals(m.color.hexToVec3("#ff0000"), { 1, 0, 0 }, 0.01))
  checar("color.vec3ToHex", string.lower(m.color.vec3ToHex({ 1, 1, 1 })) == "#ffffff", m.color.vec3ToHex({ 1, 1, 1 }))
  m.random.seed(42)
  local a = m.random.value()
  m.random.seed(42)
  checar("random.seed determinístico", m.random.value() == a)
  local sorteado = m.random.int(1, 6)
  checar("random.int", sorteado >= 1 and sorteado <= 6 and math.floor(sorteado) == sorteado)
  checar("random.unitVector", aprox(m.vec3.length(m.random.unitVector()), 1))
  checar("PI/TAU", aprox(m.TAU, m.PI * 2))
end

                                                                                                     

local function cena()
  local s = helix.scene
  checar("scene.root", s.root ~= nil)
  local antes = s.count()
  local grupo = s.spawn("group", { name = "DebugCenario" })
  local chao = s.spawn("mesh", {
    name = "Chao",
    mesh = helix.mesh.plane(40, 40),
    material = helix.material.create({ baseColor = "#4b6b3a", roughness = 0.95 }),
    rigidBody = { type = "static", collider = "box", boxSize = { 40, 0.2, 40 }, center = { 0, -0.1, 0 } },
    receiveShadows = true,
    tags = { "chao" },
  }, grupo)
  checar("spawn mesh", chao.kind == "mesh" and chao.mesh ~= nil and chao.rigidBody ~= nil)
  checar("find", mesmo(s.find("Chao"), chao))
  checar("findAll", #s.findAll("Chao") == 1)
  checar("byId", mesmo(s.byId(chao.id), chao))
  checar("byTag", #s.byTag("chao") >= 1)
  checar("byKind", #s.byKind("mesh") >= 1)
  checar("count", s.count() == antes + 2, tostring(s.count()) .. " vs " .. tostring(antes + 2))
  checar("contains", s.contains(grupo, chao) and s.contains(s.root, chao))
  checar("path", string.find(s.path(chao), "Chao", 1, true) ~= nil, s.path(chao))
  local visitados = 0
  s.traverse(function() visitados = visitados + 1 end, grupo)
  checar("traverse", visitados >= 2, visitados)

  local torus = s.spawnPrimitive("torus", { name = "Anel", position = { -4, 1.2, -2 }, scale = 1.5 }, grupo)
  helix.material.setColor(torus, "#3a86ff")
  helix.material.setEmissive(torus, "#3a86ff", 0.6)
  estado.torus = torus
  checar("spawnPrimitive", torus.mesh ~= nil and torus.material ~= nil)

  local copia = s.clone(torus, true, grupo)
  s.rename(copia, "AnelCopia")
  helix.transform.setPosition(copia, { -4, 1.2, 2 })
  checar("clone + rename", copia.name == "AnelCopia" and mesmo(s.find("AnelCopia"), copia))
  s.setMeta(copia, "origem", "clone")
  checar("meta", s.getMeta(copia, "origem") == "clone")
  s.addTag(copia, "temporario")
  checar("addTag/hasTag", s.hasTag(copia, "temporario"))
  checar("removeTag", s.removeTag(copia, "temporario") == true and not s.hasTag(copia, "temporario"))
  s.setVisible(copia, false)
  checar("setVisible", copia.visible == false)
  s.setVisible(copia, true)
  s.destroy(copia)
  checar("destroy", s.find("AnelCopia") == nil and not s.isAttached(copia))

  local esfera = s.spawnPrimitive("sphere", { name = "Esfera", position = { 4, 0.5, -3 } })
  s.reparent(esfera, grupo)
  checar("reparent", mesmo(esfera.parent, grupo))
  helix.material.setColor(esfera, "#ffbe0b")
  s.addComponent(esfera, "rigidBody", { type = "dynamic", collider = "sphere", radius = 0.5, mass = 1 })
  checar("addComponent", esfera.rigidBody ~= nil and esfera.rigidBody.type == "dynamic")
  local temporario = s.spawnPrimitive("box", { name = "Temporario" })
  s.addComponent(temporario, "csg", {})
  checar("addComponent csg", temporario.csg ~= nil)
  s.removeComponent(temporario, "csg")
  checar("removeComponent", temporario.csg == nil)
  s.destroy(temporario)
end

local function transformacao()
  local tr = helix.transform
  local m = helix.math
  local alvo = helix.scene.spawnPrimitive("cone", { name = "Cone", position = { 0, 0.5, -6 } })
  helix.material.setColor(alvo, "#8338ec")
  tr.setPosition(alvo, { 2, 0.5, -6 })
  checar("setPosition", m.vec3.equals(tr.position(alvo), { 2, 0.5, -6 }))
  tr.translate(alvo, { 0, 1, 0 }, "world")
  checar("translate", aprox(tr.position(alvo)[2], 1.5))
  tr.setRotation(alvo, { 0, 90, 0 })
  checar("setRotation", aprox(tr.rotation(alvo)[2], 90, 0.01))
  tr.rotate(alvo, { 0, 45, 0 })
  checar("rotate", aprox(m.scalar.wrapAngle(tr.rotation(alvo)[2]), 135, 0.01) or aprox(m.scalar.wrapAngle(tr.rotation(alvo)[2]), -225, 0.01))
  tr.setScale(alvo, 2)
  checar("setScale", aprox(tr.scale(alvo)[1], 2))
  tr.setScale(alvo, { 1, 1, 1 })
  checar("worldPosition", #tr.worldPosition(alvo) == 3)
  checar("forward/up", aprox(m.vec3.length(tr.forward(alvo)), 1) and aprox(m.vec3.length(tr.up(alvo)), 1))
  tr.lookAt(alvo, { 0, 1.5, 0 })
  checar("distance", tr.distance(alvo, { 2, 1.5, -6 }) < 0.01)
  checar("directionTo", aprox(m.vec3.length(tr.directionTo(alvo, { 0, 1.5, 0 })), 1))
  checar("bounds", tr.bounds(alvo) ~= nil)
  checar("worldMatrix", #tr.worldMatrix(alvo) == 16)
end

local function malhas()
  local me = helix.mesh
  local caixa = me.box(1, 1, 1)
  checar("mesh.box", me.vertexCount(caixa) > 0 and me.triangleCount(caixa) == 12, me.triangleCount(caixa))
  local esfera = me.sphere(0.65, 16, 12)
  local furado = helix.csg.boolean(caixa, esfera, "subtract")
  checar("csg.boolean", me.triangleCount(furado) > 12)
  local ator = helix.scene.spawn("mesh", { name = "CaixaFurada", mesh = furado, material = helix.material.create({ baseColor = "#e63946", roughness = 0.4, metallic = 0.2 }), position = { 4, 0.5, 2 } })
  checar("spawn malha CSG", ator.mesh ~= nil)
  local tri = me.create({ name = "Triangulo", positions = { -1, 0, 0, 1, 0, 0, 0, 1.5, 0 }, uvs = { 0, 0, 1, 0, 0.5, 1 }, indices = { 0, 1, 2 } })
  me.computeNormals(tri)
  checar("mesh.create + computeBounds", me.computeBounds(tri).max[2] >= 1.5)
  local dupla = me.merge(tri, me.flipWinding(me.clone(tri)))
  checar("mesh.merge", me.triangleCount(dupla) == 2)
  helix.scene.spawn("mesh", { name = "Triangulo", mesh = dupla, material = helix.material.create({ baseColor = "#06d6a0", doubleSided = true }), position = { 7, 0, -2 } })
  local grande = me.scale(me.translate(me.clone(caixa), { 0, 0.5, 0 }), 2)
  checar("mesh.translate/scale", me.computeBounds(grande).max[2] > 1.9)
  local dist = me.raycast(helix.math.ray.create({ 0, 5, 0 }, { 0, -1, 0 }), grande)
  checar("mesh.raycast", dist ~= nil and dist > 0, dist)
  checar("primitivas extras", me.triangleCount(me.torusKnot()) > 0 and me.triangleCount(me.capsule()) > 0)
end

                                                                                                         

local function materiais()
  local mat = helix.material
  local base = mat.create({ name = "DebugBase", baseColor = "#d98c2b", roughness = 0.5, metallic = 0.1 })
  checar("material.create", base.roughness == 0.5)
  local copia = mat.clone(base)
  mat.set(copia, { roughness = 1, emissive = "#ffffff", emissiveIntensity = 2 })
  checar("material.clone/set", copia.roughness == 1 and base.roughness == 0.5)
  local caixa = helix.scene.spawnPrimitive("box", { name = "CaixaPintada", position = { -7, 0.5, 2 } })
  mat.assign(caixa, base)
  checar("material.assign/of", mat.of(caixa) ~= nil)
  mat.own(caixa)
  mat.setColor(caixa, "#d98c2b")
  checar("materials.list", type(helix.materials.list()) == "table")
  local sombreado = mat.fromShader("DebugSuperficie", { glow = { 1, 0.45, 0.1 }, speed = 2 })
  checar("material.fromShader", sombreado ~= nil)
  if sombreado ~= nil then
    local esfera = helix.scene.spawnPrimitive("sphere", { name = "EsferaShader", position = { 0, 1, -3 }, scale = 1.4 })
    mat.assign(esfera, sombreado)
    mat.uniforms(esfera).set("speed", 3)
    checar("material.uniforms.list", #mat.uniforms(esfera).list() >= 1)
  end
end

local function luzes()
  local l = helix.light
  local lampada = l.spawn("point", { name = "Lampada", position = { 0, 3, 0 }, color = "#ffd166", intensity = 60, range = 14 })
  checar("light.spawn", lampada.light ~= nil and lampada.light.type == "point")
  l.set(lampada, { intensity = 80 })
  checar("light.set", lampada.light.intensity == 80)
  l.setTemperature(lampada, 3200)
  local foco = l.spawn("spot", { name = "Holofote", position = { 4, 4, 0 }, rotation = { -90, 0, 0 }, intensity = 120, range = 16, innerAngle = 20, outerAngle = 35, color = "#ffffff" })
  checar("spot", foco.light.type == "spot")
  checar("light.presets", #l.presets() > 0)
  checar("light.all", #l.all({ ["local"] = true }) >= 2)
  checar("effectiveRange", l.effectiveRange(lampada) > 0)
  checar("light.isLocal", l.isLocal(lampada))
  l.setColor(lampada, "#ffffff")
end

local function ceu()
  local sky = helix.sky
  sky.set({ timeOfDay = 10.5, haze = 0.3, clouds = { enabled = true, coverage = 0.45 } })
  checar("sky.set", aprox(sky.timeOfDay, 10.5) and sky.clouds.enabled == true)
  checar("sky.isDay", sky.isDay == true)
  checar("sky.sunDirection", sky.sunDirection()[2] > 0)
  checar("sky.wrapTimeOfDay", sky.wrapTimeOfDay(25) == 1)
  checar("sky.presets", #sky.presets() > 0)
  assinar(sky.onHourChanged(function(h) helix.log.info("Debug", "Hora do céu: " .. tostring(h)) end))
  sky.cycleSpeed = 0
  checar("sky.cycleSpeed", sky.cycleSpeed == 0)
  checar("world.gravity", helix.world.gravity[2] < 0)
  helix.world.wind.set({ speed = 2, direction = 45 })
  checar("world.wind.set", helix.world.wind.speed == 2)
end

local function camera()
  local c = helix.camera
  checar("camera.fov", c.fov > 0 and c.aspect > 0)
  checar("camera.near/far", c.near > 0 and c.far > c.near)
  checar("viewport", c.viewport.width > 0)
  local tela = c.worldToScreen({ 0, 0, 0 })
  checar("worldToScreen", tela == nil or type(tela.x) == "number")
  local raio = c.screenToRay(c.viewport.width / 2, c.viewport.height / 2)
  checar("screenToRay", raio == nil or aprox(helix.math.vec3.length(raio.direction), 1, 0.01))
  checar("viewMatrix", #c.viewMatrix == 16)
  c.player.set({ distance = 7, pitch = 18 })
  checar("player.set", c.player.settings.distance == 7)
  checar("distanceTo", c.distanceTo({ 0, 0, 0 }) >= 0)
  checar("camera.position", #c.position == 3 and #c.forward == 3)
  assinar(c.onMainChanged(function(e) helix.log.info("Debug", "Câmera principal: " .. (e and e.name or "editor/jogador")) end))
end

local function pos()
  local p = helix.post
  checar("post.toneMappers", #p.toneMappers() > 0)
  p.set({
    bloom = { enabled = true, intensity = 0.5, threshold = 1, softKnee = 0.5, radius = 0.6 },
    vignette = { enabled = true, intensity = 0.35, smoothness = 0.5, roundness = 1 },
  })
  checar("post.set", p.bloom.enabled == true and p.vignette.enabled == true)
  p.exposure = 1.05
  checar("post.exposure", aprox(p.exposure, 1.05))
  p.toneMapper = "agx"
  checar("post.toneMapper", p.toneMapper == "agx")
  checar("post.presets", #p.presets() > 0)
  local efeito = p.custom.add({ fragment = "DebugPost", name = "DebugPost", uniforms = { tint = { 0.15, 0.05, 0.3 }, strength = 0.6 } })
  estado.efeito = efeito
  checar("post.custom.add", efeito ~= nil and p.custom.get("DebugPost") ~= nil)
  efeito.uniforms.set("strength", 0.8)
  checar("efeito.uniforms.list", #efeito.uniforms.list() >= 2)
end

local function render()
  local r = helix.render
  checar("render.passNames", #r.passNames() > 0)
  checar("render.stats", type(r.stats.drawCalls) == "number")
  checar("render.frame", type(r.frame.width) == "number")
  assinar(r.onAfterFrame(function() estado.renders = estado.renders + 1 end))
  r.showGrid = false
  checar("render.showGrid", r.showGrid == false)
  checar("render.pixelRatio", r.pixelRatio > 0)
end

                                                                                                     

local function fisica()
  local ph = helix.physics
  checar("physics.enabled", ph.enabled == true)
  checar("physics.gravity", ph.gravity[2] < 0)
  checar("physics.settings", ph.settings.fixedTimestep > 0)
  for i = 1, 5 do
    local caixa = helix.scene.spawnPrimitive("box", { name = "Caixa" .. i, position = { -2 + (i - 1) * 1.1, 3 + (i - 1) * 1.2, 3 }, rigidBody = { type = "dynamic", collider = "box", mass = 2, restitution = 0.3 }, tags = { "caixa" } })
    helix.material.setColor(caixa, helix.math.color.hsl(30 + i * 12, 0.7, 0.5))
  end
  local caixas = helix.scene.byTag("caixa")
  checar("caixas dinâmicas", #caixas == 5 and ph.hasBody(caixas[1]))
  local corpo = ph.bodyOf(caixas[1])
  checar("bodyOf", corpo.isDynamic and corpo.mass > 0)
  corpo.applyImpulse({ 0, 2, 0 })
  corpo.applyTorque({ 0, 1, 0 })
  corpo.setMaterial({ friction = 0.8 })
  corpo.wake()
  checar("body.linearVelocity", #corpo.linearVelocity == 3)
  checar("bodies()", #ph.bodies() >= 6)
  local hit = ph.raycast({ 0, 5, 0 }, { 0, -1, 0 }, 20)
  checar("physics.raycast", hit ~= nil and hit.entity ~= nil, hit and hit.entity and hit.entity.name)
  checar("raycastAll", #ph.raycastAll({ 0, 5, 0 }, { 0, -1, 0 }, 20) >= 1)
  checar("overlapSphere", type(ph.overlapSphere({ 0, 3, 3 }, 4)) == "table")
  checar("massProperties", ph.massProperties(caixas[1]).mass > 0)
  checar("colliderVolume", ph.colliderVolume(caixas[1]) > 0)
  checar("shapes.sphere volume", aprox(ph.shapes.volume(ph.shapes.sphere(1)), 4.18879, 0.01))
  assinar(ph.onCollisionBegin(function(e)
    estado.colisoes = estado.colisoes + 1
    if estado.colisoes <= 3 then helix.log.info("Debug", "Colisão: " .. e.a.name .. " × " .. e.b.name .. string.format(" (impulso %.2f)", e.contact.impulse)) end
  end))
  assinar(ph.onOutOfBounds(function(e) helix.log.warn("Debug", e.name .. " caiu do mundo") end))
  local gatilho = helix.scene.spawn("group", { name = "Gatilho", position = { 0, 1, 3 }, trigger = { shape = "box", size = { 3, 2, 3 } } })
  checar("trigger spawn", gatilho ~= nil and helix.scene.isAttached(gatilho))
  checar("physics.stats", type(ph.stats.bodies) == "number")
end

local function personagem()
  local heroi = helix.character.spawn({ name = "Heroi", position = { 0, 1.2, 8 }, character = { walkSpeed = 4, runSpeed = 7, jumpHeight = 1.4 } })
  estado.heroi = heroi
  checar("character.spawn", heroi.character ~= nil and helix.character.has(heroi))
  local h = helix.character.of(heroi)
  checar("character.of", type(h.isGrounded) == "boolean")
  checar("settingsOf", helix.character.settingsOf(heroi).walkSpeed == 4)
  helix.player.possess(heroi)
  checar("player.possess", mesmo(helix.player.possessed, heroi) and helix.player.isPossessing)
  assinar(helix.character.onJumped(function(e) helix.log.info("Debug", e.entity.name .. " pulou") end))
  assinar(helix.player.onPossessed(function(e) helix.log.info("Debug", "Possuindo " .. (e and e.name or "ninguém")) end))
  checar("character.all", #helix.character.all() >= 1)
  checar("player.spawnPoint", #helix.player.spawnPoint == 3)
  checar("character.velocity", #h.velocity == 3 and #h.position == 3)
end

local function terreno()
  local te = helix.terrain
  checar("terrain.presets", #te.presets() > 0)
  local colinas = te.spawn({ name = "Colinas", size = 48, resolution = 65, preset = "hills", seed = 7, position = { 0, -6, -70 } })
  checar("terrain.spawn", colinas.terrain ~= nil and #te.all() >= 1)
  checar("terrain.of", te.of(colinas).resolution == 65)
  local altura = te.heightAt({ 0, 0, -70 }, colinas)
  checar("heightAt", altura ~= nil and type(altura) == "number", altura)
  checar("contains", te.contains({ 0, 0, -70 }, colinas) and not te.contains({ 500, 0, 0 }, colinas))
  te.sculpt(colinas, "raise", { 5, 0, -70 }, { radius = 6, strength = 1 }, 1)
  te.markDirty(colinas)
  te.grass.set(colinas, { enabled = true, density = 0.5 })
  checar("grass.set", te.grass.settingsOf(colinas).enabled == true)
  te.water.set(colinas, { enabled = true, level = -2 })
  checar("water.set", te.water.settingsOf(colinas).enabled == true)
  checar("terrain.raycast", te.raycast({ 0, 50, -70 }, { 0, -1, 0 }, colinas) ~= nil)
end

                                                                                                    

local function interfaceGrafica()
  local g = helix.gui
  g.css("DebugEstilo")
  local hud = g.html("DebugHud", { id = "debug-hud" })
  checar("gui.html", hud ~= nil and g.element("#debug-hud") ~= nil)
  local icone = g.svg("DebugIcone", { id = "debug-icone" })
  checar("gui.svg", icone ~= nil)
  local slot = g.element("[data-slot=icone]")
  if slot ~= nil and icone ~= nil then slot.appendChild(icone) end
  checar("gui.bind", g.bind("linguagem", LINGUAGEM) >= 1)
  g.bind("titulo", "Helix · Debug")
  assinar(g.onAction("caixa", function() soltarCaixa() end))
  assinar(g.onAction("reiniciar", function() helix.play.restart() end))
  checar("gui.elements", #g.elements("[data-bind]") >= 5)
  checar("gui.size", g.size.width > 0)
  local tela = g.create("DebugTela", { referenceSize = { x = 1280, y = 720 } })
  local painel = g.add(tela, "frame", { name = "Painel", rect = { position = { x = { scale = 1, offset = -236 }, y = { scale = 0, offset = 16 } }, size = { x = { scale = 0, offset = 220 }, y = { scale = 0, offset = 48 } } } })
  g.add(tela, "text", { name = "Rotulo", text = "Tela declarativa OK" }, painel.node.id)
  checar("gui.add/find", g.find(tela, "Rotulo").kind == "text")
  g.setText(tela, "Rotulo", "Tela declarativa OK · " .. LINGUAGEM)
  estado.tela = g.show(tela, "debug-tela")
  checar("gui.show/isShown", g.isShown(estado.tela))
  checar("gui.kinds", type(g.kinds()) == "table")
end

local function audio()
  local a = helix.audio
  checar("audio.supported", type(a.supported) == "boolean")
  a.mixer.setVolumeDb("sfx", -3)
  checar("mixer.setVolumeDb", a.mixer.bus("sfx").volumeDb == -3)
  checar("audio.clips", type(a.clips()) == "table")
  local fonte = helix.scene.spawn("sound", { name = "FonteSonora", position = { 3, 1, 3 }, audioSource = { trigger = "manual", spatial = true } })
  checar("spawn sound", fonte.audioSource ~= nil)
  a.sources.set(fonte, { volumeDb = -4 })
  checar("sources.set", fonte.audioSource.volumeDb == -4)
  checar("sources.isPlaying", a.sources.isPlaying(fonte) == false)
end

local function vfx()
  local v = helix.vfx
  local ids = v.templates.ids()
  checar("vfx.templates", #ids > 0)
  checar("vfx.moduleKinds", #v.moduleKinds() > 0)
  local doc = v.fromTemplate(ids[1], "DebugFaiscas")
  doc = v.addEmitter(doc, { name = "Extra", maxParticles = 50 })
  doc = v.set(doc, { loop = true })
  checar("vfx.fromTemplate/addEmitter", #doc.emitters >= 2 and doc.loop == true)
  local ativo = v.save(doc, "DebugFaiscas")
  checar("vfx.save", ativo.kind == "vfx")
  local ator = v.emitAt(ativo, { 0, 1.5, -8 }, { destroyWhenFinished = false })
  checar("vfx.emitAt", v.has(ator))
  v.burst(ator, 20)
  checar("vfx.stats", type(v.stats().effects) == "number")
end

                                                                                                    

soltarCaixa = function()
  local caixa = helix.scene.spawnPrimitive("box", { name = "CaixaSolta", position = { helix.math.random.range(-3, 3), 6, helix.math.random.range(0, 4) }, rigidBody = { type = "dynamic", collider = "box", mass = 1 }, tags = { "caixa" } })
  helix.material.setColor(caixa, helix.math.random.color())
  estado.pontos = estado.pontos + 1
  helix.gui.bind("pontos", estado.pontos)
  helix.events.emit("debug.caixa", { nome = caixa.name })
end

local function aoTeclar(e)
  if e["repeat"] then return end
  if e.code == "KeyR" then
    helix.play.restart()
  elseif e.code == "KeyB" then
    soltarCaixa()
  elseif e.code == "KeyE" then
    helix.events.emit("debug.ping", { origem = "teclado", quadro = helix.time.frame })
  elseif e.code == "KeyF" then
    helix.camera.shake(0.4, 0.6)
  elseif e.code == "KeyG" then
    if estado.efeito ~= nil then
      estado.efeito.enabled = not estado.efeito.enabled
      helix.log.info("Debug", "Efeito DebugPost " .. (estado.efeito.enabled and "ligado" or "desligado"))
    end
  elseif e.code == "KeyT" then
    helix.time.scale = (helix.time.scale == 1) and 0.3 or 1
    helix.log.info("Debug", "time.scale = " .. tostring(helix.time.scale))
  elseif e.code == "KeyH" then
    if estado.tela ~= nil then
      if helix.gui.isShown(estado.tela) then helix.gui.hide(estado.tela) else helix.gui.show(estado.tela, "debug-tela") end
    end
  elseif e.code == "KeyL" then
    local nomes = {}
    for _, luz in ipairs(helix.light.all({ ["local"] = true })) do table.insert(nomes, luz.entity.name) end
    helix.log.info("Debug", "Luzes locais: " .. table.concat(nomes, ", "))
  end
end

local function cliqueNaCena(x, y)
  local alvo = helix.camera.pick(x, y)
  local ponto = helix.camera.pickPoint(x, y)
  if alvo ~= nil then helix.log.info("Debug", "Clique em " .. alvo.name) end
  if ponto ~= nil then helix.debug.sphere(ponto, 0.3, "#ff006e", 2) end
end

local function entrada()
  local i = helix.input
  i.actions.define("pular", { "Space", "Gamepad:0" })
  i.actions.define("soltar", { "KeyB" })
  checar("actions.define/names", #i.actions.bindings("pular") >= 1)
  checar("action()", i.action("pular").name == "pular" and type(i.actions.down("pular")) == "boolean")
  checar("isDown", i.isDown("KeyW") == false)
  checar("pointer", type(i.pointer.x) == "number")
  checar("gamepads", type(i.gamepads()) == "table")
  checar("axis2d", type(i.axis2d({ up = "KeyW", down = "KeyS", left = "KeyA", right = "KeyD" }).x) == "number")
  checar("keysDown", type(i.keysDown()) == "table")
  assinar(i.onKeyDown(aoTeclar))
  assinar(i.onPointerDown(function(e) if e.button == 0 then cliqueNaCena(e.x, e.y) end end))
  assinar(i.onGamepadButtonDown(function(e) helix.log.info("Debug", "Gamepad " .. tostring(e.pad) .. " botão " .. tostring(e.button)) end))
end

local function eventos()
  local ev = helix.events
  local recebido = nil
  local off = ev.on("debug.ping", function(p) recebido = p end)
  checar("events.emit conta ouvintes", ev.emit("debug.ping", { origem = "teste" }) == 1)
  checar("events.on recebe", recebido ~= nil and recebido.origem == "teste")
  checar("listenerCount", ev.listenerCount("debug.ping") == 1)
  off()
  checar("unsubscribe", ev.listenerCount("debug.ping") == 0)
  local umaVez = 0
  ev.once("debug.once", function() umaVez = umaVez + 1 end)
  ev.emit("debug.once")
  ev.emit("debug.once")
  checar("events.once", umaVez == 1)
  assinar(ev.on("debug.ping", function(p) helix.log.info("Debug", "ping de " .. tostring(p.origem)) end))
  assinar(ev.on("debug.caixa", function(p) helix.log.debug("Debug", "caixa " .. tostring(p.nome)) end))
  local doAtor = 0
  assinar(ev.onEntity(estado.torus, "toque", function() doAtor = doAtor + 1 end))
  ev.emitEntity(estado.torus, "toque")
  checar("onEntity/emitEntity", doAtor == 1)
  assinar(helix.play.onStopped(function() helix.log.info("Debug", "play.onStopped disparou") end))
  assinar(helix.play.onPaused(function() helix.log.info("Debug", "pausado") end))
  assinar(helix.play.onResumed(function() helix.log.info("Debug", "retomado") end))
end

local function tempo()
  local tm = helix.time
  checar("time.now", tm.now >= 0 and tm.frame >= 0)
  checar("time.delta", tm.delta >= 0 and tm.fixedDelta > 0)
  local inicio = tm.now
  tm.wait(0.1)
  checar("time.wait", tm.now - inicio >= 0.09, string.format("%.3f", tm.now - inicio))
  local quadro = tm.frame
  tm.waitFrames(2)
  checar("time.waitFrames", tm.frame >= quadro + 2, tm.frame - quadro)
  assinar(tm.every(2, function() helix.gui.bind("atores", helix.scene.count()) end))
  local disparou = false
  tm.delay(0.2, function() disparou = true end)
  tm.wait(0.3)
  checar("time.delay", disparou)
end

local function dados()
  local st = helix.storage
  st.ready()
`;
}
