                                                          
  
                                                                        
                                                                            
                                                                                  
                                                                             
                                         
  
                                                                              
                                                                               
                                                                             
                                                                            
                                        
package helix

import (
	"fmt"
	"math"
	"runtime"
	"strings"
)

                            
func hxRetain(ref uint32) uint32

                             
func hxRelease(ref uint32)

                          
func hxType(ref uint32) int32

                            
func hxEquals(a, b uint32) int32

                          
func hxRoot() uint32

                            
func hxScript() uint32

                          
func hxSelf() uint32

                             
func hxRequire(name string) uint32

                            
func hxNumber(v float64) uint32

                             
func hxBoolean(v int32) uint32

                            
func hxString(s string) uint32

                          
func hxNull() uint32

                           
func hxArray() uint32

                            
func hxObject() uint32

                              
func hxCallback(id uint32) uint32

                          
func hxPool(ref uint32) uint32

                               
func hxToNumber(ref uint32) float64

                                
func hxToBoolean(ref uint32) int32

                                  
func hxStringBytes(ref uint32) int32

                                 
func hxStringRead(ref uint32, buf *byte, capacity int32) int32

                         
func hxGet(obj uint32, key string) uint32

                           
func hxIndex(obj uint32, i int32) uint32

                         
func hxSet(obj uint32, key string, value uint32)

                               
func hxSetIndex(obj uint32, i int32, value uint32)

                         
func hxHas(obj uint32, key string) int32

                            
func hxDelete(obj uint32, key string)

                            
func hxLength(obj uint32) int32

                          
func hxKeys(obj uint32) uint32

                          
func hxCall(fn uint32, args *uint32, count int32) uint32

                            
func hxInvoke(obj uint32, method string, args *uint32, count int32) uint32

                               
func hxConstruct(ctor uint32, args *uint32, count int32) uint32

                         
func hxLog(level int32, message string)

                         
func hxNow() float64

                                
func hxFaultCell(cell *uint32)

                                
func hxFaultTake(buf *byte, capacity int32) int32

                                                                                             

                                                                                                  
var fault uint32

func init() {
	hxFaultCell(&fault)
}

                                                                       
type EngineError string

func (e EngineError) Error() string { return string(e) }

func check() {
	if fault != 0 {
		fail()
	}
}

func fail() {
	var buffer [2048]byte
	n := hxFaultTake(&buffer[0], int32(len(buffer)))
	if n > int32(len(buffer)) {
		n = int32(len(buffer))
	}
	panic(EngineError(string(buffer[:n])))
}

                                                                                            

                                                                 
type Kind int32

const (
	KindUndefined Kind = iota
	KindNull
	KindBoolean
	KindNumber
	KindString
	KindArray
	KindObject
	KindFunction
)

func (k Kind) String() string {
	switch k {
	case KindNull:
		return "null"
	case KindBoolean:
		return "boolean"
	case KindNumber:
		return "number"
	case KindString:
		return "string"
	case KindArray:
		return "array"
	case KindObject:
		return "object"
	case KindFunction:
		return "function"
	default:
		return "undefined"
	}
}

                                                          
type Level int32

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

                                                                                        
type Vec3 struct{ X, Y, Z float64 }

func V3(x, y, z float64) Vec3       { return Vec3{x, y, z} }
func (a Vec3) Add(b Vec3) Vec3      { return Vec3{a.X + b.X, a.Y + b.Y, a.Z + b.Z} }
func (a Vec3) Sub(b Vec3) Vec3      { return Vec3{a.X - b.X, a.Y - b.Y, a.Z - b.Z} }
func (a Vec3) Scale(k float64) Vec3 { return Vec3{a.X * k, a.Y * k, a.Z * k} }
func (a Vec3) Dot(b Vec3) float64   { return a.X*b.X + a.Y*b.Y + a.Z*b.Z }
func (a Vec3) Cross(b Vec3) Vec3 {
	return Vec3{a.Y*b.Z - a.Z*b.Y, a.Z*b.X - a.X*b.Z, a.X*b.Y - a.Y*b.X}
}
func (a Vec3) Length() float64 { return math.Sqrt(a.Dot(a)) }
func (a Vec3) Normalized() Vec3 {
	length := a.Length()
	if length == 0 {
		return a
	}
	return a.Scale(1 / length)
}

                                                                                            

                                                                                   
type Value struct{ h *handle }

type handle struct{ ref uint32 }

var wrapped uint32

                                                                                              
func wrap(ref uint32) Value {
	check()
	if ref == 0 {
		return Value{}
	}
	h := &handle{ref: hxRetain(ref)}
	runtime.AddCleanup(h, func(ref uint32) { hxRelease(ref) }, h.ref)
	                                                                                          
	                                                                                          
	wrapped++
	if wrapped%4096 == 0 {
		runtime.GC()
		runtime.Gosched()
	}
	return Value{h}
}

                                                                                    
func Wrap(handle uint32) Value { return wrap(handle) }

func (v Value) ref() uint32 {
	if v.h == nil {
		return 0
	}
	return v.h.ref
}

                                                                                                             
func (v Value) Handle() uint32 {
	if v.h == nil {
		return 0
	}
	id := hxPool(v.h.ref)
	runtime.KeepAlive(v.h)
	return id
}

                                                                                               

func (v Value) Kind() Kind {
	kind := Kind(hxType(v.ref()))
	check()
	return kind
}

func (v Value) IsUndefined() bool { return v.h == nil }
func (v Value) IsNull() bool      { return v.Kind() == KindNull }

                                              
func (v Value) IsNone() bool {
	kind := v.Kind()
	return kind == KindUndefined || kind == KindNull
}

func (v Value) IsBool() bool     { return v.Kind() == KindBoolean }
func (v Value) IsNumber() bool   { return v.Kind() == KindNumber }
func (v Value) IsString() bool   { return v.Kind() == KindString }
func (v Value) IsArray() bool    { return v.Kind() == KindArray }
func (v Value) IsObject() bool   { return v.Kind() == KindObject }
func (v Value) IsFunction() bool { return v.Kind() == KindFunction }

                                                                                                

                                                                    
func (v Value) Number() float64 {
	n := hxToNumber(v.ref())
	check()
	return n
}

                                                      
func (v Value) Int() int {
	n := v.Number()
	if math.IsNaN(n) {
		return 0
	}
	return int(n)
}

                                                                                               
func (v Value) Bool() bool {
	b := hxToBoolean(v.ref())
	check()
	return b != 0
}

                                                                                                 
func (v Value) String() string {
	ref := v.ref()
	length := hxStringBytes(ref)
	check()
	if length <= 0 {
		return ""
	}
	buffer := make([]byte, length)
	hxStringRead(ref, &buffer[0], length)
	runtime.KeepAlive(v.h)
	return string(buffer)
}

                      
func (v Value) Vec3() Vec3 {
	return Vec3{v.Get("x").Number(), v.Get("y").Number(), v.Get("z").Number()}
}

                                              
func (v Value) Slice() []Value {
	n := v.Len()
	items := make([]Value, n)
	for i := 0; i < n; i++ {
		items[i] = v.At(i)
	}
	return items
}

                                                                                                

                                                                                   
func (v Value) Get(key string) Value {
	ref := hxGet(v.ref(), key)
	runtime.KeepAlive(v.h)
	return wrap(ref)
}

                        
func (v Value) At(index int) Value {
	ref := hxIndex(v.ref(), int32(index))
	runtime.KeepAlive(v.h)
	return wrap(ref)
}

                                                                                                          
func (v Value) Set(key string, value any) {
	converted := From(value)
	hxSet(v.ref(), key, converted.ref())
	runtime.KeepAlive(v.h)
	runtime.KeepAlive(converted.h)
	check()
}

func (v Value) SetAt(index int, value any) {
	converted := From(value)
	hxSetIndex(v.ref(), int32(index), converted.ref())
	runtime.KeepAlive(v.h)
	runtime.KeepAlive(converted.h)
	check()
}

func (v Value) Has(key string) bool {
	has := hxHas(v.ref(), key)
	runtime.KeepAlive(v.h)
	check()
	return has != 0
}

func (v Value) Delete(key string) {
	hxDelete(v.ref(), key)
	runtime.KeepAlive(v.h)
	check()
}

                                                                                
func (v Value) Len() int {
	n := hxLength(v.ref())
	runtime.KeepAlive(v.h)
	check()
	if n < 0 {
		return 0
	}
	return int(n)
}

                                                                              
func (v Value) Keys() []string {
	keys := wrap(hxKeys(v.ref()))
	runtime.KeepAlive(v.h)
	items := keys.Slice()
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = item.String()
	}
	return out
}

                                                                                         
func (v Value) Path(path string) Value {
	current := v
	for _, part := range strings.Split(path, ".") {
		if part == "" {
			continue
		}
		current = current.Get(part)
	}
	return current
}

                                                              
func (v Value) Call(args ...any) Value {
	handles, keep := convertArgs(args)
	ref := hxCall(v.ref(), first(handles), int32(len(handles)))
	runtime.KeepAlive(v.h)
	runtime.KeepAlive(keep)
	return wrap(ref)
}

                                                                       
func (v Value) Invoke(method string, args ...any) Value {
	handles, keep := convertArgs(args)
	ref := hxInvoke(v.ref(), method, first(handles), int32(len(handles)))
	runtime.KeepAlive(v.h)
	runtime.KeepAlive(keep)
	return wrap(ref)
}

                                    
func (v Value) New(args ...any) Value {
	handles, keep := convertArgs(args)
	ref := hxConstruct(v.ref(), first(handles), int32(len(handles)))
	runtime.KeepAlive(v.h)
	runtime.KeepAlive(keep)
	return wrap(ref)
}

                                                                
func (v Value) Equals(other Value) bool {
	equal := hxEquals(v.ref(), other.ref())
	runtime.KeepAlive(v.h)
	runtime.KeepAlive(other.h)
	check()
	return equal != 0
}

func convertArgs(args []any) ([]uint32, []Value) {
	if len(args) == 0 {
		return nil, nil
	}
	values := make([]Value, len(args))
	handles := make([]uint32, len(args))
	for i, arg := range args {
		values[i] = From(arg)
		handles[i] = values[i].ref()
	}
	return handles, values
}

func first(handles []uint32) *uint32 {
	if len(handles) == 0 {
		return nil
	}
	return &handles[0]
}

                                                                                               

                                  
func Undefined() Value { return Value{} }

                             
func NullValue() Value { return wrap(hxNull()) }

                               
func NewArray() Value { return wrap(hxArray()) }

                                
func NewObject() Value { return wrap(hxObject()) }

                                          
func List(items ...any) Value {
	array := NewArray()
	for i, item := range items {
		array.SetAt(i, item)
	}
	return array
}

                                        
func Map(fields map[string]any) Value {
	object := NewObject()
	for key, value := range fields {
		object.Set(key, value)
	}
	return object
}

                                                                                
func Func(fn func(args []Value) Value) Value {
	nextCallback++
	id := nextCallback
	callbacks[id] = fn
	return wrap(hxCallback(id))
}

                                                                                         
                                                                            
func From(x any) Value {
	switch v := x.(type) {
	case nil:
		return NullValue()
	case Value:
		return v
	case *Value:
		if v == nil {
			return NullValue()
		}
		return *v
	case bool:
		if v {
			return wrap(hxBoolean(1))
		}
		return wrap(hxBoolean(0))
	case float64:
		return wrap(hxNumber(v))
	case float32:
		return wrap(hxNumber(float64(v)))
	case int:
		return wrap(hxNumber(float64(v)))
	case int8:
		return wrap(hxNumber(float64(v)))
	case int16:
		return wrap(hxNumber(float64(v)))
	case int32:
		return wrap(hxNumber(float64(v)))
	case int64:
		return wrap(hxNumber(float64(v)))
	case uint:
		return wrap(hxNumber(float64(v)))
	case uint8:
		return wrap(hxNumber(float64(v)))
	case uint16:
		return wrap(hxNumber(float64(v)))
	case uint32:
		return wrap(hxNumber(float64(v)))
	case uint64:
		return wrap(hxNumber(float64(v)))
	case string:
		return wrap(hxString(v))
	case Vec3:
		object := NewObject()
		object.Set("x", v.X)
		object.Set("y", v.Y)
		object.Set("z", v.Z)
		return object
	case []Value:
		array := NewArray()
		for i, item := range v {
			array.SetAt(i, item)
		}
		return array
	case []any:
		return List(v...)
	case []float64:
		array := NewArray()
		for i, item := range v {
			array.SetAt(i, item)
		}
		return array
	case []int:
		array := NewArray()
		for i, item := range v {
			array.SetAt(i, item)
		}
		return array
	case []string:
		array := NewArray()
		for i, item := range v {
			array.SetAt(i, item)
		}
		return array
	case map[string]any:
		return Map(v)
	case func(args []Value) Value:
		return Func(v)
	case func(args []Value):
		return Func(func(args []Value) Value {
			v(args)
			return Value{}
		})
	case func():
		return Func(func([]Value) Value {
			v()
			return Value{}
		})
	case fmt.Stringer:
		return wrap(hxString(v.String()))
	case error:
		return wrap(hxString(v.Error()))
	default:
		panic(EngineError(fmt.Sprintf("helix.From: não sei converter um %T para a engine; use float64, string, bool, Vec3, Value, slices ou map[string]any.", x)))
	}
}

                                                                                              

var (
	callbacks    = map[uint32]func(args []Value) Value{}
	nextCallback uint32
)

                                                                       
  
                                    
func invokeCallback(id uint32, args uint32) uint32 {
	fn, ok := callbacks[id]
	if !ok {
		return 0
	}
	result := fn(Wrap(args).Slice())
	return result.Handle()
}

                                                                                       
  
                                  
func dropCallback(id uint32) {
	delete(callbacks, id)
}

                                                                                                 

                                                                                          
func Root() Value { return wrap(hxRoot()) }

                                                                                 
func Self() Value { return wrap(hxSelf()) }

                                                                          
func Script() Value { return wrap(hxScript()) }

                                                                                                      
func Require(name string) Value { return wrap(hxRequire(name)) }

                                                      
func Now() float64 { return hxNow() }

                                                      
func Log(level Level, message string) { hxLog(int32(level), message) }

func Print(args ...any)                 { hxLog(int32(LevelInfo), fmt.Sprint(args...)) }
func Printf(format string, args ...any) { hxLog(int32(LevelInfo), fmt.Sprintf(format, args...)) }
func Warn(args ...any)                  { hxLog(int32(LevelWarn), fmt.Sprint(args...)) }
func Warnf(format string, args ...any)  { hxLog(int32(LevelWarn), fmt.Sprintf(format, args...)) }
func Error(args ...any)                 { hxLog(int32(LevelError), fmt.Sprint(args...)) }
func Errorf(format string, args ...any) { hxLog(int32(LevelError), fmt.Sprintf(format, args...)) }
func Debug(args ...any)                 { hxLog(int32(LevelDebug), fmt.Sprint(args...)) }
func Debugf(format string, args ...any) { hxLog(int32(LevelDebug), fmt.Sprintf(format, args...)) }

                                                                                         
func Throw(message string) { panic(EngineError(message)) }

                                    
func Throwf(format string, args ...any) { panic(EngineError(fmt.Sprintf(format, args...))) }
