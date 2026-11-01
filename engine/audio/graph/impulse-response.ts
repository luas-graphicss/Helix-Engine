import type { ReverbSettings } from '@/engine/audio/clip/audio-effects';
const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const CACHE_LIMIT = 8;
export function impulseResponseKey(settings: ReverbSettings): string {
    return `${settings.size.toFixed(3)}|${settings.decay.toFixed(3)}|${Math.round(settings.damping)}`;
}
export function createImpulseResponse(context: BaseAudioContext, settings: ReverbSettings): AudioBuffer {
    let store = cache.get(context);
    if (!store) {
        store = new Map();
        cache.set(context, store);
    }
    const key = impulseResponseKey(settings);
    const cached = store.get(key);
    if (cached)
        return cached;
    const { sampleRate } = context;
    const length = Math.max(1, Math.round(Math.min(12, Math.max(0.05, settings.size)) * sampleRate));
    const buffer = context.createBuffer(2, length, sampleRate);
    const decay = Math.max(0.1, settings.decay);
    const startCutoff = Math.max(200, settings.damping);
    const endCutoff = Math.max(120, startCutoff * 0.25);
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let filtered = 0;
        for (let i = 0; i < length; i++) {
            const progress = i / length;
            const cutoff = startCutoff + (endCutoff - startCutoff) * progress;
            const alpha = Math.exp((-2 * Math.PI * cutoff) / sampleRate);
            const noise = Math.random() * 2 - 1;
            filtered = alpha * filtered + (1 - alpha) * noise;
            data[i] = filtered * Math.pow(1 - progress, decay);
        }
    }
    let energy = 0;
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++)
            energy += data[i] * data[i];
    }
    const scale = energy > 0 ? 1 / Math.sqrt(energy / 2) : 1;
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++)
            data[i] *= scale;
    }
    store.set(key, buffer);
    if (store.size > CACHE_LIMIT) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined)
            store.delete(oldest);
    }
    return buffer;
}
