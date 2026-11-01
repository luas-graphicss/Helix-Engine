package helix;

                                                                                            
public final class Vec3 {
    public static final Vec3 ZERO = new Vec3(0, 0, 0);
    public static final Vec3 ONE = new Vec3(1, 1, 1);
    public static final Vec3 UP = new Vec3(0, 1, 0);

    public final double x;
    public final double y;
    public final double z;

    public Vec3(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public Vec3 add(Vec3 other) {
        return new Vec3(x + other.x, y + other.y, z + other.z);
    }

    public Vec3 sub(Vec3 other) {
        return new Vec3(x - other.x, y - other.y, z - other.z);
    }

    public Vec3 scale(double k) {
        return new Vec3(x * k, y * k, z * k);
    }

    public double dot(Vec3 other) {
        return x * other.x + y * other.y + z * other.z;
    }

    public Vec3 cross(Vec3 other) {
        return new Vec3(y * other.z - z * other.y, z * other.x - x * other.z, x * other.y - y * other.x);
    }

    public double length() {
        return Math.sqrt(dot(this));
    }

    public double distance(Vec3 other) {
        return sub(other).length();
    }

                                                                
    public Vec3 normalized() {
        double n = length();
        return n == 0 ? ZERO : scale(1 / n);
    }

    public Vec3 lerp(Vec3 target, double t) {
        return new Vec3(x + (target.x - x) * t, y + (target.y - y) * t, z + (target.z - z) * t);
    }

    public Vec3 withX(double value) {
        return new Vec3(value, y, z);
    }

    public Vec3 withY(double value) {
        return new Vec3(x, value, z);
    }

    public Vec3 withZ(double value) {
        return new Vec3(x, y, value);
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof Vec3)) return false;
        Vec3 v = (Vec3) other;
        return x == v.x && y == v.y && z == v.z;
    }

    @Override
    public int hashCode() {
        return Double.hashCode(x) * 31 * 31 + Double.hashCode(y) * 31 + Double.hashCode(z);
    }

    @Override
    public String toString() {
        return "(" + x + ", " + y + ", " + z + ")";
    }
}
