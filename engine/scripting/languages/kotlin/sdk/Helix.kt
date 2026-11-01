@file:Suppress("unused", "MemberVisibilityCanBePrivate", "UNUSED_PARAMETER", "NOTHING_TO_INLINE")

package helix

import kotlin.js.JsName

   
                                                                   
                                                                           
                                                                            
                                                                      
                                                            
  
            
                 
  
                           
                       
  
                               
                                                          
        
  
                                          
                       
                                                                 
        
    
      
   

                                                                                                   

@JsName("helix")
internal external val rawHelix: dynamic

@JsName("require")
internal external fun rawRequire(name: String): dynamic

@JsName("console")
internal external val rawConsole: dynamic

                                                                                                 
class EngineException(message: String) : RuntimeException(message)

                                                                                                   

   
                                                                             
                                                                             
                                                                                
                                                                         
   
class Value(val raw: dynamic) {
                                                                                                   

    val isUndefined: Boolean get() = raw === undefined
    val isNull: Boolean get() = raw === null
    val isNullish: Boolean get() = raw == null
    val isNumber: Boolean get() = jsTypeOf(raw) == "number"
    val isString: Boolean get() = jsTypeOf(raw) == "string"
    val isBoolean: Boolean get() = jsTypeOf(raw) == "boolean"
    val isFunction: Boolean get() = jsTypeOf(raw) == "function"
    val isArray: Boolean get() = JsArray.isArray(raw) as Boolean
    val isObject: Boolean get() = raw != null && jsTypeOf(raw) == "object" && !isArray

                                                                                               
    val kind: String
        get() = when {
            isUndefined -> "undefined"
            isNull -> "null"
            isArray -> "array"
            else -> jsTypeOf(raw)
        }

                                                                                                    

                                                                 
    val number: Double get() = toNumber(raw)

                                                                      
    fun number(fallback: Double): Double = if (isNumber) raw as Double else fallback

    val int: Int get() = truncate(toNumber(raw))

    fun int(fallback: Int): Int = if (isNumber) truncate(raw as Double) else fallback

    val boolean: Boolean get() = truthy(raw)

                                                                                                 
    val string: String get() = toText(raw)

    fun string(fallback: String): String = if (isString) raw as String else fallback

                                                                                             
    val vec3: Vec3
        get() = when {
            isArray -> Vec3(get(0).number(0.0), get(1).number(0.0), get(2).number(0.0))
            isNullish -> Vec3()
            else -> Vec3(get("x").number(0.0), get("y").number(0.0), get("z").number(0.0))
        }

                                                                                 
    val list: List<Value>
        get() = List(size) { index -> Value(raw[index]) }

                                                            
    val keys: List<String>
        get() = if (isNullish) emptyList() else (JsObject.keys(raw) as Array<String>).toList()

                                                            
    val size: Int
        get() {
            if (isNullish) return 0
            val length = raw.length
            return if (jsTypeOf(length) == "number") truncate(length as Double) else 0
        }

                                                                                                   

    operator fun get(key: String): Value {
        if (isNullish) throw EngineException("não dá para ler \"$key\" de $kind.")
        return Value(raw[key])
    }

    operator fun get(index: Int): Value {
        if (isNullish) throw EngineException("não dá para ler o índice $index de $kind.")
        return Value(raw[index])
    }

    operator fun set(key: String, value: Any?) {
        if (isNullish) throw EngineException("não dá para escrever \"$key\" em $kind.")
        raw[key] = Convert.toJs(value)
    }

    operator fun set(index: Int, value: Any?) {
        if (isNullish) throw EngineException("não dá para escrever o índice $index em $kind.")
        raw[index] = Convert.toJs(value)
    }

                                                                            
    fun path(dotted: String): Value {
        var current = this
        for (part in dotted.split('.')) {
            if (part.isEmpty()) continue
            if (current.isNullish) throw EngineException("não dá para ler \"$part\" de ${current.kind} (em \"$dotted\").")
            current = current[part]
        }
        return current
    }

                                                  
    fun has(key: String): Boolean {
        if (isNullish) return false
        val target = raw
        return js("key in Object(target)") as Boolean
    }

    operator fun contains(key: String): Boolean = has(key)

    fun remove(key: String) {
        if (isNullish) return
        JsReflect.deleteProperty(raw, key)
    }

                                                                             
    fun push(value: Any?): Value {
        if (!isArray) throw EngineException("push só funciona em arrays; este valor é $kind.")
        raw.push(Convert.toJs(value))
        return this
    }

                                                                                                   

                                                                                   
    fun call(vararg args: Any?): Value {
        if (!isFunction) throw EngineException("este valor é $kind, não uma função.")
        return Value(raw.apply(undefined, Convert.toJsArray(args)))
    }

                                                                                            
    fun invoke(method: String, vararg args: Any?): Value {
        if (isNullish) throw EngineException("não dá para chamar \"$method\" em $kind.")
        val fn = raw[method]
        if (jsTypeOf(fn) != "function") throw EngineException("\"$method\" é ${Value(fn).kind}, não um método.")
        return Value(fn.apply(raw, Convert.toJsArray(args)))
    }

                              
    fun construct(vararg args: Any?): Value {
        if (!isFunction) throw EngineException("este valor é $kind, não um construtor.")
        return Value(JsReflect.construct(raw, Convert.toJsArray(args)))
    }

                                                                                                     

    override fun equals(other: Any?): Boolean {
        val otherRaw: dynamic = when (other) {
            is Value -> other.raw
            null -> return isNull
            else -> Convert.toJs(other)
        }
        return raw === otherRaw || (raw !== raw && otherRaw !== otherRaw)
    }

    override fun hashCode(): Int = if (isNullish) 0 else toText(raw).hashCode()

    override fun toString(): String = toText(raw)

    companion object {
        val undefined: Value get() = Value(js("undefined"))
        val nil: Value get() = Value(null)

                                                                                                              
        fun of(value: Any?): Value = if (value is Value) value else Value(Convert.toJs(value))
    }
}

                                                                                                   

                                                                                                    
object Helix {
                                                                                   
    val root: Value get() = Value(rawHelix)

                                                                                               
    fun call(path: String, vararg args: Any?): Value {
        val dot = path.lastIndexOf('.')
        if (dot < 0) return root.invoke(path, *args)
        return root.path(path.substring(0, dot)).invoke(path.substring(dot + 1), *args)
    }

                                                                                                           
    fun require(name: String): Value {
        if (name.isEmpty()) throw EngineException("require precisa do nome de um script da biblioteca.")
        return Value(rawRequire(name))
    }

    fun of(value: Any?): Value = Value.of(value)

                                            
    fun array(vararg items: Any?): Value = Value(Convert.toJsArray(items))

                                                                                        
    fun obj(vararg pairs: Pair<String, Any?>): Value {
        val out = Value(js("({})"))
        for ((key, value) in pairs) out[key] = value
        return out
    }

    fun vec3(x: Double, y: Double, z: Double): Vec3 = Vec3(x, y, z)

       
                                                                              
                                                                                    
       
    fun fn(body: (List<Value>) -> Any?): Value {
        val adapter: (dynamic) -> dynamic = { args -> Convert.toJs(body(Convert.toValueList(args))) }
        return Value(js("(function () { var a = []; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); return adapter(a); })"))
    }

                                                                                          
    val now: Double get() = root.path("time.now").number(0.0)

                                                                                                   

                                                                              
    fun log(vararg parts: Any?) = emit("info", parts)
    fun debug(vararg parts: Any?) = emit("debug", parts)
    fun warn(vararg parts: Any?) = emit("warn", parts)
    fun error(vararg parts: Any?) = emit("error", parts)

    internal fun join(parts: Array<out Any?>): String =
        parts.joinToString(" ") { part -> if (part is Value) part.string else toText(Convert.toJs(part)) }

    private fun emit(level: String, parts: Array<out Any?>) {
        val message = join(parts)
        when (level) {
            "error" -> rawConsole.error(message)
            "warn" -> rawConsole.warn(message)
            "debug" -> rawConsole.debug(message)
            else -> rawConsole.info(message)
        }
    }
}

                                              
fun require(name: String): Value = Helix.require(name)

                                                                                                                                            
fun log(vararg parts: Any?) = Helix.log(*parts)
fun warn(vararg parts: Any?) = Helix.warn(*parts)
fun debug(vararg parts: Any?) = Helix.debug(*parts)

                                                                                                   

                                                                              
data class Vec3(val x: Double = 0.0, val y: Double = 0.0, val z: Double = 0.0) {
    constructor(x: Number, y: Number, z: Number) : this(x.toDouble(), y.toDouble(), z.toDouble())

    operator fun plus(other: Vec3) = Vec3(x + other.x, y + other.y, z + other.z)
    operator fun minus(other: Vec3) = Vec3(x - other.x, y - other.y, z - other.z)
    operator fun times(scale: Double) = Vec3(x * scale, y * scale, z * scale)
    operator fun div(scale: Double) = Vec3(x / scale, y / scale, z / scale)
    operator fun unaryMinus() = Vec3(-x, -y, -z)

    val length: Double get() = kotlin.math.sqrt(x * x + y * y + z * z)
    val normalized: Vec3 get() = if (length == 0.0) this else this / length

    fun dot(other: Vec3): Double = x * other.x + y * other.y + z * other.z
    fun cross(other: Vec3) = Vec3(y * other.z - z * other.y, z * other.x - x * other.z, x * other.y - y * other.x)
    fun distanceTo(other: Vec3): Double = (this - other).length
    fun lerp(other: Vec3, t: Double) = Vec3(x + (other.x - x) * t, y + (other.y - y) * t, z + (other.z - z) * t)

                                              
    fun toJs(): dynamic {
        val out = js("({})")
        out.x = x
        out.y = y
        out.z = z
        return out
    }

    companion object {
        val zero get() = Vec3()
        val one get() = Vec3(1.0, 1.0, 1.0)
        val up get() = Vec3(0.0, 1.0, 0.0)
        val down get() = Vec3(0.0, -1.0, 0.0)
        val forward get() = Vec3(0.0, 0.0, -1.0)
        val back get() = Vec3(0.0, 0.0, 1.0)
        val right get() = Vec3(1.0, 0.0, 0.0)
        val left get() = Vec3(-1.0, 0.0, 0.0)
    }
}

operator fun Double.times(vector: Vec3) = vector * this

                                                                                                   

   
                                                                             
                                                                    
                                                                            
                                                                              
   

                                                                                                   

   
                                                                               
                                                                             
                                                                              
                                                                                  
                                                                           
          
   
object Runtime {
}

                                                                                                    

internal object Convert {
                                                                                                                                               


}

@JsName("Array")
internal external object JsArray {
}

@JsName("Object")
internal external object JsObject {
}

@JsName("Reflect")
internal external object JsReflect {
}




