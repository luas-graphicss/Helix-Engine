'use client';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { prepareCanvas, readCanvasTheme, type CanvasTheme } from '@/engine/editor/animation/ui/canvas-theme';
type Subscribe = (listener: () => void) => () => void;
export interface CanvasLayerSize {
    width: number;
    height: number;
}
export function useCanvasLayer(canvasRef: RefObject<HTMLCanvasElement | null>, size: CanvasLayerSize, subscribes: readonly Subscribe[], draw: (ctx: CanvasRenderingContext2D, theme: CanvasTheme, width: number, height: number) => void): void {
    const drawRef = useRef(draw);
    drawRef.current = draw;
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const paint = useRef(() => {
        const canvas = canvasRef.current;
        const { width, height } = sizeRef.current;
        if (!canvas || width === 0 || height === 0)
            return;
        const ctx = prepareCanvas(canvas, width, height);
        if (!ctx)
            return;
        drawRef.current(ctx, readCanvasTheme(canvas), width, height);
    }).current;
    useLayoutEffect(() => {
        paint();
    });
    useEffect(() => {
        let frame = 0;
        const schedule = () => {
            if (frame !== 0)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                paint();
            });
        };
        const unsubscribes = subscribes.map((subscribe) => subscribe(schedule));
        return () => {
            for (const unsubscribe of unsubscribes)
                unsubscribe();
            if (frame !== 0)
                cancelAnimationFrame(frame);
        };
    }, [paint, ...subscribes]);
}
