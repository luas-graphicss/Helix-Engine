                                                     
   
                                                                               
                                                                               
                                                                                 
                                                                                  
                                                                                  
                                                                            
   
                                                                            
                                                                              
                                                                 

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



                                                   



                                                                                              


macro_rules! numeric_into_value {
    ($($t:ty),*) => {$(
        impl From<$t> for Value {
            fn from(n: $t) -> Value { Value::from(n as f64) }
        }
    )*};
}













                                                                                              

                                                                                                                
pub trait Args {
    fn with_handles<R>(self, f: impl FnOnce(&[u32]) -> R) -> R;
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

                                                                                              


thread_local! {
    static CALLBACKS: RefCell<HashMap<u32, Option<Callback>>> = RefCell::new(HashMap::new());
    static NEXT_CALLBACK: Cell<u32> = const { Cell::new(1) };
}

                                                                                                      
                                                                                                      
#[doc(hidden)]
#[unsafe(no_mangle)]

                                                                                        
#[doc(hidden)]
#[unsafe(no_mangle)]

                                                                                                 

                                                                                         
#[track_caller]

                                                                              
#[track_caller]

                                                                   
#[track_caller]

                                                                                               
#[track_caller]

                                           






                                                                                    
#[track_caller]

                                                                  
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
}
