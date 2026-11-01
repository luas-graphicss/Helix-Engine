                                                                             
                                                                               
                                                                             
                                                                      
                                           
   
           
                                      
   
                                
                       
   
               
                      
                                                        
       
   
               
                                
                     
                                                           
       
     
       
   
                                                                                
                                                                              
                                                                  
library;

import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:math' as math;

                                                                                                

                                                                                
                                                                         
                                                                       
                                                                             
extension type _Host._(JSObject _) implements JSObject {
  external JSAny? get helix;
  external JSObject get console;
  external JSFunction get require;
  external String typeOf(JSAny? value);
  external JSAny? read(JSAny? target, JSAny key);
  external void write(JSAny? target, JSAny key, JSAny? value);
  external bool contains(JSAny? target, JSAny key);
  external bool remove(JSAny? target, JSAny key);
  external JSArray<JSString> names(JSAny? target);
  external JSAny? apply(JSAny? target, JSAny? receiver, JSArray<JSAny?> args);
  external JSAny? construct(JSAny? target, JSArray<JSAny?> args);
  external String text(JSAny? value);
  external JSFunction callback(JSFunction variadic);
}

final _Host _host = _findHost();

_Host _findHost() {
  final found = globalContext['__helixHost'];
  if (found == null) {
    throw StateError('o SDK helix só roda dentro do módulo que o serviço de build da engine gera.');
  }
  return _Host._(found as JSObject);
}

                                                                                              
class EngineException implements Exception {
  final String message;

  EngineException(this.message);

  @override
  String toString() => message;
}

                                                                                                

                                                                              
                                                                              
                                                                                 
                                                                          
class Value {
  final JSAny? raw;

  const Value(this.raw);

                                                                               
  static const Value none = Value(null);

                                                                                                                                
  factory Value.of(Object? value) => value is Value ? value : Value(_toJs(value));

                                                                                                

                                                                                          
  String get kind => _host.typeOf(raw);

  bool get isUndefined => kind == 'undefined';
  bool get isNull => kind == 'null';
  bool get isNullish => raw == null;
  bool get isNumber => kind == 'number';
  bool get isString => kind == 'string';
  bool get isBoolean => kind == 'boolean';
  bool get isFunction => kind == 'function';
  bool get isArray => kind == 'array';
  bool get isObject => kind == 'object';

                                                                                                

                                                                                                   
  Value operator [](Object key) => Value(_host.read(_target('ler "$key"'), _key(key)));

                                
  Value get(Object key) => this[key];

                                                                       
  Value path(String dotted) {
    var current = this;
    for (final part in dotted.split('.')) {
      if (part.isNotEmpty) current = current[part];
    }
    return current;
  }

  bool has(Object key) => !isNullish && _host.contains(raw, _key(key));

                                                            
  List<String> get keys => isNullish ? const [] : _host.names(raw).toDart.map((key) => key.toDart).toList();

                                                     
  int get length => isNullish ? 0 : this['length'].integer;

                                                                             
  List<Value> get items => List<Value>.generate(length, (index) => this[index]);

                                               
  Map<String, Value> get entries => {for (final key in keys) key: this[key]};

                                                                                                 

                                                                                                               
  double get number {
    switch (kind) {
      case 'number':
        return (raw as JSNumber).toDartDouble;
      case 'boolean':
        return (raw as JSBoolean).toDart ? 1 : 0;
      case 'undefined':
      case 'null':
        return 0;
      case 'string':
        return double.tryParse((raw as JSString).toDart.trim()) ?? double.nan;
      default:
        return double.nan;
    }
  }

                                                                  
  double numberOr(double fallback) => isNumber ? number : fallback;

                                                             
  int get integer {
    final value = number;
    if (value.isNaN) return 0;
    return value.clamp(-2147483648.0, 2147483647.0).truncate();
  }

                                                                           
  bool get boolean {
    switch (kind) {
      case 'boolean':
        return (raw as JSBoolean).toDart;
      case 'undefined':
      case 'null':
        return false;
      case 'number':
        final value = number;
        return value != 0 && !value.isNaN;
      case 'string':
        return (raw as JSString).toDart.isNotEmpty;
      default:
        return true;
    }
  }

                                                                                  
  String get string => isString ? (raw as JSString).toDart : text;

                                                                                   
  String get text => _host.text(raw);

                                                                                          
  Vec3 get vec3 {
    if (isNullish) return Vec3.zero;
    final x = this['x'];
    if (!x.isUndefined) return Vec3(x.number, this['y'].number, this['z'].number);
    return Vec3(this[0].number, this[1].number, this[2].number);
  }

                                                                                   
  Object? get dart => raw.dartify();

                                                                             
  Value Function(List<Object?> args) get function {
    if (!isFunction) throw EngineException('o valor é $kind, não uma função.');
    return call;
  }

                                                                                                

                                                                      
  void operator []=(Object key, Object? value) => _host.write(_target('escrever "$key"'), _key(key), _toJs(value));

                                        
  void set(Object key, Object? value) => this[key] = value;

  bool delete(Object key) => !isNullish && _host.remove(raw, _key(key));

                                                                                                

                                                 
  Value call([List<Object?> args = const []]) {
    if (!isFunction) throw EngineException('não dá para chamar $kind como função.');
    return Value(_host.apply(raw, null, _toJsList(args)));
  }

                                                                                                             
  Value invoke(String method, [List<Object?> args = const []]) {
    final target = _target('chamar "$method"');
    final function = Value(_host.read(target, method.toJS));
    if (!function.isFunction) throw EngineException('"$method" não é uma função (é ${function.kind}).');
    return Value(_host.apply(function.raw, target, _toJsList(args)));
  }

                             
  Value construct([List<Object?> args = const []]) {
    if (!isFunction) throw EngineException('não dá para construir a partir de $kind.');
    return Value(_host.construct(raw, _toJsList(args)));
  }

  @override
  String toString() => text;

  @override
  bool operator ==(Object other) => other is Value && identical(raw, other.raw);

  @override
  int get hashCode => raw.hashCode;

  JSAny? _target(String action) {
    if (raw == null) throw EngineException('não dá para $action de ${isUndefined ? 'undefined' : 'null'}.');
    return raw;
  }

  static JSAny _key(Object key) => key is int ? key.toJS : key.toString().toJS;
}

                                                                                                

                                                                           
class Vec3 {
  final double x;
  final double y;
  final double z;

                                                                                             
  const Vec3(this.x, this.y, this.z);

  static const zero = Vec3(0, 0, 0);
  static const one = Vec3(1, 1, 1);
  static const up = Vec3(0, 1, 0);
  static const down = Vec3(0, -1, 0);
  static const forward = Vec3(0, 0, -1);
  static const back = Vec3(0, 0, 1);
  static const right = Vec3(1, 0, 0);
  static const left = Vec3(-1, 0, 0);

  Vec3 operator +(Vec3 other) => Vec3(x + other.x, y + other.y, z + other.z);
  Vec3 operator -(Vec3 other) => Vec3(x - other.x, y - other.y, z - other.z);
  Vec3 operator *(num scale) => Vec3(x * scale, y * scale, z * scale);
  Vec3 operator /(num scale) => Vec3(x / scale, y / scale, z / scale);
  Vec3 operator -() => Vec3(-x, -y, -z);

  double get length => math.sqrt(x * x + y * y + z * z);
  Vec3 get normalized => length == 0 ? this : this / length;

  double dot(Vec3 other) => x * other.x + y * other.y + z * other.z;
  Vec3 cross(Vec3 other) => Vec3(y * other.z - z * other.y, z * other.x - x * other.z, x * other.y - y * other.x);
  double distanceTo(Vec3 other) => (this - other).length;
  Vec3 lerp(Vec3 other, double t) => Vec3(x + (other.x - x) * t, y + (other.y - y) * t, z + (other.z - z) * t);

                                         
  JSObject toJs() {
    final out = JSObject();
    out['x'] = x.toJS;
    out['y'] = y.toJS;
    out['z'] = z.toJS;
    return out;
  }

  @override
  String toString() => 'Vec3($x, $y, $z)';

  @override
  bool operator ==(Object other) => other is Vec3 && x == other.x && y == other.y && z == other.z;

  @override
  int get hashCode => Object.hash(x, y, z);
}

                                                                                                

                                                                                     
abstract final class Helix {
                                                                              
  static Value get root => Value(_host.helix);

                                                                                          
  static Value call(String path, [List<Object?> args = const []]) {
    final dot = path.lastIndexOf('.');
    if (dot < 0) return root.invoke(path, args);
    return root.path(path.substring(0, dot)).invoke(path.substring(dot + 1), args);
  }

                                                                                                      
  static Value require(String name) {
    if (name.isEmpty) throw EngineException('require precisa do nome de um script da biblioteca.');
    return Value(_host.require.callAsFunction(null, name.toJS));
  }

  static Value of(Object? value) => Value.of(value);

                                       
  static Value array(List<Object?> items) => Value(_toJsList(items));

                                                                               
  static Value obj(Map<String, Object?> fields) => Value(_toJs(fields));

  static Vec3 vec3(num x, num y, num z) => Vec3(x.toDouble(), y.toDouble(), z.toDouble());

                                                                               
                                                                                  
                                                                            
                                                        
  static Value fn(Object? Function(List<Value> args) body) => Value(_callback(body));

                                                                                     
  static double get now => root.path('time.now').numberOr(0);

                                                                                                

                                                                         
  static void log(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => _emit('info', [a, b, c, d, e, f]);
  static void debug(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => _emit('debug', [a, b, c, d, e, f]);
  static void warn(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => _emit('warn', [a, b, c, d, e, f]);
  static void error(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => _emit('error', [a, b, c, d, e, f]);

  static String join(List<Object?> parts) => parts.where((part) => !identical(part, _absent)).map((part) => part is Value ? part.text : _host.text(_toJs(part))).join(' ');

  static void _emit(String level, List<Object?> parts) {
    _host.console.callMethod(level.toJS, join(parts).toJS);
  }
}

                                           
Value require(String name) => Helix.require(name);

                                                
void log(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.log(a, b, c, d, e, f);
void debug(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.debug(a, b, c, d, e, f);
void warn(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.warn(a, b, c, d, e, f);
void error(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.error(a, b, c, d, e, f);

                                                                                     
const Object _absent = _Absent();

class _Absent {
  const _Absent();
}

                                                                                                

                                                                              
                                                                               
                                                                                
                                                            

                                                                                                

                                                                               
                                                                                
                                                                             
                                                                             
                                                                            

                                                                                                 

                                                                               
                                                                         
                                                                               
JSAny? _toJs(Object? value) {
}

                                                                                                                  
JSArray<JSAny?> _toJsList(Iterable<Object?> items) {
  final out = JSArray<JSAny?>.withLength(0);
  var index = 0;
}

Value _at(List<Value> args, int index) => index < args.length ? args[index] : Value.none;

JSFunction _callback(Object? Function(List<Value> args) body) {
  JSAny? variadic(JSArray<JSAny?> args) => _toJs(body(args.toDart.map(Value.new).toList()));
}
