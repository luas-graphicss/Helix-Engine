import type { GuiDocument } from '@/engine/gui/document/gui-document';
import { countGuiNodes, walkGui } from '@/engine/gui/document/gui-tree';
import { fontAssetIdOf } from '@/engine/gui/fonts/gui-font-registry';
import type { GuiAssetDetails } from './asset-types';
export function guiReferencedAssets(document: GuiDocument): {
    fonts: string[];
    images: string[];
    videos: string[];
} {
    const fonts = new Set<string>();
    const images = new Set<string>();
    const videos = new Set<string>();
    walkGui(document.root, (node) => {
        if (node.text) {
            const fontId = fontAssetIdOf(node.text.family);
            if (fontId)
                fonts.add(fontId);
        }
        if (node.image?.assetId)
            images.add(node.image.assetId);
        if (node.control?.kind === 'video') {
            if (node.control.assetId)
                videos.add(node.control.assetId);
            if (node.control.posterAssetId)
                images.add(node.control.posterAssetId);
        }
    });
    return { fonts: [...fonts], images: [...images], videos: [...videos] };
}
export function guiAssetDetails(document: GuiDocument): GuiAssetDetails {
    const referenced = guiReferencedAssets(document);
    return {
        kind: 'gui',
        referenceWidth: document.referenceSize.x,
        referenceHeight: document.referenceSize.y,
        elements: countGuiNodes(document.root),
        enabled: document.enabled,
        displayOrder: document.displayOrder,
        fontAssetIds: referenced.fonts,
        imageAssetIds: referenced.images,
        videoAssetIds: referenced.videos,
    };
}
