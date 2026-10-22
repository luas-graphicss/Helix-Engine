'use client';
import { Copy, Diamond, RotateCcw, Trash2 } from 'lucide-react';
import { ANIMATION_INTERPOLATIONS, type AnimationInterpolation } from '@/engine/core/animation/animation-document';
import { INTERPOLATION_LABELS, KEY_EASING_LABELS, KEY_EASINGS, keyIndexAt, trackAt, type KeyEasing } from '@/engine/core/animation/track-editing';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { SelectField } from '@/engine/ui/select-field';
import { COMPONENT_LABELS, PATH_LABELS, displayUnit, keyDisplayValue, rawValueFromDisplay } from '@/engine/editor/animation/ui/timeline-model';
import { useAnimationEditor } from '@/engine/editor/animation/ui/use-animation-editor';
type KeyInspectorProps = {
    selectedEvent: number;
    onSelectEvent: (index: number) => void;
};
const EASING_OPTIONS = [{ value: '' as const, label: 'Suavização…' }, ...KEY_EASINGS.map((easing) => ({ value: easing, label: KEY_EASING_LABELS[easing] }))];
const INTERPOLATION_OPTIONS = ANIMATION_INTERPOLATIONS.map((interpolation) => ({ value: interpolation, label: INTERPOLATION_LABELS[interpolation] }));
const MIXED_INTERPOLATION = [{ value: '' as const, label: 'Interpolação…' }, ...INTERPOLATION_OPTIONS];
function parseNumber(raw: string): number | null {
    const value = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}
function stopKeys(event: React.KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (event.key === 'Enter')
        event.currentTarget.blur();
}
function Label({ children }: {
    children: string;
}) {
    return <span className="shrink-0 text-[10px] text-muted-foreground">{children}</span>;
}
export function KeyInspector({ selectedEvent, onSelectEvent }: KeyInspectorProps) {
    const editor = useAnimationEditor();
    const { document } = editor;
    if (!document)
        return null;
    const event = document.events[selectedEvent];
    if (event) {
        return (<Strip>
        <Label>Evento</Label>
        <FieldInput key={`${selectedEvent}:${event.name}`} defaultValue={event.name} aria-label="Nome do evento" className="w-32 flex-none" onBlur={(e) => editor.updateEvent(selectedEvent, { name: e.currentTarget.value.trim() || event.name })} onKeyDown={stopKeys}/>
        <Label>Quadro</Label>
        <FieldInput key={`${selectedEvent}:${event.time}`} type="number" min={0} step={1} defaultValue={Math.round(event.time * editor.frameRate)} aria-label="Quadro do evento" className="w-14 flex-none" onBlur={(e) => {
                const frame = parseNumber(e.currentTarget.value);
                if (frame !== null)
                    editor.updateEvent(selectedEvent, { time: editor.snapTime(frame / editor.frameRate) });
            }} onKeyDown={stopKeys}/>
        <IconButton label="Remover evento" size="sm" onClick={() => {
                editor.removeEvent(selectedEvent);
                onSelectEvent(-1);
            }}>
          <Trash2 />
        </IconButton>
        <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onSelectEvent(-1)}>
          Concluir
        </button>
      </Strip>);
    }
    const keys = editor.selectedKeys;
    if (keys.length > 0) {
        const single = keys.length === 1 ? keys[0] : null;
        const track = single ? trackAt(document, single.joint, single.path) : undefined;
        const keyIndex = single && track ? keyIndexAt(track.times, single.time) : -1;
        const display = track && keyIndex !== -1 ? keyDisplayValue(track, keyIndex, new Float32Array(3)) : null;
        const interpolations = new Set(keys.map((ref) => trackAt(document, ref.joint, ref.path)?.interpolation).filter((value): value is AnimationInterpolation => value !== undefined));
        const interpolation = interpolations.size === 1 ? (Array.from(interpolations)[0] as AnimationInterpolation) : '';
        const earliest = Math.min(...keys.map((ref) => ref.time));
        return (<Strip>
        <Diamond className="size-3 shrink-0 text-warning" aria-hidden/>
        <span className="shrink-0 truncate text-2xs text-foreground">{single ? `${single.joint} · ${PATH_LABELS[single.path]}` : `${keys.length} chaves`}</span>
        <Label>Quadro</Label>
        <FieldInput key={`${earliest}:${keys.length}`} type="number" min={0} step={1} defaultValue={Math.round(earliest * editor.frameRate)} aria-label={single ? 'Quadro da chave' : 'Quadro da primeira chave selecionada'} className="w-14 flex-none" onBlur={(e) => {
                const frame = parseNumber(e.currentTarget.value);
                if (frame === null)
                    return;
                const delta = frame / editor.frameRate - earliest;
                if (Math.abs(delta) < 1e-6)
                    return;
                editor.beginKeyDrag();
                editor.updateKeyDrag(delta);
                editor.endKeyDrag();
            }} onKeyDown={stopKeys}/>
        {display && single && (<div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Valor (${displayUnit(single.path)})`}>
            {COMPONENT_LABELS.map((label, component) => (<FieldInput key={`${label}:${display[component]}`} axis={component === 0 ? 'x' : component === 1 ? 'y' : 'z'} type="number" step={single.path === 'rotation' ? 1 : 0.01} defaultValue={Number(display[component].toFixed(single.path === 'rotation' ? 1 : 3))} aria-label={`${label} (${displayUnit(single.path)})`} className="w-[68px] flex-none" onBlur={(e) => {
                        const value = parseNumber(e.currentTarget.value);
                        if (value === null)
                            return;
                        const next = new Float32Array(display);
                        next[component] = value;
                        editor.setKeyValue(single, rawValueFromDisplay(single.path, next));
                    }} onKeyDown={stopKeys}/>))}
          </div>)}
        <div className="w-32 flex-none">
          <SelectField<KeyEasing | ''> label="Suavização das chaves" options={EASING_OPTIONS} value="" onChange={(value) => value && editor.setSelectedEasing(value)}/>
        </div>
        <div className="w-28 flex-none">
          <SelectField<AnimationInterpolation | ''> label="Interpolação das faixas" options={interpolation ? INTERPOLATION_OPTIONS : MIXED_INTERPOLATION} value={interpolation} onChange={(value) => value && editor.setSelectedInterpolation(value)}/>
        </div>
        <IconButton label="Copiar chaves (Ctrl+C)" size="sm" onClick={() => editor.copySelectedKeys()}>
          <Copy />
        </IconButton>
        <IconButton label="Excluir chaves (Del)" size="sm" onClick={() => editor.deleteSelectedKeys()}>
          <Trash2 />
        </IconButton>
      </Strip>);
    }
    const bones = editor.selectedBones;
    if (bones.length > 0) {
        return (<Strip>
        <span className="shrink-0 truncate text-2xs text-foreground">{bones.length === 1 ? bones[0] : `${bones.length} ossos`}</span>
        <button type="button" onClick={() => editor.keyBones()} className="flex h-6 shrink-0 items-center gap-1 rounded-sm border border-border-strong px-2 text-2xs text-foreground hover:bg-highlight" title="Grava a pose atual destes ossos neste quadro">
          <Diamond className="size-3 text-warning" aria-hidden/>
          Inserir chave
          <kbd className="font-mono text-[10px] text-muted-foreground">K</kbd>
        </button>
        <button type="button" onClick={() => editor.resetBones()} className="flex h-6 shrink-0 items-center gap-1 rounded-sm border border-border-strong px-2 text-2xs text-muted-foreground hover:bg-highlight hover:text-foreground" title="Volta estes ossos à pose de repouso neste quadro">
          <RotateCcw className="size-3" aria-hidden/>
          Repouso
        </button>
        {editor.pendingCount > 0 && (<span className="shrink-0 rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
            {editor.pendingCount === 1 ? '1 pose pendente' : `${editor.pendingCount} poses pendentes`} · K para gravar
          </span>)}
        {editor.clipboard && (<button type="button" onClick={() => editor.pasteKeys()} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground" title="Cola as chaves copiadas neste quadro (Ctrl+V)">
            Colar {editor.clipboard.entries.length} {editor.clipboard.entries.length === 1 ? 'chave' : 'chaves'}
          </button>)}
      </Strip>);
    }
    return (<Strip>
      <span className="truncate text-[10px] text-muted-foreground">Selecione um osso no viewport ou na lista. Gire com o gizmo ou arraste mãos e pés (IK): com a gravação automática, cada pose vira chave.</span>
    </Strip>);
}
function Strip({ children }: {
    children: React.ReactNode;
}) {
    return <div className="flex h-7 shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-surface px-2 [scrollbar-width:none]">{children}</div>;
}
