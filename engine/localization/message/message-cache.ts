import type { MessageNode } from './message-ast';
import { formatMessage, type MessageArguments } from './message-formatter';
import { hasMessageSyntax, parseMessage } from './message-parser';
const MAX_COMPILED_MESSAGES = 4096;
export class MessageCache {
    private readonly compiled = new Map<string, readonly MessageNode[]>();
    compile(pattern: string): readonly MessageNode[] {
        const known = this.compiled.get(pattern);
        if (known)
            return known;
        const nodes = parseMessage(pattern);
        if (this.compiled.size >= MAX_COMPILED_MESSAGES)
            this.compiled.clear();
        this.compiled.set(pattern, nodes);
        return nodes;
    }
    render(pattern: string, args: MessageArguments, locale: string): string {
        return hasMessageSyntax(pattern) ? formatMessage(this.compile(pattern), args, locale) : pattern;
    }
}
