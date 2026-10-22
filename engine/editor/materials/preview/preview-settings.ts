export type PreviewShape = 'sphere' | 'cube' | 'plane' | 'cylinder' | 'torus' | 'capsule';
export type PreviewLighting = 'studio' | 'daylight' | 'sunset' | 'night';
export type PreviewBackdrop = 'dark' | 'light' | 'gradient' | 'checker';
export interface PreviewSettings {
    shape: PreviewShape;
    lighting: PreviewLighting;
    backdrop: PreviewBackdrop;
    lightYaw: number;
    lightPitch: number;
    exposure: number;
    autoRotate: boolean;
}
export const PREVIEW_SHAPES: ReadonlyArray<{
    id: PreviewShape;
    label: string;
}> = [
    { id: 'sphere', label: 'Esfera' },
    { id: 'cube', label: 'Cubo' },
    { id: 'plane', label: 'Plano' },
    { id: 'cylinder', label: 'Cilindro' },
    { id: 'torus', label: 'Toro' },
    { id: 'capsule', label: 'Cápsula' },
];
export const PREVIEW_LIGHTINGS: ReadonlyArray<{
    id: PreviewLighting;
    label: string;
}> = [
    { id: 'studio', label: 'Estúdio' },
    { id: 'daylight', label: 'Dia' },
    { id: 'sunset', label: 'Entardecer' },
    { id: 'night', label: 'Noite' },
];
export const PREVIEW_BACKDROPS: ReadonlyArray<{
    id: PreviewBackdrop;
    label: string;
}> = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'gradient', label: 'Degradê' },
    { id: 'checker', label: 'Xadrez' },
];
export function createPreviewSettings(overrides: Partial<PreviewSettings> = {}): PreviewSettings {
    return { shape: 'sphere', lighting: 'studio', backdrop: 'gradient', lightYaw: 35, lightPitch: 40, exposure: 1, autoRotate: false, ...overrides };
}
export const BACKDROP_CLASS: Record<PreviewBackdrop, string> = {
    dark: 'bg-[#1a1b1e]',
    light: 'bg-[#d9dadd]',
    gradient: 'bg-[radial-gradient(ellipse_at_50%_35%,#3a3d44_0%,#1b1c20_70%,#111214_100%)]',
    checker: 'bg-[conic-gradient(#2a2b2f_25%,#1d1e22_0_50%,#2a2b2f_0_75%,#1d1e22_0)] bg-[size:24px_24px]',
};
