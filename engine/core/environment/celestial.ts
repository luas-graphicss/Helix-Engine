import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { degToRad, radToDeg } from '@/engine/core/math/scalar';
const SOLAR_DECLINATION = degToRad(12);
const HOURS_TO_RAD = Math.PI / 12;
const scratchAxis = vec3.create();
export function sunDirectionFromTime(out: Vec3, timeOfDay: number, latitudeDeg: number, azimuthOffsetDeg: number): Vec3 {
    const hourAngle = (timeOfDay - 12) * HOURS_TO_RAD;
    const latitude = degToRad(latitudeDeg);
    const sinDec = Math.sin(SOLAR_DECLINATION);
    const cosDec = Math.cos(SOLAR_DECLINATION);
    const sinLat = Math.sin(latitude);
    const cosLat = Math.cos(latitude);
    const cosHour = Math.cos(hourAngle);
    const east = -cosDec * Math.sin(hourAngle);
    const north = sinDec * cosLat - cosDec * cosHour * sinLat;
    const up = sinDec * sinLat + cosDec * cosHour * cosLat;
    vec3.set(out, east, up, -north);
    return vec3.rotateY(out, out, degToRad(azimuthOffsetDeg));
}
export function celestialPoleAxis(out: Vec3, latitudeDeg: number, azimuthOffsetDeg: number): Vec3 {
    const latitude = degToRad(latitudeDeg);
    vec3.set(out, 0, Math.sin(latitude), -Math.cos(latitude));
    return vec3.rotateY(out, out, degToRad(azimuthOffsetDeg));
}
export function hourAngleFromTime(timeOfDay: number): number {
    return (timeOfDay - 12) * HOURS_TO_RAD;
}
export function moonDirectionFromSun(out: Vec3, sunDirection: Vec3, moonPhase: number, latitudeDeg: number, azimuthOffsetDeg: number): Vec3 {
    celestialPoleAxis(scratchAxis, latitudeDeg, azimuthOffsetDeg);
    return vec3.rotateAroundAxis(out, sunDirection, scratchAxis, moonPhase * Math.PI * 2);
}
export function moonPhaseName(moonPhase: number): string {
    const phase = ((moonPhase % 1) + 1) % 1;
    if (phase < 0.03 || phase > 0.97)
        return 'Lua nova';
    if (phase < 0.22)
        return 'Crescente côncava';
    if (phase < 0.28)
        return 'Quarto crescente';
    if (phase < 0.47)
        return 'Crescente gibosa';
    if (phase < 0.53)
        return 'Lua cheia';
    if (phase < 0.72)
        return 'Minguante gibosa';
    if (phase < 0.78)
        return 'Quarto minguante';
    return 'Minguante côncava';
}
export function moonLitFraction(sunDirection: Vec3, moonDirection: Vec3): number {
    const fraction = (1 - vec3.dot(sunDirection, moonDirection)) * 0.5;
    return Math.min(1, Math.max(0, fraction));
}
export function sunRotationFromDirection(outRotationDeg: Vec3, direction: Vec3): Vec3 {
    const y = Math.max(-1, Math.min(1, direction[1]));
    return vec3.set(outRotationDeg, -radToDeg(Math.asin(y)), radToDeg(Math.atan2(direction[0], direction[2])), 0);
}
export function formatTimeOfDay(timeOfDay: number): string {
    const totalMinutes = Math.round(((timeOfDay % 24) + 24) % 24 * 60) % 1440;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
