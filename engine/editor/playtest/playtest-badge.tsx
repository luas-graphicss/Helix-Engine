'use client';
import { cn } from '@/lib/utils';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
function formatElapsedSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}
const CONTROL_HINTS: ReadonlyArray<readonly [
    string,
    string
]> = [
    ['WASD', 'mover'],
    ['Shift', 'correr'],
    ['Espaço', 'pular'],
    ['C', 'agachar'],
];
function PossessionHints({ pointerLocked }: {
    pointerLocked: boolean;
}) {
    return (<div className="pointer-events-none absolute inset-x-0 top-[4.25rem] flex justify-center">
      <div className="flex items-center gap-3 rounded-sm border border-border bg-background/70 px-3 py-1.5 font-mono text-[10px] text-muted-foreground backdrop-blur-sm">
        {CONTROL_HINTS.map(([key, action]) => (<span key={key} className="flex items-center gap-1">
            <kbd className="rounded-sm border border-border-strong bg-surface-raised px-1 text-foreground">{key}</kbd>
            {action}
          </span>))}
        <span className="text-foreground/80">{pointerLocked ? 'Esc solta o mouse' : 'Clique ou arraste no viewport para olhar'}</span>
      </div>
    </div>);
}
export function PlaytestBadge() {
    const session = useEditorState();
    const { playtest } = session;
    if (!playtest.isRunning)
        return null;
    const playing = playtest.state === 'playing';
    const stats = playtest.physics?.world.stats;
    return (<>
      <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
        <output aria-live="polite" className={cn('flex items-center gap-2 rounded-sm border px-2 py-1 font-mono text-[10px] tracking-wider uppercase backdrop-blur-sm', playing ? 'border-primary/40 bg-primary/15 text-primary' : 'border-warning/40 bg-warning/15 text-warning')}>
          <span aria-hidden className={cn('size-1.5 rounded-full', playing ? 'animate-pulse bg-primary' : 'bg-warning')}/>
          <span>{playing ? 'Simulando' : 'Pausado'}</span>
          <span className="text-foreground/80">{formatElapsedSeconds(playtest.elapsedSeconds)}</span>
          {playtest.timeScale !== 1 && <span className="text-foreground/80">{playtest.timeScale.toFixed(1)}×</span>}
          {stats && (<span className="normal-case tracking-normal text-foreground/70">
              {stats.awake}/{stats.bodies} corpos · {stats.contactPoints} contatos
            </span>)}
        </output>
      </div>
      {playtest.isPossessing && playing && <PossessionHints pointerLocked={playtest.pointerLocked}/>}
    </>);
}
