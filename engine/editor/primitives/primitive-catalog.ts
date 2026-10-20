import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createBox, createCapsule, createCone, createCylinder, createPlane, createSphere, createTorus, } from '@/engine/renderer/geometry/primitives';
export type PrimitiveKind = 'box' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'torus' | 'capsule';
export interface PrimitiveDefinition {
    readonly kind: PrimitiveKind;
    readonly label: string;
    readonly description: string;
    readonly create: () => MeshData;
}
export const PRIMITIVES: readonly PrimitiveDefinition[] = [
    { kind: 'box', label: 'Cubo', description: 'Caixa de 1 × 1 × 1', create: () => createBox(1, 1, 1) },
    { kind: 'sphere', label: 'Esfera', description: 'Esfera UV de raio 0,5', create: () => createSphere(0.5, 32, 16) },
    { kind: 'plane', label: 'Plano', description: 'Plano de 2 × 2 voltado para cima', create: () => createPlane(2, 2, 1) },
    { kind: 'cylinder', label: 'Cilindro', description: 'Raio 0,5 e altura 1', create: () => createCylinder(0.5, 1, 32) },
    { kind: 'cone', label: 'Cone', description: 'Raio 0,5 e altura 1', create: () => createCone(0.5, 1, 32) },
    { kind: 'torus', label: 'Toro', description: 'Anel de raio 0,5 e seção 0,2', create: () => createTorus(0.5, 0.2, 48, 24) },
    { kind: 'capsule', label: 'Cápsula', description: 'Raio 0,25 e altura total 1', create: () => createCapsule(0.25, 0.5, 32, 8) },
];
export function getPrimitive(kind: PrimitiveKind): PrimitiveDefinition {
    const definition = PRIMITIVES.find((primitive) => primitive.kind === kind);
    if (!definition)
        throw new Error(`Primitiva desconhecida: ${kind}`);
    return definition;
}
