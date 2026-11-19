import { decodeImage } from '@/engine/assets/image-decoder';
import { createTexture, type Texture, type TextureColorSpace } from '@/engine/core/scene/texture';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Shader Graph';
type TextureEntry = {
    readonly status: 'loading';
} | {
    readonly status: 'failed';
} | {
    readonly status: 'ready';
    readonly texture: Texture;
};
export class GraphTextureCache {
    private readonly entries = new Map<string, TextureEntry>();
    constructor(private readonly session: EditorSession, private readonly onLoaded: () => void) { }
    resolve(assetId: string, colorSpace: TextureColorSpace): Texture | null {
        const key = `${assetId}|${colorSpace}`;
        const entry = this.entries.get(key);
        if (!entry) {
            this.entries.set(key, { status: 'loading' });
            void this.load(key, assetId, colorSpace);
            return null;
        }
        return entry.status === 'ready' ? entry.texture : null;
    }
    private async load(key: string, assetId: string, colorSpace: TextureColorSpace): Promise<void> {
        const asset = this.session.library.get(assetId);
        if (!asset || asset.kind !== 'texture') {
            this.entries.set(key, { status: 'failed' });
            return;
        }
        try {
            const file = await this.session.library.primaryFile(asset);
            const image = await decodeImage(file, file.type === '' ? null : file.type);
            this.entries.set(key, { status: 'ready', texture: createTexture({ name: asset.name, image, colorSpace }) });
            this.onLoaded();
        }
        catch (cause) {
            this.entries.set(key, { status: 'failed' });
            this.session.log.warn(LOG_SOURCE, `Não foi possível carregar a textura ${asset.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
    }
}
