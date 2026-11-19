import type { PixelLevel } from '@/engine/renderer/textures/mips/pixel-level';
import { compressMipChain, type CompressedMipChain } from './compressed-mip-chain';
export interface TextureCompressionRequest {
    jobId: number;
    base: PixelLevel;
    srgb: boolean;
}
export interface TextureCompressionResponse {
    jobId: number;
    chain: CompressedMipChain;
}
interface WorkerScope {
    onmessage: ((event: MessageEvent<TextureCompressionRequest>) => void) | null;
    postMessage(message: TextureCompressionResponse, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
    const { jobId, base, srgb } = event.data;
    const chain = compressMipChain(base, srgb);
    scope.postMessage({ jobId, chain }, chain.levels.map((level) => level.buffer));
};
