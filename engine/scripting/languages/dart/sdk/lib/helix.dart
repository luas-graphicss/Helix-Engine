                                                                             
                                                                               
                                                                             
                                                                      
                                           
   
           
                                      
   
                                
                       
   
               
                      
                                                        
       
   
               
                                
                     
                                                           
       
     
       
   
                                                                                
                                                                              
                                                                  
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

                                                                                                

                                                                              
                                                                              
                                                                                 
                                                                          

                                                                                                

                                                                           

                                                                                                

                                                                                     

                                           
Value require(String name) => Helix.require(name);

                                                
void log(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.log(a, b, c, d, e, f);
void debug(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.debug(a, b, c, d, e, f);
void warn(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.warn(a, b, c, d, e, f);
void error(Object? a, [Object? b = _absent, Object? c = _absent, Object? d = _absent, Object? e = _absent, Object? f = _absent]) => Helix.error(a, b, c, d, e, f);

                                                                                     
const Object _absent = _Absent();


                                                                                                

                                                                              
                                                                               
                                                                                
                                                            

                                                                                                

                                                                               
                                                                                
                                                                             
                                                                             
                                                                            

                                                                                                 

                                                                               
                                                                         
                                                                               
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
