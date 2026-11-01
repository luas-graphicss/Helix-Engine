package helix;

import org.teavm.jso.JSObject;

   
                                                                             
                                                                             
                                                                       
                                                                               
                             
   
public abstract class Script {
    private Value helix = Value.undefined();
    private Value self = Value.undefined();
    private Value script = Value.undefined();

                                                                   
    protected final Value helix() {
        return helix;
    }

                                          
    protected final Value self() {
        return self;
    }

                                                                           
    protected final Value script() {
        return script;
    }

                                         
    protected final void log(Object... parts) {
        Helix.log(parts);
    }

                                             
    protected final Value require(String name) {
        return Helix.require(name);
    }

                                                                                                

    public void onLoad() {}

    public void onStart() {}

    public void onUpdate(double dt) {}

    public void onFixedUpdate(double h) {}

    public void onLateUpdate(double dt) {}

    public void onRender(Value frame) {}

    public void onEnable() {}

    public void onDisable() {}

    public void onStop() {}

    public void onDestroy() {}

                                                                                             
    public Object onBeforeHotReload() {
        return null;
    }

    public void onHotReload(Value previousState) {}

                                                                                                 

    public void onCollisionBegin(Value other, Value contact) {}

    public void onCollisionStay(Value other, Value contact) {}

    public void onCollisionEnd(Value other) {}

    public void onTriggerEnter(Value other) {}

    public void onTriggerStay(Value other) {}

    public void onTriggerExit(Value other) {}

                                                                                                

    final void attach(JSObject inject) {
        helix = Value.of(JS.get(inject, "helix"));
        self = Value.of(JS.get(inject, "entity"));
        script = Value.of(JS.get(inject, "script"));
    }
}
