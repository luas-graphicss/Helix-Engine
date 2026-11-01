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
