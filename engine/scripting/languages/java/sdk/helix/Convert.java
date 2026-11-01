package helix;

import java.util.Collection;
import java.util.Map;
import org.teavm.jso.JSObject;

                                                                           
final class Convert {
    private Convert() {}

    static JSObject toJs(Object value) {
        if (value == null) return JS.nil();
        if (value instanceof Value) return ((Value) value).js;
        if (value instanceof JSObject) return (JSObject) value;
        if (value instanceof String) return JS.string((String) value);
        if (value instanceof Boolean) return JS.bool((Boolean) value);
        if (value instanceof Number) return JS.number(((Number) value).doubleValue());
        if (value instanceof Character) return JS.string(String.valueOf(value));
        if (value instanceof Vec3) {
            Vec3 v = (Vec3) value;
            return JS.vec3(v.x, v.y, v.z);
        }
        if (value instanceof Fn0) return callback(value);
        if (value instanceof Fn1) return callback(value);
        if (value instanceof Fn2) return callback(value);
        if (value instanceof Fn3) return callback(value);
        if (value instanceof Runnable) return callback(value);
        if (value instanceof Collection) {
            JSObject array = JS.array();
            for (Object item : (Collection<?>) value) JS.push(array, toJs(item));
            return array;
        }
        if (value instanceof Object[]) {
            JSObject array = JS.array();
            for (Object item : (Object[]) value) JS.push(array, toJs(item));
            return array;
        }
        if (value instanceof double[]) {
            JSObject array = JS.array();
            for (double item : (double[]) value) JS.push(array, JS.number(item));
            return array;
        }
        if (value instanceof int[]) {
            JSObject array = JS.array();
            for (int item : (int[]) value) JS.push(array, JS.number(item));
            return array;
        }
        if (value instanceof Map) {
            JSObject object = JS.object();
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) JS.set(object, String.valueOf(entry.getKey()), toJs(entry.getValue()));
            return object;
        }
        if (value instanceof Enum) return JS.string(((Enum<?>) value).name());
        throw new EngineException("não sei converter um " + value.getClass().getName() + " para a engine; use número, String, boolean, Vec3, Value, List, Map ou um lambda (Fn0..Fn3).");
    }

    static JSObject toArgs(Object[] args) {
        JSObject array = JS.array();
        if (args != null) for (Object arg : args) JS.push(array, toJs(arg));
        return array;
    }

                                                                                                                           
    private static JSObject callback(Object fn) {
        JS.Callback bridge = (a, b, c, d) -> {
            try {
                Object result;
                if (fn instanceof Fn0) result = ((Fn0) fn).call();
                else if (fn instanceof Fn1) result = ((Fn1) fn).call(Value.of(a));
                else if (fn instanceof Fn2) result = ((Fn2) fn).call(Value.of(a), Value.of(b));
                else if (fn instanceof Fn3) result = ((Fn3) fn).call(Value.of(a), Value.of(b), Value.of(c));
                else {
                    ((Runnable) fn).run();
                    result = null;
                }
                return result == null ? JS.undefined() : toJs(result);
            } catch (Throwable t) {
                Runtime.rethrow(t);
                return JS.undefined();
            }
        };
        return JS.function(bridge);
    }
}
