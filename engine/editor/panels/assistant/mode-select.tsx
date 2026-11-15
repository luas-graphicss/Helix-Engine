'use client';
import { ASSISTANT_MODES, findAssistantMode, type AssistantModeId } from '@/engine/editor/assistant/modes/assistant-mode';
import { SelectField } from '@/engine/ui/select-field';
const MODE_OPTIONS = ASSISTANT_MODES.map((mode) => ({ value: mode.id, label: mode.label }));
type ModeSelectProps = {
    modeId: AssistantModeId;
    onChange: (modeId: AssistantModeId) => void;
};
export function ModeSelect({ modeId, onChange }: ModeSelectProps) {
    return (<div className="flex w-36 min-w-0" title={findAssistantMode(modeId).description}>
      <SelectField label="Modo do assistente" options={MODE_OPTIONS} value={modeId} onChange={onChange}/>
    </div>);
}
