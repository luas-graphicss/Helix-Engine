export interface Softness {
    biasRate: number;
    massScale: number;
    impulseScale: number;
}
export function createSoftness(): Softness {
    return { biasRate: 0, massScale: 1, impulseScale: 0 };
}
export function computeSoftness(out: Softness, hertz: number, dampingRatio: number, h: number): Softness {
    if (hertz <= 0) {
        out.biasRate = 0;
        out.massScale = 1;
        out.impulseScale = 0;
        return out;
    }
    const omega = 2 * Math.PI * hertz;
    const a1 = 2 * dampingRatio + h * omega;
    const a2 = h * omega * a1;
    const a3 = 1 / (1 + a2);
    out.biasRate = omega / a1;
    out.massScale = a2 * a3;
    out.impulseScale = a3;
    return out;
}
