import type { RemoteAsset } from '../catalog/asset-source';
import { renderContactSheet, type SheetCell } from './contact-sheet';
import { loadThumbnail } from './thumbnail-loader';
export async function renderAssetPreviewSheet(assets: readonly RemoteAsset[]): Promise<Blob> {
    const images = await Promise.all(assets.map((asset) => loadThumbnail(asset.thumbnailUrl)));
    const cells: SheetCell[] = assets.map((asset, index) => ({
        badge: String(index + 1),
        title: asset.name,
        caption: `${asset.author} · ${asset.license}`,
        image: images[index],
    }));
    try {
        return await renderContactSheet(cells);
    }
    finally {
        for (const image of images)
            image?.close();
    }
}
