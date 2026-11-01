import type { CompileDiagnostic } from '../../compiler/compile-types';
export const WAT_SOURCE = 'WebAssembly';
const ERROR_LINE = /^(.*?):(\d+):(\d+): (error|warning): (.*)$/;
const CARETS = /^\s*(\^+)\s*$/;
const MESSAGE_REWRITES: ReadonlyArray<readonly [
    RegExp,
    string
]> = [
    [/^unexpected token "([^"]*)", expected an instr\.?$/, 'instrução desconhecida "$1".'],
    [/^unexpected token "([^"]*)", expected (.*)\.$/, 'token inesperado "$1": esperava $2.'],
    [/^unexpected token ([^,]*), expected (.*)\.$/, 'token inesperado $1: esperava $2.'],
    [/^undefined (function|global|local|label|memory|table|type|tag|data segment|elem segment) variable "([^"]*)"$/, '$1 "$2" não foi declarado(a) neste módulo.'],
    [/^type mismatch in (.*?), expected \[(.*?)\] but got \[(.*?)\]$/, 'tipos não batem em $1: esperava [$2] e encontrou [$3].'],
    [/^type mismatch at end of function, expected \[(.*?)\] but got \[(.*?)\]$/, 'a função termina com [$2] na pilha, mas o resultado declarado é [$1].'],
    [/^type mismatch at end of block, expected \[(.*?)\] but got \[(.*?)\]$/, 'o bloco termina com [$2] na pilha, mas devia terminar com [$1].'],
    [/^type stack size too small at (.*?)\. got (\d+), expected at least (\d+)$/, 'faltam operandos para $1: há $2 na pilha e a instrução precisa de $3.'],
    [/^type stack at end of (.*?) is (\d+), expected (\d+)$/, 'a pilha ao fim de $1 tem $2 valores; devia ter $3.'],
    [/^only one memory block allowed$/, 'só pode haver uma memória no módulo.'],
    [/^only one table allowed$/, 'só pode haver uma tabela no módulo.'],
    [/^redefinition of (\w+) "([^"]*)"$/, '$1 "$2" foi declarado(a) duas vezes.'],
    [/^memory variable out of range \(max 0\)$/, 'a instrução usa a memória, mas o módulo não declara nenhuma: adicione (memory (export "memory") 1).'],
    [/^unknown data segment$/, 'segmento de dados desconhecido.'],
    [/^import after (\w+)$/, 'as importações precisam vir antes de qualquer $1 do módulo.'],
    [/^unterminated string$/, 'string sem fechamento: faltou a aspa final.'],
    [/^invalid literal "([^"]*)"$/, 'literal inválido "$1".'],
    [/^(\d+) duplicate export(?:s)?$/, 'há exportações com o mesmo nome ($1).'],
    [/^duplicate export "([^"]*)"$/, 'o nome "$1" foi exportado duas vezes.'],
    [/^start function must not return anything$/, 'a função de start não pode devolver valor.'],
    [/^start function must have signature \[\] -> \[\]$/, 'a função de start não pode ter parâmetros nem resultado.'],
    [/^function type variable out of range: (\d+) \(max (\d+)\)$/, 'o tipo de função #$1 não existe (o módulo declara $2).'],
    [/^function variable out of range: (\d+) \(max (\d+)\)$/, 'a função #$1 não existe (o módulo tem $2).'],
    [/^local variable out of range \(max (\d+)\)$/, 'o índice de local não existe (a função tem $1).'],
    [/^global variable out of range \(max (\d+)\)$/, 'o índice de global não existe (o módulo tem $1).'],
    [/^label variable out of range \(max (\d+)\)$/, 'o rótulo de bloco não existe (há $1 abertos).'],
    [/^alignment must not be larger than natural alignment \((\d+)\)$/, 'o alinhamento não pode passar do natural ($1).'],
    [/^alignment must be power-of-two$/, 'o alinhamento precisa ser potência de dois.'],
    [/^offset must be less than or equal to 0xffffffff$/, 'o deslocamento passa de 0xffffffff.'],
    [/^global is immutable$/, 'esta global é imutável: declare-a como (global (mut tipo) …) para escrever nela.'],
    [/^unknown opcode(.*)$/, 'opcode desconhecido$1.'],
    [/^tail-call support is not enabled$/, 'chamadas em cauda (return_call) não estão habilitadas.'],
];
function rewrite(message: string): string {
    const trimmed = message.trim();
    for (const [pattern, replacement] of MESSAGE_REWRITES) {
        if (pattern.test(trimmed))
            return trimmed.replace(pattern, replacement);
    }
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}
export function parseWabtFailure(text: string, phase: 'sintaxe' | 'validação'): CompileDiagnostic[] {
    const lines = text.split('\n');
    const diagnostics: CompileDiagnostic[] = [];
    for (let index = 0; index < lines.length; index++) {
        const match = ERROR_LINE.exec(lines[index]);
        if (!match)
            continue;
        const line = Number(match[2]);
        const column = Number(match[3]);
        let endColumn: number | undefined;
        const carets = CARETS.exec(lines[index + 2] ?? '');
        if (carets && lines[index + 1] !== undefined) {
            endColumn = column + carets[1].length;
            index += 2;
        }
        diagnostics.push({
            severity: match[4] === 'warning' ? 'warning' : 'error',
            message: rewrite(match[5]),
            line,
            column,
            endLine: line,
            endColumn,
            code: phase === 'sintaxe' ? 'wat-syntax' : 'wat-validate',
            source: WAT_SOURCE,
        });
    }
    if (diagnostics.length === 0) {
        const detail = text.replace(/^(parseWat|validate|toBinary) failed:\s*/i, '').trim();
        diagnostics.push({ severity: 'error', message: `Falha de ${phase} no módulo WebAssembly${detail ? `: ${detail}` : '.'}`, line: 1, column: 1, code: phase === 'sintaxe' ? 'wat-syntax' : 'wat-validate', source: WAT_SOURCE });
    }
    return diagnostics;
}
export function locate(source: string, pattern: RegExp): {
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
} {
    const match = pattern.exec(source);
    if (!match || match.index === undefined)
        return { line: 1, column: 1, endLine: 1, endColumn: 1 };
    let line = 1;
    let lineStart = 0;
    for (let index = 0; index < match.index; index++) {
        if (source.charCodeAt(index) === 10) {
            line++;
            lineStart = index + 1;
        }
    }
    const column = match.index - lineStart + 1;
    return { line, column, endLine: line, endColumn: column + match[0].length };
}
