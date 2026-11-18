import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import type { AssetVariant, VariantChoice } from './asset-source';
export function describeVariant({ format, quality }: AssetVariant): string {
    return quality ? `${format} ${quality}` : format;
}
function sameText(left: string | null, right: string): boolean {
    return left !== null && left.toLowerCase() === right.trim().toLowerCase();
}
function listValues(values: readonly (string | null)[]): string {
    return Array.from(new Set(values.filter((value) => value !== null))).join(', ');
}
export function chooseVariant(variants: readonly AssetVariant[], choice: VariantChoice, assetName: string): AssetVariant {
    if (variants.length === 0)
        throw new ToolFailure(`"${assetName}" has no file in a format the engine can import.`);
    const { format, quality } = choice;
    const inFormat = format === null ? variants : variants.filter((variant) => sameText(variant.format, format));
    if (inFormat.length === 0)
        throw new ToolFailure(`"${assetName}" is not available as "${format}". Formats: ${listValues(variants.map((variant) => variant.format))}.`);
    if (quality === null)
        return inFormat[0];
    const match = inFormat.find((variant) => sameText(variant.quality, quality));
    if (!match)
        throw new ToolFailure(`"${assetName}" has no "${quality}" quality in ${inFormat[0].format}. Qualities: ${listValues(inFormat.map((variant) => variant.quality)) || 'a single one, omit "quality"'}.`);
    return match;
}
