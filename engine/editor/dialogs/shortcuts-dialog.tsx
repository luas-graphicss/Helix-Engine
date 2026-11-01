'use client';
import { useEffect, useMemo, useState } from 'react';
import { MousePointer2, RotateCcw, SearchX, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { plural } from '@/engine/core/format/format-time';
import { matchesAllWords, normalizeSearchText, searchWords } from '@/engine/core/format/search-text';
import { formatChord } from '@/engine/editor/shortcuts/key-chord';
import { SHORTCUT_ACTION_GROUPS, SHORTCUT_SCOPE_LABELS, shortcutAction, type ShortcutAction, type ShortcutActionDefinition, type ShortcutActionGroup, type ShortcutActionId, type ShortcutScope, } from '@/engine/editor/shortcuts/shortcut-actions';
import { shortcutBindings, useShortcutBindingsVersion } from '@/engine/editor/shortcuts/shortcut-bindings';
import { SHORTCUT_GESTURE_GROUPS } from '@/engine/editor/shortcuts/shortcut-gestures';
import { ChordRecorder } from '@/engine/editor/shortcuts/ui/chord-recorder';
import { KBD_CLASS, KeyChips } from '@/engine/editor/shortcuts/ui/key-chips';
import { IconButton } from '@/engine/ui/icon-button';
import { SearchField } from '@/engine/ui/search-field';
import { EMPTY_NOTE_CLASS, FOCUS_RING_CLASS, WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { EditorDialogShell } from './editor-dialog-shell';
interface ShortcutsDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
const GESTURES_VIEW = 'gestures';
const SCOPE_NOTES: Record<ShortcutScope, string> = {
    editor: 'Valem com o foco na cena 3D e nos painéis, fora de campos de texto. As de janelas, painéis e histórico valem também na Interface.',
    gui: 'Valem na área de trabalho Interface, com uma tela aberta. No modo Testar só a vista, salvar e sair respondem.',
    code: 'Valem na área de trabalho Código e com a janela flutuante aberta, fora do campo de texto. Dentro do texto: Tab indenta, Ctrl / comenta, Alt ↑↓ move linhas, Ctrl Shift D duplica, Ctrl S salva, Ctrl F busca, Ctrl Enter executa.',
    animation: 'Valem com o foco no painel Animação (clicar em qualquer parte dele o foca).',
    audio: 'Valem com o foco no painel Áudio, na vista do recorte.',
    vfx: 'Valem com o foco no painel Efeitos.',
};
const SCOPE_ORDER: readonly ShortcutScope[] = ['editor', 'gui', 'code', 'animation', 'audio', 'vfx'];
function withScope(group: ShortcutActionGroup, definition: ShortcutActionDefinition): ShortcutAction {
    return { ...definition, scope: group.scope };
}
function customizedInGroup(group: ShortcutActionGroup): number {
    return group.actions.filter((definition) => shortcutBindings.isCustomized(definition.id as ShortcutActionId)).length;
}
function actionSearchText(group: ShortcutActionGroup, definition: ShortcutActionDefinition): string {
    const chords = shortcutBindings.chordsFor(definition.id as ShortcutActionId).map((chord) => formatChord(chord));
    return normalizeSearchText([definition.label, definition.hint ?? '', group.title, SHORTCUT_SCOPE_LABELS[group.scope], ...chords].join(' '));
}
interface GroupMatch {
    readonly group: ShortcutActionGroup;
    readonly actions: readonly ShortcutAction[];
}
function searchActions(query: string): GroupMatch[] {
    const words = searchWords(query);
    if (words.length === 0)
        return [];
    const matches: GroupMatch[] = [];
    for (const group of SHORTCUT_ACTION_GROUPS) {
        const actions = group.actions.filter((definition) => matchesAllWords(actionSearchText(group, definition), words)).map((definition) => withScope(group, definition));
        if (actions.length > 0)
            matches.push({ group, actions });
    }
    return matches;
}
function ChordChip({ chord, action }: {
    chord: string;
    action: ShortcutAction;
}) {
    const owners = shortcutBindings.ownersOf(chord, action.scope, action.id as ShortcutActionId);
    const conflict = owners.length > 0;
    const title = conflict ? `Também usado por: ${owners.map((id) => shortcutAction(id).label).join(', ')}. Só a primeira ação do registro responde.` : undefined;
    return (<span className={cn('group/chord flex items-center gap-0.5 rounded-sm p-px', conflict && 'ring-1 ring-warning/70')} title={title}>
      {conflict && <TriangleAlert className="mr-0.5 size-3 text-warning" aria-label="Conflito"/>}
      <KeyChips chord={chord}/>
      <button type="button" aria-label={`Remover ${formatChord(chord)} de ${action.label}`} onClick={() => shortcutBindings.removeChord(action.id as ShortcutActionId, chord)} className={cn('flex size-4 items-center justify-center rounded-xs text-muted-foreground/60 opacity-0 transition-opacity duration-100 group-hover/chord:opacity-100 hover:bg-highlight hover:text-destructive focus-visible:opacity-100', FOCUS_RING_CLASS)}>
        <X className="size-3" aria-hidden/>
      </button>
    </span>);
}
function ActionRow({ action }: {
    action: ShortcutAction;
}) {
    const id = action.id as ShortcutActionId;
    const chords = shortcutBindings.chordsFor(id);
    const customized = shortcutBindings.isCustomized(id);
    return (<li className="flex items-center gap-4 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-foreground">
          {customized && <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Personalizado" aria-label="Personalizado"/>}
          <span className="truncate">{action.label}</span>
        </span>
        {action.hint && <span className="text-3xs leading-relaxed text-muted-foreground text-pretty">{action.hint}</span>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {chords.length === 0 && <span className="px-1 font-mono text-3xs text-muted-foreground/60">sem atalho</span>}
        {chords.map((chord) => (<ChordChip key={chord} chord={chord} action={action}/>))}
        <ChordRecorder actionLabel={action.label} onRecord={(chord) => shortcutBindings.addChord(id, chord)}/>
        <IconButton size="xs" label="Voltar ao padrão" disabled={!customized} onClick={() => shortcutBindings.reset(id)}>
          <RotateCcw />
        </IconButton>
      </div>
    </li>);
}
function GroupView({ group, actions, breadcrumb }: {
    group: ShortcutActionGroup;
    actions: readonly ShortcutAction[];
    breadcrumb?: string;
}) {
    return (<section className="flex flex-col gap-2">
      <header className="flex flex-col gap-0.5">
        {breadcrumb && <span className="font-mono text-3xs tracking-wider text-muted-foreground uppercase">{breadcrumb}</span>}
        <h3 className="text-2xs font-semibold tracking-[0.08em] text-foreground/90 uppercase">{group.title}</h3>
      </header>
      <ul className={cn('divide-y divide-border rounded-sm', WELL_CLASS)}>
        {actions.map((action) => (<ActionRow key={action.id} action={action}/>))}
      </ul>
    </section>);
}
function SelectedGroupView({ group }: {
    group: ShortcutActionGroup;
}) {
    return (<div className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
        <p className="text-2xs leading-relaxed text-muted-foreground text-pretty">{SCOPE_NOTES[group.scope]}</p>
      </header>
      <GroupView group={group} actions={group.actions.map((definition) => withScope(group, definition))}/>
    </div>);
}
function SearchResults({ query, matches }: {
    query: string;
    matches: readonly GroupMatch[];
}) {
    const total = matches.reduce((sum, match) => sum + match.actions.length, 0);
    return (<div className="flex flex-col gap-6 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Resultados</h2>
        <p className="text-2xs text-muted-foreground">
          {total === 0 ? (<>Nenhuma ação corresponde a &ldquo;{query}&rdquo;.</>) : (<>
              {plural(total, 'ação encontrada', 'ações encontradas')} para &ldquo;{query}&rdquo;.
            </>)}
        </p>
      </header>
      {total === 0 ? (<div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', EMPTY_NOTE_CLASS)}>
          <SearchX className="size-5" aria-hidden/>
          <p className="max-w-72 text-2xs leading-relaxed text-pretty">Tente o nome da ação, o grupo em que ela fica ou a própria tecla (Ctrl+S, F2, Espaço…).</p>
        </div>) : (matches.map((match) => <GroupView key={match.group.title} group={match.group} actions={match.actions} breadcrumb={SHORTCUT_SCOPE_LABELS[match.group.scope]}/>))}
    </div>);
}
function GesturesView() {
    return (<div className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Gestos do mouse</h2>
        <p className="text-2xs leading-relaxed text-muted-foreground text-pretty">O que o mouse e o arrasto fazem em cada parte do editor.</p>
      </header>
      <div className="columns-1 gap-6 md:columns-2">
        {SHORTCUT_GESTURE_GROUPS.map((group) => (<section key={group.title} className="flex break-inside-avoid flex-col gap-1.5 pb-5">
            <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{group.title}</h3>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (<li key={item.gesture + item.label} className="flex items-start justify-between gap-3 text-2xs">
                  <span className="text-pretty text-foreground/90">{item.label}</span>
                  <kbd className={cn(KBD_CLASS, 'shrink-0')}>{item.gesture}</kbd>
                </li>))}
            </ul>
          </section>))}
      </div>
    </div>);
}
function NavButton({ active, onClick, title, children }: {
    active: boolean;
    onClick(): void;
    title?: string;
    children: React.ReactNode;
}) {
    return (<button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} title={title} className={cn('flex h-7 w-full items-center gap-2 px-4 text-left text-xs transition-colors duration-100', FOCUS_RING_CLASS, active ? 'bg-surface-raised text-foreground shadow-bevel' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
      {children}
    </button>);
}
function ShortcutsNav({ activeKey, muted, onSelect }: {
    activeKey: string;
    muted: boolean;
    onSelect(key: string): void;
}) {
    return (<nav aria-label="Grupos de atalhos" className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface-sunken/50">
      {SCOPE_ORDER.map((scope) => (<div key={scope} className="flex flex-col pb-1">
          <span className="px-4 pt-3 pb-1 font-mono text-3xs tracking-wider text-muted-foreground/70 uppercase">{SHORTCUT_SCOPE_LABELS[scope]}</span>
          <ul className="flex flex-col">
            {SHORTCUT_ACTION_GROUPS.filter((group) => group.scope === scope).map((group) => {
                const count = customizedInGroup(group);
                return (<li key={group.title}>
                  <NavButton active={!muted && activeKey === group.title} onClick={() => onSelect(group.title)}>
                    <span className="min-w-0 flex-1 truncate">{group.title}</span>
                    {count > 0 && (<span className="shrink-0 rounded-xs border border-primary/40 bg-primary/10 px-1 font-mono text-3xs text-primary" title={`${count} fora do padrão`}>
                        {count}
                      </span>)}
                  </NavButton>
                </li>);
            })}
          </ul>
        </div>))}
      <div className="mt-auto border-t border-border py-1">
        <NavButton active={!muted && activeKey === GESTURES_VIEW} onClick={() => onSelect(GESTURES_VIEW)} title="Referência do mouse e do arrasto">
          <MousePointer2 className="size-3.5 shrink-0" aria-hidden/>
          Gestos do mouse
        </NavButton>
      </div>
    </nav>);
}
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
    useShortcutBindingsVersion();
    const [activeKey, setActiveKey] = useState<string>(SHORTCUT_ACTION_GROUPS[0].title);
    const [query, setQuery] = useState('');
    const searching = query.trim().length > 0;
    const matches = useMemo(() => searchActions(query), [query]);
    const group = SHORTCUT_ACTION_GROUPS.find((candidate) => candidate.title === activeKey) ?? null;
    const customized = shortcutBindings.customizedCount;
    const conflicts = shortcutBindings.conflicts().length;
    useEffect(() => {
        if (open)
            setQuery('');
    }, [open]);
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Personalizar atalhos" description="Cada ação pode ter as combinações que você quiser. Clique em + e pressione as teclas; passe o mouse sobre uma combinação para removê-la. O ponto âmbar marca o que você mudou." action="helix.shortcuts" size="xl" body="fill" toolbar={<SearchField placeholder="Buscar ação ou tecla (duplicar, Ctrl+S, terreno…)" value={query} onChange={setQuery} className="max-w-md"/>} footer={<>
          <span className="font-mono text-3xs text-muted-foreground">{customized === 0 ? 'Tudo no padrão.' : plural(customized, 'ação personalizada', 'ações personalizadas')}</span>
          {conflicts > 0 && (<span className="flex items-center gap-1 font-mono text-3xs text-warning" role="status">
              <TriangleAlert className="size-3" aria-hidden/>
              {plural(conflicts, 'combinação em conflito', 'combinações em conflito')}
            </span>)}
          <Button size="xs" variant="outline" className="ml-auto" disabled={customized === 0} onClick={() => shortcutBindings.resetAll()}>
            Restaurar todos os padrões
          </Button>
        </>}>
      <ShortcutsNav activeKey={activeKey} muted={searching} onSelect={(key) => {
            setActiveKey(key);
            setQuery('');
        }}/>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searching ? <SearchResults query={query.trim()} matches={matches}/> : group ? <SelectedGroupView group={group}/> : <GesturesView />}
      </div>
    </EditorDialogShell>);
}
