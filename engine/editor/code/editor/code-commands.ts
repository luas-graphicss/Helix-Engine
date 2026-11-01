import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export type CodeCommandId = 'undo' | 'redo' | 'selectAll' | 'toggleComment' | 'toggleBlockComment' | 'duplicateLine' | 'deleteLine' | 'moveLineUp' | 'moveLineDown' | 'copyLineUp' | 'copyLineDown' | 'indentMore' | 'indentLess' | 'selectNextOccurrence' | 'selectAllOccurrences' | 'addCursorAbove' | 'addCursorBelow' | 'expandSelection' | 'gotoMatchingBracket' | 'foldCurrent' | 'unfoldCurrent' | 'foldAll' | 'unfoldAll' | 'formatDocument' | 'renameSymbol' | 'gotoDefinition' | 'triggerSuggest' | 'triggerParameterHints' | 'nextDiagnostic' | 'previousDiagnostic' | 'gotoLine' | 'sortLines' | 'toUpperCase' | 'toLowerCase' | 'trimTrailingWhitespace';
export type CodeCommandGroup = 'history' | 'line' | 'selection' | 'fold' | 'language' | 'navigation' | 'transform';
export interface CodeCommandDefinition {
    readonly id: CodeCommandId;
    readonly label: string;
    readonly group: CodeCommandGroup;
    readonly shortcut: string;
    readonly requiresLanguageService?: boolean;
}
export const CODE_COMMAND_GROUP_LABEL: Record<CodeCommandGroup, string> = {
    history: 'Histórico',
    line: 'Linhas',
    selection: 'Seleção e cursores',
    fold: 'Dobrar código',
    language: 'Linguagem',
    navigation: 'Navegação',
    transform: 'Transformar',
};
function command(id: CodeCommandId, label: string, group: CodeCommandGroup, shortcut: string, extra: {
    requiresLanguageService?: boolean;
} = {}): CodeCommandDefinition {
    return { id, label, group, shortcut, ...extra };
}
export const CODE_COMMANDS: readonly CodeCommandDefinition[] = [
    command('undo', 'Desfazer', 'history', 'Ctrl Z'),
    command('redo', 'Refazer', 'history', 'Ctrl Y'),
    command('toggleComment', 'Comentar / descomentar linha', 'line', 'Ctrl /'),
    command('toggleBlockComment', 'Comentar / descomentar bloco', 'line', 'Shift Alt A'),
    command('duplicateLine', 'Duplicar linha', 'line', 'Ctrl Shift D'),
    command('copyLineUp', 'Copiar linha para cima', 'line', 'Shift Alt ↑'),
    command('copyLineDown', 'Copiar linha para baixo', 'line', 'Shift Alt ↓'),
    command('moveLineUp', 'Mover linha para cima', 'line', 'Alt ↑'),
    command('moveLineDown', 'Mover linha para baixo', 'line', 'Alt ↓'),
    command('deleteLine', 'Apagar linha', 'line', 'Ctrl Shift Backspace'),
    command('indentMore', 'Aumentar indentação', 'line', 'Ctrl ]'),
    command('indentLess', 'Diminuir indentação', 'line', 'Ctrl ['),
    command('selectAll', 'Selecionar tudo', 'selection', 'Ctrl A'),
    command('selectNextOccurrence', 'Adicionar a próxima ocorrência à seleção', 'selection', 'Ctrl D'),
    command('selectAllOccurrences', 'Selecionar todas as ocorrências', 'selection', 'Ctrl Shift L'),
    command('addCursorAbove', 'Adicionar cursor acima', 'selection', 'Ctrl Alt ↑'),
    command('addCursorBelow', 'Adicionar cursor abaixo', 'selection', 'Ctrl Alt ↓'),
    command('expandSelection', 'Expandir a seleção ao bloco', 'selection', 'Shift Alt →'),
    command('gotoMatchingBracket', 'Ir ao delimitador correspondente', 'selection', 'Ctrl Shift \\'),
    command('foldCurrent', 'Dobrar o bloco atual', 'fold', 'Ctrl Shift ['),
    command('unfoldCurrent', 'Desdobrar o bloco atual', 'fold', 'Ctrl Shift ]'),
    command('foldAll', 'Dobrar tudo', 'fold', ''),
    command('unfoldAll', 'Desdobrar tudo', 'fold', ''),
    command('triggerSuggest', 'Mostrar sugestões', 'language', 'Ctrl Espaço'),
    command('triggerParameterHints', 'Mostrar os parâmetros da função', 'language', 'Ctrl Shift Espaço'),
    command('formatDocument', 'Formatar o documento', 'language', 'Shift Alt F', { requiresLanguageService: true }),
    command('renameSymbol', 'Renomear símbolo', 'language', 'F2', { requiresLanguageService: true }),
    command('gotoDefinition', 'Ir à definição', 'language', 'F12', { requiresLanguageService: true }),
    command('gotoLine', 'Ir para a linha…', 'navigation', 'Ctrl G'),
    command('nextDiagnostic', 'Próximo problema', 'navigation', 'F8'),
    command('previousDiagnostic', 'Problema anterior', 'navigation', 'Shift F8'),
    command('sortLines', 'Ordenar as linhas selecionadas', 'transform', ''),
    command('toUpperCase', 'Maiúsculas', 'transform', ''),
    command('toLowerCase', 'Minúsculas', 'transform', ''),
    command('trimTrailingWhitespace', 'Remover espaços no fim das linhas', 'transform', ''),
];
const BY_ID = new Map(CODE_COMMANDS.map((entry) => [entry.id, entry]));
export function codeCommand(id: CodeCommandId): CodeCommandDefinition {
    const found = BY_ID.get(id);
    if (!found)
        throw new Error(`Comando de edição desconhecido: ${id}.`);
    return found;
}
export function codeCommandsIn(group: CodeCommandGroup): CodeCommandDefinition[] {
    return CODE_COMMANDS.filter((entry) => entry.group === group);
}
export const LANGUAGE_SERVICE_LANGUAGES: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['typescript', 'javascript']);
export function hasLanguageService(language: ScriptLanguageId): boolean {
    return LANGUAGE_SERVICE_LANGUAGES.has(language);
}
