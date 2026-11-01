package helix;

   
                                                                     
                                                                           
                                                                               
                                                                   
  
        
                  
  
                                      
                     
  
                              
                                                                     
        
  
                                        
                        
                                                                             
        
    
         
   
public final class Helix {
    private Helix() {}

                                                                                                   
    public static Value root() {
        return Value.of(JS.rootHelix());
    }

                                                                                                           
    public static Value require(String name) {
        if (name == null || name.isEmpty()) throw new EngineException("require precisa do nome de um script da biblioteca.");
        return Value.of(JS.require(name));
    }

                                                                                                   
    public static Value of(Object value) {
        return Value.from(value);
    }

                                            
    public static Value array(Object... items) {
        Value array = Value.of(JS.array());
        if (items != null) for (Object item : items) array.push(item);
        return array;
    }

                                                                     
    public static Value object() {
        return Value.of(JS.object());
    }

                                                                                                  
    public static Value object(Object... pairs) {
        Value object = object();
        if (pairs == null) return object;
        if (pairs.length % 2 != 0) throw new EngineException("object(...) recebe pares chave, valor.");
        for (int i = 0; i < pairs.length; i += 2) object.set(String.valueOf(pairs[i]), pairs[i + 1]);
        return object;
    }

    public static Vec3 vec3(double x, double y, double z) {
        return new Vec3(x, y, z);
    }

                                                                                               

                                                                                                  
    public static void log(Object... parts) {
        JS.log("info", join(parts));
    }

    public static void debug(Object... parts) {
        JS.log("debug", join(parts));
    }

    public static void warn(Object... parts) {
        JS.log("warn", join(parts));
    }

    public static void error(Object... parts) {
        JS.log("error", join(parts));
    }

    static String join(Object[] parts) {
        if (parts == null) return "";
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) out.append(' ');
            Object part = parts[i];
            out.append(part instanceof Value ? ((Value) part).asString() : String.valueOf(part));
        }
        return out.toString();
    }
}
