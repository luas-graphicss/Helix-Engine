import { createFbxNode, type FbxNode, type FbxValue } from './fbx-node';
const NUMBER_PATTERN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
const IDENTIFIER_PATTERN = /[A-Za-z_][A-Za-z0-9_|+\-.]*/y;
export function isAsciiFbx(text: string): boolean {
    const head = text.slice(0, 4096);
    return /FBXHeaderExtension\s*:/.test(head) || /^\s*;\s*FBX/.test(head);
}
export function readAsciiFbxVersion(root: FbxNode): number {
    const header = root.children.find((node) => node.name === 'FBXHeaderExtension');
    const version = header?.children.find((node) => node.name === 'FBXVersion')?.props[0];
    return typeof version === 'number' ? version : 0;
}
class ParseError extends Error {
    constructor(message: string, line: number) {
        super(`FBX ASCII, linha ${line}: ${message}`);
    }
}
class AsciiParser {
    private pos = 0;
    constructor(private readonly text: string) { }
    parse(): FbxNode {
        const root = createFbxNode('');
        this.parseChildren(root, true);
        return root;
    }
    private get lineNumber(): number {
        let line = 1;
        for (let i = 0; i < this.pos && i < this.text.length; i++)
            if (this.text.charCodeAt(i) === 10)
                line++;
        return line;
    }
    private peek(): string {
        return this.text[this.pos] ?? '';
    }
    private skipInlineSpace(): void {
        while (this.pos < this.text.length) {
            const char = this.text[this.pos];
            if (char === ' ' || char === '\t' || char === '\r')
                this.pos++;
            else
                break;
        }
    }
    private skipWhitespaceAndComments(): void {
        while (this.pos < this.text.length) {
            const char = this.text[this.pos];
            if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
                this.pos++;
            }
            else if (char === ';') {
                while (this.pos < this.text.length && this.text[this.pos] !== '\n')
                    this.pos++;
            }
            else {
                break;
            }
        }
    }
    private parseChildren(parent: FbxNode, topLevel: boolean): void {
        for (;;) {
            this.skipWhitespaceAndComments();
            if (this.pos >= this.text.length) {
                if (!topLevel)
                    throw new ParseError('bloco não fechado.', this.lineNumber);
                return;
            }
            if (this.peek() === '}') {
                if (topLevel)
                    throw new ParseError('"}" inesperado.', this.lineNumber);
                this.pos++;
                return;
            }
            parent.children.push(this.parseNode());
        }
    }
    private parseNode(): FbxNode {
        const colon = this.text.indexOf(':', this.pos);
        if (colon === -1)
            throw new ParseError('nome de nó sem ":".', this.lineNumber);
        const name = this.text.slice(this.pos, colon).trim();
        if (!name || /[\s{}"]/.test(name))
            throw new ParseError(`nome de nó inválido "${name}".`, this.lineNumber);
        this.pos = colon + 1;
        const node = createFbxNode(name, this.parseProperties());
        this.skipWhitespaceAndComments();
        if (this.peek() === '{') {
            this.pos++;
            this.parseChildren(node, false);
        }
        return node;
    }
    private parseProperties(): FbxValue[] {
        const props: FbxValue[] = [];
        for (;;) {
            this.skipInlineSpace();
            const char = this.peek();
            if (char === ',') {
                this.pos++;
                this.skipWhitespaceAndComments();
                continue;
            }
            if (char === '' || char === '\n' || char === '{' || char === '}' || char === ';')
                break;
            props.push(this.parseValue());
        }
        return props;
    }
    private parseValue(): FbxValue {
        const char = this.peek();
        if (char === '"')
            return this.parseString();
        if (char === '*')
            return this.parseArray();
        NUMBER_PATTERN.lastIndex = this.pos;
        const number = NUMBER_PATTERN.exec(this.text);
        if (number && number.index === this.pos && number[0].length > 0) {
            this.pos += number[0].length;
            return Number(number[0]);
        }
        IDENTIFIER_PATTERN.lastIndex = this.pos;
        const word = IDENTIFIER_PATTERN.exec(this.text);
        if (word && word.index === this.pos) {
            this.pos += word[0].length;
            if (word[0] === 'true')
                return true;
            if (word[0] === 'false')
                return false;
            return word[0];
        }
        throw new ParseError(`valor inesperado "${char}".`, this.lineNumber);
    }
    private parseString(): string {
        const end = this.text.indexOf('"', this.pos + 1);
        if (end === -1)
            throw new ParseError('string não terminada.', this.lineNumber);
        const value = this.text.slice(this.pos + 1, end);
        this.pos = end + 1;
        return value;
    }
    private parseArray(): Float64Array {
        this.pos++;
        NUMBER_PATTERN.lastIndex = this.pos;
        const count = NUMBER_PATTERN.exec(this.text);
        if (!count || count.index !== this.pos)
            throw new ParseError('tamanho de array ausente.', this.lineNumber);
        this.pos += count[0].length;
        this.skipWhitespaceAndComments();
        if (this.peek() !== '{')
            throw new ParseError('array sem bloco "{".', this.lineNumber);
        this.pos++;
        this.skipWhitespaceAndComments();
        if (this.text.startsWith('a:', this.pos))
            this.pos += 2;
        const values: number[] = [];
        for (;;) {
            this.skipWhitespaceAndComments();
            const char = this.peek();
            if (char === '}') {
                this.pos++;
                break;
            }
            if (char === ',') {
                this.pos++;
                continue;
            }
            if (char === '')
                throw new ParseError('array não terminado.', this.lineNumber);
            NUMBER_PATTERN.lastIndex = this.pos;
            const number = NUMBER_PATTERN.exec(this.text);
            if (!number || number.index !== this.pos)
                throw new ParseError(`valor de array inválido "${char}".`, this.lineNumber);
            this.pos += number[0].length;
            values.push(Number(number[0]));
        }
        return Float64Array.from(values);
    }
}
export function parseAsciiFbx(text: string): {
    root: FbxNode;
    version: number;
} {
    const root = new AsciiParser(text).parse();
    return { root, version: readAsciiFbxVersion(root) };
}
