'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { SelectField } from '@/engine/ui/select-field';
import type { CharacterModelAsset } from '@/engine/character/assets/character-model-asset';
import { listCharacterModels, subscribeCharacterModels } from '@/engine/character/assets/character-model-registry';
import { loadMannequinAsset } from '@/engine/character/assets/mannequin-asset';
export function useCharacterModels(): readonly CharacterModelAsset[] {
    const models = useSyncExternalStore(subscribeCharacterModels, listCharacterModels, listCharacterModels);
    useEffect(() => {
        loadMannequinAsset().catch(() => undefined);
    }, []);
    return models;
}
interface CharacterModelSelectProps {
    value: string;
    disabled?: boolean;
    onChange: (modelId: string) => void;
}
export function CharacterModelSelect({ value, disabled, onChange }: CharacterModelSelectProps) {
    const models = useCharacterModels();
    const options = models.map((model) => ({ value: model.id, label: model.label }));
    if (!options.some((option) => option.value === value))
        options.push({ value, label: 'Modelo ausente (reimportar)' });
    return <SelectField label="Modelo do personagem" options={options} value={value} disabled={disabled} onChange={onChange}/>;
}
