import type { ClothState } from '@/engine/cloth/solver/cloth-state';
export interface ClothAir {
    readonly windX: number;
    readonly windY: number;
    readonly windZ: number;
    readonly turbulence: number;
    readonly drag: number;
}
interface WindFrame {
    readonly speed: number;
    readonly alongX: number;
    readonly alongY: number;
    readonly alongZ: number;
    readonly acrossX: number;
    readonly acrossZ: number;
}
const AIR_DRAG_COEFFICIENT = 1;
const TANGENTIAL_DRAG_SHARE = 0.35;
const NORMAL_DRAG_SHARE = 1 - TANGENTIAL_DRAG_SHARE;
const MIN_WIND_SPEED = 1e-4;
const MIN_SQUARED_DOUBLE_AREA = 1e-16;
const SWELL_STRENGTH = 0.5;
const SWELL_WAVENUMBER = 0.7;
const SWELL_FREQUENCY = 1.1;
const RIPPLE_WAVENUMBER = 5;
const RIPPLE_SPEED_RATIO = 0.5;
const RIPPLE_SPREAD = 1.7;
const RIPPLE_SHARE = 0.65;
const FLUTTER_WAVENUMBER = 11;
const FLUTTER_SPEED_RATIO = 0.35;
const FLUTTER_SPREAD = 2.9;
const CROSS_GUST_RATIO = 0.6;
const LIFT_GUST_RATIO = 0.25;
const wind = new Float32Array(3);
function measureWind(air: ClothAir): WindFrame | null {
    const speed = Math.hypot(air.windX, air.windY, air.windZ);
    if (speed < MIN_WIND_SPEED)
        return null;
    const alongX = air.windX / speed;
    const alongZ = air.windZ / speed;
    const horizontal = Math.hypot(alongX, alongZ);
    const upright = horizontal < MIN_WIND_SPEED;
    return {
        speed,
        alongX,
        alongY: air.windY / speed,
        alongZ,
        acrossX: upright ? 1 : -alongZ / horizontal,
        acrossZ: upright ? 0 : alongX / horizontal,
    };
}
function sampleWind(air: ClothAir, frame: WindFrame | null, x: number, y: number, z: number, time: number): void {
    wind[0] = air.windX;
    wind[1] = air.windY;
    wind[2] = air.windZ;
    if (!frame || air.turbulence === 0)
        return;
    const along = x * frame.alongX + y * frame.alongY + z * frame.alongZ;
    const across = x * frame.acrossX + z * frame.acrossZ;
    const swell = Math.sin(SWELL_WAVENUMBER * along - SWELL_FREQUENCY * time);
    const ripple = Math.sin(RIPPLE_WAVENUMBER * (along - RIPPLE_SPEED_RATIO * frame.speed * time) + RIPPLE_SPREAD * across);
    const flutter = Math.sin(FLUTTER_WAVENUMBER * (along - FLUTTER_SPEED_RATIO * frame.speed * time) + FLUTTER_SPREAD * y);
    const gain = 1 + air.turbulence * SWELL_STRENGTH * swell;
    const gust = air.turbulence * frame.speed;
    const cross = gust * CROSS_GUST_RATIO * (RIPPLE_SHARE * ripple + (1 - RIPPLE_SHARE) * flutter);
    wind[0] = air.windX * gain + frame.acrossX * cross;
    wind[1] = air.windY * gain + gust * LIFT_GUST_RATIO * flutter;
    wind[2] = air.windZ * gain + frame.acrossZ * cross;
}
function implicitGain(rate: number): number {
    return rate / (1 + rate);
}
export function applyAerodynamics(state: ClothState, triangles: Uint32Array, air: ClothAir, time: number, stepSeconds: number): void {
    const drag = air.drag * AIR_DRAG_COEFFICIENT;
    if (drag === 0)
        return;
    const { positions, velocities, inverseMasses } = state;
    const frame = measureWind(air);
    const couplingPerDoubleArea = (drag * stepSeconds) / 6;
    for (let corner = 0; corner < triangles.length; corner += 3) {
        const first = triangles[corner];
        const second = triangles[corner + 1];
        const third = triangles[corner + 2];
        const a = first * 3;
        const b = second * 3;
        const c = third * 3;
        const abx = positions[b] - positions[a];
        const aby = positions[b + 1] - positions[a + 1];
        const abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a];
        const acy = positions[c + 1] - positions[a + 1];
        const acz = positions[c + 2] - positions[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        const squaredDoubleArea = nx * nx + ny * ny + nz * nz;
        if (squaredDoubleArea < MIN_SQUARED_DOUBLE_AREA)
            continue;
        sampleWind(air, frame, (positions[a] + positions[b] + positions[c]) / 3, (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3, (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3, time);
        const flowX = wind[0] - (velocities[a] + velocities[b] + velocities[c]) / 3;
        const flowY = wind[1] - (velocities[a + 1] + velocities[b + 1] + velocities[c + 1]) / 3;
        const flowZ = wind[2] - (velocities[a + 2] + velocities[b + 2] + velocities[c + 2]) / 3;
        const normalFlow = ((flowX * nx + flowY * ny + flowZ * nz) / squaredDoubleArea) * NORMAL_DRAG_SHARE;
        const pushX = TANGENTIAL_DRAG_SHARE * flowX + normalFlow * nx;
        const pushY = TANGENTIAL_DRAG_SHARE * flowY + normalFlow * ny;
        const pushZ = TANGENTIAL_DRAG_SHARE * flowZ + normalFlow * nz;
        const coupling = Math.sqrt(squaredDoubleArea) * couplingPerDoubleArea;
        const firstGain = implicitGain(coupling * inverseMasses[first]);
        const secondGain = implicitGain(coupling * inverseMasses[second]);
        const thirdGain = implicitGain(coupling * inverseMasses[third]);
        velocities[a] += pushX * firstGain;
        velocities[a + 1] += pushY * firstGain;
        velocities[a + 2] += pushZ * firstGain;
        velocities[b] += pushX * secondGain;
        velocities[b + 1] += pushY * secondGain;
        velocities[b + 2] += pushZ * secondGain;
        velocities[c] += pushX * thirdGain;
        velocities[c + 1] += pushY * thirdGain;
        velocities[c + 2] += pushZ * thirdGain;
    }
}
