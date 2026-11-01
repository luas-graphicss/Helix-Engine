package helix;

import org.teavm.jso.JSBody;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;

   
                                                                               
                                                                             
                                                                               
                                                    
   
final class JS {
    private JS() {}

    @JSFunctor
    interface Callback extends JSObject {
        JSObject call(JSObject a, JSObject b, JSObject c, JSObject d);
    }

                                                                                                

                                                                                                   
    @JSBody(params = {}, script = "return helix;")
    static native JSObject rootHelix();

    @JSBody(params = {"name"}, script = "return require(name);")
    static native JSObject require(String name);

    @JSBody(params = {"level", "message"}, script = "(level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.info)(message);")
    static native void log(String level, String message);

                                                                                               

    @JSBody(params = {"value"}, script = "return value;")
    static native JSObject number(double value);

    @JSBody(params = {"value"}, script = "return value;")
    static native JSObject bool(boolean value);

    @JSBody(params = {"value"}, script = "return value;")
    static native JSObject string(String value);

    @JSBody(params = {}, script = "return null;")
    static native JSObject nil();

    @JSBody(params = {}, script = "return undefined;")
    static native JSObject undefined();

    @JSBody(params = {}, script = "return [];")
    static native JSObject array();

    @JSBody(params = {}, script = "return {};")
    static native JSObject object();

    @JSBody(params = {"x", "y", "z"}, script = "return { x: x, y: y, z: z };")
    static native JSObject vec3(double x, double y, double z);

    @JSBody(params = {"fn"}, script = "return fn;")
    static native JSObject function(Callback fn);

                                                                                                 

    @JSBody(params = {"value"}, script = "return value === null;")
    static native boolean isNull(JSObject value);

    @JSBody(params = {"value"}, script = "return value === undefined;")
    static native boolean isUndefined(JSObject value);

    @JSBody(params = {"value"}, script = "return value == null;")
    static native boolean isNullish(JSObject value);

    @JSBody(params = {"value"}, script = "return Array.isArray(value);")
    static native boolean isArray(JSObject value);

    @JSBody(params = {"value"}, script = "return typeof value;")
    static native String typeOf(JSObject value);

    @JSBody(params = {"a", "b"}, script = "return a === b || (a !== a && b !== b);")
    static native boolean same(JSObject a, JSObject b);

    @JSBody(params = {"value"}, script = "return typeof value === 'number' ? value : typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);")
    static native double toNumber(JSObject value);

    @JSBody(params = {"value"}, script = "return !!value;")
    static native boolean toBoolean(JSObject value);

    @JSBody(params = {"value"}, script = "if (typeof value === 'string') return value; if (value === undefined) return 'undefined'; if (value === null) return 'null'; if (typeof value === 'object') { try { var text = String(value); return text === '[object Object]' ? (JSON.stringify(value) || text) : text; } catch (e) { return '[objeto]'; } } return String(value);")
    static native String toText(JSObject value);

                                                                                               

    @JSBody(params = {"target", "key"}, script = "return target[key];")
    static native JSObject get(JSObject target, String key);

    @JSBody(params = {"target", "index"}, script = "return target[index];")
    static native JSObject index(JSObject target, int index);

    @JSBody(params = {"target", "key", "value"}, script = "target[key] = value;")
    static native void set(JSObject target, String key, JSObject value);

    @JSBody(params = {"target", "index", "value"}, script = "target[index] = value;")
    static native void setIndex(JSObject target, int index, JSObject value);

    @JSBody(params = {"target", "key"}, script = "return key in Object(target);")
    static native boolean has(JSObject target, String key);

    @JSBody(params = {"target", "key"}, script = "delete target[key];")
    static native void remove(JSObject target, String key);

    @JSBody(params = {"target"}, script = "return Object.keys(target);")
    static native JSObject keys(JSObject target);

    @JSBody(params = {"target"}, script = "var n = target.length; return typeof n === 'number' ? n : 0;")
    static native int length(JSObject target);

    @JSBody(params = {"target", "value"}, script = "target.push(value);")
    static native void push(JSObject target, JSObject value);

                                                                                                 

    @JSBody(params = {"fn", "receiver", "args"}, script = "return fn.apply(receiver, args);")
    static native JSObject apply(JSObject fn, JSObject receiver, JSObject args);

    @JSBody(params = {"ctor", "args"}, script = "return Reflect.construct(ctor, args);")
    static native JSObject construct(JSObject ctor, JSObject args);

                                                                                               

       
                                                                                 
                                                                               
                                                                           
                                             
       
    @JSBody(params = {"error", "text"}, script = "if (error && error.constructor && error.constructor.name === 'JavaError') { try { Object.defineProperty(error, 'message', { value: text, configurable: true, writable: true }); } catch (e) {} } throw error == null ? new Error(text) : error;")
    static native void rethrow(JSObject error, String text);
}
