import { clamp } from '@/engine/core/math/scalar';
import { udim2, type GuiAppearance, type GuiNode, type GuiRect, type GuiTextStyle, type UDim2 } from '@/engine/gui/document/gui-document';
import { HEX_COLOR_HINT, optionalHexColor } from './color-input';
import { ToolFailure } from './tool-failure';
import type { ToolInput } from './tool-input';
import { flag, number, text, vector } from './tool-parameters';
const PLANE_AXES = 2;
export const ELEMENT_PATCH_PARAMETERS = {
    name: text('Element name shown in the layers panel.'),
    text: text('Text content. Only for elements that carry text: text, button, input and progress.'),
    position: vector('Offset [x, y] in pixels from the top-left corner of the parent, in the reference resolution of the screen.', PLANE_AXES),
    positionScale: vector('Extra offset [x, y] as a fraction of the parent size. [0.5, 0.5] with anchor [0.5, 0.5] centers the element.', PLANE_AXES),
    size: vector('Size [width, height] in pixels.', PLANE_AXES),
    sizeScale: vector('Extra size [width, height] as a fraction of the parent size. [1, 1] with size [0, 0] fills the parent.', PLANE_AXES),
    anchor: vector('Pivot inside the element, from [0, 0] top-left to [1, 1] bottom-right.', PLANE_AXES),
    fillColor: text(`Background color. ${HEX_COLOR_HINT}`),
    fillOpacity: number('Background opacity, 0 to 1.'),
    textColor: text(`Text color. ${HEX_COLOR_HINT}`),
    fontSize: number('Text size in pixels.'),
    visible: flag('Show or hide the element.'),
};
function mergeUDim2(current: UDim2, scale: readonly number[] | undefined, offset: readonly number[] | undefined): UDim2 {
    return udim2(scale?.[0] ?? current.x.scale, offset?.[0] ?? current.x.offset, scale?.[1] ?? current.y.scale, offset?.[1] ?? current.y.offset);
}
function patchRect(rect: GuiRect, input: ToolInput): GuiRect {
    const size = input.optionalVector('size', PLANE_AXES);
    const sizeScale = input.optionalVector('sizeScale', PLANE_AXES);
    const anchor = input.optionalVector('anchor', PLANE_AXES);
    return {
        ...rect,
        position: mergeUDim2(rect.position, input.optionalVector('positionScale', PLANE_AXES), input.optionalVector('position', PLANE_AXES)),
        size: mergeUDim2(rect.size, sizeScale, size),
        anchor: anchor ? { x: anchor[0], y: anchor[1] } : rect.anchor,
        autoSize: size || sizeScale ? 'none' : rect.autoSize,
    };
}
function patchAppearance(appearance: GuiAppearance, input: ToolInput): GuiAppearance {
    const color = optionalHexColor(input, 'fillColor');
    const opacity = input.optionalNumber('fillOpacity');
    if (color === undefined && opacity === undefined)
        return appearance;
    const { fill } = appearance;
    const revealed = color !== undefined && fill.alpha === 0 ? 1 : fill.alpha;
    return {
        ...appearance,
        fill: { color: color ?? fill.color, alpha: clamp(opacity ?? revealed, 0, 1), gradient: color === undefined ? fill.gradient : null },
    };
}
function patchText(node: GuiNode, input: ToolInput): GuiTextStyle | null {
    const content = input.optionalText('text');
    const color = optionalHexColor(input, 'textColor');
    const size = input.optionalNumber('fontSize');
    if (content === undefined && color === undefined && size === undefined)
        return node.text;
    if (!node.text)
        throw new ToolFailure(`A ${node.kind} element carries no text. Add a "text" element inside it instead.`);
    return { ...node.text, content: content ?? node.text.content, color: color ?? node.text.color, size: size ?? node.text.size };
}
export function patchElement(node: GuiNode, input: ToolInput): GuiNode {
    return {
        ...node,
        visible: input.optionalFlag('visible') ?? node.visible,
        rect: patchRect(node.rect, input),
        appearance: patchAppearance(node.appearance, input),
        text: patchText(node, input),
    };
}
