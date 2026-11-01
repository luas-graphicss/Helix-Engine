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
		checar("spawn malha CSG", ator.mesh != null);
		checar("csg.operations", contem(csg.operations(), "union"));
		var tri:Dynamic = me.create({
			name: "Triangulo",
			positions: [-1, 0, 0, 1, 0, 0, 0, 1.5, 0],
			uvs: [0, 0, 1, 0, 0.5, 1],
			indices: [0, 1, 2]
		});
		me.computeNormals(tri);
		checar("mesh.create + computeBounds", me.computeBounds(tri).max.y >= 1.5);
		var dupla:Dynamic = me.merge(tri, me.flipWinding(me.clone(tri)));
		checar("mesh.merge", me.triangleCount(dupla) == 2);
		s.spawn("mesh", {
			name: "Triangulo",
			mesh: dupla,
			material: mat.create({baseColor: "#06d6a0", doubleSided: true}),
			position: v3(7, 0, -2)
		});
		var grande:Dynamic = me.scale(me.translate(me.clone(caixa), v3(0, 0.5, 0)), 2);
		checar("mesh.translate/scale", me.computeBounds(grande).max.y > 1.9);
		var distancia:Dynamic = me.raycast(helix.math.ray.create(v3(0, 5, 0), v3(0, -1, 0)), grande);
		checar("mesh.raycast", ehNumero(distancia) && distancia > 0);
		var vertices:Int = me.vertexCount(caixa);
		checar("positions/indices", me.positions(caixa).length == vertices * 3 && me.indices(caixa).length == 36);
		checar("primitivas extras", me.triangleCount(me.torusKnot()) > 0 && me.triangleCount(me.capsule()) > 0);
		return null;
	}

	                                                                                              

	function materiais():Dynamic {
		var mat:Dynamic = helix.material, s:Dynamic = helix.scene, tex:Dynamic = helix.texture;
		var base:Dynamic = mat.create({name: "DebugBase", baseColor: "#d98c2b", roughness: 0.5, metallic: 0.1});
		checar("material.create", base.roughness == 0.5);
		var copia:Dynamic = mat.clone(base);
		mat.set(copia, {roughness: 1, emissive: "#ffffff", emissiveIntensity: 2});
		checar("material.clone/set", copia.roughness == 1 && base.roughness == 0.5);
		var caixa:Dynamic = s.spawnPrimitive("box", {name: "CaixaPintada", position: v3(-7, 0.5, 2)});
		mat.assign(caixa, base);
		checar("material.assign/of", mat.of(caixa) != null);
		mat.own(caixa);
		mat.setColor(caixa, "#d98c2b");
		var desenho:Dynamic = tex.canvas(64, 64);
		desenho.update();
		mat.setTexture(caixa, "baseColorMap", desenho.texture);
		checar("texture.canvas + setTexture", mat.hasAnyTexture(mat.of(caixa)) == true && tex.isTexture(desenho.texture) == true);
		checar("material.slots", mat.slots().length > 0);
		checar("materials.list", ehLista(helix.materials.list()));
		var sombreado:Dynamic = mat.fromShader("DebugSuperficie", {glow: v3(1, 0.45, 0.1), speed: 2});
		checar("material.fromShader", sombreado != null);
		if (sombreado != null) {
			var esfera:Dynamic = s.spawnPrimitive("sphere", {name: "EsferaShader", position: v3(0, 1, -3), scale: 1.4});
			mat.assign(esfera, sombreado);
			mat.uniforms(esfera).set("speed", 3);
			checar("material.uniforms.list", mat.uniforms(esfera).list().length >= 1);
		}
		return null;
	}

	function luzes():Dynamic {
		var l:Dynamic = helix.light;
		checar("light.types", contem(l.types(), "point") && contem(l.localTypes(), "spot"));
		var lampada:Dynamic = l.spawn("point", {name: "Lampada", position: v3(0, 3, 0), color: "#ffd166", intensity: 60, range: 14});
		checar("light.spawn", lampada.light != null && lampada.light.type == "point");
		l.set(lampada, {intensity: 80});
		checar("light.set", lampada.light.intensity == 80);
		l.setTemperature(lampada, 3200);
		checar("setTemperature", lampada.light.temperature == 3200);
		var foco:Dynamic = l.spawn("spot", {
			name: "Holofote", position: v3(4, 4, 0), rotation: v3(-90, 0, 0), intensity: 120, range: 16,
			innerAngle: 20, outerAngle: 35, color: "#ffffff"
		});
		checar("spot", foco.light.type == "spot");
		var convertido:Dynamic = l.convert(foco, "disc");
		checar("light.convert", convertido.type == "disc" && foco.light.type == "disc");
		l.convert(foco, "spot");
		var presets:Array<Dynamic> = l.presets();
		checar("light.presets", presets.length > 0);
		if (presets.length > 0) {
			var primeiro = presets[0];
			var preset:Dynamic = l.spawn(primeiro.id, {name: "LuzPreset", position: v3(-4, 2.5, 4)});
			checar("light.fromPreset", preset.light != null && l.fromPreset(primeiro.id).type == primeiro.type);
		}
		checar("light.all", l.all({local: true}).length >= 2);
		checar("effectiveRange", l.effectiveRange(lampada) > 0);
		checar("light.isLocal", l.isLocal(lampada) == true);
		checar("temperatureToColor", l.temperatureToColor(6500) != null);
		l.setColor(lampada, "#ffffff");
		checar("light.setColor", eq3(lampada.light.color, 1, 1, 1, 0.01));
		return null;
	}

	function ceu():Dynamic {
		var sky:Dynamic = helix.sky, mundo:Dynamic = helix.world;
		sky.set({timeOfDay: 10.5, haze: 0.3, clouds: {enabled: true, coverage: 0.45}});
		checar("sky.set", aprox(sky.timeOfDay, 10.5, 1e-3) && sky.clouds.enabled == true);
		checar("sky.isDay", sky.isDay == true);
		checar("sky.sunDirection", sky.sunDirection().y > 0);
		var hora:String = sky.formatTimeOfDay(10.5);
		checar("sky.formatTimeOfDay", hora.indexOf(":") >= 0, hora);
		checar("sky.wrapTimeOfDay", sky.wrapTimeOfDay(25) == 1);
		checar("sky.presets", sky.presets().length > 0);
		assinar(sky.onHourChanged(function(hora) info("Hora do céu: " + hora)));
		sky.cycleSpeed = 0;
		checar("sky.cycleSpeed", sky.cycleSpeed == 0);
		checar("world.gravity", mundo.gravity.y < 0);
		mundo.wind.set({speed: 2, direction: 45});
		checar("world.wind.set", mundo.wind.speed == 2);
		return null;
	}

	function camera():Dynamic {
		var c:Dynamic = helix.camera;
		checar("camera.fov", c.fov > 0 && c.aspect > 0);
		checar("camera.near/far", c.near > 0 && c.far > c.near);
		var viewport:Dynamic = c.viewport;
		checar("viewport", viewport.width > 0);
		var naTela:Dynamic = c.worldToScreen(v3(0, 0, 0));
		checar("worldToScreen", naTela == null || ehNumero(naTela.x));
		var raio:Dynamic = c.screenToRay(viewport.width / 2, viewport.height / 2);
		checar("screenToRay", raio == null || aprox(comprimento(raio.direction), 1, 0.01));
		checar("viewMatrix", c.viewMatrix.length == 16);
		var jogador:Dynamic = c.player;
		jogador.set({distance: 7, pitch: 18});
		checar("player.set", jogador.settings.distance == 7);
		checar("distanceTo", c.distanceTo(v3(0, 0, 0)) >= 0);
		checar("camera.position", c.position != null && c.forward != null);
		assinar(c.onMainChanged(function(entidade) info(entidade == null ? "Câmera principal: editor/jogador" : "Câmera principal: " + nomeDe(entidade))));
		return null;
	}

	function pos():Dynamic {
		var p:Dynamic = helix.post;
		checar("post.toneMappers", p.toneMappers().length > 0);
		p.set({
			bloom: {enabled: true, intensity: 0.5, threshold: 1, softKnee: 0.5, radius: 0.6},
			vignette: {enabled: true, intensity: 0.35, smoothness: 0.5, roundness: 1}
		});
		checar("post.set", p.bloom.enabled == true && p.vignette.enabled == true);
		p.exposure = 1.05;
		checar("post.exposure", aprox(p.exposure, 1.05, 1e-3));
		p.toneMapper = "agx";
		checar("post.toneMapper", p.toneMapper == "agx");
		checar("post.presets", p.presets().length > 0);
		var custom:Dynamic = p.custom;
		var novo:Dynamic = custom.add({fragment: "DebugPost", name: "DebugPost", uniforms: {tint: v3(0.15, 0.05, 0.3), strength: 0.6}});
		efeito = novo;
		checar("post.custom.add", novo != null && custom.get("DebugPost") != null);
		novo.uniforms.set("strength", 0.8);
		checar("efeito.uniforms.list", novo.uniforms.list().length >= 2);
		return null;
	}

	function render():Dynamic {
		var r:Dynamic = helix.render;
		checar("render.passNames", r.passNames().length > 0);
		checar("render.stats", ehNumero(r.stats.drawCalls));
		checar("render.frame", ehNumero(r.frame.width));
		assinar(r.onAfterFrame(function() renders++));
		r.showGrid = false;
		checar("render.showGrid", r.showGrid == false);
		checar("render.pixelRatio", r.pixelRatio > 0);
		return null;
	}

	                                                                                           

	function fisica():Dynamic {
		var ph:Dynamic = helix.physics, s:Dynamic = helix.scene;
		checar("physics.enabled", ph.enabled == true);
		checar("physics.gravity", ph.gravity.y < 0);
		checar("physics.settings", ph.settings.fixedTimestep > 0);
		for (i in 1...6) {
			var indice = i - 1;
			var caixa:Dynamic = s.spawnPrimitive("box", {
				name: "Caixa" + i,
				position: v3(-2 + indice * 1.1, 3 + indice * 1.2, 3),
				rigidBody: {type: "dynamic", collider: "box", mass: 2, restitution: 0.3},
				tags: ["caixa"]
			});
			helix.material.setColor(caixa, helix.math.color.hsl(30 + i * 12, 0.7, 0.5));
		}
		var caixas:Array<Dynamic> = s.byTag("caixa");
		var primeira = caixas[0];
		checar("caixas dinâmicas", caixas.length == 5 && ph.hasBody(primeira) == true);
		var corpo:Dynamic = ph.bodyOf(primeira);
		checar("bodyOf", corpo.isDynamic == true && corpo.mass > 0);
		corpo.applyImpulse(v3(0, 2, 0));
		corpo.applyTorque(v3(0, 1, 0));
		corpo.setMaterial({friction: 0.8});
		corpo.wake();
		checar("body.linearVelocity", corpo.linearVelocity != null);
		checar("bodies()", ph.bodies().length >= 6);
		var hit:Dynamic = ph.raycast(v3(0, 5, 0), v3(0, -1, 0), 20);
		checar("physics.raycast", hit != null && hit.entity != null);
		checar("raycastAll", ph.raycastAll(v3(0, 5, 0), v3(0, -1, 0), 20).length >= 1);
		checar("overlapSphere", ehLista(ph.overlapSphere(v3(0, 3, 3), 4)));
		checar("massProperties", ph.massProperties(primeira).mass > 0);
		checar("colliderVolume", ph.colliderVolume(primeira) > 0);
		var formas:Dynamic = ph.shapes;
		checar("shapes.sphere volume", aprox(formas.volume(formas.sphere(1)), 4.18879, 0.01));
		assinar(ph.onCollisionBegin(function(e) {
			colisoes++;
			if (colisoes > 3) return;
			info("Colisão: " + nomeDe(e.a) + " × " + nomeDe(e.b) + " (impulso " + arred(e.contact.impulse) + ")");
		}));
		assinar(ph.onOutOfBounds(function(entidade) aviso(nomeDe(entidade) + " caiu do mundo")));
		var gatilho:Dynamic = s.spawn("group", {name: "Gatilho", position: v3(0, 1, 3), trigger: {shape: "box", size: v3(3, 2, 3)}});
		checar("trigger spawn", gatilho != null && s.isAttached(gatilho) == true);
		checar("physics.stats", ehNumero(ph.stats.bodies));
		return null;
	}

	function personagem():Dynamic {
		var ch:Dynamic = helix.character, pl:Dynamic = helix.player;
		var novo:Dynamic = ch.spawn({name: "Heroi", position: v3(0, 1.2, 8), character: {walkSpeed: 4, runSpeed: 7, jumpHeight: 1.4}});
		heroi = novo;
		checar("character.spawn", novo.character != null && ch.has(novo) == true);
		var c:Dynamic = ch.of(novo);
		checar("character.of", ehBool(c.isGrounded));
		checar("settingsOf", ch.settingsOf(novo).walkSpeed == 4);
		pl.possess(novo);
		checar("player.possess", pl.possessed == novo && pl.isPossessing == true);
		assinar(ch.onJumped(function(e) info(nomeDe(e.entity) + " pulou")));
		assinar(pl.onPossessed(function(entidade) info("Possuindo " + nomeDe(entidade))));
		checar("character.all", ch.all().length >= 1);
		checar("player.spawnPoint", pl.spawnPoint != null);
		checar("character.velocity", c.velocity != null && c.position != null);
		return null;
	}

	function terreno():Dynamic {
		var te:Dynamic = helix.terrain;
		checar("terrain.presets", te.presets().length > 0);
		var colinas:Dynamic = te.spawn({name: "Colinas", size: 48, resolution: 65, preset: "hills", seed: 7, position: v3(0, -6, -70)});
		checar("terrain.spawn", colinas.terrain != null && te.all().length >= 1);
		checar("terrain.of", te.of(colinas).resolution == 65);
		checar("heightAt", ehNumero(te.heightAt(v3(0, 0, -70), colinas)));
		checar("contains", te.contains(v3(0, 0, -70), colinas) == true && te.contains(v3(500, 0, 0), colinas) == false);
		te.sculpt(colinas, "raise", v3(5, 0, -70), {radius: 6, strength: 1}, 1);
		te.markDirty(colinas);
		var grama:Dynamic = te.grass;
		grama.set(colinas, {enabled: true, density: 0.5});
		checar("grass.set", grama.settingsOf(colinas).enabled == true);
		var agua:Dynamic = te.water;
		agua.set(colinas, {enabled: true, level: -2});
		checar("water.set", agua.settingsOf(colinas).enabled == true);
		checar("terrain.raycast", te.raycast(v3(0, 50, -70), v3(0, -1, 0), colinas) != null);
		return null;
	}

	                                                                                           

	function soltarCaixa():Void {
		var random:Dynamic = helix.math.random;
		var caixa:Dynamic = helix.scene.spawnPrimitive("box", {
			name: "CaixaSolta",
			position: v3(random.range(-3, 3), 6, random.range(0, 4)),
			rigidBody: {type: "dynamic", collider: "box", mass: 1},
			tags: ["caixa"]
		});
		helix.material.setColor(caixa, random.color());
		pontos++;
		helix.gui.bind("pontos", pontos);
		helix.events.emit("debug.caixa", {nome: caixa.name});
	}

	function interfaceGrafica():Dynamic {
		var g:Dynamic = helix.gui;
		g.css("DebugEstilo");
		var hud:Dynamic = g.html("DebugHud", {id: "debug-hud"});
		checar("gui.html", hud != null && g.element("#debug-hud") != null);
		var icone:Dynamic = g.svg("DebugIcone", {id: "debug-icone"});
		checar("gui.svg", icone != null);
		var slot:Dynamic = g.element("[data-slot=icone]");
		if (slot != null && icone != null) slot.appendChild(icone);
		checar("gui.bind", g.bind("linguagem", LINGUAGEM) >= 1);
		g.bind("titulo", "Helix · Debug");
		assinar(g.onAction("caixa", function() soltarCaixa()));
		assinar(g.onAction("reiniciar", function() helix.play.restart()));
`;
}
