import type { GameSources } from '../types';
export function jsLikeGame(typed: boolean): GameSources {
    const t = (annotation: string): string => (typed ? annotation : '');
    const label = typed ? 'TypeScript' : 'JavaScript';
    const any = t(': any');
    const entry = `                                    
                                                                                    
                                                                                   
import helix from "helix"
import { soma, saudacao, limitar } from "DebugUtil"

const LINGUAGEM = "${label}"

const estado = {
  quadros: 0,
  passosFisica: 0,
  lateUpdates: 0,
  renders: 0,
  rendersHook: 0,
  colisoes: 0,
  checagens: 0,
  falhas: 0,
  pontos: 0,
  hudTimer: 0,
  torus: null${t(' as any')},
  heroi: null${t(' as any')},
  efeito: null${t(' as any')},
  tela: null${t(' as any')},
  assinaturas: []${t(' as Array<() => void>')},
}

function checar(nome${t(': string')}, condicao${t(': unknown')}, detalhe${t('?: unknown')}) {
  estado.checagens++
  if (condicao) return
  estado.falhas++
  helix.log.error("Debug", \`FALHOU \${nome}\${detalhe === undefined ? "" : \`: \${String(detalhe)}\`}\`)
}

// Uma área que trava (áudio sem gesto do usuário, rede, armazenamento) não pode segurar as demais: cada uma tem um prazo.
const PRAZO_AREA = 5

async function area(nome${t(': string')}, fn${t(': () => unknown')}) {
  let concluida = false
  const execucao = Promise.resolve().then(fn)
  execucao.catch(() => {})
  const prazo = helix.time.wait(PRAZO_AREA).then(() => {
    if (!concluida) throw new Error(\`excedeu \${PRAZO_AREA} s e foi abandonada\`)
  })
  try {
    await Promise.race([execucao, prazo])
    helix.log.debug("Debug", \`ok \${nome}\`)
  } catch (erro) {
    estado.falhas++
    helix.log.error("Debug", \`ERRO em \${nome}: \${erro instanceof Error ? erro.message : String(erro)}\`)
  } finally {
    concluida = true
  }
}

function aprox(a${t(': number')}, b${t(': number')}, epsilon = 0.001) {
  return Math.abs(a - b) <= epsilon
}

// 1. Núcleo ---------------------------------------------------------------------------------

function nucleo() {
  checar("engine.name", typeof helix.engine.name === "string" && helix.engine.name.length > 0)
  checar("engine.version", typeof helix.engine.version === "string")
  checar("context", ["shared", "client", "server"].includes(helix.context), helix.context)
  checar("isPlaying", helix.isPlaying === true)
  checar("isEditor", helix.isEditor === false)
  checar("editor ausente no jogo", helix.editor === undefined)
  checar("self no script de entrada", helix.self === null, helix.self && helix.self.name)
  checar("script handle", helix.script === null || helix.script.name === "DebugJogo", helix.script && helix.script.name)
  helix.log.info("Debug", \`\${helix.engine.name} \${helix.engine.version} · API \${helix.engine.apiVersion} · \${LINGUAGEM}\`)
}

function modulo() {
  checar("require soma", soma(2, 3) === 5, soma(2, 3))
  checar("require saudacao", saudacao("Helix") === "Olá, Helix", saudacao("Helix"))
  checar("require limitar", limitar(15, 0, 10) === 10)
}

function matematica() {
  const m = helix.math
  const v = m.vec3.add([1, 2, 3], [1, 1, 1])
  checar("vec3.add", m.vec3.equals(v, [2, 3, 4]), m.vec3.toArray(v))
  checar("vec3.length", aprox(m.vec3.length([3, 4, 0]), 5))
  checar("vec3.normalize", aprox(m.vec3.length(m.vec3.normalize([0, 5, 0])), 1))
  checar("vec3.cross", m.vec3.equals(m.vec3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]))
  checar("vec3.lerp", m.vec3.equals(m.vec3.lerp([0, 0, 0], [2, 2, 2], 0.5), [1, 1, 1]))
  const q = m.quat.fromEuler([0, 90, 0])
  const r = m.quat.rotateVec3(q, [1, 0, 0])
  checar("quat.rotateVec3", m.vec3.equals(r, [0, 0, -1], 0.001), m.vec3.toArray(r))
  checar("quat.toEuler", aprox(m.quat.toEuler(q)[1], 90, 0.01))
  const mat = m.mat4.fromTRS([1, 2, 3], [0, 0, 0], [1, 1, 1])
  checar("mat4.transformPoint", m.vec3.equals(m.mat4.transformPoint(mat, [0, 0, 0]), [1, 2, 3]))
  checar("mat4.invert", m.mat4.invert(mat) !== null)
  checar("mat4.decompose", m.vec3.equals(m.mat4.decompose(mat).translation, [1, 2, 3]))
  const caixa = m.aabb.fromCenterSize([0, 0, 0], [2, 2, 2])
  checar("aabb.contains", m.aabb.contains(caixa, [0.5, 0.5, 0.5]) && !m.aabb.contains(caixa, [2, 0, 0]))
  checar("aabb.size", m.vec3.equals(m.aabb.size(caixa), [2, 2, 2]))
  const raio = m.ray.create([0, 5, 0], [0, -1, 0])
  checar("ray.intersectAabb", m.ray.intersectAabb(raio, caixa) !== null)
  checar("ray.at", m.vec3.equals(m.ray.at(raio, 5), [0, 0, 0]))
  checar("scalar.remap", m.scalar.remap(5, 0, 10, 0, 100) === 50)
  checar("scalar.clamp/lerp", m.clamp(15, 0, 10) === 10 && m.lerp(0, 10, 0.5) === 5)
  checar("scalar.wrapAngle", aprox(m.scalar.wrapAngle(370), 10))
  checar("scalar.smoothstep", m.scalar.smoothstep(0, 1, 0.5) === 0.5)
  checar("degToRad", aprox(m.degToRad(180), Math.PI))
  const ruido = m.noise.perlin2(0.3, 0.7)
  checar("noise.perlin2", Number.isFinite(ruido) && ruido >= -1.01 && ruido <= 1.01, ruido)
  checar("noise.fbm", Number.isFinite(m.noise.fbm(1.5, 2.5, 0, 4)))
  checar("noise.worley2", Number.isFinite(m.noise.worley2(0.2, 0.4)))
  checar("color.hexToVec3", m.vec3.equals(m.color.hexToVec3("#ff0000"), [1, 0, 0], 0.01))
  checar("color.vec3ToHex", m.color.vec3ToHex([1, 1, 1]).toLowerCase() === "#ffffff", m.color.vec3ToHex([1, 1, 1]))
  checar("color.parse", m.color.parse("#00ff00")[1] > 0.99)
  checar("color.hsl", m.color.hsl(0, 1, 0.5)[0] > 0.99)
  checar("color.temperatureToColor", m.color.temperatureToColor(6500).length === 3)
  m.random.seed(42)
  const a = m.random.value()
  m.random.seed(42)
  checar("random.seed determinístico", m.random.value() === a)
  checar("random.int", Number.isInteger(m.random.int(1, 6)))
  checar("random.pick", ["a", "b"].includes(m.random.pick(["a", "b"])${t(' as string')}))
  checar("random.shuffle", m.random.shuffle([1, 2, 3]).length === 3)
  checar("random.unitVector", aprox(m.vec3.length(m.random.unitVector()), 1))
  checar("random.create", typeof m.random.create("debug").range(0, 1) === "number")
  checar("PI/TAU", m.TAU === m.PI * 2)
}

// 2. Cena, transformações e malhas ---------------------------------------------------------------

function cena() {
  const s = helix.scene
  checar("scene.root", s.root !== null && Array.isArray(s.root.children))
  const antes = s.count()
  const grupo = s.spawn("group", { name: "DebugCenario" })
  const chao = s.spawn("mesh", {
    name: "Chao",
    mesh: helix.mesh.plane(40, 40),
    material: helix.material.create({ baseColor: "#4b6b3a", roughness: 0.95 }),
    rigidBody: { type: "static", collider: "box", boxSize: [40, 0.2, 40], center: [0, -0.1, 0] },
    receiveShadows: true,
    tags: ["chao"],
  }, grupo)
  checar("spawn mesh", chao.kind === "mesh" && chao.mesh !== null && chao.rigidBody !== null)
  checar("find", s.find("Chao") === chao)
  checar("findAll", s.findAll("Chao").length === 1)
  checar("byId", s.byId(chao.id) === chao)
  checar("byTag", s.byTag("chao").includes(chao))
  checar("byKind", s.byKind("mesh").includes(chao))
  checar("count", s.count() === antes + 2, \`\${s.count()} vs \${antes + 2}\`)
  checar("contains", s.contains(grupo, chao) && s.contains(s.root, chao))
  checar("path", s.path(chao).includes("Chao"), s.path(chao))
  checar("all", s.all().includes(chao))
  let visitados = 0
  s.traverse(() => visitados++, grupo)
  checar("traverse", visitados >= 2, visitados)

  const torus = s.spawnPrimitive("torus", { name: "Anel", position: [-4, 1.2, -2], scale: 1.5 }, grupo)
  helix.material.setColor(torus, "#3a86ff")
  helix.material.setEmissive(torus, "#3a86ff", 0.6)
  estado.torus = torus
  checar("spawnPrimitive", torus.mesh !== null && torus.material !== null)

  const copia = s.clone(torus, true, grupo)
  s.rename(copia, "AnelCopia")
  helix.transform.setPosition(copia, [-4, 1.2, 2])
  checar("clone + rename", copia.name === "AnelCopia" && s.find("AnelCopia") === copia)
  s.setMeta(copia, "origem", "clone")
  checar("meta", s.getMeta(copia, "origem") === "clone")
  s.addTag(copia, "temporario")
  checar("addTag/hasTag", s.hasTag(copia, "temporario"))
  checar("removeTag", s.removeTag(copia, "temporario") === true && !s.hasTag(copia, "temporario"))
  s.setVisible(copia, false)
  checar("setVisible", copia.visible === false)
  s.setVisible(copia, true)
  s.destroy(copia)
  checar("destroy", s.find("AnelCopia") === null && !s.isAttached(copia))

  const esfera = s.spawnPrimitive("sphere", { name: "Esfera", position: [4, 0.5, -3] })
  s.reparent(esfera, grupo)
  checar("reparent", esfera.parent === grupo)
  helix.material.setColor(esfera, "#ffbe0b")
  s.addComponent(esfera, "rigidBody", { type: "dynamic", collider: "sphere", radius: 0.5, mass: 1 })
  checar("addComponent", esfera.rigidBody !== null && esfera.rigidBody.type === "dynamic")
  const temporario = s.spawnPrimitive("box", { name: "Temporario" })
  s.addComponent(temporario, "csg", {})
  checar("addComponent csg", temporario.csg !== null)
  s.removeComponent(temporario, "csg")
  checar("removeComponent", temporario.csg === null)
  s.destroy(temporario)
  checar("kinds/components", s.kinds().includes("mesh") && s.components().includes("rigidBody"))
  checar("sun", s.sun === null || s.sun.light !== null)
}

function transformacao() {
  const t = helix.transform
  const m = helix.math
  const alvo = helix.scene.spawnPrimitive("cone", { name: "Cone", position: [0, 0.5, -6] })
  helix.material.setColor(alvo, "#8338ec")
  t.setPosition(alvo, [2, 0.5, -6])
  checar("setPosition/position", m.vec3.equals(t.position(alvo), [2, 0.5, -6]))
  t.translate(alvo, [0, 1, 0], "world")
  checar("translate", aprox(t.position(alvo)[1], 1.5))
  t.setRotation(alvo, [0, 90, 0])
  checar("setRotation", aprox(t.rotation(alvo)[1], 90))
  t.rotate(alvo, [0, 45, 0])
  checar("rotate", aprox(m.scalar.wrapAngle(t.rotation(alvo)[1]), 135, 0.01) || aprox(t.rotation(alvo)[1], 135, 0.01), t.rotation(alvo)[1])
  t.setScale(alvo, 2)
  checar("setScale", t.scale(alvo)[0] === 2)
  t.setScale(alvo, [1, 1, 1])
  checar("worldPosition", m.vec3.equals(t.worldPosition(alvo), t.position(alvo), 0.001))
  checar("worldRotation", t.worldRotation(alvo).length === 4)
  checar("forward unitário", aprox(m.vec3.length(t.forward(alvo)), 1))
  checar("up", m.vec3.equals(t.up(alvo), [0, 1, 0], 0.001))
  t.lookAt(alvo, [0, 1.5, 0])
  checar("distance", aprox(t.distance(alvo, [2, 1.5, -6]), 0, 0.01))
  checar("directionTo", aprox(m.vec3.length(t.directionTo(alvo, [0, 1.5, 0])), 1, 0.01))
  const limites = t.bounds(alvo)
  checar("bounds", limites.max[1] > limites.min[1])
  const local = t.worldToLocal(alvo, t.localToWorld(alvo, [1, 0, 0]))
  checar("localToWorld/worldToLocal", m.vec3.equals(local, [1, 0, 0], 0.001))
  checar("worldMatrix", t.worldMatrix(alvo).length === 16 && t.localMatrix(alvo).length === 16)
  const pai = helix.scene.spawn("group", { name: "PaiDoCone", position: [0, 0, -6] })
  t.setParentKeepWorld(alvo, pai)
  checar("setParentKeepWorld", alvo.parent === pai && m.vec3.equals(t.worldPosition(alvo), [2, 1.5, -6], 0.01))
  t.rotateAround(alvo, [0, 1.5, -6], [0, 1, 0], 90)
  checar("rotateAround", aprox(t.distance(alvo, [0, 1.5, -6]), 2, 0.01))
}

function malhas() {
  const m = helix.mesh
  const caixa = m.box(1, 1, 1)
  checar("mesh.box", m.vertexCount(caixa) > 0 && m.triangleCount(caixa) === 12, m.triangleCount(caixa))
  const esfera = m.sphere(0.65, 16, 12)
  const furado = helix.csg.boolean(caixa, esfera, "subtract")
  checar("csg.boolean", m.triangleCount(furado) > 12)
  const ator = helix.scene.spawn("mesh", { name: "CaixaFurada", mesh: furado, material: helix.material.create({ baseColor: "#e63946", roughness: 0.4, metallic: 0.2 }), position: [4, 0.5, 2] })
  checar("spawn malha CSG", ator.mesh === furado)
  checar("csg.operations", helix.csg.operations().includes("union"))

  const tri = m.create({ name: "Triangulo", positions: [-1, 0, 0, 1, 0, 0, 0, 1.5, 0], uvs: [0, 0, 1, 0, 0.5, 1], indices: [0, 1, 2] })
  m.computeNormals(tri)
  checar("mesh.create + computeBounds", m.computeBounds(tri).max[1] >= 1.5)
  const dupla = m.merge(tri, m.flipWinding(m.clone(tri)))
  checar("mesh.merge", m.triangleCount(dupla) === 2)
  helix.scene.spawn("mesh", { name: "Triangulo", mesh: dupla, material: helix.material.create({ baseColor: "#06d6a0", doubleSided: true }), position: [7, 0, -2] })
  const grande = m.scale(m.translate(m.clone(caixa), [0, 0.5, 0]), 2)
  checar("mesh.translate/scale", m.computeBounds(grande).max[1] > 1.9)
  const dist = m.raycast(helix.math.ray.create([0, 5, 0], [0, -1, 0]), grande)
  checar("mesh.raycast", dist !== null && dist > 0, dist)
  let n = 0
  m.forEachVertex(caixa, () => n++)
  checar("forEachVertex", n === m.vertexCount(caixa))
  checar("positions/indices", m.positions(caixa).length === m.vertexCount(caixa) * 3 && m.indices(caixa).length === 36)
  const versao = m.version(caixa)
  m.positions(caixa)[1] += 0.01
  m.markDirty(caixa)
  checar("markDirty/version", m.version(caixa) > versao)
  const densa = m.sphere(1, 32, 16)
  checar("mesh.simplify", m.triangleCount(m.simplify(densa, 0.5)) < m.triangleCount(densa))
  const lod = m.lod(ator, { enabled: true, bias: 1 })
  checar("mesh.lod", lod === null || lod.enabled === true)
  checar("mesh.myriad", typeof m.myriad(ator) === "boolean")
  checar("primitivas extras", m.triangleCount(m.torusKnot()) > 0 && m.triangleCount(m.rock()) > 0 && m.triangleCount(m.capsule()) > 0)
  const mat = helix.math.mat4.fromTRS([0, 2, 0], [0, 45, 0], [1, 1, 1])
  checar("mesh.transform", m.computeBounds(m.transform(m.clone(caixa), mat)).min[1] > 1.4)
}

// 3. Materiais, texturas, luzes, céu, câmera e pós ------------------------------------------------

function materiais() {
  const mat = helix.material
  const base = mat.create({ name: "DebugBase", baseColor: "#d98c2b", roughness: 0.5, metallic: 0.1 })
  checar("material.create", base.roughness === 0.5)
  const copia = mat.clone(base)
  mat.set(copia, { roughness: 1, emissive: "#ffffff", emissiveIntensity: 2 })
  checar("material.clone/set", copia.roughness === 1 && base.roughness === 0.5)
  mat.copy(copia, base)
  checar("material.copy", copia.roughness === 0.5)
  const caixa = helix.scene.spawnPrimitive("box", { name: "CaixaPintada", position: [-7, 0.5, 2] })
  mat.assign(caixa, base)
  checar("material.assign/of", mat.of(caixa) === base)
  const propria = mat.own(caixa)
  checar("material.own", mat.of(caixa) === propria)
  const tela = helix.texture.canvas(64, 64)
  const ctx = tela.context
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#1d3557" : "#f1faee"
      ctx.fillRect(x * 8, y * 8, 8, 8)
    }
  }
  tela.update()
  mat.setTexture(caixa, "baseColorMap", tela.texture)
  checar("texture.canvas + setTexture", mat.hasAnyTexture(propria) && helix.texture.isTexture(tela.texture))
  const pixels = new Uint8Array(4 * 4 * 4).fill(255)
  const textura = helix.texture.fromPixels(4, 4, pixels)
  checar("texture.fromPixels", textura.width === 4 && textura.height === 4)
  helix.texture.touch(textura)
  checar("texture.create", helix.texture.create({ width: 2, height: 2 }).width === 2)
  checar("material.slots", mat.slots().some((slot) => slot.slot === "normalMap"))
  checar("materials.list/names", Array.isArray(helix.materials.list()) && Array.isArray(helix.materials.names()))
  const sombreado = mat.fromShader("DebugSuperficie", { glow: [1, 0.45, 0.1], speed: 2 })
  checar("material.fromShader", sombreado !== null && typeof sombreado.uniforms.set === "function")
  const esfera = helix.scene.spawnPrimitive("sphere", { name: "EsferaShader", position: [0, 1, -3], scale: 1.4 })
  mat.assign(esfera, sombreado)
  mat.uniforms(esfera).set("speed", 3)
  const lista = mat.uniforms(esfera).list()
  checar("material.uniforms.list", Array.isArray(lista) && lista.some((u) => u.name === "glow"), lista.map((u) => u.name).join(","))
}

function luzes() {
  const l = helix.light
  checar("light.types", l.types().includes("point") && l.localTypes().includes("spot"))
  const lampada = l.spawn("point", { name: "Lampada", position: [0, 3, 0], color: "#ffd166", intensity: 60, range: 14 })
  checar("light.spawn", lampada.light !== null && lampada.light.type === "point")
  l.set(lampada, { intensity: 80 })
  checar("light.set", lampada.light${t('!')}.intensity === 80)
  l.setTemperature(lampada, 3200)
  checar("setTemperature", (lampada.light${t(' as any')}).temperature === 3200)
  checar("resolvedColor", helix.math.vec3.length(l.resolvedColor(lampada)) > 0)
  const foco = l.spawn("spot", { name: "Holofote", position: [4, 4, 0], rotation: [-90, 0, 0], intensity: 120, range: 16, innerAngle: 20, outerAngle: 35, color: "#ffffff" })
  checar("spot", foco.light${t('!')}.type === "spot")
  const convertido = l.convert(foco, "disc")
  checar("light.convert", convertido.type === "disc" && foco.light${t('!')}.type === "disc")
  l.convert(foco, "spot")
  const presets = l.presets()
  checar("light.presets", presets.length > 0)
  if (presets.length > 0) {
    const preset = l.spawn(presets[0].id, { name: "LuzPreset", position: [-4, 2.5, 4] })
    checar("light.fromPreset", preset.light !== null && l.fromPreset(presets[0].id).type === presets[0].type)
  }
  const criada = l.create("point", { intensity: 5 })
  checar("light.create/clone", criada.type === "point" && l.clone(criada).type === "point")
  checar("light.all", l.all({ local: true }).length >= 2)
  checar("light.sun", l.sun() === helix.scene.sun)
  checar("effectiveRange", l.effectiveRange(lampada) > 0)
  checar("light.temperatureToColor", l.temperatureToColor(6500).length === 3)
  checar("cssColor", typeof l.cssColor(lampada) === "string")
  checar("light.isLocal", l.isLocal(lampada))
  checar("temperatureRange", l.temperatureRange.min < l.temperatureRange.max)
  l.setColor(lampada, "#ffffff")
  const luz = lampada.light${t('!')}
  checar("light.setColor", luz.type !== "ambient" && helix.math.vec3.equals(luz.color, [1, 1, 1], 0.01))
}

function ceu() {
  const sky = helix.sky
  sky.set({ timeOfDay: 10.5, haze: 0.3, clouds: { enabled: true, coverage: 0.45 } })
  checar("sky.set", aprox(sky.timeOfDay, 10.5) && sky.clouds.enabled === true)
  checar("sky.isDay", sky.isDay === true)
  checar("sky.sunDirection", sky.sunDirection()[1] > 0)
  checar("sky.moonDirection", sky.moonDirection().length === 3)
  checar("sky.formatTimeOfDay", /\\d{1,2}:\\d{2}/.test(sky.formatTimeOfDay(10.5)), sky.formatTimeOfDay(10.5))
  checar("sky.wrapTimeOfDay", sky.wrapTimeOfDay(25) === 1)
  checar("sky.presets", sky.presets().some((p) => p.id === "dusk"))
  checar("sky.moonPhaseName", typeof sky.moonPhaseName() === "string")
  checar("sky.hourAngle", typeof sky.hourAngle() === "number")
  estado.assinaturas.push(sky.onHourChanged((h) => helix.log.info("Debug", \`Hora do céu: \${h}\`)))
  estado.assinaturas.push(sky.onSunset(() => helix.log.info("Debug", "Pôr do sol")))
  sky.cycleSpeed = 0
  checar("sky.cycleSpeed", sky.cycleSpeed === 0)
  checar("world.gravity", helix.world.gravity[1] < 0)
  checar("world.wind", typeof helix.world.wind.speed === "number")
  helix.world.wind.set({ speed: 2, direction: 45 })
  checar("world.wind.set", helix.world.wind.speed === 2)
  checar("world.sky", helix.world.sky === sky.settings)
  checar("world.player", helix.world.player.camera !== undefined)
}

function camera() {
  const c = helix.camera
  checar("camera.fov", c.fov > 0 && c.aspect > 0)
  checar("camera.near/far", c.near > 0 && c.far > c.near)
  checar("viewport", c.viewport.width > 0)
  const tela = c.worldToScreen([0, 0, 0])
  checar("worldToScreen", tela === null || typeof tela.x === "number")
  const raio = c.screenToRay(c.viewport.width / 2, c.viewport.height / 2)
  checar("screenToRay", raio === null || aprox(helix.math.vec3.length(raio.direction), 1, 0.01))
  checar("viewMatrix", c.viewMatrix.length === 16 && c.projectionMatrix.length === 16 && c.viewProjectionMatrix.length === 16)
  checar("camera.main inicial", c.main === null)
  checar("player.settings", c.player.settings.distance > 0)
  c.player.set({ distance: 7, pitch: 18 })
  checar("player.set", c.player.settings.distance === 7)
  checar("distanceTo", c.distanceTo([0, 0, 0]) >= 0)
  checar("mainForward", helix.math.vec3.length(c.mainForward()) > 0.99)
  checar("camera.position", c.position.length === 3 && c.target.length === 3 && c.forward.length === 3)
  estado.assinaturas.push(c.onMainChanged((e) => helix.log.info("Debug", \`Câmera principal: \${e ? e.name : "editor/jogador"}\`)))
}

function pos() {
  const p = helix.post
  checar("post.toneMappers", p.toneMappers().includes("aces"))
  p.set({
    bloom: { enabled: true, intensity: 0.5, threshold: 1, softKnee: 0.5, radius: 0.6 },
    vignette: { enabled: true, intensity: 0.35, smoothness: 0.5, roundness: 1 },
  })
  checar("post.set", p.bloom.enabled === true && p.vignette.enabled === true)
  p.exposure = 1.05
  checar("post.exposure", p.exposure === 1.05)
  p.toneMapper = "agx"
  checar("post.toneMapper", p.toneMapper === "agx")
  checar("post.presets", p.presets().length > 0)
  checar("post.snapshot", p.snapshot().bloom.intensity === p.bloom.intensity)
  checar("post.create", p.create().bloom !== undefined)
  const efeito = p.custom.add({ fragment: "DebugPost", name: "DebugPost", uniforms: { tint: [0.15, 0.05, 0.3], strength: 0.6 } })
  estado.efeito = efeito
  checar("post.custom.add", p.custom.get("DebugPost") === efeito && p.custom.list().some((e) => e.name === "DebugPost"))
  efeito.uniforms.set("strength", 0.8)
  const u = efeito.uniforms.list()
  checar("efeito.uniforms.list", u.some((x) => x.name === "tint") && u.some((x) => x.name === "strength"), u.map((x) => x.name).join(","))
  void p.tween("bloom.intensity", 0.9, 1.5, "easeInOut")
}

function render() {
  const r = helix.render
  checar("render.passNames", r.passNames().includes("mesh"))
  checar("render.passes", typeof r.passes.mesh.enabled === "boolean")
  checar("render.stats", typeof r.stats.drawCalls === "number")
  checar("render.profile", typeof r.profile.shadowMapSize === "number")
  checar("render.gl", r.gl !== null && typeof r.gl.drawArrays === "function")
  estado.assinaturas.push(r.onAfterFrame(() => { estado.renders++ }))
  estado.assinaturas.push(r.onBeforePass("post", () => {}))
  checar("render.frame", typeof r.frame.width === "number")
  r.showGrid = false
  checar("render.showGrid", r.showGrid === false)
  checar("render.culling", typeof r.culling.frustumCulling === "boolean")
  checar("render.capabilities", typeof r.capabilities === "object")
  checar("render.pixelRatio", r.pixelRatio > 0)
  checar("render.custom.list", Array.isArray(r.custom.list()))
  const programa = r.createProgram("#version 300 es\\nvoid main(){gl_Position=vec4(0.0);}", "#version 300 es\\nprecision mediump float;out vec4 o;void main(){o=vec4(1.0);}")
  checar("render.createProgram", programa !== null && typeof programa.use === "function")
  programa.dispose()
}

// 4. Física, personagem, terreno --------------------------------------------------------------

function fisica() {
  const ph = helix.physics
  checar("physics.enabled", ph.enabled === true)
  checar("physics.gravity", ph.gravity[1] < 0)
  checar("physics.settings", ph.settings.fixedTimestep > 0 && ph.fixedTimestep === ph.settings.fixedTimestep)
  for (let i = 0; i < 5; i++) {
    const caixa = helix.scene.spawnPrimitive("box", { name: \`Caixa\${i + 1}\`, position: [-2 + i * 1.1, 3 + i * 1.2, 3], rigidBody: { type: "dynamic", collider: "box", mass: 2, restitution: 0.3 }, tags: ["caixa"] })
    helix.material.setColor(caixa, helix.math.color.hsl(30 + i * 12, 0.7, 0.5))
  }
  const caixas = helix.scene.byTag("caixa")
  checar("caixas dinâmicas", caixas.length === 5 && ph.hasBody(caixas[0]))
  const corpo = ph.bodyOf(caixas[0])
  checar("bodyOf", corpo.isDynamic && corpo.mass > 0)
  corpo.applyImpulse([0, 2, 0])
  corpo.applyTorque([0, 1, 0])
  corpo.setMaterial({ friction: 0.8 })
  corpo.lockRotation(false, false, false)
  corpo.wake()
  checar("body.entity", corpo.entity === caixas[0] && ph.entityOf(corpo) === caixas[0])
  checar("body.linearVelocity", corpo.linearVelocity.length === 3)
  checar("bodies()", ph.bodies().length >= 6 && ph.bodyCount >= 6)
  const hit = ph.raycast([0, 5, 0], [0, -1, 0], 20)
  checar("physics.raycast", hit !== null && hit.entity !== null, hit && hit.entity && hit.entity.name)
  checar("raycastAll", ph.raycastAll([0, 5, 0], [0, -1, 0], 20).length >= 1)
  checar("overlapSphere", Array.isArray(ph.overlapSphere([0, 3, 3], 4)))
  checar("overlapBox", Array.isArray(ph.overlapBox([0, 3, 3], [3, 3, 3])))
  checar("overlapAabb", Array.isArray(ph.overlapAabb({ min: [-5, 0, 0], max: [5, 8, 6] })))
  checar("massProperties", ph.massProperties(caixas[0]).mass > 0)
  checar("colliderRequiresStatic", ph.colliderRequiresStatic("mesh") === true)
  checar("colliderVolume", ph.colliderVolume(caixas[0]) > 0)
  const presets = ph.physical.presets()
  checar("physical.presets", presets.length > 0)
  if (presets.length > 0) checar("physical.apply", ph.physical.apply(caixas[1], presets[0].id).type !== undefined)
  checar("physical.create/match", typeof ph.physical.match(ph.physical.create()) !== "undefined")
  checar("shapes.sphere volume", aprox(ph.shapes.volume(ph.shapes.sphere(1)), 4.18879, 0.01))
  checar("shapes.aabb", ph.shapes.aabb(ph.shapes.box(1, 1, 1), [0, 0, 0]).max[0] === 1)
  checar("fitCollider", ph.fitCollider(caixas[0]).collider !== undefined)
  checar("closestPoint", ph.closestPoint([0, 10, 3], caixas[0]).length === 3)
  estado.assinaturas.push(ph.onCollisionBegin((e) => {
    estado.colisoes++
    if (estado.colisoes <= 3) helix.log.info("Debug", \`Colisão: \${e.a.name} × \${e.b.name} (impulso \${e.contact.impulse.toFixed(2)})\`)
  }))
  estado.assinaturas.push(ph.onCollisionEnd(() => {}))
  estado.assinaturas.push(ph.onOutOfBounds((e) => helix.log.warn("Debug", \`\${e.name} caiu do mundo\`)))
  estado.assinaturas.push(ph.onPreStep(() => {}))
  const gatilho = helix.scene.spawn("group", { name: "Gatilho", position: [0, 1, 3], trigger: { shape: "box", size: [3, 2, 3] } })
  checar("trigger spawn", gatilho !== null && helix.scene.isAttached(gatilho))
  checar("physics.stats", typeof ph.stats.bodies === "number")
  const agua = ph.waterAt([0, 0, 0])
  checar("waterAt", agua === null || typeof agua.height === "number")
  ph.layers.define(["padrao", "fantasma"])
  ph.layers.setCollision("padrao", "fantasma", false)
  checar("physics.quality", ph.quality === null || ["low", "medium", "high"].includes(ph.quality))
}

function personagem() {
  const heroi = helix.character.spawn({ name: "Heroi", position: [0, 1.2, 8], character: { walkSpeed: 4, runSpeed: 7, jumpHeight: 1.4 } })
  estado.heroi = heroi
  checar("character.spawn", heroi.character !== null && helix.character.has(heroi))
  const h = helix.character.of(heroi)
  checar("character.of", h.entity === heroi && typeof h.isGrounded === "boolean")
  checar("settingsOf", helix.character.settingsOf(heroi)${t('!')}.walkSpeed === 4)
  helix.player.possess(heroi)
  checar("player.possess", helix.player.possessed === heroi && helix.player.isPossessing)
  checar("findPossessable", helix.character.findPossessable() !== null)
  estado.assinaturas.push(helix.character.onJumped((e) => helix.log.info("Debug", \`\${e.entity.name} pulou\`)))
  estado.assinaturas.push(helix.character.onLanded((e) => { if (e.speed > 6) helix.log.info("Debug", \`\${e.entity.name} aterrissou a \${e.speed.toFixed(1)} m/s\`) }))
  estado.assinaturas.push(helix.player.onPossessed((e) => helix.log.info("Debug", \`Possuindo \${e ? e.name : "ninguém"}\`)))
  checar("character.all", helix.character.all().length >= 1)
  checar("player.spawnPoint", helix.player.spawnPoint.length === 3)
  checar("character.inputSource", helix.character.inputSource === "engine")
  checar("player.cameraControl", helix.player.cameraControl === "engine")
  checar("player.settings", helix.player.settings.character.walkSpeed > 0)
  checar("character.velocity", h.velocity.length === 3 && h.position.length === 3)
}

function terreno() {
  const t = helix.terrain
  checar("terrain.presets", t.presets().some((p) => p.value === "hills"))
  checar("terrain.resolutions", t.resolutions().includes(65))
  const colinas = t.spawn({ name: "Colinas", size: 48, resolution: 65, preset: "hills", seed: 7, position: [0, -6, -70] })
  checar("terrain.spawn", colinas.terrain !== null && t.all().includes(colinas))
  const dados = t.of(colinas)
  checar("terrain.of", dados.resolution === 65 && dados.heightfield.heights.length === 65 * 65)
  const altura = t.heightAt([0, 0, -70], colinas)
  checar("heightAt", altura !== null && Number.isFinite(altura), altura)
  checar("normalAt", t.normalAt([0, 0, -70], colinas) !== null)
  checar("contains", t.contains([0, 0, -70], colinas) && !t.contains([500, 0, 0], colinas))
  t.sculpt(colinas, "raise", [5, 0, -70], { radius: 6, strength: 1 }, 1)
  t.markDirty(colinas)
  const grade = t.worldToGrid([0, 0, -70], colinas)
  checar("worldToGrid/gridToWorld", grade !== null && t.gridToWorld(grade.gx, grade.gz, colinas).length === 3)
  checar("terrain.layers", Array.isArray(t.layers(colinas)))
  const catalogo = t.materials.catalog()
  checar("materials.catalog", catalogo.length > 0)
  if (catalogo.length > 0 && t.layers(colinas).length < 2) checar("addLayer", t.addLayer(colinas, catalogo[0].id) !== null)
  t.autoPaint(colinas)
  checar("weightsAt", t.weightsAt([0, 0, -70], colinas) === null || Array.isArray(t.weightsAt([0, 0, -70], colinas)))
  t.grass.set(colinas, { enabled: true, density: 0.5 })
  checar("grass.set", t.grass.settingsOf(colinas).enabled === true)
  t.water.set(colinas, { enabled: true, level: -2 })
  checar("water.set", t.water.settingsOf(colinas).enabled === true)
  checar("water.isUnderwater", typeof t.water.isUnderwater([0, -100, -70], colinas) === "boolean")
  checar("water.sampleSurface", typeof t.water.sampleSurface(colinas, 0, -70).height === "number")
  checar("terrain.brush", t.brush({ radius: 3 }).radius === 3)
  checar("terrain.tools/falloffs", t.tools().includes("smooth") && t.falloffs().includes("linear"))
  checar("terrain.first", t.first() !== null)
  checar("terrain.raycast", t.raycast([0, 50, -70], [0, -1, 0], colinas) !== null)
  checar("terrain.shadingOf", typeof t.shadingOf(colinas) === "object")
}

// 5. Interface, áudio, animação, VFX -----------------------------------------------------------

async function interfaceGrafica() {
  const g = helix.gui
  g.css("DebugEstilo")
  const hud = g.html("DebugHud", { id: "debug-hud" })
  checar("gui.html", hud !== null && g.element("#debug-hud") !== null)
  const icone = g.svg("DebugIcone", { id: "debug-icone" })
  checar("gui.svg", icone !== null && icone.tagName.toLowerCase() === "svg")
  const slot = g.element("[data-slot=icone]")
  if (slot) slot.appendChild(icone)
  checar("gui.bind", g.bind("linguagem", LINGUAGEM) >= 1)
  g.bind("titulo", "Helix · Debug")
  estado.assinaturas.push(g.onAction("caixa", () => soltarCaixa()))
  estado.assinaturas.push(g.onAction("reiniciar", () => helix.play.restart()))
  checar("gui.elements", g.elements("[data-bind]").length >= 5)
  checar("gui.size", g.size.width > 0)
  checar("gui.canvas2d", typeof g.canvas2d.fillRect === "function")
  checar("gui.domRoot", g.domRoot !== null)
  checar("gui.pointerEvents", g.pointerEvents === false)

  const tela = g.create("DebugTela", { referenceSize: { x: 1280, y: 720 } })
  const painel = g.add(tela, "frame", { name: "Painel", rect: { position: { x: { scale: 1, offset: -236 }, y: { scale: 0, offset: 16 } }, size: { x: { scale: 0, offset: 220 }, y: { scale: 0, offset: 48 } } } })
  g.add(tela, "text", { name: "Rotulo", text: "Tela declarativa OK" }, painel.node.id)
  checar("gui.add/find", g.find(tela, "Rotulo").kind === "text")
  g.setText(tela, "Rotulo", "Tela declarativa OK · " + LINGUAGEM)
  g.setVisible(tela, "Rotulo", true)
  g.setInteractable(tela, "Painel", false)
  estado.tela = await g.show(tela, "debug-tela")
  checar("gui.show/isShown", g.isShown(estado.tela) && g.screens().some((s) => s.name === "DebugTela"))
  checar("gui.documents", g.documents().length >= 1)
  checar("gui.kinds", g.kinds().includes("button"))
  estado.assinaturas.push(g.onEvent((e) => helix.log.debug("Debug", \`GUI \${e.type} em \${e.nodeName}\`)))
  checar("gui.surfaces", typeof g.surfaces.settingsOf === "function")
}

async function audio() {
  const a = helix.audio
  checar("audio.supported", typeof a.supported === "boolean")
  checar("mixer.buses", a.mixer.buses().includes("sfx"))
  a.mixer.setVolumeDb("sfx", -3)
  checar("mixer.setVolumeDb", a.mixer.bus("sfx").volumeDb === -3)
  checar("mixer.range", a.mixer.range.minDb < a.mixer.range.maxDb)
  checar("createClipSettings", a.createClipSettings().bus !== undefined)
  const clips = a.clips()
  checar("audio.clips", Array.isArray(clips))
  if (clips.length > 0 && a.supported) {
    const voz = await a.playOnce(clips[0], { volumeDb: -6 })
    checar("audio.playOnce", voz.asset.id === clips[0].id)
    checar("clipSettingsOf", a.clipSettingsOf(clips[0]).bus !== undefined)
  } else {
    helix.log.info("Debug", "Sem ativos de áudio na biblioteca: a reprodução não foi testada (importe um .mp3/.ogg para cobrir).")
  }
  const fonte = helix.scene.spawn("sound", { name: "FonteSonora", position: [3, 1, 3], audioSource: { assetId: clips.length ? clips[0].id : null, trigger: "manual", spatial: true } })
  checar("spawn sound", fonte.audioSource !== null && a.sources.settingsOf(fonte) !== null)
  a.sources.set(fonte, { volumeDb: -4 })
  checar("sources.set", fonte.audioSource${t('!')}.volumeDb === -4)
  checar("sources.all", a.sources.all().includes(fonte))
  checar("sources.isPlaying", a.sources.isPlaying(fonte) === false)
  const zona = helix.scene.spawn("group", { name: "ZonaSonora", position: [0, 0, 0], audioZone: { shape: "sphere", radius: 10 } })
  checar("zones.settingsOf", a.zones.settingsOf(zona).radius === 10 && a.zones.all().includes(zona))
  estado.assinaturas.push(a.onEnded(() => helix.log.debug("Debug", "áudio terminou")))
  checar("audio.status", ["idle", "unavailable", "suspended", "running", "closed"].includes(a.status), a.status)
  checar("audio.stats", typeof a.stats === "object" && typeof a.voiceCount === "number")
}

function animacao() {
  const an = helix.animation
  checar("animation.roles", an.roles().includes("hips"))
  checar("animation.paths", an.paths().includes("rotation"))
  let doc = an.create("DebugClipe", { duration: 2, loop: true })
  doc = an.setKey(doc, "hips", "rotation", 0, [0, 0, 0, 1])
  doc = an.setKey(doc, "hips", "rotation", 1, helix.math.quat.fromEuler([0, 90, 0]))
  doc = an.addEvent(doc, 0.5, "passo")
  doc = an.setDuration(doc, 2.5)
  checar("animation.create/setKey/addEvent", doc.tracks.length === 1 && doc.events.length === 1 && doc.duration === 2.5)
  checar("animation.rigged", Array.isArray(an.rigged()))
  checar("ik.limbs", an.ik.limbs().includes("leftArm"))
  const rigados = an.rigged()
  if (rigados.length > 0) {
    const p = an.player(rigados[0])
    checar("animation.player", p.entity === rigados[0] && an.hasPlayer(rigados[0]))
    checar("animation.rig", an.rig(rigados[0]).jointCount > 0)
  } else {
    helix.log.info("Debug", "Sem personagens com esqueleto na cena: a reprodução de clipes não foi testada (importe um .glb animado para cobrir).")
  }
  checar("animation.playing", typeof an.playing === "number")
}

async function vfx() {
  const v = helix.vfx
  checar("vfx.templates", v.templates.ids().length > 0 && v.templates.list().length > 0)
  checar("vfx.moduleKinds", v.moduleKinds().includes("gravity") && v.modules().length > 0)
  checar("vfx.shapes/renderModes/blendModes", v.shapes().length > 0 && v.renderModes().length > 0 && v.blendModes().length > 0)
  const id = v.templates.ids()[0]
  let doc = v.fromTemplate(id, "DebugFaiscas")
  doc = v.addEmitter(doc, { name: "Extra", maxParticles: 50 })
  const extra = doc.emitters[doc.emitters.length - 1]
  doc = v.addModule(doc, extra.id, "gravity", {})
  doc = v.setEmitter(doc, extra.id, { loop: true })
  doc = v.set(doc, { loop: true })
  checar("vfx.fromTemplate/addEmitter/addModule", doc.emitters.length >= 2 && doc.loop === true)
  const json = v.toJson(doc)
  checar("vfx.toJson/fromJson", v.fromJson(json).emitters.length === doc.emitters.length)
  checar("vfx.textures", v.textures.list().length > 0)
  const ativo = await v.save(doc, "DebugFaiscas")
  checar("vfx.save", ativo.kind === "vfx")
  const ator = v.emitAt(ativo, [0, 1.5, -8], { destroyWhenFinished: false })
  checar("vfx.emitAt", v.has(ator) && typeof v.state(ator) === "string")
  v.burst(ator, 20)
  checar("vfx.alive/time", typeof v.alive(ator) === "number" && typeof v.time(ator) === "number")
  const outro = helix.scene.spawn("vfx", { name: "VfxAtor", position: [-6, 1, -8], vfx: { assetId: ativo.id, autoPlay: true } })
  checar("spawn vfx", v.has(outro) && v.settings(outro).assetId === ativo.id)
  checar("vfx.document", (await v.document(ativo)).emitters.length >= 2)
  checar("vfx.stats", typeof v.stats().effects === "number")
}

// 6. Entrada, eventos, tempo, dados, projeto, salvamentos ----------------------------------------

function entrada() {
  const i = helix.input
  i.actions.define("pular", ["Space", "Gamepad:0"])
  i.actions.define("soltar", ["KeyB"])
  checar("actions.define/bindings", i.actions.bindings("pular").includes("Space") && i.actions.names().includes("soltar"))
  checar("action()", i.action("pular").name === "pular" && typeof i.actions.down("pular") === "boolean")
  checar("isDown", i.isDown("KeyW") === false)
  checar("pointer", typeof i.pointer.x === "number")
  checar("cursors", i.cursors().includes("crosshair"))
  checar("gamepads", Array.isArray(i.gamepads()))
  checar("axis2d", typeof i.axis2d({ up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }).x === "number")
  checar("input.capture", ["game", "gui", "both"].includes(i.capture))
  checar("keysDown", Array.isArray(i.keysDown()))
  checar("touches", Array.isArray(i.touches))
  checar("characterFrame", i.characterFrame() === null || typeof i.characterFrame()${t('!')}.x === "number")
  estado.assinaturas.push(i.onKeyDown((e) => aoTeclar(e)))
  estado.assinaturas.push(i.onKeyUp(() => {}))
  estado.assinaturas.push(i.onPointerDown((e) => { if (e.button === 0) cliqueNaCena(e.x, e.y) }))
  estado.assinaturas.push(i.onWheel(() => {}))
  estado.assinaturas.push(i.onGamepadButtonDown((e) => helix.log.info("Debug", \`Gamepad \${e.pad} botão \${e.button}\`)))
}

function aoTeclar(e${t(': { code: string; repeat: boolean }')}) {
  if (e.repeat) return
  switch (e.code) {
    case "KeyR":
      helix.play.restart()
      break
    case "KeyB":
      soltarCaixa()
      break
    case "KeyE":
      helix.events.emit("debug.ping", { origem: "teclado", quadro: helix.time.frame })
      break
    case "KeyF":
      helix.camera.shake(0.4, 0.6)
      break
    case "KeyG":
      if (estado.efeito) {
        estado.efeito.enabled = !estado.efeito.enabled
        helix.log.info("Debug", \`Efeito DebugPost \${estado.efeito.enabled ? "ligado" : "desligado"}\`)
      }
      break
    case "KeyT":
      helix.time.scale = helix.time.scale === 1 ? 0.3 : 1
      helix.log.info("Debug", \`time.scale = \${helix.time.scale}\`)
      break
    case "KeyH":
      if (estado.tela) {
        if (helix.gui.isShown(estado.tela)) helix.gui.hide(estado.tela)
        else void helix.gui.show(estado.tela, "debug-tela")
      }
      break
    case "KeyL":
      helix.log.info("Debug", \`Luzes locais: \${helix.light.all({ local: true }).map((l) => l.entity.name).join(", ")}\`)
      break
  }
}

function soltarCaixa() {
  const caixa = helix.scene.spawnPrimitive("box", { name: "CaixaSolta", position: [helix.math.random.range(-3, 3), 6, helix.math.random.range(0, 4)], rigidBody: { type: "dynamic", collider: "box", mass: 1 }, tags: ["caixa"] })
  helix.material.setColor(caixa, helix.math.random.color())
  estado.pontos += 1
  helix.gui.bind("pontos", estado.pontos)
  helix.events.emit("debug.caixa", { nome: caixa.name })
}

function cliqueNaCena(x${t(': number')}, y${t(': number')}) {
  const alvo = helix.camera.pick(x, y)
  const ponto = helix.camera.pickPoint(x, y)
  if (alvo) helix.log.info("Debug", \`Clique em \${alvo.name}\${ponto ? \` @ \${ponto[0].toFixed(1)}, \${ponto[1].toFixed(1)}, \${ponto[2].toFixed(1)}\` : ""}\`)
  if (ponto) helix.debug.sphere(ponto, 0.3, "#ff006e", 2)
}

function eventos() {
  const ev = helix.events
  let recebido${any} = null
  const off = ev.on("debug.ping", (p) => { recebido = p })
  checar("events.emit conta ouvintes", ev.emit("debug.ping", { origem: "teste" }) === 1)
  checar("events.on recebe", recebido !== null && recebido.origem === "teste")
  checar("listenerCount", ev.listenerCount("debug.ping") === 1)
  off()
  checar("unsubscribe", ev.listenerCount("debug.ping") === 0)
  let umaVez = 0
  ev.once("debug.once", () => umaVez++)
  ev.emit("debug.once")
  ev.emit("debug.once")
  checar("events.once", umaVez === 1)
  const ouvinte = () => {}
  ev.on("debug.off", ouvinte)
  ev.off("debug.off", ouvinte)
  checar("events.off", ev.listenerCount("debug.off") === 0)
  checar("events.names", Array.isArray(ev.names()))
  estado.assinaturas.push(ev.on("debug.ping", (p${any}) => helix.log.info("Debug", \`ping de \${p.origem}\`)))
  estado.assinaturas.push(ev.on("debug.caixa", (p${any}) => helix.log.debug("Debug", \`caixa \${p.nome}\`)))
  let doAtor = 0
  estado.assinaturas.push(ev.onEntity(estado.torus, "toque", () => doAtor++))
  ev.emitEntity(estado.torus, "toque")
  checar("onEntity/emitEntity", doAtor === 1)
  estado.assinaturas.push(helix.play.onStopped(() => helix.log.info("Debug", "play.onStopped disparou")))
  estado.assinaturas.push(helix.play.onPaused(() => helix.log.info("Debug", "pausado")))
  estado.assinaturas.push(helix.play.onResumed(() => helix.log.info("Debug", "retomado")))
}

async function tempo() {
  const t = helix.time
  checar("time.now", t.now >= 0 && t.frame >= 0)
  checar("time.delta", t.delta >= 0 && t.fixedDelta > 0 && t.unscaledDelta >= 0)
  checar("time.realtime", t.realtime >= 0)
  const inicio = t.now
  await t.wait(0.1)
  checar("time.wait", t.now - inicio >= 0.09, (t.now - inicio).toFixed(3))
  const quadro = t.frame
  await t.waitFrames(2)
  checar("time.waitFrames", t.frame >= quadro + 2, t.frame - quadro)
  estado.assinaturas.push(t.every(2, () => helix.gui.bind("atores", helix.scene.count())))
  const atraso = { disparou: false }
  t.delay(0.2, () => { atraso.disparou = true })
  t.nextFrame(() => {})
  const tarefa = helix.task.spawn(async () => { await t.wait(0.3) })
  checar("task.spawn", !tarefa.finished && helix.task.running >= 1)
  await tarefa.done
  checar("task.done", tarefa.finished && !tarefa.cancelled)
  checar("time.delay", atraso.disparou)
  const cancelada = helix.task.spawn(async () => { await t.wait(10) })
  helix.task.cancel(cancelada)
  checar("task.cancel", cancelada.cancelled === true)
  await helix.task.all([helix.task.spawn(() => 1), helix.task.spawn(() => 2)])
}

async function dadosEProjeto() {
  await helix.storage.ready()
  const execucoes = Number(helix.storage.get("execucoes", 0) ?? 0) + 1
  await helix.storage.set("execucoes", execucoes)
  checar("storage.get/set", helix.storage.get("execucoes") === execucoes && helix.storage.has("execucoes"))
  checar("storage.keys", helix.storage.keys().includes("execucoes"))
  const slot = helix.storage.slot("debug")
  await slot.set("linguagem", LINGUAGEM)
  checar("storage.slot", slot.get("linguagem") === LINGUAGEM && helix.storage.slots().includes("debug"))
  checar("storage.snapshot", typeof helix.storage.snapshot() === "object")
  helix.storage.session.set("volatil", 1)
  checar("storage.session", helix.storage.session.get("volatil") === 1)
  helix.log.info("Debug", \`Execução nº \${execucoes} deste jogo de teste neste projeto.\`)

  const cfg${any} = await helix.assets.data("DebugConfig")
  checar("assets.data(toml)", cfg !== null && cfg.jogador && cfg.jogador.velocidade === 6.5, JSON.stringify(cfg))
  checar("assets.text", (await helix.assets.text("DebugConfig")).includes("velocidade"))
  checar("assets.bytes", (await helix.assets.bytes("DebugConfig")).length > 0)
  checar("assets.byName", helix.assets.byName("DebugJogo", "script") !== null)
  checar("assets.get", helix.assets.get(helix.assets.byName("DebugJogo", "script")${t('!')}.id) !== null)
  checar("assets.list/kinds", helix.assets.list().length > 0 && helix.assets.kinds().includes("script"))
  checar("assets.exists", helix.assets.exists("DebugUtil") && !helix.assets.exists("NaoExiste"))
  checar("assets.search", helix.assets.search("Debug").length >= 5)
  checar("assets.tags", Array.isArray(helix.assets.tags("DebugUtil")))
  const script = await helix.assets.script("DebugUtil")
  checar("assets.script", script.language.length > 0 && script.source.length > 0)
  checar("assets.file", (await helix.assets.file("DebugConfig")).size > 0)
  checar("assets.url", (await helix.assets.url("DebugConfig")).length > 0)
  checar("assets.status/count", helix.assets.count > 0 && ["idle", "loading", "ready", "unavailable"].includes(helix.assets.status))
  estado.assinaturas.push(helix.assets.onChange((e) => helix.log.debug("Debug", \`ativo \${e.type}: \${e.asset.name}\`)))

  checar("project.name", typeof helix.project.name === "string")
  checar("project.stats", helix.project.stats.entities > 0)
  checar("project.settings", helix.project.settings.physics.fixedTimestep > 0)
  checar("project.info", helix.project.info().id === helix.project.id)
  checar("autosave", ["clean", "dirty", "saving", "error"].includes(helix.project.autosave.state))
  checar("project.quota", typeof (await helix.project.quota()).used === "number")

  helix.net.rpc("eco", (x) => x)
  checar("net.rpc/call", (await helix.net.call("eco", 42)) === 42 && helix.net.hasRpc("eco") && helix.net.rpcs().includes("eco"))
  checar("net.localPlayer", helix.net.localPlayer.local === true && helix.net.players().length >= 1)
  checar("net.transport", helix.net.transport === "local" && typeof helix.net.isServer === "boolean")
  checar("net.replicate", Array.isArray(helix.net.replicate(estado.torus, ["name"])))

  checar("play.state", helix.play.state === "playing" && helix.play.isRunning)
  checar("play.timeScale", helix.play.timeScale === helix.time.scale)
  checar("play.elapsed", helix.play.elapsed >= 0)
}

async function salvamentos() {
  const alvo = helix.scene.find("CaixaFurada")${t('!')}
  const prefab = await helix.scene.saveAsPrefab(alvo, "DebugPrefab")
  checar("saveAsPrefab", prefab.name.startsWith("DebugPrefab"), prefab.kind)
  const instancia = await helix.scene.instantiatePrefab(prefab)
  helix.transform.setPosition(instancia, [7, 0.5, 4])
  checar("instantiatePrefab", helix.scene.isAttached(instancia))
  const modelo = await helix.mesh.toModelAsset(helix.mesh.torusKnot(0.5, 0.15), "DebugModelo")
  checar("toModelAsset", modelo.kind === "model")
  const malha = await helix.mesh.fromModelAsset(modelo)
  checar("fromModelAsset", helix.mesh.triangleCount(malha) > 0)
  const no = await helix.scene.instantiate(modelo, { position: [-7, 1, -4], name: "NoDoModelo" })
  checar("scene.instantiate", helix.scene.isAttached(no))
  const doc = helix.animation.setKey(helix.animation.create("DebugClipe", { duration: 1 }), "hips", "rotation", 0, [0, 0, 0, 1])
  const clipe = await helix.animation.save(doc, "DebugClipe")
  checar("animation.save", clipe.kind === "animation")
  checar("animation.document", (await helix.animation.document(clipe)).tracks.length === 1)
  const salvo = helix.materials.save(helix.material.create({ baseColor: "#9b5de5" }), "DebugMaterial")
  checar("materials.save/get", salvo !== null && helix.materials.get("DebugMaterial") !== null)
  if (salvo) {
    const instanciado = helix.materials.instantiate("DebugMaterial")
    checar("materials.instantiate", instanciado !== null && helix.materials.forMaterial(instanciado) !== null)
    checar("materials.apply", helix.materials.apply(helix.scene.find("Cone")${t('!')}, "DebugMaterial") === true)
    helix.materials.remove("DebugMaterial")
    checar("materials.remove", helix.materials.get("DebugMaterial") === null)
  }
}

// Hooks -----------------------------------------------------------------------------------------

export function onLoad() {
  helix.log.info("Debug", "onLoad do script de entrada")
}

export async function onStart() {
  helix.log.info("Debug", \`Jogo de teste em \${LINGUAGEM}: percorrendo a API…\`)
  await area("Núcleo", nucleo)
  await area("Módulo (require)", modulo)
  await area("Matemática", matematica)
  await area("Cena", cena)
  await area("Transformações", transformacao)
  await area("Malhas e CSG", malhas)
  await area("Materiais e texturas", materiais)
  await area("Luzes", luzes)
  await area("Céu e mundo", ceu)
  await area("Câmera", camera)
  await area("Pós-processamento", pos)
  await area("Render", render)
  await area("Física", fisica)
  await area("Personagem e jogador", personagem)
  await area("Terreno", terreno)
  await area("Interface", interfaceGrafica)
  await area("Áudio", audio)
  await area("Animação", animacao)
  await area("VFX", vfx)
  await area("Entrada", entrada)
  await area("Eventos", eventos)
  await area("Tempo e tarefas", tempo)
  await area("Dados, projeto e rede", dadosEProjeto)
  await area("Salvamentos na biblioteca", salvamentos)
  const girador = helix.assets.byName("DebugGirador", "script")
  if (girador) {
    const extra = helix.scene.spawnPrimitive("box", { name: "GiradorDinamico", position: [-2, 0.5, -3], rigidBody: { type: "kinematic", collider: "box" }, script: { assetId: girador.id, props: { velocidade: 180, cor: "#00b4d8" } } })
    checar("spawn com script", extra.script !== null && extra.script.assetId === girador.id)
  } else {
    checar("ativo DebugGirador", false, "não está na biblioteca")
  }
  resumo()
}

function resumo() {
  const dica = "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia."
  if (estado.falhas === 0) helix.log.info("Debug", \`API percorrida em \${LINGUAGEM}: \${estado.checagens} checagens, nenhuma falha. \${dica}\`)
  else helix.log.warn("Debug", \`API percorrida em \${LINGUAGEM}: \${estado.checagens} checagens, \${estado.falhas} falhas (veja FALHOU/ERRO acima). \${dica}\`)
  helix.gui.bind("checagens", estado.checagens)
  helix.gui.bind("falhas", estado.falhas)
}

export function onUpdate(dt${t(': number')}) {
  estado.quadros++
  if (estado.torus) helix.transform.rotate(estado.torus, [0, 40 * dt, 0])
  const d = helix.debug
  d.line([-6, 0.05, -6], [6, 0.05, -6], "#ff006e")
  d.box({ center: [0, 1, 3], size: [3, 2, 3] }, "#ffbe0b")
  if (estado.heroi) {
    d.axes(estado.heroi, 1)
    d.text(helix.math.vec3.add(helix.transform.worldPosition(estado.heroi), [0, 2.2, 0]), \`Heroi · \${estado.pontos} pts\`, "#ffffff")
  }
  if (estado.torus) d.bounds(estado.torus, "#3a86ff")
  d.ray([0, 3, 0], [0, -1, 0], 3, "#06d6a0")
  estado.hudTimer += dt
  if (estado.hudTimer >= 0.5) {
    estado.hudTimer = 0
    helix.gui.bind("fps", Math.round(helix.render.stats.fps))
    helix.gui.bind("checagens", estado.checagens)
    helix.gui.bind("falhas", estado.falhas)
  }
}

export function onFixedUpdate(h${t(': number')}) {
  estado.passosFisica++
  if (estado.passosFisica === 1) checar("onFixedUpdate recebe o passo", h > 0 && h < 1, h)
}

export function onLateUpdate() {
  estado.lateUpdates++
}

export function onRender(frame${t(': { width: number }')}) {
  estado.rendersHook++
  if (estado.rendersHook === 1) checar("onRender recebe o frame", typeof frame.width === "number")
}

export function onBeforeHotReload() {
  return { pontos: estado.pontos }
}

export function onHotReload(anterior${any}) {
  estado.pontos = anterior && typeof anterior.pontos === "number" ? anterior.pontos : 0
  helix.log.info("Debug", \`Recarga a quente: \${estado.pontos} pontos preservados\`)
}

export function onStop() {
  for (const desligar of estado.assinaturas) desligar()
  helix.log.info("Debug", \`Parou: \${estado.quadros} quadros, \${estado.passosFisica} passos de física, \${estado.lateUpdates} lateUpdates, \${estado.renders} frames (onAfterFrame), \${estado.rendersHook} onRender, \${estado.colisoes} colisões.\`)
}
`;
    const actor = `                                 
                                                                                              
                                                                                                
import helix from "helix"

export default class DebugGirador {
  angulo = 0
  contatos = 0
  quadros = 0
  desligar${t(': (() => void) | null')} = null

  onLoad() {
    helix.props.define({
      velocidade: { type: "range", default: 90, min: 0, max: 360, step: 1, label: "Velocidade (°/s)" },
      cor: { type: "color", default: "#ff8800", label: "Cor" },
      pulsar: { type: "boolean", default: true, label: "Pulsar" },
    })
  }

  onStart() {
    const ator = (this${t(' as any')}).actor
    helix.log.info("Girador", \`\${ator.name} acordou com velocidade \${helix.props.get("velocidade")}°/s\${helix.script ? \` (script \${helix.script.name})\` : ""}\`)
    helix.material.setColor(ator, helix.props.get("cor")${t(' as string')})
    this.desligar = helix.props.onChanged("cor", (cor) => helix.material.setColor(ator, cor${t(' as string')}))
    helix.log.assert(helix.self === ator, "helix.self deveria ser o ator deste script")
    helix.log.assert(helix.props.has("velocidade") && helix.props.definitions().length === 3, "props.define deveria registrar 3 propriedades")
  }

  onUpdate(dt${t(': number')}) {
    const ator = (this${t(' as any')}).actor
    this.quadros++
    this.angulo += (helix.props.get("velocidade")${t(' as number')}) * dt
    helix.transform.setRotation(ator, [0, this.angulo, 0])
    if (helix.props.get("pulsar")) helix.transform.setScale(ator, 1 + Math.sin(helix.time.now * 3) * 0.1)
  }

  onCollisionBegin(outro${any}, contato${any}) {
    this.contatos++
    if (this.contatos <= 3) helix.log.info("Girador", \`\${(this${t(' as any')}).actor.name} tocou \${outro.name} (impulso \${contato.impulse.toFixed(2)})\`)
  }

  onTriggerEnter(outro${any}) {
    helix.log.info("Girador", \`\${outro.name} entrou no gatilho de \${(this${t(' as any')}).actor.name}\`)
  }

  onEnable() {
    helix.log.debug("Girador", \`\${(this${t(' as any')}).actor.name} ativo\`)
  }

  onDisable() {
    helix.log.debug("Girador", \`\${(this${t(' as any')}).actor.name} inativo\`)
  }

  onStop() {
    helix.log.info("Girador", \`\${(this${t(' as any')}).actor.name}: \${this.quadros} quadros, \${this.contatos} contatos\`)
  }

  onDestroy() {
    if (this.desligar) this.desligar()
  }
}
`;
    const module = `                                     
                                                                                       
export function soma(a${t(': number')}, b${t(': number')})${t(': number')} {
  return a + b
}

export function saudacao(quem${t(': string')})${t(': string')} {
  return \`Olá, \${quem}\`
}

export function limitar(valor${t(': number')}, minimo${t(': number')}, maximo${t(': number')})${t(': number')} {
  return Math.min(maximo, Math.max(minimo, valor))
}
`;
    return { entry, actor, module };
}
