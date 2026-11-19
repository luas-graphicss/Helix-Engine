'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
export function CanvasMount({ canvas, className, style }: {
    canvas: HTMLCanvasElement;
    className?: string;
    style?: CSSProperties;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const host = hostRef.current;
        if (!host)
            return;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        host.appendChild(canvas);
        return () => {
            canvas.remove();
        };
    }, [canvas]);
    return <div ref={hostRef} className={className} style={style} aria-hidden/>;
}
