import { ENGINE_SETTINGS, type SettingId, type SettingValue } from '@/engine/settings/engine-settings-schema';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import type { CodeViewOptions } from './code-editor';
const LINE_HEIGHT_RATIO: Record<SettingValue<'code.lineHeight'>, number> = { compact: 1.35, normal: 1.55, relaxed: 1.8 };
const FONT_SIZE_STEPS: readonly number[] = [10, 11, 12, 13, 14, 15, 16, 18, 20];
export type CodeToggleKey = Exclude<keyof CodeViewOptions, 'fontSize' | 'lineHeight'>;
const TOGGLE_SETTING: Record<CodeToggleKey, SettingId> = {
    lineNumbers: 'code.lineNumbers',
    wordWrap: 'code.wordWrap',
    minimap: 'code.minimap',
    whitespace: 'code.whitespace',
    highlightLine: 'code.highlightLine',
    indentGuides: 'code.indentGuides',
    folding: 'code.folding',
    cursorBlink: 'code.cursorBlink',
    autoSuggest: 'code.autoSuggest',
    autoCloseBrackets: 'code.autoCloseBrackets',
    selectionMatches: 'code.selectionMatches',
    previewTabs: 'code.previewTabs',
    statusStrip: 'code.statusStrip',
};
export function codeViewOptionsFromSettings(): CodeViewOptions {
    const get = engineSettings.get.bind(engineSettings);
    return {
        lineNumbers: get('code.lineNumbers'),
        wordWrap: get('code.wordWrap'),
        minimap: get('code.minimap'),
        whitespace: get('code.whitespace'),
        highlightLine: get('code.highlightLine'),
        indentGuides: get('code.indentGuides'),
        folding: get('code.folding'),
        cursorBlink: get('code.cursorBlink'),
        autoSuggest: get('code.autoSuggest'),
        autoCloseBrackets: get('code.autoCloseBrackets'),
        selectionMatches: get('code.selectionMatches'),
        previewTabs: get('code.previewTabs'),
        statusStrip: get('code.statusStrip'),
        fontSize: get('code.fontSize'),
        lineHeight: LINE_HEIGHT_RATIO[get('code.lineHeight')],
    };
}
export function toggleCodeOption(key: CodeToggleKey): void {
    const id = TOGGLE_SETTING[key];
    engineSettings.set(id, !engineSettings.get(id));
}
export function stepCodeFontSize(direction: 1 | -1): void {
    const current = engineSettings.get('code.fontSize');
    const next = direction > 0 ? FONT_SIZE_STEPS.find((size) => size > current) : [...FONT_SIZE_STEPS].reverse().find((size) => size < current);
    if (next !== undefined)
        engineSettings.set('code.fontSize', next);
}
export function resetCodeFontSize(): void {
    engineSettings.reset('code.fontSize');
}
export const CODE_FONT_SIZE_MIN = ENGINE_SETTINGS['code.fontSize'].min;
export const CODE_FONT_SIZE_MAX = ENGINE_SETTINGS['code.fontSize'].max;
export const CODE_FONT_SIZE_DEFAULT = ENGINE_SETTINGS['code.fontSize'].default;
