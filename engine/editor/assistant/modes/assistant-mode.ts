import type { ToolAccess } from '@/engine/editor/assistant/tools/assistant-tool';
export type ToolPermission = 'allow' | 'ask' | 'deny';
export const ASSISTANT_MODE_IDS = ['autonomous', 'assisted', 'limited', 'readOnly'] as const;
export type AssistantModeId = (typeof ASSISTANT_MODE_IDS)[number];
export interface AssistantMode {
    readonly id: AssistantModeId;
    readonly label: string;
    readonly description: string;
    readonly permissions: Readonly<Record<ToolAccess, ToolPermission>>;
}
export const ASSISTANT_MODES: readonly AssistantMode[] = [
    {
        id: 'autonomous',
        label: 'Autônoma',
        description: 'Faz tudo sem pedir: cena, código, exclusões e playtest.',
        permissions: { read: 'allow', scene: 'allow', code: 'allow', destructive: 'allow', run: 'allow' },
    },
    {
        id: 'assisted',
        label: 'Com aprovação',
        description: 'Pode tudo, mas pede sua confirmação antes de cada alteração.',
        permissions: { read: 'allow', scene: 'ask', code: 'ask', destructive: 'ask', run: 'ask' },
    },
    {
        id: 'limited',
        label: 'Limitada',
        description: 'Monta cena, terreno e interface. Não escreve código, não exclui e não inicia o jogo.',
        permissions: { read: 'allow', scene: 'allow', code: 'deny', destructive: 'deny', run: 'deny' },
    },
    {
        id: 'readOnly',
        label: 'Somente leitura',
        description: 'Lê o projeto e responde. Não altera nada.',
        permissions: { read: 'allow', scene: 'deny', code: 'deny', destructive: 'deny', run: 'deny' },
    },
];
export const DEFAULT_MODE_ID: AssistantModeId = 'assisted';
export function isAssistantModeId(value: unknown): value is AssistantModeId {
    return ASSISTANT_MODE_IDS.some((id) => id === value);
}
export function findAssistantMode(id: AssistantModeId): AssistantMode {
    return ASSISTANT_MODES.find((mode) => mode.id === id) ?? ASSISTANT_MODES[0];
}
