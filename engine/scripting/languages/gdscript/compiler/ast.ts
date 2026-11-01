import type { SourceSpan } from './tokens';
export interface TypeRef {
    readonly span: SourceSpan;
    readonly name: string;
    readonly args: readonly TypeRef[];
    resolved?: ResolvedType;
}
export type ResolvedType = {
    readonly kind: 'builtin';
    readonly staticType: StaticType;
    readonly runtimeName: string;
} | {
    readonly kind: 'godot';
    readonly name: string;
} | {
    readonly kind: 'class';
    readonly className: string;
    readonly jsName: string;
    readonly scriptName: string | null;
} | {
    readonly kind: 'enum';
    readonly className: string;
    readonly enumName: string;
} | {
    readonly kind: 'variant';
} | {
    readonly kind: 'void';
};
export interface Annotation {
    readonly span: SourceSpan;
    readonly name: string;
    readonly args: readonly Expression[];
}
export type Expression = LiteralExpression | StringExpression | IdentifierExpression | SelfExpression | SuperExpression | ArrayExpression | DictionaryExpression | MemberExpression | IndexExpression | CallExpression | UnaryExpression | BinaryExpression | TernaryExpression | TypeTestExpression | CastExpression | AwaitExpression | LambdaExpression | GetNodeExpression | PreloadExpression | TypeNameExpression;
interface ExpressionBase {
    readonly span: SourceSpan;
    type?: StaticType;
}
export type StaticType = string;
export interface LiteralExpression extends ExpressionBase {
    readonly kind: 'literal';
    readonly value: number | boolean | null;
    readonly literalType: 'int' | 'float' | 'bool' | 'null';
}
export interface StringExpression extends ExpressionBase {
    readonly kind: 'string';
    readonly value: string;
    readonly flavor: 'string' | 'string_name' | 'node_path';
}
export type Resolution = {
    readonly kind: 'local';
    readonly jsName: string;
} | {
    readonly kind: 'member';
    readonly name: string;
    readonly isStatic: boolean;
    readonly memberKind: MemberKind;
    readonly backingField: string | null;
    readonly owner: string;
} | {
    readonly kind: 'base';
    readonly name: string;
} | {
    readonly kind: 'class';
    readonly jsName: string;
    readonly className: string;
} | {
    readonly kind: 'sibling';
    readonly scriptName: string;
    readonly className: string;
} | {
    readonly kind: 'global_function';
    readonly name: string;
} | {
    readonly kind: 'io';
    readonly name: string;
} | {
    readonly kind: 'constant';
    readonly name: string;
} | {
    readonly kind: 'key';
    readonly name: string;
} | {
    readonly kind: 'builtin_type';
    readonly name: string;
} | {
    readonly kind: 'singleton';
    readonly name: string;
} | {
    readonly kind: 'helix';
};
export type MemberKind = 'var' | 'const' | 'enum' | 'enum_value' | 'signal' | 'func' | 'class';
export interface IdentifierExpression extends ExpressionBase {
    readonly kind: 'identifier';
    readonly name: string;
    resolved?: Resolution;
}
export interface SelfExpression extends ExpressionBase {
    readonly kind: 'self';
}
export interface SuperExpression extends ExpressionBase {
    readonly kind: 'super';
}
export interface ArrayExpression extends ExpressionBase {
    readonly kind: 'array';
    readonly elements: readonly Expression[];
}
export interface DictionaryEntry {
    readonly key: Expression;
    readonly value: Expression;
}
export interface DictionaryExpression extends ExpressionBase {
    readonly kind: 'dictionary';
    readonly entries: readonly DictionaryEntry[];
}
export interface MemberExpression extends ExpressionBase {
    readonly kind: 'member';
    readonly object: Expression;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    memberResolution?: Resolution;
}
export interface IndexExpression extends ExpressionBase {
    readonly kind: 'index';
    readonly object: Expression;
    readonly index: Expression;
}
export interface CallExpression extends ExpressionBase {
    readonly kind: 'call';
    readonly callee: Expression;
    readonly args: readonly Expression[];
}
export type UnaryOperator = '-' | '+' | 'not' | '~';
export interface UnaryExpression extends ExpressionBase {
    readonly kind: 'unary';
    readonly operator: UnaryOperator;
    readonly operand: Expression;
}
export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '**' | '==' | '!=' | '<' | '>' | '<=' | '>=' | 'and' | 'or' | 'in' | 'not in' | '&' | '|' | '^' | '<<' | '>>';
export interface BinaryExpression extends ExpressionBase {
    readonly kind: 'binary';
    readonly operator: BinaryOperator;
    readonly left: Expression;
    readonly right: Expression;
}
export interface TernaryExpression extends ExpressionBase {
    readonly kind: 'ternary';
    readonly condition: Expression;
    readonly whenTrue: Expression;
    readonly whenFalse: Expression;
}
export interface TypeTestExpression extends ExpressionBase {
    readonly kind: 'is';
    readonly value: Expression;
    readonly target: TypeRef;
    readonly negated: boolean;
}
export interface CastExpression extends ExpressionBase {
    readonly kind: 'as';
    readonly value: Expression;
    readonly target: TypeRef;
}
export interface AwaitExpression extends ExpressionBase {
    readonly kind: 'await';
    readonly value: Expression;
}
export interface Parameter {
    readonly span: SourceSpan;
    readonly name: string;
    readonly type: TypeRef | null;
    readonly defaultValue: Expression | null;
    jsName?: string;
    staticType?: StaticType;
}
export interface LambdaExpression extends ExpressionBase {
    readonly kind: 'lambda';
    readonly name: string | null;
    readonly params: readonly Parameter[];
    readonly returnType: TypeRef | null;
    readonly body: Block;
    captures?: readonly string[];
    isAsync?: boolean;
}
export interface GetNodeExpression extends ExpressionBase {
    readonly kind: 'get_node';
    readonly path: string;
    readonly unique: boolean;
}
export interface PreloadExpression extends ExpressionBase {
    readonly kind: 'preload';
    readonly path: string;
    scriptName?: string | null;
}
export interface TypeNameExpression extends ExpressionBase {
    readonly kind: 'type_name';
    readonly name: string;
}
export type Pattern = WildcardPattern | BindingPattern | ValuePattern | ArrayPattern | DictionaryPattern;
export interface WildcardPattern {
    readonly kind: 'wildcard';
    readonly span: SourceSpan;
}
export interface BindingPattern {
    readonly kind: 'binding';
    readonly span: SourceSpan;
    readonly name: string;
    jsName?: string;
}
export interface ValuePattern {
    readonly kind: 'value';
    readonly span: SourceSpan;
    readonly value: Expression;
}
export interface ArrayPattern {
    readonly kind: 'array';
    readonly span: SourceSpan;
    readonly elements: readonly Pattern[];
    readonly open: boolean;
}
export interface DictionaryPatternEntry {
    readonly key: Expression;
    readonly value: Pattern | null;
}
export interface DictionaryPattern {
    readonly kind: 'dictionary';
    readonly span: SourceSpan;
    readonly entries: readonly DictionaryPatternEntry[];
    readonly open: boolean;
}
export type Statement = ExpressionStatement | AssignmentStatement | VariableStatement | ConstantStatement | IfStatement | WhileStatement | ForStatement | MatchStatement | ReturnStatement | BreakStatement | ContinueStatement | PassStatement | BreakpointStatement | AssertStatement;
export interface Block {
    readonly span: SourceSpan;
    readonly statements: readonly Statement[];
}
export interface ExpressionStatement {
    readonly kind: 'expression';
    readonly span: SourceSpan;
    readonly expression: Expression;
}
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**=' | '&=' | '|=' | '^=' | '<<=' | '>>=';
export interface AssignmentStatement {
    readonly kind: 'assignment';
    readonly span: SourceSpan;
    readonly operator: AssignmentOperator;
    readonly target: Expression;
    readonly value: Expression;
}
export interface VariableStatement {
    readonly kind: 'variable';
    readonly span: SourceSpan;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly type: TypeRef | null;
    readonly inferred: boolean;
    readonly value: Expression | null;
    jsName?: string;
    staticType?: StaticType;
}
export interface ConstantStatement {
    readonly kind: 'constant';
    readonly span: SourceSpan;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly type: TypeRef | null;
    readonly value: Expression;
    jsName?: string;
    staticType?: StaticType;
}
export interface IfStatement {
    readonly kind: 'if';
    readonly span: SourceSpan;
    readonly condition: Expression;
    readonly then: Block;
    readonly otherwise: Block | null;
}
