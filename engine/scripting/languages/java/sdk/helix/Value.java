package helix;

import java.util.ArrayList;
import java.util.List;
import org.teavm.jso.JSObject;

   
                                                                            
                                                                                 
                                                                                   
                              
  
        
                                                       
                                      
                                                                    
                              
         
   
public final class Value {
    final JSObject js;

    private Value(JSObject js) {
        this.js = js;
    }

                                                                            
    public static Value of(JSObject js) {
        return new Value(js);
    }

                                                                                                          
    public static Value from(Object value) {
        return new Value(Convert.toJs(value));
    }

    public static Value undefined() {
        return new Value(JS.undefined());
    }

    public static Value nil() {
        return new Value(JS.nil());
    }

                                                                     
    public JSObject raw() {
        return js;
    }

                                                                                              

    public boolean isUndefined() {
        return JS.isUndefined(js);
    }

    public boolean isNull() {
        return JS.isNull(js);
    }

                             
    public boolean isNullish() {
        return JS.isNullish(js);
    }

    public boolean isNumber() {
        return "number".equals(JS.typeOf(js));
    }

    public boolean isString() {
        return "string".equals(JS.typeOf(js));
    }

    public boolean isBoolean() {
        return "boolean".equals(JS.typeOf(js));
    }

    public boolean isFunction() {
        return "function".equals(JS.typeOf(js));
    }

    public boolean isArray() {
        return JS.isArray(js);
    }

                                             
    public boolean isObject() {
        return "object".equals(JS.typeOf(js)) && !JS.isNull(js) && !JS.isArray(js);
    }

                                                                                                                     
    public String kind() {
        if (JS.isNull(js)) return "null";
        if (JS.isArray(js)) return "array";
        return JS.typeOf(js);
    }

                                                                                               

    public double asDouble() {
        if (!isNumber() && !isBoolean() && !isString()) throw new EngineException("esperava um número, mas o valor é " + describe() + ".");
        return JS.toNumber(js);
    }

                                                                           
    public double asDouble(double fallback) {
        return isNumber() ? JS.toNumber(js) : fallback;
    }

    public float asFloat() {
        return (float) asDouble();
    }

    public int asInt() {
        return (int) asDouble();
    }

    public int asInt(int fallback) {
        return isNumber() ? (int) JS.toNumber(js) : fallback;
    }

    public long asLong() {
        return (long) asDouble();
    }

    public boolean asBoolean() {
        return JS.toBoolean(js);
    }

                                                                                          
    public String asString() {
        return JS.toText(js);
    }

    public String asString(String fallback) {
        return isString() ? JS.toText(js) : fallback;
    }

                                                                          
    public Vec3 asVec3() {
        if (!isObject()) throw new EngineException("esperava um vetor {x, y, z}, mas o valor é " + describe() + ".");
        return new Vec3(get("x").asDouble(0), get("y").asDouble(0), get("z").asDouble(0));
    }

                                                       
    public List<Value> asList() {
        int n = length();
        List<Value> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) out.add(get(i));
        return out;
    }

                                                                                              

    public Value get(String key) {
        if (JS.isNullish(js)) throw new EngineException("não dá para ler \"" + key + "\" de " + JS.toText(js) + ".");
        return new Value(JS.get(js, key));
    }

    public Value get(int index) {
        if (JS.isNullish(js)) throw new EngineException("não dá para ler o índice " + index + " de " + JS.toText(js) + ".");
        return new Value(JS.index(js, index));
    }

                                                                    
    public Value path(String dotted) {
        Value current = this;
        for (String part : dotted.split("\\.")) {
            if (!part.isEmpty()) current = current.get(part);
        }
        return current;
    }

                                                                                                   
    public Value set(String key, Object value) {
        if (JS.isNullish(js)) throw new EngineException("não dá para escrever \"" + key + "\" em " + JS.toText(js) + ".");
        JS.set(js, key, Convert.toJs(value));
        return this;
    }

    public Value set(int index, Object value) {
        if (JS.isNullish(js)) throw new EngineException("não dá para escrever o índice " + index + " em " + JS.toText(js) + ".");
        JS.setIndex(js, index, Convert.toJs(value));
        return this;
    }

    public boolean has(String key) {
        return !JS.isNullish(js) && JS.has(js, key);
    }

    public void remove(String key) {
        if (!JS.isNullish(js)) JS.remove(js, key);
    }

                                                                              
    public List<String> keys() {
        List<String> out = new ArrayList<>();
        if (JS.isNullish(js) || !"object".equals(JS.typeOf(js))) return out;
        JSObject names = JS.keys(js);
        int n = JS.length(names);
        for (int i = 0; i < n; i++) out.add(JS.toText(JS.index(names, i)));
        return out;
    }

                                                               
    public int length() {
        return JS.isNullish(js) ? 0 : JS.length(js);
    }

                                         
    public Value push(Object value) {
        if (!JS.isArray(js)) throw new EngineException("push precisa de um array, mas o valor é " + describe() + ".");
        JS.push(js, Convert.toJs(value));
        return this;
    }

                                                                                                

                                                                                          
    public Value call(String name, Object... args) {
        Value fn = get(name);
        if (!fn.isFunction()) throw new EngineException("\"" + name + "\" não é uma função de " + describe() + " (é " + fn.describe() + ").");
        return new Value(JS.apply(fn.js, js, Convert.toArgs(args)));
    }

                                                            
    public Value invoke(Object... args) {
        if (!isFunction()) throw new EngineException("o valor não é uma função (é " + describe() + ").");
        return new Value(JS.apply(js, JS.undefined(), Convert.toArgs(args)));
    }

                                                               
    public Value construct(Object... args) {
        if (!isFunction()) throw new EngineException("o valor não é um construtor (é " + describe() + ").");
        return new Value(JS.construct(js, Convert.toArgs(args)));
    }

                                                                                               

                                                                                      
    @Override
    public boolean equals(Object other) {
        return other instanceof Value && JS.same(js, ((Value) other).js);
    }

    @Override
    public int hashCode() {
        return isNumber() || isString() || isBoolean() ? asString().hashCode() : System.identityHashCode(js);
    }

    @Override
    public String toString() {
        return asString();
    }

                                                                                        
    String describe() {
        String kind = kind();
        if ("number".equals(kind) || "boolean".equals(kind)) return kind + " " + asString();
        if ("string".equals(kind)) return "string \"" + asString() + "\"";
        return kind;
    }
}
