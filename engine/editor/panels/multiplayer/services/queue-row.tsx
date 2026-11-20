'use client';
import { Trash2 } from 'lucide-react';
import { removeMatchQueue, updateMatchQueue } from '@/engine/editor/operations/multiplayer/matchmaking-queue-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_TEAM_COUNT, MAX_TEAM_SIZE, type QueueConfig } from '@/engine/net/services/matchmaking/matchmaking-types';
import { IconButton } from '@/engine/ui/icon-button';
import { CommitField, NumberField } from '../shared/fields';
type NumericQueueField = Exclude<keyof QueueConfig, 'name'>;
interface QueueFieldSpec {
    readonly key: NumericQueueField;
    readonly label: string;
    readonly hint: string;
    readonly min: number;
    readonly max: number;
}
const MAX_SKILL = 100000;
const MAX_WAIT_SECONDS = 3600;
const FIELDS: readonly QueueFieldSpec[] = [
    { key: 'teamSize', label: 'Por time', hint: 'Jogadores em cada time', min: 1, max: MAX_TEAM_SIZE },
    { key: 'teamCount', label: 'Times', hint: 'Quantos times a partida tem', min: 1, max: MAX_TEAM_COUNT },
    { key: 'minPlayers', label: 'Mínimo', hint: 'Jogadores para fechar a partida quando a espera acaba', min: 1, max: MAX_TEAM_SIZE * MAX_TEAM_COUNT },
    { key: 'skillWindow', label: 'Janela', hint: 'Diferença de nível aceita no início da busca', min: 0, max: MAX_SKILL },
    { key: 'skillGrowthPerSecond', label: 'Abre/s', hint: 'Quanto a janela de nível cresce a cada segundo de espera', min: 0, max: MAX_SKILL },
    { key: 'maxWaitSeconds', label: 'Espera', hint: 'Segundos até a busca fechar com o mínimo ou expirar', min: 1, max: MAX_WAIT_SECONDS },
];
export function QueueRow({ queue }: {
    queue: QueueConfig;
}) {
    const session = useEditorSession();
    return (<li className="flex flex-col gap-1.5 rounded-sm border border-border bg-surface-sunken/40 p-2">
      <div className="flex items-center gap-1.5">
        <CommitField label={`Nome da fila ${queue.name}`} value={queue.name} className="font-medium" onCommit={(name) => updateMatchQueue(session, queue.name, { name })}/>
        <IconButton label={`Excluir a fila ${queue.name}`} size="sm" className="hover:text-destructive" onClick={() => removeMatchQueue(session, queue.name)}>
          <Trash2 />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-1.5 @md/panel:grid-cols-6">
        {FIELDS.map(({ key, label, hint, min, max }) => (<label key={key} className="flex min-w-0 flex-col gap-0.5" title={hint}>
            <span className="truncate text-3xs text-muted-foreground">{label}</span>
            <NumberField label={`${hint} da fila ${queue.name}`} value={queue[key]} min={min} max={max} className="w-full" onCommit={(value) => updateMatchQueue(session, queue.name, { [key]: value })}/>
          </label>))}
      </div>
    </li>);
}
