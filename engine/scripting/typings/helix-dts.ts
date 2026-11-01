const PRIMITIVES = `
                                                                                                  
  export interface Vec3 extends Float32Array {
    x: number
    y: number
    z: number
    r: number
    g: number
    b: number
  }
                                  
  export interface Quat extends Float32Array {
    x: number
    y: number
    z: number
    w: number
  }
  export type Mat4 = Float32Array
  export type Mat3 = Float32Array
                                                                                       
  export type Vec3Like = Vec3 | ArrayLike<number> | { x: number; y: number; z: number }
  export type QuatLike = Quat | ArrayLike<number> | { x: number; y: number; z: number; w: number }
                                                                                                   
  export type ColorLike = Vec3Like | string
     
                                                                          
                                                                               
                                                                      
     
  export type SettingsInput<T> = { [K in keyof T]?: T[K] extends Vec3 ? Vec3Like : T[K] extends Quat ? QuatLike : T[K] extends object ? SettingsInput<T[K]> : T[K] }
  export interface Aabb {
    readonly min: Vec3
    readonly max: Vec3
  }
  export interface Ray {
    readonly origin: Vec3
    readonly direction: Vec3
  }
  export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
  export type Unsubscribe = () => void
  export type Space = 'local' | 'world'
`;
const SCENE_TYPES = `
`;
