package helix;

   
                                                                            
                                                                              
                                                                              
                                                                          
                                 
  
          
                      
                       
  
                               
                        
  
                                    
                                                          
        
  
                                             
                             
                                                            
        
    
      
   
class Script {
	                                                                            
	public var helix:Dynamic;

	                                      
	public var self:Dynamic;

	                                                                       
	public var script:Dynamic;

	                           
	public var entity(get, never):Dynamic;

	inline function get_entity():Dynamic {
		return self;
	}

	public function new() {}

	                                                                                           

	public function onLoad():Void {}

	public function onStart():Void {}

	public function onUpdate(dt:Float):Void {}

	public function onFixedUpdate(h:Float):Void {}

	public function onLateUpdate(dt:Float):Void {}

	public function onRender(frame:Dynamic):Void {}

	public function onEnable():Void {}

	public function onDisable():Void {}

	public function onStop():Void {}

	public function onDestroy():Void {}

	                                                                                  
	public function onBeforeHotReload():Dynamic {
		return null;
	}

	public function onHotReload(previousState:Dynamic):Void {}

	                                                                                              

	public function onCollisionBegin(other:Dynamic, contact:Dynamic):Void {}

	public function onCollisionStay(other:Dynamic, contact:Dynamic):Void {}

	public function onCollisionEnd(other:Dynamic):Void {}

	public function onTriggerEnter(other:Dynamic):Void {}

	public function onTriggerStay(other:Dynamic):Void {}

	public function onTriggerExit(other:Dynamic):Void {}

	                                                                                             

	                                                                          
	public function log(...parts:Dynamic):Void {
		Helix.log(...parts);
	}

	public function debug(...parts:Dynamic):Void {
		Helix.debug(...parts);
	}

	public function warn(...parts:Dynamic):Void {
		Helix.warn(...parts);
	}

	public function error(...parts:Dynamic):Void {
		Helix.error(...parts);
	}

	                                                                             
	public function require(name:String):Dynamic {
		return Helix.require(name);
	}

	                                                                                        
	@:noCompletion public function __helixAttach(inject:Dynamic):Void {
		helix = inject.helix;
		self = inject.entity;
		script = inject.script;
	}
}
