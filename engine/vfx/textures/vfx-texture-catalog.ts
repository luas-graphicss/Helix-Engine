import { createTexture, type Texture, type TextureImage } from '@/engine/core/scene/texture';
import { valueNoise3 } from '@/engine/core/noise/value-noise';
import type { VfxBuiltinTextureId, VfxTextureRef } from '@/engine/vfx/document/vfx-document';
export const VFX_TEXTURE_SIZE = 128;
export interface VfxBuiltinTextureInfo {
    readonly id: VfxBuiltinTextureId;
    readonly label: string;
    readonly description: string;
}
export const VFX_BUILTIN_TEXTURES: readonly VfxBuiltinTextureInfo[] = [
    { id: 'soft', label: 'Suave', description: 'Disco difuso: fumaça, brilho, poeira, chamas' },
    { id: 'circle', label: 'Disco', description: 'Círculo de borda dura: bolhas, pontos, confete redondo' },
    { id: 'ring', label: 'Anel', description: 'Aro fino: ondas de choque e portais' },
    { id: 'spark', label: 'Faísca', description: 'Ponto brilhante com quatro raios: brasas e centelhas' },
    { id: 'star', label: 'Estrela', description: 'Estrela de cinco pontas: magia e brilhos' },
    { id: 'smoke', label: 'Fumaça', description: 'Nuvem irregular com várias bolhas: fumaça e poeira densa' },
    { id: 'flare', label: 'Clarão', description: 'Risco horizontal com núcleo: reflexos e flashes' },
    { id: 'square', label: 'Quadrado', description: 'Quadrado de borda macia: confete, pixels, fragmentos' },
    { id: 'cross', label: 'Cruz', description: 'Sinal de mais: cura, sinais e brilhos retrô' },
    { id: 'drop', label: 'Gota', description: 'Gota alongada com reflexo: chuva e respingos' },
    { id: 'shard', label: 'Estilhaço', description: 'Triângulo irregular: destroços, vidro e pedras' },
    { id: 'bokeh', label: 'Bokeh', description: 'Disco com borda mais clara: luzes fora de foco' },
    { id: 'noise', label: 'Ruído', description: 'Manchas de ruído: poeira fina e névoa' },
];
export function vfxBuiltinTextureInfo(id: VfxBuiltinTextureId): VfxBuiltinTextureInfo {
    const info = VFX_BUILTIN_TEXTURES.find((candidate) => candidate.id === id);
    if (!info)
        throw new Error(`Sprite de efeito desconhecido: ${id}.`);
    return info;
}
type Painter = (context: CanvasRenderingContext2D, size: number) => void;
function radial(context: CanvasRenderingContext2D, x: number, y: number, radius: number, stops: ReadonlyArray<[
    number,
    number
]>): void {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    for (const [offset, alpha] of stops)
        gradient.addColorStop(offset, `rgba(255, 255, 255, ${alpha})`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
}
function polygon(context: CanvasRenderingContext2D, points: ReadonlyArray<[
    number,
    number
]>, alpha = 1): void {
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.closePath();
    context.fill();
}
function sequence(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
const PAINTERS: Record<VfxBuiltinTextureId, Painter> = {
    soft: (context, size) => {
        radial(context, size / 2, size / 2, size / 2, [
            [0, 1],
            [0.25, 0.75],
            [0.6, 0.2],
            [1, 0],
        ]);
    },
    circle: (context, size) => {
        radial(context, size / 2, size / 2, size / 2, [
            [0, 1],
            [0.9, 1],
            [0.97, 0.5],
            [1, 0],
        ]);
    },
    ring: (context, size) => {
        radial(context, size / 2, size / 2, size / 2, [
            [0, 0],
            [0.6, 0],
            [0.72, 0.4],
            [0.8, 1],
            [0.88, 0.4],
            [1, 0],
        ]);
    },
    spark: (context, size) => {
        const center = size / 2;
        radial(context, center, center, size * 0.22, [
            [0, 1],
            [0.4, 0.8],
            [1, 0],
        ]);
        context.globalCompositeOperation = 'lighter';
        for (const vertical of [false, true]) {
            const gradient = vertical
                ? context.createLinearGradient(center, 0, center, size)
                : context.createLinearGradient(0, center, size, center);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            context.fillStyle = gradient;
            const thickness = size * 0.035;
            if (vertical)
                context.fillRect(center - thickness, 0, thickness * 2, size);
            else
                context.fillRect(0, center - thickness, size, thickness * 2);
        }
        context.globalCompositeOperation = 'source-over';
    },
    star: (context, size) => {
        const center = size / 2;
        const outer = size * 0.46;
        const inner = size * 0.19;
        const points: Array<[
            number,
            number
        ]> = [];
        for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? outer : inner;
            const angle = -Math.PI / 2 + (i * Math.PI) / 5;
            points.push([center + Math.cos(angle) * radius, center + Math.sin(angle) * radius]);
        }
        context.filter = `blur(${size * 0.012}px)`;
        polygon(context, points);
        context.filter = 'none';
        radial(context, center, center, size * 0.2, [
            [0, 0.9],
            [1, 0],
        ]);
    },
    smoke: (context, size) => {
        const random = sequence(0x5eed);
        const center = size / 2;
        for (let i = 0; i < 14; i++) {
            const angle = random() * Math.PI * 2;
            const distance = random() * size * 0.2;
            const radius = size * (0.14 + random() * 0.14);
            radial(context, center + Math.cos(angle) * distance, center + Math.sin(angle) * distance, radius, [
                [0, 0.28],
                [0.5, 0.14],
                [1, 0],
            ]);
        }
    },
    flare: (context, size) => {
        const center = size / 2;
        const gradient = context.createLinearGradient(0, center, size, center);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gradient;
        const thickness = size * 0.06;
        context.filter = `blur(${size * 0.02}px)`;
        context.fillRect(0, center - thickness, size, thickness * 2);
        context.filter = 'none';
        radial(context, center, center, size * 0.26, [
            [0, 1],
            [0.3, 0.7],
            [1, 0],
        ]);
    },
    square: (context, size) => {
        const inset = size * 0.14;
        context.filter = `blur(${size * 0.02}px)`;
        context.fillStyle = 'rgba(255, 255, 255, 1)';
        context.fillRect(inset, inset, size - inset * 2, size - inset * 2);
        context.filter = 'none';
    },
    cross: (context, size) => {
        const arm = size * 0.14;
        const length = size * 0.36;
        const center = size / 2;
        context.filter = `blur(${size * 0.012}px)`;
        context.fillStyle = 'rgba(255, 255, 255, 1)';
        context.fillRect(center - arm / 2, center - length, arm, length * 2);
        context.fillRect(center - length, center - arm / 2, length * 2, arm);
        context.filter = 'none';
    },
    drop: (context, size) => {
        const center = size / 2;
        context.save();
        context.translate(center, center);
        context.scale(0.42, 1);
        radial(context, 0, 0, size * 0.46, [
            [0, 1],
            [0.75, 0.9],
            [1, 0],
        ]);
        context.restore();
        radial(context, center - size * 0.06, center - size * 0.16, size * 0.06, [
            [0, 1],
            [1, 0],
        ]);
    },
    shard: (context, size) => {
        context.filter = `blur(${size * 0.008}px)`;
        polygon(context, [
            [size * 0.5, size * 0.08],
            [size * 0.86, size * 0.62],
            [size * 0.6, size * 0.92],
            [size * 0.18, size * 0.7],
        ]);
        context.filter = 'none';
    },
    bokeh: (context, size) => {
        radial(context, size / 2, size / 2, size / 2, [
            [0, 0.35],
            [0.75, 0.45],
            [0.9, 1],
            [0.96, 0.6],
            [1, 0],
        ]);
    },
    noise: (context, size) => {
        const image = context.createImageData(size, size);
        const { data } = image;
        const center = size / 2;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = (x - center) / center;
                const dy = (y - center) / center;
                const falloff = Math.max(0, 1 - Math.hypot(dx, dy));
                const noise = valueNoise3(x * 0.07, y * 0.07, 0, 11) * 0.5 + 0.5;
                const detail = valueNoise3(x * 0.19, y * 0.19, 3.7, 29) * 0.25 + 0.5;
                const alpha = Math.max(0, noise * detail * 1.6 - 0.25) * falloff * falloff;
                const offset = (y * size + x) * 4;
                data[offset] = 255;
                data[offset + 1] = 255;
                data[offset + 2] = 255;
                data[offset + 3] = Math.round(Math.min(1, alpha) * 255);
            }
        }
        context.putImageData(image, 0, 0);
    },
};
const builtinCache = new Map<VfxBuiltinTextureId, Texture>();
export function paintBuiltinVfxTexture(id: VfxBuiltinTextureId, size = VFX_TEXTURE_SIZE): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas 2D indisponível para os sprites dos efeitos.');
    PAINTERS[id](context, size);
    return canvas;
}
export function builtinVfxTexture(id: VfxBuiltinTextureId): Texture {
    let texture = builtinCache.get(id);
    if (!texture) {
        texture = createTexture({
            name: `Sprite ${vfxBuiltinTextureInfo(id).label}`,
            image: paintBuiltinVfxTexture(id),
            colorSpace: 'srgb',
            wrapS: 'clamp',
            wrapT: 'clamp',
        });
        builtinCache.set(id, texture);
    }
    return texture;
}
const assetCache = new Map<string, {
    image: TextureImage;
    texture: Texture;
}>();
export function vfxAssetTexture(assetId: string, image: TextureImage): Texture {
    const cached = assetCache.get(assetId);
    if (cached && cached.image === image)
        return cached.texture;
    const texture = createTexture({ name: `Sprite ${assetId}`, image, colorSpace: 'srgb', wrapS: 'clamp', wrapT: 'clamp' });
    assetCache.set(assetId, { image, texture });
    return texture;
}
export function forgetVfxAssetTexture(assetId: string): void {
    assetCache.delete(assetId);
}
