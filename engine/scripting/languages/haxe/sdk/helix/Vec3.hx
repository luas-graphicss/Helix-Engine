package helix;

                                                                    
typedef Xyz = {
	var x:Float;
	var y:Float;
	var z:Float;
}

   
                                                                              
                                                                        
                                                                        
                                                           
   
@:forward(x, y, z)
abstract Vec3(Xyz) from Xyz to Xyz {
	public inline function new(x:Float, y:Float, z:Float) {
		this = {x: x, y: y, z: z};
	}

	public static var zero(get, never):Vec3;

	static inline function get_zero():Vec3 return new Vec3(0, 0, 0);

	public static var one(get, never):Vec3;

	static inline function get_one():Vec3 return new Vec3(1, 1, 1);

	public static var up(get, never):Vec3;

	static inline function get_up():Vec3 return new Vec3(0, 1, 0);

	public static var down(get, never):Vec3;

	static inline function get_down():Vec3 return new Vec3(0, -1, 0);

	public static var forward(get, never):Vec3;

	static inline function get_forward():Vec3 return new Vec3(0, 0, -1);

	public static var back(get, never):Vec3;

	static inline function get_back():Vec3 return new Vec3(0, 0, 1);

	public static var right(get, never):Vec3;

	static inline function get_right():Vec3 return new Vec3(1, 0, 0);

	public static var left(get, never):Vec3;

	static inline function get_left():Vec3 return new Vec3(-1, 0, 0);

	                                                                                                
	public static function of(value:Dynamic):Vec3 {
		if (value == null) return zero;
		if (js.Syntax.typeof(value.x) == "number") return new Vec3(value.x, value.y, value.z);
		if (js.Syntax.typeof(value.length) == "number") return new Vec3(value[0], value[1], value[2]);
		throw new haxe.Exception("Vec3.of esperava {x, y, z} ou [x, y, z].");
	}

	@:op(A + B) public inline function add(other:Vec3):Vec3 {
		return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
	}

	@:op(A - B) public inline function sub(other:Vec3):Vec3 {
		return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
	}

	@:op(A * B) @:commutative public inline function scale(factor:Float):Vec3 {
		return new Vec3(this.x * factor, this.y * factor, this.z * factor);
	}

	@:op(A / B) public inline function divide(factor:Float):Vec3 {
		return new Vec3(this.x / factor, this.y / factor, this.z / factor);
	}

	@:op(-A) public inline function negate():Vec3 {
		return new Vec3(-this.x, -this.y, -this.z);
	}

	@:op(A == B) public inline function equals(other:Vec3):Bool {
		return this.x == other.x && this.y == other.y && this.z == other.z;
	}

	@:op(A != B) public inline function differs(other:Vec3):Bool {
		return !equals(other);
	}

	public var length(get, never):Float;

	inline function get_length():Float {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}

	public inline function normalized():Vec3 {
		var size = length;
		return size == 0 ? new Vec3(this.x, this.y, this.z) : divide(size);
	}

	public inline function dot(other:Vec3):Float {
		return this.x * other.x + this.y * other.y + this.z * other.z;
	}

	public inline function cross(other:Vec3):Vec3 {
		return new Vec3(this.y * other.z - this.z * other.y, this.z * other.x - this.x * other.z, this.x * other.y - this.y * other.x);
	}

	public inline function distanceTo(other:Vec3):Float {
		return sub(other).length;
	}

	public inline function lerp(other:Vec3, t:Float):Vec3 {
		return new Vec3(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t, this.z + (other.z - this.z) * t);
	}

	public inline function clone():Vec3 {
		return new Vec3(this.x, this.y, this.z);
	}

	public function toString():String {
		return 'Vec3(${this.x}, ${this.y}, ${this.z})';
	}
}
