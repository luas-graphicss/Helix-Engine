import { canonicalLocaleTag } from '@/engine/localization/locale/locale-tag';
import { findLocale, type LocalizationSettings } from '@/engine/localization/settings/localization-settings';
export function localeCodeProblem(settings: LocalizationSettings, code: string): string | null {
    const tag = canonicalLocaleTag(code);
    if (tag === null)
        return 'Código de idioma inválido. Use o formato pt-BR, es-AR ou zh-Hant.';
    return findLocale(settings, tag) ? `${tag} já está no projeto.` : null;
}
