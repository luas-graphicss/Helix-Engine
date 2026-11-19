'use client';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SelectField } from '@/engine/ui/select-field';
export function NavAreaSelect({ label, value, excluded, onChange }: {
    label: string;
    value: number;
    excluded?: number;
    onChange: (area: number) => void;
}) {
    const session = useEditorSession();
    const options = session.scene.navigation.areas.map((area, index) => ({ value: index, label: area.name })).filter((option) => option.value !== excluded);
    return <SelectField label={label} options={options} value={value} onChange={onChange}/>;
}
