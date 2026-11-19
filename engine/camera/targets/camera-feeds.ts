import type { Entity } from '@/engine/core/scene/entity';
import { createTexture, setTextureImage, touchTexture, type Texture } from '@/engine/core/scene/texture';
export function cameraFeedName(entity: Entity): string {
    return `Câmera · ${entity.name}`;
}
export class CameraFeeds {
    private readonly textures = new Map<number, Texture>();
    private readonly owners = new Map<Texture, number>();
    list(): Texture[] {
        return Array.from(this.textures.values());
    }
    find(entityId: number): Texture | null {
        return this.textures.get(entityId) ?? null;
    }
    ownerOf(texture: Texture): number | null {
        return this.owners.get(texture) ?? null;
    }
    ensure(entity: Entity): Texture {
        const existing = this.textures.get(entity.id);
        if (existing) {
            existing.name = cameraFeedName(entity);
            return existing;
        }
        const texture = createTexture({ name: cameraFeedName(entity), colorSpace: 'srgb', wrapS: 'clamp', wrapT: 'clamp', dynamic: true });
        this.adopt(entity.id, texture);
        return texture;
    }
    adopt(entityId: number, texture: Texture): void {
        const previous = this.textures.get(entityId);
        if (previous && previous !== texture)
            this.owners.delete(previous);
        texture.dynamic = true;
        this.textures.set(entityId, texture);
        this.owners.set(texture, entityId);
    }
    publish(entity: Entity, frame: HTMLCanvasElement): void {
        const texture = this.ensure(entity);
        if (texture.image !== frame || texture.width !== frame.width || texture.height !== frame.height)
            setTextureImage(texture, frame);
        else
            touchTexture(texture);
    }
    release(entityId: number): void {
        const texture = this.textures.get(entityId);
        if (!texture)
            return;
        this.textures.delete(entityId);
        this.owners.delete(texture);
    }
}
