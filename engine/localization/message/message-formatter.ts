import type { MessageNode, PluralNode, SelectNode } from './message-ast';
import { pluralCategory } from './plural-category';
import { formatValue } from './value-formatters';
export type MessageArguments = Readonly<Record<string, unknown>>;
interface FormatScope {
    readonly args: MessageArguments;
    readonly locale: string;
}
function placeholder(name: string): string {
    return `{${name}}`;
}
function isMissing(value: unknown): value is null | undefined {
    return value === undefined || value === null;
}
function argumentOf(scope: FormatScope, name: string): unknown {
    return Object.hasOwn(scope.args, name) ? scope.args[name] : undefined;
}
function formatArgument(name: string, scope: FormatScope): string {
    const value = argumentOf(scope, name);
    if (isMissing(value))
        return placeholder(name);
    if (typeof value === 'number' || typeof value === 'bigint')
        return formatValue('number', scope.locale, value);
    if (value instanceof Date)
        return formatValue('date', scope.locale, value);
    return String(value);
}
function formatPlural(node: PluralNode, scope: FormatScope): string {
    const value = argumentOf(scope, node.name);
    const count = isMissing(value) ? Number.NaN : Number(value);
    if (!Number.isFinite(count))
        return placeholder(node.name);
    const shown = count - node.offset;
    const branch = node.options.get(`=${count}`) ?? node.options.get(pluralCategory(scope.locale, shown, node.ordinal)) ?? node.other;
    return formatNodes(branch, scope, formatValue('number', scope.locale, shown));
}
function formatSelect(node: SelectNode, scope: FormatScope, pound: string | null): string {
    return formatNodes(node.options.get(String(argumentOf(scope, node.name))) ?? node.other, scope, pound);
}
function formatNode(node: MessageNode, scope: FormatScope, pound: string | null): string {
    switch (node.type) {
        case 'text':
            return node.value;
        case 'pound':
            return pound ?? '#';
        case 'argument':
            return formatArgument(node.name, scope);
        case 'format': {
            const value = argumentOf(scope, node.name);
            return isMissing(value) ? placeholder(node.name) : formatValue(node.format, scope.locale, value, node.style);
        }
        case 'plural':
            return formatPlural(node, scope);
        case 'select':
            return formatSelect(node, scope, pound);
    }
}
function formatNodes(nodes: readonly MessageNode[], scope: FormatScope, pound: string | null): string {
    let text = '';
    for (const node of nodes)
        text += formatNode(node, scope, pound);
    return text;
}
export function formatMessage(nodes: readonly MessageNode[], args: MessageArguments, locale: string): string {
    return formatNodes(nodes, { args, locale }, null);
}
