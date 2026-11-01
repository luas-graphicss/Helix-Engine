'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { guiIcons } from '@/engine/gui/icons/gui-icon-catalog';
interface IconGlyphProps {
    readonly name: string;
    readonly size?: number;
    readonly strokeWidth?: number;
    readonly className?: string;
}
export function IconGlyph({ name, size = 20, strokeWidth = 2, className }: IconGlyphProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    const ready = useSyncExternalStore(guiIcons.subscribe, () => guiIcons.ready, () => false);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        const context = canvas.getContext('2d');
        if (!context)
            return;
        context.scale(dpr, dpr);
        context.clearRect(0, 0, size, size);
        if (!ready)
            return;
        guiIcons.draw(context, name, 0, 0, size, getComputedStyle(canvas).color, strokeWidth);
    }, [name, size, strokeWidth, ready]);
    return <canvas ref={ref} style={{ width: size, height: size }} className={className} aria-hidden/>;
}
