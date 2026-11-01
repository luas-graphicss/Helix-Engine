import { Box, Camera, Circle, Cone, Cylinder, Diff, FileCode2, Folder, LayoutTemplate, Lightbulb, Mountain, Orbit, PersonStanding, Pill, Radio, Shapes, Sparkles, Square, SquareTerminal, Tag, Torus, Tv, Video, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { PRIMITIVES, type PrimitiveKind } from '@/engine/editor/primitives/primitive-catalog';
import { addCamera, addGroup, addLight, addPrimitive } from '@/engine/editor/operations/entity-operations';
import { addCharacter } from '@/engine/editor/operations/character-operations';
import { addTerrain } from '@/engine/editor/operations/terrain-operations';
import { addCsgBrushToSelection } from '@/engine/editor/operations/csg-operations';
import { addAudioZone, addSoundSource } from '@/engine/editor/operations/audio-world-operations';
import { addGuiSurfaceActor } from '@/engine/editor/operations/gui-surface-operations';
import { createVfxEffect } from '@/engine/editor/operations/vfx-operations';
import { addVfxActor } from '@/engine/editor/operations/vfx-world-operations';
import { addScriptActor, createScript } from '@/engine/editor/operations/script-operations';
import { SCRIPT_TEMPLATES } from '@/engine/scripting/script-templates';
import { GUI_SURFACE_PRESETS } from '@/engine/gui/world/gui-surface-settings';
import { VFX_TEMPLATE_CATEGORY_LABEL, VFX_TEMPLATES } from '@/engine/vfx/document/vfx-templates';
import { CSG_SHAPE_LABEL, type CsgBrushShape } from '@/engine/geometry/csg/csg-settings';
import { LOCAL_LIGHT_LABEL, LOCAL_LIGHT_TYPES } from '@/engine/core/scene/light';
import { LIGHT_ICON, LOCAL_LIGHT_DESCRIPTION } from '@/engine/editor/lights/light-icons';
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
const GUI_PRESET_ICON: Record<string, LucideIcon> = {
    'screen-panel': LayoutTemplate,
    tv: Tv,
    poster: Square,
    hologram: Sparkles,
    nameplate: Tag,
    monitor: Video,
    showcase: Orbit,
    kiosk: SquareTerminal,
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
export const LIGHT_ADD_GROUP: AddMenuGroup = {
    id: 'lights',
    label: 'Luzes',
    icon: Lightbulb,
    entries: [
        ...LOCAL_LIGHT_TYPES.map((type): AddMenuEntry => ({
            id: `light-${type}`,
            label: LOCAL_LIGHT_LABEL[type],
            description: LOCAL_LIGHT_DESCRIPTION[type],
            icon: LIGHT_ICON[type],
            run: (session) => addLight(session, type),
        })),
        { id: 'directional', label: 'Luz direcional', description: 'O sol: direção vem da rotação, sombras em cascata', icon: LIGHT_ICON.directional, run: (session) => addLight(session, 'directional') },
        { id: 'ambient', label: 'Luz ambiente', description: 'Hemisfério céu/chão, sem direção nem sombra', icon: LIGHT_ICON.ambient, run: (session) => addLight(session, 'ambient') },
    ],
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
    LIGHT_ADD_GROUP,
    {
        id: 'sound',
        label: 'Som',
        icon: Volume2,
        entries: [
            {
                id: 'sound-source',
                label: 'Fonte de som',
                description: 'Toca um áudio da biblioteca a partir de um ponto do mundo: distância, cone, oclusão, Doppler',
                icon: Volume2,
                run: (session) => addSoundSource(session),
            },
            {
                id: 'audio-zone',
                label: 'Zona acústica',
                description: 'Lugar com reverberação, eco, filtro e cama ambiente onde o ouvinte estiver dentro',
                icon: Radio,
                run: (session) => addAudioZone(session),
            },
        ],
    },
    {
        id: 'gui',
        label: 'Interface',
        icon: LayoutTemplate,
        entries: GUI_SURFACE_PRESETS.map((preset) => ({
            id: `gui-${preset.id}`,
            label: preset.label,
            description: preset.description,
            icon: GUI_PRESET_ICON[preset.id] ?? LayoutTemplate,
            run: (session) => {
                addGuiSurfaceActor(session, { presetId: preset.id });
            },
        })),
    },
    {
        id: 'vfx',
        label: 'Efeitos',
        icon: Sparkles,
        entries: [
            {
                id: 'vfx-actor',
                label: 'Ator de efeito',
                description: 'Toca um efeito já guardado na biblioteca a partir de um ponto do mundo (o aberto no editor, ou o primeiro)',
                icon: Sparkles,
                run: (session) => {
                    addVfxActor(session);
                },
            },
            ...VFX_TEMPLATES.map((template): AddMenuEntry => ({
                id: `vfx-${template.id}`,
                label: template.label,
                description: `${VFX_TEMPLATE_CATEGORY_LABEL[template.category]}: ${template.description.charAt(0).toLowerCase()}${template.description.slice(1)}. Cria o efeito na biblioteca, num ator novo, e o abre no editor`,
                icon: Sparkles,
                run: (session) => {
                    void createVfxEffect(session, template.id);
                },
            })),
        ],
    },
    {
        id: 'script',
        label: 'Scripts',
        icon: FileCode2,
        entries: [
            {
                id: 'script-actor',
                label: 'Ator de script',
                description: 'Um script da biblioteca anexado ao ator selecionado (ou ao mundo, sem seleção): o aberto no editor, ou o primeiro',
                icon: FileCode2,
                run: (session) => {
                    addScriptActor(session);
                },
            },
            ...SCRIPT_TEMPLATES.map((template): AddMenuEntry => ({
                id: `script-${template.id}`,
                label: template.label,
                description: `${template.description} Cria o script na linguagem base do jogo, anexado ao ator selecionado, e o abre no editor`,
                icon: FileCode2,
                run: (session) => void createScript(session, { templateId: template.id }),
            })),
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
