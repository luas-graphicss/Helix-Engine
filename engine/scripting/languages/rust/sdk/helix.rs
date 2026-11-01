                                                     
   
                                                                               
                                                                               
                                                                                 
                                                                                  
                                                                                  
                                                                            
   
                                                                            
                                                                              
                                                                 

#![allow(dead_code)]
#![allow(clippy::missing_safety_doc)]

use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::fmt;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

mod ffi {
    #[link(wasm_import_module = "helix")]
    unsafe extern "C" {
        pub fn retain(r: u32) -> u32;
        pub fn release(r: u32);
        #[link_name = "type"]
        pub fn type_of(r: u32) -> i32;
        pub fn equals(a: u32, b: u32) -> i32;
        pub fn root() -> u32;
        pub fn script() -> u32;
        #[link_name = "self"]
        pub fn actor() -> u32;
        pub fn require(ptr: *const u8, len: usize) -> u32;
        pub fn number(v: f64) -> u32;
        pub fn boolean(v: i32) -> u32;
        pub fn string(ptr: *const u8, len: usize) -> u32;
        pub fn null() -> u32;
        pub fn array() -> u32;
        pub fn object() -> u32;
        pub fn callback(id: u32) -> u32;
        pub fn pool(r: u32) -> u32;
        pub fn to_number(r: u32) -> f64;
        pub fn to_boolean(r: u32) -> i32;
        pub fn string_bytes(r: u32) -> usize;
        pub fn string_read(r: u32, ptr: *mut u8, cap: usize) -> usize;
        pub fn get(o: u32, ptr: *const u8, len: usize) -> u32;
        pub fn index(o: u32, i: i32) -> u32;
        pub fn set(o: u32, ptr: *const u8, len: usize, v: u32);
        pub fn set_index(o: u32, i: i32, v: u32);
        pub fn has(o: u32, ptr: *const u8, len: usize) -> i32;
        pub fn delete(o: u32, ptr: *const u8, len: usize);
        pub fn length(o: u32) -> i32;
        pub fn keys(o: u32) -> u32;
        pub fn call(f: u32, args: *const u32, count: i32) -> u32;
        pub fn invoke(o: u32, ptr: *const u8, len: usize, args: *const u32, count: i32) -> u32;
        pub fn construct(c: u32, args: *const u32, count: i32) -> u32;
        pub fn log(level: i32, ptr: *const u8, len: usize);
        pub fn now() -> f64;
        pub fn fault_cell(ptr: *const u32);
        pub fn fault_take(ptr: *mut u8, cap: usize) -> usize;
    }
}

                                                                                             

                                                                                                     
static FAULT: AtomicU32 = AtomicU32::new(0);
static READY: AtomicBool = AtomicBool::new(false);

#[inline]
fn ready() {
    if !READY.load(Ordering::Relaxed) {
        READY.store(true, Ordering::Relaxed);
        unsafe { ffi::fault_cell(FAULT.as_ptr()) }
    }
}

                                                                                                                                     
#[inline]
#[track_caller]
fn check<T>(value: T) -> T {
    if FAULT.load(Ordering::Relaxed) != 0 {
        fail()
    }
    value
}

#[cold]
#[track_caller]
fn fail() -> ! {
    let mut buffer = [0u8; 2048];
    let length = unsafe { ffi::fault_take(buffer.as_mut_ptr(), buffer.len()) };
    let message = String::from_utf8_lossy(&buffer[..length.min(buffer.len())]).into_owned();
    panic!("{message}")
}

                                                                                            

                                                          
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Kind {
    Undefined,
    Null,
    Boolean,
    Number,
    String,
    Array,
    Object,
    Function,
}

impl Kind {
    fn from_code(code: i32) -> Kind {
        match code {
            1 => Kind::Null,
            2 => Kind::Boolean,
            3 => Kind::Number,
            4 => Kind::String,
            5 => Kind::Array,
            6 => Kind::Object,
            7 => Kind::Function,
            _ => Kind::Undefined,
        }
    }
}

                                                
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(i32)]
pub enum Level {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

                                                                                                                
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub const ZERO: Vec3 = Vec3 { x: 0.0, y: 0.0, z: 0.0 };

    pub const fn new(x: f64, y: f64, z: f64) -> Vec3 {
        Vec3 { x, y, z }
    }

    pub fn length(self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn normalized(self) -> Vec3 {
        let len = self.length();
        if len == 0.0 { self } else { self * (1.0 / len) }
    }

    pub fn dot(self, other: Vec3) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn cross(self, o: Vec3) -> Vec3 {
        Vec3::new(self.y * o.z - self.z * o.y, self.z * o.x - self.x * o.z, self.x * o.y - self.y * o.x)
    }
}

impl std::ops::Add for Vec3 {
    type Output = Vec3;
    fn add(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x + o.x, self.y + o.y, self.z + o.z)
    }
}

impl std::ops::Sub for Vec3 {
    type Output = Vec3;
    fn sub(self, o: Vec3) -> Vec3 {
        Vec3::new(self.x - o.x, self.y - o.y, self.z - o.z)
    }
}

impl std::ops::Mul<f64> for Vec3 {
    type Output = Vec3;
    fn mul(self, k: f64) -> Vec3 {
        Vec3::new(self.x * k, self.y * k, self.z * k)
    }
}

impl std::ops::Neg for Vec3 {
    type Output = Vec3;
    fn neg(self) -> Vec3 {
        Vec3::new(-self.x, -self.y, -self.z)
    }
}

                                                                                            

                                                                                            
#[repr(transparent)]
pub struct Value(u32);

impl Value {
                    
    pub const fn undefined() -> Value {
        Value(0)
    }

    pub fn null() -> Value {
        ready();
        Value::acquire(unsafe { ffi::null() })
    }

    pub fn array() -> Value {
        ready();
        Value::acquire(unsafe { ffi::array() })
    }

    pub fn object() -> Value {
        ready();
        Value::acquire(unsafe { ffi::object() })
    }

                                   
    pub fn list<I, T>(items: I) -> Value
    where
        I: IntoIterator<Item = T>,
        T: Into<Value>,
    {
        let array = Value::array();
        for (index, item) in items.into_iter().enumerate() {
            array.set_at(index, item);
        }
        array
    }

                                                                                                                   
    #[track_caller]
    pub fn function<F, R>(mut f: F) -> Value
    where
        F: FnMut(&[Value]) -> R + 'static,
        R: Into<Value>,
    {
        ready();
        let id = NEXT_CALLBACK.with(|next| {
            let id = next.get();
            next.set(id.wrapping_add(1).max(1));
            id
        });
        let boxed: Box<dyn FnMut(&[Value]) -> Value> = Box::new(move |args| f(args).into());
        CALLBACKS.with(|table| table.borrow_mut().insert(id, Some(boxed)));
        check(Value::acquire(unsafe { ffi::callback(id) }))
    }

                                                                                                                   
    #[track_caller]
    pub fn from_raw(handle: u32) -> Value {
        ready();
        if handle == 0 {
            return Value(0);
        }
        check(Value(unsafe { ffi::retain(handle) }))
    }

    #[inline]
    fn acquire(handle: u32) -> Value {
        Value::from_raw(handle)
    }

                                                              
    pub fn raw(&self) -> u32 {
        self.0
    }

                                                                                                                           
    pub fn into_raw(self) -> u32 {
        if self.0 == 0 {
            return 0;
        }
        unsafe { ffi::pool(self.0) }
    }

                                                                                             

    #[track_caller]
    pub fn kind(&self) -> Kind {
        Kind::from_code(check(unsafe { ffi::type_of(self.0) }))
    }

    pub fn is_undefined(&self) -> bool {
        self.0 == 0
    }

    pub fn is_null(&self) -> bool {
        self.kind() == Kind::Null
    }

                              
    pub fn is_none(&self) -> bool {
        matches!(self.kind(), Kind::Undefined | Kind::Null)
    }

    pub fn is_bool(&self) -> bool {
        self.kind() == Kind::Boolean
    }

    pub fn is_number(&self) -> bool {
        self.kind() == Kind::Number
    }

    pub fn is_string(&self) -> bool {
        self.kind() == Kind::String
    }

    pub fn is_array(&self) -> bool {
        self.kind() == Kind::Array
    }

    pub fn is_object(&self) -> bool {
        self.kind() == Kind::Object
    }

    pub fn is_function(&self) -> bool {
        self.kind() == Kind::Function
    }

                                                                                              

                                                                 
    #[track_caller]
    pub fn number(&self) -> f64 {
        check(unsafe { ffi::to_number(self.0) })
    }

                                                    
    pub fn integer(&self) -> i64 {
        let n = self.number();
        if n.is_nan() { 0 } else { n as i64 }
    }

                                                                                                  
    #[track_caller]
    pub fn boolean(&self) -> bool {
        check(unsafe { ffi::to_boolean(self.0) }) != 0
    }

                                  
    pub fn vec3(&self) -> Vec3 {
        Vec3::new(self.get("x").number(), self.get("y").number(), self.get("z").number())
    }

                                          
    pub fn to_vec(&self) -> Vec<Value> {
        self.iter().collect()
    }

                                                                                              

                                                                                      
    #[track_caller]
    pub fn get(&self, key: &str) -> Value {
        check(Value::acquire(unsafe { ffi::get(self.0, key.as_ptr(), key.len()) }))
    }

                        
    #[track_caller]
    pub fn at(&self, index: usize) -> Value {
        check(Value::acquire(unsafe { ffi::index(self.0, index as i32) }))
    }

                                                                                                         
    #[track_caller]
    pub fn set<T: Into<Value>>(&self, key: &str, value: T) {
        let value: Value = value.into();
        check(unsafe { ffi::set(self.0, key.as_ptr(), key.len(), value.0) })
    }

    #[track_caller]
    pub fn set_at<T: Into<Value>>(&self, index: usize, value: T) {
        let value: Value = value.into();
        check(unsafe { ffi::set_index(self.0, index as i32, value.0) })
    }

    #[track_caller]
    pub fn has(&self, key: &str) -> bool {
        check(unsafe { ffi::has(self.0, key.as_ptr(), key.len()) }) != 0
    }

    #[track_caller]
    pub fn delete(&self, key: &str) {
        check(unsafe { ffi::delete(self.0, key.as_ptr(), key.len()) })
    }

                                                                       
    #[track_caller]
    pub fn len(&self) -> usize {
        check(unsafe { ffi::length(self.0) }).max(0) as usize
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

                                                                         
    pub fn keys(&self) -> Vec<String> {
        let keys = check(Value::acquire(unsafe { ffi::keys(self.0) }));
        keys.iter().map(|key| key.to_string()).collect()
    }

                                        
    pub fn iter(&self) -> Iter<'_> {
        Iter { value: self, index: 0, length: self.len() }
    }

                                                                                  
    pub fn path(&self, path: &str) -> Value {
        let mut current = self.clone();
        for part in path.split('.').filter(|part| !part.is_empty()) {
            current = current.get(part);
        }
        current
    }

                                                                  
    #[track_caller]
    pub fn call<A: Args>(&self, args: A) -> Value {
        args.with_handles(|handles| check(Value::acquire(unsafe { ffi::call(self.0, handles.as_ptr(), handles.len() as i32) })))
    }

                                                                   
    #[track_caller]
    pub fn invoke<A: Args>(&self, method: &str, args: A) -> Value {
        args.with_handles(|handles| check(Value::acquire(unsafe { ffi::invoke(self.0, method.as_ptr(), method.len(), handles.as_ptr(), handles.len() as i32) })))
    }

                                   
    #[track_caller]
    pub fn construct<A: Args>(&self, args: A) -> Value {
        args.with_handles(|handles| check(Value::acquire(unsafe { ffi::construct(self.0, handles.as_ptr(), handles.len() as i32) })))
    }

                                                           
    #[track_caller]
    pub fn equals(&self, other: &Value) -> bool {
        check(unsafe { ffi::equals(self.0, other.0) }) != 0
    }
}

impl Drop for Value {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe { ffi::release(self.0) }
        }
    }
}

impl Clone for Value {
    fn clone(&self) -> Value {
        if self.0 == 0 {
            return Value(0);
        }
        Value(unsafe { ffi::retain(self.0) })
    }
}

impl Default for Value {
    fn default() -> Value {
        Value(0)
    }
}

impl PartialEq for Value {
    fn eq(&self, other: &Value) -> bool {
        self.equals(other)
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        ready();
        let length = unsafe { ffi::string_bytes(self.0) };
        let mut buffer = vec![0u8; length];
        if length > 0 {
            unsafe { ffi::string_read(self.0, buffer.as_mut_ptr(), length) };
        }
        f.write_str(&String::from_utf8_lossy(&buffer))
    }
}

impl fmt::Debug for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Value({:?}: {})", self.kind(), self)
    }
}

                                                   
pub struct Iter<'a> {
    value: &'a Value,
    index: usize,
    length: usize,
}

impl Iterator for Iter<'_> {
    type Item = Value;
    fn next(&mut self) -> Option<Value> {
        if self.index >= self.length {
            return None;
        }
        let item = self.value.at(self.index);
        self.index += 1;
        Some(item)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let rest = self.length.saturating_sub(self.index);
        (rest, Some(rest))
    }
}

impl<'a> IntoIterator for &'a Value {
    type Item = Value;
    type IntoIter = Iter<'a>;
    fn into_iter(self) -> Iter<'a> {
        self.iter()
    }
}

                                                                                              

impl From<f64> for Value {
    fn from(n: f64) -> Value {
        ready();
        Value::acquire(unsafe { ffi::number(n) })
    }
}

macro_rules! numeric_into_value {
    ($($t:ty),*) => {$(
        impl From<$t> for Value {
            fn from(n: $t) -> Value { Value::from(n as f64) }
        }
    )*};
}
numeric_into_value!(f32, i8, i16, i32, i64, isize, u8, u16, u32, u64, usize);

impl From<bool> for Value {
    fn from(b: bool) -> Value {
        ready();
        Value::acquire(unsafe { ffi::boolean(b as i32) })
    }
}

impl From<&str> for Value {
    fn from(s: &str) -> Value {
        ready();
        Value::acquire(unsafe { ffi::string(s.as_ptr(), s.len()) })
    }
}

impl From<String> for Value {
    fn from(s: String) -> Value {
        Value::from(s.as_str())
    }
}

impl From<&String> for Value {
    fn from(s: &String) -> Value {
        Value::from(s.as_str())
    }
}

impl From<()> for Value {
    fn from(_: ()) -> Value {
        Value(0)
    }
}

impl From<&Value> for Value {
    fn from(v: &Value) -> Value {
        v.clone()
    }
}

impl From<Vec3> for Value {
    fn from(v: Vec3) -> Value {
        let object = Value::object();
        object.set("x", v.x);
        object.set("y", v.y);
        object.set("z", v.z);
        object
    }
}

impl<T: Into<Value>> From<Option<T>> for Value {
    fn from(option: Option<T>) -> Value {
        match option {
            Some(value) => value.into(),
            None => Value::null(),
        }
    }
}

impl<T: Into<Value>> From<Vec<T>> for Value {
    fn from(items: Vec<T>) -> Value {
        Value::list(items)
    }
}

impl<T: Into<Value> + Clone> From<&[T]> for Value {
    fn from(items: &[T]) -> Value {
        Value::list(items.iter().cloned())
    }
}

impl<T: Into<Value>, const N: usize> From<[T; N]> for Value {
    fn from(items: [T; N]) -> Value {
        Value::list(items)
    }
}

impl<V: Into<Value>> From<HashMap<String, V>> for Value {
    fn from(map: HashMap<String, V>) -> Value {
        let object = Value::object();
        for (key, value) in map {
            object.set(&key, value);
        }
        object
    }
}

                                                                                              

                                                                                                                
pub trait Args {
    fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R;
}

impl Args for () {
    fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R {
        f(&[])
    }
}

macro_rules! tuple_args {
    ($(($count:literal: $($name:ident $index:tt),+))*) => {$(
        impl<$($name: Into<Value>),+> Args for ($($name,)+) {
            fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R {
                let values: [Value; $count] = [$(self.$index.into()),+];
                let handles: [u32; $count] = [$(values[$index].0),+];
                f(&handles)
            }
        }
    )*};
}
tuple_args!((1: A 0) (2: A 0, B 1) (3: A 0, B 1, C 2) (4: A 0, B 1, C 2, D 3) (5: A 0, B 1, C 2, D 3, E 4) (6: A 0, B 1, C 2, D 3, E 4, F 5));

impl Args for &[Value] {
    fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R {
        let handles: Vec<u32> = self.iter().map(|value| value.0).collect();
        f(&handles)
    }
}

impl Args for Vec<Value> {
    fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R {
        self.as_slice().with_handles(f)
    }
}

impl<const N: usize> Args for [Value; N] {
    fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R {
        self.as_slice().with_handles(f)
    }
}

macro_rules! single_args {
    ($($t:ty),*) => {$(
        impl Args for $t {
            fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R {
                let value: Value = self.into();
                f(&[value.0])
            }
        }
    )*};
}
single_args!(Value, &Value, &str, String, &String, f64, f32, i32, i64, u32, u64, usize, bool, Vec3);

                                                                                              

type Callback = Box<dyn FnMut(&[Value]) -> Value>;

thread_local! {
    static CALLBACKS: RefCell<HashMap<u32, Option<Callback>>> = RefCell::new(HashMap::new());
    static NEXT_CALLBACK: Cell<u32> = const { Cell::new(1) };
}

                                                                                                      
                                                                                                      
#[doc(hidden)]
#[unsafe(no_mangle)]
pub extern "C" fn __hx_invoke_callback(id: u32, args: u32) -> u32 {
    let args = Value::from_raw(args).to_vec();
    let taken = CALLBACKS.with(|table| table.borrow_mut().get_mut(&id).and_then(|slot| slot.take()));
    let Some(mut callback) = taken else {
        return 0;
    };
    let result = callback(&args);
    CALLBACKS.with(|table| {
        if let Some(slot) = table.borrow_mut().get_mut(&id) {
            if slot.is_none() {
                *slot = Some(callback);
            }
        }
    });
    result.into_raw()
}

                                                                                        
#[doc(hidden)]
#[unsafe(no_mangle)]
pub extern "C" fn __hx_drop_callback(id: u32) {
    CALLBACKS.with(|table| {
        table.borrow_mut().remove(&id);
    });
}

                                                                                                 

                                                                                         
#[track_caller]
pub fn root() -> Value {
    ready();
    check(Value::acquire(unsafe { ffi::root() }))
}

                                                                              
#[track_caller]
pub fn actor() -> Value {
    ready();
    check(Value::acquire(unsafe { ffi::actor() }))
}

                                                                   
#[track_caller]
pub fn script() -> Value {
    ready();
    check(Value::acquire(unsafe { ffi::script() }))
}

                                                                                               
#[track_caller]
pub fn require(name: &str) -> Value {
    ready();
    check(Value::acquire(unsafe { ffi::require(name.as_ptr(), name.len()) }))
}

                                           
pub fn now() -> f64 {
    ready();
    unsafe { ffi::now() }
}

pub fn log(level: Level, message: &str) {
    ready();
    unsafe { ffi::log(level as i32, message.as_ptr(), message.len()) }
}

pub fn debug(message: &str) {
    log(Level::Debug, message)
}

pub fn print(message: &str) {
    log(Level::Info, message)
}

pub fn warn(message: &str) {
    log(Level::Warn, message)
}

pub fn error(message: &str) {
    log(Level::Error, message)
}

                                                                                    
#[track_caller]
pub fn throw(message: &str) -> ! {
    panic!("{message}")
}

                                                                  
#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => { $crate::print(&format!($($arg)*)) };
}

#[macro_export]
macro_rules! warn {
    ($($arg:tt)*) => { $crate::warn(&format!($($arg)*)) };
}

#[macro_export]
macro_rules! error {
    ($($arg:tt)*) => { $crate::error(&format!($($arg)*)) };
}

#[macro_export]
macro_rules! debug {
    ($($arg:tt)*) => { $crate::debug(&format!($($arg)*)) };
}

                                                                                                

                                                                                                   
                                                 
pub trait Abi {
    type Raw;
    fn from_raw(raw: Self::Raw) -> Self;
    fn into_raw(self) -> Self::Raw;
}

macro_rules! identity_abi {
    ($($t:ty),*) => {$(
        impl Abi for $t {
            type Raw = $t;
            #[inline] fn from_raw(raw: $t) -> $t { raw }
            #[inline] fn into_raw(self) -> $t { self }
        }
    )*};
}
identity_abi!((), f64, f32, i32, u32);

impl Abi for bool {
    type Raw = i32;
    fn from_raw(raw: i32) -> bool {
        raw != 0
    }
    fn into_raw(self) -> i32 {
        self as i32
    }
}

impl Abi for Value {
    type Raw = u32;
    fn from_raw(raw: u32) -> Value {
        Value::from_raw(raw)
    }
    fn into_raw(self) -> u32 {
        Value::into_raw(self)
    }
}

impl Abi for String {
    type Raw = u32;
    fn from_raw(raw: u32) -> String {
        Value::from_raw(raw).to_string()
    }
    fn into_raw(self) -> u32 {
        Value::from(self).into_raw()
    }
}

impl Abi for Vec3 {
    type Raw = u32;
    fn from_raw(raw: u32) -> Vec3 {
        Value::from_raw(raw).vec3()
    }
    fn into_raw(self) -> u32 {
        Value::from(self).into_raw()
    }
}

                                                                                                        
                                                                                               
   
             
                   
                                                  
                                           
     
       
#[macro_export]
macro_rules! hooks {
    ($($tokens:tt)*) => { $crate::exports! { $($tokens)* } };
}

                                                                                          
                                                                                                    
#[macro_export]
macro_rules! exports {
    ($( $(#[$meta:meta])* $vis:vis fn $name:ident ( $( $arg:ident : $ty:ty ),* $(,)? ) $( -> $ret:ty )? $body:block )*) => {
        $( $crate::__export_one! { $name ( $( $arg : $ty ),* ) $( -> $ret )? $body } )*
    };
}

#[doc(hidden)]
#[macro_export]
macro_rules! __export_one {
    ($name:ident ( $( $arg:ident : $ty:ty ),* ) $body:block) => {
        $crate::__export_one! { $name ( $( $arg : $ty ),* ) -> () $body }
    };
    ($name:ident ( $( $arg:ident : $ty:ty ),* ) -> $ret:ty $body:block) => {
        #[unsafe(no_mangle)]
        pub extern "C" fn $name( $( $arg : <$ty as $crate::Abi>::Raw ),* ) -> <$ret as $crate::Abi>::Raw {
            $( let $arg: $ty = <$ty as $crate::Abi>::from_raw($arg); )*
            let result: $ret = (move || $body)();
            <$ret as $crate::Abi>::into_raw(result)
        }
    };
}

                                                                    
pub mod prelude {
    pub use crate::{actor, debug, error, exports, hooks, now, print, require, root, script, throw, warn, Kind, Level, Value, Vec3};
}
