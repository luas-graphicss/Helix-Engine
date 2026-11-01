'use client';
import { useEffect, useMemo, type RefObject } from 'react';
import { guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { guiIcons } from '@/engine/gui/icons/gui-icon-catalog';
import { guiImages } from '@/engine/gui/images/gui-image-cache';
import type { GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import { renderGuiLayout } from '@/engine/gui/render/gui-renderer';
import type { ElementSize } from '@/engine/ui/use-element-size';
import { GUI_DESIGNER_MEDIA_SCOPE, type GuiDesigner } from '../gui-designer';
import { selectionBounds } from '../gui-selection';
import { drawDeviceBody, drawDeviceHardware, traceScreen } from './device/gui-device-frame';
import { GuiScreenRaster } from './device/gui-screen-raster';
import { drawGrid, drawRulers, drawSafeArea, drawScreenBackdrop, drawScreenShadow, drawWorkspaceBackground, readChromeColors, type ChromeColors, type ChromeFrame } from './gui-canvas-chrome';
function hasViewportElements(designer: GuiDesigner): boolean {
    const layout = designer.layout();
    if (!layout)
        return false;
    for (const entry of layout.entries.values()) {
        if (entry.node.visible && entry.node.control?.kind === 'viewport')
            return true;
    }
    return false;
}
function paintContent(context: CanvasRenderingContext2D, designer: GuiDesigner, base: GuiMatrix): void {
    if (designer.mode === 'preview') {
        designer.syncRuntime();
        designer.runtime.render(context, base);
        return;
    }
    const layout = designer.layout();
    if (!layout)
        return;
    renderGuiLayout(context, layout, {
        base,
        images: guiImages,
        icons: guiIcons,
        fonts: guiFonts,
        state: null,
        placeholders: true,
        viewports: designer.viewports,
        mediaScope: GUI_DESIGNER_MEDIA_SCOPE,
        elapsedSeconds: 0,
    });
}
function drawFrame(context: CanvasRenderingContext2D, designer: GuiDesigner, raster: GuiScreenRaster, size: ElementSize, colors: ChromeColors): void {
    const dpr = window.devicePixelRatio || 1;
    const { view, screen, options } = designer;
    const frame: ChromeFrame = { width: size.width, height: size.height, view, screen, colors };
    const deviceFrame = { view, screen };
    const showFrame = options.deviceFrame;
    const cornerRadius = showFrame ? screen.cornerRadius : 0;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorkspaceBackground(context, frame);
    if (showFrame && screen.frame)
        drawDeviceBody(context, deviceFrame);
    else
        drawScreenShadow(context, frame, cornerRadius);
    context.save();
    traceScreen(context, deviceFrame, cornerRadius);
    context.clip();
    drawScreenBackdrop(context, frame, options.checkerboard);
    if (options.devicePixels && screen.spec && GuiScreenRaster.fits(screen)) {
        raster.draw(context, screen, view, dpr, (target, base) => paintContent(target, designer, base));
    }
    else {
        paintContent(context, designer, [view.zoom * dpr, 0, 0, view.zoom * dpr, view.panX * dpr, view.panY * dpr]);
    }
    context.restore();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (showFrame)
        drawDeviceHardware(context, deviceFrame);
    if (options.grid)
        drawGrid(context, frame, options.gridSize);
    if (options.safeArea)
        drawSafeArea(context, frame);
    if (options.rulers) {
        const layout = designer.layout();
        drawRulers(context, frame, layout && designer.mode === 'design' ? selectionBounds(layout, designer.selectedIds) : null);
    }
}
export function useGuiCanvasRenderer(canvasRef: RefObject<HTMLCanvasElement | null>, hostRef: RefObject<HTMLElement | null>, designer: GuiDesigner, size: ElementSize, version: number): void {
    const raster = useMemo(() => new GuiScreenRaster(), []);
    useEffect(() => () => raster.dispose(), [raster]);
    useEffect(() => {
        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (!canvas || !host || size.width === 0 || size.height === 0)
            return;
        const context = canvas.getContext('2d');
        if (!context)
            return;
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.round(size.width * dpr);
        const pixelHeight = Math.round(size.height * dpr);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        const colors = readChromeColors(host);
        drawFrame(context, designer, raster, size, colors);
        let handle = 0;
        if (designer.mode === 'preview') {
            let last = performance.now();
            const loop = (now: number) => {
                const delta = Math.min(0.1, (now - last) / 1000);
                last = now;
                designer.tick(delta);
                if (designer.runtime.needsRender)
                    drawFrame(context, designer, raster, size, colors);
                handle = requestAnimationFrame(loop);
            };
            handle = requestAnimationFrame(loop);
        }
        else if (hasViewportElements(designer)) {
            const settle = () => {
                if (!designer.viewports.animating)
                    return;
                drawFrame(context, designer, raster, size, colors);
                handle = requestAnimationFrame(settle);
            };
            handle = requestAnimationFrame(settle);
        }
        return () => cancelAnimationFrame(handle);
    }, [canvasRef, hostRef, designer, raster, size, version]);
}
