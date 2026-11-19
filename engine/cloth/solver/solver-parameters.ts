import type { ClothQuality, ClothSettings } from '@/engine/cloth/cloth-settings';
import type { ContactMaterial } from '@/engine/cloth/collision/particle-collision';
export interface ClothSolverParameters extends ContactMaterial {
    readonly substeps: number;
    readonly stretchCompliance: number;
    readonly bendCompliance: number;
    readonly dampingRate: number;
    readonly tetherSlack: number;
}
export const CLOTH_QUALITY_SUBSTEPS: Record<ClothQuality, number> = { low: 4, medium: 8, high: 16 };
const REFERENCE_SUBSTEP_SECONDS = 1 / 480;
const STRETCH_SOFTNESS_DECADES = 3;
const STRETCH_SOFTNESS_SCALE = 0.1;
const BEND_SOFTNESS_DECADES = 4;
const BEND_SOFTNESS_SCALE = 1;
const MAX_DAMPING_RATE = 4;
const MIN_TETHER_SLACK = 0.03;
const ELASTIC_TETHER_SLACK = 0.6;
function softnessOf(stiffness: number, decades: number, scale: number): number {
    return (10 ** (decades * (1 - stiffness)) - 1) * scale;
}
function complianceOf(softness: number, averageInverseMass: number): number {
    return softness * 2 * averageInverseMass * REFERENCE_SUBSTEP_SECONDS ** 2;
}
export function createSolverParameters(settings: ClothSettings, averageInverseMass: number): ClothSolverParameters {
    return {
        substeps: CLOTH_QUALITY_SUBSTEPS[settings.quality],
        stretchCompliance: complianceOf(softnessOf(settings.stretchStiffness, STRETCH_SOFTNESS_DECADES, STRETCH_SOFTNESS_SCALE), averageInverseMass),
        bendCompliance: complianceOf(softnessOf(settings.bendStiffness, BEND_SOFTNESS_DECADES, BEND_SOFTNESS_SCALE), averageInverseMass),
        dampingRate: settings.damping * MAX_DAMPING_RATE,
        tetherSlack: MIN_TETHER_SLACK + (1 - settings.stretchStiffness) * ELASTIC_TETHER_SLACK,
        thickness: settings.thickness,
        friction: settings.friction,
    };
}
