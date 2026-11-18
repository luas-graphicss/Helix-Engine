'use client';
import { Magnet } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { SnapSettingsMenu } from '@/engine/editor/chrome/snap-settings-menu';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useShortcutLabel } from '@/engine/editor/shortcuts/shortcut-bindings';
import { toolHonorsSpace } from '@/engine/editor/transform/gizmo/gizmo-layout';
import type { PivotMode, TransformSpace } from '@/engine/editor/transform/transform-settings';
import { HUD_GROUP_CLASS } from '../hud-styles';
import { HudSegmented, type HudSegmentedOption } from './hud-segmented';
const PIVOT_OPTIONS: readonly HudSegmentedOption<PivotMode>[] = [
    { value: 'pivot', label: 'Pivô', hint: 'Gizmo na origem do ator ativo: cada ator gira e escala em torno de si' },
    { value: 'center', label: 'Centro', hint: 'Gizmo no centro da seleção: os atores giram e escalam em torno dele' },
];
const SPACE_OPTIONS: readonly HudSegmentedOption<TransformSpace>[] = [
    { value: 'global', label: 'Global', hint: 'Eixos do mundo' },
    { value: 'local', label: 'Local', hint: 'Eixos do ator ativo' },
];
export function TransformOptions() {
    const session = useSessionTopic('tool', 'playtest');
    const pivotShortcut = useShortcutLabel('transform.togglePivot');
    const spaceShortcut = useShortcutLabel('transform.toggleSpace');
    const tool = session.gizmoMode;
    if (!tool || session.playtest.isPossessing)
        return null;
    return (<>
      <HudSegmented label="Posição do gizmo" options={PIVOT_OPTIONS} value={session.pivotMode} toggleShortcut={pivotShortcut} onChange={(mode) => session.setPivotMode(mode)}/>
      {toolHonorsSpace(tool) && (<HudSegmented label="Eixos do gizmo" options={SPACE_OPTIONS} value={session.space} toggleShortcut={spaceShortcut} onChange={(space) => session.setSpace(space)}/>)}
      <div className={HUD_GROUP_CLASS}>
        <IconButton label="Encaixe (segure Ctrl para inverter)" size="sm" active={session.snap.enabled} onClick={() => session.toggleSnap()}>
          <Magnet />
        </IconButton>
        <SnapSettingsMenu />
      </div>
    </>);
}
