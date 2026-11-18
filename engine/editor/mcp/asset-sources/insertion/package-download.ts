import type { MaterialTextureSlot } from '@/engine/core/scene/material';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import type { AssetPackage } from '../catalog/asset-source';
import { describeVariant } from '../catalog/variant-selection';
import { downloadFile } from '../transport/source-request';
export interface DownloadedFile {
    readonly file: File;
    readonly slots: readonly MaterialTextureSlot[];
}
const BYTES_PER_MEBIBYTE = 1024 * 1024;
const FILE_LIMIT_BYTES = 128 * BYTES_PER_MEBIBYTE;
const PACKAGE_LIMIT_BYTES = 160 * BYTES_PER_MEBIBYTE;
const MAX_PACKAGE_FILES = 24;
export async function downloadPackage({ asset, variant, files }: AssetPackage): Promise<DownloadedFile[]> {
    const chosen = describeVariant(variant);
    if (files.length === 0)
        throw new ToolFailure(`"${asset.name}" has no file to download as ${chosen}.`);
    if (files.length > MAX_PACKAGE_FILES)
        throw new ToolFailure(`"${asset.name}" as ${chosen} needs ${files.length} files, above the limit of ${MAX_PACKAGE_FILES}.`);
    if (variant.bytes !== null && variant.bytes > PACKAGE_LIMIT_BYTES)
        throw new ToolFailure(`"${asset.name}" as ${chosen} has ${Math.round(variant.bytes / BYTES_PER_MEBIBYTE)} MB, above the limit of ${PACKAGE_LIMIT_BYTES / BYTES_PER_MEBIBYTE} MB. Pick a lighter format or quality from inspect_asset.`);
    return Promise.all(files.map(async ({ url, name, slots }) => ({ file: await downloadFile(url, name, FILE_LIMIT_BYTES), slots })));
}
