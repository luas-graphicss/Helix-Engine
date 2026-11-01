                                                   
  
                                                                             
                                                                              
                                                                                
                                                                               
                                                                                     
                                                                        
                                                                        
                                 
  
                                                                           
                                                                        
                                                           

                                                                                             

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

                                                                                           

                                                                                              
public final class Value: CustomStringConvertible, Equatable, Sequence, ValueConvertible, ExpressibleByFloatLiteral, ExpressibleByIntegerLiteral, ExpressibleByBooleanLiteral, ExpressibleByStringLiteral, ExpressibleByNilLiteral {
                                                            
  public let handle: UInt32

                                         
  init(owned handle: UInt32) {
    self.handle = handle
  }

                                                                                                    
  public init(adopting raw: UInt32, file: StaticString = #fileID, line: UInt = #line) {
    hxReady()
    handle = raw == 0 ? 0 : hxCheck(hx_retain(raw), file, line)
  }

  deinit {
    if handle != 0 { hx_release(handle) }
  }

  @inline(__always) static func acquire(_ raw: UInt32, _ file: StaticString, _ line: UInt) -> Value {
    Value(adopting: raw, file: file, line: line)
  }

                  
  public static let undefined = Value(owned: 0)

  public static func null() -> Value {
    hxReady()
    return Value(owned: hx_null())
  }

  public static func array() -> Value {
    hxReady()
    return Value(owned: hx_array())
  }

  public static func object() -> Value {
    hxReady()
    return Value(owned: hx_object())
  }

                                                                                  
  public static func object(_ fields: [String: ValueConvertible]) -> Value {
    let object = Value.object()
    for (key, item) in fields { object.set(key, item) }
    return object
  }

                                   
  public static func list(_ items: [ValueConvertible]) -> Value {
    let array = Value.array()
    for (index, item) in items.enumerated() { array.set(index, item) }
    return array
  }

                                                                                                                    
  public static func function(file: StaticString = #fileID, line: UInt = #line, _ body: @escaping ([Value]) -> ValueConvertible) -> Value {
    hxReady()
    let id = HelixCallbacks.register(body)
    return hxCheck(Value(owned: hx_callback(id)), file, line)
  }

                                                                                                                         
  public func intoRaw() -> UInt32 {
    handle == 0 ? 0 : hx_pool(handle)
  }

                                                                                                          
  public convenience init(floatLiteral value: Double) { hxReady(); self.init(owned: hx_number(value)) }
  public convenience init(integerLiteral value: Int) { hxReady(); self.init(owned: hx_number(Double(value))) }
  public convenience init(booleanLiteral value: Bool) { hxReady(); self.init(owned: hx_boolean(value ? 1 : 0)) }
  public convenience init(stringLiteral value: String) { hxReady(); self.init(owned: hxWithBytes(value) { hx_string($0, $1) }) }
  public convenience init(nilLiteral: ()) { hxReady(); self.init(owned: hx_null()) }

                                                                                             

  public func kind(file: StaticString = #fileID, line: UInt = #line) -> Kind {
    Kind(code: hxCheck(hx_type(handle), file, line))
  }

  public var kind: Kind { kind() }
  public var isUndefined: Bool { handle == 0 }
  public var isNull: Bool { kind == .null }
                            
  public var isNone: Bool { let k = kind; return k == .undefined || k == .null }
  public var isBool: Bool { kind == .boolean }
  public var isNumber: Bool { kind == .number }
  public var isString: Bool { kind == .string }
  public var isArray: Bool { kind == .array }
  public var isObject: Bool { kind == .object }
  public var isFunction: Bool { kind == .function }

                                                                                              

                                                               
  public var number: Double { hxCheck(hx_to_number(handle), #fileID, #line) }

                                                  
  public var int: Int {
    let n = number
    return n.isNaN ? 0 : Int(n)
  }

                                                                                                
  public var bool: Bool { hxCheck(hx_to_boolean(handle), #fileID, #line) != 0 }

                                                                                         
  public var string: String {
    hxReady()
    let length = hx_string_bytes(handle)
    if length <= 0 { return "" }
    var buffer = [UInt8](repeating: 0, count: length)
    _ = buffer.withUnsafeMutableBufferPointer { hx_string_read(handle, $0.baseAddress, $0.count) }
    return String(decoding: buffer, as: UTF8.self)
  }

                              
  public var vec3: Vec3 { Vec3(get("x").number, get("y").number, get("z").number) }

                                              
  public var array: [Value] { Array(self) }

  public var description: String { string }

                                                                                              

                                                                                    
  public func get(_ key: String, file: StaticString = #fileID, line: UInt = #line) -> Value {
    hxReady()
    return hxWithBytes(key) { Value.acquire(hxCheck(hx_get(handle, $0, $1), file, line), file, line) }
  }

                      
  public func at(_ index: Int, file: StaticString = #fileID, line: UInt = #line) -> Value {
    hxReady()
    return Value.acquire(hxCheck(hx_index(handle, Int32(index)), file, line), file, line)
  }

                                                                                                       
  public func set(_ key: String, _ value: ValueConvertible, file: StaticString = #fileID, line: UInt = #line) {
    hxReady()
    let item = value.value
    hxWithBytes(key) { hxCheck(hx_set(handle, $0, $1, item.handle), file, line) }
  }

  public func set(_ index: Int, _ value: ValueConvertible, file: StaticString = #fileID, line: UInt = #line) {
    hxReady()
    let item = value.value
    hxCheck(hx_set_index(handle, Int32(index), item.handle), file, line)
  }

  public subscript(key: String, file: StaticString = #fileID, line: UInt = #line) -> Value {
    get { get(key, file: file, line: line) }
    set { set(key, newValue, file: file, line: line) }
  }

  public subscript(index: Int, file: StaticString = #fileID, line: UInt = #line) -> Value {
    get { at(index, file: file, line: line) }
    set { set(index, newValue, file: file, line: line) }
  }

  public func has(_ key: String, file: StaticString = #fileID, line: UInt = #line) -> Bool {
    hxReady()
    return hxWithBytes(key) { hxCheck(hx_has(handle, $0, $1), file, line) } != 0
  }

  public func delete(_ key: String, file: StaticString = #fileID, line: UInt = #line) {
    hxReady()
    hxWithBytes(key) { hxCheck(hx_delete(handle, $0, $1), file, line) }
  }

                                                                     
  public var count: Int { Int(Swift.max(0, hxCheck(hx_length(handle), #fileID, #line))) }

  public var isEmpty: Bool { count == 0 }

                                                                       
  public var keys: [String] {
    hxReady()
    let list = Value.acquire(hxCheck(hx_keys(handle), #fileID, #line), #fileID, #line)
    return list.map { $0.string }
  }

                                                                                 
  public func path(_ path: String, file: StaticString = #fileID, line: UInt = #line) -> Value {
    var current = self
    for part in path.split(separator: ".") where !part.isEmpty {
      current = current.get(String(part), file: file, line: line)
    }
    return current
  }

                                                              
  @discardableResult
  public func call(_ args: ValueConvertible..., file: StaticString = #fileID, line: UInt = #line) -> Value {
    call(arguments: args, file: file, line: line)
  }

  @discardableResult
  public func call(arguments args: [ValueConvertible], file: StaticString = #fileID, line: UInt = #line) -> Value {
    hxReady()
    return hxWithHandles(args) { handles, count in Value.acquire(hxCheck(hx_call(handle, handles, count), file, line), file, line) }
  }

                                                                 
  @discardableResult
  public func invoke(_ method: String, _ args: ValueConvertible..., file: StaticString = #fileID, line: UInt = #line) -> Value {
    invoke(method, arguments: args, file: file, line: line)
  }

  @discardableResult
  public func invoke(_ method: String, arguments args: [ValueConvertible], file: StaticString = #fileID, line: UInt = #line) -> Value {
    hxReady()
    return hxWithHandles(args) { handles, count in
      hxWithBytes(method) { Value.acquire(hxCheck(hx_invoke(handle, $0, $1, handles, count), file, line), file, line) }
    }
  }

                                 
  @discardableResult
  public func construct(_ args: ValueConvertible..., file: StaticString = #fileID, line: UInt = #line) -> Value {
    hxReady()
    return hxWithHandles(args) { handles, count in Value.acquire(hxCheck(hx_construct(handle, handles, count), file, line), file, line) }
  }

                                                         
  public func equals(_ other: Value, file: StaticString = #fileID, line: UInt = #line) -> Bool {
    hxCheck(hx_equals(handle, other.handle), file, line) != 0
  }

  public static func == (a: Value, b: Value) -> Bool { a.equals(b) }

                                                                                             

  public struct Iterator: IteratorProtocol {
    let value: Value
    let length: Int
    var index = 0

    public mutating func next() -> Value? {
      guard index < length else { return nil }
      defer { index += 1 }
      return value.at(index)
    }
  }

  public func makeIterator() -> Iterator { Iterator(value: self, length: kind == .string ? 0 : count) }

  public var value: Value { self }
}

                                                                            
@inline(__always) func hxWithHandles<R>(_ args: [ValueConvertible], _ body: (UnsafePointer<UInt32>?, Int32) -> R) -> R {
  let values = args.map { $0.value }
  let handles = values.map { $0.handle }
  return withExtendedLifetime(values) {
    handles.withUnsafeBufferPointer { body($0.baseAddress, Int32($0.count)) }
  }
}

                                                                                             

                                                                                                                       
public protocol ValueConvertible {
  var value: Value { get }
}

extension Double: ValueConvertible {
  public var value: Value { hxReady(); return Value(owned: hx_number(self)) }
}

extension Float: ValueConvertible {
  public var value: Value { Double(self).value }
}

extension Int: ValueConvertible {
  public var value: Value { Double(self).value }
}

extension Int32: ValueConvertible {
  public var value: Value { Double(self).value }
}

extension UInt32: ValueConvertible {
  public var value: Value { Double(self).value }
}

extension Int64: ValueConvertible {
  public var value: Value { Double(self).value }
}

extension Bool: ValueConvertible {
  public var value: Value { hxReady(); return Value(owned: hx_boolean(self ? 1 : 0)) }
}

extension String: ValueConvertible {
  public var value: Value {
    hxReady()
    return hxWithBytes(self) { Value(owned: hx_string($0, $1)) }
  }
}

extension Substring: ValueConvertible {
  public var value: Value { String(self).value }
}

extension Array: ValueConvertible where Element: ValueConvertible {
  public var value: Value { Value.list(self.map { $0 as ValueConvertible }) }
}

extension Dictionary: ValueConvertible where Key == String, Value: ValueConvertible {
  public var value: Helix.Value {
    let object = Helix.Value.object()
    for (key, item) in self { object.set(key, item) }
    return object
  }
}

extension Optional: ValueConvertible where Wrapped: ValueConvertible {
  public var value: Value {
    switch self {
    case .some(let wrapped): return wrapped.value
    case .none: return Value.null()
    }
  }
}

                                                                                             

enum HelixCallbacks {
  static var table: [UInt32: ([Value]) -> ValueConvertible] = [:]
  static var next: UInt32 = 1

  static func register(_ body: @escaping ([Value]) -> ValueConvertible) -> UInt32 {
    let id = next
    next = next &+ 1
    if next == 0 { next = 1 }
    table[id] = body
    return id
  }
}

                                                                                    
@_expose(wasm, "__hx_invoke_callback")
@_cdecl("__hx_invoke_callback")
func __hx_invoke_callback(_ id: UInt32, _ args: UInt32) -> UInt32 {
  guard let body = HelixCallbacks.table[id] else { return 0 }
  let list = Value(adopting: args).array
  return body(list).value.intoRaw()
}

                                                                                        
@_expose(wasm, "__hx_drop_callback")
@_cdecl("__hx_drop_callback")
func __hx_drop_callback(_ id: UInt32) {
  HelixCallbacks.table[id] = nil
}

                                                                                                 

                                                                                                
public enum Helix {
  public typealias Value = HelixScript.Value

                                                                                               
  public static var root: Value {
    hxReady()
    return Value.acquire(hxCheck(hx_root(), #fileID, #line), #fileID, #line)
  }

                                                                                
  public static var entity: Value {
    hxReady()
    return Value.acquire(hxCheck(hx_self(), #fileID, #line), #fileID, #line)
  }

                                                                     
  public static var script: Value {
    hxReady()
    return Value.acquire(hxCheck(hx_script(), #fileID, #line), #fileID, #line)
  }

                                                                                                 
  @discardableResult
  public static func require(_ name: String, file: StaticString = #fileID, line: UInt = #line) -> Value {
    hxReady()
    return hxWithBytes(name) { Value.acquire(hxCheck(hx_require($0, $1), file, line), file, line) }
  }

                                             
  public static func now() -> Double {
    hxReady()
    return hx_now()
  }

  public static func log(_ level: Level, _ message: String) {
    hxReady()
    hxWithBytes(message) { hx_log(level.rawValue, $0, $1) }
  }

                                                                                       
  public static func log(_ parts: Any...) { log(.info, join(parts)) }
  public static func debug(_ parts: Any...) { log(.debug, join(parts)) }
  public static func warn(_ parts: Any...) { log(.warn, join(parts)) }
  public static func error(_ parts: Any...) { log(.error, join(parts)) }

                                                                                      
  public static func fail(_ message: String, file: StaticString = #fileID, line: UInt = #line) -> Never {
    fatalError(message, file: file, line: line)
  }

  public static func vec3(_ x: Double, _ y: Double, _ z: Double) -> Vec3 { Vec3(x, y, z) }

  static func join(_ parts: [Any]) -> String {
    parts.map { part -> String in
      if let value = part as? Value { return value.string }
      if let text = part as? String { return text }
      return String(describing: part)
    }.joined(separator: " ")
  }
}

                                                                                   
public func log(_ parts: Any...) { Helix.log(.info, Helix.join(parts)) }
public func warn(_ parts: Any...) { Helix.log(.warn, Helix.join(parts)) }
@discardableResult
public func require(_ name: String, file: StaticString = #fileID, line: UInt = #line) -> Value { Helix.require(name, file: file, line: line) }

                                                                                             

                                                                                      
                                                                                          
                                                                                                
open class Script {
  public init() {}

                                                        
  public var helix: Value { Helix.root }
                                     
  public var entity: Value { Helix.entity }
                                                                      
  public var script: Value { Helix.script }

  public func log(_ parts: Any...) { Helix.log(.info, Helix.join(parts)) }
  public func warn(_ parts: Any...) { Helix.log(.warn, Helix.join(parts)) }
  @discardableResult
  public func require(_ name: String, file: StaticString = #fileID, line: UInt = #line) -> Value { Helix.require(name, file: file, line: line) }

                  
  open func onLoad() {}
  open func onStart() {}
  open func onUpdate(_ dt: Double) {}
  open func onFixedUpdate(_ h: Double) {}
  open func onLateUpdate(_ dt: Double) {}
  open func onRender(_ frame: Value) {}
  open func onEnable() {}
  open func onDisable() {}
  open func onStop() {}
  open func onDestroy() {}
                                                                                 
  open func onBeforeHotReload() -> Value { Value.undefined }
  open func onHotReload(_ previousState: Value) {}

            
  open func onCollisionBegin(_ other: Value, _ contact: Value) {}
  open func onCollisionStay(_ other: Value, _ contact: Value) {}
  open func onCollisionEnd(_ other: Value) {}
  open func onTriggerEnter(_ other: Value) {}
  open func onTriggerStay(_ other: Value) {}
  open func onTriggerExit(_ other: Value) {}
}
