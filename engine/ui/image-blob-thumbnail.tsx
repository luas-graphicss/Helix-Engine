'use client';
import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
type ImageBlobThumbnailProps = {
    blob: Blob | null;
    alt: string;
    className?: string;
};
export function ImageBlobThumbnail({ blob, alt, className }: ImageBlobThumbnailProps) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!blob) {
            setUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [blob]);
    if (!url) {
        return (<span className={cn('flex size-full items-center justify-center text-muted-foreground/60', className)} aria-label={alt} role="img">
        <ImageOff className="size-3.5" aria-hidden/>
      </span>);
    }
    return <img src={url} alt={alt} className={cn('size-full object-cover', className)}/>;
}
