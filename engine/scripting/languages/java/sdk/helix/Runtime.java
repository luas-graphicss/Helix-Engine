package helix;

import org.teavm.jso.JSBody;
import org.teavm.jso.JSExceptions;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;

   
                                                                         
                                                                    
                                                                       
                                                                            
                                                       
   
public final class Runtime {
    private Runtime() {}

    @JSFunctor
    interface Hook0 extends JSObject {
        void call();
    }

    @JSFunctor
    interface HookNumber extends JSObject {
        void call(double value);
    }

    @JSFunctor
    interface Hook1 extends JSObject {
        void call(JSObject a);
    }

    @JSFunctor
    interface Hook2 extends JSObject {
        void call(JSObject a, JSObject b);
    }

    @JSFunctor
    interface HookResult extends JSObject {
        JSObject call();
    }

                                                                                               
    public static JSObject boot(Script script, JSObject inject, String declaredHooks) {
        script.attach(inject);
        JSObject hooks = JS.object();
        for (String name : declaredHooks.split(",")) {
            String hook = name.trim();
            JSObject fn = hookFor(script, hook);
            if (fn != null) JS.set(hooks, hook, fn);
        }
        return hooks;
    }

    private static JSObject hookFor(Script s, String name) {
        switch (name) {
            case "onLoad":
                return fn((Hook0) () -> guard(s::onLoad));
            case "onStart":
                return fn((Hook0) () -> guard(s::onStart));
            case "onUpdate":
                return fn((HookNumber) dt -> guard(() -> s.onUpdate(dt)));
            case "onFixedUpdate":
                return fn((HookNumber) h -> guard(() -> s.onFixedUpdate(h)));
            case "onLateUpdate":
                return fn((HookNumber) dt -> guard(() -> s.onLateUpdate(dt)));
            case "onRender":
                return fn((Hook1) frame -> guard(() -> s.onRender(Value.of(frame))));
            case "onEnable":
                return fn((Hook0) () -> guard(s::onEnable));
            case "onDisable":
                return fn((Hook0) () -> guard(s::onDisable));
            case "onStop":
                return fn((Hook0) () -> guard(s::onStop));
            case "onDestroy":
                return fn((Hook0) () -> guard(s::onDestroy));
            case "onBeforeHotReload":
                return fn((HookResult) () -> {
                    try {
                        return Convert.toJs(s.onBeforeHotReload());
                    } catch (Throwable t) {
                        rethrow(t);
                        return JS.undefined();
                    }
                });
            case "onHotReload":
                return fn((Hook1) previous -> guard(() -> s.onHotReload(Value.of(previous))));
            case "onCollisionBegin":
                return fn((Hook2) (other, contact) -> guard(() -> s.onCollisionBegin(Value.of(other), Value.of(contact))));
            case "onCollisionStay":
                return fn((Hook2) (other, contact) -> guard(() -> s.onCollisionStay(Value.of(other), Value.of(contact))));
            case "onCollisionEnd":
                return fn((Hook1) other -> guard(() -> s.onCollisionEnd(Value.of(other))));
            case "onTriggerEnter":
                return fn((Hook1) other -> guard(() -> s.onTriggerEnter(Value.of(other))));
            case "onTriggerStay":
                return fn((Hook1) other -> guard(() -> s.onTriggerStay(Value.of(other))));
            case "onTriggerExit":
                return fn((Hook1) other -> guard(() -> s.onTriggerExit(Value.of(other))));
            default:
                return null;
        }
    }

                                                                                                                                
    @JSBody(params = {"fn"}, script = "return fn;")
    private static native JSObject fn(Hook0 fn);

    @JSBody(params = {"fn"}, script = "return fn;")
    private static native JSObject fn(HookNumber fn);

    @JSBody(params = {"fn"}, script = "return fn;")
    private static native JSObject fn(Hook1 fn);

    @JSBody(params = {"fn"}, script = "return fn;")
    private static native JSObject fn(Hook2 fn);

    @JSBody(params = {"fn"}, script = "return fn;")
    private static native JSObject fn(HookResult fn);

    private static void guard(Runnable body) {
        try {
            body.run();
        } catch (Throwable t) {
            rethrow(t);
        }
    }

       
                                                                        
                                                                              
                                                           
       
    static void rethrow(Throwable t) {
        JS.rethrow(JSExceptions.getJSException(t), describe(t));
    }

    static String describe(Throwable t) {
        String simple = typeName(t);
        String message = t.getMessage();
        return message == null || message.isEmpty() ? simple : simple + ": " + message;
    }

       
                                                                              
                                                                                
                                                                             
                                                             
       
    private static String typeName(Throwable t) {
        if (t instanceof EngineException) return "EngineException";
        if (t instanceof ArrayIndexOutOfBoundsException) return "ArrayIndexOutOfBoundsException";
        if (t instanceof StringIndexOutOfBoundsException) return "StringIndexOutOfBoundsException";
        if (t instanceof IndexOutOfBoundsException) return "IndexOutOfBoundsException";
        if (t instanceof NullPointerException) return "NullPointerException";
        if (t instanceof ArithmeticException) return "ArithmeticException";
        if (t instanceof ClassCastException) return "ClassCastException";
        if (t instanceof NumberFormatException) return "NumberFormatException";
        if (t instanceof IllegalArgumentException) return "IllegalArgumentException";
        if (t instanceof IllegalStateException) return "IllegalStateException";
        if (t instanceof UnsupportedOperationException) return "UnsupportedOperationException";
        if (t instanceof NegativeArraySizeException) return "NegativeArraySizeException";
        if (t instanceof java.util.NoSuchElementException) return "NoSuchElementException";
        if (t instanceof java.util.ConcurrentModificationException) return "ConcurrentModificationException";
        if (t instanceof StackOverflowError) return "StackOverflowError";
        if (t instanceof OutOfMemoryError) return "OutOfMemoryError";
        if (t instanceof AssertionError) return "AssertionError";
        String name = null;
        try {
            name = t.getClass().getName();
        } catch (Throwable ignored) {
                                      
        }
        if (name != null) return name.substring(name.lastIndexOf('.') + 1).replace('$', '.');
        if (t instanceof RuntimeException) return "RuntimeException";
        if (t instanceof Exception) return "Exception";
        if (t instanceof Error) return "Error";
        return "Throwable";
    }
}
