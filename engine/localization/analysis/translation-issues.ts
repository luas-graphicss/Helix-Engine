import { pickLocalizedValue, resolveFallbackChain } from '../fallback/fallback-chain';
import { argumentNames, walkMessage } from '../message/message-arguments';
import type { MessageNode } from '../message/message-ast';
import { MessageSyntaxError, hasMessageSyntax, parseMessage } from '../message/message-parser';
import { wholeNumberPluralCategories } from '../message/plural-category';
import { hasLocalizedValue, type LocalizationSettings, type LocalizedEntry, type StringEntry } from '../settings/localization-settings';
export type TranslationIssueKind = 'missing' | 'syntax' | 'arguments' | 'plural' | 'asset';
export type LocalizationTable = 'strings' | 'assets';
export interface TranslationIssue {
    readonly table: LocalizationTable;
    readonly key: string;
    readonly locale: string;
    readonly kind: TranslationIssueKind;
    readonly detail: string;
}
type ChainLookup = (locale: string) => readonly string[];
const PLAIN_TEXT: readonly MessageNode[] = [];
const FALLBACK_CATEGORY = 'other';
const UNASSIGNED_ASSET_DETAIL = 'nenhum idioma da cadeia de fallback tem ativo';
const REMOVED_ASSET_DETAIL = 'o ativo não está mais na biblioteca';
function chainLookup(settings: LocalizationSettings): ChainLookup {
    const chains = new Map<string, readonly string[]>();
    return (locale) => {
        const known = chains.get(locale);
        if (known)
            return known;
        const chain = resolveFallbackChain(settings, locale);
        chains.set(locale, chain);
        return chain;
    };
}
function parseOrError(text: string): readonly MessageNode[] | MessageSyntaxError {
    if (!hasMessageSyntax(text))
        return PLAIN_TEXT;
    try {
        return parseMessage(text);
    }
    catch (cause) {
        if (cause instanceof MessageSyntaxError)
            return cause;
        throw cause;
    }
}
function braced(name: string): string {
    return `{${name}}`;
}
function missingDetail(entry: LocalizedEntry, chain: readonly string[]): string {
    const shown = pickLocalizedValue(entry.values, chain);
    return shown ? `usa ${shown.locale}` : 'nenhum idioma de fallback tem valor';
}
function argumentDifferences(source: ReadonlySet<string>, translated: ReadonlySet<string>): string[] {
    const absent = [...source].filter((name) => !translated.has(name));
    const unknown = [...translated].filter((name) => !source.has(name));
    const differences: string[] = [];
    if (absent.length > 0)
        differences.push(`falta ${absent.map(braced).join(', ')}`);
    if (unknown.length > 0)
        differences.push(`${unknown.map(braced).join(', ')} não está no texto de origem`);
    return differences;
}
function pluralGaps(nodes: readonly MessageNode[], locale: string): string[] {
    const gaps: string[] = [];
    walkMessage(nodes, (node) => {
        if (node.type !== 'plural')
            return;
        const absent = wholeNumberPluralCategories(locale, node.ordinal).filter((category) => category !== FALLBACK_CATEGORY && !node.options.has(category));
        if (absent.length > 0)
            gaps.push(`${braced(node.name)} sem a forma ${absent.join(', ')}`);
    });
    return gaps;
}
function sourceArgumentNames(settings: LocalizationSettings, entry: StringEntry): ReadonlySet<string> | null {
    if (!hasLocalizedValue(entry, settings.sourceLocale))
        return null;
    const nodes = parseOrError(entry.values[settings.sourceLocale]);
    return nodes instanceof MessageSyntaxError ? null : argumentNames(nodes);
}
function stringIssuesIn(entry: StringEntry, locale: string, chain: readonly string[], sourceNames: ReadonlySet<string> | null): TranslationIssue[] {
    const report = (kind: TranslationIssueKind, detail: string): TranslationIssue => ({ table: 'strings', key: entry.key, locale, kind, detail });
    if (!hasLocalizedValue(entry, locale))
        return [report('missing', missingDetail(entry, chain))];
    const nodes = parseOrError(entry.values[locale]);
    if (nodes instanceof MessageSyntaxError)
        return [report('syntax', nodes.message)];
    const differences = sourceNames === null ? [] : argumentDifferences(sourceNames, argumentNames(nodes));
    return [...differences.map((detail) => report('arguments', detail)), ...pluralGaps(nodes, locale).map((detail) => report('plural', detail))];
}
export function findStringIssues(settings: LocalizationSettings): TranslationIssue[] {
    const chainOf = chainLookup(settings);
    return settings.strings.flatMap((entry) => {
        const sourceNames = sourceArgumentNames(settings, entry);
        return settings.locales.flatMap(({ tag }) => stringIssuesIn(entry, tag, chainOf(tag), tag === settings.sourceLocale ? null : sourceNames));
    });
}
export function findAssetIssues(settings: LocalizationSettings, isKnownAsset: (assetId: string) => boolean): TranslationIssue[] {
    const chainOf = chainLookup(settings);
    return settings.assets.flatMap((entry) => settings.locales.flatMap(({ tag }): TranslationIssue[] => {
        if (!hasLocalizedValue(entry, tag))
            return pickLocalizedValue(entry.values, chainOf(tag)) ? [] : [{ table: 'assets', key: entry.key, locale: tag, kind: 'missing', detail: UNASSIGNED_ASSET_DETAIL }];
        return isKnownAsset(entry.values[tag]) ? [] : [{ table: 'assets', key: entry.key, locale: tag, kind: 'asset', detail: REMOVED_ASSET_DETAIL }];
    }));
}
