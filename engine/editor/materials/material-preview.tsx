'use client';
import { useEffect, useRef, useState } from 'react';
import { Focus, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Material } from '@/engine/core/scene/material';
import { IconButton } from '@/engine/ui/icon-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SliderField } from '@/engine/ui/slider-field';
import { MaterialPreviewRenderer } from './preview/material-preview-renderer';
import { BACKDROP_CLASS, PREVIEW_BACKDROPS, PREVIEW_LIGHTINGS, PREVIEW_SHAPES, type PreviewSettings } from './preview/preview-settings';
type MaterialPreviewProps = {
    material: Material;
    settings: PreviewSettings;
    onChange: (patch: Partial<PreviewSettings>) => void;
};
const ORBIT_SENSITIVITY = 0.4;
const degrees = (value: number) => `${Math.round(value)}°`;
const times = (value: number) => `${value.toFixed(2)}×`;
export function MaterialPreview({ material, settings, onChange }: MaterialPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<MaterialPreviewRenderer | null>(null);
    const materialRef = useRef(material);
    const settingsRef = useRef(settings);
    const onChangeRef = useRef(onChange);
    const [error, setError] = useState<string | null>(null);
    materialRef.current = material;
    settingsRef.current = settings;
    onChangeRef.current = onChange;
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let renderer: MaterialPreviewRenderer;
        try {
            renderer = new MaterialPreviewRenderer(canvas);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
            return;
        }
        rendererRef.current = renderer;
        let frame = 0;
        const loop = (time: number) => {
            renderer.render(materialRef.current, settingsRef.current, time);
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        let dragging: 'orbit' | 'light' | null = null;
        let lastX = 0;
        let lastY = 0;
        const onPointerDown = (event: PointerEvent) => {
            if (event.button !== 0)
                return;
            dragging = event.shiftKey ? 'light' : 'orbit';
            lastX = event.clientX;
            lastY = event.clientY;
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!dragging)
                return;
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            if (dragging === 'orbit')
                renderer.orbit(-dx * ORBIT_SENSITIVITY, dy * ORBIT_SENSITIVITY);
            else {
                const current = settingsRef.current;
                onChangeRef.current({
                    lightYaw: ((current.lightYaw + dx * ORBIT_SENSITIVITY + 540) % 360) - 180,
                    lightPitch: Math.min(85, Math.max(-10, current.lightPitch - dy * ORBIT_SENSITIVITY)),
                });
            }
        };
        const onPointerUp = (event: PointerEvent) => {
            dragging = null;
            if (canvas.hasPointerCapture(event.pointerId))
                canvas.releasePointerCapture(event.pointerId);
        };
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            renderer.dolly(Math.exp(event.deltaY * 0.0015));
        };
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            cancelAnimationFrame(frame);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('wheel', onWheel);
            renderer.dispose();
            rendererRef.current = null;
        };
    }, []);
    return (<section className="flex min-w-0 flex-1 flex-col" aria-label="Preview do material">
      <div className={cn('relative min-h-0 flex-1 overflow-hidden', BACKDROP_CLASS[settings.backdrop])}>
        <canvas ref={canvasRef} className="size-full cursor-grab touch-none active:cursor-grabbing" aria-label="Viewport de preview do material"/>
        {error && (<p className="absolute inset-x-4 top-4 rounded-sm border border-destructive/40 bg-background/90 px-2 py-1 text-2xs text-destructive">{error}</p>)}
        <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between font-mono text-[10px] text-foreground/60 mix-blend-difference">
          <span>Arrastar: orbitar · Shift+arrastar: luz · Roda: zoom</span>
          <span>{material.name}</span>
        </div>
        <div className="absolute top-2 right-2 flex gap-1">
          <IconButton label={settings.autoRotate ? 'Parar rotação automática' : 'Girar automaticamente'} size="sm" active={settings.autoRotate} onClick={() => onChange({ autoRotate: !settings.autoRotate })}>
            <RotateCw />
          </IconButton>
          <IconButton label="Reenquadrar câmera" size="sm" onClick={() => rendererRef.current?.resetCamera()}>
            <Focus />
          </IconButton>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-1 gap-x-6 gap-y-0.5 border-t border-border bg-surface px-3 py-2 lg:grid-cols-2">
        <SegmentedControl label="Forma" options={PREVIEW_SHAPES.map(({ id, label }) => ({ value: id, label }))} value={settings.shape} onChange={(shape) => onChange({ shape })}/>
        <SegmentedControl label="Luz" options={PREVIEW_LIGHTINGS.map(({ id, label }) => ({ value: id, label }))} value={settings.lighting} onChange={(lighting) => onChange({ lighting })}/>
        <SegmentedControl label="Fundo" options={PREVIEW_BACKDROPS.map(({ id, label }) => ({ value: id, label }))} value={settings.backdrop} onChange={(backdrop) => onChange({ backdrop })}/>
        <SliderField label="Exposição" value={settings.exposure} min={0.25} max={4} scale="log" format={times} onChange={(exposure) => onChange({ exposure })}/>
        <SliderField label="Giro da luz" value={settings.lightYaw} min={-180} max={180} step={1} format={degrees} onChange={(lightYaw) => onChange({ lightYaw })}/>
        <SliderField label="Altura da luz" value={settings.lightPitch} min={-10} max={85} step={1} format={degrees} onChange={(lightPitch) => onChange({ lightPitch })}/>
      </div>
    </section>);
}
