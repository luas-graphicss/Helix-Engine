'use client';
import { useEffect } from 'react';
import { Languages } from 'lucide-react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { enabledLocaleTags } from '@/engine/localization/settings/localization-settings';
import { SelectField } from '@/engine/ui/select-field';
import { localeLabel } from '../localization-labels';
const PLAYING_LABEL = 'Idioma do jogo em execução';
const STOPPED_LABEL = 'Idioma em que o jogo abre neste aparelho. Inicie o jogo para trocar o idioma em teste.';
export function GameLocaleSelect() {
    const session = useEditorSession();
    const runtime = session.scripts.localization;
    const playing = session.scripts.running && session.scripts.mode === 'play';
    const label = playing ? PLAYING_LABEL : STOPPED_LABEL;
    const options = enabledLocaleTags(session.scene.localization).map((tag) => ({ value: tag, label: localeLabel(tag) }));
    useEffect(() => (playing ? runtime.onChanged(() => session.notify('playtest')) : undefined), [playing, runtime, session]);
    return (<span title={label} className="flex w-52 min-w-0 items-center gap-1.5 text-muted-foreground">
      <Languages className="size-3.5 shrink-0" aria-hidden/>
      <SelectField label={label} options={options} value={runtime.locale} disabled={!playing} onChange={(tag) => runtime.selectLocale(tag)}/>
    </span>);
}
