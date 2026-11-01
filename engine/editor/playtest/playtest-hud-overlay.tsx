'use client';
import { useEffect, useRef } from 'react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
export function PlaytestHudOverlay() {
    const session = useSessionTopic('playtest');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visible = session.hud.visible;
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !visible)
            return;
        const context = canvas.getContext('2d');
        if (!context)
            return;
        const { hud } = session;
        let handle = 0;
        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const pixelWidth = Math.round(rect.width * dpr);
            const pixelHeight = Math.round(rect.height * dpr);
            const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
            if (resized) {
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
            }
            if ((resized || hud.needsRender) && rect.width > 0 && rect.height > 0)
                hud.render(context, rect.width, rect.height, dpr);
            handle = requestAnimationFrame(draw);
        };
        handle = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(handle);
    }, [session, visible]);
    if (!visible)
        return null;
    return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full"/>;
}
