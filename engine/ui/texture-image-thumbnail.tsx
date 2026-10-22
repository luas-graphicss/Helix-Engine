'use client';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TextureImage } from '@/engine/core/scene/texture';
type TextureImageThumbnailProps = {
    image: TextureImage | null;
    resolution?: number;
    className?: string;
    label?: string;
};
export function TextureImageThumbnail({ image, resolution = 96, className, label }: TextureImageThumbnailProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context)
            return;
        context.clearRect(0, 0, canvas.width, canvas.height);
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
    }, [image]);
    return <canvas ref={canvasRef} width={resolution} height={resolution} className={cn('size-full', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label}/>;
}
