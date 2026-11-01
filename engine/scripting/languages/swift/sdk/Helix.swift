                                                   
  
                                                                             
                                                                              
                                                                                
                                                                               
                                                                                     
                                                                        
                                                                        
                                 
  
                                                                           
                                                                        
                                                           

                                                                                             

@_extern(wasm, module: "helix", name: "retain") @_extern(c) func hx_retain(_ r: UInt32) -> UInt32
@_extern(wasm, module: "helix", name: "release") @_extern(c) func hx_release(_ r: UInt32)
@_extern(wasm, module: "helix", name: "type") @_extern(c) func hx_type(_ r: UInt32) -> Int32
@_extern(wasm, module: "helix", name: "equals") @_extern(c) func hx_equals(_ a: UInt32, _ b: UInt32) -> Int32
@_extern(wasm, module: "helix", name: "root") @_extern(c) func hx_root() -> UInt32
@_extern(wasm, module: "helix", name: "script") @_extern(c) func hx_script() -> UInt32
@_extern(wasm, module: "helix", name: "self") @_extern(c) func hx_self() -> UInt32
@_extern(wasm, module: "helix", name: "require") @_extern(c) func hx_require(_ ptr: UnsafePointer<UInt8>?, _ len: Int) -> UInt32
@_extern(wasm, module: "helix", name: "number") @_extern(c) func hx_number(_ v: Double) -> UInt32
@_extern(wasm, module: "helix", name: "boolean") @_extern(c) func hx_boolean(_ v: Int32) -> UInt32
@_extern(wasm, module: "helix", name: "string") @_extern(c) func hx_string(_ ptr: UnsafePointer<UInt8>?, _ len: Int) -> UInt32
@_extern(wasm, module: "helix", name: "null") @_extern(c) func hx_null() -> UInt32
@_extern(wasm, module: "helix", name: "array") @_extern(c) func hx_array() -> UInt32
@_extern(wasm, module: "helix", name: "object") @_extern(c) func hx_object() -> UInt32
@_extern(wasm, module: "helix", name: "callback") @_extern(c) func hx_callback(_ id: UInt32) -> UInt32
@_extern(wasm, module: "helix", name: "pool") @_extern(c) func hx_pool(_ r: UInt32) -> UInt32
@_extern(wasm, module: "helix", name: "to_number") @_extern(c) func hx_to_number(_ r: UInt32) -> Double
@_extern(wasm, module: "helix", name: "to_boolean") @_extern(c) func hx_to_boolean(_ r: UInt32) -> Int32
@_extern(wasm, module: "helix", name: "string_bytes") @_extern(c) func hx_string_bytes(_ r: UInt32) -> Int
@_extern(wasm, module: "helix", name: "string_read") @_extern(c) func hx_string_read(_ r: UInt32, _ ptr: UnsafeMutablePointer<UInt8>?, _ cap: Int) -> Int
@_extern(wasm, module: "helix", name: "get") @_extern(c) func hx_get(_ o: UInt32, _ ptr: UnsafePointer<UInt8>?, _ len: Int) -> UInt32
@_extern(wasm, module: "helix", name: "index") @_extern(c) func hx_index(_ o: UInt32, _ i: Int32) -> UInt32
@_extern(wasm, module: "helix", name: "set") @_extern(c) func hx_set(_ o: UInt32, _ ptr: UnsafePointer<UInt8>?, _ len: Int, _ v: UInt32)
@_extern(wasm, module: "helix", name: "set_index") @_extern(c) func hx_set_index(_ o: UInt32, _ i: Int32, _ v: UInt32)
@_extern(wasm, module: "helix", name: "has") @_extern(c) func hx_has(_ o: UInt32, _ ptr: UnsafePointer<UInt8>?, _ len: Int) -> Int32
@_extern(wasm, module: "helix", name: "delete") @_extern(c) func hx_delete(_ o: UInt32, _ ptr: UnsafePointer<UInt8>?, _ len: Int)
@_extern(wasm, module: "helix", name: "length") @_extern(c) func hx_length(_ o: UInt32) -> Int32
@_extern(wasm, module: "helix", name: "keys") @_extern(c) func hx_keys(_ o: UInt32) -> UInt32
@_extern(wasm, module: "helix", name: "call") @_extern(c) func hx_call(_ f: UInt32, _ args: UnsafePointer<UInt32>?, _ count: Int32) -> UInt32
@_extern(wasm, module: "helix", name: "invoke") @_extern(c) func hx_invoke(_ o: UInt32, _ ptr: UnsafePointer<UInt8>?, _ len: Int, _ args: UnsafePointer<UInt32>?, _ count: Int32) -> UInt32
@_extern(wasm, module: "helix", name: "construct") @_extern(c) func hx_construct(_ c: UInt32, _ args: UnsafePointer<UInt32>?, _ count: Int32) -> UInt32
@_extern(wasm, module: "helix", name: "log") @_extern(c) func hx_log(_ level: Int32, _ ptr: UnsafePointer<UInt8>?, _ len: Int)
@_extern(wasm, module: "helix", name: "now") @_extern(c) func hx_now() -> Double
@_extern(wasm, module: "helix", name: "fault_cell") @_extern(c) func hx_fault_cell(_ ptr: UnsafeMutablePointer<UInt32>?)
@_extern(wasm, module: "helix", name: "fault_take") @_extern(c) func hx_fault_take(_ ptr: UnsafeMutablePointer<UInt8>?, _ cap: Int) -> Int

                                                                                           

                                                                                                                         
                                                                                                           
private let hxFault: UnsafeMutablePointer<UInt32> = {
  let cell = UnsafeMutablePointer<UInt32>.allocate(capacity: 1)
  cell.initialize(to: 0)
  hx_fault_cell(cell)
  return cell
}()

@inline(__always) func hxReady() {
  _ = hxFault
}

                                                                                                                                     
@inline(__always) func hxCheck<T>(_ value: T, _ file: StaticString, _ line: UInt) -> T {
  if hxFault.pointee != 0 { hxFail(file, line) }
  return value
}

func hxFail(_ file: StaticString, _ line: UInt) -> Never {
  var buffer = [UInt8](repeating: 0, count: 2048)
  let length = buffer.withUnsafeMutableBufferPointer { hx_fault_take($0.baseAddress, $0.count) }
  let message = String(decoding: buffer[0..<min(length, buffer.count)], as: UTF8.self)
  fatalError(message, file: file, line: line)
}

@inline(__always) func hxWithBytes<R>(_ text: String, _ body: (UnsafePointer<UInt8>?, Int) -> R) -> R {
  var copy = text
  return copy.withUTF8 { body($0.baseAddress, $0.count) }
}

                                                                                           

                                                          
public enum Kind: Int32 {
  case undefined = 0, null = 1, boolean = 2, number = 3, string = 4, array = 5, object = 6, function = 7

  init(code: Int32) {
    self = Kind(rawValue: code) ?? .undefined
  }
}

                                                
public enum Level: Int32 {
  case debug = 0, info = 1, warn = 2, error = 3
}

                                                                                   
public struct Vec3: Equatable, CustomStringConvertible, ValueConvertible {
  public var x: Double
  public var y: Double
  public var z: Double

  public static let zero = Vec3(0, 0, 0)

  public init(_ x: Double, _ y: Double, _ z: Double) {
    self.x = x
    self.y = y
    self.z = z
  }

  public init(x: Double = 0, y: Double = 0, z: Double = 0) {
    self.init(x, y, z)
  }

  public var length: Double { (x * x + y * y + z * z).squareRoot() }

  public var normalized: Vec3 {
    let len = length
    return len == 0 ? self : self * (1 / len)
  }

  public func dot(_ o: Vec3) -> Double { x * o.x + y * o.y + z * o.z }

  public func cross(_ o: Vec3) -> Vec3 { Vec3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x) }

  public var description: String { "(\(x), \(y), \(z))" }

  public static func + (a: Vec3, b: Vec3) -> Vec3 { Vec3(a.x + b.x, a.y + b.y, a.z + b.z) }
  public static func - (a: Vec3, b: Vec3) -> Vec3 { Vec3(a.x - b.x, a.y - b.y, a.z - b.z) }
  public static func * (a: Vec3, k: Double) -> Vec3 { Vec3(a.x * k, a.y * k, a.z * k) }
  public static func * (k: Double, a: Vec3) -> Vec3 { a * k }
  public static prefix func - (a: Vec3) -> Vec3 { Vec3(-a.x, -a.y, -a.z) }
  public static func += (a: inout Vec3, b: Vec3) { a = a + b }
  public static func -= (a: inout Vec3, b: Vec3) { a = a - b }

  public var value: Value {
    let object = Value.object()
    object.set("x", x)
    object.set("y", y)
    object.set("z", z)
    return object
  }
}

                                                                                           

                                                                                              

                                                                            

                                                                                             

                                                                                                                       
public protocol ValueConvertible {
  var value: Value { get }
}













                                                                                             


                                                                                    

                                                                                        

                                                                                                 

                                                                                                

                                                                                   

                                                                                             

                                                                                      
                                                                                          
                                                                                                
