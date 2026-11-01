export type GuiViewCameraMode = 'entity' | 'orbit';
export interface GuiViewDescription {
    readonly camera: GuiViewCameraMode;
    readonly cameraName: string;
    readonly targetName: string;
    readonly distance: number;
    readonly yaw: number;
    readonly pitch: number;
    readonly autoRotate: number;
    readonly fov: number;
    readonly resolutionScale: number;
    readonly frameRate: number;
    readonly grid: boolean;
    readonly yawOffset?: number;
    readonly pitchOffset?: number;
    readonly distanceScale?: number;
}
export interface GuiViewportProvider {
    frame(key: string, view: GuiViewDescription, width: number, height: number, elapsedSeconds: number): CanvasImageSource | null;
    release(key: string): void;
    readonly animating: boolean;
}
export function createViewDescription(overrides: Partial<GuiViewDescription> = {}): GuiViewDescription {
    return {
        camera: 'orbit',
        cameraName: '',
        targetName: '',
        distance: 6,
        yaw: 35,
        pitch: -20,
        autoRotate: 0,
        fov: 45,
        resolutionScale: 1,
        frameRate: 0,
        grid: false,
        ...overrides,
    };
}
export const nullViewportProvider: GuiViewportProvider = {
    frame: () => null,
    release: () => undefined,
    animating: false,
};
