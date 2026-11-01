import type { SourceSpan } from './tokens';
export interface TypeRef {
    readonly name: string;
    readonly typeArguments: readonly TypeRef[];
    readonly arrayRank: number;
    readonly nullable: boolean;
    readonly tupleElements: readonly TypeRef[] | null;
    readonly span: SourceSpan;
}
export interface CompilationUnit {
    readonly types: readonly TypeDeclaration[];
    readonly usings: readonly string[];
}
export type TypeDeclaration = ClassDeclaration | EnumDeclaration | InterfaceDeclaration | DelegateDeclaration;
export type ClassFlavor = 'class' | 'struct' | 'record';
export interface ClassDeclaration {
    readonly kind: 'class';
    readonly flavor: ClassFlavor;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly modifiers: readonly string[];
    readonly typeParameters: readonly string[];
    readonly bases: readonly TypeRef[];
    readonly recordParameters: readonly Parameter[] | null;
    readonly members: readonly Member[];
    readonly span: SourceSpan;
}
export interface EnumDeclaration {
    readonly kind: 'enum';
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly modifiers: readonly string[];
    readonly members: readonly EnumMember[];
    readonly span: SourceSpan;
}
export interface EnumMember {
    readonly name: string;
    readonly value: Expression | null;
    readonly span: SourceSpan;
}
export interface InterfaceDeclaration {
    readonly kind: 'interface';
    readonly name: string;
    readonly span: SourceSpan;
}
export interface DelegateDeclaration {
    readonly kind: 'delegate';
    readonly name: string;
    readonly span: SourceSpan;
}
export type Member = FieldMember | PropertyMember | MethodMember | ConstructorMember | EventMember | IndexerMember | TypeDeclaration;
export interface Declarator {
    readonly name: string;
    readonly initializer: Expression | null;
    readonly span: SourceSpan;
    jsName?: string;
    staticType?: StaticType;
}
export interface FieldMember {
    readonly kind: 'field';
    readonly modifiers: readonly string[];
    readonly type: TypeRef;
    readonly declarators: readonly Declarator[];
    readonly span: SourceSpan;
}
export interface Accessor {
    readonly kind: 'get' | 'set' | 'init';
    readonly body: Block | null;
    readonly expressionBody: Expression | null;
    readonly span: SourceSpan;
}
export interface PropertyMember {
    readonly kind: 'property';
    readonly modifiers: readonly string[];
    readonly type: TypeRef;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly getter: Accessor | null;
    readonly setter: Accessor | null;
    readonly expressionBody: Expression | null;
    readonly initializer: Expression | null;
    readonly span: SourceSpan;
}
export interface MethodMember {
    readonly kind: 'method';
    readonly modifiers: readonly string[];
    readonly returnType: TypeRef;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly typeParameters: readonly string[];
    readonly parameters: readonly Parameter[];
    readonly body: Block | null;
    readonly expressionBody: Expression | null;
    readonly span: SourceSpan;
    jsName?: string;
    isIterator?: boolean;
    isAsync?: boolean;
}
export interface ConstructorMember {
    readonly kind: 'constructor';
    readonly modifiers: readonly string[];
    readonly parameters: readonly Parameter[];
    readonly initializer: {
        readonly kind: 'base' | 'this';
        readonly arguments: readonly Argument[];
        readonly span: SourceSpan;
    } | null;
    readonly body: Block | null;
    readonly expressionBody: Expression | null;
    readonly span: SourceSpan;
    jsName?: string;
}
export interface EventMember {
    readonly kind: 'event';
    readonly modifiers: readonly string[];
    readonly type: TypeRef;
    readonly declarators: readonly Declarator[];
    readonly span: SourceSpan;
}
export interface IndexerMember {
    readonly kind: 'indexer';
    readonly modifiers: readonly string[];
    readonly type: TypeRef;
    readonly parameters: readonly Parameter[];
    readonly getter: Accessor | null;
    readonly setter: Accessor | null;
    readonly expressionBody: Expression | null;
    readonly span: SourceSpan;
}
export type ParameterModifier = 'none' | 'ref' | 'out' | 'in' | 'params';
export interface Parameter {
    readonly name: string;
    readonly type: TypeRef | null;
    readonly modifier: ParameterModifier;
    readonly defaultValue: Expression | null;
    readonly span: SourceSpan;
    jsName?: string;
}
export interface Argument {
    readonly name: string | null;
    readonly modifier: 'none' | 'ref' | 'out' | 'in';
    readonly expression: Expression;
    readonly declaration: {
        readonly type: TypeRef | null;
        readonly name: string;
    } | null;
    readonly span: SourceSpan;
}
export type Statement = Block | LocalDeclaration | LocalFunction | ExpressionStatement | IfStatement | WhileStatement | DoStatement | ForStatement | ForEachStatement | SwitchStatement | BreakStatement | ContinueStatement | ReturnStatement | ThrowStatement | TryStatement | UsingStatement | LockStatement | YieldStatement | EmptyStatement;
export interface Block {
    readonly kind: 'block';
    readonly statements: readonly Statement[];
    readonly span: SourceSpan;
}
export interface LocalDeclaration {
    readonly kind: 'local';
    readonly type: TypeRef;
    readonly isConst: boolean;
    readonly declarators: readonly Declarator[];
    readonly deconstruction: {
        readonly names: readonly string[];
        readonly initializer: Expression;
        jsNames?: string[];
    } | null;
    readonly span: SourceSpan;
}
export interface LocalFunction {
    readonly kind: 'localFunction';
    readonly method: MethodMember;
    readonly span: SourceSpan;
}
export interface ExpressionStatement {
    readonly kind: 'expression';
    readonly expression: Expression;
    readonly span: SourceSpan;
}
export interface IfStatement {
    readonly kind: 'if';
    readonly condition: Expression;
    readonly then: Statement;
    readonly else: Statement | null;
    readonly span: SourceSpan;
}
export interface WhileStatement {
    readonly kind: 'while';
    readonly condition: Expression;
    readonly body: Statement;
    readonly span: SourceSpan;
}
export interface DoStatement {
    readonly kind: 'do';
    readonly body: Statement;
    readonly condition: Expression;
    readonly span: SourceSpan;
}
export interface ForStatement {
    readonly kind: 'for';
    readonly declaration: LocalDeclaration | null;
    readonly initializers: readonly Expression[];
    readonly condition: Expression | null;
    readonly updates: readonly Expression[];
    readonly body: Statement;
    readonly span: SourceSpan;
}
export interface ForEachStatement {
    readonly kind: 'foreach';
    readonly type: TypeRef | null;
    readonly name: string | null;
    readonly deconstruction: readonly string[] | null;
    readonly iterable: Expression;
    readonly body: Statement;
    readonly isAwait: boolean;
    readonly span: SourceSpan;
    jsName?: string;
    deconstructionJsNames?: string[];
    directIterable?: boolean;
}
export type SwitchLabel = {
    readonly kind: 'case';
    readonly pattern: Pattern;
    readonly guard: Expression | null;
    readonly span: SourceSpan;
} | {
    readonly kind: 'default';
    readonly span: SourceSpan;
};
export interface SwitchSection {
    readonly labels: readonly SwitchLabel[];
    readonly statements: readonly Statement[];
}
export interface SwitchStatement {
    readonly kind: 'switch';
    readonly value: Expression;
    readonly sections: readonly SwitchSection[];
    readonly span: SourceSpan;
}
export interface BreakStatement {
    readonly kind: 'break';
    readonly span: SourceSpan;
}
export interface ContinueStatement {
    readonly kind: 'continue';
    readonly span: SourceSpan;
}
export interface ReturnStatement {
    readonly kind: 'return';
    readonly expression: Expression | null;
    readonly span: SourceSpan;
}
export interface ThrowStatement {
    readonly kind: 'throw';
    readonly expression: Expression | null;
    readonly span: SourceSpan;
}
export interface CatchClause {
    readonly type: TypeRef | null;
    readonly name: string | null;
    readonly filter: Expression | null;
    readonly block: Block;
    readonly span: SourceSpan;
    jsName?: string;
    typeTest?: Extract<TypeTest, {
        kind: 'runtime' | 'script';
    }> | null;
}
export interface TryStatement {
    readonly kind: 'try';
    readonly block: Block;
    readonly catches: readonly CatchClause[];
    readonly finallyBlock: Block | null;
    readonly span: SourceSpan;
}
export interface UsingStatement {
    readonly kind: 'using';
    readonly declaration: LocalDeclaration | null;
    readonly expression: Expression | null;
    readonly body: Statement | null;
    readonly span: SourceSpan;
}
export interface LockStatement {
    readonly kind: 'lock';
    readonly expression: Expression;
    readonly body: Statement;
    readonly span: SourceSpan;
}
export interface YieldStatement {
    readonly kind: 'yield';
    readonly expression: Expression | null;
    readonly span: SourceSpan;
}
export interface EmptyStatement {
    readonly kind: 'empty';
    readonly span: SourceSpan;
}
export type Expression = LiteralExpression | IdentifierExpression | ThisExpression | BaseExpression | MemberExpression | ElementExpression | CallExpression | NewExpression | AnonymousObjectExpression | ArrayExpression | LambdaExpression | UnaryExpression | BinaryExpression | AssignmentExpression | ConditionalExpression | CastExpression | IsExpression | AsExpression | TypeOfExpression | NameOfExpression | DefaultExpression | AwaitExpression | ThrowExpression | InterpolatedExpression | TupleExpression | SwitchExpression | RangeExpression | FromEndExpression;
export type StaticType = {
    readonly kind: 'int';
} | {
    readonly kind: 'float';
} | {
    readonly kind: 'bool';
} | {
    readonly kind: 'string';
} | {
    readonly kind: 'char';
} | {
    readonly kind: 'null';
} | {
    readonly kind: 'void';
} | {
    readonly kind: 'array';
    readonly element: StaticType;
} | {
    readonly kind: 'collection';
    readonly name: 'List' | 'Dictionary' | 'HashSet' | 'Queue' | 'Stack';
    readonly args: readonly StaticType[];
} | {
    readonly kind: 'class';
    readonly name: string;
    readonly script: string | null;
    readonly runtime?: boolean;
    readonly jsName?: string;
} | {
    readonly kind: 'enum';
    readonly name: string;
    readonly script: string | null;
    readonly jsName?: string;
} | {
    readonly kind: 'delegate';
    readonly params: readonly StaticType[] | null;
    readonly returns: StaticType | null;
} | {
    readonly kind: 'task';
    readonly result: StaticType | null;
} | {
    readonly kind: 'tuple';
    readonly elements: ReadonlyArray<{
        readonly name: string | null;
        readonly type: StaticType;
    }>;
} | {
    readonly kind: 'engine';
} | {
    readonly kind: 'dynamic';
};
export type Resolution = {
    readonly kind: 'local';
    readonly jsName: string;
    readonly byRef: boolean;
} | {
    readonly kind: 'member';
    readonly owner: string;
    readonly jsName: string;
    readonly isStatic: boolean;
    readonly ownerIsSibling: string | null;
    readonly memberKind: 'field' | 'property' | 'method' | 'event' | 'const';
} | {
    readonly kind: 'type';
    readonly name: string;
    readonly jsName: string;
    readonly sibling: string | null;
} | {
    readonly kind: 'runtimeType';
    readonly name: string;
} | {
    readonly kind: 'runtimeStatic';
    readonly name: string;
} | {
    readonly kind: 'engine';
} | {
    readonly kind: 'enumMember';
    readonly enumName: string;
    readonly sibling: string | null;
} | {
    readonly kind: 'direct';
    readonly jsName: string;
} | {
    readonly kind: 'dynamic';
};
export interface ExpressionBase {
    readonly span: SourceSpan;
    staticType?: StaticType;
}
export interface LiteralExpression extends ExpressionBase {
    readonly kind: 'literal';
    readonly value: number | string | boolean | null;
    readonly literalType: 'int' | 'float' | 'string' | 'char' | 'bool' | 'null';
}
export interface IdentifierExpression extends ExpressionBase {
    readonly kind: 'identifier';
    readonly name: string;
    readonly typeArguments: readonly TypeRef[] | null;
    resolution?: Resolution;
    bindThis?: boolean;
}
export interface ThisExpression extends ExpressionBase {
    readonly kind: 'this';
}
export interface BaseExpression extends ExpressionBase {
    readonly kind: 'base';
}
export interface MemberExpression extends ExpressionBase {
    readonly kind: 'member';
    readonly target: Expression;
    readonly name: string;
    readonly nameSpan: SourceSpan;
    readonly typeArguments: readonly TypeRef[] | null;
    readonly nullConditional: boolean;
    resolution?: Resolution;
    bindThis?: boolean;
}
export interface ElementExpression extends ExpressionBase {
    readonly kind: 'element';
    readonly target: Expression;
    readonly arguments: readonly Argument[];
    readonly nullConditional: boolean;
}
export interface CallExpression extends ExpressionBase {
    readonly kind: 'call';
    readonly target: Expression;
    readonly arguments: readonly Argument[];
    argumentOrder?: readonly number[];
    spreadLast?: boolean;
}
export type ObjectInitializerEntry = {
    readonly kind: 'assign';
    readonly name: string;
    readonly value: Expression | Initializer;
    readonly span: SourceSpan;
} | {
    readonly kind: 'index';
    readonly arguments: readonly Argument[];
    readonly value: Expression;
    readonly span: SourceSpan;
};
export type Initializer = {
    readonly kind: 'object';
    readonly entries: readonly ObjectInitializerEntry[];
    readonly span: SourceSpan;
} | {
    readonly kind: 'collection';
    readonly elements: ReadonlyArray<Expression | readonly Expression[]>;
    readonly span: SourceSpan;
};
export interface NewExpression extends ExpressionBase {
    readonly kind: 'new';
    readonly type: TypeRef | null;
    readonly arguments: readonly Argument[];
    readonly initializer: Initializer | null;
    construction?: {
        readonly kind: 'script';
        readonly name: string;
        readonly sibling: string | null;
        readonly ctorJsName: string;
        readonly isActor: boolean;
    } | {
        readonly kind: 'runtime';
        readonly name: string;
    } | {
        readonly kind: 'options';
    } | {
        readonly kind: 'dynamic';
        readonly name: string;
    };
}
export interface AnonymousObjectExpression extends ExpressionBase {
    readonly kind: 'anonymous';
    readonly members: ReadonlyArray<{
        readonly name: string;
        readonly value: Expression;
    }>;
}
export interface ArrayExpression extends ExpressionBase {
    readonly kind: 'array';
    readonly elementType: TypeRef | null;
    readonly sizes: readonly Expression[];
    readonly elements: readonly Expression[] | null;
}
export interface LambdaExpression extends ExpressionBase {
    readonly kind: 'lambda';
    readonly parameters: readonly Parameter[];
    readonly body: Block | Expression;
    readonly isAsync: boolean;
    needsAsync?: boolean;
}
export interface Hoist {
    readonly name: string;
    readonly jsName: string;
}
export interface UnaryExpression extends ExpressionBase {
    readonly kind: 'unary';
    readonly operator: '!' | '-' | '+' | '~' | '++' | '--';
    readonly operand: Expression;
    readonly prefix: boolean;
}
export type BinaryOperator = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '>' | '<=' | '>=' | '&&' | '||' | '&' | '|' | '^' | '<<' | '>>' | '??';
export interface BinaryExpression extends ExpressionBase {
    readonly kind: 'binary';
    readonly operator: BinaryOperator;
    readonly left: Expression;
    readonly right: Expression;
}
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=' | '??=';
export interface AssignmentExpression extends ExpressionBase {
    readonly kind: 'assign';
    readonly operator: AssignmentOperator;
    readonly target: Expression;
    readonly value: Expression;
}
export interface ConditionalExpression extends ExpressionBase {
    readonly kind: 'conditional';
    readonly condition: Expression;
    readonly whenTrue: Expression;
    readonly whenFalse: Expression;
}
export interface CastExpression extends ExpressionBase {
    readonly kind: 'cast';
    readonly type: TypeRef;
    readonly expression: Expression;
}
export interface IsExpression extends ExpressionBase {
    readonly kind: 'is';
    readonly expression: Expression;
    readonly pattern: Pattern;
}
export interface AsExpression extends ExpressionBase {
    readonly kind: 'as';
    readonly expression: Expression;
    readonly type: TypeRef;
}
export interface TypeOfExpression extends ExpressionBase {
    readonly kind: 'typeof';
    readonly type: TypeRef;
    operandType?: StaticType;
}
export interface NameOfExpression extends ExpressionBase {
    readonly kind: 'nameof';
    readonly name: string;
}
export interface DefaultExpression extends ExpressionBase {
    readonly kind: 'default';
    readonly type: TypeRef | null;
}
export interface AwaitExpression extends ExpressionBase {
    readonly kind: 'await';
    readonly expression: Expression;
}
export interface ThrowExpression extends ExpressionBase {
    readonly kind: 'throwExpression';
    readonly expression: Expression;
}
