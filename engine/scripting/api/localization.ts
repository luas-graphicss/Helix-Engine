import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { localeDisplayName, localeNativeName } from '@/engine/localization/locale/locale-names';
import { canonicalLocaleTag, localeDirection } from '@/engine/localization/locale/locale-tag';
import type { ValueFormat } from '@/engine/localization/message/message-ast';
import { MessageCache } from '@/engine/localization/message/message-cache';
import type { MessageArguments } from '@/engine/localization/message/message-formatter';
import { MessageSyntaxError } from '@/engine/localization/message/message-parser';
import { pluralCategory } from '@/engine/localization/message/plural-category';
import { MessageFormatError, formatValue } from '@/engine/localization/message/value-formatters';
import { enabledLocaleTags, type LocaleEntry } from '@/engine/localization/settings/localization-settings';
import type { RuntimeHost } from '../runtime/runtime-host';
import { HelixArgumentError } from '../runtime/script-errors';
import { requireFunction, requireNumber, requireObject, requireString } from '../runtime/values';
const LOCALE_CHANGED = 'localization.changed';
const LOG_SOURCE = 'Localização';
const NO_ARGUMENTS: MessageArguments = {};
function isMissing(value: unknown): value is null | undefined {
    return value === undefined || value === null;
}
function explainFormatting<TResult>(member: string, format: () => TResult): TResult {
    try {
        return format();
    }
    catch (cause) {
        if (cause instanceof MessageSyntaxError || cause instanceof MessageFormatError)
            throw new HelixArgumentError(member, `${cause.message}.`);
        throw cause;
    }
}
export function createLocalizationApi<TAsset>(host: RuntimeHost, describeAsset: (asset: LibraryAsset) => TAsset) {
    const { localization, session } = host;
    const patterns = new MessageCache();
    host.disposers.add(localization.onChanged((locale) => void host.bus.emit(LOCALE_CHANGED, locale)));
    function describeLocale({ tag, fallback }: LocaleEntry) {
        return {
            tag,
            name: localeDisplayName(tag, localization.locale),
            nativeName: localeNativeName(tag),
            direction: localeDirection(tag),
            fallback,
            isSource: tag === localization.settings.sourceLocale,
        };
    }
    function argumentsOf(value: unknown, member: string): MessageArguments {
        return isMissing(value) ? NO_ARGUMENTS : requireObject(value, member, 'os argumentos');
    }
    function formatAs(format: ValueFormat, member: string, value: unknown, style: unknown): string {
        const chosen = isMissing(style) ? '' : requireString(style, member, 'o estilo');
        return explainFormatting(member, () => formatValue(format, localization.locale, value, chosen));
    }
    return {
        get locale() {
            return localization.locale;
        },
        get sourceLocale() {
            return localization.settings.sourceLocale;
        },
        get direction() {
            return localeDirection(localization.locale);
        },
        locales: () => localization.settings.locales.filter((locale) => locale.enabled).map(describeLocale),
        setLocale: (tag: unknown) => {
            const wanted = requireString(tag, 'helix.localization.setLocale', 'o idioma');
            const canonical = canonicalLocaleTag(wanted);
            if (canonical !== null && localization.selectLocale(canonical))
                return true;
            host.log('warn', `helix.localization.setLocale: "${wanted}" não está entre os idiomas ativos do jogo (${enabledLocaleTags(localization.settings).join(', ')}).`, { source: LOG_SOURCE });
            return false;
        },
        t: (key: unknown, args?: unknown) => {
            const member = 'helix.localization.t';
            return localization.translate(requireString(key, member, 'a chave'), argumentsOf(args, member));
        },
        has: (key: unknown) => localization.has(requireString(key, 'helix.localization.has', 'a chave')),
        keys: () => localization.keys(),
        format: (pattern: unknown, args?: unknown) => {
            const member = 'helix.localization.format';
            const source = requireString(pattern, member, 'o texto');
            const values = argumentsOf(args, member);
            return explainFormatting(member, () => patterns.render(source, values, localization.locale));
        },
        plural: (count: unknown, ordinal?: unknown) => pluralCategory(localization.locale, requireNumber(count, 'helix.localization.plural', 'a quantidade'), ordinal === true),
        number: (value: unknown, style?: unknown) => formatAs('number', 'helix.localization.number', value, style),
        date: (value: unknown, style?: unknown) => formatAs('date', 'helix.localization.date', value, style),
        time: (value: unknown, style?: unknown) => formatAs('time', 'helix.localization.time', value, style),
        list: (values: unknown, style?: unknown) => formatAs('list', 'helix.localization.list', values, style),
        asset: (key: unknown) => {
            const assetId = localization.assetId(requireString(key, 'helix.localization.asset', 'a chave'));
            const asset = assetId === null ? null : session.library.get(assetId);
            return asset ? describeAsset(asset) : null;
        },
        onChanged: (handler: unknown) => {
            const callback = requireFunction<(locale: string) => void>(handler, 'helix.localization.onChanged');
            return host.bus.on(LOCALE_CHANGED, (locale) => callback(locale as string), host.current);
        },
    };
}
