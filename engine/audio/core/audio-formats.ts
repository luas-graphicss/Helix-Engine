export interface AudioFormatInfo {
    readonly extension: string;
    readonly label: string;
    readonly mimeType: string;
    readonly lossy: boolean;
}
export const AUDIO_FORMATS: readonly AudioFormatInfo[] = [
    { extension: 'wav', label: 'WAV (PCM)', mimeType: 'audio/wav', lossy: false },
    { extension: 'mp3', label: 'MP3', mimeType: 'audio/mpeg', lossy: true },
    { extension: 'ogg', label: 'Ogg Vorbis', mimeType: 'audio/ogg', lossy: true },
    { extension: 'oga', label: 'Ogg Audio', mimeType: 'audio/ogg', lossy: true },
    { extension: 'opus', label: 'Opus', mimeType: 'audio/ogg; codecs=opus', lossy: true },
    { extension: 'm4a', label: 'AAC (M4A)', mimeType: 'audio/mp4', lossy: true },
    { extension: 'aac', label: 'AAC', mimeType: 'audio/aac', lossy: true },
    { extension: 'flac', label: 'FLAC', mimeType: 'audio/flac', lossy: false },
    { extension: 'weba', label: 'WebM Audio', mimeType: 'audio/webm', lossy: true },
    { extension: 'webm', label: 'WebM', mimeType: 'audio/webm', lossy: true },
    { extension: 'aiff', label: 'AIFF', mimeType: 'audio/aiff', lossy: false },
    { extension: 'aif', label: 'AIFF', mimeType: 'audio/aiff', lossy: false },
    { extension: 'caf', label: 'Core Audio (CAF)', mimeType: 'audio/x-caf', lossy: false },
];
export const AUDIO_EXTENSIONS: readonly string[] = AUDIO_FORMATS.map((info) => info.extension);
export const AUDIO_FORMAT_SUMMARY = 'WAV, MP3, OGG/Opus, AAC/M4A, FLAC, WebM, AIFF';
export function audioFormatInfo(extension: string): AudioFormatInfo | null {
    const lower = extension.toLowerCase();
    return AUDIO_FORMATS.find((info) => info.extension === lower) ?? null;
}
export function describeAudioFormat(extension: string): string {
    return audioFormatInfo(extension)?.label ?? extension.toUpperCase();
}
export function audioMimeTypeFromFileName(fileName: string): string | null {
    const dot = fileName.lastIndexOf('.');
    if (dot < 0)
        return null;
    return audioFormatInfo(fileName.slice(dot + 1))?.mimeType ?? null;
}
export type AudioSupportHint = 'yes' | 'maybe' | 'no';
export function browserAudioSupport(mimeType: string): AudioSupportHint {
    if (typeof document === 'undefined')
        return 'maybe';
    const probe = document.createElement('audio');
    const answer = probe.canPlayType(mimeType);
    if (answer === 'probably')
        return 'yes';
    if (answer === 'maybe')
        return 'maybe';
    return 'no';
}
