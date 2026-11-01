const relativeTime = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
export function formatRelativeTime(epochMs: number, now = Date.now()): string {
    const elapsed = now - epochMs;
    if (elapsed < MINUTE)
        return 'agora há pouco';
    if (elapsed < HOUR)
        return relativeTime.format(-Math.round(elapsed / MINUTE), 'minute');
    if (elapsed < DAY)
        return relativeTime.format(-Math.round(elapsed / HOUR), 'hour');
    if (elapsed < 30 * DAY)
        return relativeTime.format(-Math.round(elapsed / DAY), 'day');
    return dateTime.format(epochMs);
}
export function formatDateTime(epochMs: number): string {
    return dateTime.format(epochMs);
}
export function plural(count: number, singular: string, pluralForm: string): string {
    return `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : pluralForm}`;
}
