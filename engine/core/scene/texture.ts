export type TextureColorSpace = 'srgb' | 'linear';
export type TextureWrap = 'repeat' | 'clamp' | 'mirror';
export type TextureFilter = 'linear' | 'nearest';
export type TextureImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement | ImageData;
export interface Texture {
    readonly id: number;
    name: string;
    image: TextureImage | null;
    width: number;
    height: number;
    colorSpace: TextureColorSpace;
    wrapS: TextureWrap;
    wrapT: TextureWrap;
    magFilter: TextureFilter;
    minFilter: TextureFilter;
    sourcePath: string;
    mimeType: string | null;
    version: number;
}
export type TextureOptions = Partial<Omit<Texture, 'id' | 'version'>> & {
    name: string;
};
let nextTextureId = 1;
export function createTexture(options: TextureOptions): Texture {
    return {
        id: nextTextureId++,
        name: options.name,
        image: options.image ?? null,
        width: options.width ?? options.image?.width ?? 0,
        height: options.height ?? options.image?.height ?? 0,
        colorSpace: options.colorSpace ?? 'srgb',
        wrapS: options.wrapS ?? 'repeat',
        wrapT: options.wrapT ?? 'repeat',
        magFilter: options.magFilter ?? 'linear',
        minFilter: options.minFilter ?? 'linear',
        sourcePath: options.sourcePath ?? '',
        mimeType: options.mimeType ?? null,
        version: 0,
    };
}
export function setTextureImage(texture: Texture, image: TextureImage | null): void {
    texture.image = image;
    texture.width = image?.width ?? 0;
    texture.height = image?.height ?? 0;
    texture.version++;
}
