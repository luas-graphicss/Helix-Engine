const MAX_STEM_LENGTH = 64;
const FALLBACK_STEM = 'asset';
const EXTENSION_PATTERN = /^[a-z0-9]{1,8}$/;
export function fileExtensionOf(name: string): string {
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    return EXTENSION_PATTERN.test(extension) ? extension : '';
}
export function fileStemOf(name: string): string {
    const withoutExtension = fileExtensionOf(name) ? name.slice(0, name.lastIndexOf('.')) : name;
    const stem = withoutExtension
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/^[._]+|[._]+$/g, '')
        .slice(0, MAX_STEM_LENGTH);
    return stem || FALLBACK_STEM;
}
export function safeFileName(name: string, extension: string): string {
    return `${fileStemOf(name)}.${extension.toLowerCase()}`;
}
export function baseNameOfPath(path: string): string {
    const segments = path.split(/[\\/]/);
    return segments[segments.length - 1];
}
export function lastPathSegment(url: URL): string {
    const segment = baseNameOfPath(url.pathname);
    try {
        return decodeURIComponent(segment);
    }
    catch (cause) {
        if (cause instanceof URIError)
            return segment;
        throw cause;
    }
}
