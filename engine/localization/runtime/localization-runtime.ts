import { pickLocalizedValue, resolveFallbackChain } from '../fallback/fallback-chain';
import { MessageCache } from '../message/message-cache';
import type { MessageArguments } from '../message/message-formatter';
import { MessageSyntaxError } from '../message/message-parser';
import { MessageFormatError } from '../message/value-formatters';
import { findLocale, type LocaleEntry, type LocalizationSettings, type StringEntry } from '../settings/localization-settings';
import { resolveStartupLocale } from './startup-locale';
export interface LocalizationRuntimeOptions {
    readonly settings: () => LocalizationSettings;
    readonly preferredLocales: () => readonly string[];
    readonly warn: (message: string) => void;
}
type LocaleListener = (locale: string) => void;
interface ChainMemo {
    readonly locales: readonly LocaleEntry[];
    readonly sourceLocale: string;
    readonly locale: string;
    readonly chain: readonly string[];
}
interface StringIndex {
    readonly entries: readonly StringEntry[];
    readonly byKey: ReadonlyMap<string, StringEntry>;
}
const NO_ARGUMENTS: MessageArguments = {};
const MAX_WARNINGS = 200;
export class LocalizationRuntime {
    private selected: string | null = null;
    private chainMemo: ChainMemo | null = null;
    private stringIndex: StringIndex | null = null;
    private readonly messages = new MessageCache();
    private readonly warned = new Set<string>();
    private readonly listeners = new Set<LocaleListener>();
    constructor(private readonly options: LocalizationRuntimeOptions) { }
    get settings(): LocalizationSettings {
        return this.options.settings();
    }
    get locale(): string {
        const { settings } = this;
        if (this.selected !== null && findLocale(settings, this.selected)?.enabled)
            return this.selected;
        return resolveStartupLocale(settings, this.options.preferredLocales());
    }
    start(): void {
        this.warned.clear();
        this.selected = resolveStartupLocale(this.settings, this.options.preferredLocales());
    }
    stop(): void {
        this.selected = null;
        this.listeners.clear();
    }
    selectLocale(tag: string): boolean {
        if (!findLocale(this.settings, tag)?.enabled)
            return false;
        const changed = tag !== this.locale;
        this.selected = tag;
        if (changed)
            this.refresh();
        return true;
    }
    refresh(): void {
        const { locale } = this;
        for (const listener of [...this.listeners])
            listener(locale);
    }
    onChanged(listener: LocaleListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    translate(key: string, args: MessageArguments = NO_ARGUMENTS): string {
        const entry = this.strings().get(key);
        if (!entry) {
            this.warnOnce(`unknown|${key}`, `O texto "${key}" não existe na tabela de localização.`);
            return key;
        }
        for (const locale of this.chain()) {
            const text = Object.hasOwn(entry.values, locale) ? this.render(key, locale, entry.values[locale], args) : null;
            if (text !== null)
                return text;
        }
        this.warnOnce(`untranslated|${key}|${this.locale}`, `O texto "${key}" não tem tradução em ${this.locale} nem nos idiomas de fallback.`);
        return key;
    }
    has(key: string): boolean {
        const entry = this.strings().get(key);
        return entry !== undefined && pickLocalizedValue(entry.values, this.chain()) !== null;
    }
    keys(): string[] {
        return this.settings.strings.map((entry) => entry.key);
    }
    assetId(key: string): string | null {
        const entry = this.settings.assets.find((candidate) => candidate.key === key);
        return entry ? (pickLocalizedValue(entry.values, this.chain())?.value ?? null) : null;
    }
    private render(key: string, locale: string, pattern: string, args: MessageArguments): string | null {
        try {
            return this.messages.render(pattern, args, locale);
        }
        catch (cause) {
            if (!(cause instanceof MessageSyntaxError) && !(cause instanceof MessageFormatError))
                throw cause;
            this.warnOnce(`invalid|${key}|${locale}`, `O texto "${key}" em ${locale} está inválido: ${cause.message}.`);
            return null;
        }
    }
    private chain(): readonly string[] {
        const { settings, locale } = this;
        const memo = this.chainMemo;
        if (memo && memo.locales === settings.locales && memo.sourceLocale === settings.sourceLocale && memo.locale === locale)
            return memo.chain;
        const chain = resolveFallbackChain(settings, locale);
        this.chainMemo = { locales: settings.locales, sourceLocale: settings.sourceLocale, locale, chain };
        return chain;
    }
    private strings(): ReadonlyMap<string, StringEntry> {
        const entries = this.settings.strings;
        if (this.stringIndex?.entries !== entries)
            this.stringIndex = { entries, byKey: new Map(entries.map((entry) => [entry.key, entry])) };
        return this.stringIndex.byKey;
    }
    private warnOnce(id: string, message: string): void {
        if (this.warned.has(id) || this.warned.size >= MAX_WARNINGS)
            return;
        this.warned.add(id);
        this.options.warn(message);
    }
}
