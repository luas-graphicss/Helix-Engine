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
`;
}
