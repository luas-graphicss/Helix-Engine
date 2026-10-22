import { Box, Camera, Circle, Cone, Cylinder, Diff, Folder, Lightbulb, Mountain, PersonStanding, Pill, Shapes, Square, Sun, Torus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { PRIMITIVES, type PrimitiveKind } from '@/engine/editor/primitives/primitive-catalog';
import { addCamera, addGroup, addLight, addPrimitive } from '@/engine/editor/operations/entity-operations';
import { addCharacter } from '@/engine/editor/operations/character-operations';
import { addTerrain } from '@/engine/editor/operations/terrain-operations';
import { addCsgBrushToSelection } from '@/engine/editor/operations/csg-operations';
import { CSG_SHAPE_LABEL, type CsgBrushShape } from '@/engine/geometry/csg/csg-settings';
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
const CSG_BRUSH_SHAPES: readonly CsgBrushShape[] = ['box', 'cylinder', 'sphere', 'capsule', 'cone', 'torus'];
const CSG_BRUSH_DESCRIPTION: Record<CsgBrushShape, string> = {
    box: 'Subtrai uma caixa do ator selecionado: portas, janelas e recortes retos',
    cylinder: 'Subtrai um cilindro: furos redondos e túneis',
    sphere: 'Subtrai uma esfera: cavidades e crateras',
    capsule: 'Subtrai uma cápsula: ranhuras arredondadas',
    cone: 'Subtrai um cone: furos escareados',
    torus: 'Subtrai um toro: canais em anel',
};
const CSG_BRUSH_ENTRIES: readonly AddMenuEntry[] = CSG_BRUSH_SHAPES.map((shape) => ({
    id: `csg-${shape}`,
    label: `Pincel: ${CSG_SHAPE_LABEL[shape].toLowerCase()}`,
    description: CSG_BRUSH_DESCRIPTION[shape],
    icon: PRIMITIVE_ICON[shape],
    run: (session) => {
        addCsgBrushToSelection(session, shape);
    },
}));
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
        id: 'csg',
        label: 'CSG',
        icon: Diff,
        entries: CSG_BRUSH_ENTRIES,
    },
    {
        id: 'characters',
        label: 'Personagens',
        icon: PersonStanding,
        entries: [
            {
                id: 'mannequin',
                label: 'Manequim',
                description: 'Personagem jogável padrão: cápsula cinemática com rig animado',
                icon: PersonStanding,
                run: (session) => addCharacter(session),
            },
        ],
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
