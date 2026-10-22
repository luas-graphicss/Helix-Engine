import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { srgbToLinear } from '@/engine/core/color/srgb';
import type { GL } from '@/engine/renderer/gl/context';
type Resolve = (color: Vec3 | null) => void;
export class ViewportColorPicker {
    private resolve: Resolve | null = null;
    private pointerX = 0;
    private pointerY = 0;
    private hovering = false;
    private hasSample = false;
    private readonly pixel = new Uint8Array(4);
    private readonly sampled = vec3.create();
    constructor(private readonly onChange: () => void) { }
    get active(): boolean {
        return this.resolve !== null;
    }
    begin(): Promise<Vec3 | null> {
        this.cancel();
        this.hasSample = false;
        this.hovering = false;
        const promise = new Promise<Vec3 | null>((resolve) => {
            this.resolve = resolve;
        });
        this.onChange();
        return promise;
    }
    move(canvas: HTMLCanvasElement, clientX: number, clientY: number): void {
        const rect = canvas.getBoundingClientRect();
        this.pointerX = ((clientX - rect.left) / rect.width) * canvas.width;
        this.pointerY = (1 - (clientY - rect.top) / rect.height) * canvas.height;
        this.hovering = true;
    }
    leave(): void {
        this.hovering = false;
    }
    sample(gl: GL): void {
        if (!this.active || !this.hovering)
            return;
        const x = Math.min(Math.max(Math.floor(this.pointerX), 0), gl.drawingBufferWidth - 1);
        const y = Math.min(Math.max(Math.floor(this.pointerY), 0), gl.drawingBufferHeight - 1);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);
        vec3.set(this.sampled, srgbToLinear(this.pixel[0] / 255), srgbToLinear(this.pixel[1] / 255), srgbToLinear(this.pixel[2] / 255));
        this.hasSample = true;
    }
    commit(): void {
        this.finish(this.hasSample ? vec3.copy(vec3.create(), this.sampled) : null);
    }
    cancel(): void {
        this.finish(null);
    }
    private finish(color: Vec3 | null): void {
        const resolve = this.resolve;
        if (!resolve)
            return;
        this.resolve = null;
        resolve(color);
        this.onChange();
    }
}
