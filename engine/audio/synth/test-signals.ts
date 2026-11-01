export type TestSignalKind = 'hum' | 'noise' | 'beeps';
export interface TestSignalInfo {
    readonly kind: TestSignalKind;
    readonly label: string;
    readonly fileName: string;
    readonly description: string;
}
export const TEST_SIGNALS: readonly TestSignalInfo[] = [
    { kind: 'hum', label: 'Zumbido 110 Hz', fileName: 'Teste - Zumbido.wav', description: 'Tom grave com harmônicos em laço perfeito: bom para distância, cone e reverberação.' },
    { kind: 'noise', label: 'Ruído rosa', fileName: 'Teste - Ruído rosa.wav', description: 'Banda larga constante: o que melhor revela absorção do ar, oclusão e filtros de zona.' },
    { kind: 'beeps', label: 'Bipes a cada 0,5 s', fileName: 'Teste - Bipes.wav', description: 'Pulsos curtos e agudos: posição, Doppler e eco ficam evidentes.' },
];
export const TEST_SIGNAL_SAMPLE_RATE = 48000;
const LOOP_SECONDS = 4;
const PEAK = 0.5;
const CROSSFADE_SECONDS = 0.02;
function renderHum(out: Float32Array, sampleRate: number): void {
    const base = Math.round(110 * LOOP_SECONDS) / LOOP_SECONDS;
    const harmonics = [1, 2, 3, 4, 6];
    const weights = [1, 0.5, 0.33, 0.2, 0.1];
    const tremoloHz = 2 / LOOP_SECONDS;
    let peak = 0;
    for (let i = 0; i < out.length; i++) {
        const t = i / sampleRate;
        let sample = 0;
        for (let h = 0; h < harmonics.length; h++)
            sample += Math.sin(2 * Math.PI * base * harmonics[h] * t) * weights[h];
        sample *= 0.85 + 0.15 * Math.sin(2 * Math.PI * tremoloHz * t);
        out[i] = sample;
        peak = Math.max(peak, Math.abs(sample));
    }
    const scale = PEAK / peak;
    for (let i = 0; i < out.length; i++)
        out[i] *= scale;
}
function renderPinkNoise(out: Float32Array, sampleRate: number): void {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    let peak = 0;
    for (let i = 0; i < out.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        out[i] = pink;
        peak = Math.max(peak, Math.abs(pink));
    }
    const scale = PEAK / peak;
    for (let i = 0; i < out.length; i++)
        out[i] *= scale;
    const fade = Math.floor(CROSSFADE_SECONDS * sampleRate);
    for (let i = 0; i < fade; i++) {
        const t = i / fade;
        const head = out[i];
        const tail = out[out.length - fade + i];
        out[i] = head * t + tail * (1 - t);
    }
    for (let i = 0; i < fade; i++)
        out[out.length - fade + i] *= 1 - i / fade;
}
function renderBeeps(out: Float32Array, sampleRate: number): void {
    const period = 0.5;
    const length = 0.07;
    const frequency = 880;
    const attack = 0.004;
    for (let i = 0; i < out.length; i++) {
        const t = i / sampleRate;
        const phase = t % period;
        if (phase >= length) {
            out[i] = 0;
            continue;
        }
        const envelope = phase < attack ? phase / attack : Math.exp(-(phase - attack) * 55);
        out[i] = Math.sin(2 * Math.PI * frequency * phase) * envelope * PEAK;
    }
}
export function renderTestSignal(kind: TestSignalKind, sampleRate = TEST_SIGNAL_SAMPLE_RATE): AudioBuffer {
    const length = Math.round(LOOP_SECONDS * sampleRate);
    const buffer = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 });
    const data = buffer.getChannelData(0);
    switch (kind) {
        case 'hum':
            renderHum(data, sampleRate);
            break;
        case 'noise':
            renderPinkNoise(data, sampleRate);
            break;
        case 'beeps':
            renderBeeps(data, sampleRate);
            break;
    }
    return buffer;
}
export function findTestSignal(kind: TestSignalKind): TestSignalInfo {
    const info = TEST_SIGNALS.find((signal) => signal.kind === kind);
    if (!info)
        throw new Error(`Sinal de teste desconhecido: ${kind}.`);
    return info;
}
