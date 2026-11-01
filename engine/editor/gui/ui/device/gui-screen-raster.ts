import type { GuiEmulatedScreen } from '@/engine/gui/devices/device-geometry';
import type { GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import type { GuiViewState } from '../../gui-designer';
const MAX_RASTER_PIXELS = 8192 * 4320;
export class GuiScreenRaster {
    private canvas: HTMLCanvasElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    static fits(screen: GuiEmulatedScreen): boolean {
        return screen.physical.x * screen.physical.y <= MAX_RASTER_PIXELS;
    }
    draw(target: CanvasRenderingContext2D, screen: GuiEmulatedScreen, view: GuiViewState, editorDpr: number, paint: (context: CanvasRenderingContext2D, base: GuiMatrix) => void): void {
        const context = this.acquire(screen.physical.x, screen.physical.y);
        if (!context)
            return;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, screen.physical.x, screen.physical.y);
        paint(context, [screen.dpr, 0, 0, screen.dpr, 0, 0]);
        const magnification = (view.zoom * editorDpr) / screen.dpr;
        target.save();
        target.imageSmoothingEnabled = magnification < 1;
        target.imageSmoothingQuality = 'high';
        target.drawImage(this.canvas!, view.panX, view.panY, screen.width * view.zoom, screen.height * view.zoom);
        target.restore();
    }
    private acquire(width: number, height: number): CanvasRenderingContext2D | null {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.context = this.canvas.getContext('2d');
        }
        if (!this.context)
            return null;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        return this.context;
    }
    dispose(): void {
        if (this.canvas) {
            this.canvas.width = 0;
            this.canvas.height = 0;
        }
        this.canvas = null;
        this.context = null;
    }
}
