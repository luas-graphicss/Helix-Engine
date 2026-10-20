import type { TextureImage } from '@/engine/core/scene/texture';
function createCanvas(width: number, height: number): {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
} {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context)
        throw new Error('Canvas 2D indisponível para processar texturas.');
    return { canvas, context };
}
export function rasterize(image: TextureImage, width = image.width, height = image.height): {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
} {
    const target = createCanvas(width, height);
    if (image instanceof ImageData) {
        const source = createCanvas(image.width, image.height);
        source.context.putImageData(image, 0, 0);
        target.context.drawImage(source.canvas, 0, 0, width, height);
    }
    else {
        target.context.drawImage(image, 0, 0, width, height);
    }
    return target;
}
export function readPixels(image: TextureImage, width = image.width, height = image.height): ImageData {
    if (image instanceof ImageData && image.width === width && image.height === height)
        return image;
    const { context } = rasterize(image, width, height);
    return context.getImageData(0, 0, width, height);
}
export function packMetallicRoughness(roughness: TextureImage | null, metallic: TextureImage | null): HTMLCanvasElement {
    const width = Math.max(roughness?.width ?? 0, metallic?.width ?? 0, 1);
    const height = Math.max(roughness?.height ?? 0, metallic?.height ?? 0, 1);
    const roughPixels = roughness ? readPixels(roughness, width, height).data : null;
    const metalPixels = metallic ? readPixels(metallic, width, height).data : null;
    const { canvas, context } = createCanvas(width, height);
    const output = context.createImageData(width, height);
    const data = output.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = roughPixels ? roughPixels[i] : 255;
        data[i + 2] = metalPixels ? metalPixels[i] : 255;
        data[i + 3] = 255;
    }
    context.putImageData(output, 0, 0);
    return canvas;
}
export function isLikelyHeightMap(image: TextureImage): boolean {
    const sampleSize = 64;
    const pixels = readPixels(image, Math.min(image.width, sampleSize), Math.min(image.height, sampleSize)).data;
    let gray = 0;
    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        if (Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6)
            gray++;
        total++;
    }
    return total > 0 && gray / total >= 0.98;
}
export function heightMapToNormalMap(image: TextureImage, strength = 1): HTMLCanvasElement {
    const { width, height } = image;
    const source = readPixels(image).data;
    const heightAt = (x: number, y: number) => source[(((y + height) % height) * width + ((x + width) % width)) * 4] / 255;
    const { canvas, context } = createCanvas(width, height);
    const output = context.createImageData(width, height);
    const data = output.data;
    const scale = Math.max(strength, 0.01) * 2;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const tl = heightAt(x - 1, y - 1), t = heightAt(x, y - 1), tr = heightAt(x + 1, y - 1);
            const l = heightAt(x - 1, y), r = heightAt(x + 1, y);
            const bl = heightAt(x - 1, y + 1), b = heightAt(x, y + 1), br = heightAt(x + 1, y + 1);
            const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * scale;
            const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * scale;
            const length = Math.hypot(dx, dy, 1);
            const index = (y * width + x) * 4;
            data[index] = Math.round((-dx / length * 0.5 + 0.5) * 255);
            data[index + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
            data[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
            data[index + 3] = 255;
        }
    }
    context.putImageData(output, 0, 0);
    return canvas;
}
