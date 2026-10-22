import type { Vec3 } from '@/engine/core/math/vec3';
import { createShapeFromSettings, type RigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { shapeVolume } from '@/engine/physics/shapes/collider-shape';
export interface PhysicalProperties {
    density: number;
    friction: number;
    restitution: number;
    linearDamping: number;
}
export interface PhysicalPreset {
    readonly id: string;
    readonly label: string;
    readonly properties: PhysicalProperties;
}
export const PHYSICAL_PRESETS: readonly PhysicalPreset[] = [
    { id: 'generic', label: 'Genérico', properties: { density: 1000, friction: 0.6, restitution: 0, linearDamping: 0 } },
    { id: 'wood', label: 'Madeira', properties: { density: 650, friction: 0.5, restitution: 0.15, linearDamping: 0 } },
    { id: 'stone', label: 'Pedra', properties: { density: 2400, friction: 0.75, restitution: 0.05, linearDamping: 0 } },
    { id: 'concrete', label: 'Concreto', properties: { density: 2300, friction: 0.8, restitution: 0.02, linearDamping: 0 } },
    { id: 'brick', label: 'Tijolo', properties: { density: 1900, friction: 0.7, restitution: 0.05, linearDamping: 0 } },
    { id: 'metal', label: 'Metal', properties: { density: 7800, friction: 0.4, restitution: 0.2, linearDamping: 0 } },
    { id: 'aluminum', label: 'Alumínio', properties: { density: 2700, friction: 0.45, restitution: 0.2, linearDamping: 0 } },
    { id: 'glass', label: 'Vidro', properties: { density: 2500, friction: 0.35, restitution: 0.3, linearDamping: 0 } },
    { id: 'plastic', label: 'Plástico', properties: { density: 950, friction: 0.4, restitution: 0.35, linearDamping: 0 } },
    { id: 'rubber', label: 'Borracha', properties: { density: 1100, friction: 0.95, restitution: 0.75, linearDamping: 0 } },
    { id: 'ice', label: 'Gelo', properties: { density: 920, friction: 0.04, restitution: 0.05, linearDamping: 0 } },
    { id: 'fabric', label: 'Tecido', properties: { density: 300, friction: 0.8, restitution: 0, linearDamping: 0.5 } },
    { id: 'foam', label: 'Espuma', properties: { density: 60, friction: 0.7, restitution: 0.4, linearDamping: 1.5 } },
    { id: 'sand', label: 'Areia', properties: { density: 1600, friction: 0.9, restitution: 0, linearDamping: 0 } },
];
const PRESET_TOLERANCE = 1e-3;
export function createPhysicalProperties(overrides: Partial<PhysicalProperties> = {}): PhysicalProperties {
    return { ...PHYSICAL_PRESETS[0].properties, ...overrides };
}
export function clonePhysicalProperties(properties: PhysicalProperties): PhysicalProperties {
    return { ...properties };
}
export function matchPhysicalPreset(properties: PhysicalProperties): string | null {
    const near = (a: number, b: number) => Math.abs(a - b) <= PRESET_TOLERANCE * Math.max(1, Math.abs(b));
    const match = PHYSICAL_PRESETS.find(({ properties: p }) => near(p.density, properties.density) && near(p.friction, properties.friction) && near(p.restitution, properties.restitution) && near(p.linearDamping, properties.linearDamping));
    return match?.id ?? null;
}
export function colliderVolume(settings: RigidBodySettings, scale: Vec3): number {
    return shapeVolume(createShapeFromSettings(settings, scale));
}
export function massForMaterial(properties: PhysicalProperties, settings: RigidBodySettings, scale: Vec3): number {
    return Math.max(Number((properties.density * colliderVolume(settings, scale)).toFixed(2)), 0.01);
}
export function applyPhysicalProperties(out: RigidBodySettings, properties: PhysicalProperties, scale: Vec3): RigidBodySettings {
    out.mass = massForMaterial(properties, out, scale);
    out.friction = properties.friction;
    out.restitution = properties.restitution;
    out.linearDamping = properties.linearDamping;
    return out;
}
export function formatDensity(density: number): string {
    return `${Math.round(density).toLocaleString('pt-BR')} kg/m³`;
}
export function formatMass(kg: number): string {
    if (kg >= 1000)
        return `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`;
    if (kg >= 1)
        return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
    return `${Math.round(kg * 1000)} g`;
}
