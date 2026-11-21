import type { FormatNode, MessageNode, PluralNode, SelectNode, ValueFormat } from './message-ast';
const VALUE_FORMATS: readonly ValueFormat[] = ['number', 'date', 'time', 'list'];
const NAME_PATTERN = /[\p{L}\p{N}_]+/uy;
const SELECTOR_PATTERN = /=?[\p{L}\p{N}_.-]+/uy;
const OFFSET_PATTERN = /offset:\s*(\d+)/y;
const SPACES_PATTERN = /\s*/y;
const PLURAL_SELECTOR_PATTERN = /^(?:=\d+|zero|one|two|few|many|other)$/;
const SYNTAX_PATTERN = /[{}']/;
const FALLBACK_OPTION = 'other';
const APOSTROPHE = "'";
type OptionBranches = Map<string, MessageNode[]>;
interface BranchSet {
    readonly options: OptionBranches;
    readonly other: MessageNode[];
}
export class MessageSyntaxError extends Error {
    constructor(message: string, readonly position: number) {
        super(message);
        this.name = 'MessageSyntaxError';
    }
}
function isValueFormat(value: string): value is ValueFormat {
    return (VALUE_FORMATS as readonly string[]).includes(value);
}
class MessageParser {
    private position = 0;
    private pluralDepth = 0;
    constructor(private readonly source: string) { }
    parse(): MessageNode[] {
        const nodes = this.parseNodes();
        if (this.position < this.source.length)
            throw this.error('"}" sem um "{" que abra o argumento');
        return nodes;
    }
    private parseNodes(): MessageNode[] {
        const nodes: MessageNode[] = [];
        let text = '';
        const pushText = (): void => {
            if (text.length > 0)
                nodes.push({ type: 'text', value: text });
            text = '';
        };
        while (this.position < this.source.length && this.source[this.position] !== '}') {
            const char = this.source[this.position];
            if (char === '{') {
                pushText();
                nodes.push(this.parsePlaceholder());
            }
            else if (char === '#' && this.pluralDepth > 0) {
                pushText();
                nodes.push({ type: 'pound' });
                this.position++;
            }
            else if (char === APOSTROPHE) {
                text += this.readApostrophe();
            }
            else {
                text += char;
                this.position++;
            }
        }
        pushText();
        return nodes;
    }
    private readApostrophe(): string {
        const next = this.source[this.position + 1];
        if (next === APOSTROPHE) {
            this.position += 2;
            return APOSTROPHE;
        }
        this.position++;
        const opensQuote = next === '{' || next === '}' || (next === '#' && this.pluralDepth > 0);
        return opensQuote ? this.readQuotedText() : APOSTROPHE;
    }
    private readQuotedText(): string {
        let quoted = '';
        while (this.position < this.source.length) {
            const char = this.source[this.position++];
            if (char !== APOSTROPHE) {
                quoted += char;
                continue;
            }
            if (this.source[this.position] !== APOSTROPHE)
                return quoted;
            quoted += APOSTROPHE;
            this.position++;
        }
        return quoted;
    }
    private parsePlaceholder(): MessageNode {
        this.position++;
        this.skipSpaces();
        const name = this.read(NAME_PATTERN);
        if (name === null)
            throw this.error('esperava o nome do argumento depois de "{"');
        this.skipSpaces();
        if (this.take('}'))
            return { type: 'argument', name };
        if (!this.take(','))
            throw this.error(`o argumento "${name}" precisa fechar com "}"`);
        this.skipSpaces();
        const kind = this.read(NAME_PATTERN) ?? '';
        this.skipSpaces();
        if (kind === 'plural' || kind === 'selectordinal')
            return this.parsePlural(name, kind === 'selectordinal');
        if (kind === 'select')
            return this.parseSelect(name);
        if (isValueFormat(kind))
            return this.parseFormat(name, kind);
        throw this.error(`formato "${kind}" desconhecido em "${name}"; use number, date, time, list, plural, selectordinal ou select`);
    }
    private parseFormat(name: string, format: ValueFormat): FormatNode {
        if (this.take('}'))
            return { type: 'format', name, format, style: '' };
        const end = this.take(',') ? this.source.indexOf('}', this.position) : -1;
        if (end < 0)
            throw this.error(`o argumento "${name}" precisa fechar com "}"`);
        const style = this.source.slice(this.position, end).trim();
        this.position = end + 1;
        return { type: 'format', name, format, style };
    }
    private parsePlural(name: string, ordinal: boolean): PluralNode {
        this.expectOptions(name);
        this.skipSpaces();
        const offset = Number(this.match(OFFSET_PATTERN)?.[1] ?? 0);
        this.pluralDepth++;
        const branches = this.parseBranches(name, PLURAL_SELECTOR_PATTERN);
        this.pluralDepth--;
        return { type: 'plural', name, ordinal, offset, options: branches.options, other: branches.other };
    }
    private parseSelect(name: string): SelectNode {
        this.expectOptions(name);
        const branches = this.parseBranches(name, null);
        return { type: 'select', name, options: branches.options, other: branches.other };
    }
    private expectOptions(name: string): void {
        if (!this.take(','))
            throw this.error(`"${name}" precisa das opções depois da vírgula, como one {…} other {…}`);
    }
    private parseBranches(name: string, allowed: RegExp | null): BranchSet {
        const options: OptionBranches = new Map();
        this.skipSpaces();
        while (!this.take('}')) {
            const selector = this.read(SELECTOR_PATTERN);
            if (selector === null)
                throw this.error(`esperava uma opção ou "}" em "${name}"`);
            if (allowed !== null && !allowed.test(selector))
                throw this.error(`"${selector}" não é uma forma de plural; use zero, one, two, few, many, other ou =N`);
            if (options.has(selector))
                throw this.error(`a opção "${selector}" aparece duas vezes em "${name}"`);
            options.set(selector, this.parseBranch(selector));
            this.skipSpaces();
        }
        const other = options.get(FALLBACK_OPTION);
        if (!other)
            throw this.error(`"${name}" precisa da opção "${FALLBACK_OPTION}"`);
        options.delete(FALLBACK_OPTION);
        return { options, other };
    }
    private parseBranch(selector: string): MessageNode[] {
        this.skipSpaces();
        if (!this.take('{'))
            throw this.error(`a opção "${selector}" precisa de um texto entre chaves`);
        const nodes = this.parseNodes();
        if (!this.take('}'))
            throw this.error(`o texto da opção "${selector}" precisa fechar com "}"`);
        return nodes;
    }
    private take(char: string): boolean {
        if (this.source[this.position] !== char)
            return false;
        this.position++;
        return true;
    }
    private skipSpaces(): void {
        this.match(SPACES_PATTERN);
    }
    private read(pattern: RegExp): string | null {
        return this.match(pattern)?.[0] ?? null;
    }
    private match(pattern: RegExp): RegExpExecArray | null {
        pattern.lastIndex = this.position;
        const found = pattern.exec(this.source);
        if (found)
            this.position = pattern.lastIndex;
        return found;
    }
    private error(message: string): MessageSyntaxError {
        return new MessageSyntaxError(message, this.position);
    }
}
export function hasMessageSyntax(pattern: string): boolean {
    return SYNTAX_PATTERN.test(pattern);
}
export function parseMessage(source: string): MessageNode[] {
    return new MessageParser(source).parse();
}
