                                                     
   
                                                                               
                                                                               
                                                                                 
                                                                                  
                                                                                  
                                                                            
   
                                                                            
                                                                              
                                                                 

#![allow(dead_code)]
#![allow(clippy::missing_safety_doc)]


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

                                                                                                                                     
#[inline]
#[track_caller]

#[cold]
#[track_caller]

                                                                                            

                                                          
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]


                                                
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(i32)]

                                                                                                                
#[derive(Clone, Copy, Debug, Default, PartialEq)]






                                                                                            

                                                                                            
#[repr(transparent)]








                                                   



                                                                                              


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
