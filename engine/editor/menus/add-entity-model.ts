import { Box, Camera, Circle, Cone, Cylinder, Folder, Lightbulb, Mountain, Pill, Shapes, Square, Sun, Torus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { PRIMITIVES, type PrimitiveKind } from '@/engine/editor/primitives/primitive-catalog';
import { addCamera, addGroup, addLight, addPrimitive } from '@/engine/editor/operations/entity-operations';
import { addTerrain } from '@/engine/editor/operations/terrain-operations';
export interface AddMenuEntry {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly icon: LucideIcon;
    readonly run: (session: EditorSession) => void;
}
export interface AddMenuGroup {
    readonly id: string;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly entries: readonly AddMenuEntry[];
}
export const PRIMITIVE_ICON: Record<PrimitiveKind, LucideIcon> = {
    box: Box,
    sphere: Circle,
    plane: Square,
    cylinder: Cylinder,
    cone: Cone,
    torus: Torus,
    capsule: Pill,
};
export const ADD_MENU_GROUPS: readonly AddMenuGroup[] = [
    {
        id: 'primitives',
        label: 'Primitivas',
        icon: Shapes,
        entries: PRIMITIVES.map((primitive) => ({
            id: primitive.kind,
            label: primitive.label,
            description: primitive.description,
            icon: PRIMITIVE_ICON[primitive.kind],
            run: (session) => addPrimitive(session, primitive.kind),
        })),
    },
    {
        id: 'world',
        label: 'Mundo',
        icon: Mountain,
        entries: [
            {
                id: 'terrain',
                label: 'Terreno',
                description: 'Paisagem esculpível com camadas de material PBR',
                icon: Mountain,
                run: (session) => addTerrain(session),
            },
        ],
    },
    {
        id: 'lights',
        label: 'Luzes',
        icon: Sun,
        entries: [
            { id: 'directional', label: 'Luz direcional', icon: Sun, run: (session) => addLight(session, 'directional') },
            { id: 'ambient', label: 'Luz ambiente', icon: Lightbulb, run: (session) => addLight(session, 'ambient') },
        ],
    },
    {
        id: 'misc',
        label: 'Outros',
        icon: Folder,
        entries: [
            { id: 'group', label: 'Grupo vazio', icon: Folder, run: (session) => addGroup(session) },
            { id: 'camera', label: 'Câmera', icon: Camera, run: (session) => addCamera(session) },
        ],
    },
];
