'use client';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { MAX_CAMERA_OVERLAYS, type CameraSettings } from '@/engine/camera/camera-settings';
import { overlayCandidates } from '@/engine/camera/stack/camera-frame-plan';
import { addCameraOverlay, moveCameraOverlay, removeCameraOverlay } from '@/engine/editor/operations/camera-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { CAMERA_HINT_CLASS } from './camera-field-styles';
const NO_CAMERA = 0;
function overlayStatus(overlay: Entity | null): string | null {
    if (!overlay)
        return 'removida';
    if (overlay.camera?.role !== 'overlay')
        return 'não é sobreposição';
    if (!overlay.camera.enabled || !overlay.visible)
        return 'inativa';
    return null;
}
export function CameraStackSection({ entity, settings }: {
    entity: Entity;
    settings: CameraSettings;
}) {
    const session = useEditorSession();
    if (settings.role !== 'base' || settings.target !== 'screen')
        return null;
    const { overlays } = settings;
    const candidates = overlayCandidates(session.scene, entity);
    const options = [{ value: NO_CAMERA, label: 'Escolher sobreposição…' }, ...candidates.map((candidate) => ({ value: candidate.id, label: candidate.name }))];
    const full = overlays.length >= MAX_CAMERA_OVERLAYS;
    return (<CollapsibleSection title="Empilhamento" defaultOpen={overlays.length > 0}>
      <p className={CAMERA_HINT_CLASS}>
        Sobreposições desenham por cima desta câmera, na ordem da lista, cada uma só com as camadas da própria máscara: arma em primeira
        pessoa, marcadores, objetos de interface.
      </p>
      {overlays.length > 0 && (<ol className="flex flex-col gap-px px-2 pb-1">
          {overlays.map((id, index) => {
              const overlay = session.scene.findById(id);
              const status = overlayStatus(overlay);
              const name = overlay?.name ?? `Câmera ${id}`;
              return (<li key={id} className="flex h-control items-center gap-1 rounded-sm bg-surface-sunken pr-0.5 pl-1.5 shadow-well">
                <span className="w-3 shrink-0 font-mono text-3xs text-muted-foreground tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground">{name}</span>
                {status && <span className="shrink-0 font-mono text-3xs text-warning">{status}</span>}
                <IconButton label={`Subir ${name} na pilha`} size="xs" disabled={index === 0} onClick={() => moveCameraOverlay(session, entity, id, -1)}>
                  <ArrowUp />
                </IconButton>
                <IconButton label={`Descer ${name} na pilha`} size="xs" disabled={index === overlays.length - 1} onClick={() => moveCameraOverlay(session, entity, id, 1)}>
                  <ArrowDown />
                </IconButton>
                <IconButton label={`Remover ${name} da pilha`} size="xs" className="hover:text-destructive" onClick={() => removeCameraOverlay(session, entity, id)}>
                  <X />
                </IconButton>
              </li>);
          })}
        </ol>)}
      {full ? (<p className={CAMERA_HINT_CLASS}>A pilha chegou ao limite de {MAX_CAMERA_OVERLAYS} sobreposições.</p>) : candidates.length > 0 ? (<PropertyRow label="Adicionar">
          <SelectField label="Adicionar sobreposição à pilha" options={options} value={NO_CAMERA} onChange={(id) => {
              const overlay = candidates.find((candidate) => candidate.id === id);
              if (overlay)
                  addCameraOverlay(session, entity, overlay);
          }}/>
        </PropertyRow>) : (<p className={CAMERA_HINT_CLASS}>Nenhuma câmera de sobreposição livre na cena. Crie uma em Adicionar › Câmeras.</p>)}
    </CollapsibleSection>);
}
