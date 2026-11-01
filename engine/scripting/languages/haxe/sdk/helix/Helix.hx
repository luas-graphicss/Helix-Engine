package helix;

   
                                                                            
                                                                             
                                                                           
                                                                                    
                                                                       
                                                                           
                                      
  
                                                                               
                                                                                   
                         
   
class Helix {
	                                             
	public static var root(get, never):Dynamic;

	static inline function get_root():Dynamic {
		return js.Syntax.code("helix");
	}

	                                                                                             

	                                      
	public static var context(get, never):String;

	static inline function get_context():String {
		return js.Syntax.code("helix.context");
	}

	public static var isEditor(get, never):Bool;

	static inline function get_isEditor():Bool {
		return js.Syntax.code("helix.isEditor");
	}

	public static var isPlaying(get, never):Bool;

	static inline function get_isPlaying():Bool {
		return js.Syntax.code("helix.isPlaying");
	}

	                                    
	public static var engine(get, never):Dynamic;

	static inline function get_engine():Dynamic {
		return js.Syntax.code("helix.engine");
	}

	                                                                  
	public static var self(get, never):Dynamic;

	static inline function get_self():Dynamic {
		return js.Syntax.code("helix.self");
	}

	                                            
	public static var script(get, never):Dynamic;

	static inline function get_script():Dynamic {
		return js.Syntax.code("helix.script");
	}

	                                                                                                 

	public static var time(get, never):Dynamic;

	static inline function get_time():Dynamic {
		return js.Syntax.code("helix.time");
	}

	public static var task(get, never):Dynamic;

	static inline function get_task():Dynamic {
		return js.Syntax.code("helix.task");
	}

	                                                                                            
	public static var console(get, never):Dynamic;

	static inline function get_console():Dynamic {
		return js.Syntax.code("helix.log");
	}

	                                                                   
	public static var draw(get, never):Dynamic;

	static inline function get_draw():Dynamic {
		return js.Syntax.code("helix.debug");
	}

	public static var events(get, never):Dynamic;

	static inline function get_events():Dynamic {
		return js.Syntax.code("helix.events");
	}

	public static var math(get, never):Dynamic;

	static inline function get_math():Dynamic {
		return js.Syntax.code("helix.math");
	}

	public static var props(get, never):Dynamic;

	static inline function get_props():Dynamic {
		return js.Syntax.code("helix.props");
	}

	public static var scene(get, never):Dynamic;

	static inline function get_scene():Dynamic {
		return js.Syntax.code("helix.scene");
	}

	public static var transform(get, never):Dynamic;

	static inline function get_transform():Dynamic {
		return js.Syntax.code("helix.transform");
	}

	public static var mesh(get, never):Dynamic;

	static inline function get_mesh():Dynamic {
		return js.Syntax.code("helix.mesh");
	}

	public static var csg(get, never):Dynamic;

	static inline function get_csg():Dynamic {
		return js.Syntax.code("helix.csg");
	}

	public static var material(get, never):Dynamic;

	static inline function get_material():Dynamic {
		return js.Syntax.code("helix.material");
	}

	public static var materials(get, never):Dynamic;

	static inline function get_materials():Dynamic {
		return js.Syntax.code("helix.materials");
	}

	public static var texture(get, never):Dynamic;

	static inline function get_texture():Dynamic {
		return js.Syntax.code("helix.texture");
	}

	public static var light(get, never):Dynamic;

	static inline function get_light():Dynamic {
		return js.Syntax.code("helix.light");
	}

	public static var camera(get, never):Dynamic;

	static inline function get_camera():Dynamic {
		return js.Syntax.code("helix.camera");
	}

	public static var sky(get, never):Dynamic;

	static inline function get_sky():Dynamic {
		return js.Syntax.code("helix.sky");
	}

	public static var world(get, never):Dynamic;

	static inline function get_world():Dynamic {
		return js.Syntax.code("helix.world");
	}

	public static var post(get, never):Dynamic;

	static inline function get_post():Dynamic {
		return js.Syntax.code("helix.post");
	}

	public static var render(get, never):Dynamic;

	static inline function get_render():Dynamic {
		return js.Syntax.code("helix.render");
	}

	public static var physics(get, never):Dynamic;

	static inline function get_physics():Dynamic {
		return js.Syntax.code("helix.physics");
	}

	public static var character(get, never):Dynamic;

	static inline function get_character():Dynamic {
		return js.Syntax.code("helix.character");
	}

	public static var player(get, never):Dynamic;

	static inline function get_player():Dynamic {
		return js.Syntax.code("helix.player");
	}

	public static var terrain(get, never):Dynamic;

	static inline function get_terrain():Dynamic {
		return js.Syntax.code("helix.terrain");
	}

	public static var gui(get, never):Dynamic;

	static inline function get_gui():Dynamic {
		return js.Syntax.code("helix.gui");
	}

	public static var audio(get, never):Dynamic;

	static inline function get_audio():Dynamic {
		return js.Syntax.code("helix.audio");
	}

	public static var animation(get, never):Dynamic;

	static inline function get_animation():Dynamic {
		return js.Syntax.code("helix.animation");
	}

	public static var vfx(get, never):Dynamic;

	static inline function get_vfx():Dynamic {
		return js.Syntax.code("helix.vfx");
	}

	public static var input(get, never):Dynamic;

	static inline function get_input():Dynamic {
		return js.Syntax.code("helix.input");
	}

	public static var assets(get, never):Dynamic;

	static inline function get_assets():Dynamic {
		return js.Syntax.code("helix.assets");
	}

	public static var project(get, never):Dynamic;

	static inline function get_project():Dynamic {
		return js.Syntax.code("helix.project");
	}

	public static var storage(get, never):Dynamic;

	static inline function get_storage():Dynamic {
		return js.Syntax.code("helix.storage");
	}

	public static var play(get, never):Dynamic;

	static inline function get_play():Dynamic {
		return js.Syntax.code("helix.play");
	}

	public static var net(get, never):Dynamic;

	static inline function get_net():Dynamic {
		return js.Syntax.code("helix.net");
	}

	                                                    
	public static var editor(get, never):Dynamic;

	static inline function get_editor():Dynamic {
		return js.Syntax.code("helix.editor");
	}

	                                                                                              

	                                                                                                       
	public static inline function require(name:String):Dynamic {
		return js.Syntax.code("require({0})", name);
	}

	                                                                                           
	public static function call(path:String, ...args:Dynamic):Dynamic {
		var parts = path.split(".");
		var method = parts.pop();
		var target:Dynamic = root;
		for (part in parts) {
			if (part.length == 0) continue;
			if (target == null) throw new haxe.Exception('não dá para ler "$part" de null em "$path".');
			target = js.Syntax.field(target, part);
		}
		if (target == null) throw new haxe.Exception('não dá para chamar "$method" de null em "$path".');
		var fn:Dynamic = js.Syntax.field(target, method);
		if (js.Syntax.typeof(fn) != "function") throw new haxe.Exception('"$path" não é uma função.');
		return js.Syntax.code("{0}.apply({1}, {2})", fn, target, args.toArray());
	}

	                                                             
	public static var now(get, never):Float;

	static inline function get_now():Float {
		return js.Syntax.code("helix.time.now");
	}

	                                          
	public static inline function vec3(x:Float, y:Float, z:Float):Vec3 {
		return new Vec3(x, y, z);
	}

	                                                                                             

	                                                                                                                 
	public static function log(...parts:Dynamic):Void {
		emit("info", parts.toArray());
	}

	public static function debug(...parts:Dynamic):Void {
		emit("debug", parts.toArray());
	}

	public static function warn(...parts:Dynamic):Void {
		emit("warn", parts.toArray());
	}

	public static function error(...parts:Dynamic):Void {
		emit("error", parts.toArray());
	}

	static function emit(level:String, parts:Array<Dynamic>):Void {
		var values:Array<Dynamic> = [for (part in parts) printable(part)];
		js.Syntax.code("console[{0}].apply(console, {1})", level, values);
	}

	                                                                                                 
	static function printable(value:Dynamic):Dynamic {
		if (value == null || js.Syntax.typeof(value) != "object") return value;
		if (Std.isOfType(value, haxe.Constraints.IMap) || Reflect.hasField(value, "__enum__")) return Std.string(value);
		return value;
	}
}
