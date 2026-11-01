export const HELIX_HPP = String.raw `#pragma once

#include "helix.h"

#include <cstddef>
#include <functional>
#include <initializer_list>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

namespace helix {

class Value;
class Args;

namespace detail {
template <class T>
struct is_value : std::is_same<std::decay_t<T>, Value> {};
}                     

                                                                                                  
class Value {
 public:
  Value() : ref_(HX_NONE) {}
  Value(std::nullptr_t) : ref_(hx_null()) { own(); }
  Value(double value) : ref_(hx_number(value)) { own(); }
  Value(float value) : Value(static_cast<double>(value)) {}
  Value(int value) : Value(static_cast<double>(value)) {}
  Value(unsigned value) : Value(static_cast<double>(value)) {}
  Value(long value) : Value(static_cast<double>(value)) {}
  Value(unsigned long value) : Value(static_cast<double>(value)) {}
  Value(long long value) : Value(static_cast<double>(value)) {}
  Value(bool value) : ref_(hx_boolean(value ? 1 : 0)) { own(); }
  Value(const char* text) : ref_(hx_string_n(text, text ? strlen(text) : 0)) { own(); }
  Value(const std::string& text) : ref_(hx_string_n(text.data(), text.size())) { own(); }
  Value(const std::vector<Value>& items) : ref_(hx_array()) {
    own();
    for (std::size_t i = 0; i < items.size(); i++) hx_set_index(ref_, static_cast<int32_t>(i), items[i].ref_);
  }
  Value(std::initializer_list<std::pair<const char*, Value>> fields) : ref_(hx_object()) {
    own();
    for (const auto& field : fields) hx_set_n(ref_, field.first, strlen(field.first), field.second.ref_);
  }

  Value(const Value& other) : ref_(other.ref_) { own(); }
  Value(Value&& other) noexcept : ref_(other.ref_) { other.ref_ = HX_NONE; }
  Value& operator=(Value other) noexcept {
    std::swap(ref_, other.ref_);
    return *this;
  }
  ~Value() {
    if (ref_) hx_release(ref_);
  }

                                                                                               
  static Value adopt(hx_ref ref) {
    Value value;
    value.ref_ = ref;
    value.own();
    return value;
  }

                                                            
  hx_ref ref() const { return ref_; }

                                                                                         
  hx_type_t type() const { return static_cast<hx_type_t>(hx_type(ref_)); }
  bool isNone() const { return hx_is_none(ref_) != 0; }
  bool isNumber() const { return type() == HX_NUMBER; }
  bool isString() const { return type() == HX_STRING; }
  bool isBoolean() const { return type() == HX_BOOLEAN; }
  bool isArray() const { return type() == HX_ARRAY; }
  bool isObject() const { return hx_is_object(ref_) != 0; }
  bool isFunction() const { return type() == HX_FUNCTION; }
  bool operator==(const Value& other) const { return hx_equals(ref_, other.ref_) != 0; }
  bool operator!=(const Value& other) const { return !(*this == other); }

                                                                                          
  double number() const { return hx_to_number(ref_); }
  float toFloat() const { return static_cast<float>(number()); }
  int toInt() const { return static_cast<int>(number()); }
  bool truthy() const { return hx_to_boolean(ref_) != 0; }
  std::string str() const {
    std::string out;
    out.resize(hx_string_bytes(ref_));
    if (!out.empty()) hx_string_copy(ref_, &out[0], out.size() + 1);
    return out;
  }
  operator double() const { return number(); }
  explicit operator bool() const { return truthy(); }
  explicit operator std::string() const { return str(); }

                                                                                         
  Value operator[](const char* key) const { return adopt(hx_get_n(ref_, key, strlen(key))); }
  Value operator[](const std::string& key) const { return adopt(hx_get_n(ref_, key.data(), key.size())); }
  Value operator[](int index) const { return adopt(hx_index(ref_, index)); }
  Value operator[](std::size_t index) const { return adopt(hx_index(ref_, static_cast<int32_t>(index))); }
  Value get(const char* key) const { return (*this)[key]; }
  Value at(int index) const { return (*this)[index]; }
  bool has(const char* key) const { return hx_has_n(ref_, key, strlen(key)) != 0; }
  void erase(const char* key) const { hx_delete_n(ref_, key, strlen(key)); }
  int length() const { return hx_length(ref_); }
  std::size_t size() const { return static_cast<std::size_t>(hx_length(ref_)); }
  Value keys() const { return adopt(hx_keys(ref_)); }

  template <class T>
  void set(const char* key, T&& value) const {
    Value boxed(std::forward<T>(value));
    hx_set_n(ref_, key, strlen(key), boxed.ref_);
  }
  void set(const char* key, const Value& value) const { hx_set_n(ref_, key, strlen(key), value.ref_); }
  template <class T>
  void set(int index, T&& value) const {
    Value boxed(std::forward<T>(value));
    hx_set_index(ref_, index, boxed.ref_);
  }
  void set(int index, const Value& value) const { hx_set_index(ref_, index, value.ref_); }
  template <class T>
  void push(T&& value) const {
    set(length(), std::forward<T>(value));
  }

                                                                               
  Value path(const char* dotted) const {
    Value current = *this;
    const char* start = dotted;
    for (;;) {
      const char* dot = strchr(start, '.');
      std::size_t length = dot ? static_cast<std::size_t>(dot - start) : strlen(start);
      current = adopt(hx_get_n(current.ref_, start, length));
      if (!dot) return current;
      start = dot + 1;
    }
  }

                                                                                          
                                                                      
  template <class... A>
  Value operator()(A&&... args) const {
    Value boxed[] = { Value(), Value(std::forward<A>(args))... };
    hx_ref refs[sizeof...(A) + 1];
    for (std::size_t i = 0; i < sizeof...(A); i++) refs[i] = boxed[i + 1].ref_;
    return adopt(hx_call(ref_, refs, static_cast<int32_t>(sizeof...(A))));
  }
                                                                                            
  template <class... A>
  Value call(const char* method, A&&... args) const {
    Value boxed[] = { Value(), Value(std::forward<A>(args))... };
    hx_ref refs[sizeof...(A) + 1];
    for (std::size_t i = 0; i < sizeof...(A); i++) refs[i] = boxed[i + 1].ref_;
    return adopt(hx_invoke_n(ref_, method, strlen(method), refs, static_cast<int32_t>(sizeof...(A))));
  }
                                
  template <class... A>
  Value construct(A&&... args) const {
    Value boxed[] = { Value(), Value(std::forward<A>(args))... };
    hx_ref refs[sizeof...(A) + 1];
    for (std::size_t i = 0; i < sizeof...(A); i++) refs[i] = boxed[i + 1].ref_;
    return adopt(hx_new(ref_, refs, static_cast<int32_t>(sizeof...(A))));
  }

                                                                                          
  double x() const { return (*this)["x"].number(); }
  double y() const { return (*this)["y"].number(); }
  double z() const { return (*this)["z"].number(); }
  void setXYZ(double x, double y, double z) const { hx_set_vec3(ref_, x, y, z); }

 private:
  void own() {
    if (ref_) hx_retain(ref_);
  }
  hx_ref ref_;
};

                                                       
class Args {
 public:
  explicit Args(Value list) : list_(std::move(list)) {}
  std::size_t size() const { return list_.size(); }
  Value operator[](std::size_t index) const { return list_[index]; }
  Value at(std::size_t index) const { return list_[index]; }
  const Value& list() const { return list_; }

 private:
  Value list_;
};

namespace detail {
using Callable = std::function<Value(const Args&)>;

inline hx_ref trampoline(void* userdata, hx_ref args) {
  Callable* callable = static_cast<Callable*>(userdata);
  Value result = (*callable)(Args(Value::adopt(args)));
                                                                                                  
  return result.ref();
}

inline void destroy(void* userdata) { delete static_cast<Callable*>(userdata); }

template <class F>
Callable wrap(F fn) {
  using R = decltype(fn(std::declval<const Args&>()));
  if constexpr (std::is_void_v<R>) {
    return [fn = std::move(fn)](const Args& args) -> Value {
      fn(args);
      return Value();
    };
  } else {
    return [fn = std::move(fn)](const Args& args) -> Value { return Value(fn(args)); };
  }
}

template <class F>
Callable wrapNoArgs(F fn) {
  using R = decltype(fn());
  if constexpr (std::is_void_v<R>) {
    return [fn = std::move(fn)](const Args&) -> Value {
      fn();
      return Value();
    };
  } else {
    return [fn = std::move(fn)](const Args&) -> Value { return Value(fn()); };
  }
}

template <class F, class = void>
struct takes_args : std::false_type {};
template <class F>
struct takes_args<F, std::void_t<decltype(std::declval<F>()(std::declval<const Args&>()))>> : std::true_type {};
}                     

                                                                                                         
template <class F>
Value function(F fn) {
  detail::Callable* holder;
  if constexpr (detail::takes_args<F>::value) {
    holder = new detail::Callable(detail::wrap(std::move(fn)));
  } else {
    holder = new detail::Callable(detail::wrapNoArgs(std::move(fn)));
  }
  return Value::adopt(hx_function(&detail::trampoline, holder, &detail::destroy));
}

                                   
inline Value root() { return Value::adopt(hx_root()); }
                                                                                 
inline Value self() { return Value::adopt(hx_self()); }
                                                   
inline Value script() { return Value::adopt(hx_script()); }
                                                                          
inline Value require(const char* name) { return Value::adopt(hx_require_n(name, strlen(name))); }
inline Value require(const std::string& name) { return Value::adopt(hx_require_n(name.data(), name.size())); }
                                  
inline Value path(const char* dotted) { return Value::adopt(hx_path(dotted)); }

inline void print(const std::string& message) { hx_log_n(HX_LOG_INFO, message.data(), message.size()); }
inline void warn(const std::string& message) { hx_log_n(HX_LOG_WARN, message.data(), message.size()); }
inline void error(const std::string& message) { hx_log_n(HX_LOG_ERROR, message.data(), message.size()); }
inline void debug(const std::string& message) { hx_log_n(HX_LOG_DEBUG, message.data(), message.size()); }
                                                                       
template <class... T>
void print(const T&... parts) {
  std::string out;
  const char* separator = "";
  ((out += separator, out += Value(parts).str(), separator = " "), ...);
  hx_log_n(HX_LOG_INFO, out.data(), out.size());
}
                                                                                       
[[noreturn]] inline void fail(const std::string& message) { hx_throw_n(message.data(), message.size()); }
                                              
inline double now() { return hx_now(); }

                                                                                                            
inline Value vec3(double x, double y, double z) { return Value::adopt(hx_vec3_new(x, y, z)); }

}                    
`;
