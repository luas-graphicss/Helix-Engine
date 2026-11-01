import type { GameSources } from '../types';
export function goGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
package main

import (
	"fmt"
	"math"
	"strings"

	"helix"
)

const linguagem = "Go"

var (
	quadros, passosFisica, lateUpdates, renders, colisoes, checagens, falhas, pontos int
	hudTimer                                                                        float64
	                                                                        
	torus, heroi, efeito, tela helix.Value
	assinaturas                []helix.Value
)

                                                        
type opts = map[string]any

                                                                                          

func api(caminho string) helix.Value { return helix.Root().Path(caminho) }
func v3(x, y, z float64) helix.Vec3  { return helix.V3(x, y, z) }

func arg(args []helix.Value, indice int) helix.Value {
	if indice < len(args) {
		return args[indice]
	}
	return helix.Undefined()
}

func registrar(metodo, mensagem string) { api("log").Invoke(metodo, "Debug", mensagem) }
func info(format string, args ...any)   { registrar("info", fmt.Sprintf(format, args...)) }
func aviso(format string, args ...any)  { registrar("warn", fmt.Sprintf(format, args...)) }
func erro(format string, args ...any)   { registrar("error", fmt.Sprintf(format, args...)) }
func depurar(format string, args ...any) {
	registrar("debug", fmt.Sprintf(format, args...))
}

func checar(nome string, condicao bool) {
	checagens++
	if condicao {
		return
	}
	falhas++
	erro("FALHOU %s", nome)
}

func checarf(nome string, condicao bool, format string, args ...any) {
	checagens++
	if condicao {
		return
	}
	falhas++
	erro("FALHOU %s: %s", nome, fmt.Sprintf(format, args...))
}

func assinar(desligar helix.Value) {
	if desligar.IsFunction() {
		assinaturas = append(assinaturas, desligar)
	}
}

func verdadeiro(v helix.Value) bool          { return v.IsBool() && v.Bool() }
func falso(v helix.Value) bool               { return v.IsBool() && !v.Bool() }
func aprox(a, b, epsilon float64) bool       { return math.Abs(a-b) <= epsilon }
func numero(o helix.Value, chave string) float64 { return o.Get(chave).Number() }
func textoIgual(v helix.Value, esperado string) bool {
	return v.IsString() && v.String() == esperado
}

                                                                                         
func eq3(vetor helix.Value, x, y, z, epsilon float64) bool {
	return api("math.vec3").Invoke("equals", vetor, v3(x, y, z), epsilon).Bool()
}

func comprimento(vetor helix.Value) float64 { return api("math.vec3").Invoke("length", vetor).Number() }

func contem(lista helix.Value, texto string) bool {
	for _, item := range lista.Slice() {
		if item.String() == texto {
			return true
		}
	}
	return false
}

func nomeDe(entidade helix.Value) string {
	if entidade.IsNone() {
		return "ninguém"
	}
	return entidade.Get("name").String()
}

                                                                                           

func nucleo() helix.Value {
	raiz := helix.Root()
	engine := api("engine")
	nome, versao := engine.Get("name"), engine.Get("version")
	contexto := raiz.Get("context").String()
	checar("engine.name", nome.IsString() && nome.String() != "")
	checar("engine.version", versao.IsString())
	checarf("context", contexto == "shared" || contexto == "client" || contexto == "server", "%s", contexto)
	checar("isPlaying", verdadeiro(raiz.Get("isPlaying")))
	checar("isEditor", falso(raiz.Get("isEditor")))
	checar("self no script de entrada", helix.Self().IsNone() && raiz.Get("self").IsNone())
	checar("Script() é o handle do script", helix.Script().IsObject())
	checar("Now", helix.Now() >= 0)
	info("%s %s · API %s · %s", nome, versao, engine.Get("apiVersion"), linguagem)
	helix.Print("Print direto do Go (log sem canal)")
	return helix.Undefined()
}

func modulo() helix.Value {
	util := helix.Require("DebugUtil")
	checar("Require devolve as funções", util.IsObject() && util.Get("soma").IsFunction())
	resultado := util.Invoke("soma", 2, 3).Number()
	checarf("require soma", resultado == 5, "%g", resultado)
	checar("require saudacao", textoIgual(util.Invoke("saudacao", "Helix"), "Olá, Helix"))
	checar("require limitar", util.Invoke("limitar", 15, 0, 10).Number() == 10)
	return helix.Undefined()
}

func matematica() helix.Value {
	m := api("math")
	vec, quat, mat4, escalar := m.Get("vec3"), m.Get("quat"), m.Get("mat4"), m.Get("scalar")
	checar("vec3.add", eq3(vec.Invoke("add", v3(1, 2, 3), v3(1, 1, 1)), 2, 3, 4, 1e-6))
	checar("vec3.length", aprox(vec.Invoke("length", v3(3, 4, 0)).Number(), 5, 1e-3))
	checar("vec3.normalize", aprox(comprimento(vec.Invoke("normalize", v3(0, 5, 0))), 1, 1e-3))
	checar("vec3.cross", eq3(vec.Invoke("cross", v3(1, 0, 0), v3(0, 1, 0)), 0, 0, 1, 1e-6))
	checar("vec3.lerp", eq3(vec.Invoke("lerp", v3(0, 0, 0), v3(2, 2, 2), 0.5), 1, 1, 1, 1e-6))
	q := quat.Invoke("fromEuler", v3(0, 90, 0))
	checar("quat.rotateVec3", eq3(quat.Invoke("rotateVec3", q, v3(1, 0, 0)), 0, 0, -1, 1e-3))
	checar("quat.toEuler", aprox(numero(quat.Invoke("toEuler", q), "y"), 90, 0.01))
	mat := mat4.Invoke("fromTRS", v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1))
	checar("mat4.transformPoint", eq3(mat4.Invoke("transformPoint", mat, v3(0, 0, 0)), 1, 2, 3, 1e-6))
	checar("mat4.invert", !mat4.Invoke("invert", mat).IsNone())
	aabb := m.Get("aabb")
	caixa := aabb.Invoke("fromCenterSize", v3(0, 0, 0), v3(2, 2, 2))
	checar("aabb.contains", aabb.Invoke("contains", caixa, v3(0.5, 0.5, 0.5)).Bool() && !aabb.Invoke("contains", caixa, v3(2, 0, 0)).Bool())
	ray := m.Get("ray")
	raio := ray.Invoke("create", v3(0, 5, 0), v3(0, -1, 0))
	checar("ray.intersectAabb", !ray.Invoke("intersectAabb", raio, caixa).IsNone())
	checar("scalar.remap", escalar.Invoke("remap", 5, 0, 10, 0, 100).Number() == 50)
	checar("clamp/lerp", m.Invoke("clamp", 15, 0, 10).Number() == 10 && m.Invoke("lerp", 0, 10, 0.5).Number() == 5)
	checar("scalar.wrapAngle", aprox(escalar.Invoke("wrapAngle", 370).Number(), 10, 1e-3))
	checar("degToRad", aprox(m.Invoke("degToRad", 180).Number(), math.Pi, 1e-6))
	ruido := m.Get("noise")
	perlin := ruido.Invoke("perlin2", 0.3, 0.7).Number()
	checarf("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, "%g", perlin)
	checar("noise.fbm", ruido.Invoke("fbm", 1.5, 2.5, 0, 4).IsNumber())
	cor := m.Get("color")
	checar("color.hexToVec3", eq3(cor.Invoke("hexToVec3", "#ff0000"), 1, 0, 0, 0.01))
	hex := cor.Invoke("vec3ToHex", v3(1, 1, 1)).String()
	checarf("color.vec3ToHex", strings.EqualFold(hex, "#ffffff"), "%s", hex)
	random := m.Get("random")
	random.Invoke("seed", 42)
	primeiro := random.Invoke("value").Number()
	random.Invoke("seed", 42)
	checar("random.seed determinístico", random.Invoke("value").Number() == primeiro)
	sorteado := random.Invoke("int", 1, 6).Number()
	checar("random.int", sorteado >= 1 && sorteado <= 6 && math.Floor(sorteado) == sorteado)
	checar("random.unitVector", aprox(comprimento(random.Invoke("unitVector")), 1, 1e-3))
	checar("PI/TAU", aprox(numero(m, "TAU"), numero(m, "PI")*2, 1e-9))
	return helix.Undefined()
}

                                                                                            

func cena() helix.Value {
	s, mat := api("scene"), api("material")
	raiz := s.Get("root")
	checar("scene.root", !raiz.IsNone() && raiz.Get("children").IsArray())
	antes := s.Invoke("count").Number()
	grupo := s.Invoke("spawn", "group", opts{"name": "DebugCenario"})
	chao := s.Invoke("spawn", "mesh", opts{
		"name":           "Chao",
		"mesh":           api("mesh").Invoke("plane", 40, 40),
		"material":       mat.Invoke("create", opts{"baseColor": "#4b6b3a", "roughness": 0.95}),
		"rigidBody":      opts{"type": "static", "collider": "box", "boxSize": v3(40, 0.2, 40), "center": v3(0, -0.1, 0)},
		"receiveShadows": true,
		"tags":           []string{"chao"},
	}, grupo)
	checar("spawn mesh", textoIgual(chao.Get("kind"), "mesh") && !chao.Get("mesh").IsNone() && !chao.Get("rigidBody").IsNone())
	checar("find", s.Invoke("find", "Chao").Equals(chao))
	checar("findAll", s.Invoke("findAll", "Chao").Len() == 1)
	checar("byId", s.Invoke("byId", chao.Get("id")).Equals(chao))
	checar("byTag", s.Invoke("byTag", "chao").Len() >= 1)
	checar("byKind", s.Invoke("byKind", "mesh").Len() >= 1)
	depois := s.Invoke("count").Number()
	checarf("count", depois == antes+2, "%g vs %g", depois, antes+2)
	checar("contains", s.Invoke("contains", grupo, chao).Bool() && s.Invoke("contains", raiz, chao).Bool())
	caminho := s.Invoke("path", chao).String()
	checarf("path", strings.Contains(caminho, "Chao"), "%s", caminho)
	visitados := 0
	s.Invoke("traverse", func(args []helix.Value) { visitados++ }, grupo)
	checarf("traverse", visitados >= 2, "%d", visitados)

	anel := s.Invoke("spawnPrimitive", "torus", opts{"name": "Anel", "position": v3(-4, 1.2, -2), "scale": 1.5}, grupo)
	mat.Invoke("setColor", anel, "#3a86ff")
	mat.Invoke("setEmissive", anel, "#3a86ff", 0.6)
	torus = anel
	checar("spawnPrimitive", !anel.Get("mesh").IsNone() && !anel.Get("material").IsNone())

	copia := s.Invoke("clone", anel, true, grupo)
	s.Invoke("rename", copia, "AnelCopia")
	api("transform").Invoke("setPosition", copia, v3(-4, 1.2, 2))
	checar("clone + rename", textoIgual(copia.Get("name"), "AnelCopia") && s.Invoke("find", "AnelCopia").Equals(copia))
	s.Invoke("setMeta", copia, "origem", "clone")
	checar("meta", textoIgual(s.Invoke("getMeta", copia, "origem"), "clone"))
	s.Invoke("addTag", copia, "temporario")
	checar("addTag/hasTag", s.Invoke("hasTag", copia, "temporario").Bool())
	checar("removeTag", verdadeiro(s.Invoke("removeTag", copia, "temporario")) && !s.Invoke("hasTag", copia, "temporario").Bool())
	s.Invoke("setVisible", copia, false)
	checar("setVisible", falso(copia.Get("visible")))
	s.Invoke("setVisible", copia, true)
	s.Invoke("destroy", copia)
	checar("destroy", s.Invoke("find", "AnelCopia").IsNone() && !s.Invoke("isAttached", copia).Bool())

	esfera := s.Invoke("spawnPrimitive", "sphere", opts{"name": "Esfera", "position": v3(4, 0.5, -3)})
	s.Invoke("reparent", esfera, grupo)
	checar("reparent", esfera.Get("parent").Equals(grupo))
	mat.Invoke("setColor", esfera, "#ffbe0b")
	s.Invoke("addComponent", esfera, "rigidBody", opts{"type": "dynamic", "collider": "sphere", "radius": 0.5, "mass": 1})
	checar("addComponent", !esfera.Get("rigidBody").IsNone() && textoIgual(esfera.Path("rigidBody.type"), "dynamic"))
	temporario := s.Invoke("spawnPrimitive", "box", opts{"name": "Temporario"})
	s.Invoke("addComponent", temporario, "csg", helix.NewObject())
	checar("addComponent csg", !temporario.Get("csg").IsNone())
	s.Invoke("removeComponent", temporario, "csg")
	checar("removeComponent", temporario.Get("csg").IsNone())
	s.Invoke("destroy", temporario)
	checar("kinds/components", contem(s.Invoke("kinds"), "mesh") && contem(s.Invoke("components"), "rigidBody"))
	return helix.Undefined()
}

func transformacao() helix.Value {
	tr, s := api("transform"), api("scene")
	alvo := s.Invoke("spawnPrimitive", "cone", opts{"name": "Cone", "position": v3(0, 0.5, -6)})
	api("material").Invoke("setColor", alvo, "#8338ec")
	tr.Invoke("setPosition", alvo, v3(2, 0.5, -6))
	checar("setPosition", eq3(tr.Invoke("position", alvo), 2, 0.5, -6, 1e-6))
	tr.Invoke("translate", alvo, v3(0, 1, 0), "world")
	checar("translate", aprox(numero(tr.Invoke("position", alvo), "y"), 1.5, 1e-3))
	tr.Invoke("setRotation", alvo, v3(0, 90, 0))
	checar("setRotation", aprox(numero(tr.Invoke("rotation", alvo), "y"), 90, 0.01))
	tr.Invoke("rotate", alvo, v3(0, 45, 0))
	girado := api("math.scalar").Invoke("wrapAngle", tr.Invoke("rotation", alvo).Get("y")).Number()
	checarf("rotate", aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), "%g", girado)
	tr.Invoke("setScale", alvo, 2)
	checar("setScale", aprox(numero(tr.Invoke("scale", alvo), "x"), 2, 1e-6))
	tr.Invoke("setScale", alvo, v3(1, 1, 1))
	mundo := tr.Invoke("worldPosition", alvo).Vec3()
	checar("worldPosition", eq3(tr.Invoke("position", alvo), mundo.X, mundo.Y, mundo.Z, 1e-3))
	checar("forward/up", aprox(comprimento(tr.Invoke("forward", alvo)), 1, 1e-3) && aprox(comprimento(tr.Invoke("up", alvo)), 1, 1e-3))
	tr.Invoke("lookAt", alvo, v3(0, 1.5, 0))
	checar("distance", tr.Invoke("distance", alvo, v3(2, 1.5, -6)).Number() < 0.01)
	checar("directionTo", aprox(comprimento(tr.Invoke("directionTo", alvo, v3(0, 1.5, 0))), 1, 1e-3))
	limites := tr.Invoke("bounds", alvo)
	checar("bounds", !limites.IsNone() && numero(limites.Get("max"), "y") > numero(limites.Get("min"), "y"))
	checar("worldMatrix", tr.Invoke("worldMatrix", alvo).Len() == 16 && tr.Invoke("localMatrix", alvo).Len() == 16)
	local := tr.Invoke("worldToLocal", alvo, tr.Invoke("localToWorld", alvo, v3(1, 0, 0)))
	checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3))
	return helix.Undefined()
}

func malhas() helix.Value {
	me, s, csg, mat := api("mesh"), api("scene"), api("csg"), api("material")
	caixa := me.Invoke("box", 1, 1, 1)
	triangulos := me.Invoke("triangleCount", caixa).Number()
	checarf("mesh.box", me.Invoke("vertexCount", caixa).Number() > 0 && triangulos == 12, "%g", triangulos)
	esfera := me.Invoke("sphere", 0.65, 16, 12)
	furado := csg.Invoke("boolean", caixa, esfera, "subtract")
	checar("csg.boolean", me.Invoke("triangleCount", furado).Number() > 12)
	ator := s.Invoke("spawn", "mesh", opts{
		"name":     "CaixaFurada",
		"mesh":     furado,
		"material": mat.Invoke("create", opts{"baseColor": "#e63946", "roughness": 0.4, "metallic": 0.2}),
		"position": v3(4, 0.5, 2),
	})
	checar("spawn malha CSG", !ator.Get("mesh").IsNone())
	checar("csg.operations", contem(csg.Invoke("operations"), "union"))
	tri := me.Invoke("create", opts{
		"name":      "Triangulo",
		"positions": []float64{-1, 0, 0, 1, 0, 0, 0, 1.5, 0},
		"uvs":       []float64{0, 0, 1, 0, 0.5, 1},
		"indices":   []int{0, 1, 2},
	})
	me.Invoke("computeNormals", tri)
	checar("mesh.create + computeBounds", numero(me.Invoke("computeBounds", tri).Get("max"), "y") >= 1.5)
	dupla := me.Invoke("merge", tri, me.Invoke("flipWinding", me.Invoke("clone", tri)))
	checar("mesh.merge", me.Invoke("triangleCount", dupla).Number() == 2)
	s.Invoke("spawn", "mesh", opts{
		"name":     "Triangulo",
		"mesh":     dupla,
		"material": mat.Invoke("create", opts{"baseColor": "#06d6a0", "doubleSided": true}),
		"position": v3(7, 0, -2),
	})
	grande := me.Invoke("scale", me.Invoke("translate", me.Invoke("clone", caixa), v3(0, 0.5, 0)), 2)
	checar("mesh.translate/scale", numero(me.Invoke("computeBounds", grande).Get("max"), "y") > 1.9)
	distancia := me.Invoke("raycast", api("math.ray").Invoke("create", v3(0, 5, 0), v3(0, -1, 0)), grande)
	checar("mesh.raycast", distancia.IsNumber() && distancia.Number() > 0)
	vertices := me.Invoke("vertexCount", caixa).Int()
	checar("positions/indices", me.Invoke("positions", caixa).Len() == vertices*3 && me.Invoke("indices", caixa).Len() == 36)
	checar("primitivas extras", me.Invoke("triangleCount", me.Invoke("torusKnot")).Number() > 0 && me.Invoke("triangleCount", me.Invoke("capsule")).Number() > 0)
	return helix.Undefined()
}

                                                                                              

func materiais() helix.Value {
	mat, s, tex := api("material"), api("scene"), api("texture")
	base := mat.Invoke("create", opts{"name": "DebugBase", "baseColor": "#d98c2b", "roughness": 0.5, "metallic": 0.1})
	checar("material.create", numero(base, "roughness") == 0.5)
	copia := mat.Invoke("clone", base)
	mat.Invoke("set", copia, opts{"roughness": 1, "emissive": "#ffffff", "emissiveIntensity": 2})
	checar("material.clone/set", numero(copia, "roughness") == 1 && numero(base, "roughness") == 0.5)
	caixa := s.Invoke("spawnPrimitive", "box", opts{"name": "CaixaPintada", "position": v3(-7, 0.5, 2)})
	mat.Invoke("assign", caixa, base)
	checar("material.assign/of", !mat.Invoke("of", caixa).IsNone())
	mat.Invoke("own", caixa)
	mat.Invoke("setColor", caixa, "#d98c2b")
	desenho := tex.Invoke("canvas", 64, 64)
	desenho.Invoke("update")
	mat.Invoke("setTexture", caixa, "baseColorMap", desenho.Get("texture"))
	checar("texture.canvas + setTexture", mat.Invoke("hasAnyTexture", mat.Invoke("of", caixa)).Bool() && tex.Invoke("isTexture", desenho.Get("texture")).Bool())
	checar("material.slots", mat.Invoke("slots").Len() > 0)
	checar("materials.list", api("materials").Invoke("list").IsArray())
	sombreado := mat.Invoke("fromShader", "DebugSuperficie", opts{"glow": v3(1, 0.45, 0.1), "speed": 2})
	checar("material.fromShader", !sombreado.IsNone())
	if !sombreado.IsNone() {
		esfera := s.Invoke("spawnPrimitive", "sphere", opts{"name": "EsferaShader", "position": v3(0, 1, -3), "scale": 1.4})
		mat.Invoke("assign", esfera, sombreado)
		mat.Invoke("uniforms", esfera).Invoke("set", "speed", 3)
		checar("material.uniforms.list", mat.Invoke("uniforms", esfera).Invoke("list").Len() >= 1)
	}
	return helix.Undefined()
}

func luzes() helix.Value {
	l := api("light")
	checar("light.types", contem(l.Invoke("types"), "point") && contem(l.Invoke("localTypes"), "spot"))
	lampada := l.Invoke("spawn", "point", opts{"name": "Lampada", "position": v3(0, 3, 0), "color": "#ffd166", "intensity": 60, "range": 14})
	checar("light.spawn", !lampada.Get("light").IsNone() && textoIgual(lampada.Path("light.type"), "point"))
	l.Invoke("set", lampada, opts{"intensity": 80})
	checar("light.set", numero(lampada.Get("light"), "intensity") == 80)
	l.Invoke("setTemperature", lampada, 3200)
	checar("setTemperature", numero(lampada.Get("light"), "temperature") == 3200)
	foco := l.Invoke("spawn", "spot", opts{
		"name": "Holofote", "position": v3(4, 4, 0), "rotation": v3(-90, 0, 0), "intensity": 120, "range": 16,
		"innerAngle": 20, "outerAngle": 35, "color": "#ffffff",
	})
	checar("spot", textoIgual(foco.Path("light.type"), "spot"))
	convertido := l.Invoke("convert", foco, "disc")
	checar("light.convert", textoIgual(convertido.Get("type"), "disc") && textoIgual(foco.Path("light.type"), "disc"))
	l.Invoke("convert", foco, "spot")
	presets := l.Invoke("presets")
	checar("light.presets", presets.Len() > 0)
	if presets.Len() > 0 {
		primeiro := presets.At(0)
		preset := l.Invoke("spawn", primeiro.Get("id"), opts{"name": "LuzPreset", "position": v3(-4, 2.5, 4)})
		checar("light.fromPreset", !preset.Get("light").IsNone() && l.Invoke("fromPreset", primeiro.Get("id")).Get("type").Equals(primeiro.Get("type")))
	}
	checar("light.all", l.Invoke("all", opts{"local": true}).Len() >= 2)
	checar("effectiveRange", l.Invoke("effectiveRange", lampada).Number() > 0)
	checar("light.isLocal", verdadeiro(l.Invoke("isLocal", lampada)))
	checar("temperatureToColor", !l.Invoke("temperatureToColor", 6500).IsNone())
	l.Invoke("setColor", lampada, "#ffffff")
	checar("light.setColor", eq3(lampada.Path("light.color"), 1, 1, 1, 0.01))
	return helix.Undefined()
}

func ceu() helix.Value {
	sky, mundo := api("sky"), api("world")
	sky.Invoke("set", opts{"timeOfDay": 10.5, "haze": 0.3, "clouds": opts{"enabled": true, "coverage": 0.45}})
	checar("sky.set", aprox(numero(sky, "timeOfDay"), 10.5, 1e-3) && verdadeiro(sky.Path("clouds.enabled")))
	checar("sky.isDay", verdadeiro(sky.Get("isDay")))
	checar("sky.sunDirection", numero(sky.Invoke("sunDirection"), "y") > 0)
	hora := sky.Invoke("formatTimeOfDay", 10.5).String()
	checarf("sky.formatTimeOfDay", strings.Contains(hora, ":"), "%s", hora)
	checar("sky.wrapTimeOfDay", sky.Invoke("wrapTimeOfDay", 25).Number() == 1)
	checar("sky.presets", sky.Invoke("presets").Len() > 0)
	assinar(sky.Invoke("onHourChanged", func(args []helix.Value) { info("Hora do céu: %v", arg(args, 0)) }))
	sky.Set("cycleSpeed", 0)
	checar("sky.cycleSpeed", numero(sky, "cycleSpeed") == 0)
	checar("world.gravity", numero(mundo.Get("gravity"), "y") < 0)
	mundo.Get("wind").Invoke("set", opts{"speed": 2, "direction": 45})
	checar("world.wind.set", numero(mundo.Get("wind"), "speed") == 2)
	return helix.Undefined()
}

func camera() helix.Value {
	c := api("camera")
	checar("camera.fov", numero(c, "fov") > 0 && numero(c, "aspect") > 0)
	checar("camera.near/far", numero(c, "near") > 0 && numero(c, "far") > numero(c, "near"))
	viewport := c.Get("viewport")
	checar("viewport", numero(viewport, "width") > 0)
	naTela := c.Invoke("worldToScreen", v3(0, 0, 0))
	checar("worldToScreen", naTela.IsNone() || naTela.Get("x").IsNumber())
	raio := c.Invoke("screenToRay", numero(viewport, "width")/2, numero(viewport, "height")/2)
	checar("screenToRay", raio.IsNone() || aprox(comprimento(raio.Get("direction")), 1, 0.01))
	checar("viewMatrix", c.Get("viewMatrix").Len() == 16)
	jogador := c.Get("player")
	jogador.Invoke("set", opts{"distance": 7, "pitch": 18})
	checar("player.set", numero(jogador.Get("settings"), "distance") == 7)
	checar("distanceTo", c.Invoke("distanceTo", v3(0, 0, 0)).Number() >= 0)
	checar("camera.position", !c.Get("position").IsNone() && !c.Get("forward").IsNone())
	assinar(c.Invoke("onMainChanged", func(args []helix.Value) {
		entidade := arg(args, 0)
		if entidade.IsNone() {
			info("Câmera principal: editor/jogador")
		} else {
			info("Câmera principal: %s", nomeDe(entidade))
		}
	}))
	return helix.Undefined()
}

func pos() helix.Value {
	p := api("post")
	checar("post.toneMappers", p.Invoke("toneMappers").Len() > 0)
	p.Invoke("set", opts{
		"bloom":    opts{"enabled": true, "intensity": 0.5, "threshold": 1, "softKnee": 0.5, "radius": 0.6},
		"vignette": opts{"enabled": true, "intensity": 0.35, "smoothness": 0.5, "roundness": 1},
	})
	checar("post.set", verdadeiro(p.Path("bloom.enabled")) && verdadeiro(p.Path("vignette.enabled")))
	p.Set("exposure", 1.05)
	checar("post.exposure", aprox(numero(p, "exposure"), 1.05, 1e-3))
	p.Set("toneMapper", "agx")
	checar("post.toneMapper", textoIgual(p.Get("toneMapper"), "agx"))
	checar("post.presets", p.Invoke("presets").Len() > 0)
	custom := p.Get("custom")
	novo := custom.Invoke("add", opts{"fragment": "DebugPost", "name": "DebugPost", "uniforms": opts{"tint": v3(0.15, 0.05, 0.3), "strength": 0.6}})
	efeito = novo
	checar("post.custom.add", !novo.IsNone() && !custom.Invoke("get", "DebugPost").IsNone())
	novo.Get("uniforms").Invoke("set", "strength", 0.8)
	checar("efeito.uniforms.list", novo.Get("uniforms").Invoke("list").Len() >= 2)
	return helix.Undefined()
}

func render() helix.Value {
	r := api("render")
	checar("render.passNames", r.Invoke("passNames").Len() > 0)
	checar("render.stats", r.Path("stats.drawCalls").IsNumber())
	checar("render.frame", r.Path("frame.width").IsNumber())
	assinar(r.Invoke("onAfterFrame", func() { renders++ }))
	r.Set("showGrid", false)
	checar("render.showGrid", falso(r.Get("showGrid")))
	checar("render.pixelRatio", numero(r, "pixelRatio") > 0)
	return helix.Undefined()
}

                                                                                           

func fisica() helix.Value {
	ph, s := api("physics"), api("scene")
	checar("physics.enabled", verdadeiro(ph.Get("enabled")))
	checar("physics.gravity", numero(ph.Get("gravity"), "y") < 0)
	checar("physics.settings", numero(ph.Get("settings"), "fixedTimestep") > 0)
	for i := 1; i <= 5; i++ {
		indice := float64(i - 1)
		caixa := s.Invoke("spawnPrimitive", "box", opts{
			"name":      fmt.Sprintf("Caixa%d", i),
			"position":  v3(-2+indice*1.1, 3+indice*1.2, 3),
			"rigidBody": opts{"type": "dynamic", "collider": "box", "mass": 2, "restitution": 0.3},
			"tags":      []string{"caixa"},
		})
		api("material").Invoke("setColor", caixa, api("math.color").Invoke("hsl", 30+float64(i)*12, 0.7, 0.5))
	}
	caixas := s.Invoke("byTag", "caixa")
	primeira := caixas.At(0)
	checar("caixas dinâmicas", caixas.Len() == 5 && ph.Invoke("hasBody", primeira).Bool())
	corpo := ph.Invoke("bodyOf", primeira)
	checar("bodyOf", verdadeiro(corpo.Get("isDynamic")) && numero(corpo, "mass") > 0)
	corpo.Invoke("applyImpulse", v3(0, 2, 0))
	corpo.Invoke("applyTorque", v3(0, 1, 0))
	corpo.Invoke("setMaterial", opts{"friction": 0.8})
	corpo.Invoke("wake")
	checar("body.linearVelocity", !corpo.Get("linearVelocity").IsNone())
	checar("bodies()", ph.Invoke("bodies").Len() >= 6)
	hit := ph.Invoke("raycast", v3(0, 5, 0), v3(0, -1, 0), 20)
	checar("physics.raycast", !hit.IsNone() && !hit.Get("entity").IsNone())
	checar("raycastAll", ph.Invoke("raycastAll", v3(0, 5, 0), v3(0, -1, 0), 20).Len() >= 1)
	checar("overlapSphere", ph.Invoke("overlapSphere", v3(0, 3, 3), 4).IsArray())
	checar("massProperties", numero(ph.Invoke("massProperties", primeira), "mass") > 0)
	checar("colliderVolume", ph.Invoke("colliderVolume", primeira).Number() > 0)
	formas := ph.Get("shapes")
	checar("shapes.sphere volume", aprox(formas.Invoke("volume", formas.Invoke("sphere", 1)).Number(), 4.18879, 0.01))
	assinar(ph.Invoke("onCollisionBegin", func(args []helix.Value) {
		colisoes++
		if colisoes > 3 {
			return
		}
		e := arg(args, 0)
		info("Colisão: %s × %s (impulso %.2f)", nomeDe(e.Get("a")), nomeDe(e.Get("b")), numero(e.Get("contact"), "impulse"))
	}))
	assinar(ph.Invoke("onOutOfBounds", func(args []helix.Value) { aviso("%s caiu do mundo", nomeDe(arg(args, 0))) }))
	gatilho := s.Invoke("spawn", "group", opts{"name": "Gatilho", "position": v3(0, 1, 3), "trigger": opts{"shape": "box", "size": v3(3, 2, 3)}})
	checar("trigger spawn", !gatilho.IsNone() && s.Invoke("isAttached", gatilho).Bool())
	checar("physics.stats", ph.Path("stats.bodies").IsNumber())
	return helix.Undefined()
}

func personagem() helix.Value {
	ch, pl := api("character"), api("player")
	novo := ch.Invoke("spawn", opts{"name": "Heroi", "position": v3(0, 1.2, 8), "character": opts{"walkSpeed": 4, "runSpeed": 7, "jumpHeight": 1.4}})
	heroi = novo
	checar("character.spawn", !novo.Get("character").IsNone() && ch.Invoke("has", novo).Bool())
	c := ch.Invoke("of", novo)
	checar("character.of", c.Get("isGrounded").IsBool())
	checar("settingsOf", numero(ch.Invoke("settingsOf", novo), "walkSpeed") == 4)
	pl.Invoke("possess", novo)
	checar("player.possess", pl.Get("possessed").Equals(novo) && verdadeiro(pl.Get("isPossessing")))
	assinar(ch.Invoke("onJumped", func(args []helix.Value) { info("%s pulou", nomeDe(arg(args, 0).Get("entity"))) }))
	assinar(pl.Invoke("onPossessed", func(args []helix.Value) { info("Possuindo %s", nomeDe(arg(args, 0))) }))
	checar("character.all", ch.Invoke("all").Len() >= 1)
	checar("player.spawnPoint", !pl.Get("spawnPoint").IsNone())
	checar("character.velocity", !c.Get("velocity").IsNone() && !c.Get("position").IsNone())
	return helix.Undefined()
}

func terreno() helix.Value {
	te := api("terrain")
	checar("terrain.presets", te.Invoke("presets").Len() > 0)
	colinas := te.Invoke("spawn", opts{"name": "Colinas", "size": 48, "resolution": 65, "preset": "hills", "seed": 7, "position": v3(0, -6, -70)})
	checar("terrain.spawn", !colinas.Get("terrain").IsNone() && te.Invoke("all").Len() >= 1)
	checar("terrain.of", numero(te.Invoke("of", colinas), "resolution") == 65)
	checar("heightAt", te.Invoke("heightAt", v3(0, 0, -70), colinas).IsNumber())
	checar("contains", te.Invoke("contains", v3(0, 0, -70), colinas).Bool() && !te.Invoke("contains", v3(500, 0, 0), colinas).Bool())
	te.Invoke("sculpt", colinas, "raise", v3(5, 0, -70), opts{"radius": 6, "strength": 1}, 1)
	te.Invoke("markDirty", colinas)
	grama := te.Get("grass")
	grama.Invoke("set", colinas, opts{"enabled": true, "density": 0.5})
	checar("grass.set", verdadeiro(grama.Invoke("settingsOf", colinas).Get("enabled")))
	agua := te.Get("water")
	agua.Invoke("set", colinas, opts{"enabled": true, "level": -2})
	checar("water.set", verdadeiro(agua.Invoke("settingsOf", colinas).Get("enabled")))
	checar("terrain.raycast", !te.Invoke("raycast", v3(0, 50, -70), v3(0, -1, 0), colinas).IsNone())
	return helix.Undefined()
}

                                                                                           

func soltarCaixa() {
	random := api("math.random")
	caixa := api("scene").Invoke("spawnPrimitive", "box", opts{
		"name":      "CaixaSolta",
		"position":  v3(random.Invoke("range", -3, 3).Number(), 6, random.Invoke("range", 0, 4).Number()),
		"rigidBody": opts{"type": "dynamic", "collider": "box", "mass": 1},
		"tags":      []string{"caixa"},
	})
	api("material").Invoke("setColor", caixa, random.Invoke("color"))
	pontos++
	api("gui").Invoke("bind", "pontos", pontos)
	api("events").Invoke("emit", "debug.caixa", opts{"nome": caixa.Get("name")})
}

func interfaceGrafica() helix.Value {
	g := api("gui")
	g.Invoke("css", "DebugEstilo")
	hud := g.Invoke("html", "DebugHud", opts{"id": "debug-hud"})
	checar("gui.html", !hud.IsNone() && !g.Invoke("element", "#debug-hud").IsNone())
	icone := g.Invoke("svg", "DebugIcone", opts{"id": "debug-icone"})
	checar("gui.svg", !icone.IsNone())
	slot := g.Invoke("element", "[data-slot=icone]")
	if !slot.IsNone() && !icone.IsNone() {
		slot.Invoke("appendChild", icone)
	}
	checar("gui.bind", g.Invoke("bind", "linguagem", linguagem).Number() >= 1)
	g.Invoke("bind", "titulo", "Helix · Debug")
	assinar(g.Invoke("onAction", "caixa", func() { soltarCaixa() }))
	assinar(g.Invoke("onAction", "reiniciar", func() { api("play").Invoke("restart") }))
	checar("gui.elements", g.Invoke("elements", "[data-bind]").Len() >= 5)
	checar("gui.size", numero(g.Get("size"), "width") > 0)
	escala := func(scale, offset float64) opts { return opts{"scale": scale, "offset": offset} }
	declarativa := g.Invoke("create", "DebugTela", opts{"referenceSize": opts{"x": 1280, "y": 720}})
	painel := g.Invoke("add", declarativa, "frame", opts{
		"name": "Painel",
		"rect": opts{
			"position": opts{"x": escala(1, -236), "y": escala(0, 16)},
			"size":     opts{"x": escala(0, 220), "y": escala(0, 48)},
		},
	})
	g.Invoke("add", declarativa, "text", opts{"name": "Rotulo", "text": "Tela declarativa OK"}, painel.Path("node.id"))
	checar("gui.add/find", textoIgual(g.Invoke("find", declarativa, "Rotulo").Get("kind"), "text"))
	g.Invoke("setText", declarativa, "Rotulo", "Tela declarativa OK · "+linguagem)
	                                                                                   
	return g.Invoke("show", declarativa, "debug-tela").Invoke("then", func(args []helix.Value) {
		g := api("gui")
		tela = arg(args, 0)
		checar("gui.show/isShown", !tela.IsNone() && g.Invoke("isShown", tela).Bool())
		checar("gui.kinds", contem(g.Invoke("kinds"), "button"))
	})
}

func audio() helix.Value {
	a, s := api("audio"), api("scene")
	checar("audio.supported", a.Get("supported").IsBool())
	mixer := a.Get("mixer")
	mixer.Invoke("setVolumeDb", "sfx", -3)
	checar("mixer.setVolumeDb", numero(mixer.Invoke("bus", "sfx"), "volumeDb") == -3)
	checar("audio.clips", a.Invoke("clips").IsArray())
	fonte := s.Invoke("spawn", "sound", opts{"name": "FonteSonora", "position": v3(3, 1, 3), "audioSource": opts{"trigger": "manual", "spatial": true}})
	checar("spawn sound", !fonte.Get("audioSource").IsNone())
	fontes := a.Get("sources")
	fontes.Invoke("set", fonte, opts{"volumeDb": -4})
	checar("sources.set", numero(fonte.Get("audioSource"), "volumeDb") == -4)
	checar("sources.isPlaying", falso(fontes.Invoke("isPlaying", fonte)))
	return helix.Undefined()
}

func vfx() helix.Value {
	v := api("vfx")
	ids := v.Get("templates").Invoke("ids")
	checar("vfx.templates", ids.Len() > 0)
	checar("vfx.moduleKinds", v.Invoke("moduleKinds").Len() > 0)
	doc := v.Invoke("fromTemplate", ids.At(0), "DebugFaiscas")
	doc = v.Invoke("addEmitter", doc, opts{"name": "Extra", "maxParticles": 50})
	doc = v.Invoke("set", doc, opts{"loop": true})
	checar("vfx.fromTemplate/addEmitter", doc.Get("emitters").Len() >= 2 && verdadeiro(doc.Get("loop")))
	return v.Invoke("save", doc, "DebugFaiscas").Invoke("then", func(args []helix.Value) {
		v := api("vfx")
		ativo := arg(args, 0)
		checar("vfx.save", !ativo.IsNone() && textoIgual(ativo.Get("kind"), "vfx"))
		ator := v.Invoke("emitAt", ativo, v3(0, 1.5, -8), opts{"destroyWhenFinished": false})
		checar("vfx.emitAt", verdadeiro(v.Invoke("has", ator)))
		v.Invoke("burst", ator, 20)
		checar("vfx.stats", v.Invoke("stats").Get("effects").IsNumber())
	})
}

                                                                                          

func aoTeclar(e helix.Value) {
	if e.Get("repeat").Bool() {
		return
	}
	switch e.Get("code").String() {
	case "KeyR":
		api("play").Invoke("restart")
	case "KeyB":
		soltarCaixa()
	case "KeyE":
		api("events").Invoke("emit", "debug.ping", opts{"origem": "teclado", "quadro": api("time").Get("frame")})
	case "KeyF":
		api("camera").Invoke("shake", 0.4, 0.6)
	case "KeyG":
		if !efeito.IsUndefined() {
			ligado := !efeito.Get("enabled").Bool()
			efeito.Set("enabled", ligado)
			if ligado {
				info("Efeito DebugPost ligado")
			} else {
				info("Efeito DebugPost desligado")
			}
		}
	case "KeyT":
		tm := api("time")
		if numero(tm, "scale") == 1 {
			tm.Set("scale", 0.3)
		} else {
			tm.Set("scale", 1)
		}
		info("time.scale = %g", numero(tm, "scale"))
	case "KeyH":
		if !tela.IsUndefined() {
			g := api("gui")
			if g.Invoke("isShown", tela).Bool() {
				g.Invoke("hide", tela)
			} else {
				g.Invoke("show", tela, "debug-tela")
			}
		}
	case "KeyL":
		var nomes []string
		for _, luz := range api("light").Invoke("all", opts{"local": true}).Slice() {
			nomes = append(nomes, nomeDe(luz.Get("entity")))
		}
		info("Luzes locais: %s", strings.Join(nomes, ", "))
	}
}

func cliqueNaCena(x, y float64) {
	c := api("camera")
	alvo := c.Invoke("pick", x, y)
	ponto := c.Invoke("pickPoint", x, y)
	if !alvo.IsNone() {
		info("Clique em %s", nomeDe(alvo))
	}
	if !ponto.IsNone() {
		api("debug").Invoke("sphere", ponto, 0.3, "#ff006e", 2)
	}
}

func entrada() helix.Value {
	in := api("input")
	acoes := in.Get("actions")
	acoes.Invoke("define", "pular", []string{"Space", "Gamepad:0"})
	acoes.Invoke("define", "soltar", []string{"KeyB"})
	checar("actions.define/bindings", acoes.Invoke("bindings", "pular").Len() >= 1)
	checar("action()", textoIgual(in.Invoke("action", "pular").Get("name"), "pular") && acoes.Invoke("down", "pular").IsBool())
	checar("isDown", falso(in.Invoke("isDown", "KeyW")))
	checar("pointer", in.Path("pointer.x").IsNumber())
	checar("gamepads", in.Invoke("gamepads").IsArray())
	checar("axis2d", in.Invoke("axis2d", opts{"up": "KeyW", "down": "KeyS", "left": "KeyA", "right": "KeyD"}).Get("x").IsNumber())
	teclas := in.Invoke("keysDown")
	checar("keysDown", teclas.IsObject() || teclas.IsArray())
	assinar(in.Invoke("onKeyDown", func(args []helix.Value) { aoTeclar(arg(args, 0)) }))
	assinar(in.Invoke("onPointerDown", func(args []helix.Value) {
		e := arg(args, 0)
		if numero(e, "button") == 0 {
			cliqueNaCena(numero(e, "x"), numero(e, "y"))
		}
	}))
	assinar(in.Invoke("onGamepadButtonDown", func(args []helix.Value) {
		e := arg(args, 0)
		info("Gamepad %g botão %g", numero(e, "pad"), numero(e, "button"))
	}))
	return helix.Undefined()
}

func eventos() helix.Value {
	ev, play := api("events"), api("play")
	                                                                                
	recebido := helix.Undefined()
	desligar := ev.Invoke("on", "debug.ping", func(args []helix.Value) { recebido = arg(args, 0) })
	checar("events.emit conta ouvintes", ev.Invoke("emit", "debug.ping", opts{"origem": "teste"}).Number() == 1)
	checar("events.on recebe", !recebido.IsUndefined() && textoIgual(recebido.Get("origem"), "teste"))
	checar("listenerCount", ev.Invoke("listenerCount", "debug.ping").Number() == 1)
	desligar.Call()
	checar("unsubscribe", ev.Invoke("listenerCount", "debug.ping").Number() == 0)
	umaVez := 0
	ev.Invoke("once", "debug.once", func() { umaVez++ })
	ev.Invoke("emit", "debug.once")
	ev.Invoke("emit", "debug.once")
	checar("events.once", umaVez == 1)
	assinar(ev.Invoke("on", "debug.ping", func(args []helix.Value) { info("ping de %v", arg(args, 0).Get("origem")) }))
	assinar(ev.Invoke("on", "debug.caixa", func(args []helix.Value) { depurar("caixa %v", arg(args, 0).Get("nome")) }))
	doAtor := 0
	assinar(ev.Invoke("onEntity", torus, "toque", func() { doAtor++ }))
	ev.Invoke("emitEntity", torus, "toque")
	checar("onEntity/emitEntity", doAtor == 1)
	assinar(play.Invoke("onStopped", func() { info("play.onStopped disparou") }))
	assinar(play.Invoke("onPaused", func() { info("pausado") }))
	assinar(play.Invoke("onResumed", func() { info("retomado") }))
	return helix.Undefined()
}

                                                                                 
func tempo() helix.Value {
	tm := api("time")
	checar("time.now", numero(tm, "now") >= 0 && numero(tm, "frame") >= 0)
	checar("time.delta", numero(tm, "delta") >= 0 && numero(tm, "fixedDelta") > 0)
	inicio := numero(tm, "now")
	return tm.Invoke("wait", 0.1).Invoke("then", func(args []helix.Value) helix.Value {
		tm := api("time")
		decorrido := numero(tm, "now") - inicio
		checarf("time.wait", decorrido >= 0.09, "%.3f", decorrido)
		quadro := tm.Get("frame").Int()
		return tm.Invoke("waitFrames", 2).Invoke("then", func(args []helix.Value) helix.Value {
			tm := api("time")
			agora := tm.Get("frame").Int()
			checarf("time.waitFrames", agora >= quadro+2, "%d", agora-quadro)
			assinar(tm.Invoke("every", 2, func() { api("gui").Invoke("bind", "atores", api("scene").Invoke("count")) }))
			disparou := false
			tm.Invoke("delay", 0.2, func() { disparou = true })
			return tm.Invoke("wait", 0.3).Invoke("then", func(args []helix.Value) { checar("time.delay", disparou) })
		})
	})
}

func dados() helix.Value {
	return api("storage").Invoke("ready").Invoke("then", func(args []helix.Value) helix.Value {
		st := api("storage")
		atual := st.Invoke("get", "execucoes", 0)
		execucoes := 1
		if atual.IsNumber() {
			execucoes = atual.Int() + 1
		}
		return st.Invoke("set", "execucoes", execucoes).Invoke("then", func(args []helix.Value) helix.Value {
			st := api("storage")
			checarf("storage.get/set", st.Invoke("get", "execucoes").Int() == execucoes && st.Invoke("has", "execucoes").Bool(), "%d", execucoes)
			info("Execução nº %d deste jogo de teste neste projeto.", execucoes)
			return api("assets").Invoke("data", "DebugConfig").Invoke("then", func(args []helix.Value) helix.Value {
				cfg := arg(args, 0)
				checar("assets.data (TOML)", !cfg.IsNone() && !cfg.Get("jogador").IsNone() && numero(cfg.Get("jogador"), "velocidade") == 6.5)
				return api("assets").Invoke("text", "DebugConfig").Invoke("then", func(args []helix.Value) {
					checar("assets.text", strings.Contains(arg(args, 0).String(), "velocidade"))
					ativos := api("assets")
					checar("assets.byName", !ativos.Invoke("byName", "DebugJogo", "script").IsNone())
					checar("assets.exists", ativos.Invoke("exists", "DebugUtil").Bool() && !ativos.Invoke("exists", "NaoExiste").Bool())
					checar("assets.search", ativos.Invoke("search", "Debug").Len() >= 5)
					checar("project.name", api("project").Get("name").IsString())
					checar("project.stats", numero(api("project").Get("stats"), "entities") > 0)
					checar("net.localPlayer", verdadeiro(api("net").Path("localPlayer.local")))
					checar("play.state", textoIgual(api("play").Get("state"), "playing") && verdadeiro(api("play").Get("isRunning")))
				})
			})
		})
	})
}

                                                                                                
                                                      
func recuperar() (resultado helix.Value) {
	defer func() {
		if r := recover(); r != nil {
			checarf("recover captura o panic", strings.Contains(fmt.Sprint(r), "proposital"), "%v", r)
		}
	}()
	panic("panic proposital dentro da área, recuperado antes de chegar à engine")
}

                                                                                                  
func rejeitar() helix.Value {
	promessa := api("time").Invoke("wait", 0)
	return promessa.Get("constructor").Invoke("reject", "erro proposital: a rejeição vira ERRO na cadeia")
}

                                                                                           

type area struct {
	nome  string
	rodar func() helix.Value
	                                                                                          
	esperaErro bool
}

var areas = []area{
	{"Núcleo", nucleo, false},
	{"Módulo (Require)", modulo, false},
	{"Matemática", matematica, false},
	{"Cena", cena, false},
	{"Transformações", transformacao, false},
	{"Malhas e CSG", malhas, false},
	{"Materiais", materiais, false},
	{"Luzes", luzes, false},
	{"Céu e mundo", ceu, false},
	{"Câmera", camera, false},
	{"Pós-processamento", pos, false},
	{"Render", render, false},
	{"Física", fisica, false},
	{"Personagem e jogador", personagem, false},
	{"Terreno", terreno, false},
	{"Interface", interfaceGrafica, false},
	{"Áudio", audio, false},
	{"VFX", vfx, false},
	{"Entrada", entrada, false},
	{"Eventos", eventos, false},
	{"Tempo e tarefas", tempo, false},
	{"Dados, projeto e rede", dados, false},
	{"Panic recuperado (recover)", recuperar, false},
	{"Erro proposital (Promise.reject)", rejeitar, true},
}

func areaOk(a *area) {
	if a.esperaErro {
		checar("a rejeição deveria ter chegado à cadeia", false)
		return
	}
	depurar("ok %s", a.nome)
}

func areaErro(a *area, args []helix.Value) {
	causa := arg(args, 0)
	mensagem := causa.String()
	if causa.IsObject() {
		mensagem = causa.Get("message").String()
	}
	if a.esperaErro {
		checarf("a rejeição chega como erro da promessa", strings.Contains(mensagem, "proposital"), "%s", mensagem)
		return
	}
	falhas++
	erro("ERRO em %s: %s", a.nome, mensagem)
}

                                                                                               
func encadear(promessa helix.Value, a *area) helix.Value {
	depois := promessa.Invoke("then", func(args []helix.Value) helix.Value { return a.rodar() })
	return depois.Invoke("then", func(args []helix.Value) { areaOk(a) }, func(args []helix.Value) { areaErro(a, args) })
}

func finalizar() {
	girador := api("assets").Invoke("byName", "DebugGirador", "script")
	if !girador.IsNone() {
		extra := api("scene").Invoke("spawnPrimitive", "box", opts{
			"name":      "GiradorDinamico",
			"position":  v3(-2, 0.5, -3),
			"rigidBody": opts{"type": "kinematic", "collider": "box"},
			"script":    opts{"assetId": girador.Get("id"), "props": opts{"velocidade": 180, "cor": "#00b4d8"}},
		})
		checar("spawn com script", !extra.Get("script").IsNone() && extra.Path("script.assetId").Equals(girador.Get("id")))
	} else {
		checarf("ativo DebugGirador", false, "não está na biblioteca")
	}
	dica := "WASD anda, Espaço pula; B solta caixa, E emite evento, F treme a câmera, G alterna o efeito, T câmera lenta, H alterna a tela, L lista luzes, R reinicia."
	if falhas == 0 {
		info("API percorrida em %s: %d checagens, nenhuma falha. %s", linguagem, checagens, dica)
	} else {
		aviso("API percorrida em %s: %d checagens, %d falhas (veja FALHOU/ERRO acima). %s", linguagem, checagens, falhas, dica)
	}
	api("gui").Invoke("bind", "checagens", checagens)
	api("gui").Invoke("bind", "falhas", falhas)
}

                                                                                          

                       
func onLoad() {
	info("onLoad do script de entrada")
}

                        
func onStart() {
	info("Jogo de teste em %s: percorrendo a API…", linguagem)
	promessa := api("time").Invoke("wait", 0)
	for i := range areas {
		promessa = encadear(promessa, &areas[i])
	}
	promessa.Invoke("then", func() { finalizar() })
}

                         
func onUpdate(dt float64) {
	quadros++
	if !torus.IsUndefined() {
		api("transform").Invoke("rotate", torus, v3(0, 40*dt, 0))
	}
	d := api("debug")
	d.Invoke("line", v3(-6, 0.05, -6), v3(6, 0.05, -6), "#ff006e")
	d.Invoke("box", opts{"center": v3(0, 1, 3), "size": v3(3, 2, 3)}, "#ffbe0b")
	if !heroi.IsUndefined() {
		d.Invoke("axes", heroi, 1)
		acima := api("math.vec3").Invoke("add", api("transform").Invoke("worldPosition", heroi), v3(0, 2.2, 0))
		d.Invoke("text", acima, fmt.Sprintf("Heroi · %d pts", pontos), "#ffffff")
	}
	d.Invoke("ray", v3(0, 3, 0), v3(0, -1, 0), 3, "#06d6a0")
	hudTimer += dt
	if hudTimer >= 0.5 {
		hudTimer = 0
		g := api("gui")
		g.Invoke("bind", "fps", math.Round(numero(api("render").Get("stats"), "fps")))
		g.Invoke("bind", "checagens", checagens)
		g.Invoke("bind", "falhas", falhas)
	}
}

                               
func onFixedUpdate(h float64) {
	passosFisica++
	if passosFisica == 1 {
		checarf("onFixedUpdate recebe o passo", h > 0 && h < 1, "%g", h)
	}
}

                              
func onLateUpdate() {
	lateUpdates++
}

                                                                          
  
                                    
func onBeforeHotReload() float64 {
	return float64(pontos)
}

                             
func onHotReload(anterior float64) {
	pontos = 0
	if anterior > 0 {
		pontos = int(anterior)
	}
	info("Recarga a quente: %d pontos preservados", pontos)
}

                       
func onStop() {
	for _, desligar := range assinaturas {
		desligar.Call()
	}
	assinaturas = nil
	info("Parou: %d quadros, %d passos de física, %d lateUpdates, %d frames (onAfterFrame), %d colisões.", quadros, passosFisica, lateUpdates, renders, colisoes)
	torus, heroi, efeito, tela = helix.Undefined(), helix.Undefined(), helix.Undefined(), helix.Undefined()
}

func main() {}
`;
    const actor = String.raw `                                 
                                                                                              
                                                                                                     
package main

import (
	"fmt"
	"math"

	"helix"
)

                                                                                        
var (
	angulo            float64
	contatos, quadros int
	desligar          helix.Value
)

type opts = map[string]any

func registrar(metodo, mensagem string) {
	helix.Root().Get("log").Invoke(metodo, "Girador", mensagem)
}

func nomeDe(entidade helix.Value) string { return entidade.Get("name").String() }

                       
func onLoad() {
	helix.Root().Get("props").Invoke("define", opts{
		"velocidade": opts{"type": "range", "default": 90, "min": 0, "max": 360, "step": 1, "label": "Velocidade (°/s)"},
		"cor":        opts{"type": "color", "default": "#ff8800", "label": "Cor"},
		"pulsar":     opts{"type": "boolean", "default": true, "label": "Pulsar"},
	})
}

                        
func onStart() {
	props, ator, lg := helix.Root().Get("props"), helix.Self(), helix.Root().Get("log")
	registrar("info", fmt.Sprintf("%s acordou com velocidade %v°/s", nomeDe(ator), props.Invoke("get", "velocidade")))
	helix.Root().Get("material").Invoke("setColor", ator, props.Invoke("get", "cor"))
	desligar = props.Invoke("onChanged", "cor", func(args []helix.Value) {
		if len(args) > 0 {
			helix.Root().Get("material").Invoke("setColor", helix.Self(), args[0])
		}
	})
	proprio := helix.Root().Get("self")
	lg.Invoke("assert", !proprio.IsNone() && proprio.Equals(ator), "helix.self deveria ser o ator deste script")
	lg.Invoke("assert", props.Invoke("has", "velocidade").Bool() && props.Invoke("definitions").Len() == 3, "props.define deveria registrar 3 propriedades")
}

                         
func onUpdate(dt float64) {
	props, tr := helix.Root().Get("props"), helix.Root().Get("transform")
	quadros++
	angulo += props.Invoke("get", "velocidade").Number() * dt
	tr.Invoke("setRotation", helix.Self(), helix.V3(0, angulo, 0))
	if props.Invoke("get", "pulsar").Bool() {
		tr.Invoke("setScale", helix.Self(), 1+math.Sin(helix.Root().Path("time.now").Number()*3)*0.1)
	}
}

                                  
func onCollisionBegin(outro, contato uint32) {
	contatos++
	if contatos > 3 {
		return
	}
	o, c := helix.Wrap(outro), helix.Wrap(contato)
	registrar("info", fmt.Sprintf("%s tocou %s (impulso %.2f)", nomeDe(helix.Self()), nomeDe(o), c.Get("impulse").Number()))
}

                                
func onTriggerEnter(outro uint32) {
	registrar("info", fmt.Sprintf("%s entrou no gatilho de %s", nomeDe(helix.Wrap(outro)), nomeDe(helix.Self())))
}

                         
func onEnable() {
	registrar("debug", fmt.Sprintf("%s ativo", nomeDe(helix.Self())))
}

                          
func onDisable() {
	registrar("debug", fmt.Sprintf("%s inativo", nomeDe(helix.Self())))
}

                       
func onStop() {
	registrar("info", fmt.Sprintf("%s: %d quadros, %d contatos", nomeDe(helix.Self()), quadros, contatos))
}

                          
func onDestroy() {
	if desligar.IsFunction() {
		desligar.Call()
	}
	desligar = helix.Undefined()
}

func main() {}
`;
    const module = String.raw `                                     
                                                                                                        
                                                                                                 
package main

import "helix"

                    
func soma(a, b float64) float64 {
	return a + b
}

                        
func saudacao(quem uint32) uint32 {
	return helix.From("Olá, " + helix.Wrap(quem).String()).Handle()
}

                       
func limitar(valor, minimo, maximo float64) float64 {
	if valor > maximo {
		return maximo
	}
	if valor < minimo {
		return minimo
	}
	return valor
}

func main() {}
`;
    return { entry, actor, module };
}
