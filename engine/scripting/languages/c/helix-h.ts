export const HELIX_H = String.raw `#ifndef HELIX_H
#define HELIX_H

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

                                                                  
typedef uint32_t hx_ref;
#define HX_NONE ((hx_ref)0)

typedef enum hx_type_t {
  HX_UNDEFINED = 0,
  HX_NULL = 1,
  HX_BOOLEAN = 2,
  HX_NUMBER = 3,
  HX_STRING = 4,
  HX_ARRAY = 5,
  HX_OBJECT = 6,
  HX_FUNCTION = 7
} hx_type_t;

typedef enum hx_log_level_t { HX_LOG_DEBUG = 0, HX_LOG_INFO = 1, HX_LOG_WARN = 2, HX_LOG_ERROR = 3 } hx_log_level_t;

                                                                                                                         
typedef hx_ref (*hx_callback)(void* userdata, hx_ref args);
                                                                                               
typedef void (*hx_destructor)(void* userdata);

                                                                                                                             
#ifdef __cplusplus
#define HX_EXPORT extern "C" __attribute__((used, visibility("default")))
#else
#define HX_EXPORT __attribute__((used, visibility("default")))
#endif
#define HX_HOOK HX_EXPORT

#define HX_IMPORT(name) __attribute__((import_module("helix"), import_name(#name)))

                                                                                           

HX_IMPORT(retain) hx_ref hx_retain(hx_ref value);
HX_IMPORT(release) void hx_release(hx_ref value);
HX_IMPORT(type) int32_t hx_type(hx_ref value);
HX_IMPORT(equals) int32_t hx_equals(hx_ref a, hx_ref b);

                                                                                          
HX_IMPORT(root) hx_ref hx_root(void);
HX_IMPORT(script) hx_ref hx_script(void);
HX_IMPORT(self) hx_ref hx_self(void);
HX_IMPORT(require) hx_ref hx_require_n(const char* name, size_t length);

HX_IMPORT(number) hx_ref hx_number(double value);
HX_IMPORT(boolean) hx_ref hx_boolean(int32_t value);
HX_IMPORT(string) hx_ref hx_string_n(const char* utf8, size_t length);
HX_IMPORT(null) hx_ref hx_null(void);
HX_IMPORT(array) hx_ref hx_array(void);
HX_IMPORT(object) hx_ref hx_object(void);
HX_IMPORT(function) hx_ref hx_function(hx_callback callback, void* userdata, hx_destructor destructor);

HX_IMPORT(to_number) double hx_to_number(hx_ref value);
HX_IMPORT(to_boolean) int32_t hx_to_boolean(hx_ref value);
                                                            
HX_IMPORT(string_bytes) size_t hx_string_bytes(hx_ref value);
                                                                                                                    
HX_IMPORT(string_copy) size_t hx_string_copy(hx_ref value, char* buffer, size_t capacity);

HX_IMPORT(get) hx_ref hx_get_n(hx_ref object, const char* key, size_t length);
HX_IMPORT(index) hx_ref hx_index(hx_ref object, int32_t index);
HX_IMPORT(set) void hx_set_n(hx_ref object, const char* key, size_t length, hx_ref value);
HX_IMPORT(set_index) void hx_set_index(hx_ref object, int32_t index, hx_ref value);
HX_IMPORT(has) int32_t hx_has_n(hx_ref object, const char* key, size_t length);
HX_IMPORT(delete) void hx_delete_n(hx_ref object, const char* key, size_t length);
HX_IMPORT(length) int32_t hx_length(hx_ref object);
HX_IMPORT(keys) hx_ref hx_keys(hx_ref object);

                                                                         
HX_IMPORT(call) hx_ref hx_call(hx_ref function, const hx_ref* args, int32_t count);
                            
HX_IMPORT(invoke) hx_ref hx_invoke_n(hx_ref object, const char* method, size_t length, const hx_ref* args, int32_t count);
                              
HX_IMPORT(construct) hx_ref hx_new(hx_ref constructor, const hx_ref* args, int32_t count);

HX_IMPORT(log) void hx_log_n(int32_t level, const char* utf8, size_t length);
                                                                                         
HX_IMPORT(throw) void hx_throw_n(const char* utf8, size_t length) __attribute__((noreturn));
                                                                             
HX_IMPORT(now) double hx_now(void);

                                                                                           

static inline hx_ref hx_string(const char* utf8) { return hx_string_n(utf8, utf8 ? strlen(utf8) : 0); }
static inline hx_ref hx_get(hx_ref object, const char* key) { return hx_get_n(object, key, strlen(key)); }
static inline void hx_set(hx_ref object, const char* key, hx_ref value) { hx_set_n(object, key, strlen(key), value); }
static inline int32_t hx_has(hx_ref object, const char* key) { return hx_has_n(object, key, strlen(key)); }
static inline void hx_delete(hx_ref object, const char* key) { hx_delete_n(object, key, strlen(key)); }
static inline hx_ref hx_invoke(hx_ref object, const char* method, const hx_ref* args, int32_t count) {
  return hx_invoke_n(object, method, strlen(method), args, count);
}
static inline hx_ref hx_require(const char* name) { return hx_require_n(name, strlen(name)); }
static inline void hx_log(int32_t level, const char* message) { hx_log_n(level, message, strlen(message)); }
static inline void hx_print(const char* message) { hx_log_n(HX_LOG_INFO, message, strlen(message)); }
static inline void hx_warn(const char* message) { hx_log_n(HX_LOG_WARN, message, strlen(message)); }
static inline void hx_error(const char* message) { hx_log_n(HX_LOG_ERROR, message, strlen(message)); }
static inline void hx_throw(const char* message) { hx_throw_n(message, strlen(message)); }

                                                                                            

                                                        
static inline double hx_get_number(hx_ref object, const char* key) {
  hx_ref value = hx_get(object, key);
  return hx_to_number(value);
}
static inline int32_t hx_get_boolean(hx_ref object, const char* key) { return hx_to_boolean(hx_get(object, key)); }
static inline void hx_set_number(hx_ref object, const char* key, double value) { hx_set(object, key, hx_number(value)); }
static inline void hx_set_boolean(hx_ref object, const char* key, int32_t value) { hx_set(object, key, hx_boolean(value)); }
static inline void hx_set_string(hx_ref object, const char* key, const char* value) { hx_set(object, key, hx_string(value)); }

                                                                      
static inline char* hx_string_dup(hx_ref value) {
  size_t size = hx_string_bytes(value) + 1;
  char* buffer = (char*)malloc(size);
  if (buffer) hx_string_copy(value, buffer, size);
  return buffer;
}

                                                                 
static inline char* hx_get_string(hx_ref object, const char* key) { return hx_string_dup(hx_get(object, key)); }

static inline int hx_is_none(hx_ref value) { int32_t t = hx_type(value); return t == HX_UNDEFINED || t == HX_NULL; }
static inline int hx_is_number(hx_ref value) { return hx_type(value) == HX_NUMBER; }
static inline int hx_is_string(hx_ref value) { return hx_type(value) == HX_STRING; }
static inline int hx_is_function(hx_ref value) { return hx_type(value) == HX_FUNCTION; }
static inline int hx_is_array(hx_ref value) { return hx_type(value) == HX_ARRAY; }
static inline int hx_is_object(hx_ref value) { int32_t t = hx_type(value); return t == HX_OBJECT || t == HX_ARRAY || t == HX_FUNCTION; }

                                                                                         
static inline hx_ref hx_call0(hx_ref fn) { return hx_call(fn, NULL, 0); }
static inline hx_ref hx_call1(hx_ref fn, hx_ref a) { hx_ref args[1] = { a }; return hx_call(fn, args, 1); }
static inline hx_ref hx_call2(hx_ref fn, hx_ref a, hx_ref b) { hx_ref args[2] = { a, b }; return hx_call(fn, args, 2); }
static inline hx_ref hx_call3(hx_ref fn, hx_ref a, hx_ref b, hx_ref c) { hx_ref args[3] = { a, b, c }; return hx_call(fn, args, 3); }
static inline hx_ref hx_invoke0(hx_ref object, const char* method) { return hx_invoke(object, method, NULL, 0); }
static inline hx_ref hx_invoke1(hx_ref object, const char* method, hx_ref a) { hx_ref args[1] = { a }; return hx_invoke(object, method, args, 1); }
static inline hx_ref hx_invoke2(hx_ref object, const char* method, hx_ref a, hx_ref b) { hx_ref args[2] = { a, b }; return hx_invoke(object, method, args, 2); }
static inline hx_ref hx_invoke3(hx_ref object, const char* method, hx_ref a, hx_ref b, hx_ref c) { hx_ref args[3] = { a, b, c }; return hx_invoke(object, method, args, 3); }
static inline hx_ref hx_invoke4(hx_ref object, const char* method, hx_ref a, hx_ref b, hx_ref c, hx_ref d) {
  hx_ref args[4] = { a, b, c, d };
  return hx_invoke(object, method, args, 4);
}

 
typedef struct hx_vec3 { double x, y, z; } hx_vec3;
static inline hx_vec3 hx_get_vec3(hx_ref value) {
  hx_vec3 v = { hx_get_number(value, "x"), hx_get_number(value, "y"), hx_get_number(value, "z") };
  return v;
}
static inline void hx_set_vec3(hx_ref value, double x, double y, double z) {
  hx_set_number(value, "x", x);
  hx_set_number(value, "y", y);
  hx_set_number(value, "z", z);
}
                                                                                                    
static inline hx_ref hx_vec3_new(double x, double y, double z) {
  hx_ref v = hx_array();
  hx_set_index(v, 0, hx_number(x));
  hx_set_index(v, 1, hx_number(y));
  hx_set_index(v, 2, hx_number(z));
  return v;
}

                                                                                                    
static inline hx_ref hx_path(const char* path) {
  hx_ref current = hx_root();
  const char* start = path;
  for (;;) {
    const char* dot = strchr(start, '.');
    size_t length = dot ? (size_t)(dot - start) : strlen(start);
    current = hx_get_n(current, start, length);
    if (!dot) return current;
    start = dot + 1;
  }
}

#ifdef __cplusplus
}
#endif

#endif              
`;
