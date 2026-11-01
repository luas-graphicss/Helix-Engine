package helix;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
#end

   
                                                                            
                                                                                
                                                      
  
                                                                            
                                                                           
                                                                                   
                                                                                   
                                                                                
                                                           
  
                                                                                
                                                                          
   
class Boot {
	public static macro function module(moduleName:String):Expr {
		var pos = Context.currentPos();
		var types = Context.getModule(moduleName);
		var scriptClass:ClassType = null;
		var mainClass:ClassType = null;
		for (type in types) {
			switch (type) {
				case TInst(ref, _):
					var cl = ref.get();
					if (cl.module != moduleName) continue;
					if (cl.name == moduleName) mainClass = cl;
					if (!cl.isInterface && extendsScript(cl)) {
						if (scriptClass != null) {
							Context.error('Só uma classe por arquivo pode estender helix.Script; ${scriptClass.name} já é a classe de ator deste script.', cl.pos);
						}
						scriptClass = cl;
					}
				default:
			}
		}
		var exportsOwner = mainClass != null ? mainClass : scriptClass;
		var exportFields:Array<ObjectField> = [];
		if (exportsOwner != null) {
			var owner = classPath(exportsOwner);
			for (field in exportsOwner.statics.get()) {
				if (!field.isPublic || field.name == "main") continue;
				switch (field.kind) {
					case FMethod(_):
						var name = field.name;
						exportFields.push({field: name, expr: macro $p{owner.concat([name])}});
					default:
				}
			}
		}
		var boot:Expr = macro null;
		if (scriptClass != null) {
			checkInstantiable(scriptClass);
			var path = classPath(scriptClass);
			var typePath:TypePath = {pack: [], name: path[0], sub: path.length > 1 ? path[1] : null};
			var hookFields:Array<ObjectField> = [];
			for (hook in overriddenHooks(scriptClass)) {
				hookFields.push({field: hook, expr: macro instance.$hook});
			}
			var hooks:Expr = {expr: EObjectDecl(hookFields), pos: pos};
			boot = macro function(inject:Dynamic):Dynamic {
				var instance = new $typePath();
				instance.__helixAttach(inject);
				return $hooks;
			};
		}
		var exports:Expr = {expr: EObjectDecl(exportFields), pos: pos};
		return macro {boot: $boot, exports: $exports};
	}

	#if macro
	                                                                                                  
	static final HOOKS = [
		"onLoad", "onStart", "onUpdate", "onFixedUpdate", "onLateUpdate", "onRender", "onEnable", "onDisable", "onStop", "onDestroy", "onBeforeHotReload", "onHotReload", "onCollisionBegin",
		"onCollisionStay", "onCollisionEnd", "onTriggerEnter", "onTriggerStay", "onTriggerExit"
	];

	static function isScriptBase(cl:ClassType):Bool {
		return cl.pack.length == 1 && cl.pack[0] == "helix" && cl.name == "Script";
	}

	static function extendsScript(cl:ClassType):Bool {
		var current = cl.superClass;
		while (current != null) {
			var parent = current.t.get();
			if (isScriptBase(parent)) return true;
			current = parent.superClass;
		}
		return false;
	}

                                                                                                 
	static function classPath(cl:ClassType):Array<String> {
		var module = cl.module.split(".").pop();
		return cl.name == module ? [module] : [module, cl.name];
	}

	static function overriddenHooks(cl:ClassType):Array<String> {
		var found:Array<String> = [];
		var current = cl;
		while (current != null && !isScriptBase(current)) {
			for (field in current.fields.get()) {
				if (HOOKS.indexOf(field.name) >= 0 && found.indexOf(field.name) < 0) found.push(field.name);
			}
			current = current.superClass == null ? null : current.superClass.t.get();
		}
		found.sort((a, b) -> HOOKS.indexOf(a) - HOOKS.indexOf(b));
		return found;
	}

	static function checkInstantiable(cl:ClassType):Void {
		var reason:Null<String> = null;
		if (cl.isAbstract) reason = "ela é abstrata";
		else if (cl.isPrivate) reason = "ela é privada";
		else if (cl.constructor != null) {
                                                                                            
			switch (haxe.macro.TypeTools.follow(cl.constructor.get().type)) {
				case TFun(args, _):
					for (arg in args) if (!arg.opt) reason = 'o construtor dela exige o argumento "${arg.name}"';
				default:
			}
		}
		if (reason != null) Context.error('A engine não consegue instanciar a classe ${cl.name} para os atores: $reason. A classe de um script precisa ser pública, concreta e ter um construtor sem argumentos obrigatórios.', cl.pos);
	}
	#end
}
