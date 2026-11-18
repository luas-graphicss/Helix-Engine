const CREATIVE_COMMONS_HOST = 'creativecommons.org';
const PUBLIC_DOMAIN_LABELS: ReadonlyMap<string, string> = new Map([
    ['zero', 'CC0'],
    ['cc0', 'CC0'],
    ['mark', 'Public Domain Mark'],
    ['pdm', 'Public Domain Mark'],
]);
const VERSION_PATTERN = /^\d+(\.\d+)?$/;
const UNKNOWN_LICENSE = 'Unknown license';
function versionSuffix(version: string): string {
    return VERSION_PATTERN.test(version) ? ` ${version}` : '';
}
export function licenseLabelFromCode(code: string, version = ''): string {
    const normalized = code.trim().toLowerCase();
    if (!normalized)
        return UNKNOWN_LICENSE;
    const publicDomain = PUBLIC_DOMAIN_LABELS.get(normalized);
    return `${publicDomain ?? `CC ${normalized.toUpperCase()}`}${versionSuffix(version)}`;
}
export function licenseLabelFromUrl(address: string): string {
    const trimmed = address.trim();
    if (!URL.canParse(trimmed))
        return trimmed || UNKNOWN_LICENSE;
    const url = new URL(trimmed);
    const [family, code = '', version = ''] = url.pathname.split('/').filter(Boolean);
    const isCreativeCommons = url.hostname === CREATIVE_COMMONS_HOST || url.hostname.endsWith(`.${CREATIVE_COMMONS_HOST}`);
    if (!isCreativeCommons || (family !== 'licenses' && family !== 'publicdomain'))
        return trimmed;
    return licenseLabelFromCode(code, version);
}
export function requiresAttribution(license: string): boolean {
    return !/^(CC0|Public Domain)/i.test(license);
}
