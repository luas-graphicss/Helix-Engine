import { ENGINE_SETTINGS, ENGINE_SETTING_SECTIONS, type SettingGroup, type SettingId, type SettingSection } from '../engine-settings-schema';
export interface SettingSearchMatch {
    readonly section: SettingSection;
    readonly group: SettingGroup;
    readonly ids: readonly SettingId[];
    readonly panel: boolean;
}
function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
export function searchSettings(query: string): SettingSearchMatch[] {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return [];
    const matches: SettingSearchMatch[] = [];
    for (const section of ENGINE_SETTING_SECTIONS) {
        for (const group of section.groups) {
            const context = normalize(`${section.title} ${group.title}`);
            const ids = group.settings.filter((id) => {
                const definition = ENGINE_SETTINGS[id];
                const haystack = `${context} ${normalize(definition.label)} ${normalize(definition.description)}`;
                return words.every((word) => haystack.includes(word));
            });
            const panelHaystack = `${context} ${normalize(group.description ?? '')}`;
            const panel = group.panel !== undefined && words.every((word) => panelHaystack.includes(word));
            if (ids.length > 0 || panel)
                matches.push({ section, group, ids, panel });
        }
    }
    return matches;
}
