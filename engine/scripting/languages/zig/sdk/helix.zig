//! `helix`: a API da Helix Engine para scripts Zig.
//!
//! Tudo o que o JavaScript vê em `helix` chega ao Zig como um `Value`: uma
//! referência contada a um valor vivo da engine, lida e escrita por reflexão
//! (`get`, `set`, `call`, `invoke`). Um `Value` vale enquanto não for solto
//! com `deinit`, inclusive guardado numa variável global; o que a engine
//! entrega a um hook e não é retido some quando o hook termina.
//!
//! Um script é um arquivo comum: cada `pub fn` do nível do arquivo é exportada
//! para a engine. As com nome de hook (`onStart`, `onUpdate(dt: f64)`,
//! `onCollisionBegin(other: Value, contact: Value)`…) são chamadas pelo
//! runtime; as demais ficam disponíveis a outros scripts por `require("Nome")`.
//! Parâmetros e retornos podem ser `f64`, `f32`, `i32`, `u32`, `i64`, `u64`,
//! `bool`, `Value`, `Vec3` e, no retorno, `[]const u8`.
//!
//! Erros da engine (ler um campo de `undefined`, chamar um método que não
//! existe) viram um panic com a mensagem da engine; a execução do hook termina
//! e o erro vai ao console, com a pilha de funções Zig.
//!
//! ```zig
//! const helix = @import("helix");
//!
//! var angulo: f64 = 0;
//!
//! pub fn onStart() void {
//!     helix.print("acordei em {f}", .{helix.root().path("scene.name")});
//! }
//!
//! pub fn onUpdate(dt: f64) void {
//!     angulo += dt;
//!     helix.actor().path("transform").set("rotation", helix.Vec3.init(0, angulo, 0));
//! }
//! ```

const std = @import("std");
const wasi = std.os.wasi;

                                                                           
pub const allocator: std.mem.Allocator = std.heap.wasm_allocator;

                                                                                                  

const ffi = struct {
    pub extern "helix" fn retain(ref: u32) u32;
    pub extern "helix" fn release(ref: u32) void;
    pub extern "helix" fn @"type"(ref: u32) i32;
    pub extern "helix" fn equals(a: u32, b: u32) i32;
    pub extern "helix" fn root() u32;
    pub extern "helix" fn script() u32;
    pub extern "helix" fn self() u32;
    pub extern "helix" fn require(ptr: [*]const u8, len: usize) u32;
    pub extern "helix" fn number(value: f64) u32;
    pub extern "helix" fn boolean(value: i32) u32;
    pub extern "helix" fn string(ptr: [*]const u8, len: usize) u32;
    pub extern "helix" fn @"null"() u32;
    pub extern "helix" fn array() u32;
    pub extern "helix" fn object() u32;
    pub extern "helix" fn callback(id: u32) u32;
    pub extern "helix" fn pool(ref: u32) u32;
    pub extern "helix" fn to_number(ref: u32) f64;
    pub extern "helix" fn to_boolean(ref: u32) i32;
    pub extern "helix" fn string_bytes(ref: u32) usize;
    pub extern "helix" fn string_read(ref: u32, ptr: [*]u8, cap: usize) usize;
    pub extern "helix" fn get(object: u32, ptr: [*]const u8, len: usize) u32;
    pub extern "helix" fn index(object: u32, at: i32) u32;
    pub extern "helix" fn set(object: u32, ptr: [*]const u8, len: usize, value: u32) void;
    pub extern "helix" fn set_index(object: u32, at: i32, value: u32) void;
    pub extern "helix" fn has(object: u32, ptr: [*]const u8, len: usize) i32;
    pub extern "helix" fn delete(object: u32, ptr: [*]const u8, len: usize) void;
    pub extern "helix" fn length(object: u32) i32;
    pub extern "helix" fn keys(object: u32) u32;
    pub extern "helix" fn call(function: u32, args: [*]const u32, count: i32) u32;
    pub extern "helix" fn invoke(object: u32, ptr: [*]const u8, len: usize, args: [*]const u32, count: i32) u32;
    pub extern "helix" fn construct(ctor: u32, args: [*]const u32, count: i32) u32;
    pub extern "helix" fn log(level: i32, ptr: [*]const u8, len: usize) void;
    pub extern "helix" fn now() f64;
    pub extern "helix" fn fault_cell(ptr: *const u32) void;
    pub extern "helix" fn fault_take(ptr: [*]u8, cap: usize) usize;
};

                                                                                                

                                                                                                     
var fault: u32 = 0;
var fault_cell_registered = false;

inline fn ready() void {
    if (!fault_cell_registered) {
        fault_cell_registered = true;
        ffi.fault_cell(&fault);
    }
}

                                                                                                            
inline fn check(value: anytype) @TypeOf(value) {
    if (fault != 0) fail();
    return value;
}

fn fail() noreturn {
    @branchHint(.cold);
    var buffer: [2048]u8 = undefined;
    const length = ffi.fault_take(&buffer, buffer.len);
    @panic(buffer[0..@min(length, buffer.len)]);
}

fn writeStderr(text: []const u8) void {
    const iov = [_]wasi.ciovec_t{.{ .base = text.ptr, .len = text.len }};
    var written: usize = 0;
    _ = wasi.fd_write(2, &iov, 1, &written);
}

                                                                                                 
                                                                                 
fn helixPanic(message: []const u8, first_trace_addr: ?usize) noreturn {
    _ = first_trace_addr;
    writeStderr("panic: ");
    writeStderr(message);
    writeStderr("\n");
    @trap();
}

                                                                                                      
pub const panic = std.debug.FullPanic(helixPanic);

                                                                                                

                                                                                                   
pub const Kind = enum(i32) {
    none = 0,
    nil = 1,
    boolean = 2,
    number = 3,
    string = 4,
    array = 5,
    object = 6,
    function = 7,

    fn fromCode(code: i32) Kind {
        return if (code >= 0 and code <= 7) @enumFromInt(code) else .none;
    }
};

                                                
pub const Level = enum(i32) {
    debug = 0,
    info = 1,
    warn = 2,
    err = 3,
};

                                                                           
pub const Vec3 = struct {
    x: f64 = 0,
    y: f64 = 0,
    z: f64 = 0,

    pub const zero: Vec3 = .{};
    pub const one: Vec3 = .{ .x = 1, .y = 1, .z = 1 };
    pub const up: Vec3 = .{ .y = 1 };
    pub const down: Vec3 = .{ .y = -1 };
    pub const forward: Vec3 = .{ .z = -1 };
    pub const back: Vec3 = .{ .z = 1 };
    pub const right: Vec3 = .{ .x = 1 };
    pub const left: Vec3 = .{ .x = -1 };

    pub fn init(x: f64, y: f64, z: f64) Vec3 {
        return .{ .x = x, .y = y, .z = z };
    }

    pub fn add(a: Vec3, b: Vec3) Vec3 {
        return .{ .x = a.x + b.x, .y = a.y + b.y, .z = a.z + b.z };
    }

    pub fn sub(a: Vec3, b: Vec3) Vec3 {
        return .{ .x = a.x - b.x, .y = a.y - b.y, .z = a.z - b.z };
    }

    pub fn scale(v: Vec3, factor: f64) Vec3 {
        return .{ .x = v.x * factor, .y = v.y * factor, .z = v.z * factor };
    }

    pub fn neg(v: Vec3) Vec3 {
        return .{ .x = -v.x, .y = -v.y, .z = -v.z };
    }

    pub fn dot(a: Vec3, b: Vec3) f64 {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    pub fn cross(a: Vec3, b: Vec3) Vec3 {
        return .{ .x = a.y * b.z - a.z * b.y, .y = a.z * b.x - a.x * b.z, .z = a.x * b.y - a.y * b.x };
    }

    pub fn length(v: Vec3) f64 {
        return @sqrt(v.dot(v));
    }

    pub fn normalized(v: Vec3) Vec3 {
        const len = v.length();
        return if (len == 0) v else v.scale(1 / len);
    }

    pub fn distanceTo(a: Vec3, b: Vec3) f64 {
        return a.sub(b).length();
    }

    pub fn lerp(a: Vec3, b: Vec3, t: f64) Vec3 {
        return .{ .x = a.x + (b.x - a.x) * t, .y = a.y + (b.y - a.y) * t, .z = a.z + (b.z - a.z) * t };
    }

    pub fn format(v: Vec3, writer: *std.Io.Writer) std.Io.Writer.Error!void {
        try writer.print("({d}, {d}, {d})", .{ v.x, v.y, v.z });
    }
};

                                                                                                

                                                                                       
                                                                                     
                                                                                 
                                                   
pub const Value = struct {
    handle: u32 = 0,

    pub const none: Value = .{ .handle = 0 };

                                                                                                  

                                                                                             
                                                                                             
                                                                                          
                                                                                                   
    pub fn from(value: anytype) Value {
        const T = @TypeOf(value);
        if (T == Value) return value.clone();
        if (T == Vec3) {
            const out = Value.object();
            out.set("x", value.x);
            out.set("y", value.y);
            out.set("z", value.z);
            return out;
        }
        if (T == Callback) return Value.function(value);
        return switch (@typeInfo(T)) {
            .comptime_float, .float => Value.ofNumber(@floatCast(value)),
            .comptime_int, .int => Value.ofNumber(@floatFromInt(value)),
            .bool => Value.ofBool(value),
            .null, .void => Value.nil(),
            .optional => if (value) |payload| Value.from(payload) else Value.nil(),
            .@"enum" => Value.ofString(@tagName(value)),
            .enum_literal => Value.ofString(@tagName(value)),
            .pointer => |pointer| switch (pointer.size) {
                .slice => if (pointer.child == u8) Value.ofString(value) else Value.list(value),
                .one => switch (@typeInfo(pointer.child)) {
                    .array => |elements| if (elements.child == u8) Value.ofString(value) else Value.list(value),
                    .@"fn" => Value.function(value),
                    else => Value.from(value.*),
                },
                else => @compileError("helix.Value.from não aceita " ++ @typeName(T)),
            },
            .array => |elements| if (elements.child == u8) Value.ofString(&value) else Value.list(&value),
            .@"struct" => |info| blk: {
                if (info.is_tuple) break :blk Value.list(value);
                const out = Value.object();
                inline for (info.field_names) |name| out.set(name, @field(value, name));
                break :blk out;
            },
            .@"fn" => Value.function(&value),
            else => @compileError("helix.Value.from não aceita " ++ @typeName(T)),
        };
    }

    pub fn ofNumber(value: f64) Value {
        ready();
        return check(adopt(ffi.number(value)));
    }

    pub fn ofBool(value: bool) Value {
        ready();
        return check(adopt(ffi.boolean(@intFromBool(value))));
    }

    pub fn ofString(text: []const u8) Value {
        ready();
        return check(adopt(ffi.string(text.ptr, text.len)));
    }

                               
    pub fn nil() Value {
        ready();
        return check(adopt(ffi.@"null"()));
    }

                       
    pub fn array() Value {
        ready();
        return check(adopt(ffi.array()));
    }

                        
    pub fn object() Value {
        ready();
        return check(adopt(ffi.object()));
    }

                                                                                                   
    pub fn list(items: anytype) Value {
        const out = Value.array();
        const T = @TypeOf(items);
        switch (@typeInfo(T)) {
            .@"struct" => |info| {
                inline for (0..info.field_types.len) |i| out.setAt(i, items[i]);
            },
            else => {
                for (items, 0..) |item, i| out.setAt(i, item);
            },
        }
        return out;
    }

                                                                                           
                                                                                            
    pub fn function(callback: Callback) Value {
        return registerCallback(callback, null, null);
    }

                                                                                               
                                                                         
    pub fn closure(context: anytype, comptime callback: fn (@TypeOf(context), []const Value) Value) Value {
        const Context = @TypeOf(context);
        if (@typeInfo(Context) != .pointer) @compileError("helix.Value.closure espera um ponteiro como contexto, não " ++ @typeName(Context));
        const Adapter = struct {
            fn invoke(opaque_context: *anyopaque, args: []const Value) Value {
                const typed: Context = @ptrCast(@alignCast(opaque_context));
                return callback(typed, args);
            }
        };
        return registerCallback(null, @ptrCast(@constCast(context)), &Adapter.invoke);
    }

                                                                                                      
    pub fn adopt(raw_handle: u32) Value {
        ready();
        if (raw_handle == 0) return none;
        return check(Value{ .handle = ffi.retain(raw_handle) });
    }

                                                                                       
    pub fn clone(self: Value) Value {
        return adopt(self.handle);
    }

                                                                        
    pub fn deinit(self: Value) void {
        if (self.handle != 0) ffi.release(self.handle);
    }

                                                              
    pub fn raw(self: Value) u32 {
        return self.handle;
    }

                                                                                                     
                                                            
    pub fn intoRaw(self: Value) u32 {
        if (self.handle == 0) return 0;
        const pooled = ffi.pool(self.handle);
        ffi.release(self.handle);
        return pooled;
    }

                                                                                                

    pub fn kind(self: Value) Kind {
        return Kind.fromCode(check(ffi.@"type"(self.handle)));
    }

    pub fn isUndefined(self: Value) bool {
        return self.handle == 0;
    }

    pub fn isNull(self: Value) bool {
        return self.handle != 0 and self.kind() == .nil;
    }

                              
    pub fn isNone(self: Value) bool {
        return self.handle == 0 or self.kind() == .nil;
    }

    pub fn isBool(self: Value) bool {
        return self.kind() == .boolean;
    }

    pub fn isNumber(self: Value) bool {
        return self.kind() == .number;
    }

    pub fn isString(self: Value) bool {
        return self.kind() == .string;
    }

    pub fn isArray(self: Value) bool {
        return self.kind() == .array;
    }

    pub fn isObject(self: Value) bool {
        return self.kind() == .object;
    }

    pub fn isFunction(self: Value) bool {
        return self.kind() == .function;
    }

                                                                                                 

                                                              
    pub fn number(self: Value) f64 {
        return check(ffi.to_number(self.handle));
    }

                                                                      
    pub fn numberOr(self: Value, fallback: f64) f64 {
        return if (self.isNumber()) self.number() else fallback;
    }

                                                                                     
    pub fn integer(self: Value) i64 {
        const n = self.number();
        if (std.math.isNan(n)) return 0;
        if (n >= 9223372036854775807.0) return std.math.maxInt(i64);
        if (n <= -9223372036854775808.0) return std.math.minInt(i64);
        return @intFromFloat(n);
    }

    pub fn boolean(self: Value) bool {
        return check(ffi.to_boolean(self.handle)) != 0;
    }

                                                                                             
    pub fn stringLen(self: Value) usize {
        return check(ffi.string_bytes(self.handle));
    }

                                                                                           
    pub fn stringBuf(self: Value, buffer: []u8) []const u8 {
        const length = check(ffi.string_read(self.handle, buffer.ptr, buffer.len));
        return buffer[0..@min(length, buffer.len)];
    }

                                                                                           
                                              
    pub fn string(self: Value, gpa: std.mem.Allocator) std.mem.Allocator.Error![]u8 {
        const out = try gpa.alloc(u8, self.stringLen());
        _ = check(ffi.string_read(self.handle, out.ptr, out.len));
        return out;
    }

                                           
    pub fn eqlString(self: Value, text: []const u8) bool {
        if (self.stringLen() != text.len) return false;
        var buffer: [256]u8 = undefined;
        if (text.len <= buffer.len) return std.mem.eql(u8, self.stringBuf(&buffer), text);
        const own = self.string(allocator) catch return false;
        defer allocator.free(own);
        return std.mem.eql(u8, own, text);
    }

                                                                                          
    pub fn vec3(self: Value) Vec3 {
        if (self.isNone()) return Vec3.zero;
        if (self.isArray()) return .{ .x = self.numberAt(0), .y = self.numberAt(1), .z = self.numberAt(2) };
        return .{ .x = self.numberOf("x"), .y = self.numberOf("y"), .z = self.numberOf("z") };
    }

    fn numberOf(self: Value, key: []const u8) f64 {
        const field = self.get(key);
        defer field.deinit();
        return field.numberOr(0);
    }

    fn numberAt(self: Value, at_index: usize) f64 {
        const item = self.at(at_index);
        defer item.deinit();
        return item.numberOr(0);
    }

                                                                                                    
    pub fn len(self: Value) usize {
        const length = check(ffi.length(self.handle));
        return if (length < 0) 0 else @intCast(length);
    }

                                                                                      
    pub fn keys(self: Value) Value {
        return check(adopt(ffi.keys(self.handle)));
    }

                                                                                                

                                                                                                 
    pub fn get(self: Value, key: []const u8) Value {
        return check(adopt(ffi.get(self.handle, key.ptr, key.len)));
    }

                       
    pub fn at(self: Value, at_index: usize) Value {
        return check(adopt(ffi.index(self.handle, @intCast(at_index))));
    }

                                                                                                          
    pub fn set(self: Value, key: []const u8, value: anytype) void {
        const converted = Value.from(value);
        defer converted.deinit();
        ffi.set(self.handle, key.ptr, key.len, converted.handle);
        check({});
    }

    pub fn setAt(self: Value, at_index: usize, value: anytype) void {
        const converted = Value.from(value);
        defer converted.deinit();
        ffi.set_index(self.handle, @intCast(at_index), converted.handle);
        check({});
    }

                       
    pub fn has(self: Value, key: []const u8) bool {
        return check(ffi.has(self.handle, key.ptr, key.len)) != 0;
    }

    pub fn delete(self: Value, key: []const u8) void {
        ffi.delete(self.handle, key.ptr, key.len);
        check({});
    }

                                                                         
    pub fn path(self: Value, dotted: []const u8) Value {
        var current = self.clone();
        var parts = std.mem.splitScalar(u8, dotted, '.');
        while (parts.next()) |part| {
            if (part.len == 0) continue;
            const next = current.get(part);
            current.deinit();
            current = next;
        }
        return current;
    }

                                      
    pub fn push(self: Value, value: anytype) void {
        const result = self.invoke("push", .{value});
        result.deinit();
    }

                                                                                                

                                                                                              
                                                                   
    pub fn call(self: Value, args: anytype) Value {
        var converted = Arguments.of(args);
        defer converted.deinit();
        return check(adopt(ffi.call(self.handle, converted.ptr(), converted.count())));
    }

                                                                                                  
    pub fn invoke(self: Value, method: []const u8, args: anytype) Value {
        var converted = Arguments.of(args);
        defer converted.deinit();
        return check(adopt(ffi.invoke(self.handle, method.ptr, method.len, converted.ptr(), converted.count())));
    }

                           
    pub fn construct(self: Value, args: anytype) Value {
        var converted = Arguments.of(args);
        defer converted.deinit();
        return check(adopt(ffi.construct(self.handle, converted.ptr(), converted.count())));
    }

                                                                                        
    pub fn equals(self: Value, other: Value) bool {
        return check(ffi.equals(self.handle, other.handle)) != 0;
    }

                                                                                                  
    pub fn iterator(self: Value) Iterator {
        return .{ .target = self, .count = self.len() };
    }

                                                                                
    pub fn format(self: Value, writer: *std.Io.Writer) std.Io.Writer.Error!void {
        var buffer: [512]u8 = undefined;
        const length = self.stringLen();
        if (length <= buffer.len) return writer.writeAll(self.stringBuf(&buffer));
        const own = self.string(allocator) catch return writer.writeAll(self.stringBuf(&buffer));
        defer allocator.free(own);
        try writer.writeAll(own);
    }
};

pub const Iterator = struct {
    target: Value,
    count: usize,
    index: usize = 0,

    pub fn next(self: *Iterator) ?Value {
        if (self.index >= self.count) return null;
        const item = self.target.at(self.index);
        self.index += 1;
        return item;
    }
};

                                                                                    
pub const Callback = *const fn ([]const Value) Value;

                                                                                                

const MAX_INLINE_ARGS = 8;

                                                                                                      
const Arguments = struct {
    inline_handles: [MAX_INLINE_ARGS]u32 = undefined,
    inline_owned: [MAX_INLINE_ARGS]bool = undefined,
    heap_handles: []u32 = &.{},
    heap_owned: []bool = &.{},
    total: usize = 0,

    fn of(args: anytype) Arguments {
        const T = @TypeOf(args);
        var out = Arguments{};
        switch (@typeInfo(T)) {
            .@"struct" => |info| {
                if (!info.is_tuple) @compileError("os argumentos de uma chamada são uma tupla (.{ a, b }) ou uma fatia []const Value, não " ++ @typeName(T));
                out.reserve(info.field_types.len);
                inline for (0..info.field_types.len) |i| {
                    const arg = args[i];
                    if (@TypeOf(arg) == Value) {
                        out.put(i, arg.handle, false);
                    } else {
                        out.put(i, Value.from(arg).handle, true);
                    }
                }
            },
            .pointer => {
                out.reserve(args.len);
                for (args, 0..) |arg, i| out.put(i, @as(Value, arg).handle, false);
            },
            else => @compileError("os argumentos de uma chamada são uma tupla (.{ a, b }) ou uma fatia []const Value, não " ++ @typeName(T)),
        }
        return out;
    }

    fn reserve(self: *Arguments, n: usize) void {
        self.total = n;
        if (n > MAX_INLINE_ARGS) {
            self.heap_handles = allocator.alloc(u32, n) catch @panic("sem memória para os argumentos da chamada");
            self.heap_owned = allocator.alloc(bool, n) catch @panic("sem memória para os argumentos da chamada");
        }
    }

    fn put(self: *Arguments, i: usize, handle: u32, owned: bool) void {
        if (self.total > MAX_INLINE_ARGS) {
            self.heap_handles[i] = handle;
            self.heap_owned[i] = owned;
        } else {
            self.inline_handles[i] = handle;
            self.inline_owned[i] = owned;
        }
    }

    fn ptr(self: *Arguments) [*]const u32 {
        return if (self.total > MAX_INLINE_ARGS) self.heap_handles.ptr else &self.inline_handles;
    }

    fn count(self: *const Arguments) i32 {
        return @intCast(self.total);
    }

    fn deinit(self: *Arguments) void {
        const handles: []const u32 = if (self.total > MAX_INLINE_ARGS) self.heap_handles else self.inline_handles[0..self.total];
        const owned: []const bool = if (self.total > MAX_INLINE_ARGS) self.heap_owned else self.inline_owned[0..self.total];
        for (handles, owned) |handle, is_owned| if (is_owned) ffi.release(handle);
        if (self.total > MAX_INLINE_ARGS) {
            allocator.free(self.heap_handles);
            allocator.free(self.heap_owned);
        }
    }
};

                                                                                                

const CallbackEntry = struct {
    plain: ?Callback,
    context: ?*anyopaque,
    bound: ?*const fn (*anyopaque, []const Value) Value,
};

var callbacks: std.AutoHashMapUnmanaged(u32, CallbackEntry) = .empty;
var next_callback: u32 = 1;

fn registerCallback(plain: ?Callback, context: ?*anyopaque, bound: ?*const fn (*anyopaque, []const Value) Value) Value {
    ready();
    const id = next_callback;
    next_callback = @max(next_callback +% 1, 1);
    callbacks.put(allocator, id, .{ .plain = plain, .context = context, .bound = bound }) catch @panic("sem memória para registrar o callback");
    return check(Value.adopt(ffi.callback(id)));
}

                                                                                              
export fn __hx_invoke_callback(id: u32, args_handle: u32) u32 {
    const entry = callbacks.get(id) orelse return 0;
    const list = Value.adopt(args_handle);
    defer list.deinit();
    const count = list.len();
    var inline_args: [MAX_INLINE_ARGS]Value = undefined;
    const args: []Value = if (count <= MAX_INLINE_ARGS) inline_args[0..count] else allocator.alloc(Value, count) catch @panic("sem memória para os argumentos do callback");
    defer if (count > MAX_INLINE_ARGS) allocator.free(args);
    for (args, 0..) |*slot, i| slot.* = list.at(i);
    defer for (args) |arg| arg.deinit();
    const result = if (entry.bound) |bound| bound(entry.context.?, args) else if (entry.plain) |plain| plain(args) else Value.none;
    return result.intoRaw();
}

                                                                                        
export fn __hx_drop_callback(id: u32) void {
    _ = callbacks.remove(id);
}

                                                                                                    

                                                                                         
pub fn root() Value {
    ready();
    return check(Value.adopt(ffi.root()));
}

                                                                              
pub fn actor() Value {
    ready();
    return check(Value.adopt(ffi.self()));
}

                                                                   
pub fn script() Value {
    ready();
    return check(Value.adopt(ffi.script()));
}

                                                                                               
pub fn require(name: []const u8) Value {
    ready();
    return check(Value.adopt(ffi.require(name.ptr, name.len)));
}

                                                                                  
pub fn call(dotted: []const u8, args: anytype) Value {
    const base = root();
    defer base.deinit();
    if (std.mem.lastIndexOfScalar(u8, dotted, '.')) |dot| {
        const owner = base.path(dotted[0..dot]);
        defer owner.deinit();
        return owner.invoke(dotted[dot + 1 ..], args);
    }
    return base.invoke(dotted, args);
}

                                           
pub fn now() f64 {
    ready();
    return ffi.now();
}

                                                
pub fn log(level: Level, message: []const u8) void {
    ready();
    ffi.log(@intFromEnum(level), message.ptr, message.len);
}

                                                                                                                             
pub fn print(comptime fmt: []const u8, args: anytype) void {
    emit(.info, fmt, args);
}

pub fn debug(comptime fmt: []const u8, args: anytype) void {
    emit(.debug, fmt, args);
}

pub fn warn(comptime fmt: []const u8, args: anytype) void {
    emit(.warn, fmt, args);
}

pub fn err(comptime fmt: []const u8, args: anytype) void {
    emit(.err, fmt, args);
}

fn emit(level: Level, comptime fmt: []const u8, args: anytype) void {
    var buffer: [1024]u8 = undefined;
    if (std.fmt.bufPrint(&buffer, fmt, args)) |text| {
        log(level, text);
    } else |_| {
        const text = std.fmt.allocPrint(allocator, fmt, args) catch {
            log(level, "(mensagem longa demais para formatar)");
            return;
        };
        defer allocator.free(text);
        log(level, text);
    }
}

                                                                                                          
pub fn throw(comptime fmt: []const u8, args: anytype) noreturn {
    var buffer: [1024]u8 = undefined;
    const text = std.fmt.bufPrint(&buffer, fmt, args) catch fmt;
    @panic(text);
}

                                                                                                  

                                                                                                     
                                                 
fn Raw(comptime T: type) type {
    return switch (T) {
        void, f64, f32, i32, u32, i64, u64 => T,
        bool => i32,
        Value, Vec3, []const u8 => u32,
        else => @compileError("o tipo " ++ @typeName(T) ++ " não atravessa a ABI da engine: use f64, f32, i32, u32, i64, u64, bool, helix.Value ou helix.Vec3"),
    };
}

fn fromRaw(comptime T: type, value: Raw(T)) T {
    return switch (T) {
        bool => value != 0,
        Value => Value.adopt(value),
        Vec3 => blk: {
            const wrapped = Value.adopt(value);
            defer wrapped.deinit();
            break :blk wrapped.vec3();
        },
        []const u8 => @compileError("parâmetros de texto chegam como helix.Value; leia com .string(gpa) ou .stringBuf(buffer)"),
