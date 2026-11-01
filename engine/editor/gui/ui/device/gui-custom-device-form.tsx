'use client';
import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { clampCustomDevice, GUI_CUSTOM_DEVICE_LIMITS, type GuiCustomDevice } from '@/engine/gui/devices/device-model';
import { ActionButton } from '@/engine/ui/action-button';
import { FieldInput } from '@/engine/ui/field-input';
interface GuiCustomDeviceFormProps {
    readonly value: GuiCustomDevice;
    readonly onApply: (custom: GuiCustomDevice) => void;
}
const { minSize, maxSize, minDpr, maxDpr } = GUI_CUSTOM_DEVICE_LIMITS;
export function GuiCustomDeviceForm({ value, onApply }: GuiCustomDeviceFormProps) {
    const [width, setWidth] = useState(String(value.width));
    const [height, setHeight] = useState(String(value.height));
    const [dpr, setDpr] = useState(String(value.dpr));
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onApply(clampCustomDevice({ width: Number(width), height: Number(height), dpr: Number(dpr.replace(',', '.')) }));
    };
    return (<form onSubmit={submit} className="flex flex-col gap-1.5 px-1.5 pt-1 pb-2">
      <div className="grid grid-cols-[1fr_auto_1fr_4.5rem] items-center gap-1">
        <FieldInput axis="x" aria-label="Largura do viewport" inputMode="numeric" value={width} onChange={(event) => setWidth(event.currentTarget.value)}/>
        <span className="text-2xs text-muted-foreground" aria-hidden>
          ×
        </span>
        <FieldInput axis="y" aria-label="Altura do viewport" inputMode="numeric" value={height} onChange={(event) => setHeight(event.currentTarget.value)}/>
        <FieldInput aria-label="Densidade de pixels (DPR)" inputMode="decimal" value={dpr} onChange={(event) => setDpr(event.currentTarget.value)}/>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-3xs text-muted-foreground">
          largura × altura em px lógicos ({minSize}–{maxSize}) · densidade {minDpr}–{maxDpr}×
        </span>
        <ActionButton type="submit" variant="primary" icon={Check} className="flex-none">
          Aplicar
        </ActionButton>
      </div>
    </form>);
}
