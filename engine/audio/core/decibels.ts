export const SILENCE_DB = -100;
export function dbToGain(db: number): number {
    if (!Number.isFinite(db) || db <= SILENCE_DB)
        return 0;
    return Math.pow(10, db / 20);
}
export function gainToDb(gain: number): number {
    if (!(gain > 0))
        return Number.NEGATIVE_INFINITY;
    return 20 * Math.log10(gain);
}
export function semitonesToRate(semitones: number): number {
    return Math.pow(2, semitones / 12);
}
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
export function formatDb(db: number, digits = 1): string {
    if (!Number.isFinite(db) || db <= SILENCE_DB)
        return '−∞ dB';
    const rounded = Number(db.toFixed(digits));
    const text = Math.abs(rounded).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (rounded > 0)
        return `+${text} dB`;
    if (rounded < 0)
        return `−${text} dB`;
    return `${text} dB`;
}
export function formatSemitones(semitones: number): string {
    const rounded = Number(semitones.toFixed(2));
    const text = Math.abs(rounded).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    if (rounded > 0)
        return `+${text} st`;
    if (rounded < 0)
        return `−${text} st`;
    return '0 st';
}
export function formatHertz(frequency: number): string {
    if (frequency >= 1000)
        return `${(frequency / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kHz`;
    return `${Math.round(frequency).toLocaleString('pt-BR')} Hz`;
}
export function formatPercent(fraction: number): string {
    return `${Math.round(fraction * 100)}%`;
}
export function formatMilliseconds(seconds: number): string {
    if (seconds >= 1)
        return `${seconds.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`;
    return `${Math.round(seconds * 1000)} ms`;
}
export function formatClipTime(seconds: number): string {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    const rest = safe - minutes * 60;
    const whole = Math.floor(rest);
    const hundredths = Math.floor((rest - whole) * 100);
    return `${minutes}:${String(whole).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
