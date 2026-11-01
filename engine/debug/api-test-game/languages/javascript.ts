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
`;
}
