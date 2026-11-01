package helix;

import haxe.PosInfos;

                                                                                                                                       
typedef ScriptModule = {
	var boot:Null<(inject:Dynamic) -> Dynamic>;
	var exports:Dynamic;
}

   
                                                                         
                                                                         
                                                                               
                                                                                
                                                                             
                                                                   
   
class Runtime {
	public static function register(script:ScriptModule):Void {
		haxe.Log.trace = traceToConsole;
		                                                                                            
		if (script.boot != null) js.Syntax.code("module.exports.default = {0}", script.boot);
		for (name in Reflect.fields(script.exports)) {
			js.Syntax.code("module.exports[{0}] = {1}", name, Reflect.field(script.exports, name));
		}
	}

	static function traceToConsole(value:Dynamic, ?infos:PosInfos):Void {
		var parts:Array<Dynamic> = [value];
		if (infos != null && infos.customParams != null) for (extra in infos.customParams) parts.push(extra);
		Helix.log(...parts);
	}
}
