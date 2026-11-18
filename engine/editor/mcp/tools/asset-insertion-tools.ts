import * as vec3 from '@/engine/core/math/vec3';
import { MATERIAL_TEXTURE_SLOTS, type MaterialTextureSlot } from '@/engine/core/scene/material';
import { requireActor } from '@/engine/editor/assistant/tools/entity-access';
import { choice, flag, integer, parameters, text, vector } from '@/engine/editor/assistant/tools/tool-parameters';
import { creditLine } from '@/engine/editor/mcp/asset-sources/catalog/asset-presentation';
import { parseAssetReference } from '@/engine/editor/mcp/asset-sources/catalog/asset-reference';
import { requiresAttribution } from '@/engine/editor/mcp/asset-sources/catalog/license-label';
import { describeVariant } from '@/engine/editor/mcp/asset-sources/catalog/variant-selection';
import { insertDownloadedAsset } from '@/engine/editor/mcp/asset-sources/insertion/asset-insertion';
import { requireOwnMaterial } from '@/engine/editor/mcp/asset-sources/insertion/material-map-insertion';
import { downloadPackage } from '@/engine/editor/mcp/asset-sources/insertion/package-download';
import { openSource } from '@/engine/editor/mcp/asset-sources/permissions/source-gate';
import type { ImportPlacement } from '@/engine/editor/operations/import-operations';
import type { McpTool } from './mcp-tool';
const PLACEMENTS: readonly ImportPlacement[] = ['target', 'origin', 'keep'];
const DEFAULT_PLACEMENT: ImportPlacement = 'target';
const TEXTURE_SLOTS: readonly MaterialTextureSlot[] = MATERIAL_TEXTURE_SLOTS.map((entry) => entry.slot);
const DEFAULT_TEXTURE_SLOT: MaterialTextureSlot = 'baseColorMap';
const KIND_BEHAVIOR = [
    'Model: placed in the scene with its skeleton, and saved to the asset library together with its animation clips.',
    'Texture: the color, normal and occlusion/roughness/metal maps enter the library and, with "entity", are bound to its material.',
    'Image: enters the library and, with "entity", becomes the texture of one material slot.',
    'Audio: enters the library and plays from a new sound source, or from "entity" when given.',
    'HDRI: converted to an sRGB panorama in the library and shown on a backdrop dome around the scene, which does not light it.',
].join(' ');
const insertAsset: McpTool = {
    name: 'insert_asset',
    title: 'Inserir asset externo',
    access: 'scene',
    description: `Downloads an external asset and puts it in the game. Look at it with search_assets, then check formats, qualities and sizes with inspect_asset. ${KIND_BEHAVIOR} The answer carries the credit line whenever the license requires one: show it in the game.`,
    parameters: parameters({
        asset: text('Asset reference: the "ref" of a search_assets result.'),
        format: text('File format listed by inspect_asset. Defaults to the first one listed.'),
        quality: text('Quality listed by inspect_asset. Defaults to the first one listed.'),
        name: text('Name for the entity created in the scene. Defaults to the name of the asset.'),
        entity: integer('Id of the entity that receives the texture, the image or the sound source.'),
        slot: choice(`Image: material slot that receives it. Default ${DEFAULT_TEXTURE_SLOT}.`, TEXTURE_SLOTS),
        placement: choice(`Model: "target" at the camera focus, "origin" at the world origin, "keep" preserves the coordinates of the file. Default ${DEFAULT_PLACEMENT}.`, PLACEMENTS),
        position: vector('Model and audio: world position of the new entity. Overrides placement.'),
        addToScene: flag('Audio and HDRI: false keeps the asset only in the library. Default true.'),
        saveToLibrary: flag('Model: false skips the asset library and with it the animation clips. Default true.'),
    }, ['asset']),
    async run({ session, sourcePermissions }, input) {
        const reference = parseAssetReference(input.text('asset'));
        const opened = openSource(sourcePermissions, reference.sourceId, reference.kind);
        const entity = input.has('entity') ? requireActor(session, input.integer('entity')) : null;
        if (entity && (reference.kind === 'texture' || reference.kind === 'image'))
            requireOwnMaterial(session, entity);
        const position = input.optionalVector('position');
        const choiceOfVariant = { format: input.optionalText('format') ?? null, quality: input.optionalText('quality') ?? null };
        const assetPackage = await opened.source.resolvePackage(reference.kind, reference.assetId, choiceOfVariant, opened.session);
        const { asset, variant } = assetPackage;
        const inserted = await insertDownloadedAsset(session, reference.kind, await downloadPackage(assetPackage), {
            name: input.optionalText('name')?.trim() || asset.name,
            entity,
            slot: input.optionalChoice('slot', TEXTURE_SLOTS) ?? DEFAULT_TEXTURE_SLOT,
            placement: input.optionalChoice('placement', PLACEMENTS) ?? DEFAULT_PLACEMENT,
            position: position ? vec3.create(position[0], position[1], position[2]) : null,
            addToScene: input.optionalFlag('addToScene') ?? true,
            saveToLibrary: input.optionalFlag('saveToLibrary') ?? true,
        });
        const credit = requiresAttribution(asset.license) ? creditLine(asset) : undefined;
        return { output: { asset: asset.name, variant: describeVariant(variant), license: asset.license, credit, ...inserted } };
    },
};
export const ASSET_INSERTION_TOOLS: readonly McpTool[] = [insertAsset];
