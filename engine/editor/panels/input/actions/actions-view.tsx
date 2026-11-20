'use client';
import { useState } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionMapsColumn } from './action-maps-column';
import { ActionsColumn, EVERY_SCHEME } from './actions-column';
import type { InputSelection } from './input-selection';
import { PropertiesColumn } from './properties-column';
export function ActionsView() {
    const asset = useEditorSession().scene.input;
    const [mapId, setMapId] = useState<string | null>(null);
    const [selection, setSelection] = useState<InputSelection>(null);
    const [schemeFilter, setSchemeFilter] = useState(EVERY_SCHEME);
    const map = asset.maps.find((candidate) => candidate.id === mapId) ?? asset.maps[0] ?? null;
    const scheme = asset.schemes.some((candidate) => candidate.id === schemeFilter) ? schemeFilter : EVERY_SCHEME;
    return (<div className="flex h-full min-h-0 flex-col @2xl/panel:flex-row">
      <ActionMapsColumn maps={asset.maps} selectedId={map?.id ?? null} onSelect={(id) => {
            setMapId(id);
            setSelection(null);
        }}/>
      <ActionsColumn asset={asset} map={map} scheme={scheme} onSchemeChange={setSchemeFilter} selection={selection} onSelect={setSelection}/>
      <PropertiesColumn asset={asset} selection={selection} newBindingSchemes={scheme === EVERY_SCHEME ? [] : [scheme]} onSelect={setSelection}/>
    </div>);
}
