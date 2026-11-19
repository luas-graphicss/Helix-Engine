import type { AssetKind } from '@/engine/assets/library/asset-types';
export type GuiTone = 'default' | 'muted';
export type GuiHelpLevel = 'info' | 'warn' | 'error';
export type GuiButtonVariant = 'primary' | 'secondary' | 'danger';
export type GuiVector = readonly [number, number, number];
export interface GuiOption {
    readonly value: string;
    readonly label: string;
}
interface GuiNodeBase {
    readonly key: string;
}
interface GuiFieldBase extends GuiNodeBase {
    readonly label: string;
    readonly disabled: boolean;
}
export interface GuiLabelNode extends GuiNodeBase {
    readonly kind: 'label';
    readonly text: string;
    readonly tone: GuiTone;
}
export interface GuiHeadingNode extends GuiNodeBase {
    readonly kind: 'heading';
    readonly text: string;
}
export interface GuiHelpNode extends GuiNodeBase {
    readonly kind: 'help';
    readonly text: string;
    readonly level: GuiHelpLevel;
}
export interface GuiSeparatorNode extends GuiNodeBase {
    readonly kind: 'separator';
}
export interface GuiSpaceNode extends GuiNodeBase {
    readonly kind: 'space';
    readonly size: number;
}
export interface GuiProgressNode extends GuiNodeBase {
    readonly kind: 'progress';
    readonly label: string;
    readonly value: number;
}
export interface GuiButtonNode extends GuiFieldBase {
    readonly kind: 'button';
    readonly icon: string | null;
    readonly variant: GuiButtonVariant;
}
export interface GuiToggleNode extends GuiFieldBase {
    readonly kind: 'toggle';
    readonly value: boolean;
}
export interface GuiNumberNode extends GuiFieldBase {
    readonly kind: 'number';
    readonly value: number;
}
export interface GuiSliderNode extends GuiFieldBase {
    readonly kind: 'slider';
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number | null;
}
export interface GuiTextNode extends GuiFieldBase {
    readonly kind: 'text';
    readonly value: string;
    readonly placeholder: string;
    readonly multiline: boolean;
}
export interface GuiSelectNode extends GuiFieldBase {
    readonly kind: 'select';
    readonly value: string;
    readonly options: readonly GuiOption[];
}
export interface GuiColorNode extends GuiFieldBase {
    readonly kind: 'color';
    readonly value: GuiVector;
}
export interface GuiVectorNode extends GuiFieldBase {
    readonly kind: 'vector';
    readonly value: GuiVector;
}
export interface GuiActorNode extends GuiFieldBase {
    readonly kind: 'actor';
    readonly value: number | null;
}
export interface GuiAssetNode extends GuiFieldBase {
    readonly kind: 'asset';
    readonly value: string | null;
    readonly assetKind: AssetKind | null;
}
export interface GuiRowNode extends GuiNodeBase {
    readonly kind: 'row';
    readonly children: readonly GuiNode[];
}
export interface GuiSectionNode extends GuiNodeBase {
    readonly kind: 'section';
    readonly title: string;
    readonly children: readonly GuiNode[];
}
export type GuiNode = GuiLabelNode | GuiHeadingNode | GuiHelpNode | GuiSeparatorNode | GuiSpaceNode | GuiProgressNode | GuiButtonNode | GuiToggleNode | GuiNumberNode | GuiSliderNode | GuiTextNode | GuiSelectNode | GuiColorNode | GuiVectorNode | GuiActorNode | GuiAssetNode | GuiRowNode | GuiSectionNode;
