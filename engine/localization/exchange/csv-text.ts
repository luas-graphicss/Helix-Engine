const QUOTE = '"';
const BYTE_ORDER_MARK = '\uFEFF';
const DELIMITERS = [',', ';', '\t'] as const;
const LINE_BREAK = '\r\n';
const NEEDS_QUOTES = /[",;\t\r\n]/;
interface QuotedCell {
    readonly text: string;
    readonly end: number;
}
function detectDelimiter(text: string): string {
    const lineEnd = text.search(/[\r\n]/);
    const header = lineEnd < 0 ? text : text.slice(0, lineEnd);
    let detected: string = DELIMITERS[0];
    let mostCells = 0;
    for (const delimiter of DELIMITERS) {
        const cells = header.split(delimiter).length - 1;
        if (cells > mostCells) {
            detected = delimiter;
            mostCells = cells;
        }
    }
    return detected;
}
function readQuotedCell(text: string, start: number): QuotedCell {
    let cell = '';
    let index = start;
    while (index < text.length) {
        const close = text.indexOf(QUOTE, index);
        if (close < 0)
            return { text: cell + text.slice(index), end: text.length };
        cell += text.slice(index, close);
        if (text[close + 1] !== QUOTE)
            return { text: cell, end: close + 1 };
        cell += QUOTE;
        index = close + 2;
    }
    return { text: cell, end: index };
}
export function parseCsv(source: string): string[][] {
    const text = source.startsWith(BYTE_ORDER_MARK) ? source.slice(BYTE_ORDER_MARK.length) : source;
    const delimiter = detectDelimiter(text);
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    const endCell = (): void => {
        row.push(cell);
        cell = '';
    };
    const endRow = (): void => {
        endCell();
        rows.push(row);
        row = [];
    };
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        if (char === QUOTE) {
            const quoted = readQuotedCell(text, index + 1);
            cell += quoted.text;
            index = quoted.end;
            continue;
        }
        index++;
        if (char === delimiter)
            endCell();
        else if (char === '\n')
            endRow();
        else if (char !== '\r')
            cell += char;
    }
    if (cell.length > 0 || row.length > 0)
        endRow();
    return rows;
}
function quoteCell(cell: string): string {
    return NEEDS_QUOTES.test(cell) ? `${QUOTE}${cell.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}` : cell;
}
export function serializeCsv(rows: ReadonlyArray<readonly string[]>): string {
    return rows.map((row) => row.map(quoteCell).join(DELIMITERS[0])).join(LINE_BREAK);
}
