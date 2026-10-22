export interface CanvasTheme {
    readonly foreground: string;
    readonly muted: string;
    readonly primary: string;
    readonly border: string;
    readonly borderStrong: string;
    readonly surface: string;
    readonly surfaceSunken: string;
    readonly surfaceRaised: string;
    readonly highlight: string;
    readonly warning: string;
    readonly destructive: string;
    readonly axisX: string;
    readonly axisY: string;
    readonly axisZ: string;
}
const VARIABLES: Record<keyof CanvasTheme, {
    name: string;
    fallback: string;
}> = {
    foreground: { name: '--foreground', fallback: '#dcdde0' },
    muted: { name: '--muted-foreground', fallback: '#8b8d93' },
    primary: { name: '--primary', fallback: '#3f9ce8' },
    border: { name: '--border', fallback: '#0d0d0d' },
    borderStrong: { name: '--border-strong', fallback: 'rgba(255,255,255,0.07)' },
    surface: { name: '--surface', fallback: '#1c1c1f' },
    surfaceSunken: { name: '--surface-sunken', fallback: '#0f0f11' },
    surfaceRaised: { name: '--surface-raised', fallback: '#27272b' },
    highlight: { name: '--highlight', fallback: 'rgba(255,255,255,0.04)' },
    warning: { name: '--warning', fallback: '#e2a33c' },
    destructive: { name: '--destructive', fallback: '#d8503f' },
    axisX: { name: '--axis-x', fallback: '#e2493b' },
    axisY: { name: '--axis-y', fallback: '#6cc04a' },
    axisZ: { name: '--axis-z', fallback: '#4a8de0' },
};
export function readCanvasTheme(element: Element): CanvasTheme {
    const style = getComputedStyle(element);
    const theme = {} as Record<keyof CanvasTheme, string>;
    for (const key of Object.keys(VARIABLES) as Array<keyof CanvasTheme>) {
        const { name, fallback } = VARIABLES[key];
        theme[key] = style.getPropertyValue(name).trim() || fallback;
    }
    return theme;
}
export function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth)
        canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight)
        canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context)
        return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    return context;
}
export const CANVAS_FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
