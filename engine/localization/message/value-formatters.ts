import type { ValueFormat } from './message-ast';
const CURRENCY_PREFIX = 'currency:';
const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/;
const NUMBER_STYLES = new Map<string, Intl.NumberFormatOptions>([
    ['', {}],
    ['integer', { maximumFractionDigits: 0 }],
    ['percent', { style: 'percent' }],
    ['compact', { notation: 'compact' }],
]);
const DATE_TIME_STYLES = ['short', 'medium', 'long', 'full'] as const;
type DateTimeStyle = (typeof DATE_TIME_STYLES)[number];
const DEFAULT_DATE_TIME_STYLE: DateTimeStyle = 'medium';
const LIST_TYPES = new Map<string, Intl.ListFormatType>([
    ['', 'conjunction'],
    ['and', 'conjunction'],
    ['or', 'disjunction'],
    ['unit', 'unit'],
]);
const MAX_CACHED_FORMATTERS = 256;
type ValueFormatter = (value: unknown) => string;
const formatters = new Map<string, ValueFormatter>();
export class MessageFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MessageFormatError';
    }
}
function numberOptions(style: string): Intl.NumberFormatOptions {
    if (style.startsWith(CURRENCY_PREFIX)) {
        const currency = style.slice(CURRENCY_PREFIX.length).trim();
        if (!CURRENCY_CODE_PATTERN.test(currency))
            throw new MessageFormatError(`moeda "${currency}" inválida; use um código de três letras, como currency:BRL`);
        return { style: 'currency', currency: currency.toUpperCase() };
    }
    const options = NUMBER_STYLES.get(style);
    if (!options)
        throw new MessageFormatError(`estilo de número "${style}" desconhecido; use integer, percent, compact ou currency:CÓDIGO`);
    return options;
}
function dateTimeStyle(style: string): DateTimeStyle {
    if (style === '')
        return DEFAULT_DATE_TIME_STYLE;
    const known = DATE_TIME_STYLES.find((candidate) => candidate === style);
    if (!known)
        throw new MessageFormatError(`estilo de data "${style}" desconhecido; use short, medium, long ou full`);
    return known;
}
function toDate(value: unknown): Date | null {
    if (!(value instanceof Date) && typeof value !== 'number' && typeof value !== 'string')
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function numberFormatter(locale: string, style: string): ValueFormatter {
    const format = new Intl.NumberFormat(locale, numberOptions(style));
    return (value) => {
        if (typeof value === 'bigint')
            return format.format(value);
        const number = Number(value);
        return Number.isNaN(number) ? String(value) : format.format(number);
    };
}
function dateTimeFormatter(format: Intl.DateTimeFormat): ValueFormatter {
    return (value) => {
        const date = toDate(value);
        return date === null ? String(value) : format.format(date);
    };
}
function listFormatter(locale: string, style: string): ValueFormatter {
    const type = LIST_TYPES.get(style);
    if (!type)
        throw new MessageFormatError(`estilo de lista "${style}" desconhecido; use and, or ou unit`);
    const format = new Intl.ListFormat(locale, { type });
    return (value) => format.format(Array.isArray(value) ? value.map(String) : [String(value)]);
}
function createFormatter(format: ValueFormat, locale: string, style: string): ValueFormatter {
    switch (format) {
        case 'number':
            return numberFormatter(locale, style);
        case 'date':
            return dateTimeFormatter(new Intl.DateTimeFormat(locale, { dateStyle: dateTimeStyle(style) }));
        case 'time':
            return dateTimeFormatter(new Intl.DateTimeFormat(locale, { timeStyle: dateTimeStyle(style) }));
        case 'list':
            return listFormatter(locale, style);
    }
}
export function formatValue(format: ValueFormat, locale: string, value: unknown, style = ''): string {
    const cacheKey = `${format}|${locale}|${style}`;
    const known = formatters.get(cacheKey);
    if (known)
        return known(value);
    const formatter = createFormatter(format, locale, style);
    if (formatters.size >= MAX_CACHED_FORMATTERS)
        formatters.clear();
    formatters.set(cacheKey, formatter);
    return formatter(value);
}
