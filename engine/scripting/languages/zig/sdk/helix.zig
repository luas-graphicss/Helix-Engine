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
