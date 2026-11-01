import type { GameSources } from '../types';
export function haxeGame(): GameSources {
    const entry = String.raw `                                    
                                                                                     
                                                                                        
                                                        
import helix.Helix;
import helix.Script;
import helix.Vec3;

typedef Area = {
	nome:String,
	rodar:Void->Dynamic,
	                                                                                         
	esperaErro:Bool
}

class DebugJogo extends Script {
	static inline var LINGUAGEM = "Haxe";

	var quadros = 0;
	var passosFisica = 0;
	var lateUpdates = 0;
	var renders = 0;
	var colisoes = 0;
	var checagens = 0;
	var falhas = 0;
	var pontos = 0;
	var hudTimer = 0.0;
	                                                                       
	var torus:Dynamic = null;
	var heroi:Dynamic = null;
	var efeito:Dynamic = null;
	var tela:Dynamic = null;
	var assinaturas:Array<Dynamic> = [];

	                                                                                          

	inline function v3(x:Float, y:Float, z:Float):Vec3 {
		return new Vec3(x, y, z);
	}

	function registrar(metodo:String, mensagem:String):Void {
		Reflect.callMethod(helix.log, Reflect.field(helix.log, metodo), ["Debug", mensagem]);
	}

	function info(mensagem:String):Void registrar("info", mensagem);

	function aviso(mensagem:String):Void registrar("warn", mensagem);

	function erro(mensagem:String):Void registrar("error", mensagem);

	function depurar(mensagem:String):Void registrar("debug", mensagem);

	function checar(nome:String, condicao:Bool, ?detalhe:Dynamic):Void {
		checagens++;
		if (condicao) return;
		falhas++;
		erro(detalhe == null ? "FALHOU " + nome : "FALHOU " + nome + ": " + Std.string(detalhe));
	}

	function assinar(desligar:Dynamic):Void {
		if (ehFuncao(desligar)) assinaturas.push(desligar);
	}

	static inline function ehNumero(v:Dynamic):Bool return js.Syntax.typeof(v) == "number";

	static inline function ehTexto(v:Dynamic):Bool return js.Syntax.typeof(v) == "string";

	static inline function ehBool(v:Dynamic):Bool return js.Syntax.typeof(v) == "boolean";

	static inline function ehFuncao(v:Dynamic):Bool return js.Syntax.typeof(v) == "function";

	static inline function ehLista(v:Dynamic):Bool return js.Syntax.code("Array.isArray({0})", v);

	static inline function ehObjeto(v:Dynamic):Bool return v != null && js.Syntax.typeof(v) == "object";

	static inline function aprox(a:Float, b:Float, epsilon:Float):Bool return Math.abs(a - b) <= epsilon;

	static function arred(x:Float):Float return Math.round(x * 100) / 100;

	                                                                                         
	function eq3(vetor:Dynamic, x:Float, y:Float, z:Float, epsilon:Float):Bool {
		return helix.math.vec3.equals(vetor, v3(x, y, z), epsilon) == true;
	}

	function comprimento(vetor:Dynamic):Float return helix.math.vec3.length(vetor);

	static function contem(lista:Dynamic, texto:String):Bool {
		var itens:Array<Dynamic> = lista;
		return itens.indexOf(texto) >= 0;
	}

	static function nomeDe(entidade:Dynamic):String {
		return entidade == null ? "ninguém" : entidade.name;
	}

	                                                                                           

	function nucleo():Dynamic {
		var engine:Dynamic = helix.engine;
		var contexto:String = helix.context;
		checar("engine.name", ehTexto(engine.name) && engine.name != "");
		checar("engine.version", ehTexto(engine.version));
		checar("context", contexto == "shared" || contexto == "client" || contexto == "server", contexto);
		checar("isPlaying", helix.isPlaying == true);
		checar("isEditor", helix.isEditor == false);
		checar("self no script de entrada", self == null && helix.self == null);
		checar("script é o handle do script", ehObjeto(script));
		checar("Helix.now", Helix.now >= 0);
		info(engine.name + " " + engine.version + " · API " + engine.apiVersion + " · " + LINGUAGEM);
		Helix.log("Helix.log direto do Haxe (console da engine)");
		return null;
	}

	function modulo():Dynamic {
		var util = Helix.require("DebugUtil");
		checar("require devolve as funções", ehObjeto(util) && ehFuncao(util.soma));
		var resultado:Float = util.soma(2, 3);
		checar("require soma", resultado == 5, resultado);
		checar("require saudacao", util.saudacao("Helix") == "Olá, Helix");
		checar("require limitar", util.limitar(15, 0, 10) == 10);
		                                                                           
		checar("DebugUtil.soma direto", DebugUtil.soma(2, 3) == 5);
		return null;
	}

	function matematica():Dynamic {
		var m:Dynamic = helix.math;
		var vec:Dynamic = m.vec3, quat:Dynamic = m.quat, mat4:Dynamic = m.mat4, escalar:Dynamic = m.scalar;
		checar("vec3.add", eq3(vec.add(v3(1, 2, 3), v3(1, 1, 1)), 2, 3, 4, 1e-6));
		checar("vec3.length", aprox(vec.length(v3(3, 4, 0)), 5, 1e-3));
		checar("vec3.normalize", aprox(comprimento(vec.normalize(v3(0, 5, 0))), 1, 1e-3));
		checar("vec3.cross", eq3(vec.cross(v3(1, 0, 0), v3(0, 1, 0)), 0, 0, 1, 1e-6));
		checar("vec3.lerp", eq3(vec.lerp(v3(0, 0, 0), v3(2, 2, 2), 0.5), 1, 1, 1, 1e-6));
		var q:Dynamic = quat.fromEuler(v3(0, 90, 0));
		checar("quat.rotateVec3", eq3(quat.rotateVec3(q, v3(1, 0, 0)), 0, 0, -1, 1e-3));
		checar("quat.toEuler", aprox(quat.toEuler(q).y, 90, 0.01));
		var mat:Dynamic = mat4.fromTRS(v3(1, 2, 3), v3(0, 0, 0), v3(1, 1, 1));
		checar("mat4.transformPoint", eq3(mat4.transformPoint(mat, v3(0, 0, 0)), 1, 2, 3, 1e-6));
		checar("mat4.invert", mat4.invert(mat) != null);
		var aabb:Dynamic = m.aabb;
		var caixa:Dynamic = aabb.fromCenterSize(v3(0, 0, 0), v3(2, 2, 2));
		checar("aabb.contains", aabb.contains(caixa, v3(0.5, 0.5, 0.5)) == true && aabb.contains(caixa, v3(2, 0, 0)) == false);
		var ray:Dynamic = m.ray;
		var raio:Dynamic = ray.create(v3(0, 5, 0), v3(0, -1, 0));
		checar("ray.intersectAabb", ray.intersectAabb(raio, caixa) != null);
		checar("scalar.remap", escalar.remap(5, 0, 10, 0, 100) == 50);
		checar("clamp/lerp", m.clamp(15, 0, 10) == 10 && m.lerp(0, 10, 0.5) == 5);
		checar("scalar.wrapAngle", aprox(escalar.wrapAngle(370), 10, 1e-3));
		checar("degToRad", aprox(m.degToRad(180), Math.PI, 1e-6));
		var ruido:Dynamic = m.noise;
		var perlin:Float = ruido.perlin2(0.3, 0.7);
		checar("noise.perlin2", perlin >= -1.01 && perlin <= 1.01, perlin);
		checar("noise.fbm", ehNumero(ruido.fbm(1.5, 2.5, 0, 4)));
		var cor:Dynamic = m.color;
		checar("color.hexToVec3", eq3(cor.hexToVec3("#ff0000"), 1, 0, 0, 0.01));
		var hex:String = cor.vec3ToHex(v3(1, 1, 1));
		checar("color.vec3ToHex", hex.toLowerCase() == "#ffffff", hex);
		var random:Dynamic = m.random;
		random.seed(42);
		var primeiro:Float = random.value();
		random.seed(42);
		checar("random.seed determinístico", random.value() == primeiro);
		var sorteado:Float = random.int(1, 6);
		checar("random.int", sorteado >= 1 && sorteado <= 6 && Math.floor(sorteado) == sorteado);
		checar("random.unitVector", aprox(comprimento(random.unitVector()), 1, 1e-3));
		checar("PI/TAU", aprox(m.TAU, m.PI * 2, 1e-9));
		return null;
	}

	                                                                                            

	function cena():Dynamic {
		var s:Dynamic = helix.scene, mat:Dynamic = helix.material;
		var raiz:Dynamic = s.root;
		checar("scene.root", raiz != null && ehLista(raiz.children));
		var antes:Float = s.count();
		var grupo:Dynamic = s.spawn("group", {name: "DebugCenario"});
		var chao:Dynamic = s.spawn("mesh", {
			name: "Chao",
			mesh: helix.mesh.plane(40, 40),
			material: mat.create({baseColor: "#4b6b3a", roughness: 0.95}),
			rigidBody: {type: "static", collider: "box", boxSize: v3(40, 0.2, 40), center: v3(0, -0.1, 0)},
			receiveShadows: true,
			tags: ["chao"]
		}, grupo);
		checar("spawn mesh", chao.kind == "mesh" && chao.mesh != null && chao.rigidBody != null);
		checar("find", s.find("Chao") == chao);
		checar("findAll", s.findAll("Chao").length == 1);
		checar("byId", s.byId(chao.id) == chao);
		checar("byTag", s.byTag("chao").length >= 1);
		checar("byKind", s.byKind("mesh").length >= 1);
		var depois:Float = s.count();
		checar("count", depois == antes + 2, depois + " vs " + (antes + 2));
		checar("contains", s.contains(grupo, chao) == true && s.contains(raiz, chao) == true);
		var caminho:String = s.path(chao);
		checar("path", caminho.indexOf("Chao") >= 0, caminho);
		var visitados = 0;
		s.traverse(function(_) visitados++, grupo);
		checar("traverse", visitados >= 2, visitados);

		var anel:Dynamic = s.spawnPrimitive("torus", {name: "Anel", position: v3(-4, 1.2, -2), scale: 1.5}, grupo);
		mat.setColor(anel, "#3a86ff");
		mat.setEmissive(anel, "#3a86ff", 0.6);
		torus = anel;
		checar("spawnPrimitive", anel.mesh != null && anel.material != null);

		var copia:Dynamic = s.clone(anel, true, grupo);
		s.rename(copia, "AnelCopia");
		helix.transform.setPosition(copia, v3(-4, 1.2, 2));
		checar("clone + rename", copia.name == "AnelCopia" && s.find("AnelCopia") == copia);
		s.setMeta(copia, "origem", "clone");
		checar("meta", s.getMeta(copia, "origem") == "clone");
		s.addTag(copia, "temporario");
		checar("addTag/hasTag", s.hasTag(copia, "temporario") == true);
		checar("removeTag", s.removeTag(copia, "temporario") == true && s.hasTag(copia, "temporario") == false);
		s.setVisible(copia, false);
		checar("setVisible", copia.visible == false);
		s.setVisible(copia, true);
		s.destroy(copia);
		checar("destroy", s.find("AnelCopia") == null && s.isAttached(copia) == false);

		var esfera:Dynamic = s.spawnPrimitive("sphere", {name: "Esfera", position: v3(4, 0.5, -3)});
		s.reparent(esfera, grupo);
		checar("reparent", esfera.parent == grupo);
		mat.setColor(esfera, "#ffbe0b");
		s.addComponent(esfera, "rigidBody", {type: "dynamic", collider: "sphere", radius: 0.5, mass: 1});
		checar("addComponent", esfera.rigidBody != null && esfera.rigidBody.type == "dynamic");
		var temporario:Dynamic = s.spawnPrimitive("box", {name: "Temporario"});
		s.addComponent(temporario, "csg", {});
		checar("addComponent csg", temporario.csg != null);
		s.removeComponent(temporario, "csg");
		checar("removeComponent", temporario.csg == null);
		s.destroy(temporario);
		checar("kinds/components", contem(s.kinds(), "mesh") && contem(s.components(), "rigidBody"));
		return null;
	}

	function transformacao():Dynamic {
		var tr:Dynamic = helix.transform, s:Dynamic = helix.scene;
		var alvo:Dynamic = s.spawnPrimitive("cone", {name: "Cone", position: v3(0, 0.5, -6)});
		helix.material.setColor(alvo, "#8338ec");
		tr.setPosition(alvo, v3(2, 0.5, -6));
		checar("setPosition", eq3(tr.position(alvo), 2, 0.5, -6, 1e-6));
		tr.translate(alvo, v3(0, 1, 0), "world");
		checar("translate", aprox(tr.position(alvo).y, 1.5, 1e-3));
		tr.setRotation(alvo, v3(0, 90, 0));
		checar("setRotation", aprox(tr.rotation(alvo).y, 90, 0.01));
		tr.rotate(alvo, v3(0, 45, 0));
		var girado:Float = helix.math.scalar.wrapAngle(tr.rotation(alvo).y);
		checar("rotate", aprox(girado, 135, 0.01) || aprox(girado, -225, 0.01), girado);
		tr.setScale(alvo, 2);
		checar("setScale", aprox(tr.scale(alvo).x, 2, 1e-6));
		tr.setScale(alvo, v3(1, 1, 1));
		var mundo:Dynamic = tr.worldPosition(alvo);
		checar("worldPosition", eq3(tr.position(alvo), mundo.x, mundo.y, mundo.z, 1e-3));
		checar("forward/up", aprox(comprimento(tr.forward(alvo)), 1, 1e-3) && aprox(comprimento(tr.up(alvo)), 1, 1e-3));
		tr.lookAt(alvo, v3(0, 1.5, 0));
		checar("distance", tr.distance(alvo, v3(2, 1.5, -6)) < 0.01);
		checar("directionTo", aprox(comprimento(tr.directionTo(alvo, v3(0, 1.5, 0))), 1, 1e-3));
		var limites:Dynamic = tr.bounds(alvo);
		checar("bounds", limites != null && limites.max.y > limites.min.y);
		checar("worldMatrix", tr.worldMatrix(alvo).length == 16 && tr.localMatrix(alvo).length == 16);
		var local:Dynamic = tr.worldToLocal(alvo, tr.localToWorld(alvo, v3(1, 0, 0)));
		checar("localToWorld/worldToLocal", eq3(local, 1, 0, 0, 1e-3));
		return null;
	}

	function malhas():Dynamic {
		var me:Dynamic = helix.mesh, s:Dynamic = helix.scene, csg:Dynamic = helix.csg, mat:Dynamic = helix.material;
		var caixa:Dynamic = me.box(1, 1, 1);
		var triangulos:Float = me.triangleCount(caixa);
		checar("mesh.box", me.vertexCount(caixa) > 0 && triangulos == 12, triangulos);
		var esfera:Dynamic = me.sphere(0.65, 16, 12);
		var furado:Dynamic = csg.boolean(caixa, esfera, "subtract");
		checar("csg.boolean", me.triangleCount(furado) > 12);
		var ator:Dynamic = s.spawn("mesh", {
			name: "CaixaFurada",
			mesh: furado,
			material: mat.create({baseColor: "#e63946", roughness: 0.4, metallic: 0.2}),
			position: v3(4, 0.5, 2)
		});
`;
}
