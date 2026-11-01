import { Cylinder, Disc, Flashlight, Haze, Lightbulb, RectangleHorizontal, Sun, type LucideIcon } from 'lucide-react';
import type { Light, LocalLightType } from '@/engine/core/scene/light';
export const LIGHT_ICON: Record<Light['type'], LucideIcon> = {
    directional: Sun,
    ambient: Haze,
    point: Lightbulb,
    spot: Flashlight,
    rect: RectangleHorizontal,
    disc: Disc,
    tube: Cylinder,
};
export const LOCAL_LIGHT_DESCRIPTION: Record<LocalLightType, string> = {
    point: 'Emite em todas as direções: lâmpadas, velas, fogueiras',
    spot: 'Cone de luz com borda suave: lanternas, postes, canhões de palco',
    rect: 'Painel retangular com reflexo em forma de painel: softbox, luminária, janela',
    disc: 'Disco emissor: spots embutidos, luminárias redondas',
    tube: 'Segmento emissor: fluorescente, neon, sabre',
};
export function lightIcon(light: Light | null | undefined): LucideIcon {
    return light ? LIGHT_ICON[light.type] : Lightbulb;
}
