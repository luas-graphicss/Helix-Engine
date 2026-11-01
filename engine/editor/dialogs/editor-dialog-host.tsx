'use client';
import type { ComponentType } from 'react';
import { SettingsDialog } from '@/engine/settings/ui/settings-dialog';
import { AboutDialog } from './about-dialog';
import { AutosavesDialog } from './autosaves-dialog';
import { BaseLanguageDialog } from './base-language-dialog';
import { BetaFeaturesDialog } from './beta-features-dialog';
import { BuildGameDialog } from './build/build-game-dialog';
import { editorDialogs, useEditorDialog, type EditorDialogId } from './editor-dialogs';
import { ExitDialog } from './exit-dialog';
import { GameServerDialog } from './game-server-dialog';
import { RenameProjectDialog } from './rename-project-dialog';
import { ShortcutsDialog } from './shortcuts-dialog';
type DialogComponent = ComponentType<{
    open: boolean;
    onOpenChange(open: boolean): void;
}>;
const DIALOGS: ReadonlyArray<readonly [
    EditorDialogId,
    DialogComponent
]> = [
    ['settings', SettingsDialog],
    ['shortcuts', ShortcutsDialog],
    ['autosaves', AutosavesDialog],
    ['beta', BetaFeaturesDialog],
    ['about', AboutDialog],
    ['exit', ExitDialog],
    ['renameProject', RenameProjectDialog],
    ['baseLanguage', BaseLanguageDialog],
    ['gameServer', GameServerDialog],
    ['build', BuildGameDialog],
];
function close(open: boolean): void {
    if (!open)
        editorDialogs.close();
}
export function EditorDialogHost() {
    const current = useEditorDialog();
    return (<>
      {DIALOGS.map(([id, Dialog]) => (<Dialog key={id} open={current === id} onOpenChange={close}/>))}
    </>);
}
