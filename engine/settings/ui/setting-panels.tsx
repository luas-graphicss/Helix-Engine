'use client';
import type { ComponentType } from 'react';
import type { SettingPanelId } from '../engine-settings-schema';
import { GameLanguagePanel } from './game-language-panel';
const PANELS: Record<SettingPanelId, ComponentType> = {
    gameLanguage: GameLanguagePanel,
};
export function SettingPanel({ id }: {
    id: SettingPanelId;
}) {
    const Panel = PANELS[id];
    return <Panel />;
}
