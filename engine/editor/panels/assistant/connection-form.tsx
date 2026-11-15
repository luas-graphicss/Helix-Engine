'use client';
import { useId, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PROTOCOL_IDS, PROTOCOL_LABEL, REASONING_EFFORTS, type ReasoningEffort } from '@/engine/editor/assistant/providers/chat-protocol';
import { activeProfile, type ConnectionSettings } from '@/engine/editor/assistant/providers/connection-settings';
import type { ConnectionStore } from '@/engine/editor/assistant/providers/connection-store';
import { CUSTOM_PROVIDER_ID, findProviderPreset, PROVIDER_PRESETS } from '@/engine/editor/assistant/providers/provider-catalog';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
const MODEL_LIST_TIMEOUT_MS = 20000;
const PRIVACY_NOTE = 'A chave sai do navegador só para o provedor escolhido.';
const PROVIDER_OPTIONS = PROVIDER_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));
const PROTOCOL_OPTIONS = PROTOCOL_IDS.map((id) => ({ value: id, label: PROTOCOL_LABEL[id] }));
const REASONING_LABEL: Record<ReasoningEffort, string> = {
    auto: 'Automático',
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
};
const REASONING_OPTIONS = REASONING_EFFORTS.map((effort) => ({ value: effort, label: REASONING_LABEL[effort] }));
type ModelListing = {
    status: 'idle' | 'loading';
} | {
    status: 'ready';
    models: readonly string[];
} | {
    status: 'failed';
    message: string;
};
type ConnectionFormProps = {
    connection: ConnectionStore;
    settings: ConnectionSettings;
};
function describeListingFailure(cause: unknown): string {
    if (cause instanceof DOMException && cause.name === 'TimeoutError')
        return 'O provedor demorou demais para listar os modelos.';
    return cause instanceof Error ? cause.message : String(cause);
}
function describeListing(listing: ModelListing): string {
    switch (listing.status) {
        case 'idle':
            return PRIVACY_NOTE;
        case 'loading':
            return 'Buscando modelos…';
        case 'ready':
            return listing.models.length === 0 ? 'O provedor não listou modelos. Digite o id do modelo.' : `${listing.models.length} modelos disponíveis no campo Modelo.`;
        case 'failed':
            return listing.message;
    }
}
export function ConnectionForm({ connection, settings }: ConnectionFormProps) {
    const [listing, setListing] = useState<ModelListing>({ status: 'idle' });
    const modelListId = useId();
    const profile = activeProfile(settings);
    const preset = findProviderPreset(settings.providerId);
    const loadModels = async () => {
        setListing({ status: 'loading' });
        try {
            const models = await connection.protocol.listModels(connection.endpoint, AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS));
            setListing({ status: 'ready', models });
        }
        catch (cause) {
            setListing({ status: 'failed', message: describeListingFailure(cause) });
        }
    };
    return (<section aria-label="Conexão com o modelo" className="flex max-h-[60%] shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-border bg-surface-sunken/40 py-1.5">
      <PropertyRow label="Provedor">
        <SelectField label="Provedor" options={PROVIDER_OPTIONS} value={settings.providerId} onChange={(providerId) => connection.selectProvider(providerId)}/>
      </PropertyRow>
      {settings.providerId === CUSTOM_PROVIDER_ID && (<PropertyRow label="Protocolo" hint="Formato de API que o endpoint aceita">
          <SelectField label="Protocolo" options={PROTOCOL_OPTIONS} value={profile.protocol} onChange={(protocol) => connection.updateProfile({ protocol })}/>
        </PropertyRow>)}
      <PropertyRow label="URL base">
        <FieldInput aria-label="URL base" value={profile.baseUrl} placeholder="https://exemplo.com/v1" spellCheck={false} autoComplete="off" onChange={(event) => connection.updateProfile({ baseUrl: event.currentTarget.value })}/>
      </PropertyRow>
      <PropertyRow label="Chave de API">
        <FieldInput aria-label="Chave de API" type="password" value={profile.apiKey} placeholder={preset.keyRequired ? 'Cole a chave' : 'Opcional'} spellCheck={false} autoComplete="off" onChange={(event) => connection.updateProfile({ apiKey: event.currentTarget.value })}/>
      </PropertyRow>
      <PropertyRow label="Modelo" hint="Id do modelo no provedor">
        <FieldInput aria-label="Modelo" list={modelListId} value={profile.model} placeholder="Id do modelo" spellCheck={false} autoComplete="off" onChange={(event) => connection.updateProfile({ model: event.currentTarget.value })}/>
        <IconButton label="Listar modelos do provedor" size="sm" disabled={listing.status === 'loading'} onClick={() => void loadModels()}>
          <RefreshCw />
        </IconButton>
      </PropertyRow>
      <PropertyRow label="Raciocínio" hint="Quanto o modelo pensa antes de responder. Nem todo modelo aceita um nível fixo.">
        <SelectField label="Raciocínio" options={REASONING_OPTIONS} value={profile.reasoningEffort} onChange={(reasoningEffort) => connection.updateProfile({ reasoningEffort })}/>
      </PropertyRow>
      <datalist id={modelListId}>{listing.status === 'ready' && listing.models.map((model) => <option key={model} value={model}/>)}</datalist>
      <ToggleField label="Guardar chave" hint="Guarda a chave neste navegador. Desligado, ela vale só até fechar o editor." on={settings.rememberKeys} onToggle={() => connection.setRememberKeys(!settings.rememberKeys)}/>
      <p role="status" className={listing.status === 'failed' ? 'px-2 pt-0.5 text-3xs text-destructive' : 'px-2 pt-0.5 text-3xs text-muted-foreground'}>
        {describeListing(listing)}
      </p>
    </section>);
}
