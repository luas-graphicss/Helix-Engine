export type ValueFormat = 'number' | 'date' | 'time' | 'list';
export interface TextNode {
    readonly type: 'text';
    readonly value: string;
}
export interface ArgumentNode {
    readonly type: 'argument';
    readonly name: string;
}
export interface FormatNode {
    readonly type: 'format';
    readonly name: string;
    readonly format: ValueFormat;
    readonly style: string;
}
export interface PoundNode {
    readonly type: 'pound';
}
export interface PluralNode {
    readonly type: 'plural';
    readonly name: string;
    readonly ordinal: boolean;
    readonly offset: number;
    readonly options: ReadonlyMap<string, readonly MessageNode[]>;
    readonly other: readonly MessageNode[];
}
export interface SelectNode {
    readonly type: 'select';
    readonly name: string;
    readonly options: ReadonlyMap<string, readonly MessageNode[]>;
    readonly other: readonly MessageNode[];
}
export type MessageNode = TextNode | ArgumentNode | FormatNode | PoundNode | PluralNode | SelectNode;
