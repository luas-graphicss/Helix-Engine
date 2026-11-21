import { resolveFallbackChain } from '@/engine/localization/fallback/fallback-chain';
import { collectArguments, type ArgumentKind, type MessageArgument } from '@/engine/localization/message/message-arguments';
import type { MessageNode } from '@/engine/localization/message/message-ast';
import { MessageCache } from '@/engine/localization/message/message-cache';
import type { MessageArguments } from '@/engine/localization/message/message-formatter';
import { MessageSyntaxError, hasMessageSyntax } from '@/engine/localization/message/message-parser';
import { MessageFormatError } from '@/engine/localization/message/value-formatters';
import { hasLocalizedValue, type LocalizationSettings, type StringEntry } from '@/engine/localization/settings/localization-settings';
export interface TranslationPreview {
    readonly text: string | null;
    readonly shownLocale: string | null;
    readonly problem: string | null;
}
const LIST_SEPARATOR = ',';
const DEFAULT_SAMPLES: Record<ArgumentKind, string> = { text: '', number: '1', plural: '1', select: '', date: '', time: '', list: 'A, B, C' };
const messages = new MessageCache();
function isMessageProblem(cause: unknown): cause is MessageSyntaxError | MessageFormatError {
    return cause instanceof MessageSyntaxError || cause instanceof MessageFormatError;
}
function compileOrSkip(text: string): readonly MessageNode[] {
    if (!hasMessageSyntax(text))
        return [];
    try {
        return messages.compile(text);
    }
    catch (cause) {
        if (!isMessageProblem(cause))
            throw cause;
        return [];
    }
}
function sampleValue(argument: MessageArgument, raw: string): unknown {
    const typed = raw.trim();
    switch (argument.kind) {
        case 'number':
        case 'plural':
            return typed === '' ? undefined : Number(typed);
        case 'date':
        case 'time':
            return typed === '' ? new Date() : typed;
        case 'list':
            return typed.split(LIST_SEPARATOR).map((item) => item.trim()).filter((item) => item.length > 0);
        default:
            return typed === '' ? undefined : raw;
    }
}
export function previewArguments(settings: LocalizationSettings, entry: StringEntry): MessageArgument[] {
    const source = hasLocalizedValue(entry, settings.sourceLocale) ? [entry.values[settings.sourceLocale]] : [];
    return collectArguments([...source, ...Object.values(entry.values)].flatMap(compileOrSkip));
}
export function defaultSample(argument: MessageArgument): string {
    return argument.kind === 'select' ? (argument.choices[0] ?? '') : DEFAULT_SAMPLES[argument.kind];
}
export function sampleArguments(args: readonly MessageArgument[], typed: Readonly<Record<string, string>>): MessageArguments {
    const values: Record<string, unknown> = {};
    for (const argument of args)
        values[argument.name] = sampleValue(argument, typed[argument.name] ?? defaultSample(argument));
    return values;
}
export function previewTranslation(settings: LocalizationSettings, entry: StringEntry, locale: string, args: MessageArguments): TranslationPreview {
    let problem: string | null = null;
    for (const candidate of resolveFallbackChain(settings, locale)) {
        if (!hasLocalizedValue(entry, candidate))
            continue;
        try {
            return { text: messages.render(entry.values[candidate], args, candidate), shownLocale: candidate, problem };
        }
        catch (cause) {
            if (!isMessageProblem(cause))
                throw cause;
            problem ??= `${candidate}: ${cause.message}`;
        }
    }
    return { text: null, shownLocale: null, problem };
}
