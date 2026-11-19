import type { VfxGraphDocument } from '../document/effect-document';
import { buildArcaneVortex, buildGalaxy, buildLightning } from './energy-templates';
import { buildCampfire, buildSmokeColumn } from './fire-templates';
import { buildBloodSplatter, buildExplosion, buildSparks } from './impact-templates';
import { buildFireflies, buildSnowfall, buildStorm } from './weather-templates';
export const EFFECT_TEMPLATE_CATEGORIES = ['fire', 'impact', 'energy', 'weather'] as const;
export type EffectTemplateCategory = (typeof EFFECT_TEMPLATE_CATEGORIES)[number];
export interface EffectTemplate {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly category: EffectTemplateCategory;
    readonly build: () => VfxGraphDocument;
}
export const EFFECT_TEMPLATE_CATEGORY_LABEL: Record<EffectTemplateCategory, string> = {
    fire: 'Fogo e fumaça',
    impact: 'Impactos',
    energy: 'Magia e energia',
    weather: 'Clima e ambiente',
};
export const EFFECT_TEMPLATES: readonly EffectTemplate[] = [
    { id: 'campfire', label: 'Fogueira', description: 'Chamas turbulentas, fumaça que sobe com o vento e brasas que piscam.', category: 'fire', build: buildCampfire },
    { id: 'smoke-column', label: 'Coluna de fumaça', description: 'Fumaça densa que cresce, clareia e se desfaz ao subir.', category: 'fire', build: buildSmokeColumn },
    { id: 'explosion', label: 'Explosão', description: 'Clarão, bola de fogo, fumaça, faíscas que quicam e onda de choque no chão.', category: 'impact', build: buildExplosion },
    { id: 'sparks', label: 'Faíscas', description: 'Jatos de faíscas que caem, quicam e esfriam, como solda ou metal raspando.', category: 'impact', build: buildSparks },
    { id: 'blood-splatter', label: 'Respingo de sangue', description: 'Gotas que voam em arco e grudam no chão, com névoa fina no impacto.', category: 'impact', build: buildBloodSplatter },
    { id: 'arcane-vortex', label: 'Vórtice arcano', description: 'Espiral de partículas sugada para cima, núcleo pulsante e anel de runa no chão.', category: 'energy', build: buildArcaneVortex },
    { id: 'lightning', label: 'Relâmpago', description: 'Raio em zigue-zague que muda de forma a cada disparo, com clarão e faíscas no chão.', category: 'energy', build: buildLightning },
    { id: 'galaxy', label: 'Galáxia', description: 'Teste de escala: cerca de 390 mil partículas vivas girando em volta de um núcleo.', category: 'energy', build: buildGalaxy },
    { id: 'storm', label: 'Tempestade', description: 'Chuva inclinada, respingos no chão, neblina baixa e clarões ao longe.', category: 'weather', build: buildStorm },
    { id: 'snowfall', label: 'Nevasca', description: 'Flocos que flutuam na turbulência e pousam no chão.', category: 'weather', build: buildSnowfall },
    { id: 'fireflies', label: 'Vagalumes', description: 'Luzes que vagueiam e piscam devagar, com poeira suspensa no ar.', category: 'weather', build: buildFireflies },
];
export function findEffectTemplate(id: string): EffectTemplate | null {
    return EFFECT_TEMPLATES.find((template) => template.id === id) ?? null;
}
