import type { TranslationIssueKind } from '@/engine/localization/analysis/translation-issues';
import { localeDisplayName } from '@/engine/localization/locale/locale-names';
import type { ArgumentKind } from '@/engine/localization/message/message-arguments';
import { LOCALIZED_ASSET_KINDS, type LocalizedAssetKind } from '@/engine/localization/settings/localization-settings';
export const ASSET_KIND_LABEL: Record<LocalizedAssetKind, string> = {
    texture: 'Textura',
    audio: 'Áudio',
    video: 'Vídeo',
    font: 'Fonte',
    model: 'Modelo',
    animation: 'Animação',
    gui: 'Interface',
    vfx: 'Efeito',
    prefab: 'Prefab',
};
export const ASSET_KIND_OPTIONS = LOCALIZED_ASSET_KINDS.map((kind) => ({ value: kind, label: ASSET_KIND_LABEL[kind] }));
export const ISSUE_KIND_LABEL: Record<TranslationIssueKind, string> = {
    syntax: 'Sintaxe',
    arguments: 'Argumentos',
    plural: 'Plural',
    asset: 'Ativo removido',
    missing: 'Sem valor',
};
export const ARGUMENT_KIND_LABEL: Record<ArgumentKind, string> = {
    text: 'Texto',
    number: 'Número',
    plural: 'Quantidade que escolhe o plural',
    select: 'Opção',
    date: 'Data; vazio usa agora',
    time: 'Hora; vazio usa agora',
    list: 'Itens separados por vírgula',
};
export function localeLabel(tag: string): string {
    return `${localeDisplayName(tag)} · ${tag}`;
}
