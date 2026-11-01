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
`;
}
