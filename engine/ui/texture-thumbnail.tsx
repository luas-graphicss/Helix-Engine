'use client';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Texture } from '@/engine/core/scene/texture';
type TextureThumbnailProps = {
    texture: Texture;
    resolution?: number;
    className?: string;
};
export function TextureThumbnail({ texture, resolution = 80, className }: TextureThumbnailProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context)
            return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const { image } = texture;
        if (!image)
            return;
        if (image instanceof ImageData) {
            const scratch = document.createElement('canvas');
            scratch.width = image.width;
            scratch.height = image.height;
            scratch.getContext('2d')?.putImageData(image, 0, 0);
            context.drawImage(scratch, 0, 0, canvas.width, canvas.height);
        }
        else {
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
        }
    }, [texture, texture.version]);
    return <canvas ref={canvasRef} width={resolution} height={resolution} className={cn('size-full', className)} aria-hidden/>;
}
