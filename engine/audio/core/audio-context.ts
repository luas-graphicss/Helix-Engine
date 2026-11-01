export type AudioContextStatus = 'unavailable' | 'idle' | 'suspended' | 'running' | 'closed';
type Listener = () => void;
let shared: AudioContext | null = null;
const listeners = new Set<Listener>();
function notify(): void {
    for (const listener of listeners)
        listener();
}
export function isWebAudioSupported(): boolean {
    return typeof window !== 'undefined' && typeof AudioContext !== 'undefined';
}
export function getAudioContext(): AudioContext {
    if (!isWebAudioSupported())
        throw new Error('Web Audio API indisponível neste navegador.');
    if (!shared || shared.state === 'closed') {
        shared = new AudioContext({ latencyHint: 'interactive' });
        shared.onstatechange = notify;
        notify();
    }
    return shared;
}
export function peekAudioContext(): AudioContext | null {
    return shared && shared.state !== 'closed' ? shared : null;
}
export function audioContextStatus(): AudioContextStatus {
    if (!isWebAudioSupported())
        return 'unavailable';
    if (!shared)
        return 'idle';
    return shared.state;
}
export async function resumeAudioContext(): Promise<boolean> {
    if (!isWebAudioSupported())
        return false;
    const context = getAudioContext();
    if (context.state === 'running')
        return true;
    try {
        await context.resume();
    }
    catch {
    }
    notify();
    return (context.state as AudioContextState) === 'running';
}
export function subscribeAudioContext(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
