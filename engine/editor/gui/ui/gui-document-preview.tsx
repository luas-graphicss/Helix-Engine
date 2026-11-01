'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GuiDocument } from '@/engine/gui/document/gui-document';
import { guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { guiIcons } from '@/engine/gui/icons/gui-icon-catalog';
import { guiImages } from '@/engine/gui/images/gui-image-cache';
import { layoutGuiDocument } from '@/engine/gui/layout/gui-layout';
import { renderGuiLayout } from '@/engine/gui/render/gui-renderer';
import { guiTextMeasurer } from '@/engine/gui/text/gui-text-measure';
import { cn } from '@/lib/utils';
interface GuiDocumentPreviewProps {
    readonly document: GuiDocument;
    readonly width: number;
    readonly className?: string;
}
const BACKDROP = '#0b0e15';
function useIconsReady(): boolean {
    return useSyncExternalStore(guiIcons.subscribe, () => guiIcons.ready, () => false);
}
export function GuiDocumentPreview({ document, width, className }: GuiDocumentPreviewProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    const iconsReady = useIconsReady();
    const { x: referenceWidth, y: referenceHeight } = document.referenceSize;
    const height = Math.max(1, Math.round((width * referenceHeight) / referenceWidth));
    useEffect(() => {
        if (!iconsReady)
            void guiIcons.load();
    }, [iconsReady]);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const context = canvas.getContext('2d');
        if (!context)
            return;
        const scale = (width * dpr) / referenceWidth;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = BACKDROP;
        context.fillRect(0, 0, canvas.width, canvas.height);
        const layout = layoutGuiDocument(document, { x: referenceWidth, y: referenceHeight }, { measurer: guiTextMeasurer, cssFamily: (family) => guiFonts.cssFamily(family) });
        renderGuiLayout(context, layout, { base: [scale, 0, 0, scale, 0, 0], images: guiImages, icons: guiIcons, fonts: guiFonts, state: null, placeholders: true });
    }, [document, width, height, referenceWidth, referenceHeight, iconsReady]);
    return <canvas ref={ref} className={cn('block', className)} style={{ width, height }} aria-hidden/>;
}
