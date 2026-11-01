const CURVE_SAMPLES = 2048;
export function createDistortionCurve(drive: number): Float32Array<ArrayBuffer> {
    const k = Math.max(0, Math.min(1, drive)) * 60;
    const curve = new Float32Array(CURVE_SAMPLES);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = (i * 2) / (CURVE_SAMPLES - 1) - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
}
