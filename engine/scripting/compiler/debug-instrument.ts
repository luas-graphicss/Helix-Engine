import type TS from 'typescript';
import { originalPositionFor, type DecodedSourceMap, type SourceMapping } from './source-map';
export const DEBUG_PARAMETER = '__hxdbg';
export interface InstrumentOutput {
    readonly code: string;
    readonly sourceMap: DecodedSourceMap;
    readonly lines: readonly number[];
}
interface Edit {
    readonly pos: number;
    readonly text: string;
    readonly order: 0 | 1;
}
const MAX_SCOPE_NAMES = 48;
function isValidIdentifier(name: string): boolean {
    return /^[A-Za-z_$][\w$]*$/.test(name) && !name.startsWith('__');
}
function isFunctionLikeDeclaration(ts: typeof TS, node: TS.Node): node is TS.FunctionLikeDeclaration {
    return (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node));
}
export function instrumentForDebug(ts: typeof TS, code: string, map: DecodedSourceMap | null, reserved: readonly string[]): InstrumentOutput | null {
    if (!map || map.mappings.length === 0)
        return null;
    const file = ts.createSourceFile('module.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const parseDiagnostics = (file as unknown as {
        parseDiagnostics?: readonly unknown[];
    }).parseDiagnostics;
    if (parseDiagnostics && parseDiagnostics.length > 0)
        return null;
    const excluded = new Set<string>([...reserved, DEBUG_PARAMETER, 'arguments', 'eval']);
    const edits: Edit[] = [];
    const probedLines = new Set<number>();
    const scopes = new ScopeCollector(ts, excluded);
    const originalLineOf = (node: TS.Node): number | null => {
        const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
        const original = originalPositionFor(map, line + 1, character + 1);
        return original ? original.line : null;
    };
    const probe = (line: number, node: TS.Node): string => {
        const { names, hasThis } = scopes.collect(node);
        const entries = hasThis ? [...names, 'this:this'] : names;
        return `${DEBUG_PARAMETER}.l[${line}]&&${DEBUG_PARAMETER}.h(${line},()=>({${entries.join(',')}}));`;
    };
    const visitList = (statements: readonly TS.Statement[], container: TS.Node): void => {
        let previousLine: number | null = null;
        let awaitingSuper = isDerivedConstructorBody(ts, container);
        for (const statement of statements) {
            if (awaitingSuper) {
                if (isSuperCallStatement(ts, statement))
                    awaitingSuper = false;
                visit(statement);
                continue;
            }
            if (isProbeable(ts, statement)) {
                const line = originalLineOf(statement);
                if (line !== null && line !== previousLine) {
                    edits.push({ pos: statement.getStart(file), text: probe(line, statement), order: 1 });
                    probedLines.add(line);
                }
                previousLine = line;
            }
            else
                previousLine = null;
            visit(statement);
        }
    };
    const visitBody = (statement: TS.Statement): void => {
        if (isProbeable(ts, statement)) {
            const line = originalLineOf(statement);
            if (line !== null) {
                edits.push({ pos: statement.getStart(file), text: `{${probe(line, statement)}`, order: 1 });
                edits.push({ pos: statement.end, text: '}', order: 0 });
                probedLines.add(line);
            }
        }
        visit(statement);
    };
    const visitChildren = (node: TS.Node): void => {
        ts.forEachChild(node, visit);
    };
    const visit = (node: TS.Node): void => {
        if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)) {
            visitList(node.statements, node);
            return;
        }
        if (ts.isIfStatement(node)) {
            visit(node.expression);
            visitBody(node.thenStatement);
            if (node.elseStatement)
                visitBody(node.elseStatement);
            return;
        }
        if (ts.isIterationStatement(node, false)) {
            ts.forEachChild(node, (child) => {
                if (child === node.statement)
                    visitBody(node.statement);
                else
                    visit(child);
            });
            return;
        }
        visitChildren(node);
    };
    visit(file);
    const moduleScope = scopes.moduleScope(file);
    const trailer = moduleScope.length > 0 ? `\n${DEBUG_PARAMETER}.s(()=>({${moduleScope.join(',')}}));` : '';
    if (edits.length === 0 && !trailer)
        return null;
    edits.sort((a, b) => a.pos - b.pos || a.order - b.order);
    let output = '';
    let cursor = 0;
    for (const edit of edits) {
        output += code.slice(cursor, edit.pos) + edit.text;
        cursor = edit.pos;
    }
    output += code.slice(cursor) + trailer;
    return { code: output, sourceMap: shiftSourceMap(file, map, edits), lines: Array.from(probedLines).sort((a, b) => a - b) };
}
function isProbeable(ts: typeof TS, statement: TS.Statement): boolean {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEmptyStatement(statement) || ts.isBlock(statement))
        return false;
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) || ts.isExportAssignment(statement) || ts.isModuleDeclaration(statement))
        return false;
    if (ts.isExpressionStatement(statement) && (ts.isStringLiteral(statement.expression) || ts.isNoSubstitutionTemplateLiteral(statement.expression)))
        return false;
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.every((declaration) => !declaration.initializer) && !(statement.declarationList.flags & ts.NodeFlags.BlockScoped))
        return false;
    return true;
}
function isDerivedConstructorBody(ts: typeof TS, container: TS.Node): boolean {
    if (!ts.isBlock(container) || !container.parent || !ts.isConstructorDeclaration(container.parent))
        return false;
    const owner = container.parent.parent;
    return Boolean(owner && ts.isClassLike(owner) && owner.heritageClauses?.some((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword));
}
function isSuperCallStatement(ts: typeof TS, statement: TS.Statement): boolean {
    if (!ts.isExpressionStatement(statement))
        return false;
    let expression: TS.Expression = statement.expression;
    while (ts.isParenthesizedExpression(expression) || ts.isAwaitExpression(expression))
        expression = expression.expression;
    return ts.isCallExpression(expression) && expression.expression.kind === ts.SyntaxKind.SuperKeyword;
}
function shiftSourceMap(file: TS.SourceFile, map: DecodedSourceMap, edits: readonly Edit[]): DecodedSourceMap {
    const byLine = new Map<number, Array<{
        column: number;
        length: number;
    }>>();
    for (const edit of edits) {
        const { line, character } = file.getLineAndCharacterOfPosition(edit.pos);
        let list = byLine.get(line + 1);
        if (!list) {
            list = [];
            byLine.set(line + 1, list);
        }
        list.push({ column: character, length: edit.text.length });
    }
    if (byLine.size === 0)
        return map;
    const mappings: SourceMapping[] = map.mappings.map((mapping) => {
        const inserts = byLine.get(mapping.generatedLine);
        if (!inserts)
            return mapping;
        let shift = 0;
        for (const insert of inserts)
            if (insert.column <= mapping.generatedColumn)
                shift += insert.length;
        return shift === 0 ? mapping : { ...mapping, generatedColumn: mapping.generatedColumn + shift };
    });
    return { mappings };
}
